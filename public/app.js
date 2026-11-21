import { HISTORY_OPTIONS, selectHistory, getReadingFlags } from './clinical.js';

/* UMOOR SEHAT — PHYSICAL HEALTH CAMP COUNTER WORKFLOW SYSTEM */

const SITE = 'https://evolix-studio.in/';

function evolixBrandHtml() {
  return `<a class="evolix-credit" href="${SITE}" target="_blank" rel="noopener noreferrer" aria-label="Developed by Evolix Studio (opens in a new tab)"><img src="/assets/evolix-studio-logo.webp" width="36" height="36" alt="Evolix Studio logo" /><span><small>Developed by</small><strong>Evolix Studio</strong></span></a>`;
}



const COUNTERS_CONFIG = [

  { id: 'bp', num: 1, title: 'Counter 1 — Blood Pressure', short: 'BP', icon: 'heart', perm: 'counter:bp' },

  { id: 'sugar', num: 2, title: 'Counter 2 — Blood Sugar', short: 'Sugar', icon: 'droplet', perm: 'counter:sugar' },

  { id: 'bmi', num: 3, title: 'Counter 3 — BMI', short: 'BMI', icon: 'ruler', perm: 'counter:bmi' },

  { id: 'doctor', num: 4, title: 'Counter 4 — Doctor', short: 'Doctor', icon: 'clipboard', perm: 'counter:doctor' },

];



const SVG = {

  grid: '<rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/>',

  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z"/><path d="M4.5 12h4l2-3 3 6 2-3h4"/>',

  droplet: '<path d="M12 22a8 8 0 0 0 8-8c0-5-8-12-8-12S4 9 4 14a8 8 0 0 0 8 8Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',

  ruler: '<path d="m21.3 8.7-6-6a1 1 0 0 0-1.4 0L2.7 13.9a1 1 0 0 0 0 1.4l6 6a1 1 0 0 0 1.4 0L21.3 10a1 1 0 0 0 0-1.4Z"/><path d="m7.5 10.5 2 2m1-5 2 2m1-5 2 2m-11 7 2 2"/>',

  clipboard: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4.5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.5M9 12h6m-6 4h4"/>',

  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',

  chevron: '<path d="m9 18 6-6-6-6"/>',

  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',

  check: '<path d="m20 6-11 11-5-5"/>',

  plus: '<path d="M12 5v14M5 12h14"/>',

  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',

  info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v5m0-8h.01"/>',

  alert: '<path d="m10.3 3.9-8.5 14.7A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.4L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/>',

  close: '<path d="M18 6 6 18M6 6l12 12"/>',

  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',

  user: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',

  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',

  refresh: '<path d="M20 11a8 8 0 0 0-14-5L4 8m0-5v5h5M4 13a8 8 0 0 0 14 5l2-2m0 5v-5h-5"/>',

  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',

  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m21 3-9.5 9.5M15.5 7.5l3 3"/>',

};



const icon = (name, size = '') => `<svg class="icon ${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG[name] || SVG.info}</svg>`;

