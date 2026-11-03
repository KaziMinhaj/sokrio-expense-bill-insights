// analytics.ts — Core analytics computations for TA/DA Insights
import type { ClaimRow, MonthlyDataset } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type Measure =
  | 'submit'
  | 'payable'
  | 'tada'
  | 'transport'
  | 'da'
  | 'accommodation'
  | 'others'
  | 'entertainment';

export const MEASURES: { value: Measure; label: string }[] = [
  { value: 'submit', label: 'Submit Amount' },
  { value: 'payable', label: 'Payable Amount' },
  { value: 'tada', label: 'TA + DA' },
  { value: 'transport', label: 'Transportation' },
  { value: 'da', label: 'Daily Allowance' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'others', label: 'Others' },
  { value: 'entertainment', label: 'Entertainment' },
];

export interface GapBreakdown {
  pending: number;
  rejected: number;
  cancelled: number;
  realReductions: number; // (submit - payable) on Accepted + Approved
  total: number;
}

export interface DaysWorkedRule {
  includeTransportation: boolean;
  includeDailyAllowance: boolean;
  excludeStatuses: string[]; // default: ['Rejected','Cancelled']
}

export const DEFAULT_DAYS_RULE: DaysWorkedRule = {
  includeTransportation: true,
  includeDailyAllowance: true,
  excludeStatuses: ['Rejected', 'Cancelled'],
};

export interface OfficerStats {
  empId: string;
  empName: string;
  role: string;
  roleFamily: string;
  region: string;
  area: string;
  areaLabel: string;
  territory: string;
  territoryLabel: string;
  daysWorked: number;
  rowCount: number;
  submitTotal: number;
  payableTotal: number;
  transportTotal: number;
  daTotal: number;
  accommodationTotal: number;
  othersTotal: number;
  entertainmentTotal: number;
}

export interface GroupStats {
  label: string;
  rawLabel: string; // for linking
  officerCount: number;
  rowCount: number;
  submitTotal: number;
  payableTotal: number;
  transportTotal: number;
  daTotal: number;
  accommodationTotal: number;
  othersTotal: number;
  avgPerOfficer: number; // of chosen measure
  officers: OfficerStats[];
}

export interface BenchmarkResult {
  officer: OfficerStats;
  value: number;
  benchmark: number;
  pctOver: number;
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  submit: number;
  payable: number;
}

// ─── Row-level measure extractor ─────────────────────────────────────────────

export function rowMeasure(row: ClaimRow, measure: Measure): number {
  switch (measure) {
    case 'submit': return row.submitAmount;
    case 'payable': return row.payableAmount;
    case 'transport': return row.allowanceType === 'Transportation' ? row.submitAmount : 0;
    case 'da': return row.allowanceType === 'Daily Allowance' ? row.submitAmount : 0;
    case 'accommodation': return row.allowanceType === 'Accommodation' ? row.submitAmount : 0;
    case 'others': return row.allowanceType === 'Others' ? row.submitAmount : 0;
    case 'tada':
      return (row.allowanceType === 'Transportation' || row.allowanceType === 'Daily Allowance')
        ? row.submitAmount : 0;
    case 'entertainment':
      return row.expenseType === 'Entertainment' ? row.submitAmount : 0;
  }
}

// ─── Gap breakdown ────────────────────────────────────────────────────────────

export function computeGapBreakdown(rows: ClaimRow[]): GapBreakdown {
  let pending = 0, rejected = 0, cancelled = 0, realReductions = 0;
  for (const r of rows) {
    const gap = r.submitAmount - r.payableAmount;
    if (r.status === 'Pending')   pending   += gap;
    if (r.status === 'Rejected')  rejected  += gap;
    if (r.status === 'Cancelled') cancelled += gap;
    if ((r.status === 'Accepted' || r.status === 'Approved') && gap > 0)
      realReductions += gap;
  }
  return {
    pending,
    rejected,
    cancelled,
    realReductions,
    total: pending + rejected + cancelled + realReductions,
  };
}

// ─── Days worked ──────────────────────────────────────────────────────────────

export function computeDaysWorked(
  rows: ClaimRow[],
  empId: string,
  rule: DaysWorkedRule = DEFAULT_DAYS_RULE,
): number {
  const dates = new Set<string>();
  for (const r of rows) {
    if (r.empId !== empId) continue;
    if (rule.excludeStatuses.includes(r.status)) continue;
    const isTA = rule.includeTransportation && r.allowanceType === 'Transportation';
    const isDA = rule.includeDailyAllowance && r.allowanceType === 'Daily Allowance';
    if (isTA || isDA) dates.add(r.date);
  }
  return dates.size;
}

