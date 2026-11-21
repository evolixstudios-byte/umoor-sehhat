process.env.DB_PATH = ':memory:';
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../shared/handler.mjs';

const ADMIN_EMAIL = 'evolixstudio@gmail.com';
const INITIAL_ADMIN_PASS = 'Evolix@5253';
const NEW_ADMIN_PASS = 'SuperSecurePass2026!';

function callApi(action, data = {}, cookie = '', extra = {}) {
  return handle({
    method: 'POST',
    headers: { cookie: cookie || '', 'x-forwarded-for': '127.0.0.1' },
    body: JSON.stringify({ action, data, ...extra }),
    secure: false,
  });
}

function parseCookie(res) {
  const sc = res.headers['Set-Cookie'];
  if (!sc) return '';
  return sc.split(';')[0];
}

test('1. Super Admin initial login and password change enforcement', async () => {
  const loginRes = await callApi('auth.admin_login', {}, '', {
    email: ADMIN_EMAIL,
    password: INITIAL_ADMIN_PASS,
  });

  assert.equal(loginRes.status, 200);
  const loginBody = JSON.parse(loginRes.body);
  assert.equal(loginBody.ok, true);
  assert.equal(loginBody.user.type, 'admin');
  assert.equal(loginBody.user.must_change_password, 1);

  const adminCookie = parseCookie(loginRes);

  // Blocked before password change
  const blockedRes = await callApi('staff.list', {}, adminCookie);
  assert.equal(blockedRes.status, 403);

  // Change admin password
  const changePassRes = await callApi('auth.change_admin_password', {}, adminCookie, {
    currentPassword: INITIAL_ADMIN_PASS,
    newPassword: NEW_ADMIN_PASS,
  });
  assert.equal(changePassRes.status, 200);
  const updatedCookie = parseCookie(changePassRes);

  // Now staff list is accessible
  const allowedRes = await callApi('staff.list', {}, updatedCookie);
  assert.equal(allowedRes.status, 200);
  const list = JSON.parse(allowedRes.body);
  assert.ok(Array.isArray(list.staff));
  // Verify all 15 real staff accounts are in the list
  assert.equal(list.staff.length, 16);
  // Verify no staff_id property in the list
  assert.equal(list.staff[0].staff_id, undefined);
});

test('2. All 15 real staff accounts log in by Staff Name with PIN 5253 & redirect to authorized counters', async () => {
  // Counter 1 — BP staff
  const bpStaff = ['Husain jawdawala', 'Murtaza kirana', 'Qusai', 'Mohammed'];
  for (const name of bpStaff) {
    const res = await callApi('auth.staff_login', {}, '', { name, pin: '5253' });
    assert.equal(res.status, 200, `Login failed for BP staff: ${name}`);
    const body = JSON.parse(res.body);
    assert.equal(body.ok, true);
    assert.equal(body.user.name, name);
    assert.deepEqual(body.user.counters, ['bp']);
    assert.equal(body.user.redirectCounter, 'bp');
  }

  // Counter 2 — Sugar staff
  const sugarStaff = ['Saifuddin', 'Taikhum', 'Burhan', 'Ammar', 'Taikhum diken'];
  for (const name of sugarStaff) {
    const res = await callApi('auth.staff_login', {}, '', { name, pin: '5253' });
    assert.equal(res.status, 200, `Login failed for Sugar staff: ${name}`);
    const body = JSON.parse(res.body);
    assert.equal(body.ok, true);
    assert.equal(body.user.name, name);
    assert.deepEqual(body.user.counters, ['sugar']);
    assert.equal(body.user.redirectCounter, 'sugar');
  }

  // Counter 3 — Height, Weight & BMI staff
  const bmiStaff = ['Husain rang', 'Hasan', 'Ali akbar', 'Murtaza chakki', 'Shabbir', 'Mustansir'];
  for (const name of bmiStaff) {
    const res = await callApi('auth.staff_login', {}, '', { name, pin: '5253' });
    assert.equal(res.status, 200, `Login failed for BMI staff: ${name}`);
    const body = JSON.parse(res.body);
    assert.equal(body.ok, true);
    assert.equal(body.user.name, name);
    assert.deepEqual(body.user.counters, ['bmi']);
    assert.equal(body.user.redirectCounter, 'bmi');
  }
});