const esc = (input) => String(input ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const initials = s => String(s || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();



const state = {

  user: null,

  loginMode: 'staff', // 'staff' | 'admin'

  page: 'counter', // 'counter' | 'registration' | 'admin'

  activeCounter: 'bp',

  participant: null,

  toast: null,

  modal: null, // null | 'fallback_search' | 'add_staff' | 'edit_staff' | 'reset_pin' | 'change_password' | 'view_participant'

  modalData: null,

  isSubmitting: false,

  regSuccess: null,

  regConflict: null,

  // Native numeric input state

  activeField: 'loginPin',

  fields: {

    loginStaffName: '',

    loginPin: '',

    tokenSearch: '',

    bpSys: '',

    bpDia: '',

    bpPulse: '',

    sugarVal: '',

    measHeight: '',

    measWeight: '',

    regName: '',

    regIts: '',

    regPhone: '',

    regAge: '',

  },

  sugarType: 'Random',

  regGender: 'Male',

  regConsent: true,

  regMedicalHistory: [],

  dashboard: null,
  directory: {participants:[],total:0,offset:0,query:'',error:''},

  // Admin Data

  adminTab: 'staff',

  staffList: [],

  auditLogs: [],

  stats: null,

  fallbackResults: [],

  fallbackQuery: '',

};



function hasPerm(perm) {

  if (!state.user) return false;

  const p = state.user.permissions || [];

  return p.includes('*') || p.includes('admin:full') || p.includes(perm);

}



async function call(action, data = {}, extra = {}) {

  try {

    const res = await fetch('/api', {

      method: 'POST',

      credentials: 'same-origin',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({ action, data, ...extra }),

    });



    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('text/csv')) {

      const blob = await res.blob();

      return { ok: true, isBlob: true, blob };

    }



    const result = await res.json();

    if (!result.ok) {

      if (res.status === 401 && !action.startsWith('auth.')) {

        state.user = null;

        state.participant = null;

        notify('Session expired. Please sign in again.', true);

        render();

        return null;

      }

      const err = new Error(result.error || 'Request failed.');

      err.status = res.status;

      err.errorCode = result.errorCode;

      err.existing = result.existing;

      err.data = result.data;

      throw err;

    }

    return result;

  } catch (err) {

    notify(err.message || 'Cannot reach server.', true);

    throw err;

  }

}



function notify(message, error = false) {

  state.toast = { message, error };

  const host = document.getElementById('toasts');

  if (host) host.innerHTML = toastHtml();

  clearTimeout(notify.timer);

  notify.timer = setTimeout(() => {

    state.toast = null;

    const node = document.getElementById('toasts');

    if (node) node.innerHTML = '';

  }, 4500);

}



function toastHtml() {

  return state.toast ? `

    <div class="toast ${state.toast.error ? 'error' : ''}" role="status">

      ${icon(state.toast.error ? 'alert' : 'checkcircle')}

      <span>${esc(state.toast.message)}</span>

      <button type="button" id="close-toast" aria-label="Close notification">${icon('close', 'sm')}</button>

    </div>` : '';

}



// -------------------------------------------------------------

// CUSTOM NUMPAD ENGINE (NO MOBILE SOFTWARE KEYBOARD TRIGGERED)

// -------------------------------------------------------------

function updateLiveBmi() {

  // Live BMI calculation if Counter 3

  if (state.activeCounter === 'bmi') {

    const h = parseFloat(state.fields.measHeight);

    const w = parseFloat(state.fields.measWeight);

    const bmiVal = document.getElementById('live-bmi-val');

    const bmiCat = document.getElementById('live-bmi-cat');

    if (h > 40 && w > 2 && bmiVal && bmiCat) {

      const calc = (w / Math.pow(h / 100, 2)).toFixed(1);

      bmiVal.textContent = calc;

      bmiCat.textContent = getBmiCategory(calc);

    } else if (bmiVal && bmiCat) {

      bmiVal.textContent = '—';

      bmiCat.textContent = 'Enter height & weight';

    }

  }

}



function getBmiCategory(bmi) {

  const n = parseFloat(bmi);

  if (isNaN(n) || n <= 0) return '—';

  if (n < 18.5) return 'Underweight';

  if (n < 25) return 'Normal weight';

  if (n < 30) return 'Overweight';

  return 'Obese';

}



function confirmField() {

  // Login workflow

  if (!state.user) {

    if (state.activeField === 'loginPin') {

      submitStaffLogin();

    }

    return;

  }



  // Registration Desk workflow

  if (state.page === 'registration') {

    if (state.activeField === 'regIts') {

      focusField('regPhone');

    } else if (state.activeField === 'regPhone') {

      focusField('regAge');

    } else if (state.activeField === 'regAge') {

      submitRegistrationForm();

    }

    return;

  }



  // Token entry workflow

  if (!state.participant) {

    if (state.activeField === 'tokenSearch') {

      findParticipantToken();

    }

    return;

  }



  // Inside counter measurement workflows

  if (state.activeCounter === 'bp') {

    if (state.activeField === 'bpSys') {

      focusField('bpDia');

    } else if (state.activeField === 'bpDia') {

      focusField('bpPulse');

    } else if (state.activeField === 'bpPulse') {

      saveCounterData('bp');

    }

  } else if (state.activeCounter === 'sugar') {

    saveCounterData('sugar');

  } else if (state.activeCounter === 'bmi') {

    if (state.activeField === 'measHeight') {

      focusField('measWeight');

    } else if (state.activeField === 'measWeight') {

      saveCounterData('bmi');

    }

  }

}



function focusField(fieldId) {

  state.activeField = fieldId;

  document.getElementById(fieldId)?.focus();

}



function numericFieldHtml(id, label, placeholder = '0') {

  const decimal = ['sugarVal', 'measHeight', 'measWeight'].includes(id);

  const limits = { loginPin: 4, tokenSearch: 6, regIts: 8, regPhone: 10, regAge: 3, bpSys: 3, bpDia: 3, bpPulse: 3 };

  return `<div class="field numeric-field">

    <label for="${id}">${esc(label)}</label>

    <input class="control control-number" id="${id}" data-numeric-field="${id}"

      type="${id === 'loginPin' ? 'password' : 'text'}" inputmode="${decimal ? 'decimal' : 'numeric'}"

      ${limits[id] ? `maxlength="${limits[id]}"` : ''}

      autocomplete="${id === 'loginPin' ? 'current-password' : id === 'regPhone' ? 'tel-national' : 'off'}"

      enterkeyhint="next" value="${esc(state.fields[id])}" placeholder="${esc(placeholder)}" />

  </div>`;

}



// -------------------------------------------------------------

// LOGIN COMPONENT (STAFF NUMPAD & ADMIN TAB)

// -------------------------------------------------------------

function loginViewHtml() {

  return `

    <div class="login-layout">

      <section class="login-art">

        <div class="login-brand">

          <img src="/assets/umoor-sehat.png" alt="Umoor Sehat logo">

          <div>

            <div class="name">UMOOR SEHAT</div>

            <div class="sub">Ratangarh Kheri Jamiat</div>

          </div>

        </div>

        <div class="login-message">

          <div class="tiny-label">Four Counter Health Camp</div>

          <h1>Physical Counter<br><em>Workflow Desk.</em></h1>

        </div>

        <div class="login-organizer">

          <img src="/assets/ratangarh-kheri-jamiat.png" alt="Ratangarh Kheri Jamiat">

          <div>

            <strong>Organized by Ratangarh Kheri Jamiat</strong>

            <small>Community wellness & health camp initiative.</small>

          </div>

        </div>

      </section>



      <section class="login-right">

        <div class="login-box">

          <div class="login-tabs">

            <button type="button" class="login-tab ${state.loginMode === 'janab' ? 'active' : ''}" id="switch-login-janab">Janab Login</button>

            <button type="button" class="login-tab ${state.loginMode === 'staff' ? 'active' : ''}" id="switch-login-staff">

              ${icon('users', 'sm')} Staff / Admin Login

            </button>

            <button type="button" class="login-tab ${state.loginMode === 'admin' ? 'active' : ''}" id="switch-login-admin">

              ${icon('shield', 'sm')} Super Admin

            </button>

          </div>



          ${state.loginMode !== 'admin' ? `

            <span class="login-badge">${icon('shield', 'sm')} Staff Name & PIN Sign In</span>

            <h2>${state.loginMode === 'janab' ? 'Janab Dashboard Sign In' : 'Counter Sign In'}</h2>



            <div class="field" style="margin-bottom:14px;">

              <label for="login-staff-name" style="font-weight:600;font-size:13px;color:#2d4036;display:block;margin-bottom:6px;">

                Registered Staff Name <em>*</em>

              </label>

              <input class="control" id="login-staff-name" type="text" placeholder="Staff name" autocomplete="username" autocorrect="off" autocapitalize="off" spellcheck="false" required value="${esc(state.loginMode === 'janab' ? 'janab saab' : state.fields.loginStaffName || '')}" ${state.loginMode === 'janab' ? 'readonly' : ''} style="font-size:15px;padding:12px 14px;background:#ffffff;border:1.5px solid #c9d8cd;border-radius:10px;width:100%;box-sizing:border-box;" />

            </div>



            <div style="margin-bottom:12px;">

              ${numericFieldHtml('loginPin', '4-digit PIN *', '••••')}

              <button type="button" class="btn primary large block" id="staff-signin-btn">Sign In</button>

            </div>

          ` : `

            <span class="login-badge" style="background:#fef7e6;color:#936310;">

              ${icon('shield', 'sm')} Super Admin Control Panel

            </span>

            <h2>Administrator Sign In</h2>

            <form id="admin-login-form">

              <div class="field">

                <label for="admin-email">Admin Email <em>*</em></label>

                <input class="control" id="admin-email" type="email" value="evolixstudio@gmail.com" required autocomplete="username" />

              </div>

              <div class="field" style="margin-top:16px;">

                <label for="admin-password">Password <em>*</em></label>

                <input class="control" id="admin-password" type="password" placeholder="Enter administrator password" required autocomplete="current-password" />

              </div>

              <div class="signin-actions">

                <button class="btn primary large block" type="submit">

                  ${icon('shield', 'sm')} Sign in as Super Admin ${icon('arrow', 'sm')}

                </button>

              </div>

            </form>

          `}

          <div class="login-branding">${evolixBrandHtml()}</div>

        </div>



        <div class="login-meta">

          <span>Organized by Ratangarh Kheri Jamiat</span>

        </div>

      </section>

    </div>

    ${modalHtml()}

    <div class="toast-area" id="toasts">${toastHtml()}</div>

  `;

}



// -------------------------------------------------------------

// TOKEN NUMBER FINDER (STEP 1 OF EVERY COUNTER)

// -------------------------------------------------------------

function tokenEntryHtml(counterConfig) {

  return `

    <div class="token-entry-card">

      <span class="token-badge-large">

        ${icon(counterConfig.icon, 'sm')} ${esc(counterConfig.title)}

      </span>

      <h2>Enter Participant Token</h2>



      <div style="width:100%;max-width:340px;margin-bottom:12px;">

        ${numericFieldHtml('tokenSearch', 'Token Number', 'e.g. 001')}

        <button type="button" class="btn primary block" id="find-token-btn">Find Participant</button>

      </div>







      <div style="margin-top:18px;">

        <button type="button" class="text-link" id="open-fallback-search">

          ${icon('search', 'sm')} Lost token? Search by ITS or Name

        </button>

      </div>

    </div>

  `;

}



// -------------------------------------------------------------

// PARTICIPANT BANNER (STEP 2 CONFIRMATION)

// -------------------------------------------------------------

function participantBannerHtml(p) {

  return `

    <div class="participant-confirmed-banner">

      <div style="display:flex;align-items:center;gap:14px;">

        <span class="token-tag">TOKEN #${esc(String(p.token).padStart(3, '0'))}</span>

        <div class="participant-meta-summary">

          <strong>${esc(p.name)}</strong>

          <small>${esc(p.serial)} • ITS: <b>${esc(p.its)}</b> • ${esc(p.age)} yrs • ${esc(p.gender)} • 📞 ${esc(p.phone)}</small>

        </div>

      </div>

      <button type="button" class="btn secondary sm" id="reset-token-btn" style="min-height:36px;padding:0 14px;">

        Change Token ${icon('close', 'sm')}

      </button>

    </div>

  `;

}



// -------------------------------------------------------------

// THE FOUR COUNTERS

// -------------------------------------------------------------

function counter1BpHtml() {

  const p = state.participant;

  if (!p) return tokenEntryHtml(COUNTERS_CONFIG[0]);



  return `

    <div class="form-wrap">

      ${participantBannerHtml(p)}



      <section class="panel station-panel">

        <div class="station-panel-header">

          <div>

            <h2>Counter 1 — Blood Pressure & Pulse</h2>

          </div>

          ${p.bpAt ? `<span class="saved-label">${icon('check', 'sm')} Last recorded: ${p.bpSystolic}/${p.bpDiastolic} mmHg ${p.pulseBpm ? `• Pulse: ${p.pulseBpm} BPM` : ''} by ${esc(p.bpBy || 'Staff')}</span>` : ''}

        </div>



        <div class="field-grid three-col" style="margin-bottom:14px;">

          ${numericFieldHtml('bpSys', 'Systolic BP (mmHg) *', 'e.g. 120')}

          ${numericFieldHtml('bpDia', 'Diastolic BP (mmHg) *', 'e.g. 80')}

          ${numericFieldHtml('bpPulse', 'Pulse Rate (BPM) *', 'e.g. 72')}

        </div>







        <div class="save-action-bar">

          <button class="btn primary save-btn-large" type="button" id="save-counter-btn" ${state.isSubmitting ? 'disabled' : ''}>

            ${icon('check', 'sm')} Save Blood Pressure & Pulse

          </button>

        </div>

      </section>

    </div>

  `;

}



function counter2SugarHtml() {

  const p = state.participant;

  if (!p) return tokenEntryHtml(COUNTERS_CONFIG[1]);



  return `

    <div class="form-wrap">

      ${participantBannerHtml(p)}



      <section class="panel station-panel">

        <div class="station-panel-header">

          <div>

            <h2>Counter 2 — Blood Sugar</h2>

          </div>

          ${p.sugarAt ? `<span class="saved-label">${icon('check', 'sm')} Last recorded: ${p.bloodSugar} mg/dL (${p.sugarType}) by ${esc(p.sugarBy || 'Staff')}</span>` : ''}

        </div>



        <div style="margin-bottom:16px;">

          ${numericFieldHtml('sugarVal', 'Blood Sugar Reading (mg/dL) *', 'e.g. 110')}

        </div>



        <div class="field" style="margin-bottom:16px;">

          <span class="label-text">Select Test Type <em>*</em></span>

          <div class="test-options">

            ${['Fasting', 'Random', 'Post-meal'].map(t => `

              <label class="choice">

                <input type="radio" name="sugarTestType" value="${t}" ${state.sugarType === t ? 'checked' : ''} />

                <span>${t}</span>

              </label>

            `).join('')}

          </div>

        </div>







        <div class="save-action-bar">

          <button class="btn primary save-btn-large" type="button" id="save-counter-btn" ${state.isSubmitting ? 'disabled' : ''}>

            ${icon('check', 'sm')} Save Blood Sugar Reading

          </button>

        </div>

      </section>

    </div>

  `;

}



function counter3BmiHtml() {

  const p = state.participant;

  if (!p) return tokenEntryHtml(COUNTERS_CONFIG[2]);



  return `

    <div class="form-wrap">

      ${participantBannerHtml(p)}



      <section class="panel station-panel">

        <div class="station-panel-header">

          <div>

            <h2>Counter 3 — Height, Weight & BMI</h2>

          </div>

          ${p.measurementsAt ? `<span class="saved-label">${icon('check', 'sm')} Last recorded: ${p.height}cm / ${p.weight}kg (BMI: ${p.bmi})</span>` : ''}

        </div>



        <div class="field-grid" style="margin-bottom:14px;">

          ${numericFieldHtml('measHeight', 'Height (cm) *', 'e.g. 165')}

          ${numericFieldHtml('measWeight', 'Weight (kg) *', 'e.g. 66')}

        </div>



        <div class="result-box spaced" id="live-bmi-box" style="margin-bottom:14px;">

          <div>

            <span>Calculated Body Mass Index (BMI)</span>

          </div>

          <div style="text-align:right;">

            <strong id="live-bmi-val">${p.bmi || '—'}</strong>

            <small id="live-bmi-cat">${getBmiCategory(p.bmi)}</small>

          </div>

        </div>







        <div class="save-action-bar">

          <button class="btn primary save-btn-large" type="button" id="save-counter-btn" ${state.isSubmitting ? 'disabled' : ''}>

            ${icon('check', 'sm')} Save BMI & Measurements

          </button>

        </div>

      </section>

    </div>

  `;

}



function medicalHistoryHtml(history) {

  const selected = history?.length ? HISTORY_OPTIONS.filter(option => history.includes(option.id)) : [{ label: 'History not recorded', tone: 'unknown' }];

  return `<section class="history-summary" aria-label="Reported medical history">

    <h3>Reported medical history</h3>

    <div class="health-badges">${selected.map(option => `<span class="health-badge ${option.tone}">${esc(option.label)}</span>`).join('')}</div>

  </section>`;

}



function readingTone(flag, type) {

  return flag.status === 'normal' ? 'normal' : ['pending', 'review'].includes(flag.status) ? 'unknown' : type;

}



function readingFlagHtml(flag, type) {

  return `<span class="health-badge ${readingTone(flag, type)}">${esc(flag.label)}</span>`;

}



async function loadDashboard() {

  try {

    const result = await call('dashboard.stats');

    if (result?.ok) state.dashboard = result;

  } catch { state.dashboard = null; }

}



function janabDashboardHtml() {

  const data = state.dashboard;

  if (!data) return `<section class="panel panel-pad"><h1>Janab Dashboard</h1><p>Dashboard could not be loaded.</p><button class="btn primary" id="dashboard-refresh">Retry</button></section>`;

  const colors = { bp: '#b62e3d', sugar: '#2463b5', both: '#7856ad', none: '#197451', unknown: '#82908a' };

  let degrees = 0;

  const slices = data.history.map(item => {

    const start = degrees;

    degrees += data.total ? item.count / data.total * 360 : 0;

    return `${colors[item.id]} ${start}deg ${degrees}deg`;

  });

  const series = data.registrations;

  const maximum = Math.max(1, ...series.map(item => item.count));

  const points = series.map((item, index) => ({ ...item, x: series.length === 1 ? 300 : 48 + index / (series.length - 1) * 504, y: 190 - item.count / maximum * 150 }));

  return `<div class="janab-dashboard">

    <div class="page-head"><div><span class="eyebrow">Ratangarh Amil Saheb</span><h1>Janab Dashboard</h1><p>Camp overview &middot; Read only</p></div><button type="button" class="btn secondary" id="dashboard-refresh">${icon('refresh', 'sm')} Refresh</button></div>

    <div class="metric-grid janab-metrics">

      <div class="metric"><span>Total participants</span><strong>${data.total}</strong></div>

      <div class="metric bp"><span>Flagged BP readings</span><strong>${data.readings.bpFlagged}</strong><small>of ${data.readings.bpRecorded} measured</small></div>

      <div class="metric sugar"><span>Flagged sugar readings</span><strong>${data.readings.sugarFlagged}</strong><small>of ${data.readings.sugarRecorded} measured</small></div>

      <div class="metric"><span>Doctor consultations</span><strong>${data.readings.doctorCompleted}</strong></div>

    </div>

    <div class="dashboard-charts">

      <section class="panel panel-pad"><h2>Reported health history</h2><p class="reading-note">Each participant is counted once. History is self-reported.</p>

        <div class="history-pie" role="img" aria-label="Medical history distribution for ${data.total} participants; counts are listed below" style="background:${data.total ? `conic-gradient(${slices.join(',')})` : '#e7ece8'}"><div><strong>${data.total}</strong><span>participants</span></div></div>

        <ul class="chart-legend">${data.history.map(item => `<li><span class="legend-swatch" style="background:${colors[item.id]}"></span><span>${esc(item.label)}</span><strong>${item.count}</strong></li>`).join('')}</ul>

      </section>

      <section class="panel panel-pad"><h2>Registrations by day</h2><p class="reading-note">Daily registrations &middot; India time</p>

        ${series.length ? `<svg class="registration-chart" viewBox="0 0 600 240" role="img" aria-label="Daily participant registrations; date and count details follow">

          <path d="M48 30 V190 H570" fill="none" stroke="#cbd9d0" />

          <text x="38" y="44" text-anchor="end">${maximum}</text><text x="38" y="194" text-anchor="end">0</text>

          <polyline points="${points.map(point => `${point.x},${point.y}`).join(' ')}" fill="none" stroke="#197451" stroke-width="3" />

          ${points.map(point => `<circle cx="${point.x}" cy="${point.y}" r="5" fill="#197451"><title>${esc(point.date)}: ${point.count} participants</title></circle>`).join('')}



        </svg><div class="chart-dates"><span>${esc(series[0].date)}</span><span>${series.length > 1 ? esc(series.at(-1).date) : ''}</span></div><details class="chart-data"><summary>View daily counts</summary><ul>${series.map(item => `<li><span>${esc(item.date)}</span><strong>${item.count}</strong></li>`).join('')}</ul></details>` : '<p>No registrations yet.</p>'}

        <div class="dashboard-note">Reading flags are screening observations, not confirmed diagnoses. Post-meal results need timing and clinical review.</div>

      </section>

    </div>

  </div>`;

}



function counter4DoctorHtml() {

  const p = state.participant;

  if (!p) return tokenEntryHtml(COUNTERS_CONFIG[3]);



  const flags = getReadingFlags(p);

  return `

    <div class="form-wrap">

      ${participantBannerHtml(p)}

      ${medicalHistoryHtml(p.medicalHistory)}

      <h3 class="reading-heading">Today's screening readings</h3>

      <p class="reading-note">Screening flags only. Confirm readings and assess clinical context.</p>



      <div class="summary-grid">

        <div class="summary-item reading-card ${readingTone(flags.bp, 'bp')}">

          ${readingFlagHtml(flags.bp, 'bp')}

          <small>COUNTER 1 — BLOOD PRESSURE & PULSE</small>

          <strong>${p.bpSystolic && p.bpDiastolic ? `${p.bpSystolic} / ${p.bpDiastolic} mmHg ${p.pulseBpm ? `• Pulse: ${p.pulseBpm} BPM` : ''}` : 'Pending Check'}</strong>

          <span>${p.bpAt ? `Recorded by ${p.bpBy || 'Staff'}` : 'Not recorded'}</span>

        </div>

        <div class="summary-item reading-card ${readingTone(flags.sugar, 'sugar')}">

          ${readingFlagHtml(flags.sugar, 'sugar')}

          <small>COUNTER 2 — BLOOD SUGAR</small>

          <strong>${p.bloodSugar ? `${p.bloodSugar} mg/dL (${p.sugarType || 'Random'})` : 'Pending Check'}</strong>

          <span>${p.sugarAt ? `Recorded by ${p.sugarBy || 'Staff'}` : 'Not recorded'}</span>

        </div>

        <div class="summary-item">

          <small>COUNTER 3 — HEIGHT & WEIGHT</small>

          <strong>${p.height ? `${p.height} cm` : '—'} / ${p.weight ? `${p.weight} kg` : '—'}</strong>

          <span>${p.measurementsAt ? `Recorded by ${p.measurementsBy || 'Staff'}` : 'Not recorded'}</span>

        </div>

        <div class="summary-item">

          <small>COUNTER 3 — CALCULATED BMI</small>

          <strong>${p.bmi ? `${p.bmi} kg/m²` : '—'}</strong>

          <span>${p.bmi ? getBmiCategory(p.bmi) : 'Not recorded'}</span>

        </div>

      </div>



      <section class="panel station-panel">

        <div class="station-panel-header">

          <div>

            <h2>Doctor Consultation & Prescription</h2>

          </div>

          ${p.doctorAt ? `<span class="saved-label">${icon('check', 'sm')} Saved by ${esc(p.doctorBy || 'Doctor')}</span>` : ''}

        </div>



        <div class="field" style="margin-bottom:18px;">

          <label for="doctor-prescription-input">Doctor's Clinical Notes / Prescription <em>*</em></label>

          <textarea class="control textarea" id="doctor-prescription-input" rows="5" placeholder="Enter clinical assessment, prescription drugs, dietary guidelines, or referral notes..." required>${esc(state.fields.doctorAdvice ?? p.advice ?? '')}</textarea>

        </div>



        <div class="save-action-bar">

          <span class="tiny">${icon('shield', 'sm')} Confidential consultation notes</span>

          <button class="btn secondary" type="button" id="doctor-print-btn" ${state.isSubmitting ? 'disabled' : ''}>Save &amp; Print Full Report</button>

          <button class="btn primary save-btn-large" type="button" id="save-counter-btn" ${state.isSubmitting ? 'disabled' : ''}>

            ${icon('check', 'sm')} Save Doctor's Advice & Reset

          </button>

        </div>

      </section>

    </div>

  `;

}



// -------------------------------------------------------------

// REGISTRATION DESK (SEPARATE MODULE)

// -------------------------------------------------------------

function registrationSuccessViewHtml() {

  const reg = state.regSuccess;

  const p = reg?.data || {};

  const tokenDisplay = reg?.tokenFormatted || p.tokenFormatted || String(reg?.token || p.token || '').padStart(3, '0');



  return `

    <div class="form-wrap token-success-wrap">

      <div class="panel form-panel token-success-card">

        <div class="token-success-header">

          <div class="token-success-badge-pill">

            ${icon('check', 'sm')}

            <span>REGISTRATION SUCCESSFUL</span>

          </div>

          <h2>Token Allocated Successfully</h2>

          <p class="token-success-sub">Share the Token Number with the participant to proceed to screening counters.</p>

        </div>



        <div class="token-hero-box">

          <div class="token-hero-label">TOKEN NO</div>

          <div class="token-hero-number">${esc(tokenDisplay)}</div>

          <div class="token-hero-serial">${esc(p.serial || '')}</div>

        </div>



        <div class="token-summary-grid">

          <div class="token-summary-item">

            <span class="summary-label">Participant Name</span>

            <strong class="summary-value">${esc(p.name || '')}</strong>

          </div>

          <div class="token-summary-item">

            <span class="summary-label">ITS Number</span>

            <strong class="summary-value">${esc(p.its || '')}</strong>

          </div>

          <div class="token-summary-item">

            <span class="summary-label">Mobile Number</span>

            <strong class="summary-value">${esc(p.phone || '')}</strong>

          </div>

          <div class="token-summary-item">

            <span class="summary-label">Age & Gender</span>

            <strong class="summary-value">${esc(p.age || '')} yrs &bull; ${esc(p.gender || '')}</strong>

          </div>

        </div>



        ${medicalHistoryHtml(p.medicalHistory)}

        <div class="token-actions-cluster">

          <button type="button" class="btn primary save-btn-large" id="reg-next-btn">

            ${icon('plus', 'sm')} New Registration

          </button>

          <button type="button" class="btn secondary" id="reg-print-btn" style="min-height:56px;padding:0 24px;border-radius:14px;font-weight:700;">

            ${icon('download', 'sm')} Print Token

          </button>

          <button type="button" class="btn ghost" id="reg-view-btn" style="min-height:56px;padding:0 24px;border-radius:14px;font-weight:700;">

            ${icon('user', 'sm')} View Participant

          </button>

        </div>

      </div>

    </div>

  `;

}



function printableMedicalReportHtml() {
  const p = state.participant;
  if (!p || state.page !== 'counter' || state.activeCounter !== 'doctor') return '';
  const flags = getReadingFlags(p);
  const stamp = value => value ? new Date(value).toLocaleString('en-IN') : 'Not recorded';
  const recorded = (by,at) => `${esc(by || '—')}<br>${esc(stamp(at))}`;
  return `<article id="printable-medical-report" aria-label="Participant health screening report">
    <header class="report-header">
      <img src="/assets/umoor-sehat.png" alt="Umoor Sehat logo" width="80" height="88" />
      <div><h1>UMOOR SEHAT</h1><p>Ratangarh Kheri Jamiat Health Camp</p><h2>Health Screening &amp; Consultation Report</h2></div>
      <img src="/assets/ratangarh-kheri-jamiat.png" alt="Toloba Ratangarh Kheri logo" width="80" height="88" />
    </header>
    <dl class="report-identity">
      <div><dt>Participant</dt><dd>${esc(p.name)}</dd></div><div><dt>Token / Serial</dt><dd>#${esc(p.tokenFormatted)} / ${esc(p.serial)}</dd></div>
      <div><dt>ITS number</dt><dd>${esc(p.its)}</dd></div><div><dt>Mobile number</dt><dd>${esc(p.phone)}</dd></div>
      <div><dt>Age / Gender</dt><dd>${esc(p.age)} years / ${esc(p.gender)}</dd></div><div><dt>Consent</dt><dd>${p.consent ? 'Recorded' : 'Not recorded'}</dd></div>
      <div><dt>Registered</dt><dd>${esc(stamp(p.registeredAt))}</dd></div><div><dt>Registered by</dt><dd>${esc(p.registeredBy || '—')}</dd></div>
    </dl>
    ${medicalHistoryHtml(p.medicalHistory)}
    <h2>Screening readings</h2>
    <table class="report-readings"><thead><tr><th scope="col">Assessment</th><th scope="col">Result</th><th scope="col">Recorded by / time</th></tr></thead><tbody>
      <tr><th scope="row">Blood pressure</th><td>${p.bpSystolic && p.bpDiastolic ? `${esc(p.bpSystolic)} / ${esc(p.bpDiastolic)} mmHg` : 'Not recorded'}<br>${readingFlagHtml(flags.bp,'bp')}</td><td>${recorded(p.bpBy,p.bpAt)}</td></tr>
      <tr><th scope="row">Pulse</th><td>${p.pulseBpm ? `${esc(p.pulseBpm)} BPM` : 'Not recorded'}</td><td>${recorded(p.bpBy,p.bpAt)}</td></tr>
      <tr><th scope="row">Blood sugar</th><td>${p.bloodSugar ? `${esc(p.bloodSugar)} mg/dL (${esc(p.sugarType || 'Unspecified')})` : 'Not recorded'}<br>${readingFlagHtml(flags.sugar,'sugar')}</td><td>${recorded(p.sugarBy,p.sugarAt)}</td></tr>
      <tr><th scope="row">Height / Weight</th><td>${p.height ? `${esc(p.height)} cm` : '—'} / ${p.weight ? `${esc(p.weight)} kg` : '—'}</td><td>${recorded(p.measurementsBy,p.measurementsAt)}</td></tr>
      <tr><th scope="row">BMI</th><td>${p.bmi ? `${esc(p.bmi)} kg/m² — ${esc(getBmiCategory(p.bmi))}` : 'Not recorded'}</td><td>${recorded(p.measurementsBy,p.measurementsAt)}</td></tr>
    </tbody></table>
    <section class="report-advice"><h2>Doctor's clinical notes / prescription</h2><div class="report-prescription">${esc(p.advice || 'Not recorded')}</div><p>Doctor: ${esc(p.doctorBy || '—')} · ${esc(stamp(p.doctorAt))}</p></section>
    <p class="report-note">Screening flags support clinical review and are not a diagnosis. Medical history is self-reported.</p>
    <footer class="report-footer"><span>Confidential participant copy · Printed ${esc(stamp(new Date().toISOString()))}</span>${evolixBrandHtml()}</footer>
  </article>`;
}

async function printMedicalReport() {
  const report = document.getElementById('printable-medical-report');
  if (!report) return;
  try {
    await Promise.all([...report.querySelectorAll('img')].map(img => img.decode()));
    window.print();
  } catch {
    notify('Could not prepare the report logos. Please retry printing.',true);
  }
}

function printableSlipHtml() {

  const reg = state.regSuccess;

  const p = reg ? (reg.data || {}) : (state.participant || {});

  const tokenDisplay = reg ? (reg.tokenFormatted || p.tokenFormatted || reg.token || p.token) : (p.tokenFormatted || p.token || '---');

  const now = new Date();

  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });



  return `

    <div id="printable-token-slip" class="printable-slip">

      <div class="slip-header">

        <div class="slip-brand">UMOOR SEHAT</div>

        <div class="slip-sub">Ratangarh Kheri Jamiat Health Camp</div>

      </div>

      <div class="slip-divider"></div>

      <div class="slip-token-box">

        <span class="slip-label">PARTICIPANT TOKEN</span>

        <h1 class="slip-token-num">#${esc(tokenDisplay)}</h1>

        <div class="slip-serial">${esc(p.serial || '')}</div>

      </div>

      <div class="slip-divider"></div>

      <div class="slip-info-list">

        <div class="slip-info-row"><span>Name:</span> <strong>${esc(p.name || '—')}</strong></div>

        <div class="slip-info-row"><span>ITS:</span> <strong>${esc(p.its || '—')}</strong></div>

        <div class="slip-info-row"><span>Mobile:</span> <strong>${esc(p.phone || '—')}</strong></div>

        <div class="slip-info-row"><span>Age / Gender:</span> <strong>${esc(p.age || '—')} yrs &bull; ${esc(p.gender || '—')}</strong></div>

        <div class="slip-info-row"><span>Issued:</span> <span>${dateStr}, ${timeStr}</span></div>

      </div>

      <div class="slip-divider"></div>

      <div class="slip-counters-guide">

        <div class="slip-guide-title">CAMP SCREENING STATIONS:</div>

        <div class="slip-guide-row">1. Blood Pressure &amp; Pulse</div>

        <div class="slip-guide-row">2. Blood Sugar (RBS / FBS)</div>

        <div class="slip-guide-row">3. Height, Weight &amp; BMI</div>

        <div class="slip-guide-row">4. Doctor Consultation</div>

      </div>

      <div class="slip-footer">

        <small>Preserve this slip until all 4 counters are completed.</small>

      </div>

    </div>

  `;

}



