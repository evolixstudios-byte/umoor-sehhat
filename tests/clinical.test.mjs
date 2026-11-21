import test from 'node:test';
import assert from 'node:assert/strict';
import { getReadingFlags, selectHistory } from '../public/clinical.js';

const adult = { age: 40, bpSystolic: '119', bpDiastolic: '79', bloodSugar: '99', sugarType: 'Fasting' };

test('BP uses either number, handles boundaries and never marks missing or child readings normal', () => {
  for (const [sys, dia, status] of [
    [119,79,'normal'], [120,79,'elevated'], [129,79,'elevated'], [130,79,'high'], [119,80,'high'],
    [140,90,'high'], [180,120,'high'], [181,80,'urgent'], [120,121,'urgent'], [89,60,'low'], [100,59,'low'], [150,59,'low'], [90,60,'normal'],
  ]) assert.equal(getReadingFlags({...adult, bpSystolic:sys, bpDiastolic:dia}).bp.status, status);
  assert.equal(getReadingFlags({...adult, bpSystolic:''}).bp.status, 'pending');
  assert.equal(getReadingFlags({...adult, bpDiastolic:null}).bp.status, 'pending');
  assert.equal(getReadingFlags({...adult, bpSystolic:'bad'}).bp.status, 'pending');
  assert.equal(getReadingFlags({...adult, age:12}).bp.status, 'review');
  for(const [sys,dia,stage] of [[130,79,1],[139,79,1],[119,80,1],[119,89,1],[140,79,2],[119,90,2],[181,80,2]]) {
    assert.match(getReadingFlags({...adult,bpSystolic:sys,bpDiastolic:dia}).bp.label,new RegExp(`Stage ${stage}`));
  }
});

test('Sugar flags distinguish fasting, random and un-timed post-meal readings', () => {
  for (const [value, type, status] of [
    [69,'Fasting','low'],[70,'Fasting','normal'],[99,'Fasting','normal'],[100,'Fasting','elevated'],
    [125,'Fasting','elevated'],[126,'Fasting','high'],[199,'Random','elevated'],[200,'Random','high'],
    [53,'Random','urgent'],[54,'Random','low'],[69,'Random','low'],[70,'Random','normal'],
    [140,'Random','normal'],[140.1,'Random','elevated'],[199.9,'Random','elevated'],[53,'Fasting','urgent'],
    [150,'Post-meal','review'],[200,'Post-meal','review'],[69,'Post-meal','low'],[99,'Unknown','review'],
  ]) assert.equal(getReadingFlags({...adult, bloodSugar:value, sugarType:type}).sugar.status,status);
  assert.equal(getReadingFlags({...adult, bloodSugar:''}).sugar.status,'pending');
  assert.equal(getReadingFlags({...adult, age:12}).sugar.status,'review');
  assert.match(getReadingFlags({...adult,bloodSugar:53,sugarType:'Random'}).sugar.label,/dangerously low/i);
});

test('History allows BP plus sugar and makes no-known-history exclusive', () => {
  assert.deepEqual(selectHistory(['none'],'bp',true), ['bp']);
  assert.deepEqual(selectHistory(['bp'],'sugar',true), ['bp','sugar']);
  assert.deepEqual(selectHistory(['bp','sugar'],'none',true), ['none']);
  assert.deepEqual(selectHistory(['bp','sugar'],'bp',false), ['sugar']);
  assert.deepEqual(selectHistory(['none'],'none',false), []);
});
