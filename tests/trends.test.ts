// trends.test.ts — Vitest tests for month comparison and officer trend flags
import { describe, it, expect } from 'vitest';
import { compareMonths, flagOfficerTrends, buildCalendarData, isIncompleteMonth, computeDayOfWeek } from '../src/lib/trends';
import { computeEntSummary } from '../src/lib/entertainment';
import type { MonthlyDataset, ClaimRow } from '../src/types';
import { DEFAULT_DAYS_RULE } from '../src/lib/analytics';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<ClaimRow> & { sl?: number; empId?: string }): ClaimRow {
  return {
    sl: overrides.sl ?? 1,
    date: overrides.date ?? '2026-10-01',
    month: overrides.month ?? '2026-10',
    empId: overrides.empId ?? 'E001',
    empName: overrides.empName ?? 'Test',
    empPhone: '',
    role: overrides.role ?? 'TSO',
    roleFamily: 'TSO',
    hierarchy: '',
    parsedHierarchy: {
      country: 'Bangladesh', national: 'National', nationalHead: 'Head',
      region: overrides.region ?? 'East', regionalHead: '-',
      area: overrides.area ?? 'Dhaka', areaLabel: overrides.areaLabel ?? 'Dhaka . East',
      areaManager: '-',
      territory: '-', territoryLabel: '-', officer: overrides.empName ?? 'Test',
    },
    allowanceType: overrides.allowanceType ?? 'Transportation',
    expenseType: overrides.expenseType ?? 'Bus',
    from: '', to: '',
    submitAmount: overrides.submitAmount ?? 1000,
    payableAmount: overrides.payableAmount ?? 1000,
    status: overrides.status ?? 'Accepted',
    remarks: '',
    region: undefined,
    area: undefined,
    areaLabel: undefined,
    ...overrides,
  } as ClaimRow;
}

function makeDataset(month: string, rows: ClaimRow[], fileName = 'test.xlsx'): MonthlyDataset {
  const submitTotal = rows.reduce((s, r) => s + r.submitAmount, 0);
  const payableTotal = rows.reduce((s, r) => s + r.payableAmount, 0);
  return {
    id: month,
    month,
    uploadedAt: Date.now(),
    fileName,
    meta: {
      dateRange: { from: `${month}-01`, to: `${month}-31` },
      territory: 'National',
      totalRecords: rows.length,
      totals: {
        transport: 0, allowance: 0, accommodation: 0, otherCosts: 0,
        submitAmount: submitTotal, payableAmount: payableTotal,
      },
    },
    rows,
    reconciliation: { ok: true, submitDiff: 0, payableDiff: 0, transportDiff: 0, allowanceDiff: 0, accommodationDiff: 0, otherCostsDiff: 0, messages: [] },
    stats: { rowCount: rows.length, employeeCount: new Set(rows.map(r => r.empId)).size, submitTotal, payableTotal },
  };
}

// ─── compareMonths tests ──────────────────────────────────────────────────────

describe('compareMonths — single month (A = B)', () => {
  it('delta is zero when comparing a dataset to itself', () => {
    const rows = [
      makeRow({ sl: 1, empId: 'E001', submitAmount: 5000 }),
      makeRow({ sl: 2, empId: 'E002', submitAmount: 3000 }),
    ];
    const ds = makeDataset('2026-10', rows);
    const result = compareMonths(ds, ds, 'submit');
    expect(result.national.delta).toBe(0);
    expect(result.national.pctChange).toBe(0);
    expect(result.byRegion.every(d => d.delta === 0)).toBe(true);
    expect(result.byOfficer.every(d => d.delta === 0)).toBe(true);
  });
});