function registrationViewHtml() {

  if (state.regSuccess) {

    return registrationSuccessViewHtml();

  }



  return `

    <div class="form-wrap">

      <div class="page-head">

        <div>

          <div class="eyebrow">Participant Registration Desk</div>

          <h1>New Registration & Token Issue</h1>

        </div>

      </div>



      ${state.regConflict ? `

        <div class="alert-banner conflict-banner">

          <div class="alert-icon-box">${icon('alert', 'md')}</div>

          <div class="alert-content">

            <h4>Participant Already Registered</h4>

            <div class="conflict-buttons">

              <button type="button" class="btn secondary sm" id="conflict-view-existing-btn">

                ${icon('user', 'sm')} View Token #${esc(state.regConflict.existing?.tokenFormatted || state.regConflict.existing?.token)} (${esc(state.regConflict.existing?.name)})

              </button>

              <button type="button" class="btn ghost sm" id="conflict-dismiss-btn">

                ${icon('close', 'sm')} Dismiss & Edit

              </button>

            </div>

          </div>

        </div>

      ` : ''}



      <section class="panel form-panel">

        <form id="standalone-reg-form">

          <div class="field" style="margin-bottom:16px;">

            <label for="reg-name-input">Participant Full Name <em>*</em></label>

            <input class="control" id="reg-name-input" type="text" placeholder="Enter full name" required maxlength="120" value="${esc(state.fields.regName || '')}" autocomplete="off" />

          </div>



          <div class="field-grid" style="margin-bottom:14px;">

            ${numericFieldHtml('regIts', '8-digit ITS Number *', 'e.g. 12345678')}

            ${numericFieldHtml('regPhone', '10-digit Mobile Number *', 'e.g. 9820012345')}

          </div>



          <div class="field-grid" style="margin-bottom:14px;">

            ${numericFieldHtml('regAge', 'Age in Years *', 'e.g. 45')}

            <div class="field">

              <span class="label-text">Gender <em>*</em></span>

              <div class="gender-options">

                <label class="choice">

                  <input type="radio" name="regGender" value="Male" ${state.regGender === 'Male' ? 'checked' : ''} />

                  <span>${icon('user', 'sm')} Male</span>

                </label>

                <label class="choice">

                  <input type="radio" name="regGender" value="Female" ${state.regGender === 'Female' ? 'checked' : ''} />

                  <span>${icon('user', 'sm')} Female</span>

                </label>

              </div>

            </div>

          </div>



          <fieldset class="history-fieldset">

            <legend>Reported medical history <em>*</em></legend>

            <div class="history-options">

              ${HISTORY_OPTIONS.map(option => `<label class="history-choice ${option.tone}">

                <input type="checkbox" name="medicalHistory" value="${option.id}" ${state.regMedicalHistory.includes(option.id) ? 'checked' : ''} />

                <span>${esc(option.label)}</span>

              </label>`).join('')}

            </div>

            <small>Select both BP and diabetes if applicable.</small>

          </fieldset>

          <div class="consent-box" style="margin:16px 0;">

            <input type="checkbox" id="reg-consent-chk" ${state.regConsent ? 'checked' : ''} required />

            <label for="reg-consent-chk">Participant has consented to participate in the screening camp.</label>

          </div>







          <div class="save-action-bar">

            <button class="btn primary save-btn-large" type="submit" id="submit-reg-btn">

              ${icon('check', 'sm')} SAVE & GENERATE TOKEN

            </button>

          </div>

        </form>

      </section>

    </div>

  `;

}



