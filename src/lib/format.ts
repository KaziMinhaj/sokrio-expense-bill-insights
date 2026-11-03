// Taka currency formatting for TA/DA Insights

/**
 * Format a number as Taka with en-IN digit grouping.
 * Example: 237043 → "Tk 2,37,043"
 */
export function formatTaka(n: number, fractionDigits = 0): string {
  return `Tk ${n.toLocaleString('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

/**
 * Format a difference as a mismatch string with sign.
 */
export function formatDiff(diff: number): string {
  const abs = Math.abs(diff);
  const sign = diff > 0 ? '+' : '-';
  return `${sign}${formatTaka(abs)}`;
}
