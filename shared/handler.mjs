import { HISTORY_OPTIONS } from '../public/clinical.js';
import { getCampStats } from './dashboard.mjs';
import { randomUUID } from 'node:crypto';
import { getDb, formatTokenNumber, allocateNextToken, withDatabase } from './db.mjs';
import {
  hashSecret,
  verifySecret,
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit,
  createSessionToken,
  verifySessionToken,
} from './auth.mjs';
import { PERMISSIONS, COUNTERS, getPermissionsFromStaff, hasPermission } from './permissions.mjs';
import { logAudit, getAuditLogs } from './audit.mjs';
import { queueSync, processSyncQueue, getSyncStats, generateCsvExport } from './sync.mjs';

const COOKIE_NAME = 'umoor_session';
const MAX_AGE = 12 * 60 * 60; // 12 hours

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private, max-age=0',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

const response = (body, status = 200, more = {}) => ({
  status,
  headers: { ...jsonHeaders, ...more },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

function cookieHeader(value, secure, clear = false) {
  return `${COOKIE_NAME}=${clear ? '' : encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : MAX_AGE}${secure ? '; Secure' : ''}`;
}

function extractCookie(cookieHeaderStr) {
  if (!cookieHeaderStr) return null;
  const match = cookieHeaderStr.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function parseUserSession(headers) {
  const cookieStr = headers['cookie'] || headers['Cookie'] || '';
  const token = extractCookie(cookieStr);
  if (!token) return null;
  return verifySessionToken(token);
}

class ValidationError extends Error {}

function onlyDigits(input, len, label) {
  const s = String(input ?? '').trim();
  if (!new RegExp(`^[0-9]{${len}}$`).test(s)) {
    throw new ValidationError(`${label} must contain exactly ${len} digits.`);
  }
  return s;
}

function safeText(value, limit, label) {
  const v = String(value ?? '').trim().replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ');
  if (!v || v.length > limit) {
    throw new ValidationError(`${label} is required (maximum ${limit} characters).`);
  }
  return v;
}

function parseNumber(input, min, max, label) {
  const raw = String(input ?? '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(raw)) {
    throw new ValidationError(`${label} must be numeric.`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new ValidationError(`${label} must be between ${min} and ${max}.`);
  }
  return n;
}

function medicalHistoryValue(history) {
  if (history !== undefined && (!Array.isArray(history) || history.length === 0 ||
      history.some(id => !HISTORY_OPTIONS.some(option => option.id === id)) ||
      new Set(history).size !== history.length ||
      (history.includes('none') && history.length !== 1))) {
    throw new ValidationError('Choose BP, diabetes, both, or no known history.');
  }
  return history === undefined ? null : JSON.stringify(history);
}

function formatParticipant(p, userPermissions = []) {
  if (!p) return null;
  const canSeeDoctor = hasPermission(userPermissions, PERMISSIONS.COUNTER_DOCTOR) ||
    hasPermission(userPermissions, PERMISSIONS.ADMIN_FULL) ||
    hasPermission(userPermissions, PERMISSIONS.PARTICIPANT_VIEW) ||
    userPermissions.includes('*');

  return {
    id: p.id,
    token: p.token,
    tokenFormatted: formatTokenNumber(p.token),
    serial: p.serial,
    its: p.its,
    name: p.name,
    phone: p.phone,
    age: p.age,
    gender: p.gender,
    consent: Boolean(p.consent),
    medicalHistory: p.medical_history ? JSON.parse(p.medical_history) : null,
    registeredAt: p.registered_at || '',
    registeredBy: p.registered_by || '',
    bpSystolic: p.bp_systolic != null ? String(p.bp_systolic) : '',
    bpDiastolic: p.bp_diastolic != null ? String(p.bp_diastolic) : '',
    pulseBpm: p.pulse_bpm != null ? String(p.pulse_bpm) : '',
    bpAt: p.bp_at || '',
    bpBy: p.bp_by || '',
    bloodSugar: p.blood_sugar != null ? String(p.blood_sugar) : '',
    sugarType: p.sugar_type || '',
    sugarAt: p.sugar_at || '',
    sugarBy: p.sugar_by || '',
    height: p.height != null ? String(p.height) : '',
    weight: p.weight != null ? String(p.weight) : '',
    bmi: p.bmi != null ? String(p.bmi) : '',
    measurementsAt: p.measurements_at || '',
    measurementsBy: p.measurements_by || '',
    advice: canSeeDoctor ? (p.advice || '') : (p.advice ? '• Confirmed by Doctor' : ''),
    doctorAt: p.doctor_at || '',
    doctorBy: p.doctor_by || '',
    updatedAt: p.updated_at || '',
    syncStatus: p.sync_status || 'pending',
  };
}

async function handleRequest(input) {
  const { method = 'POST', headers = {}, body = '', secure = false } = input;
  const db = getDb();
  const clientIp = headers['x-forwarded-for']?.split(',')[0]?.trim() || headers['x-real-ip'] || '127.0.0.1';

  if (method === 'GET') {
    return response({ ok: false, error: 'Only POST requests are accepted.' }, 405, { Allow: 'POST' });
  }

  if (Buffer.byteLength(body || '') > 64000) {
    return response({ ok: false, error: 'Request too large.' }, 413);
  }

  let payload;
  try {
    payload = JSON.parse(body || '{}');
  } catch {
    return response({ ok: false, error: 'Invalid JSON request.' }, 400);
  }

  const action = payload?.action;
  if (typeof action !== 'string') {
    return response({ ok: false, error: 'Missing action parameter.' }, 400);
  }

  // -------------------------------------------------------------
  // 1. PUBLIC AUTH ACTIONS
  // -------------------------------------------------------------
  if (action === 'auth.status') {
    const session = parseUserSession(headers);
    let currentUser = null;

    if (session) {
      if (session.type === 'staff') {
        const staff = (await db.prepare('SELECT * FROM staff WHERE id = ?').get(session.id));
        if (staff && staff.is_active) {
          const counters = staff.can_view_dashboard || staff.can_view_participants ? [] : JSON.parse(staff.counters || '[]');
          const permissions = getPermissionsFromStaff(staff);
          const redirectCounter = counters.length === 1 && !staff.can_register ? counters[0] : null;

          currentUser = {
            id: staff.id,
            name: staff.name,
            type: 'staff',
            counters,
            canRegister: Boolean(staff.can_register) && !staff.can_view_dashboard && !staff.can_view_participants,
            permissions,
            redirectCounter,
          };
        }
      } else if (session.type === 'admin') {
        const admin = (await db.prepare('SELECT id, email, must_change_password FROM admin WHERE id = ?').get(session.id));
        if (admin) {
          currentUser = {
            id: admin.id,
            email: admin.email,
            name: 'Super Admin',
            type: 'admin',
            permissions: ['*'],
            mustChangePassword: Boolean(admin.must_change_password),
          };
        }
      }
    }

    return response({
      ok: true,
      signedIn: Boolean(currentUser),
      user: currentUser,
    });
  }

  if (action === 'auth.staff_login') {
    const rawName = String(payload.name || '').trim();
    const pin = String(payload.pin || '').trim();

    if (!rawName || !pin) {
      return response({ ok: false, error: 'Invalid staff name or PIN.' }, 401);
    }

    const normName = rawName.toLowerCase();
    const rateKey = `staff:${normName}`;
    const rateCheck = checkRateLimit(rateKey);
    if (!rateCheck.allowed) {
      return response({ ok: false, error: rateCheck.message }, 429);
    }

    const staff = (await db.prepare('SELECT * FROM staff WHERE LOWER(TRIM(name)) = ?').get(normName));
    if (!staff) {
      recordFailedAttempt(rateKey);
      return response({ ok: false, error: 'Invalid staff name or PIN.' }, 401);
    }

    if (!staff.is_active) {
      return response({ ok: false, error: 'This staff account has been deactivated. Contact the Super Admin.' }, 403);
    }

    const isValidPin = verifySecret(pin, staff.pin_hash, staff.pin_salt);
    if (!isValidPin) {
      const rec = recordFailedAttempt(rateKey);
      const remaining = Math.max(0, 5 - rec.attempts);
      return response({
        ok: false,
        error: `Invalid staff name or PIN.${remaining > 0 ? ` (${remaining} attempt${remaining > 1 ? 's' : ''} remaining)` : ' (Account locked for 15 minutes)'}`,
      }, 401);
    }

    clearRateLimit(rateKey);

    const now = new Date().toISOString();
    (await db.prepare(`
      UPDATE staff SET last_login_at = ?, login_count = login_count + 1 WHERE id = ?
    `).run(now, staff.id));

    const counters = staff.can_view_dashboard || staff.can_view_participants ? [] : JSON.parse(staff.counters || '[]');
    const permissions = getPermissionsFromStaff(staff);
    const redirectCounter = counters.length === 1 && !staff.can_register ? counters[0] : null;

    const userObj = {
      id: staff.id,
      name: staff.name,
      type: 'staff',
      counters,
      can_register: staff.can_register,
      canRegister: Boolean(staff.can_register) && !staff.can_view_dashboard && !staff.can_view_participants,
      permissions,
      redirectCounter,
    };

    const token = createSessionToken(userObj);

    await logAudit({
      actorType: 'staff',
      actorId: staff.id,
      actorName: staff.name,
      actorRole: `Staff (${counters.join(', ') || 'Registration'})`,
      action: 'auth.staff_login',
      details: `Logged in to counters: ${counters.join(', ') || 'Registration'}`,
      ip: clientIp,
    });

    return response(
      { ok: true, user: userObj },
      200,
      { 'Set-Cookie': cookieHeader(token, secure) }
    );
  }

  if (action === 'auth.admin_login') {
    const email = String(payload.email || '').trim().toLowerCase();
    const password = String(payload.password || '');

    if (!email || !password) {
      return response({ ok: false, error: 'Admin email and password are required.' }, 400);
    }

    const rateKey = `admin:${email}`;
    const rateCheck = checkRateLimit(rateKey);
    if (!rateCheck.allowed) {
      return response({ ok: false, error: rateCheck.message }, 429);
    }

    const admin = (await db.prepare('SELECT * FROM admin WHERE email = ?').get(email));
    if (!admin) {
      recordFailedAttempt(rateKey);
      return response({ ok: false, error: 'Invalid admin credentials.' }, 401);
    }

    const isValid = verifySecret(password, admin.password_hash, admin.password_salt);
    if (!isValid) {
      const rec = recordFailedAttempt(rateKey);
      const remaining = Math.max(0, 5 - rec.attempts);
      return response({
        ok: false,
        error: `Invalid admin credentials. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : 'Account locked for 15 minutes.'}`,
      }, 401);
    }

    clearRateLimit(rateKey);

    const now = new Date().toISOString();
    (await db.prepare('UPDATE admin SET last_login_at = ? WHERE id = ?').run(now, admin.id));

    const userObj = {
      id: admin.id,
      email: admin.email,
      name: 'Super Admin',
      type: 'admin',
      permissions: ['*'],
      must_change_password: admin.must_change_password,
    };

    const token = createSessionToken(userObj);

    await logAudit({
      actorType: 'admin',
      actorId: admin.id,
      actorName: 'Super Admin',
      actorRole: 'Super Admin',
      action: 'auth.admin_login',
      details: 'Super Admin signed in',
      ip: clientIp,
    });

    return response(
      { ok: true, user: userObj },
      200,
      { 'Set-Cookie': cookieHeader(token, secure) }
    );
  }

  if (action === 'auth.logout') {
    const session = parseUserSession(headers);
    if (session) {
      await logAudit({
        actorType: session.type,
        actorId: session.id,
        actorName: session.name,
        actorRole: session.type === 'admin' ? 'Super Admin' : 'Staff',
        action: 'auth.logout',
        details: 'User logged out',
        ip: clientIp,
      });
    }
    return response({ ok: true }, 200, { 'Set-Cookie': cookieHeader('', secure, true) });
  }

  // -------------------------------------------------------------
  // ALL REMAINING ACTIONS REQUIRE VALID AUTHENTICATION
  // -------------------------------------------------------------
  const session = parseUserSession(headers);
  if (!session) {
    return response({ ok: false, error: 'Session expired or not authenticated. Please sign in.' }, 401);
  }

  if (session.type === 'admin' && session.mustChangePassword && action !== 'auth.change_admin_password') {
    return response({
      ok: false,
      error: 'Security notice: You must change your default Super Admin password before accessing other features.',
      mustChangePassword: true,
    }, 403);
  }

  let userPerms = session.permissions || [];
  if (session.type === 'staff') {
    const checkStaff = (await db.prepare('SELECT is_active, counters, can_register, can_view_dashboard, can_view_participants FROM staff WHERE id = ?').get(session.id));
    if (!checkStaff || !checkStaff.is_active) {
      return response({ ok: false, error: 'Your staff account is deactivated. Session revoked.' }, 401, {
        'Set-Cookie': cookieHeader('', secure, true),
      });
    }
    userPerms = getPermissionsFromStaff(checkStaff);
    if ((checkStaff.can_view_dashboard || checkStaff.can_view_participants) && !['participant.list', 'participant.get', ...(checkStaff.can_view_dashboard ? ['dashboard.stats'] : [])].includes(action)) {
      return response({ ok: false, error: 'This account has read-only access.' }, 403);
    }
  }

  if (['participant.list', 'participant.get', 'participant.update', 'participant.delete'].includes(action)) {
    if (!hasPermission(userPerms, PERMISSIONS.PARTICIPANT_VIEW)) return response({ ok:false, error:'Participant directory access denied.' },403);
    if (action === 'participant.list') {
      const query = String(payload.query || '').trim().slice(0,120);
      const limit = Number(payload.limit ?? 20), offset = Number(payload.offset ?? 0);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) return response({ok:false,error:'Invalid page size or offset.'},400);
      const term = `%${query.toLowerCase()}%`;
      const requestedToken = /^\d+$/.test(query) ? Number(query) : -1;
      const token = Number.isSafeInteger(requestedToken) && requestedToken > 0 && requestedToken <= 2147483647 ? requestedToken : -1;
      const where = `WHERE LOWER(name) LIKE ? OR its LIKE ? OR phone LIKE ? OR LOWER(serial) LIKE ? OR token = ?`;
      const values = [term,term,term,term,token];
      const total = (await db.prepare(`SELECT COUNT(*) AS count FROM participants ${where}`).get(...values)).count;
      const participants = await db.prepare(`SELECT id,token,serial,its,name,phone,age,gender,registered_at FROM participants ${where} ORDER BY CASE WHEN token = ? THEN 0 ELSE 1 END, token DESC LIMIT ? OFFSET ?`).all(...values,token,limit,offset);
      return response({ok:true,participants:participants.map(p=>({...p,tokenFormatted:formatTokenNumber(p.token)})),total,limit,offset});
    }
    if (['participant.update','participant.delete'].includes(action) && session.type !== 'admin') return response({ok:false,error:'Only Super Admin can edit or delete participant records.'},403);
    const data = ['participant.update','participant.delete'].includes(action) ? payload.data || payload : payload;
    const existing = await db.prepare('SELECT * FROM participants WHERE id = ?').get(String(data.id || ''));
    if (!existing) return response({ok:false,error:'Participant not found.'},404);
    if (action === 'participant.get') return response({ok:true,data:formatParticipant(existing,userPerms)});
    if (action === 'participant.delete') {
      if (!data.expectedUpdatedAt) return response({ok:false,error:'Reopen the record before deleting.'},400);
      await db.exec('BEGIN IMMEDIATE;');
      try {
        const deleted = await db.prepare('DELETE FROM participants WHERE id = ? AND updated_at = ? RETURNING id').get(existing.id,data.expectedUpdatedAt);
        if (!deleted) {
          await db.exec('ROLLBACK;');
          return response({ok:false,error:'This record has changed. Reopen it before deleting.'},409);
        }
        // Old registration retries must not return a deleted participant or create it again.
        await db.prepare("UPDATE idempotency_keys SET response_body = ?, response_status = 410 WHERE action = 'participant.register' AND response_body LIKE ?").run(JSON.stringify({ok:false,error:'This registration was deleted. Start a new registration.'}),`%"id":"${existing.id}"%`);
        await db.exec('COMMIT;');
      } catch (err) {
        await db.exec('ROLLBACK;');
        throw err;
      }
      await queueSync('participant.delete',{its:existing.its});
      await logAudit({actorType:'admin',actorId:session.id,actorName:'Super Admin',actorRole:'Super Admin',action:'participant.delete',targetType:'participant',targetId:existing.id,details:{serial:existing.serial},ip:clientIp});
      return response({ok:true,message:'Participant and screening report deleted.'});
    }
    const changes = data.changes;
    const fields = {name:'name',its:'its',phone:'phone',age:'age',gender:'gender',medicalHistory:'medical_history',bpSystolic:'bp_systolic',bpDiastolic:'bp_diastolic',pulseBpm:'pulse_bpm',bloodSugar:'blood_sugar',sugarType:'sugar_type',height:'height',weight:'weight',advice:'advice'};
    if (!changes || typeof changes !== 'object' || Array.isArray(changes) || Object.keys(changes).some(key=>!Object.hasOwn(fields,key))) return response({ok:false,error:'Invalid editable fields. Token and serial cannot be changed.'},400);
    if (!data.expectedUpdatedAt) return response({ok:false,error:'Reopen the record before editing.'},400);
    if (data.expectedUpdatedAt !== existing.updated_at) return response({ok:false,error:'This record has changed. Reopen it before saving.'},409);
    const updates = {};
    const has = key => Object.hasOwn(changes,key);
    if (has('name')) updates.name = safeText(changes.name,120,'Full name');
    if (has('its')) updates.its = onlyDigits(changes.its,8,'ITS number');
    if (has('phone')) updates.phone = onlyDigits(changes.phone,10,'Mobile number');
    if (has('age')) {
      updates.age = parseNumber(changes.age,1,120,'Age');
      if (!Number.isInteger(updates.age)) return response({ok:false,error:'Age must be a whole number.'},400);
    }
    if (has('gender')) {
      if (!['Male','Female'].includes(changes.gender)) return response({ok:false,error:'Please select Male or Female.'},400);
      updates.gender = changes.gender;
    }
    if (has('medicalHistory')) updates.medical_history = medicalHistoryValue(changes.medicalHistory);
    if (updates.its && (await db.prepare('SELECT id FROM participants WHERE its = ? AND id != ?').get(updates.its,existing.id))) return response({ok:false,error:'This ITS number belongs to another participant.'},409);
    const now = new Date(Math.max(Date.now(),Date.parse(existing.updated_at)+1)).toISOString();
    const actor = 'Super Admin';
    if (['bpSystolic','bpDiastolic','pulseBpm'].some(has)) {
      updates.bp_systolic = parseNumber(changes.bpSystolic ?? existing.bp_systolic,50,300,'Systolic BP');
      updates.bp_diastolic = parseNumber(changes.bpDiastolic ?? existing.bp_diastolic,30,200,'Diastolic BP');
      updates.pulse_bpm = parseNumber(changes.pulseBpm ?? existing.pulse_bpm,30,250,'Pulse Rate');
      if (updates.bp_diastolic >= updates.bp_systolic) return response({ok:false,error:'Systolic BP must be higher than diastolic BP.'},400);
      updates.bp_at=now; updates.bp_by=actor;
    }
    if (['bloodSugar','sugarType'].some(has)) {
      updates.blood_sugar = parseNumber(changes.bloodSugar ?? existing.blood_sugar,20,700,'Blood sugar');
      updates.sugar_type = changes.sugarType ?? existing.sugar_type;
      if (!['Fasting','Random','Post-meal'].includes(updates.sugar_type)) return response({ok:false,error:'Choose a valid sugar test type.'},400);
      updates.sugar_at=now; updates.sugar_by=actor;
    }
    if (['height','weight'].some(has)) {
      updates.height = parseNumber(changes.height ?? existing.height,40,250,'Height');
      updates.weight = parseNumber(changes.weight ?? existing.weight,2,350,'Weight');
      updates.bmi = Math.round(updates.weight / (updates.height / 100) ** 2 * 10) / 10;
      updates.measurements_at=now; updates.measurements_by=actor;
    }
    if (has('advice')) {
      updates.advice = safeText(changes.advice,4000,'Doctor advice / prescription');
      updates.doctor_at=now; updates.doctor_by=actor;
    }
    if (!Object.keys(updates).length) return response({ok:true,data:formatParticipant(existing,userPerms)});
    updates.updated_at=now; updates.sync_status='pending';
    let updated;
    try {
      updated = await db.prepare(`UPDATE participants SET ${Object.keys(updates).map(column=>`${column} = ?`).join(', ')} WHERE id = ? AND updated_at = ? RETURNING *`).get(...Object.values(updates),existing.id,data.expectedUpdatedAt);
    } catch (err) {
      if (err.code === '23505' || /UNIQUE constraint failed: participants.its/.test(err.message)) return response({ok:false,error:'This ITS number belongs to another participant.'},409);
      throw err;
    }
    if (!updated) return response({ok:false,error:'This record has changed. Reopen it before saving.'},409);
    await queueSync('participant.update',{previousIts:existing.its,its:updated.its,name:updated.name,phone:updated.phone,age:updated.age,gender:updated.gender,medicalHistory:updated.medical_history ? JSON.parse(updated.medical_history) : null,consent:true});
    if (updates.bp_at) await queueSync('stage.save',{stage:'bp',its:updated.its,systolic:updated.bp_systolic,diastolic:updated.bp_diastolic,pulse:updated.pulse_bpm});
    if (updates.sugar_at) await queueSync('stage.save',{stage:'sugar',its:updated.its,sugar:updated.blood_sugar,testType:updated.sugar_type});
    if (updates.measurements_at) await queueSync('stage.save',{stage:'measurements',its:updated.its,height:updated.height,weight:updated.weight});
    if (updates.doctor_at) await queueSync('stage.save',{stage:'doctor',its:updated.its,advice:updated.advice});
    await logAudit({actorType:'admin',actorId:session.id,actorName:actor,actorRole:actor,action:'participant.update',targetType:'participant',targetId:updated.id,details:{fields:Object.keys(changes)},ip:clientIp});
    return response({ok:true,message:'Participant record updated.',data:formatParticipant(updated,userPerms)});
  }

  if (action === 'dashboard.stats') {
    if (!hasPermission(userPerms, PERMISSIONS.DASHBOARD_VIEW)) return response({ ok: false, error: 'Dashboard access denied.' }, 403);
    return response({ ok: true, ...await getCampStats(db) });
  }

  // -------------------------------------------------------------
  // 2. SUPER ADMIN PASSWORD CHANGE & STAFF MANAGEMENT
  // -------------------------------------------------------------
  if (action === 'auth.change_admin_password') {
    if (session.type !== 'admin') {
      return response({ ok: false, error: 'Only Super Admin can change admin password.' }, 403);
    }

    const currentPassword = String(payload.currentPassword || '');
    const newPassword = String(payload.newPassword || '');

    if (!newPassword || newPassword.length < 8) {
      return response({ ok: false, error: 'New password must be at least 8 characters long.' }, 400);
    }

    const admin = (await db.prepare('SELECT * FROM admin WHERE id = ?').get(session.id));
    if (!admin) return response({ ok: false, error: 'Admin account not found.' }, 404);

    const matches = verifySecret(currentPassword, admin.password_hash, admin.password_salt);
    if (!matches) {
      return response({ ok: false, error: 'Current password is incorrect.' }, 400);
    }

    const { hash, salt } = hashSecret(newPassword);
    const now = new Date().toISOString();
    (await db.prepare(`
      UPDATE admin SET password_hash = ?, password_salt = ?, must_change_password = 0, updated_at = ? WHERE id = ?
    `).run(hash, salt, now, admin.id));

    const updatedUser = {
      ...session,
      mustChangePassword: 0,
      must_change_password: 0,
    };
    const newToken = createSessionToken(updatedUser);

    await logAudit({
      actorType: 'admin',
      actorId: admin.id,
      actorName: 'Super Admin',
      actorRole: 'Super Admin',
      action: 'admin.change_password',
      details: 'Super Admin password changed successfully',
      ip: clientIp,
    });

    return response(
      { ok: true, message: 'Password updated successfully.', user: updatedUser },
      200,
      { 'Set-Cookie': cookieHeader(newToken, secure) }
    );
  }

  // Staff Management (Super Admin only)
  if (action === 'staff.list') {
    if (!hasPermission(userPerms, PERMISSIONS.ADMIN_FULL)) {
      return response({ ok: false, error: 'Permission denied: Super Admin access required.' }, 403);
    }
    const staffRows = (await db.prepare(`
      SELECT id, name, counters, can_register, can_view_dashboard, can_view_participants, is_active, created_at, last_login_at, login_count
      FROM staff
      ORDER BY LOWER(name) ASC
    `).all());

    const formatted = staffRows.map(s => ({
      ...s,
      counters: JSON.parse(s.counters || '[]'),
      canRegister: Boolean(s.can_register),
    }));

    return response({ ok: true, staff: formatted });
  }

  if (action === 'staff.create') {
    if (!hasPermission(userPerms, PERMISSIONS.ADMIN_FULL)) {
      return response({ ok: false, error: 'Permission denied: Super Admin access required.' }, 403);
    }

    const name = safeText(payload.name, 80, 'Staff name');
    const norm = name.trim().toLowerCase();
    if (!norm) {
      return response({ ok: false, error: 'Staff name is required.' }, 400);
    }

    const pin = String(payload.pin || '5253').trim();
    if (!/^[0-9]{4}$/.test(pin)) {
      return response({ ok: false, error: 'PIN must be exactly 4 digits.' }, 400);
    }

    let counters = Array.isArray(payload.counters) ? payload.counters.filter(c => ['bp', 'sugar', 'bmi', 'doctor'].includes(c)) : [];
    let canRegister = payload.canRegister ? 1 : 0;
    if (payload.canViewParticipants !== undefined && typeof payload.canViewParticipants !== 'boolean') return response({ok:false,error:'Admin access must be true or false.'},400);
    const canViewParticipants = payload.canViewParticipants ? 1 : 0;
    if (canViewParticipants) { counters=[]; canRegister=0; }

    const existing = (await db.prepare('SELECT id FROM staff WHERE LOWER(TRIM(name)) = ?').get(norm));
    if (existing) {
      return response({ ok: false, error: `A staff account with the name "${name}" already exists.` }, 409);
    }

    const { hash, salt } = hashSecret(pin);
    const id = randomUUID();
    const now = new Date().toISOString();

    (await db.prepare(`
      INSERT INTO staff (id, name, pin_hash, pin_salt, counters, can_register, can_view_participants, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, name, hash, salt, JSON.stringify(counters), canRegister, canViewParticipants, now, now));

    await logAudit({
      actorType: 'admin',
      actorId: session.id,
      actorName: 'Super Admin',
      actorRole: 'Super Admin',
      action: 'staff.create',
      targetType: 'staff',
      targetId: name,
      details: { name, counters, canRegister, canViewParticipants },
      ip: clientIp,
    });

    return response({
      ok: true,
      message: `Staff account "${name}" created successfully.`,
      staff: { id, name, counters, canRegister },
    });
  }

  if (action === 'staff.update') {
    if (!hasPermission(userPerms, PERMISSIONS.ADMIN_FULL)) {
      return response({ ok: false, error: 'Permission denied: Super Admin access required.' }, 403);
    }

    const id = String(payload.id || '').trim();
    const name = safeText(payload.name, 80, 'Staff name');
    const norm = name.trim().toLowerCase();
    if (!norm) {
      return response({ ok: false, error: 'Staff name is required.' }, 400);
    }

    let counters = Array.isArray(payload.counters) ? payload.counters.filter(c => ['bp', 'sugar', 'bmi', 'doctor'].includes(c)) : [];
    let canRegister = payload.canRegister ? 1 : 0;
    if (payload.canViewParticipants !== undefined && typeof payload.canViewParticipants !== 'boolean') return response({ok:false,error:'Admin access must be true or false.'},400);
    const canViewParticipants = payload.canViewParticipants ? 1 : 0;
    if (canViewParticipants) { counters=[]; canRegister=0; }

    const existing = (await db.prepare('SELECT * FROM staff WHERE id = ?').get(id));
    if (!existing) return response({ ok: false, error: 'Staff member not found.' }, 404);

    if (payload.canViewParticipants === undefined && existing.can_view_participants) { counters=[]; canRegister=0; }
    const dup = (await db.prepare('SELECT id FROM staff WHERE LOWER(TRIM(name)) = ? AND id != ?').get(norm, id));
    if (dup) {
      return response({ ok: false, error: `Another staff account with the name "${name}" already exists.` }, 409);
    }

    const now = new Date().toISOString();
    (await db.prepare(`
      UPDATE staff SET name = ?, counters = ?, can_register = ?, can_view_participants = ?, updated_at = ? WHERE id = ?
    `).run(name, JSON.stringify(counters), canRegister, payload.canViewParticipants === undefined ? existing.can_view_participants : canViewParticipants, now, id));

    await logAudit({
      actorType: 'admin',
      actorId: session.id,
      actorName: 'Super Admin',
      actorRole: 'Super Admin',
      action: 'staff.update',
      targetType: 'staff',
      targetId: name,
      details: { name, counters, canRegister, canViewParticipants },
      ip: clientIp,
    });

    return response({ ok: true, message: `Staff account "${name}" updated successfully.` });
  }

  if (action === 'staff.reset_pin') {
    if (!hasPermission(userPerms, PERMISSIONS.ADMIN_FULL)) {
      return response({ ok: false, error: 'Permission denied: Super Admin access required.' }, 403);
    }

    const id = String(payload.id || '').trim();
    const newPin = String(payload.pin || '').trim();
    if (!/^[0-9]{4}$/.test(newPin)) {
      return response({ ok: false, error: 'New PIN must be exactly 4 digits.' }, 400);
    }

    const existing = (await db.prepare('SELECT * FROM staff WHERE id = ?').get(id));
    if (!existing) return response({ ok: false, error: 'Staff member not found.' }, 404);

    const { hash, salt } = hashSecret(newPin);
    const now = new Date().toISOString();
    (await db.prepare('UPDATE staff SET pin_hash = ?, pin_salt = ?, updated_at = ? WHERE id = ?').run(hash, salt, now, id));

    await logAudit({
      actorType: 'admin',
      actorId: session.id,
      actorName: 'Super Admin',
      actorRole: 'Super Admin',
      action: 'staff.reset_pin',
      targetType: 'staff',
      targetId: existing.name,
      details: `Reset PIN for staff member (${existing.name})`,
      ip: clientIp,
    });

    return response({ ok: true, message: `PIN for staff member (${existing.name}) updated successfully.` });
  }

  if (action === 'staff.toggle_active') {
    if (!hasPermission(userPerms, PERMISSIONS.ADMIN_FULL)) {
      return response({ ok: false, error: 'Permission denied: Super Admin access required.' }, 403);
    }

    const id = String(payload.id || '').trim();
    const existing = (await db.prepare('SELECT * FROM staff WHERE id = ?').get(id));
    if (!existing) return response({ ok: false, error: 'Staff member not found.' }, 404);

    const newActive = existing.is_active ? 0 : 1;
    const now = new Date().toISOString();
    (await db.prepare('UPDATE staff SET is_active = ?, updated_at = ? WHERE id = ?').run(newActive, now, id));

    await logAudit({
      actorType: 'admin',
      actorId: session.id,
      actorName: 'Super Admin',
      actorRole: 'Super Admin',
      action: newActive ? 'staff.activate' : 'staff.deactivate',
      targetType: 'staff',
      targetId: existing.name,
      details: `Staff member (${existing.name}) set to ${newActive ? 'Active' : 'Deactivated'}`,
      ip: clientIp,
    });

    return response({
      ok: true,
      message: `Staff member (${existing.name}) is now ${newActive ? 'Active' : 'Deactivated'}.`,
      isActive: Boolean(newActive),
    });
  }

  if (action === 'staff.delete') {
    if (!hasPermission(userPerms, PERMISSIONS.ADMIN_FULL)) {
      return response({ ok: false, error: 'Permission denied: Super Admin access required.' }, 403);
    }

    const id = String(payload.id || '').trim();
    const existing = (await db.prepare('SELECT * FROM staff WHERE id = ?').get(id));
    if (!existing) return response({ ok: false, error: 'Staff member not found.' }, 404);

    (await db.prepare('DELETE FROM staff WHERE id = ?').run(id));

    await logAudit({
      actorType: 'admin',
      actorId: session.id,
      actorName: 'Super Admin',
      actorRole: 'Super Admin',
      action: 'staff.delete',
      targetType: 'staff',
      targetId: existing.name,
      details: `Deleted staff member (${existing.name})`,
      ip: clientIp,
    });

    return response({ ok: true, message: `Staff member (${existing.name}) was deleted.` });
  }

  // -------------------------------------------------------------
  // 3. TOKEN WORKFLOW: FIND PARTICIPANT BY TOKEN
  // -------------------------------------------------------------
  if (action === 'participant.find_token') {
    const rawToken = String(payload.token || '').trim();
    if (!rawToken) {
      return response({ ok: false, error: 'Please enter a token number.' }, 400);
    }

    let p = null;
    const tokenNum = parseInt(rawToken.replace(/^US-/i, ''), 10);
    if (Number.isSafeInteger(tokenNum) && tokenNum > 0) {
      p = (await db.prepare('SELECT * FROM participants WHERE token = ?').get(tokenNum));
    }
    if (!p) {
      p = (await db.prepare('SELECT * FROM participants WHERE UPPER(serial) = UPPER(?) OR its = ?').get(rawToken, rawToken));
    }

    if (!p) {
      return response({
        ok: false,
        error: `Token #${rawToken} not found. Please verify the token number or use the fallback search.`,
        errorCode: 'TOKEN_NOT_FOUND',
      }, 404);
    }

    return response({ ok: true, data: formatParticipant(p, userPerms) });
  }

  if (action === 'participant.fallback_search') {
    const q = String(payload.query || '').trim();
    if (!q) return response({ ok: true, results: [] });

    const likeTerm = `%${q}%`;
    const rows = (await db.prepare(`
      SELECT token, serial, its, name, phone, age, gender, bp_at, sugar_at, measurements_at, doctor_at
      FROM participants
      WHERE its LIKE ? OR LOWER(name) LIKE ? OR serial LIKE ?
      ORDER BY token DESC
      LIMIT 15
    `).all(likeTerm, likeTerm, likeTerm));

    return response({ ok: true, results: rows });
  }

  // -------------------------------------------------------------
  // 4. COUNTER MEASUREMENT SAVE (STRICT COUNTER ENFORCEMENT)
  // -------------------------------------------------------------
  if (action === 'counter.save') {
    const data = payload.data || payload;
    const counter = String(data.counter || '').trim().toLowerCase();
    const rawToken = String(data.token || '').trim();

    if (!rawToken) {
      return response({ ok: false, error: 'Missing token number.' }, 400);
    }

    let p = null;
    const tokenNum = parseInt(rawToken.replace(/^US-/i, ''), 10);
    if (Number.isSafeInteger(tokenNum) && tokenNum > 0) {
      p = (await db.prepare('SELECT * FROM participants WHERE token = ?').get(tokenNum));
    }
    if (!p) {
      p = (await db.prepare('SELECT * FROM participants WHERE UPPER(serial) = UPPER(?) OR its = ?').get(rawToken, rawToken));
    }

    if (!p) {
      return response({ ok: false, error: 'Participant not found for this token number.', errorCode: 'TOKEN_NOT_FOUND' }, 404);
    }

    const now = new Date().toISOString();
    const actorLabel = session.type === 'admin' ? 'Super Admin' : session.name;

    // COUNTER 1 — BLOOD PRESSURE
    if (counter === 'bp') {
      if (!hasPermission(userPerms, PERMISSIONS.COUNTER_BP)) {
        return response({ ok: false, error: 'Permission denied: Counter 1 (Blood Pressure) access required.' }, 403);
      }
      const sys = parseNumber(data.systolic, 50, 300, 'Systolic BP');
      const dia = parseNumber(data.diastolic, 30, 200, 'Diastolic BP');
      const pulse = parseNumber(data.pulse ?? data.pulseBpm ?? data.pulse_bpm, 30, 250, 'Pulse Rate (BPM)');
      if (dia >= sys) {
        return response({ ok: false, error: 'Systolic BP must be higher than diastolic BP.' }, 400);
      }

      (await db.prepare(`
        UPDATE participants
        SET bp_systolic = ?, bp_diastolic = ?, pulse_bpm = ?, bp_at = ?, bp_by = ?, updated_at = ?, sync_status = 'pending'
        WHERE id = ?
      `).run(sys, dia, pulse, now, actorLabel, now, p.id));

      await queueSync('stage.save', { stage: 'bp', its: p.its, systolic: sys, diastolic: dia, pulse });

      await logAudit({
        actorType: session.type,
        actorId: session.id,
        actorName: session.name,
        actorRole: session.type === 'admin' ? 'Super Admin' : 'Staff',
        action: 'counter.bp',
        targetType: 'participant',
        targetId: `Token #${p.token}`,
        details: { systolic: sys, diastolic: dia, pulse, its: p.its },
        ip: clientIp,
      });
    }

    // COUNTER 2 — BLOOD SUGAR
    else if (counter === 'sugar') {
      if (!hasPermission(userPerms, PERMISSIONS.COUNTER_SUGAR)) {
        return response({ ok: false, error: 'Permission denied: Counter 2 (Blood Sugar) access required.' }, 403);
      }
      const sugar = parseNumber(data.sugar, 20, 700, 'Blood sugar');
      const typ = String(data.testType || '').trim();
      if (!['Fasting', 'Random', 'Post-meal'].includes(typ)) {
        return response({ ok: false, error: 'Please choose a valid blood sugar test type (Fasting, Random, or Post-meal).' }, 400);
      }

      (await db.prepare(`
        UPDATE participants
        SET blood_sugar = ?, sugar_type = ?, sugar_at = ?, sugar_by = ?, updated_at = ?, sync_status = 'pending'
        WHERE id = ?
      `).run(sugar, typ, now, actorLabel, now, p.id));

      await queueSync('stage.save', { stage: 'sugar', its: p.its, sugar, testType: typ });

      await logAudit({
        actorType: session.type,
        actorId: session.id,
        actorName: session.name,
        actorRole: session.type === 'admin' ? 'Super Admin' : 'Staff',
        action: 'counter.sugar',
        targetType: 'participant',
        targetId: `Token #${p.token}`,
        details: { sugar, testType: typ, its: p.its },
        ip: clientIp,
      });
    }

    // COUNTER 3 — BMI
    else if (counter === 'bmi') {
      if (!hasPermission(userPerms, PERMISSIONS.COUNTER_BMI)) {
        return response({ ok: false, error: 'Permission denied: Counter 3 (BMI) access required.' }, 403);
      }
      const h = parseNumber(data.height, 40, 250, 'Height');
      const w = parseNumber(data.weight, 2, 350, 'Weight');
      const bmi = Math.round((w / Math.pow(h / 100, 2)) * 10) / 10;

      (await db.prepare(`
        UPDATE participants
        SET height = ?, weight = ?, bmi = ?, measurements_at = ?, measurements_by = ?, updated_at = ?, sync_status = 'pending'
        WHERE id = ?
      `).run(h, w, bmi, now, actorLabel, now, p.id));

      await queueSync('stage.save', { stage: 'measurements', its: p.its, height: h, weight: w });

      await logAudit({
        actorType: session.type,
        actorId: session.id,
        actorName: session.name,
        actorRole: session.type === 'admin' ? 'Super Admin' : 'Staff',
        action: 'counter.bmi',
        targetType: 'participant',
        targetId: `Token #${p.token}`,
        details: { height: h, weight: w, bmi, its: p.its },
        ip: clientIp,
      });
    }

    // COUNTER 4 — DOCTOR
    else if (counter === 'doctor') {
      if (!hasPermission(userPerms, PERMISSIONS.COUNTER_DOCTOR)) {
        return response({ ok: false, error: 'Permission denied: Counter 4 (Doctor) access required.' }, 403);
      }
      const note = safeText(data.advice, 4000, 'Doctor advice / prescription');

      (await db.prepare(`
        UPDATE participants
        SET advice = ?, doctor_at = ?, doctor_by = ?, updated_at = ?, sync_status = 'pending'
        WHERE id = ?
      `).run(note, now, actorLabel, now, p.id));

      await queueSync('stage.save', { stage: 'doctor', its: p.its, advice: note });

      await logAudit({
        actorType: session.type,
        actorId: session.id,
        actorName: session.name,
        actorRole: session.type === 'admin' ? 'Super Admin' : 'Staff',
        action: 'counter.doctor',
        targetType: 'participant',
        targetId: `Token #${p.token}`,
        details: { adviceSaved: true, its: p.its },
        ip: clientIp,
      });
    }

    else {
      return response({ ok: false, error: `Invalid counter: "${counter}". Valid counters are bp, sugar, bmi, doctor.` }, 400);
    }

    const updated = (await db.prepare('SELECT * FROM participants WHERE id = ?').get(p.id));
    return response({
      ok: true,
      message: `Token #${p.token} measurements saved successfully.`,
      data: formatParticipant(updated, userPerms),
    });
  }

  // -------------------------------------------------------------
  // 5. PARTICIPANT REGISTRATION
  // -------------------------------------------------------------
  if (action === 'participant.register') {
    if (!hasPermission(userPerms, PERMISSIONS.DESK_REGISTRATION) && !hasPermission(userPerms, PERMISSIONS.ADMIN_FULL)) {
      return response({ ok: false, error: 'Permission denied: Registration Desk access required.' }, 403);
    }

    const data = payload.data || payload;
    const clientRequestId = String(payload.idempotencyKey || payload.clientRequestId || data.idempotencyKey || data.clientRequestId || '').trim();

    // Check idempotency cache first if clientRequestId is provided
    if (clientRequestId) {
      const cached = (await db.prepare('SELECT response_body, response_status FROM idempotency_keys WHERE key = ?').get(clientRequestId));
      if (cached) {
        try {
          const parsed = JSON.parse(cached.response_body);
          return response(parsed, cached.response_status);
        } catch {}
      }
    }

    if (data.consent !== true) {
      return response({ ok: false, error: 'Participant consent is required.' }, 400);
    }

    const gender = String(data.gender || '').trim();
    if (gender !== 'Male' && gender !== 'Female') {
      return response({ ok: false, error: 'Please select Male or Female.' }, 400);
    }

    const medicalHistory = data.medicalHistory;
    medicalHistoryValue(medicalHistory);
    const its = onlyDigits(data.its, 8, 'ITS number');
    const name = safeText(data.name, 120, 'Full name');
    const phone = onlyDigits(data.phone, 10, 'Mobile number');
    const age = parseNumber(data.age, 1, 120, 'Age');

    // Duplicate ITS check (read pass)
    const existing = (await db.prepare('SELECT * FROM participants WHERE its = ?').get(its));
    if (existing) {
      await logAudit({
        actorType: session.type,
        actorId: session.id,
        actorName: session.name,
        actorRole: session.type === 'admin' ? 'Super Admin' : 'Staff',
        action: 'participant.register_duplicate_its',
        targetType: 'participant',
        targetId: `ITS #${its}`,
        details: { its, existingToken: existing.token, existingName: existing.name, attemptedName: name },
        ip: clientIp,
      });

      return response({
        ok: false,
        error: `This ITS number (${its}) is already registered under Token ${formatTokenNumber(existing.token)} (${existing.name}).`,
        errorCode: 'CONFLICT',
        existing: formatParticipant(existing, userPerms),
      }, 409);
    }

    // Atomic transaction for token allocation and participant insertion
    const actorLabel = session.type === 'admin' ? 'Super Admin' : session.name;
    const now = new Date().toISOString();
    const id = randomUUID();

    let createdParticipant = null;
    let allocatedToken = null;
    let serialStr = null;

    await db.exec('BEGIN IMMEDIATE;');
    try {
      if (process.env.DATABASE_URL) await db.exec('LOCK TABLE token_sequence IN EXCLUSIVE MODE;');
      if (clientRequestId) {
        const cached = await db.prepare('SELECT response_body, response_status FROM idempotency_keys WHERE key = ?').get(clientRequestId);
        if (cached) {
          await db.exec('COMMIT;');
          return response(JSON.parse(cached.response_body), cached.response_status);
        }
      }
      // Re-verify ITS uniqueness inside write transaction
      const raceCheck = (await db.prepare('SELECT * FROM participants WHERE its = ?').get(its));
      if (raceCheck) {
        await db.exec('ROLLBACK;');
        await logAudit({
          actorType: session.type,
          actorId: session.id,
          actorName: session.name,
          actorRole: session.type === 'admin' ? 'Super Admin' : 'Staff',
          action: 'participant.register_duplicate_its',
          targetType: 'participant',
          targetId: `ITS #${its}`,
          details: { its, existingToken: raceCheck.token, existingName: raceCheck.name, attemptedName: name },
          ip: clientIp,
        });
        return response({
          ok: false,
          error: `This ITS number (${its}) is already registered under Token ${formatTokenNumber(raceCheck.token)} (${raceCheck.name}).`,
          errorCode: 'CONFLICT',
          existing: formatParticipant(raceCheck, userPerms),
        }, 409);
      }

      allocatedToken = await allocateNextToken(db);
      serialStr = `US-${String(allocatedToken).padStart(Math.max(4, String(allocatedToken).length), '0')}`;

      (await db.prepare(`
        INSERT INTO participants (
          id, token, serial, its, name, phone, age, gender, consent, medical_history, registered_at, registered_by, updated_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 'pending')
      `).run(id, allocatedToken, serialStr, its, name, phone, age, gender, medicalHistory ? JSON.stringify(medicalHistory) : null, now, actorLabel, now));

      createdParticipant = (await db.prepare('SELECT * FROM participants WHERE id = ?').get(id));

      const successPayload = {
        ok: true,
        message: `Participant registered successfully with Token ${formatTokenNumber(allocatedToken)}`,
        token: allocatedToken,
        tokenFormatted: formatTokenNumber(allocatedToken),
        data: formatParticipant(createdParticipant, userPerms),
      };

      if (clientRequestId) {
        (await db.prepare(`
          INSERT INTO idempotency_keys (key, action, response_body, response_status, created_at)
          VALUES (?, 'participant.register', ?, 201, ?) ON CONFLICT (key) DO UPDATE SET response_body = excluded.response_body, response_status = excluded.response_status
        `).run(clientRequestId, JSON.stringify(successPayload), now));
      }

      await db.exec('COMMIT;');
    } catch (err) {
      try { await db.exec('ROLLBACK;'); } catch {}
      throw err;
    }

    await queueSync('participant.register', {
      consent: true,
      medicalHistory: medicalHistory || null,
      token: allocatedToken,
      serial: serialStr,
      its,
      name,
      phone,
      age,
      gender,
    });

    await logAudit({
      actorType: session.type,
      actorId: session.id,
      actorName: session.name,
      actorRole: session.type === 'admin' ? 'Super Admin' : 'Staff',
      action: 'participant.register',
      targetType: 'participant',
      targetId: `Token #${allocatedToken}`,
      details: { token: allocatedToken, tokenFormatted: formatTokenNumber(allocatedToken), serial: serialStr, name, its, phone },
      ip: clientIp,
    });

    return response({
      ok: true,
      message: `Participant registered successfully with Token ${formatTokenNumber(allocatedToken)}`,
      token: allocatedToken,
      tokenFormatted: formatTokenNumber(allocatedToken),
      data: formatParticipant(createdParticipant, userPerms),
    }, 201);
  }

  // -------------------------------------------------------------
  // 6. DASHBOARD & REPORTING
  // -------------------------------------------------------------
  if (action === 'admin.stats' || action === 'stats') {
    const isStaff = session.type === 'staff';
    const counts = (await db.prepare(`
      SELECT
        COUNT(*) as registered,
        SUM(CASE WHEN bp_systolic IS NOT NULL THEN 1 ELSE 0 END) as bp,
        SUM(CASE WHEN blood_sugar IS NOT NULL THEN 1 ELSE 0 END) as sugar,
        SUM(CASE WHEN bmi IS NOT NULL THEN 1 ELSE 0 END) as bmi,
        SUM(CASE WHEN advice IS NOT NULL AND TRIM(advice) != '' THEN 1 ELSE 0 END) as doctor,
        SUM(CASE WHEN bp_systolic IS NULL OR blood_sugar IS NULL OR bmi IS NULL OR (advice IS NULL OR TRIM(advice) = '') THEN 1 ELSE 0 END) as pending
      FROM participants
    `).get());

    const recent = (await db.prepare(`
      SELECT token, serial, its, name, gender,
        (bp_systolic IS NOT NULL) as bp,
        (blood_sugar IS NOT NULL) as sugar,
        (bmi IS NOT NULL) as bmi,
        (advice IS NOT NULL AND TRIM(advice) != '') as doctor
      FROM participants
      ORDER BY updated_at DESC
      LIMIT 10
    `).all()).map(r => ({
      token: r.token,
      tokenFormatted: formatTokenNumber(r.token),
      serial: r.serial,
      its: r.its,
      name: r.name,
      gender: r.gender,
      bp: Boolean(r.bp),
      sugar: Boolean(r.sugar),
      bmi: Boolean(r.bmi),
      doctor: Boolean(r.doctor),
    }));

    // Registration-specific metrics for Super Admin
    const tokenSeqRow = (await db.prepare('SELECT last_token FROM token_sequence WHERE id = 1').get());
    const lastToken = tokenSeqRow?.last_token || counts.registered || 0;
    const activeRegStaff = (await db.prepare(`
      SELECT COUNT(*) as count FROM staff
      WHERE is_active = 1 AND can_register = 1
    `).get()).count;

    const regActivity = (await db.prepare(`
      SELECT registered_by as operator, COUNT(*) as count, MAX(registered_at) as last_active
      FROM participants
      WHERE registered_by IS NOT NULL AND TRIM(registered_by) != ''
      GROUP BY registered_by
      ORDER BY count DESC
    `).all());

    const dupAttempts = (await db.prepare(`
      SELECT id, actor_name, target_id, details, timestamp
      FROM audit_logs
      WHERE action = 'participant.register_duplicate_its'
      ORDER BY timestamp DESC
      LIMIT 25
    `).all()).map(r => {
      let parsed = {};
      try { parsed = JSON.parse(r.details || '{}'); } catch {}
      return {
        id: r.id,
        operator: r.actor_name,
        its: parsed.its || r.target_id?.replace('ITS #', '') || '',
        existingToken: parsed.existingToken ? formatTokenNumber(parsed.existingToken) : '',
        existingName: parsed.existingName || '',
        attemptedName: parsed.attemptedName || '',
        timestamp: r.timestamp,
      };
    });

    const recentRegistrations = (await db.prepare(`
      SELECT token, serial, its, name, phone, age, gender, registered_at, registered_by
      FROM participants
      ORDER BY token DESC
      LIMIT 20
    `).all()).map(r => ({
      ...r,
      tokenFormatted: formatTokenNumber(r.token),
    }));

    const syncInfo = await getSyncStats();

    return response({
      ok: true,
      counts: {
        registered: counts.registered || 0,
        bp: counts.bp || 0,
        sugar: counts.sugar || 0,
        bmi: counts.bmi || 0,
        doctor: counts.doctor || 0,
        pending: counts.pending || 0,
      },
      registration: {
        total: counts.registered || 0,
        lastToken,
        lastTokenFormatted: formatTokenNumber(lastToken),
        activeStaff: activeRegStaff,
        staffActivity: regActivity,
        duplicateAttempts: dupAttempts,
        recent: recentRegistrations,
      },
      recent,
      sync: syncInfo,
    });
  }

  if (action === 'reports.export') {
    if (!hasPermission(userPerms, PERMISSIONS.ADMIN_FULL)) {
      return response({ ok: false, error: 'Permission denied: Super Admin export access required.' }, 403);
    }

    const csvData = await generateCsvExport();
    await logAudit({
      actorType: 'admin',
      actorId: session.id,
      actorName: 'Super Admin',
      actorRole: 'Super Admin',
      action: 'reports.export',
      details: 'Exported complete participant records CSV',
      ip: clientIp,
    });

    return response(csvData, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="umoor_sehat_counters_${new Date().toISOString().slice(0, 10)}.csv"`,
    });
  }

  if (action === 'audit.list') {
    if (!hasPermission(userPerms, PERMISSIONS.ADMIN_FULL)) {
      return response({ ok: false, error: 'Permission denied: Super Admin audit access required.' }, 403);
    }
    const limit = Math.min(100, Math.max(10, Number(payload.limit) || 50));
    const offset = Math.max(0, Number(payload.offset) || 0);
    const query = String(payload.query || '').trim();
    const result = await getAuditLogs({ limit, offset, query });
    return response({ ok: true, ...result });
  }

  if (action === 'sync.trigger') {
    const res = await processSyncQueue();
    const syncStats = await getSyncStats();
    return response({ ok: true, processed: res.processed, sync: syncStats });
  }

  return response({ ok: false, error: `Unknown action: "${action}"` }, 400);
}

export async function handle(input) {
  try { return await withDatabase(() => handleRequest(input)); }
  catch (err) {
    if (err instanceof ValidationError) return response({ ok: false, error: err.message }, 400);
    throw err;
  }
}
