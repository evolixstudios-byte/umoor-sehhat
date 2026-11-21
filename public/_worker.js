export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!['/api', '/api/', '/api/index'].includes(url.pathname)) return env.ASSETS.fetch(request);
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return new Response('Forbidden', { status: 403 });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (!env.API_ORIGIN || !env.PROXY_SECRET) return Response.json({ ok: false, error: 'Backend is not configured.' }, { status: 503 });
    try {
      const target = new URL('/api', env.API_ORIGIN);
      if (target.protocol !== 'https:') throw new Error('HTTPS required');
      const headers = new Headers({ 'Content-Type': 'application/json', 'X-Proxy-Secret': env.PROXY_SECRET });
      headers.set('Cookie', request.headers.get('Cookie') || '');
      headers.set('X-Forwarded-Proto', 'https');
      headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || '');
      const result = await fetch(target, { method: 'POST', headers, body: request.body, redirect: 'manual' });
      const reply = new Response(result.body, result);
      reply.headers.set('Cache-Control', 'no-store');
      return reply;
    } catch {
      return Response.json({ ok: false, error: 'Cannot reach the backend. Please try again.' }, { status: 502 });
    }
  },
};
