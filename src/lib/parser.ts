// Excel header detection and parsing for TA/DA Insights
import type {
  HeaderMeta,
  ClaimRow,
  AllowanceType,
  ClaimStatus,
  ValidationMessage,
} from '../types';
import { KNOWN_STATUSES, KNOWN_ALLOWANCE_TYPES } from '../types';
import { normalizeDate, toYearMonth } from './dateUtils';
import { parseHierarchy } from './hierarchy';

// Expected column names (lowercased, trimmed)
const EXPECTED_COLUMNS = [
  'sl', 'date', 'emp. id', 'emp. name', 'emp. phone',
  'role', 'hierarchy', 'allowance type', 'from', 'to',
  'expense type', 'submit amount', 'payable amount',
  'status', 'remarks', 'download attachment',
];

export interface ParsedSheet {
  meta: HeaderMeta;
  rows: ClaimRow[];
  messages: ValidationMessage[];
}

/**
 * Parse a number from a cell value.
 * Returns NaN if not parseable.
 */
function parseNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/,/g, '').trim();
    return Number(cleaned);
  }
  return NaN;
}

/**
 * Parse metadata from row 3 (0-indexed: row 2) and row 4 (0-indexed: row 3).
 * Rows are zero-indexed arrays of cell values.
 */
export function parseHeaderMeta(rows: unknown[][]): HeaderMeta {
  // Row index 2 (3rd row): "Date Range: ... | Territory: ... | Total Records: ..."
  const infoRow = String(rows[2]?.[0] ?? '');
  const drMatch = infoRow.match(/Date Range:\s*([\d-]+)\s*to\s*([\d-]+)/i);
  const terrMatch = infoRow.match(/Territory:\s*([^|]+)/i);
  const recMatch = infoRow.match(/Total Records:\s*([\d,]+)/i);

  // Row index 3 (4th row): "Transport: ... | Allowance: ... | ..."
  const totalsRow = String(rows[3]?.[0] ?? '');
  const getTotal = (label: string) => {
    const m = totalsRow.match(new RegExp(`${label}:\\s*([\\d,]+(?:\\.\\d+)?)`, 'i'));
    return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
  };

  return {
    dateRange: {
      from: drMatch?.[1] ?? '',
      to: drMatch?.[2] ?? '',
    },
    territory: terrMatch?.[1]?.trim() ?? '',
    totalRecords: recMatch ? parseInt(recMatch[1].replace(/,/g, '')) : 0,
    totals: {
      transport: getTotal('Transport'),
      allowance: getTotal('Allowance'),
      accommodation: getTotal('Accommodation'),
      otherCosts: getTotal('Other Costs'),
      submitAmount: getTotal('Submit Amount'),
      payableAmount: getTotal('Payable Amount'),
    },
  };
}

/**
 * Scan column A (index 0) to find the header row.
 * Returns the 0-indexed row index, or -1 if not found.
 */
export function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const cell = String(rows[i]?.[0] ?? '').trim().toLowerCase();
    if (cell === 'sl') return i;
  }
  return -1;
}

/**
 * Build a column index map from the header row.
 * Returns a map of lowercased column name → column index.
 */
export function buildColumnMap(headerRow: unknown[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < headerRow.length; i++) {
    const name = String(headerRow[i] ?? '').trim().toLowerCase();
    if (name) map.set(name, i);
  }
  return map;
}

/**
 * Get role family from role string.
 */
function getRoleFamily(role: string): string {
  return role.trim().split(/\s+/)[0] ?? role;
}

/**
 * Parse all data rows into ClaimRow objects.
 */
