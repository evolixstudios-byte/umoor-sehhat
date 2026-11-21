import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from './shared/handler.mjs';
import { getDb, withDatabase } from './shared/db.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, 'public');

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    // .env not found or unreadable, ignore
  }
}

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV === 'production') {
  for (const name of ['DATABASE_URL', 'SESSION_SECRET', 'ADMIN_EMAIL', 'ADMIN_INITIAL_PASSWORD', 'STAFF_INITIAL_PIN', 'PROXY_SECRET']) {
    if (!process.env[name]) throw new Error(`${name} must be configured in production.`);
  }
  if (process.env.SESSION_SECRET.length < 32 || process.env.PROXY_SECRET.length < 32) throw new Error('Signing and proxy secrets must have at least 32 characters.');
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // API route handling
    if (pathname === '/healthz') {
      await withDatabase(async () => { await getDb().prepare('SELECT 1').get(); });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (pathname === '/api' || pathname === '/api/' || pathname === '/api/index') {
      if (process.env.PROXY_SECRET && req.headers['x-proxy-secret'] !== process.env.PROXY_SECRET) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Access through the application frontend.' }));
        return;
      }
      let body = '';
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 64000) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Request too large.' }));
          return;
        }
        body += chunk;
      }

      const reply = await handle({
        method: req.method,
        headers: req.headers,
        body,
        secure: req.headers['x-forwarded-proto'] === 'https',
      });

      for (const [key, value] of Object.entries(reply.headers || {})) {
        res.setHeader(key, value);
      }
      res.statusCode = reply.status;
      res.end(reply.body);
      return;
    }

    // Static file serving
    if (pathname === '/' || pathname === '') {
      pathname = '/index.html';
    }

    const safePath = path.normalize(path.join(PUBLIC_DIR, pathname));
    if (safePath !== PUBLIC_DIR && !safePath.startsWith(PUBLIC_DIR + path.sep)) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Forbidden');
      return;
    }

    try {
      const stats = await fs.promises.stat(safePath);
      let targetFile = safePath;
      if (stats.isDirectory()) {
        targetFile = path.join(safePath, 'index.html');
      }

      const ext = path.extname(targetFile).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');

      req.on('error', () => {});
      res.on('error', () => {});

      const stream = fs.createReadStream(targetFile);
      stream.on('error', () => {
        if (!res.headersSent) {
          res.statusCode = 404;
          res.end('Not Found');
        }
      });
      stream.pipe(res);
    } catch {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Not Found');
    }
  } catch (err) {
    res.statusCode = 500;
    console.error('Request failed:', err.message);
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'The server could not complete the request. Please try again.' }));
    }
  }
});

server.on('error', (err) => {
  console.error('HTTP server error:', err.message);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  Umoor Sehat — Ratangarh Kheri Jamiat`);
  console.log(`  Local server running at:`);
  console.log(`  > http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