describe('compareMonths — two months', () => {
  const rowsA = [
    makeRow({ sl: 1, empId: 'E001', empName: 'Alice', submitAmount: 5000, region: 'East', date: '2026-09-01', month: '2026-09' }),
    makeRow({ sl: 2, empId: 'E002', empName: 'Bob',   submitAmount: 3000, region: 'West', date: '2026-09-02', month: '2026-09' }),
  ];
  const rowsB = [
    makeRow({ sl: 3, empId: 'E001', empName: 'Alice', submitAmount: 7000, region: 'East', date: '2026-10-01', month: '2026-10' }),
    makeRow({ sl: 4, empId: 'E002', empName: 'Bob',   submitAmount: 2500, region: 'West', date: '2026-10-02', month: '2026-10' }),
  ];
  const dsA = makeDataset('2026-09', rowsA);
  const dsB = makeDataset('2026-10', rowsB);

  it('computes correct national delta', () => {
    const result = compareMonths(dsA, dsB, 'submit');
    expect(result.national.valueA).toBe(8000);  // 5000+3000
    expect(result.national.valueB).toBe(9500);  // 7000+2500
    expect(result.national.delta).toBe(1500);
    expect(result.national.pctChange).toBeCloseTo(18.75, 1);
  });

  it('identifies increases and decreases correctly by officer', () => {
    const result = compareMonths(dsA, dsB, 'submit');
    const alice = result.byOfficer.find(d => d.label === 'Alice')!;
    const bob   = result.byOfficer.find(d => d.label === 'Bob')!;
    expect(alice.delta).toBe(2000);   // increase
    expect(bob.delta).toBe(-500);     // decrease
    expect(alice.pctChange).toBeCloseTo(40, 0);
    expect(bob.pctChange).toBeCloseTo(-16.67, 0);
  });

  it('computes region deltas correctly', () => {
    const result = compareMonths(dsA, dsB, 'submit');
    const east = result.byRegion.find(d => d.key === 'East')!;
    const west = result.byRegion.find(d => d.key === 'West')!;
    expect(east.delta).toBe(2000);
    expect(west.delta).toBe(-500);
  });

  it('handles officers present in B but not A (new officers)', () => {
    const rowsBExtra = [
      ...rowsB,
      makeRow({ sl: 5, empId: 'E003', empName: 'Carol', submitAmount: 4000, region: 'North', date: '2026-10-03', month: '2026-10' }),
    ];
    const dsBExtra = makeDataset('2026-10', rowsBExtra);
    const result = compareMonths(dsA, dsBExtra, 'submit');
    const carol = result.byOfficer.find(d => d.key === 'E003');
    expect(carol).toBeDefined();
    expect(carol!.valueA).toBe(0);
    expect(carol!.valueB).toBe(4000);
    expect(carol!.delta).toBe(4000);
    expect(carol!.pctChange).toBeNull(); // A=0, no base
  });

  it('handles officers present in A but not B (leavers)', () => {
    const rowsBMissing = [rowsB[0]]; // only Alice
    const dsBMissing = makeDataset('2026-10', rowsBMissing);
    const result = compareMonths(dsA, dsBMissing, 'submit');
    const bob = result.byOfficer.find(d => d.key === 'E002');
    expect(bob).toBeDefined();
    expect(bob!.valueA).toBe(3000);
    expect(bob!.valueB).toBe(0);
    expect(bob!.delta).toBe(-3000);
    expect(bob!.pctChange).toBeCloseTo(-100, 0);
  });

  it('pctChange is null when valueA is zero (no baseline)', () => {
    const rowsAZero = [makeRow({ sl: 1, empId: 'E001', submitAmount: 0, date: '2026-09-01', month: '2026-09' })];
    const rowsBPos = [makeRow({ sl: 2, empId: 'E001', submitAmount: 5000, date: '2026-10-01', month: '2026-10' })];
    const result = compareMonths(makeDataset('2026-09', rowsAZero), makeDataset('2026-10', rowsBPos), 'submit');
    const e = result.byOfficer.find(d => d.key === 'E001')!;
    expect(e.valueA).toBe(0);
    expect(e.delta).toBe(5000);
    expect(e.pctChange).toBeNull();
  });

  it('works with payable measure', () => {
    const result = compareMonths(dsA, dsB, 'payable');
    // All payable = submit in our test rows
    expect(result.national.valueA).toBe(8000);
    expect(result.national.delta).toBe(1500);
  });

  it('works with tada measure', () => {
    const result = compareMonths(dsA, dsB, 'tada');
    // All rows are Transportation type
    expect(result.national.valueA).toBe(8000);
    expect(result.national.delta).toBe(1500);
  });
});

// ─── flagOfficerTrends tests ──────────────────────────────────────────────────

