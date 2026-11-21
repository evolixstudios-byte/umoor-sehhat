import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

test('Sheets backup appends history column without moving existing columns', () => {
  const context=vm.createContext({});
  vm.runInContext(readFileSync(new URL('../google-apps-script/Code.gs',import.meta.url),'utf8'),context);
  const oldHeaders=Array.from(context.HEADERS).slice(0,-1);
  const headers=[...oldHeaders,''];
  const writes=[];
  const sheet={getRange: (...args)=>({getValues:()=>[headers],setValue:value=>{writes.push({args,value});}})};
  context.SpreadsheetApp={getActiveSpreadsheet:()=>({getSheetByName:()=>sheet})};
  context.getSheet_();
  assert.equal(writes.length,1);
  assert.equal(writes[0].args[1],24);
  assert.equal(writes[0].value,'Reported Medical History');
  const record=context.record_([...Array(23).fill(''),'["bp","sugar"]']);
  assert.equal(JSON.stringify(record.medicalHistory),'["bp","sugar"]');
});