test('3. Staff login handles case-insensitivity, whitespace trimming, and generic errors on failure', async () => {
  // Status endpoint does NOT leak staff names or list
  const statusRes = await callApi('auth.status');
  const statusBody = JSON.parse(statusRes.body);
  assert.equal(statusBody.ok, true);
  assert.equal(statusBody.staffList, undefined);

  // Case-insensitive & trimmed login
  const fuzzyLogin = await callApi('auth.staff_login', {}, '', {
    name: '   HUSAIN jawdawala   ',
    pin: '5253',
  });
  assert.equal(fuzzyLogin.status, 200);
  assert.equal(JSON.parse(fuzzyLogin.body).user.name, 'Husain jawdawala');

  // Generic error on non-existent staff name
  const invalidName = await callApi('auth.staff_login', {}, '', {
    name: 'Random Unregistered Person',
    pin: '5253',
  });
  assert.equal(invalidName.status, 401);
  assert.match(JSON.parse(invalidName.body).error, /Invalid staff name or PIN/);

  // Generic error on wrong PIN
  const wrongPin = await callApi('auth.staff_login', {}, '', {
    name: 'Husain jawdawala',
    pin: '0000',
  });
  assert.equal(wrongPin.status, 401);
  assert.match(JSON.parse(wrongPin.body).error, /Invalid staff name or PIN/);
});

test('4. Super Admin manages staff without Staff ID (create, edit, reset PIN, deactivate, delete)', async () => {
  const adminLogin = await callApi('auth.admin_login', {}, '', {
    email: ADMIN_EMAIL,
    password: NEW_ADMIN_PASS,
  });
  const adminCookie = parseCookie(adminLogin);

  // Create new staff for Counter 4 — Doctor
  const createDoc = await callApi('staff.create', {}, adminCookie, {
    name: 'Dr. Abbas Merchant',
    pin: '5253',
    counters: ['doctor'],
    canRegister: true,
  });
  assert.equal(createDoc.status, 200);
  const docBody = JSON.parse(createDoc.body);
  assert.equal(docBody.ok, true);

  // Duplicate name rejection (case-insensitive)
  const dupDoc = await callApi('staff.create', {}, adminCookie, {
    name: '  dr. abbas merchant  ',
    pin: '5253',
    counters: ['doctor'],
  });
  assert.equal(dupDoc.status, 409);
  assert.match(JSON.parse(dupDoc.body).error, /already exists/);

  // Find newly created staff in list
  const staffList = JSON.parse((await callApi('staff.list', {}, adminCookie)).body).staff;
  const docStaff = staffList.find(s => s.name === 'Dr. Abbas Merchant');
  assert.ok(docStaff);
  assert.deepEqual(docStaff.counters, ['doctor']);
  assert.equal(docStaff.canRegister, true);

  // Reset PIN for Dr. Abbas
  const resetPinRes = await callApi('staff.reset_pin', {}, adminCookie, {
    id: docStaff.id,
    pin: '9876',
  });
  assert.equal(resetPinRes.status, 200);

  // Old PIN 5253 fails
  const oldPinLogin = await callApi('auth.staff_login', {}, '', {
    name: 'Dr. Abbas Merchant',
    pin: '5253',
  });
  assert.equal(oldPinLogin.status, 401);

  // New PIN 9876 succeeds
  const newPinLogin = await callApi('auth.staff_login', {}, '', {
    name: 'Dr. Abbas Merchant',
    pin: '9876',
  });
  assert.equal(newPinLogin.status, 200);

  // Deactivate Dr. Abbas
  const deactRes = await callApi('staff.toggle_active', {}, adminCookie, { id: docStaff.id });
  assert.equal(deactRes.status, 200);
  assert.equal(JSON.parse(deactRes.body).isActive, false);

  // Deactivated login fails
  const deactLogin = await callApi('auth.staff_login', {}, '', {
    name: 'Dr. Abbas Merchant',
    pin: '9876',
  });
  assert.equal(deactLogin.status, 403);
  assert.match(JSON.parse(deactLogin.body).error, /deactivated/);

  // Reactivate Dr. Abbas
  const reactRes = await callApi('staff.toggle_active', {}, adminCookie, { id: docStaff.id });
  assert.equal(reactRes.status, 200);
  assert.equal(JSON.parse(reactRes.body).isActive, true);

  // Reactivated login succeeds
  const reactLogin = await callApi('auth.staff_login', {}, '', {
    name: 'Dr. Abbas Merchant',
    pin: '9876',
  });
  assert.equal(reactLogin.status, 200);
});

