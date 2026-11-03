// Ranking table component — Region / Area / Territory with drill-down
import { useState } from 'react';
import type { GroupStats } from '../lib/analytics';
import { groupMeasureTotal } from '../lib/analytics';
import type { Measure } from '../lib/analytics';
import { formatTaka } from '../lib/format';
import { InlineBar } from './ui';

interface RankingTableProps {
  groups: GroupStats[];
  measure: Measure;
  title: string;
  nationalAvg: number;
  threshold: number;
  onDrillDown?: (label: string) => void;
}

export function RankingTable({
  groups, measure, title, nationalAvg, threshold, onDrillDown,
}: RankingTableProps) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? groups : groups.slice(0, 10);
  const maxTotal = groups.length > 0 ? groupMeasureTotal(groups[0], measure) : 1;

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">#</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{title}</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Officers</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Total</th>
              <th className="py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400"></th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Avg/Officer</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">vs National</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {displayed.map((g, i) => {
              const total = groupMeasureTotal(g, measure);
              const pctVsNational = nationalAvg > 0
                ? ((g.avgPerOfficer - nationalAvg) / nationalAvg) * 100
                : 0;
              const isAbove = pctVsNational > threshold;
              const isBelow = pctVsNational < -threshold;

              return (
                <tr
                  key={g.label}
                  className={[
                    'transition-colors',
                    onDrillDown ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
                  ].join(' ')}
                  onClick={() => onDrillDown?.(g.label)}
                >
                  <td className="py-2 px-3 text-slate-400 dark:text-slate-500 text-xs">{i + 1}</td>
                  <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200 max-w-[180px] truncate">
                    {g.label}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">{g.officerCount}</td>
                  <td className="py-2 px-3 text-right font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {formatTaka(total)}
                  </td>
                  <td className="py-2 px-3">
                    <InlineBar value={total} max={maxTotal} />
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {formatTaka(g.avgPerOfficer)}
                  </td>
                  <td className="py-2 px-3 text-right whitespace-nowrap">
                    <span className={[
                      'text-xs font-semibold px-1.5 py-0.5 rounded',
                      isAbove
                        ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                        : isBelow
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                        : 'text-slate-400 dark:text-slate-500',
                    ].join(' ')}>
                      {pctVsNational > 0 ? '+' : ''}{pctVsNational.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              );
            })}
            {groups.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">No data</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {groups.length > 10 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {showAll ? 'Show less' : `Show all ${groups.length} rows`}
        </button>
      )}
    </div>
  );
}
