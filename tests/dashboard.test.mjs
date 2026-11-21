import test from 'node:test';
import assert from 'node:assert/strict';
import { getCampStats } from '../shared/dashboard.mjs';

const makeDb = rows => ({prepare: () => ({all: async () => rows})});
test('Janab dashboard handles an empty camp and fills missing dates in India time', async () => {
  const empty = await getCampStats(makeDb([]));
  assert.equal(empty.total,0);
  assert.deepEqual(empty.registrations,[]);
  const base = {age:40,medical_history:null,bp_systolic:null,bp_diastolic:null,blood_sugar:null};
  const data=await getCampStats(makeDb([
    {...base,registered_at:'2026-11-20T20:00:00Z',medical_history:'["bp","sugar"]',bp_systolic:150,bp_diastolic:95},
    {...base,registered_at:'2026-11-23T03:00:00Z',medical_history:'["none"]',blood_sugar:126,sugar_type:'Fasting'},
  ]));
  assert.deepEqual(data.registrations,[{date:'2026-11-21',count:1},{date:'2026-11-22',count:0},{date:'2026-11-23',count:1}]);
  assert.equal(data.history.find(item=>item.id==='both').count,1);
  assert.equal(data.readings.bpFlagged,1);
  assert.equal(data.readings.sugarFlagged,1);
  assert.equal(data.readings.bpRecorded,1);
});
