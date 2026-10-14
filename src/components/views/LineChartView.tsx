import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Round, MetricKey } from '../../types';
import { computeCumulativeLine, getMetricLabel, formatRate } from '../../utils/stats';
import { getPlayerName } from '../../db/players';
import { formatMoney, type RoundMoney } from '../../utils/money';

const COLORS = ['#4F86C6', '#E07A5F', '#81B29A', '#F2CC8F', '#3D405B', '#E36414'];

interface Props {
  rounds: Round[];
  playerIds: string[];
  metric: MetricKey;
  tablePlayerMap: Map<string, string[]>;
  roundsMoney?: RoundMoney[];
}

function MoneyLineChart({ roundsMoney, playerIds }: { roundsMoney: RoundMoney[]; playerIds: string[] }) {
  const totals: Record<string, number> = {};
  for (const pid of playerIds) totals[pid] = 0;
  const data: Record<string, unknown>[] = [{ index: 0, ...Object.fromEntries(playerIds.map(p => [getPlayerName(p), 0])) }];
  roundsMoney.forEach((rm, i) => {
    const point: Record<string, unknown> = { index: i + 1 };
    for (const pid of playerIds) {
      totals[pid] += rm.amounts[pid] ?? 0;
      point[getPlayerName(pid)] = totals[pid];
    }
    data.push(point);
  });

  if (roundsMoney.length === 0) {
    return (
      <div className="chart-container">
        <h4>金額走勢</h4>
        <div className="no-data"><p>尚無金額紀錄</p></div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <h4>金額走勢（累積）</h4>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="index" label={{ value: '局', position: 'insideBottomRight', offset: -5 }} />
          <YAxis tickFormatter={v => `$${v}`} />
          <Tooltip formatter={(value: unknown, name: unknown) => [formatMoney(value as number), String(name)]} />
          <Legend />
          {playerIds.map((pid, i) => (
            <Line key={pid} type="monotone" dataKey={getPlayerName(pid)} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={2} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function LineChartView({ rounds, playerIds, metric, tablePlayerMap, roundsMoney }: Props) {
  if (metric === 'money') {
    return <MoneyLineChart roundsMoney={roundsMoney ?? []} playerIds={playerIds} />;
  }
  const lines = playerIds.map(pid =>
    computeCumulativeLine(rounds, pid, metric, tablePlayerMap)
  );

  const maxLen = Math.max(...lines.map(l => l.length), 0);
  const data: Record<string, unknown>[] = [];

  for (let i = 0; i < maxLen; i++) {
    const point: Record<string, unknown> = { index: i + 1 };
    for (let j = 0; j < playerIds.length; j++) {
      const pid = playerIds[j];
      const pName = getPlayerName(pid);
      const line = lines[j];
      const lp = line[i];
      if (lp) {
        point[pName] = lp.value;
        point[`${pName}_n`] = lp.numerator;
        point[`${pName}_d`] = lp.denominator;
      }
    }
    data.push(point);
  }

  return (
    <div className="chart-container">
      <h4>{getMetricLabel(metric)}（累積）</h4>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="index" label={{ value: '局', position: 'insideBottomRight', offset: -5 }} />
          <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} domain={[0, 'auto']} />
          <Tooltip
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