// -------------------------------------------------------------

// SUPER ADMIN CONTROL PANEL

// -------------------------------------------------------------

function adminPanelViewHtml() {

  const tab = state.adminTab;

  const sync = state.stats?.sync || {};

  const counts = state.stats?.counts || {};

  const regStats = state.stats?.registration || {};



  return `

    <div class="admin-panel-wrap">

      <div class="page-head">

        <div>

          <div class="eyebrow">Administration & Control</div>

          <h1>Super Admin Dashboard</h1>

        </div>

        <div class="head-actions">

          <button type="button" class="btn secondary" id="export-csv-btn">

            ${icon('download', 'sm')} Export Excel / CSV

          </button>

          <button type="button" class="btn secondary" id="admin-change-pass-btn">

            ${icon('key', 'sm')} Change Password

          </button>

        </div>

      </div>



      <div class="admin-tabs">

        <button type="button" class="admin-tab ${tab === 'staff' ? 'active' : ''}" data-admin-tab="staff">

          ${icon('users', 'sm')} Staff Accounts & Counters

        </button>

        <button type="button" class="admin-tab ${tab === 'registration' ? 'active' : ''}" data-admin-tab="registration">

          ${icon('plus', 'sm')} Registration Desk

        </button>

        <button type="button" class="admin-tab ${tab === 'overview' ? 'active' : ''}" data-admin-tab="overview">

          ${icon('grid', 'sm')} Camp Overview & Sync

        </button>

        <button type="button" class="admin-tab ${tab === 'audit' ? 'active' : ''}" data-admin-tab="audit">

          ${icon('clipboard', 'sm')} Counter Audit Trail

        </button>

      </div>



      ${tab === 'staff' ? `

        <section class="panel panel-pad">

          <div class="panel-head">

            <div>

              <h3>Staff Management</h3>

            </div>

            <button type="button" class="btn primary" id="open-add-staff-modal">

              ${icon('plus', 'sm')} Add New Staff Account

            </button>

          </div>



          <div class="table-responsive">

            <table class="app-table">

              <thead>

                <tr>

                  <th>Staff Name</th>

                  <th>Assigned Counters</th>

                  <th>Registration Access</th>

                  <th>Status</th>

                  <th>Last Login</th>

                  <th>Actions</th>

                </tr>

              </thead>

              <tbody>

                ${state.staffList.map(s => `

                  <tr>

                    <td><strong>${esc(s.name)}</strong></td>

                    <td>

                      <div style="display:flex;gap:4px;flex-wrap:wrap;">

                        ${s.can_view_participants ? '<span class="badge badge-info">Admin (read only)</span>' : s.can_view_dashboard ? '<span class="badge badge-info">Janab dashboard (read only)</span>' : s.counters.length ? s.counters.map(c => `

                          <span class="badge badge-role">Counter ${c === 'bp' ? '1 (BP)' : c === 'sugar' ? '2 (Sugar)' : c === 'bmi' ? '3 (BMI)' : '4 (Doctor)'}</span>

                        `).join('') : '<span class="tiny muted">None</span>'}

                      </div>

                    </td>

                    <td>

                      <span class="badge ${s.canRegister ? 'badge-success' : 'badge-role'}">

                        ${s.canRegister ? 'Yes' : 'No'}

                      </span>

                    </td>

                    <td>

                      <span class="badge ${s.is_active ? 'badge-success' : 'badge-danger'}">

                        ${s.is_active ? 'Active' : 'Disabled'}

                      </span>

                    </td>

                    <td>${s.last_login_at ? new Date(s.last_login_at).toLocaleString('en-IN') : 'Never'}</td>

                    <td>

                      <div style="display:flex;gap:6px;">

                        <button type="button" class="btn secondary sm" data-edit-staff-id="${s.id}" style="min-height:30px;padding:0 8px;">

                          Edit

                        </button>

                        <button type="button" class="btn ghost sm" data-reset-pin-id="${s.id}" data-staff-name="${esc(s.name)}" style="min-height:30px;padding:0 8px;">

                          Reset PIN

                        </button>

                        <button type="button" class="btn ${s.is_active ? 'danger' : 'secondary'} sm" data-toggle-staff-id="${s.id}" style="min-height:30px;padding:0 8px;">

                          ${s.is_active ? 'Disable' : 'Enable'}

                        </button>

                        <button type="button" class="btn danger sm" data-delete-staff-id="${s.id}" style="min-height:30px;padding:0 8px;">

                          Delete

                        </button>

                      </div>

                    </td>

                  </tr>

                `).join('')}

              </tbody>

            </table>

          </div>

        </section>

      ` : ''}



      ${tab === 'registration' ? `

        <div class="registration-dashboard-wrap">

          <div class="panel-head" style="margin-bottom:16px;">

            <div>

              <h3>Central Registration Desk Management</h3>

            </div>

            <div style="display:flex;gap:8px;">

              <button type="button" class="btn primary sm" id="admin-add-reg-staff-btn" style="min-height:36px;padding:0 12px;">

                ${icon('plus', 'sm')} Add Registration Staff

              </button>

              <button type="button" class="btn secondary sm" id="admin-refresh-reg-btn" style="min-height:36px;padding:0 12px;">

                ${icon('refresh', 'sm')} Refresh Desk Data

              </button>

            </div>

          </div>



          <div class="metric-grid" style="grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); margin-bottom:20px;">

            <div class="metric">

              <div class="metric-head"><span>Total Registered</span><span class="metric-icon">${icon('users', 'sm')}</span></div>

              <strong>${regStats.total ?? counts.registered ?? 0}</strong>

              <small>Central sequential tokens issued</small>

            </div>

            <div class="metric">

              <div class="metric-head"><span>Last Generated Token</span><span class="metric-icon">${icon('shield', 'sm')}</span></div>

              <strong style="color:var(--emerald-600);">${regStats.lastTokenFormatted || (regStats.lastToken ? String(regStats.lastToken).padStart(3, '0') : '000')}</strong>

              <small>Sequential token sequence starting at 001</small>

            </div>

            <div class="metric">

              <div class="metric-head"><span>Active Registration Staff</span><span class="metric-icon">${icon('user', 'sm')}</span></div>

              <strong>${regStats.activeStaff || 0}</strong>

              <small>Operators authorized to issue tokens</small>

            </div>

            <div class="metric">

              <div class="metric-head"><span>Duplicate ITS Blocked</span><span class="metric-icon">${icon('alert', 'sm')}</span></div>

              <strong style="color:var(--amber-600);">${(regStats.duplicateAttempts || []).length}</strong>

              <small>Duplicate registration attempts prevented</small>

            </div>

          </div>



          <div class="reg-admin-grid">

            <section class="panel panel-pad" style="margin-bottom:20px;">

              <div class="panel-head">

                <div>

                  <h4>Registration Staff Activity</h4>

                </div>

              </div>

              <div class="table-responsive">

                <table class="app-table">

                  <thead>

                    <tr>

                      <th>Operator Name</th>

                      <th>Tokens Issued</th>

                      <th>Last Active</th>

                    </tr>

                  </thead>

                  <tbody>

                    ${(regStats.staffActivity || []).length ? regStats.staffActivity.map(a => `

                      <tr>

                        <td><strong>${esc(a.operator)}</strong></td>

                        <td><span class="badge badge-success">${a.count} participants</span></td>

                        <td>${a.last_active ? new Date(a.last_active).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>

                      </tr>

                    `).join('') : `

                      <tr><td colspan="3" style="text-align:center;padding:16px;color:#8ba093;">No operator activity recorded yet.</td></tr>

                    `}

                  </tbody>

                </table>

              </div>

            </section>



            <section class="panel panel-pad" style="margin-bottom:20px;">

              <div class="panel-head">

                <div>

                  <h4>Duplicate ITS Blocked Log</h4>

                </div>

              </div>

              <div class="table-responsive">

                <table class="app-table">

                  <thead>

                    <tr>

                      <th>Timestamp</th>

                      <th>Operator</th>

                      <th>Attempted ITS</th>

                      <th>Existing Token & Name</th>

                      <th>Result</th>

                    </tr>

                  </thead>

                  <tbody>

                    ${(regStats.duplicateAttempts || []).length ? regStats.duplicateAttempts.map(d => `

                      <tr>

                        <td class="nowrap">${new Date(d.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>

                        <td><strong>${esc(d.operator)}</strong></td>

                        <td><code>${esc(d.its)}</code></td>

                        <td>Token #${esc(d.existingToken)} (${esc(d.existingName)})</td>

                        <td><span class="badge badge-danger">Blocked</span></td>

                      </tr>

                    `).join('') : `

                      <tr><td colspan="5" style="text-align:center;padding:16px;color:#8ba093;">Zero duplicate ITS attempts recorded.</td></tr>

                    `}

                  </tbody>

                </table>

              </div>

            </section>

          </div>



          <section class="panel panel-pad">

            <div class="panel-head">

              <div>

                <h4>Recent Registrations</h4>

              </div>

            </div>

            <div class="table-responsive">

              <table class="app-table">

                <thead>

                  <tr>

                    <th>Token No.</th>

                    <th>Serial</th>

                    <th>Participant Name</th>

                    <th>ITS Number</th>

                    <th>Mobile</th>

                    <th>Age / Gender</th>

                    <th>Registered By</th>

                    <th>Registered At</th>

                  </tr>

                </thead>

                <tbody>

                  ${(regStats.recent || []).length ? regStats.recent.map(r => `

                    <tr>

                      <td><span class="token-tag">#${esc(r.tokenFormatted || r.token)}</span></td>

                      <td>${esc(r.serial)}</td>

                      <td><strong>${esc(r.name)}</strong></td>

                      <td><code>${esc(r.its)}</code></td>

                      <td>${esc(r.phone)}</td>

                      <td>${esc(r.age)} yrs &bull; ${esc(r.gender)}</td>

                      <td>${esc(r.registered_by || '—')}</td>

                      <td class="nowrap">${new Date(r.registered_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>

                    </tr>

                  `).join('') : `

                    <tr><td colspan="8" style="text-align:center;padding:20px;color:#8ba093;">No registrations yet.</td></tr>

                  `}

                </tbody>

              </table>

            </div>

          </section>

        </div>

      ` : ''}



      ${tab === 'overview' ? `

        <div class="sync-status-card">

          <div class="sync-status-info">

            <strong>Google Sheets Synchronization</strong>

            <small>${sync.isConfigured ? 'Connected to live Google Sheet destination.' : 'Google Sheets not connected. Operating on local fast database.'}</small>

          </div>

          <div class="sync-pills">

            <span class="badge badge-success">Synced: ${sync.synced || 0}</span>

            <span class="badge badge-warning">Pending: ${sync.pending || 0}</span>

            ${sync.failed ? `<span class="badge badge-danger">Failed: ${sync.failed}</span>` : ''}

            <button type="button" class="btn primary sm" id="trigger-sync-btn" style="min-height:36px;padding:0 14px;">

              ${icon('refresh', 'sm')} Sync with Sheets Now

            </button>

          </div>

        </div>



        <div class="metric-grid">

          <div class="metric">

            <div class="metric-head"><span>Registered</span><span class="metric-icon">${icon('users', 'sm')}</span></div>

            <strong>${counts.registered || 0}</strong>

            <small>Total tokens issued</small>

          </div>

          <div class="metric">

            <div class="metric-head"><span>Counter 1 (BP)</span><span class="metric-icon">${icon('heart', 'sm')}</span></div>

            <strong>${counts.bp || 0}</strong>

            <small>Participants completed</small>

          </div>

          <div class="metric">

            <div class="metric-head"><span>Counter 2 (Sugar)</span><span class="metric-icon">${icon('droplet', 'sm')}</span></div>

            <strong>${counts.sugar || 0}</strong>

            <small>Participants completed</small>

          </div>

          <div class="metric">

            <div class="metric-head"><span>Counter 3 (BMI)</span><span class="metric-icon">${icon('ruler', 'sm')}</span></div>

            <strong>${counts.bmi || 0}</strong>

            <small>Participants completed</small>

          </div>

          <div class="metric">

            <div class="metric-head"><span>Counter 4 (Doctor)</span><span class="metric-icon">${icon('clipboard', 'sm')}</span></div>

            <strong>${counts.doctor || 0}</strong>

            <small>Consultations completed</small>

          </div>

        </div>

      ` : ''}



      ${tab === 'audit' ? `

        <section class="panel panel-pad">

          <div class="panel-head">

            <div>

              <h3>Counter Audit Trail</h3>

            </div>

            <button type="button" class="btn secondary sm" id="refresh-audit-btn" style="min-height:36px;padding:0 12px;">

              ${icon('refresh', 'sm')} Refresh

            </button>

          </div>



          <div class="table-responsive">

            <table class="app-table">

              <thead>

                <tr>

                  <th>Timestamp</th>

                  <th>Actor</th>

                  <th>Action</th>

                  <th>Target</th>

                  <th>Details</th>

                </tr>

              </thead>

              <tbody>

                ${state.auditLogs.map(l => `

                  <tr>

                    <td class="nowrap">${new Date(l.timestamp).toLocaleString('en-IN')}</td>

                    <td><strong>${esc(l.actor_name)}</strong></td>

                    <td><span class="badge badge-info">${esc(l.action)}</span></td>

                    <td>${esc(l.target_id || '—')}</td>

                    <td><small>${esc(l.details || '—')}</small></td>

                  </tr>

                `).join('')}

              </tbody>

            </table>

          </div>

        </section>

      ` : ''}

    </div>

  `;

}



