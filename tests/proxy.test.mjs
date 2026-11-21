import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../public/_worker.js';

test('Cloudflare proxy preserves sessions and rejects foreign origins', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (target, init) => {
    assert.equal(String(target), 'https://backend.example/api');
    assert.equal(init.headers.get('Cookie'), 'umoor_session=test');
    assert.equal(init.headers.get('X-Proxy-Secret'), 'secret');
    return new Response('{"ok":true}', { headers: { 'Content-Type':'application/json', 'Set-Cookie': 'umoor_session=new; HttpOnly; Secure; SameSite=Strict' } });
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

test('Sleeping backend wakes before retrying sign-in and preserves its cookie',async()=>{
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(target,init)=>{
   calls.push({url:String(target),body:init?.body});
   if(calls.length===1)return new Response('<!DOCTYPE html>Unavailable',{status:502});
   if(calls.length===2)return Response.json({ok:true});
   return new Response('{"ok":true}',{headers:{'Content-Type':'application/json','Set-Cookie':'umoor_session=new; HttpOnly; Secure'}});
 };
 try{
   const body=JSON.stringify({action:'auth.staff_login',name:'Test',pin:'5253'});
   const response=await worker.fetch(new Request('https://frontend.example/api',{method:'POST',body}),{API_ORIGIN:'https://backend.example',PROXY_SECRET:'secret'});
   assert.equal(response.status,200);assert.equal(calls[1].url,'https://backend.example/healthz');assert.equal(calls[2].body,body);
   assert.match(response.headers.get('Set-Cookie'),/umoor_session=new/);
 }finally{globalThis.fetch=original;}
});

test('HTML failures become JSON errors and participant writes are never replayed',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response('<!DOCTYPE html>Unavailable',{status:502});};
 try{
   const response=await worker.fetch(new Request('https://frontend.example/api',{method:'POST',body:JSON.stringify({action:'participant.register'})}),{API_ORIGIN:'https://backend.example',PROXY_SECRET:'secret'});
   assert.equal(calls,1);assert.equal(response.status,503);assert.equal((await response.json()).ok,false);
 }finally{globalThis.fetch=original;}
});
