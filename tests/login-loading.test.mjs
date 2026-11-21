import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('async function call('), app.indexOf('\nfunction ', app.indexOf('async function call(')));
function setup(replies) {
  const button={innerHTML:'Sign In',textContent:'Sign In',isConnected:true,disabled:false};
  const notices=[];let requests=0;
  const context=vm.createContext({Response,Error,AbortSignal,document:{getElementById:()=>button,querySelector:()=>null},state:{},notify:message=>notices.push(message),render:()=>{},setTimeout:callback=>callback(),fetch:async()=>{
    requests++;const reply=replies.shift();if(reply instanceof Error)throw reply;return reply;
  }});
  vm.runInContext(source,context);
  return {context,button,notices,requests:()=>requests};
}
test('Login keeps loading through gateway errors and succeeds without an error toast',async()=>{
  const s=setup([new Response('<html>502</html>',{status:502}),new Response('Unavailable',{status:503}),Response.json({ok:true})]);
  const pending=s.context.call('auth.staff_login');assert.equal(s.button.disabled,true);
  assert.equal((await pending).ok,true);assert.equal(s.requests(),3);assert.deepEqual(s.notices,[]);assert.equal(s.button.disabled,false);
});
test('Network failures retry, invalid credentials do not retry, and writes are not replayed',async()=>{
  const s=setup([new TypeError('Network failed'),Response.json({ok:true})]);await s.context.call('auth.status');assert.equal(s.requests(),2);
  const bad=setup([Response.json({ok:false,error:'Invalid credentials'},{status:401})]);await assert.rejects(bad.context.call('auth.staff_login'),/Invalid credentials/);assert.equal(bad.requests(),1);
  const write=setup([new Response('Unavailable',{status:502})]);await assert.rejects(write.context.call('participant.register'));assert.equal(write.requests(),1);
});
test('A persistent outage ends with a clear message and enables login again',async()=>{
  const s=setup(Array.from({length:4},()=>new Response('Unavailable',{status:502})));
  await assert.rejects(s.context.call('auth.admin_login'),/taking longer than expected/);assert.equal(s.requests(),4);assert.equal(s.button.disabled,false);assert.equal(s.notices.length,1);
});
