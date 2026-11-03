// trends.ts — Month-comparison and multi-month trend analytics
import type { ClaimRow, MonthlyDataset } from '../types';
import {
  computeOfficerStats,
  groupByRegion,
  groupByArea,
  groupByTerritory,
  officerMeasureValue,
  groupMeasureTotal,
  nationalAvgPerOfficer,
  rowMeasure,
  type Measure,
  type OfficerStats,
  type GroupStats,
  type DaysWorkedRule,
  DEFAULT_DAYS_RULE,
} from './analytics';

// ─── Month-comparison types ──────────────────────────────────────────────────

export interface MonthDelta {
  label: string;
  key: string;           // empId, region name, etc.
  valueA: number;
  valueB: number;
  delta: number;         // B - A
  pctChange: number | null; // null when A=0
}

export interface ComparisonResult {
  monthA: string;
  monthB: string;
  measure: Measure;
  national: MonthDelta;
  byRegion: MonthDelta[];
  byArea: MonthDelta[];
  byTerritory: MonthDelta[];
  byOfficer: MonthDelta[];
}

// ─── Month comparison ────────────────────────────────────────────────────────

function groupsToMap(groups: GroupStats[], measure: Measure): Map<string, number> {
  const m = new Map<string, number>();
  for (const g of groups) m.set(g.label, groupMeasureTotal(g, measure));
  return m;
}

function officersToMap(officers: OfficerStats[], measure: Measure): Map<string, { label: string; value: number }> {
  const m = new Map<string, { label: string; value: number }>();
  for (const o of officers) m.set(o.empId, { label: o.empName, value: officerMeasureValue(o, measure) });
  return m;
}

