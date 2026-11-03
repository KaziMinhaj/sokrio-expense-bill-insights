// OverviewPage — main analytics dashboard
import { useMemo, useState } from 'react';
import { useDatasets } from '../hooks/useDatasets';
import { useSettings } from '../contexts/SettingsContext';
import {
  computeOfficerStats, computeGapBreakdown, computeDailyTrend,
  computeCostMix, computeStatusMix, computeBenchmarks, nationalAvgPerOfficer,
  groupByRegion, groupByArea, groupByTerritory, generateInsights,
  officerMeasureValue, groupMeasureTotal,
  MEASURES,
  type Measure,
} from '../lib/analytics';
import { formatTaka } from '../lib/format';
import { KpiCard, SectionHeader, EmptyState } from '../components/ui';
import { CostMixChart, StatusMixChart, RegionBarChart, DailyTrendChart } from '../components/charts';
import { RankingTable } from '../components/RankingTable';
import { BenchmarkTable } from '../components/BenchmarkTable';
import { GapBreakdownBar } from '../components/GapBreakdownBar';

const MONTH_NAMES: Record<string, string> = {
  '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun',
  '07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec',
};
function fmtMonth(ym: string) {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES[m] ?? m} ${y}`;
}

// Drill-down breadcrumb state
interface DrillState {
  region: string | null;
  area: string | null;
}

export function OverviewPage() {
  const datasets = useDatasets();
  const { settings, update: updateSettings } = useSettings();

  // Selectors
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [measure, setMeasure] = useState<Measure>('submit');
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [drill, setDrill] = useState<DrillState>({ region: null, area: null });
  const [benchmarkMode, setBenchmarkMode] = useState<'national' | 'role'>('national');

  // Resolve selected month
  const months = useMemo(() => (datasets ?? []).map(d => d.month).sort().reverse(), [datasets]);
  const month = selectedMonth || months[0] || '';
  const dataset = useMemo(() => (datasets ?? []).find(d => d.month === month), [datasets, month]);

  // Raw rows, optionally filtered by region
  const allRows = dataset?.rows ?? [];
  const rows = useMemo(() => {
    if (!regionFilter) return allRows;
    return allRows.filter(r => r.parsedHierarchy.region === regionFilter);
  }, [allRows, regionFilter]);

  // Analytics
  const officers = useMemo(() => computeOfficerStats(rows, settings.daysWorkedRule), [rows, settings.daysWorkedRule]);
  const gap = useMemo(() => computeGapBreakdown(rows), [rows]);
  const dailyTrend = useMemo(() => computeDailyTrend(rows), [rows]);
  const costMix = useMemo(() => computeCostMix(rows), [rows]);
  const statusMix = useMemo(() => computeStatusMix(rows), [rows]);
  const natAvg = useMemo(() => nationalAvgPerOfficer(officers, measure), [officers, measure]);

  const regionGroups = useMemo(() => groupByRegion(officers, measure), [officers, measure]);
  const areaGroups = useMemo(
    () => groupByArea(officers, measure, drill.region ?? undefined),
    [officers, measure, drill.region],
  );
  const territoryGroups = useMemo(
    () => groupByTerritory(officers, measure, drill.area ?? undefined),
    [officers, measure, drill.area],
  );

  const benchmarks = useMemo(
    () => computeBenchmarks(officers, measure, settings.benchmarkThreshold, benchmarkMode),
    [officers, measure, settings.benchmarkThreshold, benchmarkMode],
  );

  const insights = useMemo(() => {
    if (officers.length === 0) return [];
    return generateInsights(rows, officers, regionGroups, areaGroups, territoryGroups, gap, measure, settings.benchmarkThreshold);
  }, [rows, officers, regionGroups, areaGroups, territoryGroups, gap, measure, settings.benchmarkThreshold]);

  // KPIs
  const totalSubmit = rows.reduce((s, r) => s + r.submitAmount, 0);
  const totalPayable = rows.reduce((s, r) => s + r.payableAmount, 0);
  const totalPending = rows.filter(r => r.status === 'Pending').reduce((s, r) => s + r.submitAmount, 0);
  const rejCan = (gap.rejected + gap.cancelled);
  const avgDays = useMemo(() => {
    const active = officers.filter(o => o.daysWorked > 0);
    return active.length > 0 ? active.reduce((s, o) => s + o.daysWorked, 0) / active.length : 0;
  }, [officers]);

  // Region bar data
  const regionBarData = useMemo(() => regionGroups.map(g => ({
    label: g.label,
    value: groupMeasureTotal(g, measure),
  })), [regionGroups, measure]);

  // Region filter options
  const regions = useMemo(() => {
    const set = new Set(allRows.map(r => r.parsedHierarchy.region).filter(Boolean));
    return Array.from(set).sort();
  }, [allRows]);

  if (!datasets) return <div className="p-8 text-slate-400">Loading…</div>;
  if (months.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <EmptyState message="No data loaded yet. Go to Data Manager and upload a report." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">

      {/* ── Controls ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Month</label>
          <select
            value={month}
            onChange={e => { setSelectedMonth(e.target.value); setDrill({ region: null, area: null }); }}
            className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200"
          >
            {months.map(m => (
              <option key={m} value={m}>{fmtMonth(m)}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Measure</label>
          <select
            value={measure}
            onChange={e => setMeasure(e.target.value as Measure)}
            className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200"
          >
            {MEASURES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Region</label>
          <select
            value={regionFilter}
            onChange={e => { setRegionFilter(e.target.value); setDrill({ region: null, area: null }); }}
            className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200"
          >
            <option value="">All Regions</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Benchmark vs</label>
          <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600">
            {(['national', 'role'] as const).map(m => (
              <button
                key={m}
                onClick={() => setBenchmarkMode(m)}
                className={[
                  'px-3 py-1.5 text-xs font-semibold capitalize transition-colors',
                  benchmarkMode === m
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700',
                ].join(' ')}
              >
                {m === 'national' ? 'National' : 'Role Family'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── AI Insights ── */}
      {insights.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-900/50 p-5">
          <h2 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
            <span>✨</span> Key Insights — {fmtMonth(month)}
          </h2>
          <ul className="space-y-1.5">
            {insights.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-blue-900 dark:text-blue-200">
                <span className="mt-0.5 text-blue-400 dark:text-blue-500 shrink-0">→</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Submitted" value={formatTaka(totalSubmit)} accent="blue" icon="💰" />
        <KpiCard label="Payable" value={formatTaka(totalPayable)} accent="green" icon="✅" />
        <KpiCard label="Pending" value={formatTaka(totalPending)}
          sub={`${totalSubmit > 0 ? ((totalPending / totalSubmit) * 100).toFixed(1) : 0}% of submitted`}
          accent="amber" icon="⏳" />
        <KpiCard label="Rejected + Cancelled" value={formatTaka(rejCan)}
          sub={`${totalSubmit > 0 ? ((rejCan / totalSubmit) * 100).toFixed(1) : 0}% of submitted`}
          accent="red" icon="❌" />
        <KpiCard label="Real Reductions" value={formatTaka(gap.realReductions)}
          sub="On accepted/approved lines" accent="purple" icon="✂️" />
        <KpiCard label="Officers" value={String(officers.length)} accent="slate" icon="👤" />
        <KpiCard label="Avg Working Days" value={avgDays.toFixed(1)}
          sub="Officers with ≥1 TA/DA claim" accent="slate" icon="📅" />
        <KpiCard label="Nat. Avg / Officer" value={formatTaka(natAvg)}
          sub={MEASURES.find(m => m.value === measure)?.label} accent="slate" icon="📊" />
      </div>

      {/* ── Gap Breakdown ── */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm p-5">
        <SectionHeader title="Submit → Payable Gap Breakdown by Status" />
        <GapBreakdownBar gap={gap} />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm p-5">
          <SectionHeader title="Cost Mix (by Allowance Type)" />
          <CostMixChart data={costMix} />
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm p-5">
          <SectionHeader title="Status Mix (by Submitted Amount)" />
          <StatusMixChart data={statusMix} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm p-5">
          <SectionHeader title={`${MEASURES.find(m => m.value === measure)?.label ?? 'Value'} by Region`} />
          <RegionBarChart data={regionBarData} measureLabel={MEASURES.find(m => m.value === measure)?.label ?? 'Value'} />
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm p-5">
          <SectionHeader title={`Daily Submit vs Payable — ${fmtMonth(month)}`} />
          <DailyTrendChart data={dailyTrend} />
        </div>
      </div>

      {/* ── Ranking Tables with drill-down ── */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm p-5 space-y-6">

        {/* Breadcrumb */}
        {(drill.region || drill.area) && (
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <button
              onClick={() => setDrill({ region: null, area: null })}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              All Regions
            </button>
            {drill.region && (
              <>
                <span className="text-slate-400">›</span>
                <button
                  onClick={() => setDrill({ region: drill.region, area: null })}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {drill.region}
                </button>
              </>
            )}
            {drill.area && (
              <>
                <span className="text-slate-400">›</span>
                <span className="text-slate-700 dark:text-slate-300">{drill.area}</span>
              </>
            )}
          </div>
        )}

        {/* Region table (shown when no drill) */}
        {!drill.region && (
          <div>
            <SectionHeader
              title="By Region"
              action={<span className="text-xs text-slate-400 dark:text-slate-500">Click to drill down</span>}
            />
            <RankingTable
              groups={regionGroups}
              measure={measure}
              title="Region"
              nationalAvg={natAvg}
              threshold={settings.benchmarkThreshold}
              onDrillDown={label => setDrill({ region: label, area: null })}
            />
          </div>
        )}

        {/* Area table (shown when region drilled) */}
        {drill.region && !drill.area && (
          <div>
            <SectionHeader
              title={`Areas in ${drill.region}`}
              action={<span className="text-xs text-slate-400 dark:text-slate-500">Click to drill down</span>}
            />
            <RankingTable
              groups={areaGroups}
              measure={measure}
              title="Area"
              nationalAvg={natAvg}
              threshold={settings.benchmarkThreshold}
              onDrillDown={label => setDrill({ region: drill.region, area: label })}
            />
          </div>
        )}

        {/* Territory table (shown when area drilled) */}
        {drill.area && (
          <div>
            <SectionHeader title={`Territories in ${drill.area}`} />
            <RankingTable
              groups={territoryGroups.filter(g => g.label !== '-')}
              measure={measure}
              title="Territory"
              nationalAvg={natAvg}
              threshold={settings.benchmarkThreshold}
            />
            {/* Officers in this area */}
            <div className="mt-6">
              <SectionHeader title="Officers" />
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
                <table className="w-full text-sm min-w-[500px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/60">
                    <tr>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Name</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Role</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Value</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Days</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Per Day</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {officers
                      .filter(o => o.areaLabel === drill.area)
                      .sort((a, b) => officerMeasureValue(b, measure) - officerMeasureValue(a, measure))
                      .map(o => {
                        const val = officerMeasureValue(o, measure);
                        const perDay = o.daysWorked > 0 ? val / o.daysWorked : null;
                        return (
                          <tr key={o.empId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">{o.empName}</td>
                            <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-xs">{o.role}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatTaka(val)}</td>
                            <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">{o.daysWorked}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {perDay != null ? formatTaka(perDay) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Officers Above Benchmark ── */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm p-5">
        <SectionHeader
          title={`Officers Above ${settings.benchmarkThreshold}% Benchmark`}
          action={
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 dark:text-slate-400">Threshold %</label>
              <input
                type="number"
                min={0}
                max={500}
                value={settings.benchmarkThreshold}
                onChange={e => updateSettings({ benchmarkThreshold: Number(e.target.value) })}
                className="w-16 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-800 dark:text-slate-200"
              />
            </div>
          }
        />
        <BenchmarkTable results={benchmarks} measure={measure} month={month} />
      </div>

    </div>
  );
}