test('5. Registration generates unique Token and Serial, rejects duplicate ITS', async () => {
  // Login Dr. Abbas who has canRegister = true
  const docLogin = await callApi('auth.staff_login', {}, '', {
    name: 'Dr. Abbas Merchant',
    pin: '9876',
  });
  const docCookie = parseCookie(docLogin);

  // Register Participant 1
  const reg1 = await callApi('participant.register', {
    name: 'Taher Merchant',
    its: '12345678',
    phone: '9820011111',
    age: 48,
    gender: 'Male',
    consent: true,
  }, docCookie);

  assert.equal(reg1.status, 201);
  const p1 = JSON.parse(reg1.body).data;
  assert.equal(p1.token, 1);
  assert.equal(p1.serial, 'US-0001');
  assert.equal(p1.its, '12345678');

  // Duplicate ITS registration rejected
  const dup = await callApi('participant.register', {
    name: 'Taher Duplicate',
    its: '12345678',
    phone: '9820011111',
    age: 48,
    gender: 'Male',
    consent: true,
  }, docCookie);
  assert.equal(dup.status, 409);
  assert.equal(JSON.parse(dup.body).errorCode, 'CONFLICT');

  // Register Participant 2 -> Token 2
  const reg2 = await callApi('participant.register', {
    name: 'Sakina Shakir',
    its: '87654321',
    phone: '9820022222',
    age: 36,
    gender: 'Female',
    consent: true,
  }, docCookie);

  assert.equal(reg2.status, 201);
  const p2 = JSON.parse(reg2.body).data;
  assert.equal(p2.token, 2);
  assert.equal(p2.serial, 'US-0002');
});

