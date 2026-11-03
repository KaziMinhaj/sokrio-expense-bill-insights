// Phase 2 Vitest tests — gap breakdown, benchmark math, days-worked rule
import { describe, it, expect } from 'vitest';
import {
  computeGapBreakdown,
  computeBenchmarks,
  computeDaysWorked,
  computeOfficerStats,
  nationalAvgPerOfficer,
  DEFAULT_DAYS_RULE,
  type DaysWorkedRule,
} from '../src/lib/analytics';
import type { ClaimRow } from '../src/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<ClaimRow> & { sl?: number }): ClaimRow {
  return {
    sl: overrides.sl ?? 1,
    date: overrides.date ?? '2026-10-01',
    month: '2026-10',
    empId: overrides.empId ?? 'E001',
    empName: overrides.empName ?? 'Test Officer',
    empPhone: '',
    role: overrides.role ?? 'TSO',
    roleFamily: overrides.roleFamily ?? 'TSO',
    hierarchy: '',
    parsedHierarchy: {
      country: 'Bangladesh', national: 'National', nationalHead: 'Head',
      region: overrides.region ?? 'East', regionalHead: '-',
      area: '-', areaLabel: '-', areaManager: '-',
      territory: '-', territoryLabel: '-', officer: overrides.empName ?? 'Test Officer',
    },
    allowanceType: overrides.allowanceType ?? 'Transportation',
    expenseType: overrides.expenseType ?? 'Bus',
    from: '', to: '',
    submitAmount: overrides.submitAmount ?? 1000,
    payableAmount: overrides.payableAmount ?? 1000,
    status: overrides.status ?? 'Accepted',
    remarks: '',
    region: undefined,
    ...overrides,
  } as ClaimRow;
}

// ─── Gap Breakdown Tests ─────────────────────────────────────────────────────

describe('computeGapBreakdown', () => {
  it('correctly attributes gap to Pending rows', () => {
    const rows = [
      makeRow({ sl: 1, status: 'Pending', submitAmount: 500, payableAmount: 0 }),
      makeRow({ sl: 2, status: 'Accepted', submitAmount: 1000, payableAmount: 1000 }),
    ];
    const gap = computeGapBreakdown(rows);
    expect(gap.pending).toBe(500);
    expect(gap.rejected).toBe(0);
    expect(gap.cancelled).toBe(0);
    expect(gap.realReductions).toBe(0);
    expect(gap.total).toBe(500);
  });

  it('correctly attributes gap to Rejected rows', () => {
    const rows = [
      makeRow({ sl: 1, status: 'Rejected', submitAmount: 300, payableAmount: 0 }),
    ];
    const gap = computeGapBreakdown(rows);
    expect(gap.rejected).toBe(300);
    expect(gap.pending).toBe(0);
  });

  it('correctly attributes gap to Cancelled rows', () => {
    const rows = [
      makeRow({ sl: 1, status: 'Cancelled', submitAmount: 200, payableAmount: 0 }),
    ];
    const gap = computeGapBreakdown(rows);
    expect(gap.cancelled).toBe(200);
  });

  it('computes real reductions on Accepted rows (submit > payable)', () => {
    const rows = [
      makeRow({ sl: 1, status: 'Accepted', submitAmount: 1000, payableAmount: 800 }),
      makeRow({ sl: 2, status: 'Approved', submitAmount: 500, payableAmount: 450 }),
    ];
    const gap = computeGapBreakdown(rows);
    expect(gap.realReductions).toBe(250); // 200 + 50
    expect(gap.pending).toBe(0);
  });

  it('does NOT count Accepted rows where payable >= submit as real reductions', () => {
    const rows = [
      makeRow({ sl: 1, status: 'Accepted', submitAmount: 1000, payableAmount: 1000 }),
    ];
    const gap = computeGapBreakdown(rows);
    expect(gap.realReductions).toBe(0);
    expect(gap.total).toBe(0);
  });

  it('sums all statuses for total', () => {
    const rows = [
      makeRow({ sl: 1, status: 'Pending', submitAmount: 500, payableAmount: 0 }),
      makeRow({ sl: 2, status: 'Rejected', submitAmount: 100, payableAmount: 0 }),
      makeRow({ sl: 3, status: 'Cancelled', submitAmount: 200, payableAmount: 0 }),
      makeRow({ sl: 4, status: 'Accepted', submitAmount: 1000, payableAmount: 900 }),
    ];
    const gap = computeGapBreakdown(rows);
    expect(gap.pending).toBe(500);
    expect(gap.rejected).toBe(100);
    expect(gap.cancelled).toBe(200);
    expect(gap.realReductions).toBe(100);
    expect(gap.total).toBe(900);
    // Verify total submit - total payable = gap.total
    const totalGap = rows.reduce((s, r) => s + r.submitAmount - r.payableAmount, 0);
    expect(gap.total).toBe(totalGap);
  });

  it('returns all zeros for empty rows', () => {
    const gap = computeGapBreakdown([]);
    expect(gap.pending).toBe(0);
    expect(gap.rejected).toBe(0);
    expect(gap.cancelled).toBe(0);
    expect(gap.realReductions).toBe(0);
    expect(gap.total).toBe(0);
  });

  it('matches sample file expected values (Oct 2026 approximation)', () => {
    // From our verification: Pending=54456, Rejected=1198, Cancelled=1808, Real=4866
    const rows = [
      makeRow({ sl: 1, status: 'Pending', submitAmount: 54456, payableAmount: 0 }),
      makeRow({ sl: 2, status: 'Rejected', submitAmount: 1198, payableAmount: 0 }),
      makeRow({ sl: 3, status: 'Cancelled', submitAmount: 1808, payableAmount: 0 }),
      makeRow({ sl: 4, status: 'Accepted', submitAmount: 10000, payableAmount: 5134 }), // real = 4866
    ];
    const gap = computeGapBreakdown(rows);
    expect(gap.pending).toBe(54456);
    expect(gap.rejected).toBe(1198);
    expect(gap.cancelled).toBe(1808);
    expect(gap.realReductions).toBe(4866);
    expect(gap.rejected + gap.cancelled).toBe(3006); // matches expected Rejected+Cancelled
  });
});

