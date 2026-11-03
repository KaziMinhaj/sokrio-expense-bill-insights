// Node script to verify parse results against the expected numbers
// Run: node verify.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('./node_modules/xlsx');
import { readFileSync } from 'fs';

const filePath = 'C:/Users/kazim/.gemini/antigravity/brain/374a3bac-8e03-4a46-afde-489cee8c1b21/.user_uploaded/media_1793624745998_43fdbbca.xlsx';

const buf = readFileSync(filePath);
const wb = XLSX.read(buf, { type: 'buffer', raw: true, cellDates: false });
const ws = wb.Sheets[wb.SheetNames[0]];

// Convert to array of arrays
const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

console.log('Total rows in sheet (including header/meta):', raw.length);

// Find header row
let headerIdx = -1;
for (let i = 0; i < raw.length; i++) {
  const cell = String(raw[i][0] ?? '').trim().toLowerCase();
  if (cell === 'sl') { headerIdx = i; break; }
}
console.log('Header row index:', headerIdx);

// Parse meta
const infoRow = String(raw[2][0] ?? '');
const totalsRow = String(raw[3][0] ?? '');
const drMatch = infoRow.match(/Date Range:\s*([\d-]+)\s*to\s*([\d-]+)/i);
const recMatch = infoRow.match(/Total Records:\s*([\d,]+)/i);
const getTotal = (label) => {
  const m = totalsRow.match(new RegExp(`${label}:\\s*([\\d,]+(?:\\.\\d+)?)`, 'i'));
  return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
};

const dateFrom = drMatch?.[1] ?? '';
const dateTo = drMatch?.[2] ?? '';
const headerTotalRecords = recMatch ? parseInt(recMatch[1].replace(/,/g, '')) : 0;
const headerSubmit = getTotal('Submit Amount');
const headerPayable = getTotal('Payable Amount');
const headerTransport = getTotal('Transport');
const headerAllowance = getTotal('Allowance');
const headerAccommodation = getTotal('Accommodation');
const headerOtherCosts = getTotal('Other Costs');

console.log('Date range:', dateFrom, 'to', dateTo);
console.log('Header total records:', headerTotalRecords);
console.log('Header Submit:', headerSubmit);
console.log('Header Payable:', headerPayable);

// MONTH_MAP
const MONTH_MAP = {
  jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
  jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12',
};
const EXCEL_EPOCH_MS = new Date(Date.UTC(1899, 11, 30)).getTime();

function normalizeDate(raw) {
  if (!raw && raw !== 0) return null;
  if (typeof raw === 'number') {
    const d = new Date(EXCEL_EPOCH_MS + raw * 86400000);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    const mm = MONTH_MAP[m[2].toLowerCase()];
    if (mm) return `${m[3]}-${mm}-${m[1].padStart(2,'0')}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

// Build column map from header row
const headerRow = raw[headerIdx];
const colMap = {};
for (let i = 0; i < headerRow.length; i++) {
  const name = String(headerRow[i] ?? '').trim().toLowerCase();
  if (name) colMap[name] = i;
}
console.log('Columns found:', Object.keys(colMap).join(', '));

// Count rows, employees, totals — filtering to October 2026
const empIds = new Set();
let rowCount = 0, submitTotal = 0, payableTotal = 0;
let transportSum = 0, allowanceSum = 0, accommodationSum = 0, otherCostsSum = 0;
let dateErrors = 0;

// All months
const monthGroups = {};

for (let i = headerIdx + 1; i < raw.length; i++) {
  const row = raw[i];
  if (!row || row.every(c => c === '' || c === undefined || c === null)) continue;
  
  const dateRaw = row[colMap['date']];
  const dateIso = normalizeDate(dateRaw);
  if (!dateIso) { dateErrors++; continue; }
  
  const month = dateIso.slice(0, 7);
  if (!monthGroups[month]) monthGroups[month] = { rows: 0, emps: new Set(), submit: 0, payable: 0, transport: 0, allowance: 0, accommodation: 0, other: 0 };
  
  const empId = String(row[colMap['emp. id']] ?? '').trim();
  const submit = Number(row[colMap['submit amount']]);
  const payable = Number(row[colMap['payable amount']]);
  const allowanceType = String(row[colMap['allowance type']] ?? '').trim();
  
  monthGroups[month].rows++;
  if (empId) monthGroups[month].emps.add(empId);
  monthGroups[month].submit += submit;
  monthGroups[month].payable += payable;
  
  switch(allowanceType) {
    case 'Transportation': monthGroups[month].transport += submit; break;
    case 'Daily Allowance': monthGroups[month].allowance += submit; break;
    case 'Accommodation': monthGroups[month].accommodation += submit; break;
    case 'Others': monthGroups[month].other += submit; break;
  }
}

console.log('\n--- Month Groups ---');
for (const [month, g] of Object.entries(monthGroups).sort()) {
  console.log(`${month}: ${g.rows} rows, ${g.emps.size} employees, Submit=${g.submit.toFixed(2)}, Payable=${g.payable.toFixed(2)}`);
  console.log(`        Transport=${g.transport.toFixed(2)}, Allowance=${g.allowance.toFixed(2)}, Accom=${g.accommodation.toFixed(2)}, Other=${g.other.toFixed(2)}`);
}

console.log('\nDate errors:', dateErrors);

// Check October specifically
const oct = monthGroups['2026-10'];
if (oct) {
  console.log('\n=== OCTOBER 2026 VERIFICATION ===');
  console.log('Rows:', oct.rows, '(expected: 11,892)');
  console.log('Employees:', oct.emps.size, '(expected: 63)');
  console.log('Submit Total:', oct.submit.toFixed(2), '(expected: 693,366)');
  console.log('Payable Total:', oct.payable.toFixed(2), '(expected: 631,038)');
  console.log('\nSubtotals:');
  console.log('  Transport:', oct.transport.toFixed(2), '(header:', headerTransport, ')');
  console.log('  Allowance:', oct.allowance.toFixed(2), '(header:', headerAllowance, ')');
  console.log('  Accommodation:', oct.accommodation.toFixed(2), '(header:', headerAccommodation, ')');
  console.log('  Other Costs:', oct.other.toFixed(2), '(header:', headerOtherCosts, ')');
}
