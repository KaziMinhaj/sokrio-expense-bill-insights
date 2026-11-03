// Navbar for TA/DA Insights — Phase 3
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  activePage: string;
  onNavigate: (page: string) => void;
}

const NAV_ITEMS = [
  { id: 'overview', label: '📈 Overview' },
  { id: 'trends', label: '📉 Trends' },
  { id: 'days-worked', label: '📅 Days Worked' },
  { id: 'entertainment', label: '🎭 Entertainment' },
  { id: 'data-manager', label: '📁 Data Manager' },
];

export function Navbar({ activePage, onNavigate }: Props) {
  const { theme, toggle } = useTheme();

  return (
    <nav className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xl">📊</span>
          <span className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight">
            TA/DA <span className="text-blue-600 dark:text-blue-400">Insights</span>
          </span>
        </div>

        {/* Nav links */}
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={[
                'px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap',
                activePage === item.id
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
    </nav>
  );
}
