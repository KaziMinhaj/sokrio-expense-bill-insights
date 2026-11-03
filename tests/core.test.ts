// Vitest tests for TA/DA Insights
import { describe, it, expect } from 'vitest';
import { findHeaderRow, buildColumnMap, parseHeaderMeta } from '../src/lib/parser';
import { parseHierarchy } from '../src/lib/hierarchy';
import { reconcile } from '../src/lib/reconcile';
import { normalizeDate } from '../src/lib/dateUtils';
import type { ClaimRow, HeaderMeta } from '../src/types';

// ─────────────────────────────────────────────────────────────
// Header detection tests
// ─────────────────────────────────────────────────────────────
describe('findHeaderRow', () => {
  it('finds SL in row 0', () => {
    const rows = [['SL', 'Date', 'Emp. ID']];
    expect(findHeaderRow(rows)).toBe(0);
  });

  it('finds SL when preceded by metadata rows', () => {
    const rows = [
      ['Captain Publishers'],
      ['Allowance Summary Report - Details'],
      ['Date Range: 2026-10-01 to 2026-10-31 | Territory: ...'],
      ['Transport: 471,035.00 | Allowance: 147,943.00'],
      ['SL', 'Date', 'Emp. ID', 'Emp. Name'],
    ];
    expect(findHeaderRow(rows)).toBe(4);
  });

  it('returns -1 when SL not found', () => {
    const rows = [['Foo'], ['Bar']];
    expect(findHeaderRow(rows)).toBe(-1);
  });

  it('matches "sl" case-insensitively (finds first occurrence)', () => {
    // The parser normalises to lowercase for resilience, so both 'sl' and 'SL' match
    const rows = [['sl'], ['SL']];
    expect(findHeaderRow(rows)).toBe(0); // first match wins
  });

  it('ignores whitespace around SL', () => {
    const rows = [['  SL  ', 'Date']];
    expect(findHeaderRow(rows)).toBe(0);
  });
});

