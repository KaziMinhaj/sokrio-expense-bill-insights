// Date normalization for TA/DA Insights

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04',
  may: '05', jun: '06', jul: '07', aug: '08',
  sep: '09', oct: '10', nov: '11', dec: '12',
};

// Excel serial date epoch: January 1, 1900 = serial 1
// But Excel has a leap year bug (1900 was NOT a leap year), so:
// serial 1 = 1900-01-01, serial 60 = "1900-02-29" (bug), serial 61 = 1900-03-01
const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30)); // Dec 30, 1899

export function normalizeDate(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null;

  // If it's a number (Excel serial)
  if (typeof raw === 'number') {
    const ms = (raw - 1) * 86400000; // days to ms, serial 1 = Jan 1 1900
    const d = new Date(EXCEL_EPOCH.getTime() + raw * 86400000);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }

  // If it's already a Date object
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return raw.toISOString().slice(0, 10);
  }

  const s = String(raw).trim();

  // ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // "01-Oct-2026" or "01-oct-2026"
  const ddMmmYyyy = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (ddMmmYyyy) {
    const [, dd, mmm, yyyy] = ddMmmYyyy;
    const mm = MONTH_MAP[mmm.toLowerCase()];
    if (mm) return `${yyyy}-${mm}-${dd.padStart(2, '0')}`;
  }

  // Try JS Date parsing as fallback
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return null;
}

export function toYearMonth(isoDate: string): string {
  return isoDate.slice(0, 7); // YYYY-MM
}
