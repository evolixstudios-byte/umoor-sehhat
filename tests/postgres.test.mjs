// Run the API contract against a real embedded PostgreSQL engine as well as SQLite.
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';

const database = new PGlite();
let queue = Promise.resolve();
pg.Pool = class {
  on() {}
  async end() {}
  async connect() {
    const previous = queue;
    let release;
    queue = new Promise(resolve => { release = resolve; });
    await previous;
    return {
      query: async (sql, params) => {
        const result = params ? await database.query(sql, params) : (await database.exec(sql)).at(-1);
        return result || { rows: [] };
      },
      release,
    };
  }
};
process.env.DATABASE_URL = 'postgresql://embedded-test';
await import('./api.test.mjs');
