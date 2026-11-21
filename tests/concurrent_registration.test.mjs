process.env.DB_PATH = ':memory:';
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../shared/handler.mjs';

const ADMIN_EMAIL = 'evolixstudio@gmail.com';
const INITIAL_ADMIN_PASS = 'Evolix@5253';
const NEW_ADMIN_PASS = 'ConcurrentTestPass2026!';

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

test('CONCURRENT REGISTRATION & AUTOMATIC TOKEN SYSTEM SUITE', async (t) => {
  let adminCookie = '';
  const staffCookies = [];

  await t.test('1. Setup Super Admin and 3 distinct Registration Staff accounts', async () => {
    // Admin login
    const loginRes = await callApi('auth.admin_login', {}, '', {
      email: ADMIN_EMAIL,
      password: INITIAL_ADMIN_PASS,
    });
    assert.equal(loginRes.status, 200);
    adminCookie = parseCookie(loginRes);

    // If initial password must be changed
    const loginBody = JSON.parse(loginRes.body);
    if (loginBody.user.must_change_password) {
      const changeRes = await callApi('auth.change_admin_password', {}, adminCookie, {
        currentPassword: INITIAL_ADMIN_PASS,
        newPassword: NEW_ADMIN_PASS,
      });
      assert.equal(changeRes.status, 200);
      adminCookie = parseCookie(changeRes);
    }

    // Create 3 Registration Staff accounts with registration privileges
    const staffNames = ['RegDesk Operator Alpha', 'RegDesk Operator Beta', 'RegDesk Operator Gamma'];
    for (const name of staffNames) {
      const createRes = await callApi('staff.create', {}, adminCookie, {
        name,
        pin: '5253',
        counters: [],
        canRegister: true,
      });
      assert.ok(createRes.status === 200 || createRes.status === 409);

      // Log in as this registration staff
      const staffLogin = await callApi('auth.staff_login', {}, '', { name, pin: '5253' });
      assert.equal(staffLogin.status, 200, `Staff login failed for ${name}`);
      const staffBody = JSON.parse(staffLogin.body);
      assert.equal(staffBody.ok, true);
      assert.equal(staffBody.user.canRegister, true);
      staffCookies.push({ name, cookie: parseCookie(staffLogin) });
    }

    assert.equal(staffCookies.length, 3);
  });

  await t.test('2. 20 SIMULTANEOUS CONCURRENT REGISTRATIONS: No duplicates, atomic sequential monotonic tokens', async () => {
    const CONCURRENCY_COUNT = 20;

    // Dispatch 20 concurrent registration requests at the exact same instant using Promise.all
    const promises = [];
    for (let i = 0; i < CONCURRENCY_COUNT; i++) {
      const itsNum = String(61000000 + i); // 8-digit unique ITS
      const staffIdx = i % staffCookies.length;
      const staff = staffCookies[staffIdx];

      promises.push(
        callApi('participant.register', {
          name: `Concurrent Participant ${i + 1}`,
          its: itsNum,
          phone: `98765432${String(i).padStart(2, '0')}`,
          age: 20 + (i % 50),
          gender: i % 2 === 0 ? 'Male' : 'Female',
          consent: true,
          clientRequestId: `req_concurrent_${i}_${Date.now()}`,
        }, staff.cookie)
      );
    }

    const results = await Promise.all(promises);

    // Verify all 20 succeeded with 201 Created
    for (let i = 0; i < CONCURRENCY_COUNT; i++) {
      const res = results[i];
      assert.equal(res.status, 201, `Request #${i + 1} failed with status ${res.status}: ${res.body}`);
    }

    // Extract all generated token numbers and formatted tokens
    const tokens = [];
    const formattedTokens = [];
    const registeredByList = [];

    for (const res of results) {
      const body = JSON.parse(res.body);
      assert.equal(body.ok, true);
      assert.ok(typeof body.token === 'number');
      assert.ok(typeof body.tokenFormatted === 'string');
      tokens.push(body.token);
      formattedTokens.push(body.tokenFormatted);
      registeredByList.push(body.data.registeredBy);
    }

    // A. Assert ZERO duplicate tokens (all unique)
    const uniqueTokens = new Set(tokens);
    assert.equal(uniqueTokens.size, CONCURRENCY_COUNT, `Expected ${CONCURRENCY_COUNT} unique tokens, but got duplicate collisions!`);

    // B. Assert strictly monotonic sequence without gaps
    const sortedTokens = [...tokens].sort((a, b) => a - b);
    for (let i = 1; i < sortedTokens.length; i++) {
      assert.equal(
        sortedTokens[i],
        sortedTokens[i - 1] + 1,
        `Sequence gap detected between ${sortedTokens[i - 1]} and ${sortedTokens[i]}`
      );
    }

    // C. Assert formatting (e.g. "003", "042", "100")
    for (const f of formattedTokens) {
      assert.match(f, /^[0-9]{3,}$/, `Formatted token ${f} must have at least 3 digits`);
    }

    assert.equal(formattedTokens[0], '001');

    // D. Assert shared sequence across multiple staff operators
    const uniqueStaffInvolved = new Set(registeredByList);
    assert.equal(uniqueStaffInvolved.size, 3, 'All 3 registration operators must have contributed to the shared sequence');
  });

  await t.test('3. CONCURRENT DUPLICATE ITS ATTEMPT: 5 simultaneous requests for same ITS', async () => {
    const existingIts = '61000000'; // Registered in test 2
    const promises = [];

    for (let i = 0; i < 5; i++) {
      const staff = staffCookies[i % staffCookies.length];
      promises.push(
        callApi('participant.register', {
          name: `Duplicate Attempt ${i}`,
          its: existingIts,
          phone: '9999999999',
          age: 35,
          gender: 'Male',
          consent: true,
          clientRequestId: `req_dup_${i}_${Date.now()}`,
        }, staff.cookie)
      );
    }

    const results = await Promise.all(promises);

    // All 5 must be rejected with 409 Conflict
    for (let i = 0; i < 5; i++) {
      const res = results[i];
      assert.equal(res.status, 409, `Expected 409 Conflict for duplicate ITS, got ${res.status}`);
      const body = JSON.parse(res.body);
      assert.equal(body.ok, false);
      assert.equal(body.errorCode, 'CONFLICT');
      assert.ok(body.error.includes(existingIts));
      assert.ok(body.existing, 'Conflict response must contain existing participant record');
    }
  });

  await t.test('4. IDEMPOTENCY KEY: Identical clientRequestId returns cached 201 without incrementing sequence', async () => {
    const staff = staffCookies[0];
    const key = `idem_key_${Date.now()}_test`;
    const participantPayload = {
      name: 'Idempotency Test User',
      its: '72000001',
      phone: '9123456789',
      age: 28,
      gender: 'Female',
      consent: true,
      clientRequestId: key,
    };

    // First attempt
    const res1 = await callApi('participant.register', participantPayload, staff.cookie);
    assert.equal(res1.status, 201);
    const body1 = JSON.parse(res1.body);
    const firstToken = body1.token;

    // Second attempt with EXACT SAME clientRequestId (simulating retry / double click)
    const res2 = await callApi('participant.register', participantPayload, staff.cookie);
    assert.equal(res2.status, 201);
    const body2 = JSON.parse(res2.body);
    const secondToken = body2.token;

    // Tokens must match exactly and no second token was allocated!
    assert.equal(secondToken, firstToken, 'Idempotent request must return identical token');
  });

  await t.test('5. MEDICAL COUNTERS LOOKUP: Look up generated token across Counter 1-4 and record data', async () => {
    // Look up by integer token, formatted token "001", and serial "US-0001"
    const lookup1 = await callApi('participant.find_token', {}, staffCookies[0].cookie, { token: '1' });
    assert.equal(lookup1.status, 200);
    const p1 = JSON.parse(lookup1.body).data;
    assert.equal(p1.token, 1);

    const lookupFormatted = await callApi('participant.find_token', {}, staffCookies[0].cookie, { token: '001' });
    assert.equal(lookupFormatted.status, 200);
    assert.equal(JSON.parse(lookupFormatted.body).data.token, 1);

    // Save Counter 1 (BP & Pulse)
    const bpStaffLogin = await callApi('auth.staff_login', {}, '', { name: 'Husain jawdawala', pin: '5253' });
    const bpCookie = parseCookie(bpStaffLogin);
    const saveBp = await callApi('counter.save', {
      token: '001',
      counter: 'bp',
      systolic: 124,
      diastolic: 82,
      pulse: 74,
    }, bpCookie);
    assert.equal(saveBp.status, 200);
    const savedBpData = JSON.parse(saveBp.body).data;
    assert.equal(savedBpData.bpSystolic, '124');
    assert.equal(savedBpData.bpDiastolic, '82');
    assert.equal(savedBpData.pulseBpm, '74');

    // Save Counter 2 (Sugar)
    const sugarLogin = await callApi('auth.staff_login', {}, '', { name: 'Saifuddin', pin: '5253' });
    const sugarCookie = parseCookie(sugarLogin);
    const saveSugar = await callApi('counter.save', {
      token: '001',
      counter: 'sugar',
      sugar: 104,
      testType: 'Fasting',
    }, sugarCookie);
    assert.equal(saveSugar.status, 200);
    const savedSugarData = JSON.parse(saveSugar.body).data;
    assert.equal(savedSugarData.bloodSugar, '104');
    assert.equal(savedSugarData.sugarType, 'Fasting');

    // Save Counter 3 (BMI)
    const bmiLogin = await callApi('auth.staff_login', {}, '', { name: 'Hasan', pin: '5253' });
    const bmiCookie = parseCookie(bmiLogin);
    const saveBmi = await callApi('counter.save', {
      token: '001',
      counter: 'bmi',
      height: 175,
      weight: 72,
    }, bmiCookie);
    assert.equal(saveBmi.status, 200);
    const savedBmiData = JSON.parse(saveBmi.body).data;
    assert.equal(savedBmiData.height, '175');
    assert.equal(savedBmiData.weight, '72');
    assert.equal(savedBmiData.bmi, '23.5');

    // Save Counter 4 (Doctor) as Admin
    const saveDoctor = await callApi('counter.save', {
      token: '001',
      counter: 'doctor',
      advice: 'Healthy lifestyle, routine checkup advised.',
    }, adminCookie);
    assert.equal(saveDoctor.status, 200);
    const savedDocData = JSON.parse(saveDoctor.body).data;
    assert.equal(savedDocData.advice, 'Healthy lifestyle, routine checkup advised.');

    // Verify all counters co-exist on the participant without overwriting
    const finalLookup = await callApi('participant.find_token', {}, adminCookie, { token: '001' });
    const finalP = JSON.parse(finalLookup.body).data;
    assert.equal(finalP.bpSystolic, '124');
    assert.equal(finalP.pulseBpm, '74');
    assert.equal(finalP.bloodSugar, '104');
    assert.equal(finalP.bmi, '23.5');
    assert.equal(finalP.advice, 'Healthy lifestyle, routine checkup advised.');
  });

  await t.test('6. SUPER ADMIN REGISTRATION STATS & AUDIT LOGGING', async () => {
    const statsRes = await callApi('admin.stats', {}, adminCookie);
    assert.equal(statsRes.status, 200);
    const body = JSON.parse(statsRes.body);

    assert.ok(body.registration, 'admin.stats must return registration object');
    const reg = body.registration;

    assert.equal(reg.total, 21);
    assert.equal(reg.lastToken, 21);
    assert.match(reg.lastTokenFormatted, /^[0-9]{3,}$/);
    assert.ok(reg.activeStaff >= 3, `Active registration staff should be at least 3, got ${reg.activeStaff}`);

    // Verify staff activity breakdown
    assert.ok(Array.isArray(reg.staffActivity));
    assert.ok(reg.staffActivity.length >= 3);
    for (const item of reg.staffActivity) {
      assert.ok(item.operator);
      assert.ok(item.count > 0);
    }

    // Verify duplicate attempts logged
    assert.ok(Array.isArray(reg.duplicateAttempts));
    assert.ok(reg.duplicateAttempts.length >= 5, 'Duplicate ITS attempts must be logged in audit trail');
    const firstDup = reg.duplicateAttempts[0];
    assert.ok(firstDup.operator);
    assert.ok(firstDup.its);
    assert.ok(firstDup.existingToken);
  });
});
