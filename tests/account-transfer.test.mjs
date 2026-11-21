import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { initDb } from '../shared/db.mjs';
import { migrateAccounts } from '../scripts/migrate-accounts.mjs';

test('Deployment transfer preserves account credentials, roles, and settings without demo records', async () => {
  const source = initDb(':memory:');
  source.prepare("UPDATE staff SET name='Renamed Staff',can_register=1,is_active=0 WHERE name='Hasan'").run();
  const destination = new PGlite();
  const client = { query: async (sql, params) => params ? destination.query(sql, params) : (await destination.exec(sql)).at(-1) };
  try {
    const before = source.prepare("SELECT * FROM staff WHERE name='Renamed Staff'").get();
    const result = await migrateAccounts(source, client);
    assert.equal(result.staff, 16);
    assert.equal(result.participants, 0);
    assert.equal(result.nextToken, '001');
    assert.deepEqual((await destination.query("SELECT * FROM staff WHERE name='Renamed Staff'")).rows[0], { ...before });
    await assert.rejects(() => migrateAccounts(source, client), /Destination must be empty/);
    assert.equal((await destination.query('SELECT COUNT(*) AS count FROM staff')).rows[0].count, 16);
    source.prepare("INSERT INTO participants (id,token,serial,its,name,phone,age,gender,registered_at,updated_at) VALUES ('demo',1,'US-0001','12345678','Demo','9123456789',30,'Male','now','now')").run();
    await assert.rejects(() => migrateAccounts(source, client), /participant table must be empty/);
  } finally { source.close(); await destination.close(); }
});