// ─── Officer stats ────────────────────────────────────────────────────────────

export function computeOfficerStats(
  rows: ClaimRow[],
  rule: DaysWorkedRule = DEFAULT_DAYS_RULE,
): OfficerStats[] {
  const map = new Map<string, OfficerStats>();

  for (const r of rows) {
    if (!map.has(r.empId)) {
      const h = r.parsedHierarchy;
      map.set(r.empId, {
        empId: r.empId,
        empName: r.empName,
        role: r.role,
        roleFamily: r.roleFamily,
        region: h.region,
        area: h.area,
        areaLabel: h.areaLabel,
        territory: h.territory,
        territoryLabel: h.territoryLabel,
        daysWorked: 0,
        rowCount: 0,
        submitTotal: 0,
        payableTotal: 0,
        transportTotal: 0,
        daTotal: 0,
        accommodationTotal: 0,
        othersTotal: 0,
        entertainmentTotal: 0,
      });
    }
    const s = map.get(r.empId)!;
    s.rowCount++;
    s.submitTotal += r.submitAmount;
    s.payableTotal += r.payableAmount;
    if (r.allowanceType === 'Transportation') s.transportTotal += r.submitAmount;
    if (r.allowanceType === 'Daily Allowance') s.daTotal += r.submitAmount;
    if (r.allowanceType === 'Accommodation') s.accommodationTotal += r.submitAmount;
    if (r.allowanceType === 'Others') s.othersTotal += r.submitAmount;
    if (r.expenseType === 'Entertainment') s.entertainmentTotal += r.submitAmount;
  }

  // Now compute days worked per officer
  for (const [empId, stats] of map) {
    stats.daysWorked = computeDaysWorked(rows, empId, rule);
  }

  return Array.from(map.values());
}

export function officerMeasureValue(s: OfficerStats, measure: Measure): number {
  switch (measure) {
    case 'submit': return s.submitTotal;
    case 'payable': return s.payableTotal;
    case 'transport': return s.transportTotal;
    case 'da': return s.daTotal;
    case 'accommodation': return s.accommodationTotal;
    case 'others': return s.othersTotal;
    case 'entertainment': return s.entertainmentTotal;
    case 'tada': return s.transportTotal + s.daTotal;
  }
}

// ─── Group (region/area/territory) stats ─────────────────────────────────────

export function groupByRegion(officers: OfficerStats[], measure: Measure): GroupStats[] {
  const map = new Map<string, GroupStats>();
  for (const o of officers) {
    const key = o.region || '-';
    if (!map.has(key)) map.set(key, emptyGroup(key));
    addOfficerToGroup(map.get(key)!, o, measure);
  }
  return finalizeGroups(Array.from(map.values()), measure);
}

export function groupByArea(officers: OfficerStats[], measure: Measure, region?: string): GroupStats[] {
  const map = new Map<string, GroupStats>();
  const filtered = region ? officers.filter(o => o.region === region) : officers;
  for (const o of filtered) {
    const key = o.areaLabel || '-';
    if (!map.has(key)) map.set(key, emptyGroup(key, o.area));
    addOfficerToGroup(map.get(key)!, o, measure);
  }
  return finalizeGroups(Array.from(map.values()), measure);
}

export function groupByTerritory(officers: OfficerStats[], measure: Measure, area?: string): GroupStats[] {
  const map = new Map<string, GroupStats>();
  const filtered = area ? officers.filter(o => o.areaLabel === area) : officers;
  for (const o of filtered) {
    const key = o.territoryLabel || '-';
    if (!map.has(key)) map.set(key, emptyGroup(key, o.territory));
    addOfficerToGroup(map.get(key)!, o, measure);
  }
  return finalizeGroups(Array.from(map.values()), measure);
}

function emptyGroup(label: string, rawLabel?: string): GroupStats {
  return {
    label,
    rawLabel: rawLabel ?? label,
    officerCount: 0,
    rowCount: 0,
    submitTotal: 0,
    payableTotal: 0,
    transportTotal: 0,
    daTotal: 0,
    accommodationTotal: 0,
    othersTotal: 0,
    avgPerOfficer: 0,
    officers: [],
  };
}

function addOfficerToGroup(g: GroupStats, o: OfficerStats, _measure: Measure) {
  g.officerCount++;
  g.rowCount += o.rowCount;
  g.submitTotal += o.submitTotal;
  g.payableTotal += o.payableTotal;
  g.transportTotal += o.transportTotal;
  g.daTotal += o.daTotal;
  g.accommodationTotal += o.accommodationTotal;
  g.othersTotal += o.othersTotal;
  g.officers.push(o);
}