// ─── Benchmark Tests ─────────────────────────────────────────────────────────

describe('computeBenchmarks', () => {
  it('flags officers above threshold', () => {
    const rows = [
      // Officer A: 20,000 (way above national avg of ~5000)
      ...Array.from({ length: 20 }, (_, i) =>
        makeRow({ sl: i+1, empId: 'A001', empName: 'High Spender', submitAmount: 1000, payableAmount: 1000 })
      ),
      // Officer B: 2,000
      ...Array.from({ length: 2 }, (_, i) =>
        makeRow({ sl: 100+i, empId: 'B001', empName: 'Low Spender', submitAmount: 1000, payableAmount: 1000 })
      ),
    ];
    const officers = computeOfficerStats(rows, DEFAULT_DAYS_RULE);
    // A001: 20000, B001: 2000 → national avg = (20000+2000)/2 = 11000
    // A001 is 81.8% above avg → should be flagged at 20% threshold
    // B001 is 81.8% below → not flagged
    const results = computeBenchmarks(officers, 'submit', 20, 'national');
    expect(results.length).toBe(1);
    expect(results[0].officer.empId).toBe('A001');
    expect(results[0].pctOver).toBeGreaterThan(20);
  });

  it('does not flag anyone when zero average (divide-by-zero guard)', () => {
    const rows = [
      makeRow({ sl: 1, empId: 'E001', submitAmount: 0, payableAmount: 0 }),
    ];
    const officers = computeOfficerStats(rows, DEFAULT_DAYS_RULE);
    // National avg is 0 — should not crash, should skip zero-benchmark officers
    expect(() => computeBenchmarks(officers, 'submit', 20, 'national')).not.toThrow();
    const results = computeBenchmarks(officers, 'submit', 20, 'national');
    expect(results).toHaveLength(0);
  });

  it('returns no results when all are below threshold', () => {
    const rows = [
      makeRow({ sl: 1, empId: 'A001', submitAmount: 1000 }),
      makeRow({ sl: 2, empId: 'B001', submitAmount: 1050 }),
    ];
    const officers = computeOfficerStats(rows, DEFAULT_DAYS_RULE);
    const results = computeBenchmarks(officers, 'submit', 20, 'national');
    // avg = 1025, 1050/1025 = 2.4% above — under 20% threshold
    expect(results).toHaveLength(0);
  });

  it('uses role family benchmark when mode is "role"', () => {
    const rows = [
      // TSO officers
      makeRow({ sl: 1, empId: 'T001', role: 'TSO', roleFamily: 'TSO', submitAmount: 5000 }),
      makeRow({ sl: 2, empId: 'T002', role: 'TSO', roleFamily: 'TSO', submitAmount: 1000 }),
      // ASM officer — much higher but national avg is inflated by TSOs
      makeRow({ sl: 3, empId: 'A001', role: 'ASM', roleFamily: 'ASM', submitAmount: 20000 }),
    ];
    const officers = computeOfficerStats(rows, DEFAULT_DAYS_RULE);
    // Role family mode: ASM benchmark = 20000/1 = 20000 → pctOver = 0 → not flagged
    const roleResults = computeBenchmarks(officers, 'submit', 20, 'role');
    const asmFlagged = roleResults.some(r => r.officer.empId === 'A001');
    expect(asmFlagged).toBe(false);
    // But T001 IS above TSO family avg (avg = 3000, T001 = 5000 → 66.7% over)
    const tsoFlagged = roleResults.some(r => r.officer.empId === 'T001');
    expect(tsoFlagged).toBe(true);
  });

  it('respects custom threshold', () => {
    const rows = [
      makeRow({ sl: 1, empId: 'A001', submitAmount: 1200 }),
      makeRow({ sl: 2, empId: 'B001', submitAmount: 1000 }),
    ];
    const officers = computeOfficerStats(rows, DEFAULT_DAYS_RULE);
    // avg = 1100, A001 is 9.1% above
    const results10 = computeBenchmarks(officers, 'submit', 10, 'national');
    expect(results10).toHaveLength(0); // 9.1% < 10%

    // Lower threshold to 5%
    const results5 = computeBenchmarks(officers, 'submit', 5, 'national');
    expect(results5).toHaveLength(1);
    expect(results5[0].officer.empId).toBe('A001');
  });

  it('nationalAvgPerOfficer returns 0 for empty array', () => {
    expect(nationalAvgPerOfficer([], 'submit')).toBe(0);
  });
});