// -------------------------------------------------------------

// MODALS

// -------------------------------------------------------------

function participantsViewHtml() {
  const directory = state.directory;
  const start = directory.total ? directory.offset + 1 : 0;
  return `<div class="participant-directory form-wrap">
    <div class="page-head"><div><span class="eyebrow">Camp records</span><h1>Participants</h1><p>${state.user?.type === 'admin' ? 'View and correct participant records.' : 'View participant records. Read-only access.'}</p></div></div>
    <form id="participant-search-form" class="participant-search panel panel-pad">
      <div class="field"><label for="participant-search-input">Search by token, ITS, name, or phone</label><input id="participant-search-input" class="control" type="search" value="${esc(directory.query)}" maxlength="120" /></div>
      <button type="submit" class="btn primary">${icon('search','sm')} Search</button>
      <button type="button" class="btn secondary" id="participant-list-refresh">${icon('refresh','sm')} Refresh</button>
    </form>
    <p class="reading-note" role="status">${directory.error ? esc(directory.error) : `${directory.total} registered participants &middot; Showing ${start}-${Math.min(directory.offset+20,directory.total)}`}</p>
    <div class="participant-list">${directory.participants.map(p=>`<article class="panel participant-row">
      <span class="token-tag">#${esc(p.tokenFormatted)}</span><div class="participant-row-details"><h2>${esc(p.name)}</h2><p>ITS ${esc(p.its)} &middot; ${esc(p.age)} yrs &middot; ${esc(p.gender)}</p><p>${esc(p.phone)}</p></div>
      <button type="button" class="btn secondary" data-view-participant="${esc(p.id)}">View details</button>
    </article>`).join('') || '<div class="panel panel-pad">No matching participants.</div>'}</div>
    <div class="participant-pagination"><button type="button" class="btn secondary" id="participant-prev" ${directory.offset===0 ? 'disabled' : ''}>Previous</button><button type="button" class="btn secondary" id="participant-next" ${directory.offset+20>=directory.total ? 'disabled' : ''}>Next</button></div>
  </div>`;
}

async function loadDirectory() {
  try {
    const result=await call('participant.list',{}, {query:state.directory.query,offset:state.directory.offset,limit:20});
    if(result?.ok) state.directory={...state.directory,...result,error:''};
  } catch { state.directory={...state.directory,participants:[],total:0,error:'Could not load participant records. Please retry.'}; }
}

function participantEditorHtml(p) {
  const input=(key,label,numeric=false,maxlength='')=>`<div class="field"><label for="edit-p-${key}">${label}</label><input class="control" id="edit-p-${key}" data-edit-field="${key}" type="text" ${numeric ? `inputmode="${['height','weight','bloodSugar'].includes(key) ? 'decimal' : 'numeric'}"` : ''} ${maxlength ? `maxlength="${maxlength}"` : ''} value="${esc(p[key] ?? '')}" /></div>`;
  return `<div class="modal-backdrop"><div class="modal-box large" role="dialog" aria-modal="true" aria-labelledby="participant-edit-title">
    <div class="modal-head"><h3 id="participant-edit-title">Edit participant #${esc(p.tokenFormatted)}</h3><button type="button" class="close-modal-btn" aria-label="Close editor">${icon('close')}</button></div>
    <form id="participant-edit-form" class="participant-editor">
      <div class="modal-body">
        <p class="reading-note">Token and serial stay fixed. Existing readings cannot be cleared here.</p>
        <fieldset><legend>Registration details</legend><div class="field-grid">
          ${input('name','Full name',false,120)}${input('its','ITS number',true,8)}${input('phone','Mobile number',true,10)}${input('age','Age',true,3)}
          <div class="field"><label for="edit-p-gender">Gender</label><select class="control" id="edit-p-gender" data-edit-field="gender">${['Male','Female'].map(value=>`<option ${p.gender===value ? 'selected' : ''}>${value}</option>`).join('')}</select></div>
        </div></fieldset>
        <fieldset class="history-fieldset"><legend>Reported medical history</legend><div class="history-options">${HISTORY_OPTIONS.map(option=>`<label class="history-choice ${option.tone}"><input type="checkbox" name="editMedicalHistory" value="${option.id}" ${p.medicalHistory?.includes(option.id) ? 'checked' : ''} /><span>${esc(option.label)}</span></label>`).join('')}</div>${!p.medicalHistory ? '<small>History was not recorded. Leave unchanged or choose a reported history.</small>' : ''}</fieldset>
        <fieldset><legend>Blood pressure and pulse</legend><div class="field-grid">${input('bpSystolic','Systolic BP (mmHg)',true)}${input('bpDiastolic','Diastolic BP (mmHg)',true)}${input('pulseBpm','Pulse (BPM)',true)}</div></fieldset>
        <fieldset><legend>Blood sugar</legend><div class="field-grid">${input('bloodSugar','Blood sugar (mg/dL)',true)}<div class="field"><label for="edit-p-sugarType">Test type</label><select class="control" id="edit-p-sugarType" data-edit-field="sugarType"><option value="">Not recorded</option>${['Fasting','Random','Post-meal'].map(value=>`<option ${p.sugarType===value ? 'selected' : ''}>${value}</option>`).join('')}</select></div></div></fieldset>
        <fieldset><legend>Measurements</legend><div class="field-grid">${input('height','Height (cm)',true)}${input('weight','Weight (kg)',true)}</div><small>BMI is recalculated when measurements change.</small></fieldset>
        <div class="field"><label for="edit-p-advice">Doctor advice / prescription</label><textarea class="control textarea" id="edit-p-advice" data-edit-field="advice" maxlength="4000">${esc(p.advice || '')}</textarea></div>
      </div>
      <div class="modal-foot"><button type="button" class="btn secondary" id="participant-edit-cancel">Cancel</button><button class="btn primary" type="submit" id="participant-edit-save">Save changes</button></div>
    </form>
  </div></div>`;
}