function groupMeasureTotal(g: GroupStats, measure: Measure): number {
  switch (measure) {
    case 'submit': return g.submitTotal;
    case 'payable': return g.payableTotal;
    case 'transport': return g.transportTotal;
    case 'da': return g.daTotal;
    case 'accommodation': return g.accommodationTotal;
    case 'others': return g.othersTotal;
    case 'tada': return g.transportTotal + g.daTotal;
    case 'entertainment': return g.officers.reduce((s, o) => s + o.entertainmentTotal, 0);
  }
}

function finalizeGroups(groups: GroupStats[], measure: Measure): GroupStats[] {
  for (const g of groups) {
    const total = groupMeasureTotal(g, measure);
    g.avgPerOfficer = g.officerCount > 0 ? total / g.officerCount : 0;
  }
  return groups.sort((a, b) => groupMeasureTotal(b, measure) - groupMeasureTotal(a, measure));
}

// ─── Benchmark ────────────────────────────────────────────────────────────────

export function computeBenchmarks(
  officers: OfficerStats[],
  measure: Measure,
  threshold: number = 20, // percent
  compareMode: 'national' | 'role' = 'national',
): BenchmarkResult[] {
  const getValue = (o: OfficerStats) => officerMeasureValue(o, measure);

  // Compute benchmark per comparison mode
  const getBenchmark = (o: OfficerStats): number => {
    if (compareMode === 'national') {
      const total = officers.reduce((s, x) => s + getValue(x), 0);
      return officers.length > 0 ? total / officers.length : 0;
    } else {
      // role family benchmark
      const peers = officers.filter(x => x.roleFamily === o.roleFamily);
      if (peers.length === 0) return 0;
      return peers.reduce((s, x) => s + getValue(x), 0) / peers.length;
    }
  };

  const results: BenchmarkResult[] = [];
  for (const o of officers) {
    const value = getValue(o);
    const benchmark = getBenchmark(o);
    if (benchmark <= 0) continue; // avoid divide-by-zero
    const pctOver = ((value - benchmark) / benchmark) * 100;
    if (pctOver > threshold) {
      results.push({ officer: o, value, benchmark, pctOver });
    }
  }
  return results.sort((a, b) => b.pctOver - a.pctOver);
}

// ─── National average per officer ────────────────────────────────────────────

export function nationalAvgPerOfficer(officers: OfficerStats[], measure: Measure): number {
  if (officers.length === 0) return 0;
  const total = officers.reduce((s, o) => s + officerMeasureValue(o, measure), 0);
  return total / officers.length;
}

// ─── Daily trend ─────────────────────────────────────────────────────────────

export function computeDailyTrend(rows: ClaimRow[]): DailyPoint[] {
  const map = new Map<string, { submit: number; payable: number }>();
  for (const r of rows) {
    if (!map.has(r.date)) map.set(r.date, { submit: 0, payable: 0 });
    const d = map.get(r.date)!;
    d.submit += r.submitAmount;
    d.payable += r.payableAmount;
  }

  // Fill all calendar days of the month with zeros
  const dates = Array.from(map.keys()).sort();
  if (dates.length === 0) return [];
  const firstDate = dates[0];
  const month = firstDate.slice(0, 7);
  const daysInMonth = new Date(
    parseInt(month.slice(0, 4)),
    parseInt(month.slice(5, 7)),
    0,
  ).getDate();

  const result: DailyPoint[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    const v = map.get(dateStr) ?? { submit: 0, payable: 0 };
    result.push({ date: dateStr, submit: v.submit, payable: v.payable });
  }
  return result;
}

// ─── Cost mix (for doughnut) ─────────────────────────────────────────────────

export interface CostMixItem {
  name: string;
  value: number;
  color: string;
}

export function computeCostMix(rows: ClaimRow[]): CostMixItem[] {
  let transport = 0, da = 0, accommodation = 0, others = 0;
  for (const r of rows) {
    if (r.allowanceType === 'Transportation') transport += r.submitAmount;
    if (r.allowanceType === 'Daily Allowance') da += r.submitAmount;
    if (r.allowanceType === 'Accommodation') accommodation += r.submitAmount;
    if (r.allowanceType === 'Others') others += r.submitAmount;
  }
  return [
    { name: 'Transport', value: transport, color: '#3b82f6' },
    { name: 'Daily Allow.', value: da, color: '#10b981' },
    { name: 'Accommodation', value: accommodation, color: '#f59e0b' },
    { name: 'Others', value: others, color: '#8b5cf6' },
  ].filter(x => x.value > 0);
}

// ─── Status mix (for doughnut by submitted amount) ────────────────────────────

