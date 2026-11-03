// TrendsPage — month comparison, multi-month series, officer flags, daily analysis
import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useDatasets } from '../hooks/useDatasets';
import { useSettings } from '../contexts/SettingsContext';
import {
  compareMonths, buildMonthSeries, buildStackedSeries, buildRegionSeries,
  flagOfficerTrends, computeDayOfWeek, buildCalendarData,
  isIncompleteMonth, getCompletionPct,
  type MonthDelta,
} from '../lib/trends';
import { computeDailyTrend } from '../lib/analytics';
import { MEASURES, type Measure } from '../lib/analytics';
import { formatTaka } from '../lib/format';
import { KpiCard, SectionHeader, EmptyState } from '../components/ui';
import { DailyTrendChart } from '../components/charts';
import {
  MultiMonthLine, StackedBarsChart, RegionLinesChart,
  DayOfWeekBar,
} from '../components/charts2';
import { CalendarHeatmap } from '../components/CalendarHeatmap';

const MONTH_NAMES: Record<string, string> = {
  '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun',
  '07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec',
};
function fmtMonth(ym: string) {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES[m] ?? m} ${y}`;
}

// Range window options
const WINDOWS = [
  { value: 3, label: 'Last 3 months' },
  { value: 6, label: 'Last 6 months' },
  { value: 12, label: 'Last 12 months' },
  { value: 999, label: 'All months' },
];

// Delta direction badges
function DeltaBadge({ delta, pct }: { delta: number; pct: number | null }) {
  const up = delta > 0;
  const sign = up ? '+' : '';
  return (
    <span className={[
      'inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded',
      up
        ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
        : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    ].join(' ')}>
      {up ? '▲' : '▼'}
      {sign}{formatTaka(Math.abs(delta))}
      {pct != null && <span className="opacity-70">({sign}{pct.toFixed(1)}%)</span>}
    </span>
  );
}

// Delta table — top movers
function DeltaTable({ deltas, title, topN = 10 }: { deltas: MonthDelta[]; title: string; topN?: number }) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...deltas].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const increases = sorted.filter(d => d.delta > 0).slice(0, topN);
  const decreases = sorted.filter(d => d.delta < 0).slice(0, topN);
  const displayed = showAll ? sorted : sorted.slice(0, topN * 2);
  void increases; void decreases;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{title}</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
        <table className="w-full text-sm min-w-[400px]">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Name</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Month A</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Month B</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {displayed.map(d => (
              <tr key={d.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="py-2 px-3 text-slate-800 dark:text-slate-200 max-w-[200px] truncate font-medium">{d.label}</td>
                <td className="py-2 px-3 text-right font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatTaka(d.valueA)}</td>
                <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatTaka(d.valueB)}</td>
                <td className="py-2 px-3 text-right whitespace-nowrap">
                  <DeltaBadge delta={d.delta} pct={d.pctChange} />
                </td>
              </tr>
            ))}
            {displayed.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center text-slate-400 text-sm">No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {sorted.length > topN * 2 && (
        <button onClick={() => setShowAll(v => !v)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
          {showAll ? 'Show fewer' : `Show all ${sorted.length}`}
        </button>
      )}
    </div>
  );
}

type CompTab = 'region' | 'area' | 'territory' | 'officer';

export function TrendsPage() {
  const datasets = useDatasets();
  const { settings } = useSettings();

  const months = useMemo(() => (datasets ?? []).map(d => d.month).sort().reverse(), [datasets]);
  const [monthA, setMonthA] = useState('');
  const [monthB, setMonthB] = useState('');
  const [measure, setMeasure] = useState<Measure>('submit');
  const [window_, setWindow_] = useState(6);
  const [compTab, setCompTab] = useState<CompTab>('region');
  const [trendFlagThreshold, setTrendFlagThreshold] = useState(30);
  const [dailyMonth, setDailyMonth] = useState('');

  // Resolved months
  const mA = monthA || months[1] || months[0] || '';
  const mB = monthB || months[0] || '';
  const dailyM = dailyMonth || months[0] || '';

  const dsA = useMemo(() => (datasets ?? []).find(d => d.month === mA), [datasets, mA]);
  const dsB = useMemo(() => (datasets ?? []).find(d => d.month === mB), [datasets, mB]);
  const dailyDs = useMemo(() => (datasets ?? []).find(d => d.month === dailyM), [datasets, dailyM]);

  // Windowed datasets for multi-month charts
  const windowedDatasets = useMemo(() => {
    const sorted = (datasets ?? []).slice().sort((a, b) => a.month.localeCompare(b.month));
    return sorted.slice(-window_);
  }, [datasets, window_]);

  // Comparison
  const comparison = useMemo(() => {
    if (!dsA || !dsB || mA === mB) return null;
    return compareMonths(dsA, dsB, measure, settings.daysWorkedRule);
  }, [dsA, dsB, measure, settings.daysWorkedRule, mA, mB]);

  // Multi-month series
  const monthSeries = useMemo(() => buildMonthSeries(windowedDatasets, measure), [windowedDatasets, measure]);
  const stackedSeries = useMemo(() => buildStackedSeries(windowedDatasets), [windowedDatasets]);
  const { series: regionSeries, regions } = useMemo(
    () => buildRegionSeries(windowedDatasets, measure, settings.daysWorkedRule),
    [windowedDatasets, measure, settings.daysWorkedRule],
  );

  // Officer trend flags
  const officerFlags = useMemo(() => {
    if (!datasets || !mB) return [];
    return flagOfficerTrends(datasets, mB, measure, trendFlagThreshold, settings.daysWorkedRule);
  }, [datasets, mB, measure, trendFlagThreshold, settings.daysWorkedRule]);

  // Daily analysis for selected month
  const dailyTrend = useMemo(() => dailyDs ? computeDailyTrend(dailyDs.rows) : [], [dailyDs]);
  const dowData = useMemo(() => dailyDs ? computeDayOfWeek(dailyDs.rows) : [], [dailyDs]);
  const calendarData = useMemo(() => dailyDs ? buildCalendarData(dailyDs.rows, dailyM) : [], [dailyDs, dailyM]);

  // Incomplete month warnings
  const incompleteDsB = dsB && isIncompleteMonth(dsB);
  const incompleteDailyDs = dailyDs && isIncompleteMonth(dailyDs);

  // Export comparison to XLSX
  const handleExportComparison = () => {
    if (!comparison) return;
    const wb = XLSX.utils.book_new();
    const toRows = (deltas: MonthDelta[]) => deltas.map(d => ({
      Name: d.label,
      [comparison.monthA]: d.valueA,
      [comparison.monthB]: d.valueB,
      Delta: d.delta,
      'Change %': d.pctChange != null ? d.pctChange.toFixed(1) : 'N/A',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toRows([comparison.national, ...comparison.byRegion])), 'National+Region');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toRows(comparison.byArea)), 'By Area');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toRows(comparison.byTerritory)), 'By Territory');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toRows(comparison.byOfficer)), 'By Officer');
    XLSX.writeFile(wb, `tada-comparison-${mA}-vs-${mB}.xlsx`);
  };

  if (!datasets) return <div className="p-8 text-slate-400">Loading…</div>;
  if (months.length === 0) return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <EmptyState message="No data loaded. Upload at least one month in Data Manager." />
    </div>
  );

  const COMP_TABS: { id: CompTab; label: string }[] = [
    { id: 'region', label: 'Region' },
    { id: 'area', label: 'Area' },
    { id: 'territory', label: 'Territory' },
    { id: 'officer', label: 'Officer' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">

      {/* ══ SECTION 1: MONTH COMPARISON ══════════════════════════════════════ */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm p-6 space-y-5">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Month Comparison</h2>
          {comparison && (
            <button onClick={handleExportComparison}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
              ⬇ Export comparison
            </button>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Month A (baseline)</label>
            <select value={mA} onChange={e => setMonthA(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200">
              {months.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
            </select>
          </div>
          <span className="text-slate-400">→</span>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Month B (current)</label>
            <select value={mB} onChange={e => setMonthB(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200">
              {months.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Measure</label>
            <select value={measure} onChange={e => setMeasure(e.target.value as Measure)}
              className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200">
              {MEASURES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>

        {/* Incomplete warning */}
        {incompleteDsB && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <span>⚠️</span>
            <span>Month B ({fmtMonth(mB)}) is still in progress ({getCompletionPct(dsB!)}% of days elapsed). Data may be incomplete.</span>
          </div>
        )}

        {months.length < 2 && (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 text-sm text-blue-800 dark:text-blue-300">
            📋 Only one month is loaded. Upload another month to enable comparison. Showing daily trend only.
          </div>
        )}

        {mA === mB && months.length > 1 && (
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600 p-3 text-sm text-slate-600 dark:text-slate-400">
            Select different months to compare.
          </div>
        )}

        {comparison && (
          <>
            {/* National summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard
                label={`${fmtMonth(mA)} (A)`}
                value={formatTaka(comparison.national.valueA)}
                accent="slate" icon="📊"
              />
              <KpiCard
                label={`${fmtMonth(mB)} (B)`}
                value={formatTaka(comparison.national.valueB)}
                accent="blue" icon="📊"
              />
              <KpiCard
                label="National Change"
                value={`${comparison.national.delta >= 0 ? '+' : ''}${formatTaka(comparison.national.delta)}`}
                sub={comparison.national.pctChange != null
                  ? `${comparison.national.pctChange >= 0 ? '+' : ''}${comparison.national.pctChange.toFixed(1)}%`
                  : undefined}
                accent={comparison.national.delta >= 0 ? 'red' : 'green'}
                icon={comparison.national.delta >= 0 ? '📈' : '📉'}
              />
              <KpiCard
                label="Top Increase"
                value={comparison.byOfficer.filter(d => d.delta > 0).length > 0
                  ? formatTaka(Math.max(...comparison.byOfficer.filter(d => d.delta > 0).map(d => d.delta)))
                  : 'None'}
                accent="red" icon="⬆"
              />
            </div>

            {/* Tab navigation */}
            <div className="flex gap-1 flex-wrap">
              {COMP_TABS.map(t => (
                <button key={t.id} onClick={() => setCompTab(t.id)}
                  className={[
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                    compTab === t.id
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
                  ].join(' ')}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Delta table for active tab */}
            {compTab === 'region' && <DeltaTable deltas={comparison.byRegion} title={`Region change: ${fmtMonth(mA)} → ${fmtMonth(mB)}`} />}
            {compTab === 'area' && <DeltaTable deltas={comparison.byArea} title={`Area change: ${fmtMonth(mA)} → ${fmtMonth(mB)}`} />}
            {compTab === 'territory' && <DeltaTable deltas={comparison.byTerritory.filter(d => d.key !== '-')} title={`Territory change: ${fmtMonth(mA)} → ${fmtMonth(mB)}`} />}
            {compTab === 'officer' && <DeltaTable deltas={comparison.byOfficer} title={`Officer change: ${fmtMonth(mA)} → ${fmtMonth(mB)}`} topN={15} />}
          </>
        )}
      </div>

      {/* ══ SECTION 2: MULTI-MONTH SERIES ════════════════════════════════════ */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm p-6 space-y-5">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Multi-Month Trends</h2>
          <div className="flex gap-1">
            {WINDOWS.map(w => (
              <button key={w.value} onClick={() => setWindow_(w.value)}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  window_ === w.value
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
                ].join(' ')}>
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {windowedDatasets.length < 2 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Upload more months to see trends.</p>
        ) : (
          <div className="space-y-6">
            <div>
              <SectionHeader title={`${MEASURES.find(m => m.value === measure)?.label} over time`} />
              <MultiMonthLine data={monthSeries} measureLabel={MEASURES.find(m => m.value === measure)?.label ?? 'Value'} />
            </div>
            <div>
              <SectionHeader title="Spend by Cost Type (stacked)" />
              <StackedBarsChart data={stackedSeries} />
            </div>
            {regions.length > 0 && (
              <div>
                <SectionHeader title="By Region over time" />
                <RegionLinesChart data={regionSeries} regions={regions} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ SECTION 3: OFFICER TREND FLAGS ═══════════════════════════════════ */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm p-6 space-y-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Officer Trend Flags</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 dark:text-slate-400">Flag if current &gt; 3-month avg by</label>
            <input type="number" min={0} max={500} value={trendFlagThreshold}
              onChange={e => setTrendFlagThreshold(Number(e.target.value))}
              className="w-16 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm" />
            <span className="text-xs text-slate-500 dark:text-slate-400">%</span>
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Compares each officer's {fmtMonth(mB)} {MEASURES.find(m => m.value === measure)?.label} to their own average over the prior 3 months.
          Requires at least 1 prior month loaded.
        </p>

        {officerFlags.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 py-4">
            {datasets && datasets.length < 2
              ? 'Need at least 2 months to compute personal trends.'
              : `No officers exceed ${trendFlagThreshold}% above their 3-month average.`}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Officer</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Role</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Region</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">3-Month Avg</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Current</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">% Above</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {officerFlags.map(f => (
                  <tr key={f.empId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">{f.empName}</td>
                    <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-xs">{f.role}</td>
                    <td className="py-2 px-3 text-slate-500 dark:text-slate-400">{f.region}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatTaka(f.avg3m)}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatTaka(f.currentValue)}</td>
                    <td className="py-2 px-3 text-right">
                      <span className="text-xs font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">
                        +{f.pctAbove.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ SECTION 4: DAILY ANALYSIS ════════════════════════════════════════ */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm p-6 space-y-6">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Daily Analysis</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Month</label>
            <select value={dailyM} onChange={e => setDailyMonth(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200">
              {months.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
            </select>
          </div>
        </div>

        {incompleteDailyDs && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <span>⚠️</span>
            <span>{fmtMonth(dailyM)} is still in progress — {getCompletionPct(dailyDs!)}% of days have elapsed. Future days show as no-claims.</span>
          </div>
        )}

        <div>
          <SectionHeader title={`Daily Submit vs Payable — ${fmtMonth(dailyM)}`} />
          <DailyTrendChart data={dailyTrend} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SectionHeader title="Spend by Day of Week" />
            <DayOfWeekBar data={dowData} />
          </div>
          <div>
            <SectionHeader title="Calendar Heatmap" />
            {calendarData.length > 0
              ? <CalendarHeatmap days={calendarData} month={dailyM} />
              : <p className="text-sm text-slate-400">No data for this month.</p>}
          </div>
        </div>
      </div>

    </div>
  );
}
