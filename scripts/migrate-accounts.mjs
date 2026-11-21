import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import pg from 'pg';

export async function migrateAccounts(source, destination) {
  assert.equal(source.prepare('SELECT COUNT(*) AS count FROM participants').get().count, 0,
    'The local participant table must be empty; demo or patient records will not be uploaded.');
  const tables = ['staff', 'admin', 'audit_logs'];
  const records = Object.fromEntries(tables.map(table => [table, source.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]));
  assert.ok(records.staff.length && records.admin.length, 'Source accounts are missing.');
  await destination.query('BEGIN');
  try {
    await destination.query(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    for (const table of ['staff', 'admin', 'participants', 'audit_logs']) {
      const result = await destination.query(`SELECT COUNT(*) AS count FROM ${table}`);
      assert.equal(Number(result.rows[0].count), 0, 'Destination must be empty. Existing records will not be overwritten.');
    }
    for (const table of tables) {
      for (const record of records[table]) {
        const columns = Object.keys(record);
        await destination.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(',')})`, Object.values(record));
      }
      const copied = await destination.query(`SELECT * FROM ${table} ORDER BY id`);
      for (let index = 0; index < records[table].length; index++) {
        for (const [column, value] of Object.entries(records[table][index])) {
          assert.deepEqual(copied.rows[index]?.[column], value, `Account transfer verification failed in ${table}.${column}.`);
        }
      }
      assert.equal(copied.rows.length, records[table].length);
    }
    await destination.query('UPDATE token_sequence SET last_token = 0 WHERE id = 1');
    await destination.query('COMMIT');
    return { staff: records.staff.length, superAdmins: records.admin.length, auditEntries: records.audit_logs.length, participants: 0, nextToken: '001' };
  } catch (error) {
    await destination.query('ROLLBACK');
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL privately before running the account transfer.');
  const source = new DatabaseSync(process.env.DB_PATH || 'data/umoor_sehat.db', { readOnly: true });
  const destination = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
  try {
    await destination.connect();
    console.log(JSON.stringify(await migrateAccounts(source, destination)));
  } finally {
    source.close();
    await destination.end();
  }
}