function modalHtml() {
  if (state.modal === 'edit_participant') return participantEditorHtml(state.modalData);

  if (!state.modal) return '';



  if (state.modal === 'fallback_search') {

    return `

      <div class="modal-backdrop">

        <div class="modal-box large">

          <div class="modal-head">

            <h3>Find Participant by ITS or Name</h3>

            <button type="button" class="close-modal-btn">${icon('close')}</button>

          </div>

          <div class="modal-body">

            <div class="field">

              <label for="fallback-query-input">Enter 8-digit ITS or Name</label>

              <input class="control" id="fallback-query-input" placeholder="Type name or ITS number..." value="${esc(state.fallbackQuery)}" autofocus />

            </div>



            <div class="table-responsive" style="max-height:280px;overflow-y:auto;">

              <table class="app-table">

                <thead>

                  <tr>

                    <th>Token #</th>

                    <th>Serial</th>

                    <th>Name</th>

                    <th>ITS</th>

                    <th>Age/Gender</th>

                    <th>Action</th>

                  </tr>

                </thead>

                <tbody>

                  ${state.fallbackResults.length ? state.fallbackResults.map(r => `

                    <tr>

                      <td><span class="token-tag">#${esc(String(r.token).padStart(3, '0'))}</span></td>

                      <td>${esc(r.serial)}</td>

                      <td><strong>${esc(r.name)}</strong></td>

                      <td>${esc(r.its)}</td>

                      <td>${esc(r.age)} yrs / ${esc(r.gender)}</td>

                      <td>

                        <button type="button" class="btn primary sm" data-pick-token="${esc(String(r.token).padStart(3, '0'))}" style="min-height:30px;padding:0 10px;">

                          Select Token #${esc(String(r.token).padStart(3, '0'))}

                        </button>

                      </td>

                    </tr>

                  `).join('') : `

                    <tr><td colspan="6" style="text-align:center;padding:20px;color:#8ba093;">Type above to search...</td></tr>

                  `}

                </tbody>

              </table>

            </div>

          </div>

          <div class="modal-foot">

            <button type="button" class="btn secondary close-modal-btn">Close</button>

          </div>

        </div>

      </div>

    `;

  }



  if (state.modal === 'add_staff') {

    return `

      <div class="modal-backdrop">

        <div class="modal-box">

          <div class="modal-head">

            <h3>Create New Staff Account</h3>

            <button type="button" class="close-modal-btn">${icon('close')}</button>

          </div>

          <form id="admin-add-staff-form">
            <label class="perm-check-item admin-role-choice"><input type="checkbox" id="assign-participant-view" /><span><b>Admin</b> - view all participant records (read only)</span></label>

            <div class="modal-body">

              <div class="field">

                <label for="new-staff-name">Staff Name <em>*</em></label>

                <input class="control" id="new-staff-name" placeholder="e.g. Murtaza" required maxlength="80" />

              </div>

              <div class="field">

                <label for="new-staff-pin">4-digit PIN <em>*</em></label>

                <input class="control" id="new-staff-pin" type="text" inputmode="numeric" maxlength="4" value="5253" required />

              </div>



              <div style="margin-top:10px;">

                <label class="label-text">Assign Counters <em>*</em></label>

                <div class="perm-grid" style="margin-top:8px;">

                  <label class="perm-check-item">

                    <input type="checkbox" name="assignCounter" value="bp" />

                    <span><b>Counter 1</b> — Blood Pressure</span>

                  </label>

                  <label class="perm-check-item">

                    <input type="checkbox" name="assignCounter" value="sugar" />

                    <span><b>Counter 2</b> — Blood Sugar</span>

                  </label>

                  <label class="perm-check-item">

                    <input type="checkbox" name="assignCounter" value="bmi" />

                    <span><b>Counter 3</b> — BMI (Height & Weight)</span>

                  </label>

                  <label class="perm-check-item">

                    <input type="checkbox" name="assignCounter" value="doctor" />

                    <span><b>Counter 4</b> — Doctor Consultation</span>

                  </label>

                </div>

              </div>



              <div style="margin-top:8px;">

                <label class="label-text">Separate Desk Access</label>

                <label class="perm-check-item" style="margin-top:6px;">

                  <input type="checkbox" id="assign-can-register" />

                  <span><b>Registration Desk</b> (Issue participant tokens)</span>

                </label>

              </div>

            </div>

            <div class="modal-foot">

              <button type="button" class="btn secondary close-modal-btn">Cancel</button>

              <button class="btn primary" type="submit">Create Staff Account</button>

            </div>

          </form>

        </div>

      </div>

    `;

  }



  if (state.modal === 'reset_pin') {

    return `

      <div class="modal-backdrop">

        <div class="modal-box">

          <div class="modal-head">

            <h3>Reset PIN for Staff Member (${esc(state.modalData?.name)})</h3>

            <button type="button" class="close-modal-btn">${icon('close')}</button>

          </div>

          <form id="admin-reset-pin-form">

            <div class="modal-body">

              <div class="field">

                <label for="reset-pin-val">New 4-digit PIN <em>*</em></label>

                <input class="control" id="reset-pin-val" type="text" inputmode="numeric" maxlength="4" placeholder="e.g. 5253" required autofocus />

              </div>

            </div>

            <div class="modal-foot">

              <button type="button" class="btn secondary close-modal-btn">Cancel</button>

              <button class="btn primary" type="submit">Update PIN</button>

            </div>

          </form>

        </div>

      </div>

    `;

  }



  if (state.modal === 'change_password') {

    return `

      <div class="modal-backdrop">

        <div class="modal-box">

          <div class="modal-head">

            <h3>Change Super Admin Password</h3>

            ${!state.user?.mustChangePassword ? `<button type="button" class="close-modal-btn">${icon('close')}</button>` : ''}

          </div>

          <form id="admin-change-pass-form">

            <div class="modal-body">

              ${state.user?.mustChangePassword ? `

                <div class="login-warning">

                  ${icon('alert', 'sm')} <b>First Login Security:</b> Please change the initial Super Admin password before accessing camp controls.

                </div>

              ` : ''}

              <div class="field">

                <label for="curr-pass-input">Current Password <em>*</em></label>

                <input class="control" id="curr-pass-input" type="password" autocomplete="current-password" required />

              </div>

              <div class="field">

                <label for="new-pass-input">New Password (Min 8 Characters) <em>*</em></label>

                <input class="control" id="new-pass-input" type="password" autocomplete="new-password" minlength="8" required />

              </div>

              <div class="field">

                <label for="conf-pass-input">Confirm New Password <em>*</em></label>

                <input class="control" id="conf-pass-input" type="password" autocomplete="new-password" minlength="8" required />

              </div>

            </div>

            <div class="modal-foot">

              <button class="btn primary" type="submit">Update Password & Continue</button>

            </div>

          </form>

        </div>

      </div>

    `;

  }



  if (state.modal === 'edit_staff') {

    const s = state.modalData || {};

    return `

      <div class="modal-backdrop">

        <div class="modal-box">

          <div class="modal-head">

            <h3>Edit Staff Account (${esc(s.name)})</h3>

            <button type="button" class="close-modal-btn">${icon('close')}</button>

          </div>

          <form id="admin-edit-staff-form">
            <label class="perm-check-item admin-role-choice"><input type="checkbox" id="edit-participant-view" ${s.can_view_participants ? 'checked' : ''} ${s.can_view_dashboard ? 'disabled' : ''} /><span><b>Admin</b> - view all participant records (read only)</span></label>

            <div class="modal-body">

              <div class="field">

                <label for="edit-staff-name">Staff Name <em>*</em></label>

                <input class="control" id="edit-staff-name" value="${esc(s.name || '')}" required maxlength="80" />

              </div>



              <div style="margin-top:10px;">

                <label class="label-text">Assign Counters</label>

                <div class="perm-grid" style="margin-top:8px;">

                  <label class="perm-check-item">

                    <input type="checkbox" name="editAssignCounter" value="bp" ${(s.counters || []).includes('bp') ? 'checked' : ''} />

                    <span><b>Counter 1</b> — Blood Pressure</span>

                  </label>

                  <label class="perm-check-item">

                    <input type="checkbox" name="editAssignCounter" value="sugar" ${(s.counters || []).includes('sugar') ? 'checked' : ''} />

                    <span><b>Counter 2</b> — Blood Sugar</span>

                  </label>

                  <label class="perm-check-item">

                    <input type="checkbox" name="editAssignCounter" value="bmi" ${(s.counters || []).includes('bmi') ? 'checked' : ''} />

                    <span><b>Counter 3</b> — BMI (Height & Weight)</span>

                  </label>

                  <label class="perm-check-item">

                    <input type="checkbox" name="editAssignCounter" value="doctor" ${(s.counters || []).includes('doctor') ? 'checked' : ''} />

                    <span><b>Counter 4</b> — Doctor Consultation</span>

                  </label>

                </div>

              </div>



              <div style="margin-top:8px;">

                <label class="label-text">Separate Desk Access</label>

                <label class="perm-check-item" style="margin-top:6px;">

                  <input type="checkbox" id="edit-assign-can-register" ${s.canRegister ? 'checked' : ''} />

                  <span><b>Registration Desk</b> (Issue participant tokens)</span>

                </label>

              </div>

            </div>

            <div class="modal-foot">

              <button type="button" class="btn secondary close-modal-btn">Cancel</button>

              <button class="btn primary" type="submit">Save Changes</button>

            </div>

          </form>

        </div>

      </div>

    `;

  }



  if (state.modal === 'view_participant') {

    const p = state.modalData || {};

    return `

      <div class="modal-backdrop">

        <div class="modal-box large" role="dialog" aria-modal="true" aria-labelledby="participant-detail-title">

          <div class="modal-head">

            <div>

              <span class="eyebrow">Participant Identity</span>

              <h3 id="participant-detail-title">Token #${esc(p.tokenFormatted || p.token)} (${esc(p.serial)})</h3>

            </div>

            <button type="button" class="close-modal-btn" aria-label="Close participant details">${icon('close')}</button>

          </div>

          <div class="modal-body">

            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-bottom:16px;">

              <div class="panel" style="padding:12px;background:#f9fcfb;">

                <span class="tiny muted" style="display:block;">Full Name</span>

                <strong style="font-size:16px;">${esc(p.name)}</strong>

              </div>

              <div class="panel" style="padding:12px;background:#f9fcfb;">

                <span class="tiny muted" style="display:block;">ITS Number</span>

                <strong style="font-size:16px;">${esc(p.its)}</strong>

              </div>

              <div class="panel" style="padding:12px;background:#f9fcfb;">

                <span class="tiny muted" style="display:block;">Mobile Number</span>

                <strong style="font-size:16px;">${esc(p.phone)}</strong>

              </div>

              <div class="panel" style="padding:12px;background:#f9fcfb;">

                <span class="tiny muted" style="display:block;">Demographics</span>

                <strong style="font-size:16px;">${esc(p.age)} yrs &bull; ${esc(p.gender)}</strong>

              </div>

            </div>



            <dl class="participant-metadata"><div><dt>Registered</dt><dd>${esc(p.registeredAt ? new Date(p.registeredAt).toLocaleString('en-IN') : 'Not recorded')}</dd></div><div><dt>Registered by</dt><dd>${esc(p.registeredBy || 'Not recorded')}</dd></div><div><dt>Consent</dt><dd>${p.consent ? 'Given' : 'Not given'}</dd></div><div><dt>Last updated</dt><dd>${esc(p.updatedAt ? new Date(p.updatedAt).toLocaleString('en-IN') : 'Not recorded')}</dd></div></dl>
            ${medicalHistoryHtml(p.medicalHistory)}

            <h4 style="margin:16px 0 10px;font-size:14px;color:#163b2f;">Health Screening Counter Status</h4>

            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:10px;">

              <div class="panel" style="padding:12px;background:#f9fcfb;">

                <div class="tiny muted">Counter 1 — BP & Pulse</div>

                <strong>${p.bpSystolic ? `${p.bpSystolic}/${p.bpDiastolic} mmHg (Pulse: ${p.pulseBpm || '—'} bpm)` : '<span class="muted">Pending</span>'}</strong>

                ${p.bpBy ? `<div class="tiny muted">By ${esc(p.bpBy)} &middot; ${esc(p.bpAt ? new Date(p.bpAt).toLocaleString('en-IN') : '')}</div>` : ''}

              </div>

              <div class="panel" style="padding:12px;background:#f9fcfb;">

                <div class="tiny muted">Counter 2 — Blood Sugar</div>

                <strong>${p.bloodSugar ? `${p.bloodSugar} mg/dL (${p.sugarType || ''})` : '<span class="muted">Pending</span>'}</strong>

                ${p.sugarBy ? `<div class="tiny muted">By ${esc(p.sugarBy)} &middot; ${esc(p.sugarAt ? new Date(p.sugarAt).toLocaleString('en-IN') : '')}</div>` : ''}

              </div>

              <div class="panel" style="padding:12px;background:#f9fcfb;">

                <div class="tiny muted">Counter 3 — Height, Weight & BMI</div>

                <strong>${p.bmi ? `${p.height} cm / ${p.weight} kg (BMI: ${p.bmi})` : '<span class="muted">Pending</span>'}</strong>

                ${p.measurementsBy ? `<div class="tiny muted">By ${esc(p.measurementsBy)} &middot; ${esc(p.measurementsAt ? new Date(p.measurementsAt).toLocaleString('en-IN') : '')}</div>` : ''}

              </div>

              <div class="panel" style="padding:12px;background:#f9fcfb;">

                <div class="tiny muted">Counter 4 — Doctor Advice</div>

                <strong>${p.advice ? esc(p.advice) : '<span class="muted">Pending</span>'}</strong>

                ${p.doctorBy ? `<div class="tiny muted">By ${esc(p.doctorBy)} &middot; ${esc(p.doctorAt ? new Date(p.doctorAt).toLocaleString('en-IN') : '')}</div>` : ''}

              </div>

            </div>

          </div>

          <div class="modal-foot">

            <button type="button" class="btn secondary close-modal-btn">Close</button>

            ${state.user?.type === 'admin' ? '<button type="button" class="btn primary" id="edit-participant-btn">Edit information</button>' : ''}
            ${state.user?.type === 'admin' ? '<button type="button" class="btn danger" id="delete-participant-btn">Delete participant</button>' : ''}
            ${state.user?.type === 'admin' || COUNTERS_CONFIG.some(counter=>hasPerm(counter.perm)) ? '<button type="button" class="btn secondary" id="open-in-counter-btn">Open in Screening Counter</button>' : ''}

          </div>

        </div>

      </div>

    `;

  }



  return '';

}



// -------------------------------------------------------------

// APPLICATION SHELL

// -------------------------------------------------------------

function appShellHtml(inner) {

  const user = state.user;

  const isSuperAdmin = user?.type === 'admin';

  const assignedCounters = isSuperAdmin

    ? COUNTERS_CONFIG

    : COUNTERS_CONFIG.filter(c => (user?.counters || []).includes(c.id));

  const hasReg = isSuperAdmin || Boolean(user?.canRegister);



  return `

    <div class="app-shell" style="grid-template-columns: 1fr;">

      <div class="main">

        <header class="topbar">

          <div class="header-identity">

            <strong>UMOOR SEHAT</strong>

            <span>Organized by Ratangarh Kheri Jamiat</span>

          </div>



          <div class="top-right">

            <span class="event-pill">

              <span class="dot"></span>

              ${esc(user?.name || 'Staff')}

            </span>

            <button type="button" class="btn ghost sm" id="quick-logout-btn" title="Sign out" style="min-height:36px;padding:0 12px;">

              ${icon('logout', 'sm')} Sign out

            </button>

          </div>

        </header>



        <div class="app-branding">${evolixBrandHtml()}</div>

        <main class="main-content">

          <!-- Counter Swapping Pills -->

          <div class="counter-stepper">
            ${hasPerm('participant:view') ? `<button type="button" class="counter-pill ${state.page==='participants' ? 'active' : ''}" data-nav-page="participants">Participants</button>` : ''}

            ${user?.permissions?.includes('dashboard:view') ? `<button type="button" class="counter-pill ${state.page==='dashboard' ? 'active' : ''}" data-nav-page="dashboard">Janab Dashboard</button>` : ''}

            ${assignedCounters.map(c => `

              <button type="button" class="counter-pill ${state.page === 'counter' && state.activeCounter === c.id ? 'active' : ''}" data-nav-counter="${c.id}">

                <span class="badge-num">${c.num}</span>

                <span>${esc(c.short)}</span>

              </button>

            `).join('')}



            ${hasReg ? `

              <button type="button" class="counter-pill ${state.page === 'registration' ? 'active' : ''}" data-nav-page="registration">

                ${icon('plus', 'sm')}

                <span>Registration Desk</span>

              </button>

            ` : ''}



            ${isSuperAdmin ? `

              <button type="button" class="counter-pill ${state.page === 'admin' ? 'active' : ''}" data-nav-page="admin">

                ${icon('shield', 'sm')}

                <span>Super Admin</span>

              </button>

            ` : ''}

          </div>



          ${inner}

        </main>



        <footer class="site-footer">

          <span>© ${new Date().getFullYear()} Umoor Sehat · Ratangarh Kheri Jamiat</span>

          ${evolixBrandHtml()}

        </footer>

      </div>

    </div>

    ${modalHtml()}

    ${printableSlipHtml()}
    ${printableMedicalReportHtml()}

    <div class="toast-area" id="toasts">${toastHtml()}</div>

  `;

}



// -------------------------------------------------------------

// EVENT HANDLERS & API CALLS

// -------------------------------------------------------------

async function submitRegistrationForm() {

  if (state.isSubmitting) return;



  const nameInput = document.getElementById('reg-name-input');

  const name = (nameInput ? nameInput.value : state.fields.regName || '').trim();

  const its = String(state.fields.regIts || '').trim();

  const phone = String(state.fields.regPhone || '').trim();

  const age = String(state.fields.regAge || '').trim();

  const genderEl = document.querySelector('input[name="regGender"]:checked');

  const gender = genderEl ? genderEl.value : 'Male';

  const consentEl = document.getElementById('reg-consent-chk');

  const consent = consentEl ? consentEl.checked : true;



  if (!name) {

    notify('Participant full name is required.', true);

    nameInput?.focus();

    return;

  }

  if (!/^[0-9]{8}$/.test(its)) {

    notify('ITS Number must contain exactly 8 digits.', true);

    focusField('regIts');

    return;

  }

  if (!/^[0-9]{10}$/.test(phone)) {

    notify('Mobile Number must contain exactly 10 digits.', true);

    focusField('regPhone');

    return;

  }

  const ageNum = parseInt(age, 10);

  if (!Number.isSafeInteger(ageNum) || ageNum < 1 || ageNum > 120) {

    notify('Please enter a valid age between 1 and 120.', true);

    focusField('regAge');

    return;

  }

  if (!state.regMedicalHistory.length) {

    notify('Please select the reported medical history.', true);

    document.querySelector('input[name="medicalHistory"]')?.focus();

    return;

  }

  if (!consent) {

    notify('Participant consent is required.', true);

    return;

  }



  const clientRequestId = 'reg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);

  state.isSubmitting = true;

  state.regConflict = null;



  const submitBtn = document.getElementById('submit-reg-btn');

  if (submitBtn) {

    submitBtn.disabled = true;

    submitBtn.innerHTML = `${icon('refresh', 'sm spin')} GENERATING TOKEN...`;

  }



  try {

    const res = await call('participant.register', {

      name,

      its,

      phone,

      age: ageNum,

      medicalHistory: state.regMedicalHistory,

      gender,

      consent: true,

      clientRequestId,

    });



    if (res?.ok) {

      notify(`✓ Registration Successful! Token #${res.tokenFormatted || res.data?.tokenFormatted || res.data?.token}`);

      state.regSuccess = {

        token: res.token || res.data?.token,

        tokenFormatted: res.tokenFormatted || res.data?.tokenFormatted || String(res.token).padStart(3, '0'),

        data: res.data,

      };

      state.fields.regName = '';

      state.fields.regIts = '';

      state.fields.regPhone = '';

      state.fields.regAge = '';

      if (nameInput) nameInput.value = '';

      render();

    }

  } catch (err) {

    if (err.errorCode === 'CONFLICT' && err.existing) {

      state.regConflict = {

        error: err.message,

        existing: err.existing,

      };

      render();

    }

  } finally {

    state.isSubmitting = false;

  }

}