test('6. Counter workflows & strict negative authorization enforcement', async () => {
  // Counter 1 BP staff: Husain jawdawala
  const bpLogin = await callApi('auth.staff_login', {}, '', { name: 'Husain jawdawala', pin: '5253' });
  const bpCookie = parseCookie(bpLogin);

  // 1. Look up Token 1
  const findRes = await callApi('participant.find_token', {}, bpCookie, { token: '1' });
  assert.equal(findRes.status, 200);
  const found = JSON.parse(findRes.body).data;
  assert.equal(found.token, 1);
  assert.equal(found.name, 'Taher Merchant');

  // 2. BP staff saves BP & Pulse reading -> SUCCEEDS
  const bpRes = await callApi('counter.save', {
    token: 1,
    counter: 'bp',
    systolic: 124,
    diastolic: 82,
    pulse: 74,
  }, bpCookie);
  assert.equal(bpRes.status, 200);
  const savedBp = JSON.parse(bpRes.body).data;
  assert.equal(savedBp.bpSystolic, '124');
  assert.equal(savedBp.bpDiastolic, '82');
  assert.equal(savedBp.pulseBpm, '74');
  assert.match(savedBp.bpBy, /Husain jawdawala/);

  // NEGATIVE AUTHORIZATION: BP staff attempts to enter Sugar -> MUST FAIL 403
  const sugarDeny = await callApi('counter.save', {
    token: 1,
    counter: 'sugar',
    sugar: 120,
    testType: 'Random',
  }, bpCookie);
  assert.equal(sugarDeny.status, 403);
  assert.match(JSON.parse(sugarDeny.body).error, /Permission denied/);

  // NEGATIVE AUTHORIZATION: BP staff attempts to enter BMI -> MUST FAIL 403
  const bmiDeny = await callApi('counter.save', {
    token: 1,
    counter: 'bmi',
    height: 170,
    weight: 70,
  }, bpCookie);
  assert.equal(bmiDeny.status, 403);

  // NEGATIVE AUTHORIZATION: BP staff attempts to enter Doctor notes -> MUST FAIL 403
  const docDeny = await callApi('counter.save', {
    token: 1,
    counter: 'doctor',
    advice: 'Unauthorized prescription attempt',
  }, bpCookie);
  assert.equal(docDeny.status, 403);

  // Counter 2 Sugar staff: Saifuddin
  const sugarLogin = await callApi('auth.staff_login', {}, '', { name: 'Saifuddin', pin: '5253' });
  const sugarCookie = parseCookie(sugarLogin);

  // Saifuddin saves Sugar for Token 1 -> SUCCEEDS
  const sugarRes = await callApi('counter.save', {
    token: 1,
    counter: 'sugar',
    sugar: 108,
    testType: 'Fasting',
  }, sugarCookie);
  assert.equal(sugarRes.status, 200);
  assert.equal(JSON.parse(sugarRes.body).data.bloodSugar, '108');
  assert.equal(JSON.parse(sugarRes.body).data.sugarType, 'Fasting');

  // NEGATIVE AUTHORIZATION: Saifuddin attempts to modify BP -> MUST FAIL 403
  const bpDenySugar = await callApi('counter.save', {
    token: 1,
    counter: 'bp',
    systolic: 140,
    diastolic: 90,
  }, sugarCookie);
  assert.equal(bpDenySugar.status, 403);

  // Counter 3 BMI staff: Hasan
  const bmiLogin = await callApi('auth.staff_login', {}, '', { name: 'Hasan', pin: '5253' });
  const bmiCookie = parseCookie(bmiLogin);

  // Hasan saves Height & Weight -> BMI automatically calculated
  const bmiRes = await callApi('counter.save', {
    token: 1,
    counter: 'bmi',
    height: 170,
    weight: 68,
  }, bmiCookie);
  assert.equal(bmiRes.status, 200);
  const bmiData = JSON.parse(bmiRes.body).data;
  assert.equal(bmiData.height, '170');
  assert.equal(bmiData.weight, '68');
  // Formula: 68 / (1.70 * 1.70) = 23.5
  assert.equal(bmiData.bmi, '23.5');

  // Counter 4 Doctor: Dr. Abbas Merchant
  const docLoginAbbas = await callApi('auth.staff_login', {}, '', { name: 'Dr. Abbas Merchant', pin: '9876' });
  const docCookieAbbas = parseCookie(docLoginAbbas);

  const docRes = await callApi('counter.save', {
    token: 1,
    counter: 'doctor',
    advice: 'Normal BP and fasting sugar. Advised 30 mins brisk walk daily.',
  }, docCookieAbbas);
  assert.equal(docRes.status, 200);
  const docData = JSON.parse(docRes.body).data;
  assert.match(docData.advice, /Normal BP/);

  // Verify that all 4 counters preserved their independent data without overwriting
  assert.equal(docData.bpSystolic, '124');
  assert.equal(docData.bpDiastolic, '82');
  assert.equal(docData.pulseBpm, '74');
  assert.equal(docData.bloodSugar, '108');
  assert.equal(docData.bmi, '23.5');
  assert.match(docData.advice, /Normal BP/);
});