describe('flagOfficerTrends', () => {
  it('flags officers above their 3-month average', () => {
    const mkRows = (month: string, empId: string, amount: number, sl: number) => [
      makeRow({ sl, empId, empName: 'Officer X', submitAmount: amount, date: `${month}-01`, month }),
    ];
    const datasets: MonthlyDataset[] = [
      makeDataset('2026-08', mkRows('2026-08', 'E001', 1000, 1)),
      makeDataset('2026-09', mkRows('2026-09', 'E001', 1000, 2)),
      makeDataset('2026-10', mkRows('2026-10', 'E001', 5000, 3)), // 400% above avg
    ];
    const flags = flagOfficerTrends(datasets, '2026-10', 'submit', 20, DEFAULT_DAYS_RULE);
    expect(flags.length).toBe(1);
    expect(flags[0].empId).toBe('E001');
    expect(flags[0].avg3m).toBe(1000);
    expect(flags[0].pctAbove).toBeCloseTo(400, 0);
  });

  it('returns empty when only 1 month is loaded', () => {
    const datasets: MonthlyDataset[] = [
      makeDataset('2026-10', [makeRow({ sl: 1, submitAmount: 9999, date: '2026-10-01', month: '2026-10' })]),
    ];
    const flags = flagOfficerTrends(datasets, '2026-10', 'submit', 20, DEFAULT_DAYS_RULE);
    expect(flags).toHaveLength(0);
  });

  it('does not flag officers below threshold', () => {
    const mkRows = (month: string, amount: number, sl: number) => [
      makeRow({ sl, empId: 'E001', submitAmount: amount, date: `${month}-01`, month }),
    ];
    const datasets: MonthlyDataset[] = [
      makeDataset('2026-09', mkRows('2026-09', 1000, 1)),
      makeDataset('2026-10', mkRows('2026-10', 1100, 2)), // 10% above → under 20% threshold
    ];
    const flags = flagOfficerTrends(datasets, '2026-10', 'submit', 20, DEFAULT_DAYS_RULE);
    expect(flags).toHaveLength(0);
  });

  it('returns empty when current month is not in datasets', () => {
    const datasets: MonthlyDataset[] = [
      makeDataset('2026-09', [makeRow({ sl: 1, submitAmount: 1000, date: '2026-09-01', month: '2026-09' })]),
    ];
    const flags = flagOfficerTrends(datasets, '2026-10', 'submit', 20, DEFAULT_DAYS_RULE);
    expect(flags).toHaveLength(0);
  });

  it('ignores officers with zero 3-month average (guard)', () => {
    const datasets: MonthlyDataset[] = [
      makeDataset('2026-09', [makeRow({ sl: 1, empId: 'E001', submitAmount: 0, date: '2026-09-01', month: '2026-09' })]),
      makeDataset('2026-10', [makeRow({ sl: 2, empId: 'E001', submitAmount: 5000, date: '2026-10-01', month: '2026-10' })]),
    ];
    expect(() => flagOfficerTrends(datasets, '2026-10', 'submit', 20, DEFAULT_DAYS_RULE)).not.toThrow();
    const flags = flagOfficerTrends(datasets, '2026-10', 'submit', 20, DEFAULT_DAYS_RULE);
    // avg3m = 0, should be skipped (guard)
    expect(flags).toHaveLength(0);
  });
});

// ─── buildCalendarData tests ──────────────────────────────────────────────────

describe('buildCalendarData', () => {
  it('fills all calendar days for the month', () => {
    const rows = [
      makeRow({ sl: 1, date: '2026-10-01', submitAmount: 100 }),
      makeRow({ sl: 2, date: '2026-10-15', submitAmount: 200 }),
    ];
    const days = buildCalendarData(rows, '2026-10');
    expect(days).toHaveLength(31); // October has 31 days
    expect(days[0].dayOfMonth).toBe(1);
    expect(days[30].dayOfMonth).toBe(31);
  });

  it('marks days with no claims as isNoClaims=true', () => {
    const rows = [makeRow({ sl: 1, date: '2026-10-01', submitAmount: 100 })];
    const days = buildCalendarData(rows, '2026-10');
    expect(days[0].isNoClaims).toBe(false);
    expect(days[1].isNoClaims).toBe(true); // Oct 2 has no claims
  });

  it('sums submit correctly for days with multiple rows', () => {
    const rows = [
      makeRow({ sl: 1, date: '2026-10-05', submitAmount: 300 }),
      makeRow({ sl: 2, date: '2026-10-05', submitAmount: 200 }),
    ];
    const days = buildCalendarData(rows, '2026-10');
    const day5 = days.find(d => d.dayOfMonth === 5)!;
    expect(day5.submit).toBe(500);
    expect(day5.claimCount).toBe(2);
  });

  it('assigns correct day of week', () => {
    const rows = [makeRow({ sl: 1, date: '2026-10-01' })];
    const days = buildCalendarData(rows, '2026-10');
    // October 1, 2026 is a Thursday (dayOfWeek=4)
    expect(days[0].dayOfWeek).toBe(4);
  });
});