async function submitStaffLogin() {

  const nameInput = document.getElementById('login-staff-name');

  const name = (nameInput ? nameInput.value : state.fields.loginStaffName || '').trim();

  const pin = state.fields.loginPin;

  if (!name || !pin) {

    notify('Please enter both your registered staff name and 4-digit PIN.', true);

    return;

  }

  try {

    const res = await call('auth.staff_login', {}, { name, pin });

    if (res?.ok) {

      state.user = res.user;

      notify(`Welcome, ${res.user.name}!`);

      // Automatic redirect to assigned counter

      if (res.user.permissions?.includes('dashboard:view')) {

        state.page = 'dashboard';

        await loadDashboard();
      } else if (res.user.permissions?.includes('participant:view')) {
        state.page = 'participants';
        await loadDirectory();
      } else if (res.user.redirectCounter) {

        state.activeCounter = res.user.redirectCounter;

        state.page = 'counter';

      } else if (res.user.counters?.length) {

        state.activeCounter = res.user.counters[0];

        state.page = 'counter';

      } else if (res.user.canRegister) {

        state.page = 'registration';

      }

      resetCounterForm();

      render();

    }

  } catch {}

}



async function findParticipantToken() {

  const t = state.fields.tokenSearch;

  if (!t) {

    notify('Please enter a token number.', true);

    return;

  }

  try {

    const res = await call('participant.find_token', {}, { token: t });

    if (res?.ok) {

      state.participant = res.data;

      state.fields.doctorAdvice = res.data.advice || '';

      // Pre-fill counter fields if previously recorded

      if (state.activeCounter === 'bp') {

        state.fields.bpSys = res.data.bpSystolic || '';

        state.fields.bpDia = res.data.bpDiastolic || '';

        state.fields.bpPulse = res.data.pulseBpm || '';

        state.activeField = 'bpSys';

      } else if (state.activeCounter === 'sugar') {

        state.fields.sugarVal = res.data.bloodSugar || '';

        state.sugarType = res.data.sugarType || 'Random';

        state.activeField = 'sugarVal';

      } else if (state.activeCounter === 'bmi') {

        state.fields.measHeight = res.data.height || '';

        state.fields.measWeight = res.data.weight || '';

        state.activeField = 'measHeight';

      }

      notify(`Loaded: Token #${String(res.data.token).padStart(3, '0')} (${res.data.name})`);

      render();

    }

  } catch {}

}



async function saveCounterData(counterId, keepParticipant = false) {

  if (!state.participant || state.isSubmitting) return;

  if (counterId === 'doctor') state.fields.doctorAdvice = document.getElementById('doctor-prescription-input')?.value || '';

  state.isSubmitting = true;

  render();



  try {

    let payload = { counter: counterId, token: state.participant.token };



    if (counterId === 'bp') {

      payload.systolic = state.fields.bpSys;

      payload.diastolic = state.fields.bpDia;

      payload.pulse = state.fields.bpPulse;

    } else if (counterId === 'sugar') {

      payload.sugar = state.fields.sugarVal;

      payload.testType = state.sugarType;

    } else if (counterId === 'bmi') {

      payload.height = state.fields.measHeight;

      payload.weight = state.fields.measWeight;

    } else if (counterId === 'doctor') {

      payload.advice = state.fields.doctorAdvice;

    }



    const res = await call('counter.save', payload);

    if (res?.ok) {

      notify(`✓ Token #${String(state.participant.token).padStart(3, '0')} — Measurement Saved Successfully!`);

      if (keepParticipant) state.participant = res.data;
      else resetCounterForm();

      render();
      return true;

    }

  } catch {

    // call() displays the error; retain readings so staff can retry.

  } finally {

    state.isSubmitting = false;

    render();

  }

}



function resetCounterForm() {

  state.participant = null;

  state.fields.tokenSearch = '';

  state.fields.doctorAdvice = '';

  state.fields.bpSys = '';

  state.fields.bpDia = '';

  state.fields.bpPulse = '';

  state.fields.sugarVal = '';

  state.fields.measHeight = '';

  state.fields.measWeight = '';

  state.activeField = 'tokenSearch';

}