test('7. Super Admin CSV export includes Token No., Pulse Rate, and preserves formatting', async () => {
  const adminLogin = await callApi('auth.admin_login', {}, '', {
    email: ADMIN_EMAIL,
    password: NEW_ADMIN_PASS,
  });
  const adminCookie = parseCookie(adminLogin);

  const csvRes = await callApi('reports.export', {}, adminCookie);
  assert.equal(csvRes.status, 200);
  assert.equal(csvRes.headers['Content-Type'], 'text/csv; charset=utf-8');
  assert.ok(csvRes.body.startsWith('\uFEFF"Token No."'));
  assert.ok(csvRes.body.includes('"Taher Merchant"'));
  assert.ok(csvRes.body.includes('"US-0001"'));
  assert.ok(csvRes.body.includes('"Pulse Rate (BPM)"'));
  assert.ok(csvRes.body.includes('"74"'));
});

test('8. Dashboard counts participants once per completed counter and editing does not increase count', async () => {
  const adminLogin = await callApi('auth.admin_login', {}, '', {
    email: ADMIN_EMAIL,
    password: NEW_ADMIN_PASS,
  });
  const adminCookie = parseCookie(adminLogin);

  // Initial stats
  const stats1Res = await callApi('admin.stats', {}, adminCookie);
  assert.equal(stats1Res.status, 200);
  const counts1 = JSON.parse(stats1Res.body).counts;

  // Participant 1 has completed all 4 counters; Participant 2 has completed 0.
  assert.equal(counts1.registered, 2);
  assert.equal(counts1.bp, 1);
  assert.equal(counts1.sugar, 1);
  assert.equal(counts1.bmi, 1);
  assert.equal(counts1.doctor, 1);

  // Now EDIT existing readings for Token 1 across counters
  const bpLogin = await callApi('auth.staff_login', {}, '', { name: 'Husain jawdawala', pin: '5253' });
  const bpCookie = parseCookie(bpLogin);

  // Edit BP
  const editBp = await callApi('counter.save', {
    token: 1,
    counter: 'bp',
    systolic: 118,
    diastolic: 76,
    pulse: 68,
  }, bpCookie);
  assert.equal(editBp.status, 200);
  assert.equal(JSON.parse(editBp.body).data.bpSystolic, '118');
  assert.equal(JSON.parse(editBp.body).data.pulseBpm, '68');

  // Edit Sugar
  const sugarLogin = await callApi('auth.staff_login', {}, '', { name: 'Saifuddin', pin: '5253' });
  const sugarCookie = parseCookie(sugarLogin);
  const editSugar = await callApi('counter.save', {
    token: 1,
    counter: 'sugar',
    sugar: 112,
    testType: 'Post-meal',
  }, sugarCookie);
  assert.equal(editSugar.status, 200);

  // Edit BMI
  const bmiLogin = await callApi('auth.staff_login', {}, '', { name: 'Hasan', pin: '5253' });
  const bmiCookie = parseCookie(bmiLogin);
  const editBmi = await callApi('counter.save', {
    token: 1,
    counter: 'bmi',
    height: 172,
    weight: 70,
  }, bmiCookie);
  assert.equal(editBmi.status, 200);

  // Check stats again -> Counts must STILL be 1 for each counter! (Not 2)
  const stats2Res = await callApi('admin.stats', {}, adminCookie);
  const counts2 = JSON.parse(stats2Res.body).counts;

  assert.equal(counts2.registered, 2, 'Total registered must remain 2');
  assert.equal(counts2.bp, 1, 'Completed BP count must remain exactly 1 after editing');
  assert.equal(counts2.sugar, 1, 'Completed Sugar count must remain exactly 1 after editing');
  assert.equal(counts2.bmi, 1, 'Completed BMI count must remain exactly 1 after editing');
  assert.equal(counts2.doctor, 1, 'Completed Doctor count must remain exactly 1 after editing');
});


test('Invalid numeric readings return useful 400 errors', async () => {
  const login = await callApi('auth.staff_login', {}, '', { name: 'Husain jawdawala', pin: '5253' });
  const result = await callApi('counter.save', { counter: 'bp', token: 1, systolic: 'bad', diastolic: 80, pulse: 70 }, parseCookie(login));
  assert.equal(result.status, 400);
  assert.match(JSON.parse(result.body).error, /numeric/);
});

