// EntertainmentPage — Expense Type = Entertainment deep-dive
import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useDatasets } from '../hooks/useDatasets';
import { useSettings } from '../contexts/SettingsContext';
import { computeEntSummary, buildEntMonthSeries } from '../lib/entertainment';
import { formatTaka } from '../lib/format';
import { KpiCard, SectionHeader, EmptyState } from '../components/ui';
import { EntTrendChart, EntRegionBar } from '../components/charts2';

const MONTH_NAMES: Record<string, string> = {
  '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun',
  '07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec',
};
function fmtMonth(ym: string) {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES[m] ?? m} ${y}`;
}

export function EntertainmentPage() {
  const datasets = useDatasets();
  const { settings, update } = useSettings();
  const [selectedMonth, setSelectedMonth] = useState('');
  const [threshold, setThreshold] = useState(20); // % of own claims

  const months = useMemo(() => (datasets ?? []).map(d => d.month).sort().reverse(), [datasets]);
  const month = selectedMonth || months[0] || '';
  const dataset = useMemo(() => (datasets ?? []).find(d => d.month === month), [datasets, month]);

  const summary = useMemo(
    () => dataset ? computeEntSummary(dataset.rows, threshold, settings.daysWorkedRule) : null,
    [dataset, threshold, settings.daysWorkedRule],
  );

  const monthSeries = useMemo(() => buildEntMonthSeries(datasets ?? []), [datasets]);

  const handleExport = () => {
    if (!summary) return;
    const wb = XLSX.utils.book_new();
    const rows = summary.topOfficers.map(o => ({
      'Name': o.empName,
      'Emp. ID': o.empId,
      'Role': o.role,
      'Region': o.region,
      'Area': o.areaLabel,
      'Ent. Submit': o.entSubmit,
      'Total Submit': o.totalSubmit,
      '% of Own Claims': o.shareOfOwn.toFixed(1),
      'Days Worked': o.daysWorked,
      'Ent/Day': o.entPerDay.toFixed(0),
      '% vs Avg Claimant': o.pctVsAvgClaimant != null ? o.pctVsAvgClaimant.toFixed(1) : 'N/A',
      'Claims Count': o.claimCount,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Entertainment');
    XLSX.writeFile(wb, `tada-entertainment-${month}.xlsx`);
  };

  if (!datasets) return <div className="p-8 text-slate-400">Loading…</div>;
  if (months.length === 0) return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <EmptyState message="No data loaded. Upload a report in Data Manager." />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Month</label>
          <select value={month} onChange={e => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200">
            {months.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Flag if &gt;</label>
          <input type="number" min={0} max={100} value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            className="w-16 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm" />
          <span className="text-xs text-slate-500 dark:text-slate-400">% of own claims</span>
        </div>
        {summary && (
          <button onClick={handleExport} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
            ⬇ Export
          </button>
        )}
      </div>

      {/* KPIs */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Entertainment Submit" value={formatTaka(summary.entSubmit)} accent="amber" icon="🎭" />
          <KpiCard label="Share of Total Submit"
            value={`${summary.sharePct.toFixed(2)}%`}
            sub={`of ${formatTaka(summary.totalSubmit)}`} accent="purple" icon="📊" />
          <KpiCard label="Claim Lines" value={summary.claimCount.toLocaleString('en-IN')} accent="blue" icon="📋" />
          <KpiCard label="Officers with Ent. Claims"
            value={String(summary.topOfficers.length + (summary.flaggedOfficers.length > summary.topOfficers.length ? summary.flaggedOfficers.length - summary.topOfficers.length : 0))}
            accent="slate" icon="👤" />
        </div>
      )}

      {/* Trend over months */}
      {monthSeries.length > 1 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm p-5">
          <SectionHeader title="Entertainment Trend over Months" />
          <EntTrendChart data={monthSeries} />
        </div>
      )}

      {/* By region */}
      {summary && summary.byRegion.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm p-5">
          <SectionHeader title="Entertainment by Region" />
          <EntRegionBar data={summary.byRegion} />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Region</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Officers</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Ent. Submit</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">% of Region</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {summary.byRegion.map(r => (
                  <tr key={r.region} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">{r.region}</td>
                    <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">{r.officerCount}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatTaka(r.entSubmit)}</td>
                    <td className="py-2 px-3 text-right">
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        {r.shareOfTotal.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top 10 Officers */}
      {summary && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm p-5">
          <SectionHeader
            title="Top 10 Officers by Entertainment Spend"
            action={
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {summary.flaggedOfficers.length} flagged above {threshold}% of own claims
              </span>
            }
          />
          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Name</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Role</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Region</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Claims</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Ent. Submit</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">% of Own</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">vs Avg Claimant</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Days</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Ent/Day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {summary.topOfficers.map(o => {
                  const flagged = o.shareOfOwn > threshold;
                  return (
                    <tr key={o.empId}
                      className={[
                        'hover:bg-slate-50 dark:hover:bg-slate-800/40',
                        flagged ? 'bg-amber-50/40 dark:bg-amber-900/10' : '',
                      ].join(' ')}>
                      <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {flagged && <span className="text-amber-500 mr-1" title={`>  ${threshold}% of own claims`}>⚑</span>}
                        {o.empName}
                      </td>
                      <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">{o.role}</td>
                      <td className="py-2 px-3 text-slate-500 dark:text-slate-400">{o.region}</td>
                      <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">{o.claimCount}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatTaka(o.entSubmit)}</td>
                      <td className="py-2 px-3 text-right">
                        <span className={[
                          'text-xs font-semibold px-1.5 py-0.5 rounded',
                          flagged
                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                            : 'text-slate-500 dark:text-slate-400',
                        ].join(' ')}>
                          {o.shareOfOwn.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        {o.pctVsAvgClaimant != null ? (
                          <span className={[
                            'text-xs font-semibold px-1.5 py-0.5 rounded',
                            o.pctVsAvgClaimant > 0
                              ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                              : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
                          ].join(' ')}>
                            {o.pctVsAvgClaimant > 0 ? '+' : ''}{o.pctVsAvgClaimant.toFixed(1)}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">{o.daysWorked}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {o.daysWorked > 0 ? formatTaka(o.entPerDay) : '—'}
                      </td>
                    </tr>
                  );
                })}
                {summary.topOfficers.length === 0 && (
                  <tr><td colSpan={9} className="py-8 text-center text-slate-400 text-sm">No entertainment claims this month</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Flagged officers note */}
          {summary.flaggedOfficers.length > 0 && (
            <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300">
              <span className="font-semibold">⚑ Flagged:</span>{' '}
              {summary.flaggedOfficers.map(o => `${o.empName} (${o.shareOfOwn.toFixed(1)}%)`).join(', ')}
              {' '}— entertainment exceeds {threshold}% of their own total claims.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
