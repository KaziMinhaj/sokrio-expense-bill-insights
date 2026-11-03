// BenchmarkTable — Officers above benchmark with export
import { useState } from 'react';
import * as XLSX from 'xlsx';
import type { BenchmarkResult, Measure } from '../lib/analytics';
import { MEASURES } from '../lib/analytics';
import { formatTaka } from '../lib/format';
import { SortHeader } from './ui';

type SortField = 'empName' | 'value' | 'pctOver' | 'daysWorked' | 'perDay';

interface BenchmarkTableProps {
  results: BenchmarkResult[];
  measure: Measure;
  month: string;
}

export function BenchmarkTable({ results, measure, month }: BenchmarkTableProps) {
  const [showAll, setShowAll] = useState(false);
  const [sortField, setSortField] = useState<SortField>('pctOver');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const measureLabel = MEASURES.find(m => m.value === measure)?.label ?? measure;

  const handleSort = (f: string) => {
    if (f === sortField) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(f as SortField); setSortDir('desc'); }
  };

  const sorted = [...results].sort((a, b) => {
    const perDayA = a.officer.daysWorked > 0 ? a.value / a.officer.daysWorked : 0;
    const perDayB = b.officer.daysWorked > 0 ? b.value / b.officer.daysWorked : 0;
    const map: Record<SortField, [number, number]> = {
      empName: [0, 0], // handled below
      value: [a.value, b.value],
      pctOver: [a.pctOver, b.pctOver],
      daysWorked: [a.officer.daysWorked, b.officer.daysWorked],
      perDay: [perDayA, perDayB],
    };
    if (sortField === 'empName') {
      const cmp = a.officer.empName.localeCompare(b.officer.empName);
      return sortDir === 'asc' ? cmp : -cmp;
    }
    const [av, bv] = map[sortField];
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const displayed = showAll ? sorted : sorted.slice(0, 15);

  const handleExport = () => {
    const rows = sorted.map(r => ({
      'Emp. Name': r.officer.empName,
      'Emp. ID': r.officer.empId,
      Role: r.officer.role,
      Region: r.officer.region,
      Area: r.officer.areaLabel,
      Territory: r.officer.territoryLabel,
      [measureLabel]: r.value,
      'Benchmark': r.benchmark,
      '% Over Benchmark': r.pctOver.toFixed(1),
      'Days Worked': r.officer.daysWorked,
      [`${measureLabel} per Day`]: r.officer.daysWorked > 0 ? (r.value / r.officer.daysWorked).toFixed(0) : '-',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Above Benchmark');
    XLSX.writeFile(wb, `tada-above-benchmark-${month}.xlsx`);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {results.length} officer{results.length !== 1 ? 's' : ''} above benchmark · sorted by % over
        </p>
        {results.length > 0 && (
          <button
            onClick={handleExport}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            ⬇ Export
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <SortHeader label="Name" field="empName" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-left" />
              <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">ID</th>
              <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Role</th>
              <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Location</th>
              <SortHeader label={measureLabel} field="value" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right" />
              <th className="py-2.5 px-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">Benchmark</th>
              <SortHeader label="% Over" field="pctOver" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right" />
              <SortHeader label="Days" field="daysWorked" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right" />
              <SortHeader label="Per Day" field="perDay" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {displayed.map(r => {
              const perDay = r.officer.daysWorked > 0 ? r.value / r.officer.daysWorked : null;
              const locationPath = [
                r.officer.region,
                r.officer.areaLabel !== '-' ? r.officer.areaLabel : '',
                r.officer.territoryLabel !== '-' ? r.officer.territoryLabel : '',
              ].filter(Boolean).join(' › ');
              return (
                <tr key={r.officer.empId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">{r.officer.empName}</td>
                  <td className="py-2 px-3 text-slate-500 dark:text-slate-400 font-mono text-xs">{r.officer.empId}</td>
                  <td className="py-2 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{r.officer.role}</td>
                  <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-xs max-w-[180px] truncate" title={locationPath}>{locationPath}</td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatTaka(r.value)}</td>
                  <td className="py-2 px-3 text-right font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatTaka(r.benchmark)}</td>
                  <td className="py-2 px-3 text-right">
                    <span className="text-xs font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">
                      +{r.pctOver.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">{r.officer.daysWorked}</td>
                  <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {perDay != null ? formatTaka(perDay) : '—'}
                  </td>
                </tr>
              );
            })}
            {results.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                  No officers exceed the benchmark
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {results.length > 15 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {showAll ? 'Show top 15' : `Show all ${results.length} officers`}
        </button>
      )}
    </div>
  );
}
