import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { getPlayerName } from '../../db/players';
import { formatMoney } from '../../utils/money';

interface Props {
  cumulativeMoney: Record<string, number>;
  playerIds: string[];
}

export default function MoneyBarChart({ cumulativeMoney, playerIds }: Props) {
  const data = playerIds.map(pid => ({
    name: getPlayerName(pid),
    value: cumulativeMoney[pid] ?? 0,
    playerId: pid,
  }));

  const hasData = data.some(d => d.value !== 0);
  if (!hasData) {
    return (
      <div className="chart-container">
        <h4>累計金額</h4>
        <div className="no-data"><p>尚無金額紀錄</p></div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <h4>累計金額</h4>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis tickFormatter={v => `$${v}`} />
          <ReferenceLine y={0} stroke="#888" />
          <Tooltip
            formatter={(value: unknown) => {
              return [formatMoney(value as number), '累計金額'];
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.value >= 0 ? '#22c55e' : '#ef4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
