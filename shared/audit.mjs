import { randomUUID } from 'node:crypto';
import { getDb } from './db.mjs';

export async function logAudit({
  actorType = 'system',
  actorId = 'system',
  actorName = 'System',
  actorRole = 'system',
  action,
  targetType = null,
  targetId = null,
  details = null,
  ip = null,
}) {
  try {
    const db = getDb();
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    let safeDetails = details;
    if (typeof details === 'object' && details !== null) {
      const copy = { ...details };
      // Never log sensitive credentials
      delete copy.password;
      delete copy.pin;
      delete copy.token;
      delete copy.secret;
      safeDetails = JSON.stringify(copy);
    } else if (typeof details !== 'string') {
      safeDetails = details ? String(details) : null;
    }

    (await db.prepare(`
      INSERT INTO audit_logs (id, timestamp, actor_type, actor_id, actor_name, actor_role, action, target_type, target_id, details, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      timestamp,
      actorType,
      actorId,
      actorName,
      actorRole,
      action,
      targetType,
      targetId,
      safeDetails,
      ip
    ));
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

export async function getAuditLogs({ limit = 50, offset = 0, query = '' } = {}) {
  const db = getDb();
  if (query) {
    const search = `%${query.toLowerCase()}%`;
    const rows = (await db.prepare(`
      SELECT * FROM audit_logs
      WHERE LOWER(action) LIKE ? OR LOWER(actor_name) LIKE ? OR LOWER(target_id) LIKE ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `).all(search, search, search, limit, offset));

    const count = (await db.prepare(`
      SELECT COUNT(*) as count FROM audit_logs
      WHERE LOWER(action) LIKE ? OR LOWER(actor_name) LIKE ? OR LOWER(target_id) LIKE ?
    `).get(search, search, search)).count;

    return { logs: rows, total: count };
  }

  const rows = (await db.prepare(`
    SELECT * FROM audit_logs
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset));

  const count = (await db.prepare('SELECT COUNT(*) as count FROM audit_logs').get()).count;
  return { logs: rows, total: count };
}
