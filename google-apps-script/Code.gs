/**
 * UMOOR SEHAT — GOOGLE SHEETS CONNECTOR
 * Attach this script to the destination Google Sheet (Extensions > Apps Script).
 * Script Properties must include WEBHOOK_SECRET (same value as Netlify's SHEETS_WEBHOOK_SECRET).
 * Deploy as Web app: Execute as Me; Who has access: Anyone (URL protected by secret).
 * Do not rename or reorder columns in the generated tab.
 */
var TAB_NAME = 'Umoor Sehat Records';
var HEADERS = [
  'Token No.', 'Serial No.', 'ITS Number', 'Full Name', 'Mobile Number', 'Age', 'Gender',
  'Consent Given', 'Registered At', 'BP Systolic (mmHg)', 'BP Diastolic (mmHg)',
  'Pulse Rate (BPM)', 'BP Checked At', 'Blood Sugar (mg/dL)', 'Sugar Test Type', 'Sugar Checked At',
  'Height (cm)', 'Weight (kg)', 'BMI', 'Measurements Checked At',
  "Doctor's Prescription / Advice", 'Doctor Consulted At', 'Last Updated At', 'Reported Medical History'
];
var C = {
  token:0, serial:1, its:2, name:3, phone:4, age:5, gender:6, consent:7, registered:8,
  sys:9, dia:10, pulse:11, bpAt:12, sugar:13, sugarType:14, sugarAt:15,
  height:16, weight:17, bmi:18, measurementsAt:19, advice:20, doctorAt:21, updated:22, history:23
};

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents || e.postData.contents.length > 16000) throw new Error('Invalid request.');
    var request = JSON.parse(e.postData.contents);
    var requiredSecret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
    if (!requiredSecret || requiredSecret.length < 24 || request.secret !== requiredSecret) throw new Error('Access denied.');
    var action = request.action;
    var data = request.data || {};
    var isWrite = action === 'participant.register' || action === 'participant.update' || action === 'stage.save';
    var lock = LockService.getScriptLock();
    if (isWrite) lock.waitLock(20000);
    try {
      var sheet = getSheet_();
      var result;
      if (action === 'stats') result = getStats_(sheet);
      else if (action === 'participant.get') result = getParticipant_(sheet, data);
      else if (action === 'participant.register') result = registerParticipant_(sheet, data);
      else if (action === 'participant.update') result = updateParticipant_(sheet, data);
      else if (action === 'stage.save') result = saveStage_(sheet, data);
      else throw new Error('Unsupported operation.');
      SpreadsheetApp.flush();
      return reply_({ok:true, data:result});
    } finally {
      if (isWrite) lock.releaseLock();
    }
  } catch (err) {
    var message = err && err.message ? err.message : 'Unexpected error.';
    var code = message.indexOf('already registered') !== -1 ? 'CONFLICT' :
      message.indexOf('not found') !== -1 ? 'NOT_FOUND' : 'INVALID';
    return reply_({ok:false,error:message,errorCode:code});
  }
}
function reply_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function getSheet_() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error('Bind this Apps Script to the Google Sheet using Extensions > Apps Script.');
  var sheet = book.getSheetByName(TAB_NAME);
  if (!sheet) {
    sheet = book.insertSheet(TAB_NAME);
    sheet.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1,1,1,HEADERS.length).setBackground('#0b493f').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setTabColor('#16866f');
    sheet.setRowHeight(1,42);
    sheet.getRange('A:A').setNumberFormat('@'); // Token No.
    sheet.getRange('B:B').setNumberFormat('@'); // Serial No.
    sheet.getRange('C:C').setNumberFormat('@'); // ITS Number
    sheet.getRange('E:E').setNumberFormat('@'); // Mobile Number
    sheet.setColumnWidth(1,100);
    sheet.setColumnWidth(2,120);
    sheet.setColumnWidth(3,120);
    sheet.setColumnWidth(4,180);
    sheet.setColumnWidth(5,130);
    sheet.setColumnWidth(21,400);
    sheet.getRange('U:U').setWrap(true);
    sheet.getRange(1,1,1,HEADERS.length).createFilter();
  }
  var headers = sheet.getRange(1,1,1,HEADERS.length).getValues()[0];
  for (var i=0;i<HEADERS.length-1;i++) if (headers[i] !== HEADERS[i]) throw new Error('Google Sheet column headers have changed. Restore the original columns.');
  if (!headers[C.history]) sheet.getRange(1,C.history+1).setValue(HEADERS[C.history]);
  else if (headers[C.history] !== HEADERS[C.history]) throw new Error('Google Sheet medical history header has changed.');
  return sheet;
}
function rows_(sheet) {
  var last = sheet.getLastRow();
  return last <= 1 ? [] : sheet.getRange(2,1,last-1,HEADERS.length).getDisplayValues();
}
function rowIndex_(sheet, its) {
  var rows = rows_(sheet);
  for (var i=0;i<rows.length;i++) if (String(rows[i][C.its]).trim() === its) return i+2;
  return -1;
}
function onlyDigits_(input,len,label) {
  var s = String(input == null ? '' : input).trim();
  if (!new RegExp('^[0-9]{'+len+'}$').test(s)) throw new Error(label+' must contain exactly '+len+' digits.');
  return s;
}
function safeText_(value,limit,label) {
  var v = String(value == null ? '' : value).trim().replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g,' ');
  if (!v || v.length > limit) throw new Error(label+' is required (maximum '+limit+' characters).');
  return /^[=+\-@]/.test(v) ? "'"+v : v;
}
function number_(input,min,max,label) {
  var raw = String(input == null ? '' : input).trim();
  if (!/^\d+(?:\.\d+)?$/.test(raw)) throw new Error(label+' must be numeric.');
  var n = Number(raw);
  if (!isFinite(n) || n < min || n > max) throw new Error(label+' must be between '+min+' and '+max+'.');
  return n;
}
function registration_(data) {
  if (data.consent !== true) throw new Error('Participant consent is required.');
  var gender = String(data.gender||'');
  if (gender !== 'Male' && gender !== 'Female') throw new Error('Please select Male or Female.');
  var history = data.medicalHistory;
  if (history != null && (!Array.isArray(history) || !history.length || history.some(function(id){return ['bp','sugar','none'].indexOf(id)<0;}) || new Set(history).size !== history.length || (history.indexOf('none')>=0 && history.length!==1))) throw new Error('Invalid medical history.');
  return {
    medicalHistory:history || null,
    its:onlyDigits_(data.its,8,'ITS number'),
    name:safeText_(data.name,120,'Name'),
    phone:onlyDigits_(data.phone,10,'Mobile number'),
    age:number_(data.age,1,120,'Age'), gender:gender
  };
}
function serial_(sheet) {
  var rows = rows_(sheet), last = 0;
  rows.forEach(function(r){
    var match = String(r[C.serial]).match(/^US-(\d+)$/);
    if (match) last = Math.max(last, Number(match[1]));
  });
  return 'US-'+('0000'+(last+1)).slice(-Math.max(4,String(last+1).length));
}
function record_(row) {
  return {
    medicalHistory:row[C.history] ? JSON.parse(row[C.history]) : null,
    token: String(row[C.token]||''),
    serial: String(row[C.serial]||''), its:String(row[C.its]||''),
    name:String(row[C.name]||''), phone:String(row[C.phone]||''),
    age:String(row[C.age]||''), gender:String(row[C.gender]||''),
    registeredAt:String(row[C.registered]||''),
    bpSystolic:String(row[C.sys]||''), bpDiastolic:String(row[C.dia]||''), bpPulse:String(row[C.pulse]||''), bpAt:String(row[C.bpAt]||''),
    bloodSugar:String(row[C.sugar]||''), sugarType:String(row[C.sugarType]||''), sugarAt:String(row[C.sugarAt]||''),
    height:String(row[C.height]||''), weight:String(row[C.weight]||''), bmi:String(row[C.bmi]||''),
    measurementsAt:String(row[C.measurementsAt]||''),
    advice:String(row[C.advice]||''), doctorAt:String(row[C.doctorAt]||''), updatedAt:String(row[C.updated]||'')
  };
}
function recordAt_(sheet,rowNumber) { return record_(sheet.getRange(rowNumber,1,1,HEADERS.length).getDisplayValues()[0]); }
function getParticipant_(sheet,data) {
  var its=onlyDigits_(data.its,8,'ITS number');
  var i=rowIndex_(sheet,its);
  if (i<0) throw new Error('Participant not found. Register this ITS number first.');
  return recordAt_(sheet,i);
}
function registerParticipant_(sheet,data) {
  var p=registration_(data);
  if (rowIndex_(sheet,p.its)!==-1) throw new Error('This ITS number is already registered. Search for the existing participant instead.');
  var now = new Date(), row=Array(HEADERS.length).fill('');
  var tokenVal = data.token ? ('000' + data.token).slice(-Math.max(3, String(data.token).length)) : '';
  row[C.token]=tokenVal;
  row[C.history]=p.medicalHistory ? JSON.stringify(p.medicalHistory) : '';
  row[C.serial]=data.serial || serial_(sheet);
  row[C.its]=p.its;row[C.name]=p.name;row[C.phone]=p.phone;
  row[C.age]=p.age;row[C.gender]=p.gender;row[C.consent]='Yes';row[C.registered]=now;row[C.updated]=now;
  var target=sheet.getLastRow()+1;
  sheet.getRange(target,1,1,HEADERS.length).setValues([row]);
  sheet.getRange(target,1).setNumberFormat('@'); // Token No.
  sheet.getRange(target,2).setNumberFormat('@'); // Serial No.
  sheet.getRange(target,3).setNumberFormat('@'); // ITS Number
  sheet.getRange(target,5).setNumberFormat('@'); // Mobile Number
  sheet.getRange(target,9).setNumberFormat('dd mmm yyyy, hh:mm');
  sheet.getRange(target,23).setNumberFormat('dd mmm yyyy, hh:mm');
  return recordAt_(sheet,target);
}
function updateParticipant_(sheet,data) {
  var p=registration_(data), previousIts=onlyDigits_(data.previousIts || p.its,8,'Previous ITS number'), i=rowIndex_(sheet,previousIts);
  if (i<0) throw new Error('Participant not found.');
  var duplicate=rowIndex_(sheet,p.its);
  if (duplicate>=0 && duplicate!==i) throw new Error('This ITS number is already registered.');
  sheet.getRange(i,C.its+1).setValue(p.its);
  sheet.getRange(i,C.name+1,1,4).setValues([[p.name,p.phone,p.age,p.gender]]);
  if (data.medicalHistory !== undefined) sheet.getRange(i,C.history+1).setValue(p.medicalHistory ? JSON.stringify(p.medicalHistory) : '');
  sheet.getRange(i,C.updated+1).setValue(new Date());
  return recordAt_(sheet,i);
}
function saveStage_(sheet,data) {
  var its=onlyDigits_(data.its,8,'ITS number');
  var i=rowIndex_(sheet,its);
  if (i<0) throw new Error('Participant not found. Register this ITS number first.');
  var now=new Date(), stage=String(data.stage||'');
  if (stage==='bp') {
    var sys=number_(data.systolic,50,300,'Systolic BP');
    var dia=number_(data.diastolic,30,200,'Diastolic BP');
    var pulse=number_(data.pulse||data.pulseBpm||data.pulse_bpm,30,250,'Pulse Rate (BPM)');
    if (dia>=sys) throw new Error('Systolic BP must be higher than diastolic BP.');
    sheet.getRange(i,C.sys+1,1,4).setValues([[sys,dia,pulse,now]]);
    sheet.getRange(i,C.bpAt+1).setNumberFormat('dd mmm yyyy, hh:mm');
  } else if(stage==='sugar') {
    var sugar=number_(data.sugar,20,700,'Blood sugar');
    var typ=String(data.testType||'');
    if (['Fasting','Random','Post-meal'].indexOf(typ)<0) throw new Error('Choose a blood sugar test type.');
    sheet.getRange(i,C.sugar+1,1,3).setValues([[sugar,typ,now]]);
    sheet.getRange(i,C.sugarAt+1).setNumberFormat('dd mmm yyyy, hh:mm');
  } else if(stage==='measurements') {
    var h=number_(data.height,40,250,'Height');
    var w=number_(data.weight,2,350,'Weight');
    var bmi=Math.round((w/Math.pow(h/100,2))*10)/10;
    sheet.getRange(i,C.height+1,1,4).setValues([[h,w,bmi,now]]);
    sheet.getRange(i,C.measurementsAt+1).setNumberFormat('dd mmm yyyy, hh:mm');
  } else if(stage==='doctor') {
    var note=safeText_(data.advice,4000,'Doctor’s advice');
    sheet.getRange(i,C.advice+1,1,2).setValues([[note,now]]);
    sheet.getRange(i,C.doctorAt+1).setNumberFormat('dd mmm yyyy, hh:mm');
    sheet.getRange(i,C.advice+1).setWrap(true);
  } else throw new Error('Unknown screening station.');
  sheet.getRange(i,C.updated+1).setValue(now);
  return recordAt_(sheet,i);
}
function getStats_(sheet) {
  var rows=rows_(sheet), counts={registered:rows.length,bp:0,sugar:0,measurements:0,doctor:0};
  rows.forEach(function(r){
    if(r[C.bpAt]) counts.bp++;
    if(r[C.sugarAt]) counts.sugar++;
    if(r[C.measurementsAt]) counts.measurements++;
    if(r[C.doctorAt]) counts.doctor++;
  });
  var recent=rows.slice(-7).reverse().map(function(r){
    return { serial:String(r[C.serial]),its:String(r[C.its]),name:String(r[C.name]),
      gender:String(r[C.gender]),bp:!!r[C.bpAt],sugar:!!r[C.sugarAt],
      measurements:!!r[C.measurementsAt],doctor:!!r[C.doctorAt] };
  });
  return {counts:counts,recent:recent};
}
