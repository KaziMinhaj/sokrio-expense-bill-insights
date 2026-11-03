// GapBreakdownBar — visual split of submit–payable gap by status
import { formatTaka } from '../lib/format';
import type { GapBreakdown } from '../lib/analytics';

interface Props {
  gap: GapBreakdown;
}

const SEGMENTS = [
  { key: 'pending' as keyof GapBreakdown, label: 'Pending', color: 'bg-amber-400 dark:bg-amber-500' },
  { key: 'rejected' as keyof GapBreakdown, label: 'Rejected', color: 'bg-red-400 dark:bg-red-500' },
  { key: 'cancelled' as keyof GapBreakdown, label: 'Cancelled', color: 'bg-slate-400 dark:bg-slate-500' },
  { key: 'realReductions' as keyof GapBreakdown, label: 'Real Reductions', color: 'bg-orange-400 dark:bg-orange-500' },
] as const;

export function GapBreakdownBar({ gap }: Props) {
  const total = gap.total;

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      {total > 0 && (
        <div className="flex h-3 w-full rounded-full overflow-hidden gap-px">
          {SEGMENTS.map(s => {
            const val = gap[s.key] as number;
            const pct = (val / total) * 100;
            if (pct <= 0) return null;
            return (
              <div
                key={s.key}
                className={`${s.color} transition-all`}
                style={{ width: `${pct}%` }}
                title={`${s.label}: ${formatTaka(val)} (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2">
        {SEGMENTS.map(s => {
          const val = gap[s.key] as number;
          const pct = total > 0 ? (val / total) * 100 : 0;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.color}`} />
              <div className="min-w-0">
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{s.label}</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {formatTaka(val)}
                  {total > 0 && (
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      {pct.toFixed(0)}%
                    </span>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500">
        Total gap: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatTaka(total)}</span>
        {' · '}Real reductions = accepted/approved submit minus payable.
        Pending/Rejected/Cancelled show full withheld amount.
      </p>
    </div>
  );
}
