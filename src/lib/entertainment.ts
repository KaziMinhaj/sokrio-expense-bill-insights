// entertainment.ts — Entertainment expense analytics
import type { ClaimRow, MonthlyDataset } from '../types';
import { computeOfficerStats, type OfficerStats, type DaysWorkedRule, DEFAULT_DAYS_RULE } from './analytics';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EntOfficerStat {
  empId: string;
  empName: string;
  role: string;
  region: string;
  areaLabel: string;
  entSubmit: number;      // entertainment submit
  totalSubmit: number;    // all submit (this officer)
  claimCount: number;     // entertainment claim count
  shareOfOwn: number;     // entSubmit / totalSubmit (%)
  daysWorked: number;
  entPerDay: number;      // entSubmit / daysWorked (0 if no days)
  pctVsAvgClaimant: number | null; // vs average entertainment claimant
}

export interface EntRegionStat {
  region: string;
  entSubmit: number;
  totalSubmit: number;
  shareOfTotal: number;   // entSubmit / totalSubmit (%)
  officerCount: number;
}

export interface EntMonthPoint {
  month: string;
  entSubmit: number;
  totalSubmit: number;
  sharePct: number;
}

export interface EntSummary {
  entSubmit: number;
  totalSubmit: number;
  sharePct: number;
  claimCount: number;
  byRegion: EntRegionStat[];
  topOfficers: EntOfficerStat[];
  flaggedOfficers: EntOfficerStat[]; // above threshold
}

// ─── Computations ────────────────────────────────────────────────────────────

export function computeEntSummary(
  rows: ClaimRow[],
  threshold: number = 20,  // % of own claims
  rule: DaysWorkedRule = DEFAULT_DAYS_RULE,
): EntSummary {
  const entRows = rows.filter(r => r.expenseType === 'Entertainment');
  const entSubmit = entRows.reduce((s, r) => s + r.submitAmount, 0);
  const totalSubmit = rows.reduce((s, r) => s + r.submitAmount, 0);
  const sharePct = totalSubmit > 0 ? (entSubmit / totalSubmit) * 100 : 0;

  // Per-region
  const regionMap = new Map<string, { ent: number; total: number; officers: Set<string> }>();
  for (const r of rows) {
    const reg = r.parsedHierarchy.region || '-';
    if (!regionMap.has(reg)) regionMap.set(reg, { ent: 0, total: 0, officers: new Set() });
    const entry = regionMap.get(reg)!;
    entry.total += r.submitAmount;
    entry.officers.add(r.empId);
    if (r.expenseType === 'Entertainment') entry.ent += r.submitAmount;
  }
  const byRegion: EntRegionStat[] = Array.from(regionMap.entries())
    .map(([region, v]) => ({
      region,
      entSubmit: v.ent,
      totalSubmit: v.total,
      shareOfTotal: v.total > 0 ? (v.ent / v.total) * 100 : 0,
      officerCount: v.officers.size,
    }))
    .sort((a, b) => b.entSubmit - a.entSubmit);

  // Per-officer
  const officers = computeOfficerStats(rows, rule);
  const officerEntMap = new Map<string, { ent: number; count: number }>();
  for (const r of entRows) {
    if (!officerEntMap.has(r.empId)) officerEntMap.set(r.empId, { ent: 0, count: 0 });
    officerEntMap.get(r.empId)!.ent += r.submitAmount;
    officerEntMap.get(r.empId)!.count++;
  }

  // Average entertainment among claimants (those with >0 entertainment)
  const claimants = officers.filter(o => (officerEntMap.get(o.empId)?.ent ?? 0) > 0);
  const avgClaimantEnt = claimants.length > 0
    ? claimants.reduce((s, o) => s + (officerEntMap.get(o.empId)?.ent ?? 0), 0) / claimants.length
    : 0;

  const officerStats: EntOfficerStat[] = officers
    .filter(o => (officerEntMap.get(o.empId)?.ent ?? 0) > 0)
    .map(o => {
      const { ent, count } = officerEntMap.get(o.empId) ?? { ent: 0, count: 0 };
      return {
        empId: o.empId,
        empName: o.empName,
        role: o.role,
        region: o.region,
        areaLabel: o.areaLabel,
        entSubmit: ent,
        totalSubmit: o.submitTotal,
        claimCount: count,
        shareOfOwn: o.submitTotal > 0 ? (ent / o.submitTotal) * 100 : 0,
        daysWorked: o.daysWorked,
        entPerDay: o.daysWorked > 0 ? ent / o.daysWorked : 0,
        pctVsAvgClaimant: avgClaimantEnt > 0 ? ((ent - avgClaimantEnt) / avgClaimantEnt) * 100 : null,
      };
    })
    .sort((a, b) => b.entSubmit - a.entSubmit);

  const flaggedOfficers = officerStats.filter(
    o => o.shareOfOwn > threshold,
  );

  return {
    entSubmit,
    totalSubmit,
    sharePct,
    claimCount: entRows.length,
    byRegion,
    topOfficers: officerStats.slice(0, 10),
    flaggedOfficers,
  };
}

export function buildEntMonthSeries(datasets: MonthlyDataset[]): EntMonthPoint[] {
  return datasets
    .slice()
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(d => {
      const entSubmit = d.rows.filter(r => r.expenseType === 'Entertainment').reduce((s, r) => s + r.submitAmount, 0);
      const totalSubmit = d.rows.reduce((s, r) => s + r.submitAmount, 0);
      return {
        month: d.month,
        entSubmit,
        totalSubmit,
        sharePct: totalSubmit > 0 ? (entSubmit / totalSubmit) * 100 : 0,
      };
    });
}
