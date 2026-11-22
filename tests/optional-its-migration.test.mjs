import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {readFileSync,existsSync,unlinkSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {initDb} from '../shared/db.mjs';

test('SQLite migration removes mandatory ITS while preserving records, staff and indexes',()=>{
 const file=path.join(tmpdir(),'umoor-optional-its-'+randomUUID()+'.db');let db;
 try{
  db=initDb(file);
  db.prepare("INSERT INTO participants(id,token,serial,its,name,phone,age,gender,registered_at,updated_at) VALUES('legacy',1,'US-0001','12345678','Existing patient','9123456789',45,'Male','2026-11-22','2026-11-22')").run();
  const patient={...db.prepare('SELECT * FROM participants').get()};const staff=JSON.stringify(db.prepare('SELECT * FROM staff ORDER BY id').all());
  const schema=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='participants'").get().sql.replace(/its TEXT UNIQUE/,'its TEXT NOT NULL UNIQUE');
  db.exec('ALTER TABLE participants RENAME TO legacy_participants;');db.exec(schema);db.exec('INSERT INTO participants SELECT * FROM legacy_participants; DROP TABLE legacy_participants; CREATE INDEX idx_custom_phone ON participants(phone);');db.close();
  db=initDb(file);
  assert.deepEqual({...db.prepare('SELECT * FROM participants').get()},patient);assert.equal(JSON.stringify(db.prepare('SELECT * FROM staff ORDER BY id').all()),staff);
  assert.equal(db.prepare("PRAGMA table_info(participants)").all().find(row=>row.name==='its').notnull,0);
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name='idx_custom_phone'").get());
  for(const token of [2,3])db.prepare("INSERT INTO participants(id,token,serial,name,phone,age,gender,registered_at,updated_at) VALUES(?,?,?,?,?,45,'Male','2026-11-22','2026-11-22')").run('new-'+token,token,'US-000'+token,'New patient','9123456789');
  assert.equal(db.prepare('SELECT count(*) AS count FROM participants WHERE its IS NULL').get().count,2);
 }finally{db?.close();for(const suffix of ['','-wal','-shm'])if(existsSync(file+suffix))unlinkSync(file+suffix);}
});

test('PostgreSQL schema upgrade preserves legacy ITS and accepts multiple missing values',async()=>{
 const db=new PGlite();
 try{
  const schema=readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8');
  await db.exec(schema.replace('its TEXT UNIQUE','its TEXT NOT NULL UNIQUE').replace('ALTER TABLE participants ALTER COLUMN its DROP NOT NULL;',''));
  await db.exec("INSERT INTO participants(id,token,serial,its,name,phone,age,gender,registered_at,updated_at) VALUES('old',1,'US-0001','12345678','Existing patient','9123456789',45,'Male','2026-11-22','2026-11-22')");
  await db.exec(schema);
  for(const token of [2,3])await db.query("INSERT INTO participants(id,token,serial,name,phone,age,gender,registered_at,updated_at) VALUES($1,$2,$3,'New patient','9123456789',45,'Male','2026-11-22','2026-11-22')",['new-'+token,token,'US-000'+token]);
  assert.equal((await db.query("SELECT its FROM participants WHERE id='old'")).rows[0].its,'12345678');
  assert.equal(Number((await db.query('SELECT count(*) AS count FROM participants WHERE its IS NULL')).rows[0].count),2);
 }finally{await db.close();}
});
