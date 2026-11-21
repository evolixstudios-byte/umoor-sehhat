import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('Sheets participant correction uses previous ITS and preserves row identity',()=>{
 const context=vm.createContext({});
 vm.runInContext(readFileSync(new URL('../google-apps-script/Code.gs',import.meta.url),'utf8'),context);
 const writes=[];
 const sheet={getRange:(...args)=>({setValue:value=>writes.push({column:args[1],value}),setValues:value=>writes.push({column:args[1],value})})};
 context.rowIndex_=(_sheet,its)=>its==='12345678' ? 2 : -1;
 context.recordAt_=(_sheet,row)=>({row});
 const result=context.updateParticipant_(sheet,{previousIts:'12345678',its:'87654321',name:'Corrected',phone:'9123456789',age:45,gender:'Male',medicalHistory:['bp'],consent:true});
 assert.equal(result.row,2);
 assert.equal(writes.find(item=>item.column===3).value,'87654321');
 assert.equal(writes.find(item=>item.column===24).value,'["bp"]');
});

test('Sheets deletion removes only the matching row and safely handles a retry',()=>{
 const context=vm.createContext({});
 vm.runInContext(readFileSync(new URL('../google-apps-script/Code.gs',import.meta.url),'utf8'),context);
 const deleted=[];
 const sheet={deleteRow:row=>deleted.push(row)};
 context.rowIndex_=(_sheet,its)=>its==='12345678' ? 2 : -1;
 assert.equal(context.deleteParticipant_(sheet,{its:'12345678'}).deleted,true);
 assert.deepEqual(deleted,[2]);
 context.rowIndex_=()=>-1;
 assert.equal(context.deleteParticipant_(sheet,{its:'12345678'}).deleted,false);
 assert.deepEqual(deleted,[2]);
 assert.throws(()=>context.deleteParticipant_(sheet,{its:'invalid'}),/8 digits/);
});