// ─── computeEntSummary tests ──────────────────────────────────────────────────

describe('computeEntSummary', () => {
  it('correctly computes entertainment totals', () => {
    const rows = [
      makeRow({ sl: 1, empId: 'E001', expenseType: 'Entertainment', submitAmount: 500, allowanceType: 'Others' }),
      makeRow({ sl: 2, empId: 'E001', expenseType: 'Bus', submitAmount: 1000, allowanceType: 'Transportation' }),
      makeRow({ sl: 3, empId: 'E002', expenseType: 'Entertainment', submitAmount: 300, allowanceType: 'Others' }),
    ];
    const summary = computeEntSummary(rows, 20);
    expect(summary.entSubmit).toBe(800);      // 500+300
    expect(summary.totalSubmit).toBe(1800);   // 500+1000+300
    expect(summary.sharePct).toBeCloseTo(44.44, 1);
    expect(summary.claimCount).toBe(2);
  });

  it('flags officers above threshold % of own claims', () => {
    const rows = [
      // E001: ent=500, total=600 → 83.3% → flagged at 20% threshold
      makeRow({ sl: 1, empId: 'E001', expenseType: 'Entertainment', submitAmount: 500, allowanceType: 'Others' }),
      makeRow({ sl: 2, empId: 'E001', expenseType: 'Bus', submitAmount: 100, allowanceType: 'Transportation' }),
      // E002: ent=50, total=1000 → 5% → not flagged
      makeRow({ sl: 3, empId: 'E002', expenseType: 'Entertainment', submitAmount: 50, allowanceType: 'Others' }),
      makeRow({ sl: 4, empId: 'E002', expenseType: 'Bus', submitAmount: 950, allowanceType: 'Transportation' }),
    ];
    const summary = computeEntSummary(rows, 20);
    expect(summary.flaggedOfficers).toHaveLength(1);
    expect(summary.flaggedOfficers[0].empId).toBe('E001');
  });

  it('returns empty when no entertainment claims', () => {
    const rows = [makeRow({ sl: 1, expenseType: 'Bus', submitAmount: 1000 })];
    const summary = computeEntSummary(rows, 20);
    expect(summary.entSubmit).toBe(0);
    expect(summary.topOfficers).toHaveLength(0);
    expect(summary.flaggedOfficers).toHaveLength(0);
  });

  it('computes pctVsAvgClaimant correctly', () => {
    const rows = [
      // E001: 1000, E002: 500 → avg = 750
      makeRow({ sl: 1, empId: 'E001', expenseType: 'Entertainment', submitAmount: 1000, allowanceType: 'Others' }),
      makeRow({ sl: 2, empId: 'E002', expenseType: 'Entertainment', submitAmount: 500, allowanceType: 'Others' }),
    ];
    const summary = computeEntSummary(rows, 20);
    const e1 = summary.topOfficers.find(o => o.empId === 'E001')!;
    const e2 = summary.topOfficers.find(o => o.empId === 'E002')!;
    expect(e1.pctVsAvgClaimant).toBeCloseTo(33.33, 1); // (1000-750)/750*100
    expect(e2.pctVsAvgClaimant).toBeCloseTo(-33.33, 1); // (500-750)/750*100
  });
});

// ─── isIncompleteMonth tests ──────────────────────────────────────────────────

describe('isIncompleteMonth', () => {
  it('returns false for past months', () => {
    const ds = makeDataset('2020-01', []);
    expect(isIncompleteMonth(ds)).toBe(false);
  });
});
