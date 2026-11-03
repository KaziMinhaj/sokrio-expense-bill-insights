// Verification script for Phase 2 business rules
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('./node_modules/xlsx');
import { readFileSync } from 'fs';

const filePath = 'C:/Users/kazim/.gemini/antigravity/brain/374a3bac-8e03-4a46-afde-489cee8c1b21/.user_uploaded/media_1793624745998_43fdbbca.xlsx';
const buf = readFileSync(filePath);
const wb = XLSX.read(buf, { type: 'buffer', raw: true, cellDates: false });
const ws = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

const MONTH_MAP = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
const EXCEL_EPOCH_MS = new Date(Date.UTC(1899, 11, 30)).getTime();
function normalizeDate(raw) {
  if (!raw && raw !== 0) return null;
  if (typeof raw === 'number') { const d = new Date(EXCEL_EPOCH_MS + raw * 86400000); return isNaN(d.getTime()) ? null : d.toISOString().slice(0,10); }
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) { const mm = MONTH_MAP[m[2].toLowerCase()]; if (mm) return `${m[3]}-${mm}-${m[1].padStart(2,'0')}`; }
  const d = new Date(s); return isNaN(d.getTime()) ? null : d.toISOString().slice(0,10);
}

// Build colMap
let headerIdx = -1;
for (let i = 0; i < raw.length; i++) { if (String(raw[i][0]??'').trim().toLowerCase()==='sl') { headerIdx=i; break; } }
const colMap = {};
raw[headerIdx].forEach((c,i) => { const n=String(c??'').trim().toLowerCase(); if(n) colMap[n]=i; });

// Extract October rows
const octRows = [];
for (let i = headerIdx+1; i < raw.length; i++) {
  const row = raw[i];
  if (!row || row.every(c=>c===''||c===undefined||c===null)) continue;
  const dateIso = normalizeDate(row[colMap['date']]);
  if (!dateIso || !dateIso.startsWith('2026-10')) continue;
  octRows.push({
    sl: row[colMap['sl']],
    date: dateIso,
    empId: String(row[colMap['emp. id']]??'').trim(),
    empName: String(row[colMap['emp. name']]??'').trim(),
    role: String(row[colMap['role']]??'').trim(),
    allowanceType: String(row[colMap['allowance type']]??'').trim(),
    expenseType: String(row[colMap['expense type']]??'').trim(),
    submit: Number(row[colMap['submit amount']]),
    payable: Number(row[colMap['payable amount']]),
    status: String(row[colMap['status']]??'').trim(),
  });
}

console.log('Oct rows:', octRows.length);

// 1. GAP BREAKDOWN BY STATUS
let pending=0, rejected=0, cancelled=0, realReductions=0;
for (const r of octRows) {
  const gap = r.submit - r.payable;
  if (r.status === 'Pending')   pending   += gap;
  if (r.status === 'Rejected')  rejected  += r.submit; // full submit amount is "withheld"
  if (r.status === 'Cancelled') cancelled += r.submit;
  if ((r.status==='Accepted'||r.status==='Approved') && gap>0) realReductions += gap;
}
const rejCan = rejected + cancelled;
// Also compute differently: gap = total submit - total payable per status bucket
let pendingGap=0, rejectedGap=0, cancelledGap=0, realGap=0;
for (const r of octRows) {
  const gap = r.submit - r.payable;
  if (r.status === 'Pending')   pendingGap   += gap;
  if (r.status === 'Rejected')  rejectedGap  += gap;
  if (r.status === 'Cancelled') cancelledGap += gap;
  if (r.status==='Accepted'||r.status==='Approved') realGap += gap;
}
console.log('\n--- GAP BREAKDOWN (submit - payable by status) ---');
console.log('Pending gap:', pendingGap);
console.log('Rejected gap:', rejectedGap);
console.log('Cancelled gap:', cancelledGap);
console.log('Real reductions (Accepted+Approved submit>payable):', realGap);
console.log('Total gap:', octRows.reduce((s,r)=>s+(r.submit-r.payable),0));
const totalSubmit = octRows.reduce((s,r)=>s+r.submit,0);
const totalPayable = octRows.reduce((s,r)=>s+r.payable,0);
console.log('Total submit:', totalSubmit, '| Total payable:', totalPayable, '| Total gap:', totalSubmit-totalPayable);

// Check exact values per status
const byStatus = {};
for (const r of octRows) {
  if (!byStatus[r.status]) byStatus[r.status] = { count:0, submit:0, payable:0 };
  byStatus[r.status].count++;
  byStatus[r.status].submit += r.submit;
  byStatus[r.status].payable += r.payable;
}
console.log('\nBy status:');
for (const [s,v] of Object.entries(byStatus)) {
  console.log(` ${s}: count=${v.count}, submit=${v.submit.toFixed(0)}, payable=${v.payable.toFixed(0)}, gap=${(v.submit-v.payable).toFixed(0)}`);
}

// 2. DAYS WORKED per officer
// "distinct dates with at least one Transportation or Daily Allowance line not Rejected or Cancelled"
const empDates = {};
for (const r of octRows) {
  if ((r.allowanceType==='Transportation'||r.allowanceType==='Daily Allowance') 
      && r.status!=='Rejected' && r.status!=='Cancelled') {
    if (!empDates[r.empId]) empDates[r.empId] = new Set();
    empDates[r.empId].add(r.date);
  }
}
const daysWorked = Object.entries(empDates).map(([id,dates]) => ({ id, days: dates.size }));
const avgDays = daysWorked.reduce((s,e)=>s+e.days,0) / daysWorked.length;
console.log('\n--- DAYS WORKED ---');
console.log('Officers with TA/DA claims:', daysWorked.length);
console.log('Average days worked:', avgDays.toFixed(2));
console.log('Min days:', Math.min(...daysWorked.map(e=>e.days)));
console.log('Max days:', Math.max(...daysWorked.map(e=>e.days)));
// Distribution
const bins = {0:0,1:0,2:0,3:0,4:0}; // 0-5,6-10,11-15,16-20,21+
for (const e of daysWorked) {
  if(e.days<=5) bins[0]++;
  else if(e.days<=10) bins[1]++;
  else if(e.days<=15) bins[2]++;
  else if(e.days<=20) bins[3]++;
  else bins[4]++;
}
console.log('Histogram: 0-5='+bins[0]+', 6-10='+bins[1]+', 11-15='+bins[2]+', 16-20='+bins[3]+', 21+='+bins[4]);

// 3. ENTERTAINMENT
const entRows = octRows.filter(r=>r.expenseType==='Entertainment');
const entSubmit = entRows.reduce((s,r)=>s+r.submit,0);
console.log('\n--- ENTERTAINMENT ---');
console.log('Entertainment submit:', entSubmit, '(', (entSubmit/totalSubmit*100).toFixed(2),'%)');

// 4. BENCHMARKS  
const empSubmit = {};
for (const r of octRows) {
  if (!empSubmit[r.empId]) empSubmit[r.empId] = 0;
  empSubmit[r.empId] += r.submit;
}
const empList = Object.entries(empSubmit);
const nationalAvg = empList.reduce((s,[,v])=>s+v,0)/empList.length;
console.log('\n--- BENCHMARK (Submit per officer) ---');
console.log('National average per officer:', nationalAvg.toFixed(2));
const above20pct = empList.filter(([,v])=>v>nationalAvg*1.2);
console.log('Officers above 120% national avg:', above20pct.length);