test('Medical history persists through registration, lookup, and CSV without inferring old history', async () => {
  const login = await callApi('auth.staff_login', {}, '', { name: 'Dr. Abbas Merchant', pin: '9876' });
  const cookie = parseCookie(login);
  const base = {name:'History Test',phone:'9123456789',age:45,gender:'Female',consent:true};
  for (const [i, history] of [['0',['bp','sugar']],['1',['none']]]) {
    const registered = await callApi('participant.register', {...base,its:'9234567'+i,medicalHistory:history}, cookie);
    assert.equal(registered.status,201);
    const p=JSON.parse(registered.body).data;
    assert.deepEqual(p.medicalHistory,history);
    const found = await callApi('participant.find_token',{},cookie,{token:p.token});
    assert.deepEqual(JSON.parse(found.body).data.medicalHistory,history);
  }
  const old=await callApi('participant.find_token',{},cookie,{token:1});
  assert.equal(JSON.parse(old.body).data.medicalHistory,null);
  for(const history of [['none','bp'],[],['other'],['bp','bp'],'bp',null]) {
    const invalid=await callApi('participant.register',{...base,its:'92345679',medicalHistory:history},cookie);
    assert.equal(invalid.status,400,'Invalid history: '+JSON.stringify(history));
  }
  const adminLogin = await callApi('auth.admin_login',{},'',{email:ADMIN_EMAIL,password:NEW_ADMIN_PASS});
  const csv=await callApi('reports.export',{},parseCookie(adminLogin));
  assert.match(csv.body,/Reported Medical History/);
  assert.match(csv.body,/High BP history; Diabetes \/ high sugar history/);
  assert.match(csv.body,/No known history/);
});

