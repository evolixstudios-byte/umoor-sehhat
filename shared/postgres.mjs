import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { hashSecret } from './auth.mjs';

const context = new AsyncLocalStorage();
let pool;
let ready;

export function postgresDb() {
  const client = context.getStore();
  if (!client) throw new Error('Database operation requires a request connection.');
  return {
    exec: sql => client.query(sql.replace('BEGIN IMMEDIATE', 'BEGIN')),
    prepare(sql) {
      let index = 0;
      const query = sql.replace(/\?/g, () => `$${++index}`);
      return {
        get: async (...params) => (await client.query(query, params)).rows[0],
        all: async (...params) => (await client.query(query, params)).rows,
        run: (...params) => client.query(query, params),
      };
    },
  };
}

async function initialize(staff) {
  // PostgreSQL returns aggregate bigint values as strings by default.
  pg.types.setTypeParser(20, value => Number(value));
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 10000 });
  pool.on('error', err => console.error('Database connection error:', err.message));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(724901)');
    await client.query(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    const now = new Date().toISOString();
    const email = (process.env.ADMIN_EMAIL || 'evolixstudio@gmail.com').trim().toLowerCase();
    const admin = hashSecret(process.env.ADMIN_INITIAL_PASSWORD || 'Evolix@5253');
    await client.query(`INSERT INTO admin (id,email,password_hash,password_salt,must_change_password,created_at,updated_at)
      VALUES ($1,$2,$3,$4,1,$5,$5) ON CONFLICT (email) DO NOTHING`, [randomUUID(),email,admin.hash,admin.salt,now]);
    const needsStaffBootstrap = (await client.query('SELECT COUNT(*) AS count FROM staff')).rows[0].count === 0;
    for (const member of needsStaffBootstrap ? staff : []) {
      const pin = hashSecret(member.can_view_dashboard ? '5253' : (process.env.STAFF_INITIAL_PIN || '5253'));
      await client.query(`INSERT INTO staff (id,name,pin_hash,pin_salt,counters,can_register,can_view_dashboard,is_active,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,1,$8,$8) ON CONFLICT (name) DO NOTHING`,
      [randomUUID(),member.name,pin.hash,pin.salt,JSON.stringify(member.counters),member.can_register,member.can_view_dashboard || 0,now]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
}

export async function withPostgres(work, staff) {
  ready ||= initialize(staff).catch(async err => {
    await pool?.end();
    ready = undefined;
    throw err;
  });
  await ready;
  const client = await pool.connect();
  try { return await context.run(client, work); }
  finally {
    // Also clears a transaction left open by an unexpected request failure.
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}
