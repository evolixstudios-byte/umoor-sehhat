import { HISTORY_OPTIONS } from '../public/clinical.js';
import { getDb, withDatabase } from './db.mjs';

function getSheetConfig() {
  const url = process.env.SHEETS_WEBAPP_URL || '';
  const secret = process.env.SHEETS_WEBHOOK_SECRET || '';
  const isConfigured = /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/.test(url) && secret.length >= 24;
  return { url, secret, isConfigured };
}

export async function forwardToSheet(action, data) {
  const config = getSheetConfig();
  if (!config.isConfigured) {
    throw new Error('Google Sheets connector is not configured.');
  }

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 18000);
  try {
    const upstream = await fetch(config.url, {
      method: 'POST',
      redirect: 'follow',
      signal: abort.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret: config.secret, action, data }),
    });

    if (!upstream.ok) {
      throw new Error(`Google Apps Script responded with HTTP ${upstream.status}`);
    }

    const raw = await upstream.text();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Google Apps Script returned an invalid non-JSON response.');
    }

    if (!parsed || typeof parsed.ok !== 'boolean') {
      throw new Error('Invalid response structure from Google Sheets connector.');
    }

    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

export async function queueSync(action, payload) {
  try {
    const db = getDb();
    const now = new Date().toISOString();
    (await db.prepare(`
      INSERT INTO sync_queue (action, payload, status, retries, created_at, updated_at)
      VALUES (?, ?, 'pending', 0, ?, ?)
    `).run(action, JSON.stringify(payload), now, now));

    setImmediate(() => {
      withDatabase(() => processSyncQueue()).catch(err => {
        console.error('Background sync queue processing error:', err.message);
      });
    });
  } catch (err) {
    console.error('Failed to queue sync item:', err.message);
  }
}

let isProcessingQueue = false;

export async function processSyncQueue() {
  const config = getSheetConfig();
  if (!config.isConfigured || isProcessingQueue) {
    return { processed: 0, status: config.isConfigured ? 'busy' : 'unconfigured' };
  }

  isProcessingQueue = true;
  let processed = 0;
  const db = getDb();

  try {
    const pendingItems = (await db.prepare(`
      SELECT * FROM sync_queue
      WHERE status IN ('pending', 'failed') AND retries < 5
      ORDER BY id ASC
      LIMIT 20
    `).all());

    for (const item of pendingItems) {
      const payload = JSON.parse(item.payload);
      const now = new Date().toISOString();

      try {
        const result = await forwardToSheet(item.action, payload);
        if (result.ok) {
          (await db.prepare(`
            UPDATE sync_queue
            SET status = 'synced', updated_at = ?, error_message = NULL
            WHERE id = ?
          `).run(now, item.id));

          if (payload.serial || payload.its) {
            (await db.prepare(`
              UPDATE participants
              SET sync_status = 'synced', sync_error = NULL, last_synced_at = ?
              WHERE ${payload.serial ? 'serial' : 'its'} = ?
            `).run(now, payload.serial || payload.its));
          }
          processed++;
        } else {
          throw new Error(result.error || 'Google Apps Script returned an error.');
        }
      } catch (err) {
        (await db.prepare(`
          UPDATE sync_queue
          SET status = 'failed', retries = retries + 1, error_message = ?, updated_at = ?
          WHERE id = ?
        `).run(err.message, now, item.id));

        if (payload.serial || payload.its) {
          (await db.prepare(`
            UPDATE participants
            SET sync_status = 'failed', sync_error = ?
            WHERE ${payload.serial ? 'serial' : 'its'} = ?
          `).run(err.message, payload.serial || payload.its));
        }
      }
    }
  } finally {
    isProcessingQueue = false;
  }

  return { processed };
}

export async function getSyncStats() {
  const db = getDb();
  const config = getSheetConfig();

  const counts = (await db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN sync_status = 'synced' THEN 1 ELSE 0 END) as synced,
      SUM(CASE WHEN sync_status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN sync_status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM participants
  `).get());

  const lastSynced = (await db.prepare(`
    SELECT last_synced_at FROM participants
    WHERE last_synced_at IS NOT NULL
    ORDER BY last_synced_at DESC LIMIT 1
  `).get());

  return {
    isConfigured: config.isConfigured,
    total: counts.total || 0,
    synced: counts.synced || 0,
    pending: counts.pending || 0,
    failed: counts.failed || 0,
    lastSyncedAt: lastSynced?.last_synced_at || null,
  };
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '""';
  let str = String(value);
  if (/^[=+\-@]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export async function generateCsvExport() {
  const db = getDb();
  const participants = (await db.prepare(`
    SELECT * FROM participants ORDER BY token ASC
  `).all());

  const headers = [
    'Token No.',
    'Serial No.',
    'ITS Number',
    'Full Name',
    'Mobile Number',
    'Age',
    'Gender',
    'Consent Given',
    'Registered At',
    'Registered By',
    'BP Systolic (mmHg)',
    'BP Diastolic (mmHg)',
    'Pulse Rate (BPM)',
    'BP Checked At',
    'BP Checked By',
    'Blood Sugar (mg/dL)',
    'Sugar Test Type',
    'Sugar Checked At',
    'Sugar Checked By',
    'Height (cm)',
    'Weight (kg)',
    'BMI',
    'Measurements Checked At',
    'Measurements Checked By',
    "Doctor's Prescription / Advice",
    'Doctor Consulted At',
    'Doctor Consulted By',
    'Last Updated At',
    'Reported Medical History',
  ];

  const rows = [headers.map(escapeCsvCell).join(',')];

  for (const p of participants) {
    const row = [
      p.token,
      p.serial,
      p.its,
      p.name,
      p.phone,
      p.age,
      p.gender,
      p.consent ? 'Yes' : 'No',
      p.registered_at || '',
      p.registered_by || '',
      p.bp_systolic || '',
      p.bp_diastolic || '',
      p.pulse_bpm || '',
      p.bp_at || '',
      p.bp_by || '',
      p.blood_sugar || '',
      p.sugar_type || '',
      p.sugar_at || '',
      p.sugar_by || '',
      p.height || '',
      p.weight || '',
      p.bmi || '',
      p.measurements_at || '',
      p.measurements_by || '',
      p.advice || '',
      p.doctor_at || '',
      p.doctor_by || '',
      p.updated_at || '',
      p.medical_history ? JSON.parse(p.medical_history).map(id => HISTORY_OPTIONS.find(option => option.id === id)?.label || id).join('; ') : 'History not recorded',
    ];
    rows.push(row.map(escapeCsvCell).join(','));
  }

  return '\uFEFF' + rows.join('\r\n');
}
