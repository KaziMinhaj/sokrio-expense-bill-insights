// ReconciliationBadge component
import type { ReconciliationResult } from '../types';
import { formatTaka } from '../lib/format';

interface Props {
  recon: ReconciliationResult;
  compact?: boolean;
}

export function ReconciliationBadge({ recon, compact = false }: Props) {
  if (recon.ok) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/40 px-3 py-1 text-sm font-semibold text-green-800 dark:text-green-300">
        <span>✓</span>
        <span>Reconciled</span>
      </span>
    );
  }

  const mainDiff = recon.submitDiff !== 0 ? recon.submitDiff : recon.payableDiff;
  const label = recon.submitDiff !== 0 ? 'Submit' : 'Payable';
  const diffStr = formatTaka(Math.abs(mainDiff));
  const sign = mainDiff > 0 ? '+' : '−';

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-3 py-1 text-sm font-semibold text-red-800 dark:text-red-300">
      <span>✗</span>
      {compact ? (
        <span>Mismatch</span>
      ) : (
        <span>
          {label} mismatch {sign}{diffStr}
        </span>
      )}
    </span>
  );
}
