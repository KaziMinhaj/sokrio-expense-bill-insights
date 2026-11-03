// Shared UI components for charts and tables

// Inline progress bar used in ranking tables
interface InlineBarProps {
  value: number;
  max: number;
  color?: string;
}

export function InlineBar({ value, max, color = 'bg-blue-500' }: InlineBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-24 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// KPI card
interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate';
  icon?: string;
}

const ACCENT_CLASSES: Record<string, string> = {
  blue:   'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/50',
  green:  'bg-green-50 dark:bg-green-950/40 border-green-100 dark:border-green-900/50',
  amber:  'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/50',
  red:    'bg-red-50 dark:bg-red-950/40 border-red-100 dark:border-red-900/50',
  purple: 'bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900/50',
  slate:  'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700',
};

const ACCENT_VALUE: Record<string, string> = {
  blue:   'text-blue-700 dark:text-blue-300',
  green:  'text-green-700 dark:text-green-300',
  amber:  'text-amber-700 dark:text-amber-300',
  red:    'text-red-700 dark:text-red-300',
  purple: 'text-purple-700 dark:text-purple-300',
  slate:  'text-slate-800 dark:text-slate-100',
};

export function KpiCard({ label, value, sub, accent = 'slate', icon }: KpiCardProps) {
  return (
    <div className={`rounded-2xl border p-4 ${ACCENT_CLASSES[accent]}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-snug">{label}</p>
        {icon && <span className="text-base leading-none">{icon}</span>}
      </div>
      <p className={`mt-2 text-xl font-bold leading-tight truncate ${ACCENT_VALUE[accent]}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500 truncate">{sub}</p>}
    </div>
  );
}

// Section header
interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
}
export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 mb-3">
      <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">{title}</h2>
      {action}
    </div>
  );
}

// Empty state
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
      <span className="text-4xl mb-3">📭</span>
      <p className="text-sm">{message}</p>
    </div>
  );
}

// Sortable column header
interface SortHeaderProps {
  label: string;
  field: string;
  sortField: string;
  sortDir: 'asc' | 'desc';
  onSort: (field: string) => void;
  className?: string;
}
export function SortHeader({ label, field, sortField, sortDir, onSort, className = '' }: SortHeaderProps) {
  const active = sortField === field;
  return (
    <th
      className={`cursor-pointer select-none whitespace-nowrap py-2.5 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 ${className}`}
      onClick={() => onSort(field)}
    >
      {label}
      <span className="ml-1 opacity-60">
        {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </th>
  );
}
