export const HISTORY_OPTIONS = [
  { id: 'bp', label: 'High BP history', tone: 'bp' },
  { id: 'sugar', label: 'Diabetes / high sugar history', tone: 'sugar' },
  { id: 'none', label: 'No known history', tone: 'normal' },
];

export function selectHistory(current, id, checked) {
  if (!checked) return current.filter(value => value !== id);
  if (id === 'none') return ['none'];
  return [...current.filter(value => value !== 'none' && value !== id), id];
}

// Screening references and clinical limits are documented in SETUP.md.
export function getReadingFlags(patient) {
  const flag = (status, label) => ({ status, label });
  const sys = Number(patient.bpSystolic), dia = Number(patient.bpDiastolic);
  const glucose = Number(patient.bloodSugar);
  const adult = Number(patient.age) >= 18;
  let bp = flag('pending', 'BP not recorded');
  if (sys > 0 && dia > 0 && Number.isFinite(sys) && Number.isFinite(dia)) {
    if (!adult) bp = flag('review', 'BP: age-specific review');
    else if (sys > 180 || dia > 120) bp = flag('urgent', 'High BP — Stage 2; severely high — prompt clinical review');
    else if (sys < 90 || dia < 60) bp = flag('low', 'Low BP reading — assess symptoms');
    else if (sys >= 140 || dia >= 90) bp = flag('high', 'High BP — Stage 2');
    else if (sys >= 130 || dia >= 80) bp = flag('high', 'High BP — Stage 1');
    else if (sys >= 120) bp = flag('elevated', 'Elevated BP reading');
    else bp = flag('normal', 'Normal BP (adult screening range)');
  }
  let sugar = flag('pending', 'Sugar not recorded');
  if (glucose > 0 && Number.isFinite(glucose)) {
    if (glucose < 54) sugar = flag('urgent', 'Dangerously low sugar — prompt clinical review');
    else if (glucose < 70) sugar = flag('low', 'Low sugar — prompt clinical review');
    else if (!adult) sugar = flag('review', 'Sugar: age-specific review');
    else if (patient.sugarType === 'Fasting') {
      if (glucose >= 126) sugar = flag('high', 'High fasting sugar — confirm and review');
      else if (glucose >= 100) sugar = flag('elevated', 'Raised fasting sugar — review');
      else sugar = flag('normal', 'Fasting sugar within screening range');
    } else if (patient.sugarType === 'Random') {
      if (glucose >= 200) sugar = flag('high', 'High random sugar — assess symptoms and confirm');
      else if (glucose > 140) sugar = flag('elevated', 'Elevated / borderline random sugar');
      else sugar = flag('normal', 'Normal random sugar (camp screening range)');
    } else if (patient.sugarType === 'Post-meal') {
      // shortcut: meal timing is not recorded; add timing before classifying post-meal results.
      sugar = flag('review', 'Post-meal sugar — confirm timing and review');
    } else sugar = flag('review', 'Sugar — clinical review; normal status not established');
  }
  return { bp, sugar };
}