// ─── Days Worked Tests ────────────────────────────────────────────────────────

describe('computeDaysWorked', () => {
  const rule: DaysWorkedRule = {
    includeTransportation: true,
    includeDailyAllowance: true,
    excludeStatuses: ['Rejected', 'Cancelled'],
  };

  it('counts distinct dates with Transportation claims', () => {
    const rows = [
      makeRow({ sl: 1, empId: 'E001', date: '2026-10-01', allowanceType: 'Transportation', status: 'Accepted' }),
      makeRow({ sl: 2, empId: 'E001', date: '2026-10-01', allowanceType: 'Transportation', status: 'Accepted' }), // same day
      makeRow({ sl: 3, empId: 'E001', date: '2026-10-02', allowanceType: 'Transportation', status: 'Accepted' }),
    ];
    expect(computeDaysWorked(rows, 'E001', rule)).toBe(2); // 2 distinct dates
  });

  it('counts dates with Daily Allowance claims', () => {
    const rows = [
      makeRow({ sl: 1, empId: 'E001', date: '2026-10-05', allowanceType: 'Daily Allowance', status: 'Accepted' }),
    ];
    expect(computeDaysWorked(rows, 'E001', rule)).toBe(1);
  });

  it('does NOT count Rejected claims', () => {
    const rows = [
      makeRow({ sl: 1, empId: 'E001', date: '2026-10-01', allowanceType: 'Transportation', status: 'Rejected' }),
      makeRow({ sl: 2, empId: 'E001', date: '2026-10-02', allowanceType: 'Transportation', status: 'Accepted' }),
    ];
    expect(computeDaysWorked(rows, 'E001', rule)).toBe(1); // only Oct 2
  });

  it('does NOT count Cancelled claims', () => {
    const rows = [
      makeRow({ sl: 1, empId: 'E001', date: '2026-10-01', allowanceType: 'Daily Allowance', status: 'Cancelled' }),
      makeRow({ sl: 2, empId: 'E001', date: '2026-10-02', allowanceType: 'Daily Allowance', status: 'Accepted' }),
    ];
    expect(computeDaysWorked(rows, 'E001', rule)).toBe(1);
  });

  it('counts Pending claims as working days', () => {
    const rows = [
      makeRow({ sl: 1, empId: 'E001', date: '2026-10-10', allowanceType: 'Transportation', status: 'Pending' }),
    ];
    expect(computeDaysWorked(rows, 'E001', rule)).toBe(1); // Pending is not excluded
  });

  it('does NOT count Accommodation or Others claim dates', () => {
    const rows = [
      makeRow({ sl: 1, empId: 'E001', date: '2026-10-01', allowanceType: 'Accommodation', status: 'Accepted' }),
      makeRow({ sl: 2, empId: 'E001', date: '2026-10-02', allowanceType: 'Others', status: 'Accepted' }),
    ];
    expect(computeDaysWorked(rows, 'E001', rule)).toBe(0);
  });

  it('only counts rows matching the specified empId', () => {
    const rows = [
      makeRow({ sl: 1, empId: 'E001', date: '2026-10-01', allowanceType: 'Transportation', status: 'Accepted' }),
      makeRow({ sl: 2, empId: 'E002', date: '2026-10-02', allowanceType: 'Transportation', status: 'Accepted' }),
    ];
    expect(computeDaysWorked(rows, 'E001', rule)).toBe(1);
    expect(computeDaysWorked(rows, 'E002', rule)).toBe(1);
  });

  it('returns 0 for officer with no matching rows', () => {
    const rows = [
      makeRow({ sl: 1, empId: 'E001', date: '2026-10-01', allowanceType: 'Transportation', status: 'Accepted' }),
    ];
    expect(computeDaysWorked(rows, 'NOBODY', rule)).toBe(0);
  });

  it('respects rule: when Transportation is disabled, does not count TA dates', () => {
    const noTaRule: DaysWorkedRule = { ...rule, includeTransportation: false };
    const rows = [
      makeRow({ sl: 1, empId: 'E001', date: '2026-10-01', allowanceType: 'Transportation', status: 'Accepted' }),
      makeRow({ sl: 2, empId: 'E001', date: '2026-10-02', allowanceType: 'Daily Allowance', status: 'Accepted' }),
    ];
    expect(computeDaysWorked(rows, 'E001', noTaRule)).toBe(1); // only DA date counts
  });

  it('respects rule: when Daily Allowance is disabled, does not count DA dates', () => {
    const noDaRule: DaysWorkedRule = { ...rule, includeDailyAllowance: false };
    const rows = [
      makeRow({ sl: 1, empId: 'E001', date: '2026-10-01', allowanceType: 'Transportation', status: 'Accepted' }),
      makeRow({ sl: 2, empId: 'E001', date: '2026-10-02', allowanceType: 'Daily Allowance', status: 'Accepted' }),
    ];
    expect(computeDaysWorked(rows, 'E001', noDaRule)).toBe(1); // only TA date counts
  });

  it('excludeStatuses: when Pending is added to exclude list, Pending claims do not count', () => {
    const strictRule: DaysWorkedRule = { ...rule, excludeStatuses: ['Rejected', 'Cancelled', 'Pending'] };
    const rows = [
      makeRow({ sl: 1, empId: 'E001', date: '2026-10-10', allowanceType: 'Transportation', status: 'Pending' }),
      makeRow({ sl: 2, empId: 'E001', date: '2026-10-11', allowanceType: 'Transportation', status: 'Accepted' }),
    ];
    expect(computeDaysWorked(rows, 'E001', strictRule)).toBe(1); // only Accepted date
  });

  it('handles a mix of days correctly', () => {
    const rows = [
      makeRow({ sl: 1, empId: 'E001', date: '2026-10-01', allowanceType: 'Transportation', status: 'Accepted' }),
      makeRow({ sl: 2, empId: 'E001', date: '2026-10-01', allowanceType: 'Daily Allowance', status: 'Accepted' }), // same day
      makeRow({ sl: 3, empId: 'E001', date: '2026-10-03', allowanceType: 'Transportation', status: 'Rejected' }), // excluded
      makeRow({ sl: 4, empId: 'E001', date: '2026-10-05', allowanceType: 'Transportation', status: 'Approved' }),
      makeRow({ sl: 5, empId: 'E001', date: '2026-10-05', allowanceType: 'Accommodation', status: 'Accepted' }), // not counted
      makeRow({ sl: 6, empId: 'E001', date: '2026-10-10', allowanceType: 'Daily Allowance', status: 'Pending' }),
    ];
    // Distinct valid dates: Oct 1, Oct 5, Oct 10 = 3
    expect(computeDaysWorked(rows, 'E001', rule)).toBe(3);
  });
});

