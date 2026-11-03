// DaysWorkedPage — histogram, role averages, low-day officers, cost per day
import { useMemo, useState } from 'react';
import { useDatasets } from '../hooks/useDatasets';
import { useSettings } from '../contexts/SettingsContext';
import {
  computeOfficerStats,
  officerMeasureValue,
} from '../lib/analytics';
import { formatTaka } from '../lib/format';
import { KpiCard, SectionHeader, EmptyState } from '../components/ui';
import { DaysHistogram } from '../components/charts';

const MONTH_NAMES: Record<string, string> = {
  '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun',
  '07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec',
};
function fmtMonth(ym: string) {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES[m] ?? m} ${y}`;
}

const BINS = [
  { label: '0–5', min: 0, max: 5 },
  { label: '6–10', min: 6, max: 10 },
  { label: '11–15', min: 11, max: 15 },
  { label: '16–20', min: 16, max: 20 },
  { label: '21+', min: 21, max: Infinity },
];

const OUTLIER_THRESHOLD = 5; // days — flag officers with ≤ this many days as outliers

export function DaysWorkedPage() {
  const datasets = useDatasets();
  const { settings, update: updateSettings } = useSettings();
  const [selectedMonth, setSelectedMonth] = useState('');

  const months = useMemo(() => (datasets ?? []).map(d => d.month).sort().reverse(), [datasets]);
  const month = selectedMonth || months[0] || '';
  const dataset = useMemo(() => (datasets ?? []).find(d => d.month === month), [datasets, month]);

  const rows = dataset?.rows ?? [];
  const officers = useMemo(() => computeOfficerStats(rows, settings.daysWorkedRule), [rows, settings.daysWorkedRule]);

  // Histogram
  const histData = useMemo(() => BINS.map(b => ({
    bin: b.label,
    count: officers.filter(o => o.daysWorked >= b.min && o.daysWorked <= b.max).length,
  })), [officers]);

  // Avg days by role family
  const roleAvgs = useMemo(() => {
    const rolemap = new Map<string, { total: number; count: number }>();
    for (const o of officers) {
      const rf = o.roleFamily || 'Unknown';
      if (!rolemap.has(rf)) rolemap.set(rf, { total: 0, count: 0 });
      rolemap.get(rf)!.total += o.daysWorked;
      rolemap.get(rf)!.count++;
    }
    return Array.from(rolemap.entries())
      .map(([role, { total, count }]) => ({ role, avg: count > 0 ? total / count : 0, count }))
      .sort((a, b) => b.avg - a.avg);
  }, [officers]);

  // KPIs
  const activeOfficers = officers.filter(o => o.daysWorked > 0);
  const avgDays = activeOfficers.length > 0
    ? activeOfficers.reduce((s, o) => s + o.daysWorked, 0) / activeOfficers.length : 0;
  const maxDays = officers.length > 0 ? Math.max(...officers.map(o => o.daysWorked)) : 0;
  const zeroOfficers = officers.filter(o => o.daysWorked === 0).length;

  // Cost per working day
  const officersWithDays = useMemo(
    () => officers.filter(o => o.daysWorked > 0).map(o => ({
      ...o,
      costPerDay: o.submitTotal / o.daysWorked,
      taPerDay: o.transportTotal / o.daysWorked,
      daPerDay: o.daTotal / o.daysWorked,
      outlier: o.daysWorked <= OUTLIER_THRESHOLD,
    })).sort((a, b) => a.daysWorked - b.daysWorked),
    [officers],
  );

  // No-claims days in the month (calendar days with zero submit & payable)
  const noClaimsDates = useMemo(() => {
    if (!dataset) return [];
    const month = dataset.month;
    const daysInMonth = new Date(
      parseInt(month.slice(0, 4)),
      parseInt(month.slice(5, 7)),
      0,
    ).getDate();
    const claimDates = new Set(rows.map(r => r.date));
    const noClaims: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${month}-${String(d).padStart(2, '0')}`;
      if (!claimDates.has(dateStr)) noClaims.push(dateStr);
    }
    return noClaims;
  }, [dataset, rows]);

  if (!datasets) return <div className="p-8 text-slate-400">Loading…</div>;
  if (months.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <EmptyState message="No data loaded yet. Go to Data Manager and upload a report." />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">

      {/* ── Controls ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Month</label>
          <select
            value={month}
            onChange={e => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200"
          >
            {months.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
          </select>
        </div>

        {/* Days-worked rule editor */}
        <div className="flex items-center gap-3 ml-auto flex-wrap">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Count day if:</span>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <input type="checkbox"
              checked={settings.daysWorkedRule.includeTransportation}
              onChange={e => updateSettings({
                daysWorkedRule: { ...settings.daysWorkedRule, includeTransportation: e.target.checked },
              })}
              className="accent-blue-600"
            />
            TA claim
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <input type="checkbox"
              checked={settings.daysWorkedRule.includeDailyAllowance}
              onChange={e => updateSettings({
                daysWorkedRule: { ...settings.daysWorkedRule, includeDailyAllowance: e.target.checked },
              })}
              className="accent-blue-600"
            />
            DA claim
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <input type="checkbox"
              checked={settings.daysWorkedRule.excludeStatuses.includes('Rejected')}
              onChange={e => {
                const excl = settings.daysWorkedRule.excludeStatuses;
                updateSettings({
                  daysWorkedRule: {
                    ...settings.daysWorkedRule,
                    excludeStatuses: e.target.checked
                      ? [...new Set([...excl, 'Rejected'])]
                      : excl.filter(s => s !== 'Rejected'),
                  },
                });
              }}
              className="accent-blue-600"
            />
            Exclude Rejected
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <input type="checkbox"
              checked={settings.daysWorkedRule.excludeStatuses.includes('Cancelled')}
              onChange={e => {
                const excl = settings.daysWorkedRule.excludeStatuses;
                updateSettings({
                  daysWorkedRule: {
                    ...settings.daysWorkedRule,
                    excludeStatuses: e.target.checked
                      ? [...new Set([...excl, 'Cancelled'])]
                      : excl.filter(s => s !== 'Cancelled'),
                  },
                });
              }}
              className="accent-blue-600"
            />
            Exclude Cancelled
          </label>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Avg Days Worked" value={avgDays.toFixed(1)} sub="Officers with ≥1 TA/DA" accent="blue" icon="📅" />
        <KpiCard label="Max Days" value={String(maxDays)} accent="green" icon="🏆" />
        <KpiCard label="Zero-day Officers" value={String(zeroOfficers)}
          sub="No TA/DA claims this month" accent={zeroOfficers > 0 ? 'amber' : 'slate'} icon="⚠️" />
        <KpiCard label="No-claims Days" value={String(noClaimsDates.length)}
          sub="Calendar days with zero claims" accent="slate" icon="📆" />
      </div>

      {/* ── Histogram ── */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm p-5">
        <SectionHeader title="Days Worked Distribution" />
        <DaysHistogram data={histData} />
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
          {histData.map(b => (
            <span key={b.bin}><strong>{b.bin} days:</strong> {b.count} officer{b.count !== 1 ? 's' : ''}</span>
          ))}
        </div>
      </div>

      {/* ── Role Averages ── */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm p-5">
        <SectionHeader title="Average Days Worked by Role" />
        <div className="space-y-3">
          {roleAvgs.map(r => {
            const pct = maxDays > 0 ? (r.avg / maxDays) * 100 : 0;
            return (
              <div key={r.role} className="flex items-center gap-3">
                <div className="w-20 text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">{r.role}</div>
                <div className="flex-1 h-3 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div className="h-full rounded-full bg-purple-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="w-24 text-xs text-slate-600 dark:text-slate-400 shrink-0">
                  <strong>{r.avg.toFixed(1)}</strong> days ({r.count} officers)
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── No-claims days note ── */}
      {noClaimsDates.length > 0 && (
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-5">
          <SectionHeader title={`No-claims Days (${noClaimsDates.length})`} />
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            These are calendar days with zero expense claims across all officers (Fridays, holidays, etc.).
            They are <strong>not counted as absences</strong>.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {noClaimsDates.map(d => (
              <span key={d} className="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-0.5 text-slate-500 dark:text-slate-400">
                {d.slice(8)} {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(d).getDay()]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Cost per Working Day ── */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm p-5">
        <SectionHeader title="Cost per Working Day — Officer Detail" />
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
          Sorted by fewest days worked first. <span className="text-amber-600 dark:text-amber-400 font-semibold">⚠ Outlier</span> = ≤{OUTLIER_THRESHOLD} days.
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Name</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Role</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Days</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Total Submit</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Cost/Day</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">TA/Day</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">DA/Day</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Flag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {officersWithDays.map(o => (
                <tr
                  key={o.empId}
                  className={[
                    'hover:bg-slate-50 dark:hover:bg-slate-800/40',
                    o.outlier ? 'bg-amber-50/40 dark:bg-amber-900/10' : '',
                  ].join(' ')}
                >
                  <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">{o.empName}</td>
                  <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">{o.role}</td>
                  <td className="py-2 px-3 text-right font-semibold text-slate-800 dark:text-slate-200">{o.daysWorked}</td>
                  <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatTaka(o.submitTotal)}</td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatTaka(o.costPerDay)}</td>
                  <td className="py-2 px-3 text-right font-mono text-blue-600 dark:text-blue-400 whitespace-nowrap">{formatTaka(o.taPerDay)}</td>
                  <td className="py-2 px-3 text-right font-mono text-green-600 dark:text-green-400 whitespace-nowrap">{formatTaka(o.daPerDay)}</td>
                  <td className="py-2 px-3">
                    {o.outlier && (
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">⚠ Low days</span>
                    )}
                  </td>
                </tr>
              ))}
              {officersWithDays.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
