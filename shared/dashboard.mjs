import { getReadingFlags } from '../public/clinical.js';

export async function getCampStats(db) {
  const rows = await db.prepare(`SELECT age, medical_history, bp_systolic, bp_diastolic, blood_sugar,
    sugar_type, registered_at, doctor_at FROM participants`).all();
  const history = [
    { id: 'bp', label: 'BP history only', count: 0 },
    { id: 'sugar', label: 'Diabetes / sugar history only', count: 0 },
    { id: 'both', label: 'BP and diabetes history', count: 0 },
    { id: 'none', label: 'No known history', count: 0 },
    { id: 'unknown', label: 'History not recorded', count: 0 },
  ];
  const days = new Map();
  const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  const readings = { bpFlagged: 0, sugarFlagged: 0, bpRecorded: 0, sugarRecorded: 0, doctorCompleted: 0 };
  for (const row of rows) {
    const known = row.medical_history ? JSON.parse(row.medical_history) : [];
    const group = known.includes('bp') && known.includes('sugar') ? 'both' : known[0] || 'unknown';
    history.find(item => item.id === group).count++;
    const day = dayFormat.format(new Date(row.registered_at));
    days.set(day, (days.get(day) || 0) + 1);
    const flags = getReadingFlags({ age: row.age, bpSystolic: row.bp_systolic, bpDiastolic: row.bp_diastolic, bloodSugar: row.blood_sugar, sugarType: row.sugar_type });
    const flagged = status => ['high', 'urgent', 'low', 'elevated'].includes(status);
    if (flags.bp.status !== 'pending') readings.bpRecorded++;
    if (flags.sugar.status !== 'pending') readings.sugarRecorded++;
    if (flagged(flags.bp.status)) readings.bpFlagged++;
    if (flagged(flags.sugar.status)) readings.sugarFlagged++;
    if (row.doctor_at) readings.doctorCompleted++;
  }
  const orderedDays = [...days.keys()].sort();
  if (orderedDays.length) {
    for (let stamp = Date.parse(orderedDays[0] + 'T00:00:00Z'); stamp <= Date.parse(orderedDays.at(-1) + 'T00:00:00Z'); stamp += 86400000) {
      const day = new Date(stamp).toISOString().slice(0, 10);
      if (!days.has(day)) days.set(day, 0);
    }
  }
  return { total: rows.length, history, readings, registrations: [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })) };
}