// ─── computeOfficerStats integration test ───────────────────────────────────

describe('computeOfficerStats', () => {
  it('aggregates totals correctly per officer', () => {
    const rows = [
      makeRow({ sl: 1, empId: 'A001', allowanceType: 'Transportation', submitAmount: 200, payableAmount: 200, status: 'Accepted', date: '2026-10-01' }),
      makeRow({ sl: 2, empId: 'A001', allowanceType: 'Daily Allowance', submitAmount: 100, payableAmount: 100, status: 'Accepted', date: '2026-10-02' }),
      makeRow({ sl: 3, empId: 'A001', allowanceType: 'Accommodation', submitAmount: 50, payableAmount: 50, status: 'Accepted', date: '2026-10-01' }),
      makeRow({ sl: 4, empId: 'B001', allowanceType: 'Transportation', submitAmount: 300, payableAmount: 300, status: 'Accepted', date: '2026-10-01' }),
    ];
    const stats = computeOfficerStats(rows, DEFAULT_DAYS_RULE);
    const a = stats.find(s => s.empId === 'A001')!;
    const b = stats.find(s => s.empId === 'B001')!;

    expect(stats).toHaveLength(2);
    expect(a.submitTotal).toBe(350); // 200+100+50
    expect(a.transportTotal).toBe(200);
    expect(a.daTotal).toBe(100);
    expect(a.accommodationTotal).toBe(50);
    expect(a.daysWorked).toBe(2); // Oct 1 (TA) + Oct 2 (DA)
    expect(b.submitTotal).toBe(300);
    expect(b.daysWorked).toBe(1);
  });
});