export function parseRows(
  rows: unknown[][],
  headerIdx: number,
  colMap: Map<string, number>,
  dateRange: { from: string; to: string },
): { rows: ClaimRow[]; messages: ValidationMessage[] } {
  const messages: ValidationMessage[] = [];
  const result: ClaimRow[] = [];

  const get = (row: unknown[], col: string): unknown =>
    colMap.has(col) ? row[colMap.get(col)!] : undefined;

  // Check for missing critical columns
  const missingCols = EXPECTED_COLUMNS.filter(c => !colMap.has(c));
  if (missingCols.length > 0) {
    messages.push({
      level: 'error',
      message: `Missing columns: ${missingCols.join(', ')}`,
    });
  }

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c === undefined || c === null || c === '')) continue;

    const slRaw = get(row, 'sl');
    const sl = typeof slRaw === 'number' ? slRaw : parseInt(String(slRaw ?? '0'));

    // Date
    const dateRaw = get(row, 'date');
    const dateIso = normalizeDate(dateRaw);
    if (!dateIso) {
      messages.push({ level: 'error', message: `Row ${sl}: Invalid date "${dateRaw}"`, rowSl: sl });
      continue;
    }

    // Date range check
    if (dateRange.from && dateRange.to) {
      if (dateIso < dateRange.from || dateIso > dateRange.to) {
        messages.push({
          level: 'warning',
          message: `Row ${sl}: Date ${dateIso} is outside declared range ${dateRange.from}–${dateRange.to}`,
          rowSl: sl,
        });
      }
    }

    const empId = String(get(row, 'emp. id') ?? '').trim();
    const empName = String(get(row, 'emp. name') ?? '').trim();
    const empPhone = String(get(row, 'emp. phone') ?? '').trim();
    const role = String(get(row, 'role') ?? '').trim();
    const hierarchyRaw = String(get(row, 'hierarchy') ?? '').trim();
    const allowanceTypeRaw = String(get(row, 'allowance type') ?? '').trim();
    const fromRaw = String(get(row, 'from') ?? '').trim();
    const toRaw = String(get(row, 'to') ?? '').trim();
    const expenseType = String(get(row, 'expense type') ?? '').trim();
    const statusRaw = String(get(row, 'status') ?? '').trim();
    const remarks = String(get(row, 'remarks') ?? '').trim();

    // Amounts
    const submitRaw = get(row, 'submit amount');
    const payableRaw = get(row, 'payable amount');
    const submitAmount = parseNum(submitRaw);
    const payableAmount = parseNum(payableRaw);

    if (isNaN(submitAmount)) {
      messages.push({ level: 'error', message: `Row ${sl}: Non-numeric Submit Amount "${submitRaw}"`, rowSl: sl });
      continue;
    }
    if (isNaN(payableAmount)) {
      messages.push({ level: 'error', message: `Row ${sl}: Non-numeric Payable Amount "${payableRaw}"`, rowSl: sl });
      continue;
    }
    if (submitAmount < 0) {
      messages.push({ level: 'warning', message: `Row ${sl}: Negative Submit Amount ${submitAmount}`, rowSl: sl });
    }
    if (payableAmount < 0) {
      messages.push({ level: 'warning', message: `Row ${sl}: Negative Payable Amount ${payableAmount}`, rowSl: sl });
    }
    if (payableAmount > submitAmount) {
      messages.push({
        level: 'warning',
        message: `Row ${sl}: Payable (${payableAmount}) exceeds Submit (${submitAmount})`,
        rowSl: sl,
      });
    }

    // Status validation
    if (statusRaw && !KNOWN_STATUSES.includes(statusRaw as ClaimStatus)) {
      messages.push({ level: 'warning', message: `Row ${sl}: Unknown status "${statusRaw}"`, rowSl: sl });
    }

    // Allowance type validation
    if (allowanceTypeRaw && !KNOWN_ALLOWANCE_TYPES.includes(allowanceTypeRaw as AllowanceType)) {
      messages.push({ level: 'warning', message: `Row ${sl}: Unknown allowance type "${allowanceTypeRaw}"`, rowSl: sl });
    }

    const parsedHierarchy = parseHierarchy(hierarchyRaw);
    const month = toYearMonth(dateIso);

    result.push({
      sl,
      date: dateIso,
      month,
      empId,
      empName,
      empPhone,
      role,
      roleFamily: getRoleFamily(role),
      hierarchy: hierarchyRaw,
      parsedHierarchy,
      allowanceType: allowanceTypeRaw as AllowanceType,
      expenseType,
      from: fromRaw,
      to: toRaw,
      submitAmount,
      payableAmount,
      status: statusRaw as ClaimStatus,
      remarks,
    });
  }

  return { rows: result, messages };
}