test('Janab login can see aggregate charts but cannot read or modify patient records', async () => {
  const login=await callApi('auth.staff_login',{},'',{name:'JANAB SAAB',pin:'5253'});
  assert.equal(login.status,200);
  const user=JSON.parse(login.body).user;
  assert.deepEqual(user.permissions,['dashboard:view','participant:view']);
  const cookie=parseCookie(login);
  const status=JSON.parse((await callApi('auth.status',{},cookie)).body);
  assert.deepEqual(status.user.permissions,['dashboard:view','participant:view']);
  const stats=await callApi('dashboard.stats',{},cookie);
  assert.equal(stats.status,200);
  const data=JSON.parse(stats.body);
  assert.equal(data.total,4);
  assert.equal(data.history.reduce((sum,item)=>sum+item.count,0),data.total);
  assert.equal(data.history.find(item=>item.id==='both').count,1);
  assert.equal(data.history.find(item=>item.id==='none').count,1);
  assert.equal(data.history.find(item=>item.id==='unknown').count,2);
  assert.equal(data.registrations.reduce((sum,item)=>sum+item.count,0),data.total);
  assert.ok(!stats.body.includes('Taher'));
  assert.ok(!stats.body.includes('9123456789'));
  for(const action of ['participant.find_token','participant.search','participant.register','counter.save','admin.stats','reports.export','audit.list','staff.list','sync.trigger']) {
    assert.equal((await callApi(action,{},cookie,{token:1})).status,403,action);
  }
  const bp=await callApi('auth.staff_login',{},'',{name:'Hasan',pin:'5253'});
  assert.equal((await callApi('dashboard.stats',{},parseCookie(bp))).status,403);
});

 test('Participant directory grants detailed read access to Admin and Janab; only Super Admin can edit', async () => {
  const admin = await callApi('auth.admin_login', {}, '', { email:ADMIN_EMAIL, password:NEW_ADMIN_PASS });
  const superCookie = parseCookie(admin);
  const janab = await callApi('auth.staff_login', {}, '', {name:'janab saab',pin:'5253'});
  const janabCookie = parseCookie(janab);
  const created = await callApi('staff.create', {}, superCookie, {name:'Read Only Admin',pin:'5678',counters:[],canRegister:false,canViewParticipants:true});
  assert.equal(created.status,200);
  const login = await callApi('auth.staff_login', {}, '', {name:'Read Only Admin',pin:'5678'});
  const readerCookie = parseCookie(login);
  assert.deepEqual(JSON.parse(login.body).user.permissions,['participant:view']);
  for(const cookie of [superCookie,janabCookie,readerCookie]) {
    const listed=await callApi('participant.list',{},cookie,{query:'Taher',limit:1,offset:0});
    assert.equal(listed.status,200);
    const result=JSON.parse(listed.body);
    assert.equal(result.total,1);
    assert.equal(result.participants.length,1);
    const detail=await callApi('participant.get',{},cookie,{id:result.participants[0].id});
    assert.equal(detail.status,200);
    const p=JSON.parse(detail.body).data;
    assert.equal(p.its,'12345678');
    assert.equal(p.pulseBpm,'68');
    assert.match(p.advice,/Normal BP/);
  }
  const listed=JSON.parse((await callApi('participant.list',{},superCookie,{query:'001'})).body);
  assert.equal(listed.participants[0].token,1);
  const id=listed.participants[0].id;
  for(const cookie of [janabCookie,readerCookie]) {
    assert.equal((await callApi('participant.update',{id,changes:{name:'Forbidden'}},cookie)).status,403);
    assert.equal((await callApi('counter.save',{token:1,counter:'bp',systolic:120,diastolic:80,pulse:70},cookie)).status,403);
    assert.equal((await callApi('staff.list',{},cookie)).status,403);
  }
  const staff=await callApi('auth.staff_login',{},'',{name:'Hasan',pin:'5253'});
  assert.equal((await callApi('participant.list',{},parseCookie(staff))).status,403);
  assert.equal((await callApi('participant.get',{},parseCookie(staff),{id})).status,403);
  assert.equal((await callApi('participant.list',{},'')).status,401);
  assert.equal((await callApi('participant.list',{},readerCookie,{offset:-1})).status,400);
  assert.equal((await callApi('participant.list',{},readerCookie,{query:'9'.repeat(100)})).status,200);
  const original=JSON.parse((await callApi('participant.get',{},superCookie,{id})).body).data;
  for(const changes of [{token:999},{its:'87654321'},{age:4.5},{medicalHistory:['none','bp']},{bpSystolic:'bad'},{bloodSugar:0},{advice:''}]) {
    const invalid=await callApi('participant.update',{id,expectedUpdatedAt:original.updatedAt,changes},superCookie);
    assert.ok([400,409].includes(invalid.status),'Invalid change '+JSON.stringify(changes));
  }
  const updated=await callApi('participant.update',{id,expectedUpdatedAt:original.updatedAt,changes:{name:'Taher Corrected',phone:'9123450000',age:49,medicalHistory:['bp'],bpSystolic:135,bpDiastolic:85,pulseBpm:72,height:170,weight:68,advice:'Follow up next week'}},superCookie);
  assert.equal(updated.status,200);
  const result=JSON.parse(updated.body).data;
  assert.equal(result.name,'Taher Corrected');
  assert.equal(result.token,1);
  assert.equal(result.serial,original.serial);
  assert.equal(result.registeredAt,original.registeredAt);
  assert.equal(result.bmi,'23.5');
  assert.equal(result.advice,'Follow up next week');
  assert.notEqual(result.updatedAt,original.updatedAt);
  const stale=await callApi('participant.update',{id,expectedUpdatedAt:original.updatedAt,changes:{name:'Stale'}},superCookie);
  assert.equal(stale.status,409);
  const fresh=JSON.parse((await callApi('participant.get',{},janabCookie,{id})).body).data;
  assert.equal(fresh.name,'Taher Corrected');
  assert.equal(fresh.bloodSugar,original.bloodSugar);
  const roleId=JSON.parse(created.body).staff.id;
  const revoked=await callApi('staff.update',{},superCookie,{id:roleId,name:'Read Only Admin',counters:[],canRegister:false,canViewParticipants:false});
  assert.equal(revoked.status,200);
  assert.equal((await callApi('participant.list',{},readerCookie)).status,403);
 });
