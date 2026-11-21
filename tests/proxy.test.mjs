import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../public/_worker.js';

test('Cloudflare proxy preserves sessions and rejects foreign origins', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (target, init) => {
    assert.equal(String(target), 'https://backend.example/api');
    assert.equal(init.headers.get('Cookie'), 'umoor_session=test');
    assert.equal(init.headers.get('X-Proxy-Secret'), 'secret');
    return new Response('{"ok":true}', { headers: { 'Set-Cookie': 'umoor_session=new; HttpOnly; Secure; SameSite=Strict' } });
  };
  try {
    const env = { API_ORIGIN: 'https://backend.example', PROXY_SECRET: 'secret' };
    const result = await worker.fetch(new Request('https://frontend.example/api', {
      method: 'POST', body: '{}', headers: { Origin: 'https://frontend.example', Cookie: 'umoor_session=test' },
    }), env);
    assert.equal(result.status, 200);
    assert.match(result.headers.get('Set-Cookie'), /umoor_session=new/);
    assert.equal((await worker.fetch(new Request('https://frontend.example/api', {
      method: 'POST', headers: { Origin: 'https://evil.example' },
    }), env)).status, 403);
    assert.equal((await worker.fetch(new Request('https://frontend.example/api', { method: 'POST' }), {})).status, 503);
  } finally { globalThis.fetch = original; }
});