function attachEvents() {
  document.getElementById('doctor-print-btn')?.addEventListener('click',async()=>{
    if (await saveCounterData('doctor',true)) await printMedicalReport();
  });
  document.getElementById('delete-participant-btn')?.addEventListener('click',async event=>{
    const p=state.modalData;
    if (!confirm(`Permanently delete ${p.name} (Token #${p.tokenFormatted}) and the entire screening report? This cannot be undone.`)) return;
    const button=event.currentTarget;
    button.disabled=true;
    try {
      const result=await call('participant.delete',{id:p.id,expectedUpdatedAt:p.updatedAt});
      if(result?.ok) {
        if(state.participant?.id===p.id) resetCounterForm();
        if(state.regSuccess?.data?.id===p.id) state.regSuccess=null;
        if(state.regConflict?.existing?.id===p.id) state.regConflict=null;
        state.modal=null;state.modalData=null;
        if(state.directory.offset>0 && state.directory.participants.length===1) state.directory.offset=Math.max(0,state.directory.offset-20);
        await Promise.all([loadDirectory(),loadAdminData()]);
        notify('Participant and screening report deleted.');render();
      }
    } catch {} finally {button.disabled=false;}
  });
  document.getElementById('participant-search-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    state.directory.query=document.getElementById('participant-search-input').value.trim();
    state.directory.offset=0;
    await loadDirectory(); render();
  });
  document.getElementById('participant-list-refresh')?.addEventListener('click', async () => { await loadDirectory(); render(); });
  for (const [id, change] of [['participant-prev',-20],['participant-next',20]]) {
    document.getElementById(id)?.addEventListener('click', async () => { state.directory.offset=Math.max(0,state.directory.offset+change); await loadDirectory(); render(); });
  }
  document.querySelectorAll('[data-view-participant]').forEach(button=>button.addEventListener('click',async()=>{
    try {
      const result=await call('participant.get',{}, {id:button.dataset.viewParticipant});
      if(result?.ok) { state.modalData=result.data; state.modal='view_participant'; render(); }
    } catch {}
  }));
  document.getElementById('edit-participant-btn')?.addEventListener('click',async()=>{
    try {
      const result=await call('participant.get',{}, {id:state.modalData.id});
      if(result?.ok) {state.modalData=result.data;state.modal='edit_participant';render();}
    } catch {}
  });
  document.getElementById('participant-edit-cancel')?.addEventListener('click',()=>{state.modal='view_participant';render();});
  document.querySelectorAll('input[name="editMedicalHistory"]').forEach(input=>input.addEventListener('change',()=>{
    const others=[...document.querySelectorAll('input[name="editMedicalHistory"]')].filter(item=>item!==input && item.checked).map(item=>item.value);
    const selected=selectHistory(others,input.value,input.checked);
    document.querySelectorAll('input[name="editMedicalHistory"]').forEach(item=>{item.checked=selected.includes(item.value);});
  }));
  for(const [roleId,selector] of [['assign-participant-view','input[name="assignCounter"], #assign-can-register'],['edit-participant-view','input[name="editAssignCounter"], #edit-assign-can-register']]) {
    const role=document.getElementById(roleId);
    const update=()=>document.querySelectorAll(selector).forEach(input=>{input.disabled=role.checked; if(role.checked) input.checked=false;});
    if(role) {update();role.addEventListener('change',update);}
  }
  document.getElementById('participant-edit-form')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const original=state.modalData;
    const changes={};
    document.querySelectorAll('[data-edit-field]').forEach(input=>{
      const value=input.value.trim();
      if(value!==String(original[input.dataset.editField] ?? '')) changes[input.dataset.editField]=value;
    });
    const history=[...document.querySelectorAll('input[name="editMedicalHistory"]:checked')].map(input=>input.value);
    const previous=original.medicalHistory || [];
    if(history.length!==previous.length || history.some(value=>!previous.includes(value))) {
      if(!history.length) {notify('Please select the reported medical history.',true);return;}
      changes.medicalHistory=history;
    }
    const button=document.getElementById('participant-edit-save');
    button.disabled=true;
    try {
      const result=await call('participant.update',{id:original.id,expectedUpdatedAt:original.updatedAt,changes});
      if(result?.ok) {
        state.modalData=result.data;
        if(state.participant?.id===result.data.id) state.participant=result.data;
        if(state.regSuccess?.data?.id===result.data.id) state.regSuccess.data=result.data;
        state.modal='view_participant';
        if(state.page==='participants') await loadDirectory();
        notify('Participant record updated.');render();
      }
    } catch {} finally {button.disabled=false;}
  });


  document.querySelectorAll('input[name="medicalHistory"]').forEach(input => input.addEventListener('change', () => {

    state.regMedicalHistory = selectHistory(state.regMedicalHistory, input.value, input.checked);

    document.querySelectorAll('input[name="medicalHistory"]').forEach(choice => { choice.checked = state.regMedicalHistory.includes(choice.value); });

  }));

  document.getElementById('switch-login-janab')?.addEventListener('click', () => { state.loginMode = 'janab'; state.fields.loginPin = ''; render(); });

  document.getElementById('dashboard-refresh')?.addEventListener('click', async event => {

    event.currentTarget.disabled = true;

    await loadDashboard();

    render();

  });

  document.querySelectorAll('input[name="regGender"]').forEach(input => input.addEventListener('change', () => { state.regGender = input.value; }));

  document.getElementById('reg-consent-chk')?.addEventListener('change', event => { state.regConsent = event.target.checked; });

  document.querySelectorAll('[data-numeric-field]').forEach(input => {

    input.addEventListener('focus', () => { state.activeField = input.id; });

    input.addEventListener('input', () => {

      const decimal = input.inputMode === 'decimal';

      let value = input.value.replace(decimal ? /[^0-9.,]/g : /[^0-9]/g, '').replace(/,/g, '.');

      if (decimal) { const parts = value.split('.'); value = parts.shift() + (parts.length ? '.' + parts.join('') : ''); }

      input.value = value;

      state.fields[input.id] = value;

      updateLiveBmi();

    });

    input.addEventListener('keydown', event => {

      if (event.key === 'Enter') { event.preventDefault(); confirmField(); }

    });

  });

  document.getElementById('staff-signin-btn')?.addEventListener('click', submitStaffLogin);

  document.getElementById('find-token-btn')?.addEventListener('click', findParticipantToken);



  // Sugar radio pills

  document.querySelectorAll('input[name="sugarTestType"]').forEach(r => {

    r.addEventListener('change', () => {

      state.sugarType = r.value;

    });

  });



  // Counter switcher pills

  document.querySelectorAll('[data-nav-counter]').forEach(btn => {

    btn.addEventListener('click', () => {

      state.activeCounter = btn.getAttribute('data-nav-counter');

      state.page = 'counter';

      resetCounterForm();

      render();

    });

  });



  document.querySelectorAll('[data-nav-page]').forEach(btn => {

    btn.addEventListener('click', async () => {

      state.page = btn.getAttribute('data-nav-page');
      if (state.page === 'participants') await loadDirectory();
      if (state.page === 'dashboard') await loadDashboard();

      if (state.page === 'admin') {

        await loadAdminData();

      }

      render();

    });

  });



  // Save counter button

  document.getElementById('save-counter-btn')?.addEventListener('click', () => {

    saveCounterData(state.activeCounter);

  });



  // Reset Token button

  document.getElementById('reset-token-btn')?.addEventListener('click', () => {

    resetCounterForm();

    render();

  });



  // Login switches

  document.getElementById('switch-login-staff')?.addEventListener('click', () => {

    state.loginMode = 'staff';

    state.fields.loginStaffName = '';

    state.fields.loginPin = '';

    state.activeField = 'loginPin';

    render();

  });

  document.getElementById('switch-login-admin')?.addEventListener('click', () => {

    state.loginMode = 'admin';

    render();

  });



  // Staff Name input binding

  document.getElementById('login-staff-name')?.addEventListener('input', (e) => {

    state.fields.loginStaffName = e.target.value;

  });

  document.getElementById('login-staff-name')?.addEventListener('keydown', (e) => {

    if (e.key === 'Enter') {

      e.preventDefault();

      focusField('loginPin');

    }

  });



  // Admin login form

  document.getElementById('admin-login-form')?.addEventListener('submit', async (e) => {

    e.preventDefault();

    const email = document.getElementById('admin-email')?.value;

    const password = document.getElementById('admin-password')?.value;

    try {

      const res = await call('auth.admin_login', {}, { email, password });

      if (res?.ok) {

        state.user = res.user;

        state.user.mustChangePassword = Boolean(res.user.must_change_password || res.user.mustChangePassword);

        if (state.user.mustChangePassword) {

          state.modal = 'change_password';

        } else {

          state.page = 'admin';

          await loadAdminData();

        }

        notify('Super Admin signed in.');

        render();

      }

    } catch {}

  });



  // Registration Form Input & Enter Key Handling

  const regNameInput = document.getElementById('reg-name-input');

  if (regNameInput) {

    regNameInput.addEventListener('input', (e) => {

      state.fields.regName = e.target.value;

    });

    regNameInput.addEventListener('keydown', (e) => {

      if (e.key === 'Enter') {

        e.preventDefault();

        if (state.fields.regIts && state.fields.regPhone && state.fields.regAge) {

          submitRegistrationForm();

        } else {

          focusField('regIts');

        }

      }

    });

  }



  // Registration Form Submit

  document.getElementById('standalone-reg-form')?.addEventListener('submit', (e) => {

    e.preventDefault();

    submitRegistrationForm();

  });



  // Token Success Screen Buttons

  document.getElementById('reg-next-btn')?.addEventListener('click', () => {

    state.regSuccess = null;

    state.regConflict = null;

    state.fields.regName = '';

    state.fields.regIts = '';

    state.fields.regPhone = '';

    state.fields.regAge = '';

    state.regGender = 'Male';

    state.regConsent = true;

    state.regMedicalHistory = [];

    state.activeField = 'regIts';

    render();

    setTimeout(() => {

      document.getElementById('reg-name-input')?.focus();

    }, 50);

  });



  document.getElementById('reg-print-btn')?.addEventListener('click', () => {

    window.print();

  });



  document.getElementById('reg-view-btn')?.addEventListener('click', () => {

    if (state.regSuccess?.data) {

      state.modal = 'view_participant';

      state.modalData = state.regSuccess.data;

      render();

    }

  });



  // Duplicate ITS Conflict Banner Buttons

  document.getElementById('conflict-view-existing-btn')?.addEventListener('click', () => {

    if (state.regConflict?.existing) {

      state.modal = 'view_participant';

      state.modalData = state.regConflict.existing;

      render();

    }

  });



  document.getElementById('conflict-dismiss-btn')?.addEventListener('click', () => {

    state.regConflict = null;

    render();

  });



  // Open in Screening Counter button from Participant modal

  document.getElementById('open-in-counter-btn')?.addEventListener('click', () => {

    if (state.modalData) {

      state.participant = state.modalData;

      state.modal = null;

      state.page = 'counter';

      resetCounterForm();

      render();

    }

  });



  // Edit Staff Modal Buttons

  document.querySelectorAll('[data-edit-staff-id]').forEach(btn => {

    btn.addEventListener('click', () => {

      const id = btn.getAttribute('data-edit-staff-id');

      const staffMember = state.staffList.find(s => s.id === id);

      if (staffMember) {

        state.modal = 'edit_staff';

        state.modalData = staffMember;

        render();

      }

    });

  });



  document.getElementById('admin-edit-staff-form')?.addEventListener('submit', async (e) => {

    e.preventDefault();

    const id = state.modalData?.id;

    const name = document.getElementById('edit-staff-name')?.value;

    const counters = Array.from(document.querySelectorAll('input[name="editAssignCounter"]:checked')).map(el => el.value);

    const canRegister = document.getElementById('edit-assign-can-register')?.checked;



    try {

      const res = await call('staff.update', {}, { id, name, counters, canRegister, canViewParticipants: Boolean(document.getElementById('edit-participant-view')?.checked) });

      if (res?.ok) {

        state.modal = null;

        notify(res.message);

        await loadAdminData();

        render();

      }

    } catch {}

  });



  // Add Registration Staff button from Registration tab

  document.getElementById('admin-add-reg-staff-btn')?.addEventListener('click', () => {

    state.modal = 'add_staff';

    render();

    setTimeout(() => {

      const chk = document.getElementById('assign-can-register');

      if (chk) chk.checked = true;

    }, 40);

  });



  document.getElementById('admin-refresh-reg-btn')?.addEventListener('click', async () => {

    await loadAdminData();

    notify('Registration Desk data refreshed.');

    render();

  });



  // Logout

  const doLogout = async () => {

    await call('auth.logout');

    state.user = null;

    state.participant = null;

    state.loginMode = 'staff';

    state.fields.loginStaffName = '';

    state.fields.loginPin = '';

    state.fields.loginStaffName = '';

    state.fields.loginPin = '';

    state.activeField = 'loginPin';

    notify('Signed out.');

    render();

  };

  document.getElementById('quick-logout-btn')?.addEventListener('click', doLogout);



  // Admin sub-tabs

  document.querySelectorAll('[data-admin-tab]').forEach(btn => {

    btn.addEventListener('click', async () => {

      state.adminTab = btn.getAttribute('data-admin-tab');

      await loadAdminData();

      render();

    });

  });



  // Add staff modal

  document.getElementById('open-add-staff-modal')?.addEventListener('click', () => {

    state.modal = 'add_staff';

    render();

  });



  document.getElementById('admin-add-staff-form')?.addEventListener('submit', async (e) => {

    e.preventDefault();

    const name = document.getElementById('new-staff-name')?.value;

    const pin = document.getElementById('new-staff-pin')?.value;

    const counters = Array.from(document.querySelectorAll('input[name="assignCounter"]:checked')).map(el => el.value);

    const canRegister = document.getElementById('assign-can-register')?.checked;



    try {

      const res = await call('staff.create', {}, { name, pin, counters, canRegister, canViewParticipants: Boolean(document.getElementById('assign-participant-view')?.checked) });

      if (res?.ok) {

        state.modal = null;

        notify(res.message);

        await loadAdminData();

        render();

      }

    } catch {}

  });



  // Reset PIN modal

  document.querySelectorAll('[data-reset-pin-id]').forEach(btn => {

    btn.addEventListener('click', () => {

      const id = btn.getAttribute('data-reset-pin-id');

      const name = btn.getAttribute('data-staff-name');

      state.modal = 'reset_pin';

      state.modalData = { id, name };

      render();

    });

  });



  document.getElementById('admin-reset-pin-form')?.addEventListener('submit', async (e) => {

    e.preventDefault();

    const pin = document.getElementById('reset-pin-val')?.value;

    try {

      const res = await call('staff.reset_pin', {}, { id: state.modalData.id, pin });

      if (res?.ok) {

        state.modal = null;

        notify(res.message);

        render();

      }

    } catch {}

  });



  // Toggle active staff

  document.querySelectorAll('[data-toggle-staff-id]').forEach(btn => {

    btn.addEventListener('click', async () => {

      const id = btn.getAttribute('data-toggle-staff-id');

      try {

        const res = await call('staff.toggle_active', {}, { id });

        if (res?.ok) {

          notify(res.message);

          await loadAdminData();

          render();

        }

      } catch {}

    });

  });



  // Delete staff

  document.querySelectorAll('[data-delete-staff-id]').forEach(btn => {

    btn.addEventListener('click', async () => {

      const id = btn.getAttribute('data-delete-staff-id');

      if (!confirm('Are you sure you want to permanently delete this staff account?')) return;

      try {

        const res = await call('staff.delete', {}, { id });

        if (res?.ok) {

          notify(res.message);

          await loadAdminData();

          render();

        }

      } catch {}

    });

  });



  // Change password modal

  document.getElementById('admin-change-pass-btn')?.addEventListener('click', () => {

    state.modal = 'change_password';

    render();

  });



  document.getElementById('admin-change-pass-form')?.addEventListener('submit', async (e) => {

    e.preventDefault();

    const curr = document.getElementById('curr-pass-input')?.value;

    const n = document.getElementById('new-pass-input')?.value;

    const conf = document.getElementById('conf-pass-input')?.value;

    if (n !== conf) {

      notify('Password confirmation does not match.', true);

      return;

    }

    try {

      const res = await call('auth.change_admin_password', {}, { currentPassword: curr, newPassword: n });

      if (res?.ok) {

        state.modal = null;

        notify('Super Admin password updated successfully.');

        render();

      }

    } catch {}

  });



  // CSV export

  document.getElementById('export-csv-btn')?.addEventListener('click', async () => {

    notify('Exporting records to Excel CSV...');

    const res = await call('reports.export');

    if (res?.isBlob) {

      const url = URL.createObjectURL(res.blob);

      const a = document.createElement('a');

      a.href = url;

      a.download = `umoor_sehat_counters_${new Date().toISOString().slice(0, 10)}.csv`;

      document.body.appendChild(a);

      a.click();

      document.body.removeChild(a);

      URL.revokeObjectURL(url);

      notify('CSV export downloaded.');

    }

  });



  // Sheets Sync trigger

  document.getElementById('trigger-sync-btn')?.addEventListener('click', async () => {

    notify('Synchronizing with Google Sheets...');

    const res = await call('sync.trigger');

    if (res?.ok) {

      notify(`Sync completed: ${res.processed} records updated.`);

      await loadAdminData();

      render();

    }

  });



  // Fallback search modal

  document.getElementById('open-fallback-search')?.addEventListener('click', () => {

    state.modal = 'fallback_search';

    state.fallbackResults = [];

    state.fallbackQuery = '';

    render();

  });



  document.getElementById('fallback-query-input')?.addEventListener('input', async (e) => {

    state.fallbackQuery = e.target.value;

    if (!state.fallbackQuery.trim()) {

      state.fallbackResults = [];

      render();

      return;

    }

    try {

      const res = await call('participant.fallback_search', {}, { query: state.fallbackQuery.trim() });

      if (res?.ok) {

        state.fallbackResults = res.results || [];

        render();

        const reInput = document.getElementById('fallback-query-input');

        if (reInput) {

          reInput.focus();

          reInput.setSelectionRange(state.fallbackQuery.length, state.fallbackQuery.length);

        }

      }

    } catch {}

  });



  document.querySelectorAll('[data-pick-token]').forEach(btn => {

    btn.addEventListener('click', () => {

      const t = btn.getAttribute('data-pick-token');

      state.fields.tokenSearch = String(t);

      state.modal = null;

      findParticipantToken();

    });

  });



  // Close modals

  document.querySelectorAll('.close-modal-btn').forEach(btn => {

    btn.addEventListener('click', () => {

      state.modal = null;

      render();

    });

  });



  // Close toasts

  document.getElementById('close-toast')?.addEventListener('click', () => {

    state.toast = null;

    const node = document.getElementById('toasts');

    if (node) node.innerHTML = '';

  });

}



async function loadAdminData() {

  if (state.user?.type !== 'admin') return;

  try {

    const [staffRes, statsRes, auditRes] = await Promise.all([

      call('staff.list'),

      call('admin.stats'),

      call('audit.list'),

    ]);

    if (staffRes?.ok) state.staffList = staffRes.staff || [];

    if (statsRes?.ok) state.stats = statsRes;

    if (auditRes?.ok) state.auditLogs = auditRes.logs || [];

  } catch {}

}



function render() {

  const root = document.getElementById('app');

  if (!root) return;



  if (!state.user) {

    root.innerHTML = loginViewHtml();

    attachEvents();

    return;

  }



  let body = '';

  if (state.page === 'counter') {

    if (state.activeCounter === 'bp') body = counter1BpHtml();

    else if (state.activeCounter === 'sugar') body = counter2SugarHtml();

    else if (state.activeCounter === 'bmi') body = counter3BmiHtml();

    else if (state.activeCounter === 'doctor') body = counter4DoctorHtml();

    else body = counter1BpHtml();

  } else if (state.page === 'registration') {

    body = registrationViewHtml();

  } else if (state.page === 'dashboard') {

    body = janabDashboardHtml();

  } else if (state.page === 'participants') {
    body = participantsViewHtml();
  } else if (state.page === 'admin') {

    body = adminPanelViewHtml();

  } else {

    body = counter1BpHtml();

  }



  root.innerHTML = appShellHtml(body);

  attachEvents();

}



async function init() {

  try {

    const res = await call('auth.status');

    if (res?.ok && res.signedIn && res.user) {

      state.user = res.user;

      if (res.user.type === 'admin') {

        state.page = 'admin';

        if (res.user.mustChangePassword) state.modal = 'change_password';

        await loadAdminData();

      } else {

        if (res.user.permissions?.includes('dashboard:view')) {

          state.page = 'dashboard';

          await loadDashboard();
      } else if (res.user.permissions?.includes('participant:view')) {
        state.page = 'participants';
        await loadDirectory();
      } else if (res.user.redirectCounter) {

          state.activeCounter = res.user.redirectCounter;

        } else if (res.user.counters?.length) {

          state.activeCounter = res.user.counters[0];

        } else if (res.user.canRegister) {

          state.page = 'registration';

        }

        state.activeField = 'tokenSearch';

      }

    }

  } catch {}

  render();

}



init();