export interface StatusMixItem {
  name: string;
  value: number;
  color: string;
}

export function computeStatusMix(rows: ClaimRow[]): StatusMixItem[] {
  const STATUS_COLORS: Record<string, string> = {
    Accepted: '#10b981',
    Approved: '#3b82f6',
    Pending: '#f59e0b',
    Rejected: '#ef4444',
    Cancelled: '#6b7280',
  };
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.status, (map.get(r.status) ?? 0) + r.submitAmount);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] ?? '#94a3b8' }))
    .sort((a, b) => b.value - a.value);
}

// ─── Plain-English insights ───────────────────────────────────────────────────

export function generateInsights(
  rows: ClaimRow[],
  officers: OfficerStats[],
  regionGroups: GroupStats[],
  areaGroups: GroupStats[],
  territoryGroups: GroupStats[],
  gap: GapBreakdown,
  measure: Measure,
  benchmarkThreshold: number,
): string[] {
  const bullets: string[] = [];
  const fmt = (n: number) => `Tk ${Math.round(n).toLocaleString('en-IN')}`;
  const pct = (n: number) => `${n.toFixed(1)}%`;

  const totalSubmit = rows.reduce((s, r) => s + r.submitAmount, 0);
  const nationalAvg = nationalAvgPerOfficer(officers, measure);

  // 1. Top region by total
  if (regionGroups.length > 0) {
    const top = regionGroups[0];
    const total = groupMeasureTotal(top, measure);
    bullets.push(
      `${top.label} leads all regions with ${fmt(total)} (${top.officerCount} officers, avg ${fmt(top.avgPerOfficer)} each).`,
    );
  }

  // 2. Top area by average per officer
  if (areaGroups.length > 0) {
    const topAvg = [...areaGroups].sort((a, b) => b.avgPerOfficer - a.avgPerOfficer)[0];
    bullets.push(
      `${topAvg.label} has the highest area average per officer at ${fmt(topAvg.avgPerOfficer)}.`,
    );
  }

  // 3. Top territory
  if (territoryGroups.length > 0) {
    const validTerr = territoryGroups.filter(g => g.label !== '-');
    if (validTerr.length > 0) {
      const top = validTerr[0];
      bullets.push(
        `Top territory by total is ${top.label} at ${fmt(groupMeasureTotal(top, measure))}.`,
      );
    }
  }

  // 4. Officers above benchmark
  const benchmarks = computeBenchmarks(officers, measure, benchmarkThreshold, 'national');
  if (benchmarks.length > 0) {
    const names = benchmarks.slice(0, 3).map(b => b.officer.empName).join(', ');
    bullets.push(
      `${benchmarks.length} officer${benchmarks.length > 1 ? 's' : ''} exceed the national benchmark by >${benchmarkThreshold}%: ${names}${benchmarks.length > 3 ? `, and ${benchmarks.length - 3} more` : ''}.`,
    );
  } else {
    bullets.push(`No officers exceed the national ${measure} benchmark by more than ${benchmarkThreshold}%.`);
  }

  // 5. Gap breakdown by status
  const gapTotal = gap.total;
  if (gapTotal > 0) {
    const pendPct = (gap.pending / gapTotal * 100).toFixed(0);
    const rejCan = gap.rejected + gap.cancelled;
    bullets.push(
      `The submit–payable gap of ${fmt(gapTotal)} breaks down as: Pending ${fmt(gap.pending)} (${pendPct}%), Rejected+Cancelled ${fmt(rejCan)}, real reductions on settled claims ${fmt(gap.realReductions)}.`,
    );
  }

  // 6. Average working days
  const avgDays = officers.filter(o => o.daysWorked > 0).reduce((s, o) => s + o.daysWorked, 0) /
    Math.max(1, officers.filter(o => o.daysWorked > 0).length);
  bullets.push(
    `Officers averaged ${avgDays.toFixed(1)} working days this month (days with ≥1 TA or DA claim accepted/approved/pending).`,
  );

  // 7. Entertainment share
  const entTotal = rows.filter(r => r.expenseType === 'Entertainment').reduce((s, r) => s + r.submitAmount, 0);
  if (totalSubmit > 0) {
    bullets.push(
      `Entertainment expense is ${fmt(entTotal)} — ${pct(entTotal / totalSubmit * 100)} of total submitted.`,
    );
  }

  // 8. National average
  if (nationalAvg > 0) {
    bullets.push(
      `National average ${MEASURES.find(m => m.value === measure)?.label ?? measure} per officer: ${fmt(nationalAvg)}.`,
    );
  }

  return bullets;
}

export { groupMeasureTotal };
