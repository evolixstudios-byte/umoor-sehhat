import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';

const MAX_SESSION_AGE = 12 * 60 * 60; // 12 hours in seconds
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_LOCK = 15 * 60 * 1000; // 15 minutes lockout

const rateLimits = new Map();

export function hashSecret(secret, salt = null) {
  const effectiveSalt = salt || randomBytes(16).toString('hex');
  const hash = scryptSync(String(secret), effectiveSalt, 64).toString('hex');
  return { hash, salt: effectiveSalt };
}

export function verifySecret(secret, hash, salt) {
  try {
    const computed = scryptSync(String(secret), salt, 64).toString('hex');
    const a = Buffer.from(computed, 'hex');
    const b = Buffer.from(hash, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function checkRateLimit(key) {
  const now = Date.now();
  const record = rateLimits.get(key);
  if (!record) return { allowed: true, remaining: RATE_LIMIT_MAX };

  if (record.lockedUntil && record.lockedUntil > now) {
    const minutes = Math.ceil((record.lockedUntil - now) / 60000);
    return {
      allowed: false,
      remaining: 0,
      lockedUntil: record.lockedUntil,
      message: `Too many failed attempts. Account temporarily locked for ${minutes} minute${minutes > 1 ? 's' : ''}.`,
    };
  }

  if (now - record.firstAttempt > RATE_LIMIT_WINDOW) {
    rateLimits.delete(key);
    return { allowed: true, remaining: RATE_LIMIT_MAX };
  }

  const remaining = Math.max(0, RATE_LIMIT_MAX - record.attempts);
  return { allowed: remaining > 0, remaining };
}

export function recordFailedAttempt(key) {
  const now = Date.now();
  let record = rateLimits.get(key);
  if (!record || (now - record.firstAttempt > RATE_LIMIT_WINDOW && (!record.lockedUntil || record.lockedUntil < now))) {
    record = { attempts: 1, firstAttempt: now, lockedUntil: 0 };
  } else {
    record.attempts += 1;
    if (record.attempts >= RATE_LIMIT_MAX) {
      record.lockedUntil = now + RATE_LIMIT_LOCK;
    }
  }
  rateLimits.set(key, record);
  return record;
}

export function clearRateLimit(key) {
  rateLimits.delete(key);
}

function getSessionSecret() {
  return process.env.SESSION_SECRET || 'umoor-sehat-default-dev-secret-minimum-32-chars-long';
}

export function createSessionToken(user) {
  const secret = getSessionSecret();
  const exp = Math.floor(Date.now() / 1000) + MAX_SESSION_AGE;
  const payloadObj = {
    id: user.id,
    type: user.type, // 'staff' | 'admin'
    name: user.name || user.email,
    email: user.email || null,
    counters: user.counters || [],
    canRegister: Boolean(user.can_register ?? user.canRegister),
    permissions: user.permissions || [],
    mustChangePassword: user.must_change_password ? 1 : 0,
    exp,
  };
  const payloadStr = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const signature = createHmac('sha256', secret).update(payloadStr).digest('base64url');
  return `${payloadStr}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadStr, signature] = parts;
  const secret = getSessionSecret();
  const expectedSignature = createHmac('sha256', secret).update(payloadStr).digest('base64url');

  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expectedSignature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    if (!payload || !Number.isSafeInteger(payload.exp)) return null;
    if (payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}
