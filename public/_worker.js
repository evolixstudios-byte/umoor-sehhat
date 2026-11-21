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
      const body = await request.text();
      let result = await fetch(target, { method: 'POST', headers, body, redirect: 'manual' });
      if ([502,503,504].includes(result.status) && ['auth.status','auth.staff_login','auth.admin_login'].includes(JSON.parse(body).action)) {
        await result.body?.cancel();
        // A sleeping Render service can reject POSTs until a health request wakes it.
        const health = await fetch(new URL('/healthz', target), { signal: AbortSignal.timeout(60000) });
        await health.body?.cancel();
        if (health.ok) result = await fetch(target, { method: 'POST', headers, body, redirect: 'manual' });
      }
      if (!result.headers.get('Content-Type')?.includes('application/json')) {
        await result.body?.cancel();
        return Response.json({ok:false,error:'The server is starting. Please try signing in again in a moment.'},{status:503,headers:{'Cache-Control':'no-store'}});
      }
      const reply = new Response(result.body, result);
      reply.headers.set('Cache-Control', 'no-store');
      return reply;
    } catch {
      return Response.json({ ok: false, error: 'Cannot reach the backend. Please try again.' }, { status: 502 });
    }
  },
};
