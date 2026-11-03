// charts2.tsx — Additional chart components for Trends and Entertainment pages
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
  ComposedChart, Area,
} from 'recharts';
import { formatTaka } from '../lib/format';
import type { SeriesPoint, RegionSeriesPoint, MonthlyPoint, DayOfWeekPoint } from '../lib/trends';
import type { EntMonthPoint } from '../lib/entertainment';
import type { MonthDelta } from '../lib/trends';

// Shared tooltip style
const TT: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '0.5rem',
  fontSize: '12px',
  backgroundColor: '#fff',
};

function shortTaka(n: number) {
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(Math.round(n));
}

function fmtMonth(ym: string) {
  const NAMES: Record<string, string> = {
    '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun',
    '07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec',
  };
  const [y, m] = ym.split('-');
  return `${NAMES[m] ?? m} '${y.slice(2)}`;
}

// ─── Multi-month line chart ────────────────────────────────────────────────────

interface MultiMonthLineProps { data: MonthlyPoint[]; measureLabel: string }

export function MultiMonthLine({ data, measureLabel }: MultiMonthLineProps) {
  const display = data.map(d => ({ ...d, month: fmtMonth(d.month) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={display} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={shortTaka} tick={{ fontSize: 11 }} width={55} />
        <Tooltip formatter={(v: number) => [formatTaka(v), measureLabel]} contentStyle={TT} />
        <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} name={measureLabel} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Stacked bars by cost type ────────────────────────────────────────────────

interface StackedBarsProps { data: SeriesPoint[] }

const STACK_COLORS = {
  transport: '#3b82f6',
  da: '#10b981',
  accommodation: '#f59e0b',
  others: '#8b5cf6',
};

export function StackedBarsChart({ data }: StackedBarsProps) {
  const display = data.map(d => ({ ...d, month: fmtMonth(d.month) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={display} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={shortTaka} tick={{ fontSize: 11 }} width={55} />
        <Tooltip formatter={(v: number, n: string) => [formatTaka(v), n]} contentStyle={TT} />
        <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
        <Bar dataKey="transport" stackId="a" fill={STACK_COLORS.transport} name="Transport" />
        <Bar dataKey="da" stackId="a" fill={STACK_COLORS.da} name="DA" />
        <Bar dataKey="accommodation" stackId="a" fill={STACK_COLORS.accommodation} name="Accom." />
        <Bar dataKey="others" stackId="a" fill={STACK_COLORS.others} name="Others" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Multi-region line chart ──────────────────────────────────────────────────

const REGION_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316'];

interface RegionLinesProps { data: RegionSeriesPoint[]; regions: string[] }

export function RegionLinesChart({ data, regions }: RegionLinesProps) {
  const display = data.map(d => ({ ...d, month: fmtMonth(d.month as string) }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={display} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={shortTaka} tick={{ fontSize: 11 }} width={55} />
        <Tooltip formatter={(v: number, n: string) => [formatTaka(v), n]} contentStyle={TT} />
        <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
        {regions.map((r, i) => (
          <Line
            key={r}
            type="monotone"
            dataKey={r}
            stroke={REGION_COLORS[i % REGION_COLORS.length]}
            strokeWidth={2}
            dot={false}
            name={r}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Day-of-week bar ──────────────────────────────────────────────────────────

interface DayOfWeekBarProps { data: DayOfWeekPoint[] }

export function DayOfWeekBar({ data }: DayOfWeekBarProps) {
  // Reorder Mon–Sun
  const ordered = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    .map(d => data.find(x => x.day === d) ?? { day: d, submitTotal: 0, claimCount: 0 });
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={ordered} margin={{ left: 5, right: 5, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
        <XAxis dataKey="day" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={shortTaka} tick={{ fontSize: 11 }} width={50} />
        <Tooltip formatter={(v: number) => [formatTaka(v), 'Submit']} contentStyle={TT} />
        <Bar dataKey="submitTotal" fill="#6366f1" radius={[4,4,0,0]} maxBarSize={48} name="Submit" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Delta waterfall / comparison bars ───────────────────────────────────────

interface DeltaBarProps { data: MonthDelta[]; top: number; label: string }

export function DeltaBar({ data, top, label }: DeltaBarProps) {
  // Show top N by absolute delta, coloured by sign
  const display = data
    .slice(0, top)
    .map(d => ({ label: d.label.slice(0, 20), delta: d.delta, pct: d.pctChange }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, display.length * 32)}>
      <BarChart data={display} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" horizontal={false} />
        <XAxis type="number" tickFormatter={shortTaka} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(v: number) => [formatTaka(Math.abs(v)), label]}
          contentStyle={TT}
        />
        <Bar
          dataKey="delta"
          name={label}
          radius={[0, 4, 4, 0]}
          fill="#3b82f6"
          // colour cells individually
          label={{ position: 'right', fontSize: 10, formatter: (v: number) => v > 0 ? `+${shortTaka(v)}` : shortTaka(v) }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Entertainment trend line ─────────────────────────────────────────────────

interface EntTrendProps { data: EntMonthPoint[] }

export function EntTrendChart({ data }: EntTrendProps) {
  const display = data.map(d => ({
    month: fmtMonth(d.month),
    entSubmit: d.entSubmit,
    sharePct: +d.sharePct.toFixed(2),
  }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={display} margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="amt" tickFormatter={shortTaka} tick={{ fontSize: 11 }} width={55} />
        <YAxis yAxisId="pct" orientation="right" tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} width={40} />
        <Tooltip
          formatter={(v: number, n: string) =>
            n === 'Amount' ? [formatTaka(v), n] : [`${v}%`, n]
          }
          contentStyle={TT}
        />
        <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
        <Area yAxisId="amt" type="monotone" dataKey="entSubmit" fill="#fde68a" stroke="#f59e0b" strokeWidth={2} name="Amount" />
        <Line yAxisId="pct" type="monotone" dataKey="sharePct" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="% of Total" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── Entertainment by region bar ─────────────────────────────────────────────

interface EntRegionBarProps { data: { region: string; entSubmit: number }[] }

export function EntRegionBar({ data }: EntRegionBarProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ left: 10, right: 10, top: 5, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
        <XAxis dataKey="region" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
        <YAxis tickFormatter={shortTaka} tick={{ fontSize: 11 }} width={55} />
        <Tooltip formatter={(v: number) => [formatTaka(v), 'Entertainment']} contentStyle={TT} />
        <Bar dataKey="entSubmit" fill="#f59e0b" radius={[4,4,0,0]} name="Entertainment" />
      </BarChart>
    </ResponsiveContainer>
  );
}
