import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { ComputedStats, MetricKey } from '../../types';
import { getRateValue, getMetricLabel, formatRate, getMetricNumerator } from '../../utils/stats';

const COLORS = ['#4F86C6', '#E07A5F', '#81B29A', '#F2CC8F', '#3D405B', '#E36414'];

interface Props {
  stats: ComputedStats[];
  metric: MetricKey;
  onOpenHistory: (filter?: { playerId?: string; metric?: string }) => void;
}

export default function BarChartView({ stats, metric, onOpenHistory }: Props) {
  const data = stats.map(s => ({
    name: s.displayName,
    value: getRateValue(s, metric),
    rawValue: getRateValue(s, metric),
    numerator: getMetricNumerator(s, metric),
    denominator: (metric === 'overallWin' || metric === 'drawRate') ? s.total : s.effective,
    playerId: s.playerId,
  }));

  return (
    <div className="chart-container">
      <h4>{getMetricLabel(metric)}</h4>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} domain={[0, 'auto']} />
          <Tooltip
            formatter={(value: unknown) => {
              if (value === null || value === undefined) return ['—', getMetricLabel(metric)];
              return [formatRate(value as number), getMetricLabel(metric)];
            }}
            labelFormatter={(label, payload) => {
              if (payload && payload[0]) {
                const d = payload[0].payload as Record<string, unknown>;
                return `${label}（${d.numerator} / ${d.denominator} 局）`;
              }
              return String(label);
            }}
          />
          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            onClick={(d) => onOpenHistory({ playerId: (d as unknown as Record<string, string>).playerId, metric })}
            cursor="pointer"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
