import { postgresDb, withPostgres } from './postgres.mjs';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { hashSecret } from './auth.mjs';

let dbInstance = null;

export const INITIAL_REAL_STAFF = [
  { name: 'janab saab', counters: [], can_register: 0, can_view_dashboard: 1 },
  // Counter 1 — BP
  { name: 'Husain jawdawala', counters: ['bp'], can_register: 0 },
  { name: 'Murtaza kirana', counters: ['bp'], can_register: 0 },
  { name: 'Qusai', counters: ['bp'], can_register: 0 },
  { name: 'Mohammed', counters: ['bp'], can_register: 0 },

  // Counter 2 — Sugar
  { name: 'Saifuddin', counters: ['sugar'], can_register: 0 },
  { name: 'Taikhum', counters: ['sugar'], can_register: 0 },
  { name: 'Burhan', counters: ['sugar'], can_register: 0 },
  { name: 'Ammar', counters: ['sugar'], can_register: 0 },
  { name: 'Taikhum diken', counters: ['sugar'], can_register: 0 },

  // Counter 3 — Height, Weight & BMI
  { name: 'Husain rang', counters: ['bmi'], can_register: 0 },
  { name: 'Hasan', counters: ['bmi'], can_register: 0 },
  { name: 'Ali akbar', counters: ['bmi'], can_register: 0 },
  { name: 'Murtaza chakki', counters: ['bmi'], can_register: 0 },
  { name: 'Shabbir', counters: ['bmi'], can_register: 0 },
  { name: 'Mustansir', counters: ['bmi'], can_register: 0 },
];

export function getDbPath() {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  if (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY) {
    return '/tmp/umoor_sehat.db';
  }
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, 'umoor_sehat.db');
}

