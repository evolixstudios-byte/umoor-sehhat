import { handle } from '../shared/handler.mjs';
export default async function handler(req, res) {
  let body = '';
  if (typeof req.body === 'string') body = req.body;
  else if (req.body && typeof req.body === 'object') body = JSON.stringify(req.body);
  else for await (const chunk of req) body += chunk;
  const reply = await handle({
    method: req.method,
    headers: req.headers,
    body,
    secure: req.headers['x-forwarded-proto'] === 'https' || process.env.VERCEL === '1',
  });
  for (const [key,value] of Object.entries(reply.headers)) res.setHeader(key,value);
  res.status(reply.status).send(reply.body);
}
