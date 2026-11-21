import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { unlinkSync, existsSync } from 'node:fs';
import { initDb } from '../shared/db.mjs';

test('Local database upgrade preserves participants and does not recreate deleted or renamed staff', () => {
  const file=path.join(tmpdir(),'umoor-history-migration-'+randomUUID()+'.db');
  let db;
  try {
    db=initDb(file);
    db.prepare("INSERT INTO participants (id,token,serial,its,name,phone,age,gender,registered_at,updated_at) VALUES ('old',1,'US-0001','12345678','Existing patient','9123456789',40,'Male','2026-11-21T10:00:00Z','2026-11-21T10:00:00Z')").run();
    db.prepare("DELETE FROM staff WHERE name='janab saab'").run();
    db.exec('ALTER TABLE participants DROP COLUMN medical_history; ALTER TABLE staff DROP COLUMN can_view_dashboard;');
    db.close();
    db=initDb(file);
    const patient=db.prepare("SELECT * FROM participants WHERE id='old'").get();
    assert.equal(patient.token,1);
    assert.equal(patient.medical_history,null);
    assert.equal(db.prepare("SELECT can_view_dashboard FROM staff WHERE name='janab saab'").get(),undefined);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM staff').get().count,15);
  } finally {
    db?.close();
    for(const suffix of ['','-wal','-shm']) if(existsSync(file+suffix)) unlinkSync(file+suffix);
  }
});