export function initDb(customPath = null) {
  if (dbInstance && !customPath) return dbInstance;
  const dbPath = customPath || getDbPath();

  const db = new DatabaseSync(dbPath);
  if (dbPath !== ':memory:') {
    try {
      db.exec('PRAGMA journal_mode = WAL;');
    } catch {}
  }
  db.exec('PRAGMA foreign_keys = ON;');

  // Migrate staff table if it had staff_id NOT NULL constraint
  try {
    const tableInfo = db.prepare("PRAGMA table_info(staff)").all();
    if (tableInfo.length > 0) {
      const hasStaffId = tableInfo.some(c => c.name === 'staff_id' && c.notnull === 1);
      if (hasStaffId) {
        db.exec(`
          CREATE TABLE IF NOT EXISTS staff_v2 (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            pin_hash TEXT NOT NULL,
            pin_salt TEXT NOT NULL,
            counters TEXT NOT NULL DEFAULT '[]',
            can_register INTEGER DEFAULT 0,
      can_view_dashboard INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_login_at TEXT,
            login_count INTEGER DEFAULT 0
          );
          INSERT OR IGNORE INTO staff_v2 (id, name, pin_hash, pin_salt, counters, can_register, is_active, created_at, updated_at, last_login_at, login_count)
          SELECT id, name, pin_hash, pin_salt, counters, can_register, is_active, created_at, updated_at, last_login_at, login_count FROM staff;
          DROP TABLE staff;
          ALTER TABLE staff_v2 RENAME TO staff;
          CREATE INDEX IF NOT EXISTS idx_staff_name ON staff(name);
        `);
      }
    }
  } catch {}

  // 1. Staff table with unique normalized name
  db.exec(`
    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      pin_hash TEXT NOT NULL,
      pin_salt TEXT NOT NULL,
      counters TEXT NOT NULL DEFAULT '[]',
      can_register INTEGER DEFAULT 0,
      can_view_dashboard INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT,
      login_count INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_staff_name ON staff(name);
  `);

  // 2. Admin table
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      must_change_password INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT
    );
  `);

  // 3. Participants table with unique token number and separate ITS number
  db.exec(`
    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      token INTEGER NOT NULL UNIQUE,
      serial TEXT NOT NULL UNIQUE,
      its TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL,
      consent INTEGER DEFAULT 1,
      medical_history TEXT,
      registered_at TEXT NOT NULL,
      registered_by TEXT,
      bp_systolic INTEGER,
      bp_diastolic INTEGER,
      pulse_bpm INTEGER,
      bp_at TEXT,
      bp_by TEXT,
      blood_sugar REAL,
      sugar_type TEXT,
      sugar_at TEXT,
      sugar_by TEXT,
      height REAL,
      weight REAL,
      bmi REAL,
      measurements_at TEXT,
      measurements_by TEXT,
      advice TEXT,
      doctor_at TEXT,
      doctor_by TEXT,
      updated_at TEXT NOT NULL,
      sync_status TEXT DEFAULT 'pending',
      sync_error TEXT,
      last_synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_participants_token ON participants(token);
    CREATE INDEX IF NOT EXISTS idx_participants_its ON participants(its);
    CREATE INDEX IF NOT EXISTS idx_participants_name ON participants(name);
    CREATE INDEX IF NOT EXISTS idx_participants_updated ON participants(updated_at);
  `);

  // Migration for pulse_bpm column in existing participants table
  try {
    const participantCols = db.prepare("PRAGMA table_info(participants)").all();
    if (participantCols.length > 0 && !participantCols.some(c => c.name === 'pulse_bpm')) {
      db.exec('ALTER TABLE participants ADD COLUMN pulse_bpm INTEGER;');
    }
  } catch {}

  if (!db.prepare('PRAGMA table_info(participants)').all().some(column => column.name === 'medical_history')) {
    db.exec('ALTER TABLE participants ADD COLUMN medical_history TEXT;');
  }
  if (!db.prepare('PRAGMA table_info(staff)').all().some(column => column.name === 'can_view_participants')) {
    db.exec('ALTER TABLE staff ADD COLUMN can_view_participants INTEGER DEFAULT 0;');
  }
  if (!db.prepare('PRAGMA table_info(staff)').all().some(column => column.name === 'can_view_dashboard')) {
    db.exec('ALTER TABLE staff ADD COLUMN can_view_dashboard INTEGER DEFAULT 0;');
  }

  // 4. Audit logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      actor_type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details TEXT,
      ip TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
  `);

  // 5. Sync queue table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      retries INTEGER DEFAULT 0,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(status);
  `);

  // 6. Centralized Atomic Token Sequence
  db.exec(`
    CREATE TABLE IF NOT EXISTS token_sequence (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_token INTEGER NOT NULL DEFAULT 0
    );
  `);

  // 7. Idempotency Keys table for duplicate request prevention
  db.exec(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      response_body TEXT NOT NULL,
      response_status INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_keys(created_at);
  `);

  // Initialize token_sequence with MAX(token) from participants if not already present
  try {
    const seq = db.prepare('SELECT last_token FROM token_sequence WHERE id = 1').get();
    if (!seq) {
      const maxTokenRow = db.prepare('SELECT COALESCE(MAX(token), 0) AS max_token FROM participants').get();
      db.prepare('INSERT OR REPLACE INTO token_sequence (id, last_token) VALUES (1, ?)').run(maxTokenRow.max_token);
    }
  } catch {}

  const now = new Date().toISOString();

  // Bootstrap Super Admin
  const adminEmail = (process.env.ADMIN_EMAIL || 'evolixstudio@gmail.com').toLowerCase().trim();
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'Evolix@5253';
  const existingAdmin = db.prepare('SELECT id FROM admin WHERE email = ?').get(adminEmail);
  if (!existingAdmin) {
    const { hash, salt } = hashSecret(initialPassword);
    db.prepare(`
      INSERT INTO admin (id, email, password_hash, password_salt, must_change_password, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(randomUUID(), adminEmail, hash, salt, now, now);
  }

  // Bootstrap the 15 Real Staff Accounts
  const checkStaffStmt = db.prepare('SELECT id FROM staff WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))');
  const insertStaffStmt = db.prepare(`
    INSERT INTO staff (id, name, pin_hash, pin_salt, counters, can_register, can_view_dashboard, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  const needsStaffBootstrap = db.prepare('SELECT COUNT(*) AS count FROM staff').get().count === 0;
  for (const s of needsStaffBootstrap ? INITIAL_REAL_STAFF : []) {
    const existing = checkStaffStmt.get(s.name);
    if (!existing) {
      const { hash, salt } = hashSecret(s.can_view_dashboard ? '5253' : (process.env.STAFF_INITIAL_PIN || '5253'));
      insertStaffStmt.run(
        randomUUID(),
        s.name,
        hash,
        salt,
        JSON.stringify(s.counters),
        s.can_register,
        s.can_view_dashboard || 0,
        now,
        now
      );
    }
  }

  if (!customPath) {
    dbInstance = db;
  }
  return db;
}

export function getDb() {
  if (process.env.DATABASE_URL) return postgresDb();
  if (!dbInstance) {
    return initDb();
  }
  return dbInstance;
}

export function formatTokenNumber(token) {
  const num = parseInt(token, 10);
  if (!Number.isSafeInteger(num) || num <= 0) return String(token || '');
  return String(num).padStart(Math.max(3, String(num).length), '0');
}

export async function allocateNextToken(db) {
  const row = await db.prepare(`
    UPDATE token_sequence
    SET last_token = last_token + 1
    WHERE id = 1
    RETURNING last_token
  `).get();
  if (!row || typeof row.last_token !== 'number') {
    throw new Error('Failed to allocate next atomic token from sequence.');
  }
  return row.last_token;
}

// SQLite requests must stay serialized when an awaited query yields inside a transaction.
let sqliteQueue = Promise.resolve();
export function withDatabase(work) {
  if (process.env.DATABASE_URL) return withPostgres(work, INITIAL_REAL_STAFF);
  const result = sqliteQueue.then(work);
  sqliteQueue = result.catch(() => {});
  return result;
}
