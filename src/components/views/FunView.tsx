import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { ComputedStats, Round, TableSession } from '../../types';
import { getPlayerName } from '../../db/players';
import {
  computeRivalry, computeStreaks, computeTaiDistribution, computePlayStyles, computeTitles, TAI_BUCKETS,
} from '../../utils/fun';

const COLORS = ['#4F86C6', '#E07A5F', '#81B29A', '#F2CC8F', '#9B5DE5', '#E36414', '#00BBF9', '#F15BB5'];

interface Props {
  stats: ComputedStats[];
  rounds: Round[];
  allRounds: Round[];
  sessions: TableSession[];
  playerIds: string[];
  tablePlayerMap: Map<string, string[]>;
}

export default function FunView({ stats, rounds, allRounds, sessions, playerIds, tablePlayerMap }: Props) {
  const streaks = useMemo(() => computeStreaks(rounds, playerIds, tablePlayerMap), [rounds, playerIds, tablePlayerMap]);
  const titles = useMemo(
    () => computeTitles({ rounds, stats, streaks, sessions, allRounds, playerIds }),
    [rounds, stats, streaks, sessions, allRounds, playerIds],
  );
  const rivalry = useMemo(() => computeRivalry(rounds, playerIds), [rounds, playerIds]);
  const styles = useMemo(() => computePlayStyles(rounds, stats), [rounds, stats]);
  const taiData = useMemo(() => {
    const dist = computeTaiDistribution(rounds, playerIds);
    return dist.map((row, i) => {
      const point: Record<string, number | string> = { bucket: TAI_BUCKETS[i] };
      for (const pid of playerIds) point[getPlayerName(pid)] = row[pid];
      return point;
    });
  }, [rounds, playerIds]);

  // 找出最懸殊的一組「提款機」關係
  const feeder = useMemo(() => {
    let best: { from: string; to: string; count: number } | null = null;
    for (const from of playerIds) {
      for (const to of playerIds) {
        const c = rivalry[from]?.[to]?.count ?? 0;
        if (c >= 2 && (!best || c > best.count)) best = { from, to, count: c };
      }
    }
    return best;
  }, [rivalry, playerIds]);

  const maxCell = Math.max(1, ...playerIds.flatMap(a => playerIds.map(b => rivalry[a]?.[b]?.count ?? 0)));

  return (
    <div className="fun-view">
      <section className="fun-section">
        <h4>🏅 稱號</h4>
        {titles.length === 0 ? (
          <p className="setup-hint">再多打幾局就會出現稱號</p>
        ) : (
          <div className="title-grid">
            {titles.map(t => (
              <div key={t.key} className="title-card">
                <span className="title-icon">{t.icon}</span>
                <span className="title-name">{t.title}</span>
                <span className="title-holder">{t.holders.map(getPlayerName).join('、')}</span>
                <span className="title-detail">{t.detail}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="fun-section">
        <h4>⚔️ 相剋關係</h4>
        {feeder && (
          <p className="fun-callout">
            {getPlayerName(feeder.from)} 是 {getPlayerName(feeder.to)} 的提款機（放槍 {feeder.count} 次）
          </p>
        )}
        <div className="rivalry-wrap">
          <table className="rivalry-table">
            <thead>
              <tr>
                <th className="rivalry-corner">放槍 ↓ ／ 胡 →</th>
                {playerIds.map(pid => <th key={pid}>{getPlayerName(pid)}</th>)}
              </tr>
            </thead>
            <tbody>
              {playerIds.map(from => (
                <tr key={from}>
                  <th>{getPlayerName(from)}</th>
                  {playerIds.map(to => {
                    if (from === to) return <td key={to} className="rivalry-self">—</td>;
                    const cell = rivalry[from]?.[to];
                    const c = cell?.count ?? 0;
                    return (
                      <td
                        key={to}
                        className="rivalry-cell"
                        style={{ '--heat': c / maxCell } as React.CSSProperties}
                        title={c ? `共 ${cell!.tai} 台` : ''}
                      >
                        {c || ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="fun-section">
        <h4>🎭 個人風格</h4>
        <div className="style-list">
          {styles.map(s => (
            <div key={s.playerId} className="style-row">
              <span className="style-name">{getPlayerName(s.playerId)}</span>
              <span className="style-tags">
                {s.tags.map(t => <span key={t} className="style-tag">{t}</span>)}
              </span>
              <span className="style-meta">
                平均 {s.avgTai === null ? '—' : s.avgTai.toFixed(1)} 台
                {s.selfDrawShare !== null && `・自摸占 ${(s.selfDrawShare * 100).toFixed(0)}%`}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="fun-section">
        <h4>📊 胡牌台數分布</h4>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={taiData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bucket" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            {playerIds.map((pid, i) => (
              <Bar key={pid} dataKey={getPlayerName(pid)} stackId="tai" fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="fun-section">
        <h4>📈 連續紀錄</h4>
        <div className="list-view-wrapper">
          <table className="streak-table">
            <thead>
              <tr><th>玩家</th><th>目前</th><th>最長連胡</th><th>最長乾旱</th></tr>
            </thead>
            <tbody>
              {streaks.map(s => (
                <tr key={s.playerId}>
                  <td className="player-name">{getPlayerName(s.playerId)}</td>
                  <td>
                    {s.currentWinStreak >= 1
                      ? <span className="streak-hot">連胡 {s.currentWinStreak}</span>
                      : <span className="streak-cold">{s.currentDrought} 局沒胡</span>}
                  </td>
                  <td>{s.longestWinStreak}</td>
                  <td>{s.longestDrought}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
