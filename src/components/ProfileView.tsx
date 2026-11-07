import { useMemo, useState } from 'react';
import type { Round, TableSession } from '../types';
import { PLAYERS } from '../db/players';
import { formatMoney } from '../utils/money';
import { formatRate } from '../utils/stats';
import { buildPlayerProfile, buildStyleAxes } from '../utils/profile';
import type { StyleAxis } from '../utils/profile';

const CHART_SIZE = 280;
const CENTER = CHART_SIZE / 2;
const RADIUS = 92;

function axisPoint(index: number, count: number, ratio: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  return {
    x: CENTER + Math.cos(angle) * RADIUS * ratio,
    y: CENTER + Math.sin(angle) * RADIUS * ratio,
  };
}

function toPoints(count: number, ratioAt: (i: number) => number): string {
  return Array.from({ length: count }, (_, i) => {
    const p = axisPoint(i, count, ratioAt(i));
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');
}

function StyleChart({ axes }: { axes: StyleAxis[] }) {
  const n = axes.length;
  return (
    <svg
      className="style-chart"
      viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
      role="img"
      aria-label={axes.map(a => `${a.label} ${a.score} 分`).join('，')}
    >
      {[1, 0.66, 0.33].map(level => (
        <polygon key={level} className="style-grid" points={toPoints(n, () => level)} />
      ))}
      {axes.map((axis, i) => {
        const end = axisPoint(i, n, 1);
        const label = axisPoint(i, n, 1.24);
        return (
          <g key={axis.label}>
            <line className="style-grid" x1={CENTER} y1={CENTER} x2={end.x} y2={end.y} />
            <text className="style-label" x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle">
              {axis.label}
            </text>
          </g>
        );
      })}
      <polygon className="style-area" points={toPoints(n, i => axes[i].score / 100)} />
      {axes.map((axis, i) => {
        const p = axisPoint(i, n, axis.score / 100);
        return <rect key={axis.label} className="style-dot" x={p.x - 4} y={p.y - 4} width="8" height="8" />;
      })}
    </svg>
  );
}

interface Props {
  rounds: Round[];
  sessions: TableSession[];
  tablePlayerMap: Map<string, string[]>;
  initialPlayerId: string;
}

export default function ProfileView({ rounds, sessions, tablePlayerMap, initialPlayerId }: Props) {
  const [playerId, setPlayerId] = useState(initialPlayerId);

  const profile = useMemo(
    () => buildPlayerProfile(playerId, rounds, sessions, tablePlayerMap),
    [playerId, rounds, sessions, tablePlayerMap],
  );
  const axes = useMemo(() => buildStyleAxes(profile), [profile]);
  const { stats } = profile;

  const ledger = [
    { label: '累計局數', value: `${stats.total} 局` },
    { label: '參與牌桌', value: `${profile.tableCount} 桌` },
    { label: '胡牌率', value: formatRate(stats.winRate) },
    { label: '自摸率', value: formatRate(stats.selfDrawRate) },
    { label: '放槍率', value: formatRate(stats.discardRate) },
    { label: '被摸率', value: formatRate(stats.beDrawnRate) },
    { label: '爆擊率', value: formatRate(stats.criticalRate) },
    { label: '被爆率', value: formatRate(stats.beCriticalRate) },
    { label: '平均胡牌台數', value: profile.averageWinTai === null ? '—' : `${profile.averageWinTai.toFixed(2)} 台` },
    { label: '單局最高台數', value: profile.highestTai === null ? '—' : `${profile.highestTai} 台` },
    { label: '最長連莊', value: `${profile.longestStreak} 次` },
    { label: '流局', value: `${stats.draws} 局` },
  ];

  return (
    <div className="profile">
      <h2 className="page-title">個人戰績</h2>
      <div className="player-tabs" role="group" aria-label="選擇玩家">
        {PLAYERS.map(p => (
          <button
            key={p.id}
            className={`player-tab ${p.id === playerId ? 'active' : ''}`}
            aria-pressed={p.id === playerId}
            onClick={() => setPlayerId(p.id)}
          >
            {p.displayName}
          </button>
        ))}
      </div>

      {stats.total === 0 ? (
        <p className="empty-note">這位牌友還沒有牌局紀錄。</p>
      ) : (
        <>
          <div className="net-banner">
            <span>所有牌桌累計淨輸贏</span>
            <strong className={profile.netMoney > 0 ? 'gain' : profile.netMoney < 0 ? 'loss' : ''}>
              {formatMoney(profile.netMoney)}
            </strong>
          </div>

          <section className="style-card">
            <h3>牌風圖</h3>
            <StyleChart axes={axes} />
            <ul className="style-legend">
              {axes.map(a => (
                <li key={a.label}>
                  <b>{a.label} {a.score}</b>
                  <span>{a.detail}</span>
                </li>
              ))}
            </ul>
            <p className="style-footnote">
              分數僅供比較牌風，由下列參考值換算：胡牌率 40%、自摸率 20%、爆擊率 15%、連莊 5 次視為滿分；放槍率 0% 為滿分、30% 以上為 0。
            </p>
          </section>

          <dl className="ledger">
            {ledger.map(row => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}
