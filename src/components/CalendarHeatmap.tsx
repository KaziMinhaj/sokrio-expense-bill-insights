// CalendarHeatmap — pure React/Tailwind calendar heatmap
import type { CalendarDay } from '../lib/trends';
import { formatTaka } from '../lib/format';

interface Props {
  days: CalendarDay[];
  month: string;
}

const DOW_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function heatColor(value: number, max: number): string {
  if (value === 0) return '';
  const intensity = Math.min(1, value / max);
  // Map intensity → blue shade
  if (intensity < 0.25) return 'bg-blue-100 dark:bg-blue-900/30';
  if (intensity < 0.5)  return 'bg-blue-300 dark:bg-blue-700/60';
  if (intensity < 0.75) return 'bg-blue-500 dark:bg-blue-500/80';
  return 'bg-blue-700 dark:bg-blue-400';
}

function textColor(value: number, max: number): string {
  const intensity = Math.min(1, value / max);
  if (intensity >= 0.5) return 'text-white dark:text-white';
  return 'text-slate-700 dark:text-slate-200';
}

export function CalendarHeatmap({ days, month }: Props) {
  if (days.length === 0) return null;

  const maxSubmit = Math.max(...days.map(d => d.submit));
  const [y, m] = month.split('-').map(Number);
  const firstDow = new Date(y, m - 1, 1).getDay(); // 0=Sun

  // Build grid: weeks × 7 days
  const totalCells = firstDow + days.length;
  const numWeeks = Math.ceil(totalCells / 7);

  return (
    <div className="space-y-2">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1">
        {DOW_LABELS.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-slate-400 dark:text-slate-500 py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {Array.from({ length: numWeeks }).map((_, week) => (
        <div key={week} className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, dow) => {
            const dayIdx = week * 7 + dow - firstDow;
            if (dayIdx < 0 || dayIdx >= days.length) {
              return <div key={dow} className="aspect-square rounded" />;
            }
            const day = days[dayIdx];
            const heat = heatColor(day.submit, maxSubmit);
            const tc = textColor(day.submit, maxSubmit);

            return (
              <div
                key={dow}
                title={day.isNoClaims
                  ? `${day.date} — No claims`
                  : `${day.date}\n${formatTaka(day.submit)} (${day.claimCount} claims)`
                }
                className={[
                  'aspect-square rounded flex flex-col items-center justify-center cursor-default transition-colors',
                  day.isNoClaims
                    ? 'bg-slate-100 dark:bg-slate-800/50'
                    : heat || 'bg-blue-50 dark:bg-blue-950/20',
                  // Friday highlight (dayOfWeek === 5)
                  day.dayOfWeek === 5 ? 'ring-1 ring-orange-300 dark:ring-orange-700' : '',
                ].join(' ')}
              >
                <span className={`text-xs font-semibold leading-none ${day.isNoClaims ? 'text-slate-300 dark:text-slate-600' : tc}`}>
                  {day.dayOfMonth}
                </span>
                {!day.isNoClaims && (
                  <span className={`text-[9px] leading-none mt-0.5 ${tc} opacity-80`}>
                    {day.submit >= 1000 ? `${(day.submit / 1000).toFixed(0)}K` : String(Math.round(day.submit))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-2 pt-1">
        <span className="text-xs text-slate-400 dark:text-slate-500">Low</span>
        <div className="flex gap-1">
          {['bg-blue-100 dark:bg-blue-900/30','bg-blue-300 dark:bg-blue-700/60','bg-blue-500','bg-blue-700 dark:bg-blue-400'].map(c => (
            <div key={c} className={`w-4 h-4 rounded ${c}`} />
          ))}
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500">High</span>
        <div className="ml-3 flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-800/50 ring-1 ring-orange-300 dark:ring-orange-700" />
          <span className="text-xs text-slate-400 dark:text-slate-500">Friday (no-claim day)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-800/50" />
          <span className="text-xs text-slate-400 dark:text-slate-500">No claims</span>
        </div>
      </div>
    </div>
  );
}
