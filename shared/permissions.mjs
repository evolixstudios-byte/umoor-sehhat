export const COUNTERS = [
  { id: 'bp', num: 1, title: 'Counter 1 — Blood Pressure', shortTitle: 'Blood Pressure', icon: 'heart', perm: 'counter:bp' },
  { id: 'sugar', num: 2, title: 'Counter 2 — Blood Sugar', shortTitle: 'Blood Sugar', icon: 'droplet', perm: 'counter:sugar' },
  { id: 'bmi', num: 3, title: 'Counter 3 — BMI', shortTitle: 'BMI', icon: 'ruler', perm: 'counter:bmi' },
  { id: 'doctor', num: 4, title: 'Counter 4 — Doctor', shortTitle: 'Doctor', icon: 'clipboard', perm: 'counter:doctor' },
];

export const PERMISSIONS = {
  PARTICIPANT_VIEW: 'participant:view',
  DASHBOARD_VIEW: 'dashboard:view',
  COUNTER_BP: 'counter:bp',
  COUNTER_SUGAR: 'counter:sugar',
  COUNTER_BMI: 'counter:bmi',
  COUNTER_DOCTOR: 'counter:doctor',
  DESK_REGISTRATION: 'desk:registration',
  ADMIN_FULL: 'admin:full',
};

export function getPermissionsFromStaff(staff) {
  if (staff.can_view_dashboard) return [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.PARTICIPANT_VIEW];
  if (staff.can_view_participants) return [PERMISSIONS.PARTICIPANT_VIEW];
  const perms = new Set();
  const counters = Array.isArray(staff.counters) ? staff.counters : JSON.parse(staff.counters || '[]');
  if (counters.includes('bp')) perms.add(PERMISSIONS.COUNTER_BP);
  if (counters.includes('sugar')) perms.add(PERMISSIONS.COUNTER_SUGAR);
  if (counters.includes('bmi')) perms.add(PERMISSIONS.COUNTER_BMI);
  if (counters.includes('doctor')) perms.add(PERMISSIONS.COUNTER_DOCTOR);
  if (staff.can_register) perms.add(PERMISSIONS.DESK_REGISTRATION);
  return Array.from(perms);
}

export function hasPermission(userPermissions = [], requiredPermission) {
  if (!Array.isArray(userPermissions)) return false;
  if (userPermissions.includes('*') || userPermissions.includes('admin:full')) return true;
  return userPermissions.includes(requiredPermission);
}
