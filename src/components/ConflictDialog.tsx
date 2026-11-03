// ConflictDialog component — handles month conflict resolution
import type { MonthConflict } from '../types';
import { formatTaka } from '../lib/format';

export type ConflictAction = 'replace' | 'keep-both' | 'cancel';

interface Props {
  conflicts: MonthConflict[];
  onResolve: (action: ConflictAction, month: string) => void;
}

export function ConflictDialog({ conflicts, onResolve }: Props) {
  if (conflicts.length === 0) return null;

  const conflict = conflicts[0]; // Handle one at a time

  const { month, existingDataset: existing, incomingDataset: incoming } = conflict;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-800 shadow-2xl p-6 space-y-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Month Already Exists
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Data for <strong>{month}</strong> is already stored.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-4">
            <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Existing</p>
            <p className="text-slate-600 dark:text-slate-400">{existing.stats.rowCount.toLocaleString('en-IN')} rows</p>
            <p className="text-slate-600 dark:text-slate-400">{existing.stats.employeeCount} officers</p>
            <p className="text-slate-600 dark:text-slate-400">{formatTaka(existing.stats.submitTotal)} submit</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{existing.fileName}</p>
          </div>
          <div className="rounded-xl bg-blue-50 dark:bg-blue-900/30 p-4">
            <p className="font-semibold text-blue-700 dark:text-blue-300 mb-2">Incoming</p>
            <p className="text-slate-600 dark:text-slate-400">{incoming.stats.rowCount.toLocaleString('en-IN')} rows</p>
            <p className="text-slate-600 dark:text-slate-400">{incoming.stats.employeeCount} officers</p>
            <p className="text-slate-600 dark:text-slate-400">{formatTaka(incoming.stats.submitTotal)} submit</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{incoming.fileName}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => onResolve('replace', month)}
            className="rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 text-sm transition-colors"
          >
            Replace
          </button>
          <button
            onClick={() => onResolve('keep-both', month)}
            className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 text-sm transition-colors"
          >
            Keep Both
          </button>
          <button
            onClick={() => onResolve('cancel', month)}
            className="rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold py-2.5 text-sm transition-colors"
          >
            Skip
          </button>
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500">
          <strong>Replace</strong>: overwrite stored month.&nbsp;
          <strong>Keep Both</strong>: merge rows (IDs deduplicated by SL).&nbsp;
          <strong>Skip</strong>: discard incoming data for this month.
        </p>
      </div>
    </div>
  );
}