function buildDeltas(
  aMap: Map<string, number>,
  bMap: Map<string, number>,
  labelMap?: Map<string, string>,
): MonthDelta[] {
  const keys = new Set([...aMap.keys(), ...bMap.keys()]);
  const result: MonthDelta[] = [];
  for (const key of keys) {
    const valueA = aMap.get(key) ?? 0;
    const valueB = bMap.get(key) ?? 0;
    const delta = valueB - valueA;
    const pctChange = valueA > 0 ? (delta / valueA) * 100 : null;
    result.push({ label: labelMap?.get(key) ?? key, key, valueA, valueB, delta, pctChange });
  }
  return result.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export function compareMonths(
  datasetA: MonthlyDataset,
  datasetB: MonthlyDataset,
  measure: Measure,
  rule: DaysWorkedRule = DEFAULT_DAYS_RULE,
): ComparisonResult {
  const offA = computeOfficerStats(datasetA.rows, rule);
  const offB = computeOfficerStats(datasetB.rows, rule);

  const regA = groupsToMap(groupByRegion(offA, measure), measure);
  const regB = groupsToMap(groupByRegion(offB, measure), measure);
  const areaA = groupsToMap(groupByArea(offA, measure), measure);
  const areaB = groupsToMap(groupByArea(offB, measure), measure);
  const terrA = groupsToMap(groupByTerritory(offA, measure), measure);
  const terrB = groupsToMap(groupByTerritory(offB, measure), measure);

  // Officer maps: key = empId, value = value
  const offAMap = new Map<string, number>();
  const offBMap = new Map<string, number>();
  const labelMap = new Map<string, string>();
  for (const o of offA) { offAMap.set(o.empId, officerMeasureValue(o, measure)); labelMap.set(o.empId, o.empName); }
  for (const o of offB) { offBMap.set(o.empId, officerMeasureValue(o, measure)); labelMap.set(o.empId, o.empName); }

  const natA = datasetA.rows.reduce((s, r) => s + rowMeasure(r, measure), 0);
  const natB = datasetB.rows.reduce((s, r) => s + rowMeasure(r, measure), 0);
  const natDelta = natB - natA;

  return {
    monthA: datasetA.month,
    monthB: datasetB.month,
    measure,
    national: {
      label: 'National',
      key: 'national',
      valueA: natA,
      valueB: natB,
      delta: natDelta,
      pctChange: natA > 0 ? (natDelta / natA) * 100 : null,
    },
    byRegion: buildDeltas(regA, regB),
    byArea: buildDeltas(areaA, areaB),
    byTerritory: buildDeltas(terrA, terrB),
    byOfficer: buildDeltas(offAMap, offBMap, labelMap),
  };
}

// ─── Multi-month series ──────────────────────────────────────────────────────

export interface MonthlyPoint {
  month: string;        // YYYY-MM
  value: number;
}

export interface SeriesPoint {
  month: string;
  transport: number;
  da: number;
  accommodation: number;
  others: number;
  total: number;
}

export interface RegionSeriesPoint {
  month: string;
  [region: string]: number | string; // region name → value, plus 'month'
}

export function buildMonthSeries(
  datasets: MonthlyDataset[],
  measure: Measure,
): MonthlyPoint[] {
  return datasets
    .slice()
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(d => ({
      month: d.month,
      value: d.rows.reduce((s, r) => s + rowMeasure(r, measure), 0),
    }));
}

export function buildStackedSeries(datasets: MonthlyDataset[]): SeriesPoint[] {
  return datasets
    .slice()
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(d => {
      let transport = 0, da = 0, accommodation = 0, others = 0;
      for (const r of d.rows) {
        if (r.allowanceType === 'Transportation') transport += r.submitAmount;
        else if (r.allowanceType === 'Daily Allowance') da += r.submitAmount;
        else if (r.allowanceType === 'Accommodation') accommodation += r.submitAmount;
        else others += r.submitAmount;
      }
      return { month: d.month, transport, da, accommodation, others, total: transport + da + accommodation + others };
    });
}

export function buildRegionSeries(
  datasets: MonthlyDataset[],
  measure: Measure,
  rule: DaysWorkedRule = DEFAULT_DAYS_RULE,
): { series: RegionSeriesPoint[]; regions: string[] } {
  const sorted = datasets.slice().sort((a, b) => a.month.localeCompare(b.month));
  const regionSet = new Set<string>();

  // Collect all region names
  for (const d of sorted) {
    for (const r of d.rows) {
      const reg = r.parsedHierarchy.region;
      if (reg && reg !== '-') regionSet.add(reg);
    }
  }
  const regions = Array.from(regionSet).sort();

  const series: RegionSeriesPoint[] = sorted.map(d => {
    const officers = computeOfficerStats(d.rows, rule);
    const groups = groupByRegion(officers, measure);
    const point: RegionSeriesPoint = { month: d.month };
    for (const region of regions) {
      const g = groups.find(g => g.label === region);
      point[region] = g ? groupMeasureTotal(g, measure) : 0;
    }
    return point;
  });

  return { series, regions };
}

// ─── Officer personal trend flag ─────────────────────────────────────────────

export interface OfficerTrendFlag {
  empId: string;
  empName: string;
  role: string;
  region: string;
  currentValue: number;
  avg3m: number;
  pctAbove: number;
}

export function flagOfficerTrends(
  allDatasets: MonthlyDataset[],
  currentMonth: string,
  measure: Measure,
  threshold: number = 20,
  rule: DaysWorkedRule = DEFAULT_DAYS_RULE,
): OfficerTrendFlag[] {
  const sorted = allDatasets.slice().sort((a, b) => a.month.localeCompare(b.month));
  const currentIdx = sorted.findIndex(d => d.month === currentMonth);
  if (currentIdx < 0) return [];

  const currentDataset = sorted[currentIdx];
  const currentOfficers = computeOfficerStats(currentDataset.rows, rule);

  // Get up to 3 prior months
  const priorDatasets = sorted.slice(Math.max(0, currentIdx - 3), currentIdx);
  if (priorDatasets.length === 0) return [];

  // Build empId → values map for prior months
  const priorValues = new Map<string, number[]>(); // empId → [val per month]
  for (const d of priorDatasets) {
    const officers = computeOfficerStats(d.rows, rule);
    for (const o of officers) {
      const val = officerMeasureValue(o, measure);
      if (!priorValues.has(o.empId)) priorValues.set(o.empId, []);
      priorValues.get(o.empId)!.push(val);
    }
  }

  const flags: OfficerTrendFlag[] = [];
  for (const o of currentOfficers) {
    const priorVals = priorValues.get(o.empId);
    if (!priorVals || priorVals.length === 0) continue;
    const avg3m = priorVals.reduce((s, v) => s + v, 0) / priorVals.length;
    if (avg3m <= 0) continue;
    const currentValue = officerMeasureValue(o, measure);
    const pctAbove = ((currentValue - avg3m) / avg3m) * 100;
    if (pctAbove > threshold) {
      flags.push({
        empId: o.empId,
        empName: o.empName,
        role: o.role,
        region: o.region,
        currentValue,
        avg3m,
        pctAbove,
      });
    }
  }
  return flags.sort((a, b) => b.pctAbove - a.pctAbove);
}

// ─── Day-of-week analysis ────────────────────────────────────────────────────

export interface DayOfWeekPoint {
  day: string;          // 'Mon', 'Tue', etc.
  dayIndex: number;     // 0=Sun, 1=Mon ... 6=Sat
  submitTotal: number;
  claimCount: number;
}

export function computeDayOfWeek(rows: ClaimRow[]): DayOfWeekPoint[] {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const map = new Map<number, { submit: number; count: number }>();
  for (let i = 0; i < 7; i++) map.set(i, { submit: 0, count: 0 });

  for (const r of rows) {
    const d = new Date(r.date);
    const dow = d.getDay(); // 0=Sun
    const entry = map.get(dow)!;
    entry.submit += r.submitAmount;
    entry.count++;
  }

  return Array.from(map.entries()).map(([idx, v]) => ({
    day: DAYS[idx],
    dayIndex: idx,
    submitTotal: v.submit,
    claimCount: v.count,
  }));
}

// ─── Calendar heatmap data ────────────────────────────────────────────────────

export interface CalendarDay {
  date: string;         // YYYY-MM-DD
  dayOfMonth: number;
  dayOfWeek: number;    // 0=Sun
  submit: number;
  claimCount: number;
  isNoClaims: boolean;  // has zero claims
  weekIndex: number;    // which column in heatmap grid
}

export function buildCalendarData(rows: ClaimRow[], month: string): CalendarDay[] {
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDayOfWeek = new Date(y, m - 1, 1).getDay(); // 0=Sun

  // Aggregate by date
  const dateMap = new Map<string, { submit: number; count: number }>();
  for (const r of rows) {
    if (!dateMap.has(r.date)) dateMap.set(r.date, { submit: 0, count: 0 });
    const entry = dateMap.get(r.date)!;
    entry.submit += r.submitAmount;
    entry.count++;
  }

  const result: CalendarDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = new Date(y, m - 1, d).getDay();
    const posInGrid = firstDayOfWeek + d - 1;
    const weekIndex = Math.floor(posInGrid / 7);
    const v = dateMap.get(dateStr) ?? { submit: 0, count: 0 };
    result.push({
      date: dateStr,
      dayOfMonth: d,
      dayOfWeek,
      submit: v.submit,
      claimCount: v.count,
      isNoClaims: v.count === 0,
      weekIndex,
    });
  }
  return result;
}

// ─── Incomplete month detection ───────────────────────────────────────────────

export function isIncompleteMonth(dataset: MonthlyDataset): boolean {
  const now = new Date();
  const [y, m] = dataset.month.split('-').map(Number);
  // Month is incomplete if it's the current calendar month
  return y === now.getFullYear() && m === (now.getMonth() + 1);
}

export function getCompletionPct(dataset: MonthlyDataset): number {
  const [y, m] = dataset.month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = new Date();
  if (y < today.getFullYear() || m < today.getMonth() + 1) return 100;
  const daysPassed = today.getDate();
  return Math.round((daysPassed / daysInMonth) * 100);
}
