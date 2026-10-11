import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Round, MetricKey } from '../../types';
import { computeCumulativeLine, getMetricLabel, formatRate, sortRoundsChronologically } from '../../utils/stats';
import { getPlayerName } from '../../db/players';

const COLORS = ['#4F86C6', '#E07A5F', '#81B29A', '#F2CC8F', '#3D405B', '#E36414'];

interface Props {
  rounds: Round[];
  playerIds: string[];
  metric: MetricKey;
  tablePlayerMap: Map<string, string[]>;
}

export default function LineChartView({ rounds, playerIds, metric, tablePlayerMap }: Props) {
  const orderedRounds = sortRoundsChronologically(rounds);
  const data: Record<string, unknown>[] = orderedRounds.map((_, i) => ({ index: i + 1 }));

  playerIds.forEach(pid => {
    const pName = getPlayerName(pid);
    const pointByRound = new Map(
      computeCumulativeLine(rounds, pid, metric, tablePlayerMap).map(p => [p.roundId, p]),
    );
    let last: { value: number | null; numerator: number; denominator: number } | null = null;
    orderedRounds.forEach((r, i) => {
      const point = pointByRound.get(r.id) ?? last;
      if (!point) return;
      last = point;
      data[i][pName] = point.value;
      data[i][`${pName}_n`] = point.numerator;
      data[i][`${pName}_d`] = point.denominator;
    });
  });

  return (
    <div className="chart-container">
      <h4>{getMetricLabel(metric)}（累積）</h4>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="index" label={{ value: '局', position: 'insideBottomRight', offset: -5 }} />
          <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} domain={[0, 'auto']} />
          <Tooltip
            labelFormatter={label => `第 ${label} 局`}
            formatter={(value: unknown, name: unknown) => {
              if (value === null || value === undefined) return ['—', String(name)];
              return [formatRate(value as number), String(name)];
            }}
          />
          <Legend />
          {playerIds.map((pid, i) => (
            <Line
              key={pid}
              type="monotone"
              dataKey={getPlayerName(pid)}
              stroke={COLORS[i % COLORS.length]}
              dot={false}
              connectNulls={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
