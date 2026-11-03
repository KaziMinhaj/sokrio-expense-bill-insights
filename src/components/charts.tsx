// Recharts-based chart components for TA/DA Insights
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
  BarChart as HistoChart,
} from 'recharts';
import { formatTaka } from '../lib/format';
import type { CostMixItem, StatusMixItem, DailyPoint } from '../lib/analytics';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortTaka(n: number) {
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(Math.round(n));
}

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--tw-bg)',
  border: '1px solid #e2e8f0',
  borderRadius: '0.5rem',
  fontSize: '12px',
};

// ─── Cost Mix Doughnut ────────────────────────────────────────────────────────

interface CostMixChartProps { data: CostMixItem[] }

export function CostMixChart({ data }: CostMixChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%" cy="50%"
          innerRadius={55} outerRadius={85}
          dataKey="value"
          paddingAngle={2}
        >
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip
          formatter={(val: number, name: string) =>
            [`${formatTaka(val)} (${total > 0 ? ((val / total) * 100).toFixed(1) : 0}%)`, name]
          }
          contentStyle={TOOLTIP_STYLE}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Status Mix Doughnut ──────────────────────────────────────────────────────

interface StatusMixChartProps { data: StatusMixItem[] }

export function StatusMixChart({ data }: StatusMixChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%" cy="50%"
          innerRadius={55} outerRadius={85}
          dataKey="value"
          paddingAngle={2}
        >
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip
          formatter={(val: number, name: string) =>
            [`${formatTaka(val)} (${total > 0 ? ((val / total) * 100).toFixed(1) : 0}%)`, name]
          }
          contentStyle={TOOLTIP_STYLE}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Region Bar Chart ─────────────────────────────────────────────────────────

interface RegionBarChartProps {
  data: { label: string; value: number }[];
  measureLabel: string;
}

export function RegionBarChart({ data, measureLabel }: RegionBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: 10, right: 10, top: 5, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          angle={-30}
          textAnchor="end"
          interval={0}
        />
        <YAxis tickFormatter={shortTaka} tick={{ fontSize: 11 }} width={55} />
        <Tooltip
          formatter={(val: number) => [formatTaka(val), measureLabel]}
          contentStyle={TOOLTIP_STYLE}
        />
        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Daily Trend Line Chart ───────────────────────────────────────────────────

interface DailyTrendChartProps { data: DailyPoint[] }

export function DailyTrendChart({ data }: DailyTrendChartProps) {
  const display = data.map(d => ({
    day: parseInt(d.date.slice(8)),
    submit: d.submit,
    payable: d.payable,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={display} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} label={{ value: 'Day', position: 'insideBottomRight', offset: -5, fontSize: 11 }} />
        <YAxis tickFormatter={shortTaka} tick={{ fontSize: 11 }} width={55} />
        <Tooltip
          formatter={(val: number, name: string) => [formatTaka(val), name === 'submit' ? 'Submit' : 'Payable']}
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={d => `Day ${d}`}
        />
        <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
        <Line type="monotone" dataKey="submit" stroke="#3b82f6" dot={false} strokeWidth={2} name="Submit" />
        <Line type="monotone" dataKey="payable" stroke="#10b981" dot={false} strokeWidth={2} name="Payable" />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Days Worked Histogram ────────────────────────────────────────────────────

interface DaysHistogramProps {
  data: { bin: string; count: number }[];
}

export function DaysHistogram({ data }: DaysHistogramProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <HistoChart data={data} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
        <XAxis dataKey="bin" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={35} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val: number) => [val, 'Officers']} />
        <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={64} />
      </HistoChart>
    </ResponsiveContainer>
  );
}