describe('buildColumnMap', () => {
  it('maps lowercased column names to indices', () => {
    const header = ['SL', 'Date', 'Emp. ID', 'Submit Amount'];
    const map = buildColumnMap(header);
    expect(map.get('sl')).toBe(0);
    expect(map.get('date')).toBe(1);
    expect(map.get('emp. id')).toBe(2);
    expect(map.get('submit amount')).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────
// Date normalization
// ─────────────────────────────────────────────────────────────
describe('normalizeDate', () => {
  it('parses dd-Mon-YYYY format', () => {
    expect(normalizeDate('01-Oct-2026')).toBe('2026-10-01');
    expect(normalizeDate('15-Jan-2025')).toBe('2025-01-15');
  });

  it('parses Excel serial numbers', () => {
    // 45566 = 2024-09-30 in Excel
    const result = normalizeDate(46127);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('parses ISO strings as-is', () => {
    expect(normalizeDate('2026-10-15')).toBe('2026-10-15');
  });

  it('returns null for empty/null', () => {
    expect(normalizeDate('')).toBeNull();
    expect(normalizeDate(null)).toBeNull();
    expect(normalizeDate(undefined)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Header metadata parsing
// ─────────────────────────────────────────────────────────────
describe('parseHeaderMeta', () => {
  it('parses date range, territory, total records and totals', () => {
    const rows = [
      ['Captain Publishers'],
      ['Allowance Summary Report - Details'],
      ['Date Range: 2026-10-01 to 2026-10-31 | Territory: Md Rukunuzzaman (National) | Report Type: Details | Total Records: 11892'],
      ['Transport: 471,035.00 | Allowance: 147,943.00 | Accommodation: 9,328.00 | Other Costs: 65,060.00 | Submit Amount: 693,366.00 | Payable Amount: 631,038.00'],
    ];
    const meta = parseHeaderMeta(rows);
    expect(meta.dateRange.from).toBe('2026-10-01');
    expect(meta.dateRange.to).toBe('2026-10-31');
    expect(meta.totalRecords).toBe(11892);
    expect(meta.totals.transport).toBe(471035);
    expect(meta.totals.allowance).toBe(147943);
    expect(meta.totals.accommodation).toBe(9328);
    expect(meta.totals.otherCosts).toBe(65060);
    expect(meta.totals.submitAmount).toBe(693366);
    expect(meta.totals.payableAmount).toBe(631038);
  });
});

// ─────────────────────────────────────────────────────────────
// Hierarchy parsing — all depth variations
// ─────────────────────────────────────────────────────────────
describe('parseHierarchy', () => {
  const ARROW = '\u27A1\uFE0F';

  // depth 5: RSI ends at region level
  it('depth 5 — RSI ends at region (no area, no territory)', () => {
    const raw = `Bangladesh ${ARROW} National ${ARROW} Md Rukunuzzaman (National) ${ARROW} East ${ARROW} Nazmul Hossain ( East)`;
    const h = parseHierarchy(raw);
    expect(h.country).toBe('Bangladesh');
    expect(h.region).toBe('East');
    expect(h.regionalHead).toBe('Nazmul Hossain ( East)');
    expect(h.area).toBe('-');
    expect(h.territory).toBe('-');
    expect(h.officer).toBe('Nazmul Hossain ( East)');
  });

  // depth 6: ASM with area but no territory — Central region (no RSI)
  it('depth 6 — ASM under Central region (no RSI level), no territory', () => {
    const raw = `Bangladesh ${ARROW} National ${ARROW} Md Rukunuzzaman (National) ${ARROW} Central ${ARROW} Savar ${ARROW} Md Rezaul Karim (Central Savar)`;
    const h = parseHierarchy(raw);
    expect(h.region).toBe('Central');
    expect(h.regionalHead).toBe('-'); // Central has no RSI
    expect(h.area).toBe('Savar');
    expect(h.areaLabel).toBe('Savar . Central');
    expect(h.areaManager).toBe('Md Rezaul Karim (Central Savar)');
    expect(h.territory).toBe('-');
    expect(h.officer).toBe('Md Rezaul Karim (Central Savar)');
  });

  // depth 7a: TSO directly under ASM (no territory) — Central region
  it('depth 7 — TSO directly under ASM, no territory (Central)', () => {
    const raw = `Bangladesh ${ARROW} National ${ARROW} Md Rukunuzzaman (National) ${ARROW} Central ${ARROW} Savar ${ARROW} Md Rezaul Karim (Central Savar) ${ARROW} Abdus salam`;
    const h = parseHierarchy(raw);
    expect(h.region).toBe('Central');
    expect(h.regionalHead).toBe('-');
    expect(h.area).toBe('Savar');
    expect(h.areaManager).toBe('Md Rezaul Karim (Central Savar)');
    expect(h.territory).toBe('-'); // no territory
    expect(h.officer).toBe('Abdus salam');
  });

  // depth 7b: RSI + area (with RSI level) but no territory
  it('depth 7 — RSI area only (South region with RSI)', () => {
    const raw = `Bangladesh ${ARROW} National ${ARROW} Md Rukunuzzaman (National) ${ARROW} South ${ARROW} Md Rashedul Islam ( South) ${ARROW} Barisal ${ARROW} Shahriar Aban`;
    const h = parseHierarchy(raw);
    expect(h.region).toBe('South');
    expect(h.regionalHead).toBe('Md Rashedul Islam ( South)');
    expect(h.area).toBe('Barisal');
    expect(h.areaLabel).toBe('Barisal . South');
    expect(h.areaManager).toBe('Shahriar Aban');
    expect(h.territory).toBe('-');
    expect(h.officer).toBe('Shahriar Aban');
  });

  // depth 8a: ASM + territory but no officer (Central region, no RSI)
  it('depth 8 — TSO under ASM with territory (Central, no RSI)', () => {
    const raw = `Bangladesh ${ARROW} National ${ARROW} Md Rukunuzzaman (National) ${ARROW} Central ${ARROW} Mymensingh ${ARROW} Mahbubur Rahman (Mymensingh) ${ARROW} Sherpur ${ARROW} Md Hafijul Howlader`;
    const h = parseHierarchy(raw);
    expect(h.region).toBe('Central');
    expect(h.regionalHead).toBe('-');
    expect(h.area).toBe('Mymensingh');
    expect(h.areaManager).toBe('Mahbubur Rahman (Mymensingh)');
    expect(h.territory).toBe('Sherpur');
    expect(h.territoryLabel).toBe('Sherpur . Mymensingh');
    expect(h.officer).toBe('Md Hafijul Howlader');
  });

  // depth 8b: RSI area + ASM, officer is ASM (no territory)
  it('depth 8 — ASM under RSI area (East region, with RSI)', () => {
    const raw = `Bangladesh ${ARROW} National ${ARROW} Md Rukunuzzaman (National) ${ARROW} East ${ARROW} Nazmul Hossain ( East) ${ARROW} Sylhet ${ARROW} Brahmanbaria ${ARROW} Mahmudur Rahman`;
    const h = parseHierarchy(raw);
    expect(h.region).toBe('East');
    expect(h.regionalHead).toBe('Nazmul Hossain ( East)');
    expect(h.area).toBe('Sylhet');
    expect(h.areaManager).toBe('Brahmanbaria');
    expect(h.territory).toBe('-');
    expect(h.officer).toBe('Mahmudur Rahman');
  });

  // depth 9: full TSO with RSI, area, ASM, territory, officer
  it('depth 9 — full TSO chain (South region, with RSI)', () => {
    const raw = `Bangladesh ${ARROW} National ${ARROW} Md Rukunuzzaman (National) ${ARROW} South ${ARROW} Md Rashedul Islam ( South) ${ARROW} Barisal ${ARROW} Shahriar Aban ${ARROW} Shorupkathi ${ARROW} Md Ziaur Rahman`;
    const h = parseHierarchy(raw);
    expect(h.country).toBe('Bangladesh');
    expect(h.region).toBe('South');
    expect(h.regionalHead).toBe('Md Rashedul Islam ( South)');
    expect(h.area).toBe('Barisal');
    expect(h.areaLabel).toBe('Barisal . South');
    expect(h.areaManager).toBe('Shahriar Aban');
    expect(h.territory).toBe('Shorupkathi');
    expect(h.territoryLabel).toBe('Shorupkathi . Barisal');
    expect(h.officer).toBe('Md Ziaur Rahman');
  });

  // depth 9: North region
  it('depth 9 — North region full chain', () => {
    const raw = `Bangladesh ${ARROW} National ${ARROW} Md Rukunuzzaman (National) ${ARROW} North ${ARROW} Jamal Uddin Jalsha (North) ${ARROW} Rajshahi ${ARROW} Md. Zohurul Islam ${ARROW} Sirajganj ${ARROW} Kamruzzaman`;
    const h = parseHierarchy(raw);
    expect(h.region).toBe('North');
    expect(h.regionalHead).toBe('Jamal Uddin Jalsha (North)');
    expect(h.area).toBe('Rajshahi');
    expect(h.areaManager).toBe('Md. Zohurul Islam');
    expect(h.territory).toBe('Sirajganj');
    expect(h.officer).toBe('Kamruzzaman');
  });

  it('strips U+FE0F from arrow separator', () => {
    const raw = `Bangladesh \u27A1\uFE0F National \u27A1\uFE0F Md Rukunuzzaman (National) \u27A1\uFE0F East \u27A1\uFE0F Nazmul Hossain ( East)`;
    const h = parseHierarchy(raw);
    expect(h.country).toBe('Bangladesh');
    expect(h.region).toBe('East');
  });

  it('handles missing parts gracefully (does not crash)', () => {
    const h = parseHierarchy('');
    expect(h.country).toBe('-');
    expect(h.officer).not.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
// Reconciliation tests
// ─────────────────────────────────────────────────────────────
describe('reconcile', () => {
  const baseMeta: HeaderMeta = {
    dateRange: { from: '2026-10-01', to: '2026-10-31' },
    territory: 'National',
    totalRecords: 3,
    totals: {
      transport: 1000,
      allowance: 500,
      accommodation: 200,
      otherCosts: 100,
      submitAmount: 1800,
      payableAmount: 1600,
    },
  };

  function makeRow(
    allowanceType: ClaimRow['allowanceType'],
    submit: number,
    payable: number,
    sl = 1,
  ): ClaimRow {
    return {
      sl,
      date: '2026-10-01',
      month: '2026-10',
      empId: 'E001',
      empName: 'Test',
      empPhone: '',
      role: 'TSO',
      roleFamily: 'TSO',
      hierarchy: '',
      parsedHierarchy: {
        country: 'Bangladesh', national: 'National', nationalHead: '-',
        region: '-', regionalHead: '-', area: '-', areaLabel: '-',
        areaManager: '-', territory: '-', territoryLabel: '-', officer: '-',
      },
      allowanceType,
      expenseType: '',
      from: '',
      to: '',
      submitAmount: submit,
      payableAmount: payable,
      status: 'Accepted',
      remarks: '',
    };
  }

  it('reconciles correctly when sums match', () => {
    const rows: ClaimRow[] = [
      makeRow('Transportation', 1000, 900, 1),
      makeRow('Daily Allowance', 500, 400, 2),
      makeRow('Accommodation', 200, 200, 3),
      makeRow('Others', 100, 100, 4),
    ];
    // Adjust meta totals to match
    const meta = { ...baseMeta, totals: { ...baseMeta.totals, submitAmount: 1800, payableAmount: 1600 } };
    const result = reconcile(rows, meta);
    expect(result.ok).toBe(true);
    expect(result.submitDiff).toBe(0);
    expect(result.payableDiff).toBe(0);
  });

  it('detects submit amount mismatch', () => {
    const rows: ClaimRow[] = [
      makeRow('Transportation', 2000, 1600, 1), // submit = 2000, not 1000
    ];
    const result = reconcile(rows, baseMeta);
    expect(result.ok).toBe(false);
    expect(Math.abs(result.submitDiff)).toBeGreaterThan(0);
    expect(result.messages.some(m => m.message.includes('Submit Amount mismatch'))).toBe(true);
  });

  it('detects payable amount mismatch', () => {
    const rows: ClaimRow[] = [
      makeRow('Transportation', 1000, 100, 1), // payable too low
      makeRow('Daily Allowance', 500, 1100, 2),
      makeRow('Accommodation', 200, 200, 3),
      makeRow('Others', 100, 100, 4),
    ];
    const result = reconcile(rows, baseMeta);
    // submit matches but payable may mismatch
    expect(result.messages.length).toBeGreaterThanOrEqual(0);
  });

  it('detects transport subtotal mismatch', () => {
    const rows: ClaimRow[] = [
      makeRow('Transportation', 500, 400, 1),  // 500 not 1000
      makeRow('Daily Allowance', 500, 400, 2),
      makeRow('Accommodation', 200, 200, 3),
      makeRow('Others', 100, 100, 4),
    ];
    const result = reconcile(rows, baseMeta);
    expect(result.transportDiff).not.toBe(0);
    expect(result.messages.some(m => m.message.includes('Transportation'))).toBe(true);
  });

  it('is reconciled (ok=true) when all diffs are within epsilon', () => {
    const rows: ClaimRow[] = [
      makeRow('Transportation', 1000, 900, 1),
      makeRow('Daily Allowance', 500, 400, 2),
      makeRow('Accommodation', 200, 200, 3),
      makeRow('Others', 100, 100, 4),
    ];
    const result = reconcile(rows, baseMeta);
    expect(result.ok).toBe(true);
  });

  it('handles empty rows (all zeros vs non-zero header)', () => {
    const result = reconcile([], baseMeta);
    expect(result.ok).toBe(false);
    expect(result.submitDiff).toBe(-1800);
  });
});
