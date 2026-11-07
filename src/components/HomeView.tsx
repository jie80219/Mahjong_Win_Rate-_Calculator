import { useMemo, useState } from 'react';
import type { ComputedStats, Player, Round, TableSession } from '../types';
import { getPlayerName } from '../db/players';
import { computePlayerStats, formatRate } from '../utils/stats';

const MIN_ROUNDS = 5;

interface Ranking {
  key: string;
  label: string;
  caption: string;
  rows: (stats: ComputedStats[], rounds: Round[]) => { playerId: string; value: string; sort: number }[];
}

const qualified = (stats: ComputedStats[]) => stats.filter(s => s.effective >= MIN_ROUNDS);

const RANKINGS: Ranking[] = [
  {
    key: 'selfDraw',
    label: '自摸榜',
    caption: `自摸率最高（有效局 ${MIN_ROUNDS} 局以上）`,
    rows: stats => qualified(stats).map(s => ({ playerId: s.playerId, value: formatRate(s.selfDrawRate), sort: s.selfDrawRate ?? 0 })),
  },
  {
    key: 'win',
    label: '胡牌榜',
    caption: `胡牌率最高（有效局 ${MIN_ROUNDS} 局以上）`,
    rows: stats => qualified(stats).map(s => ({ playerId: s.playerId, value: formatRate(s.winRate), sort: s.winRate ?? 0 })),
  },
  {
    key: 'guard',
    label: '銅牆榜',
    caption: `放槍率最低（有效局 ${MIN_ROUNDS} 局以上）`,
    rows: stats => qualified(stats).map(s => ({ playerId: s.playerId, value: formatRate(s.discardRate), sort: -(s.discardRate ?? 0) })),
  },
  {
    key: 'tai',
    label: '大台榜',
    caption: '單局胡牌台數最高',
    rows: (stats, rounds) => stats.flatMap(s => {
      const best = rounds
        .filter(r => r.winnerId === s.playerId && r.tai !== null)
        .reduce((max, r) => Math.max(max, r.tai as number), -1);
      return best < 0 ? [] : [{ playerId: s.playerId, value: `${best} 台`, sort: best }];
    }),
  },
  {
    key: 'games',
    label: '勤打榜',
    caption: '累計打最多局',
    rows: stats => stats.filter(s => s.total > 0).map(s => ({ playerId: s.playerId, value: `${s.total} 局`, sort: s.total })),
  },
];

interface Props {
  players: Player[];
  sessions: TableSession[];
  /** 含莊家台的牌局，排行榜的台數與統計儀表板一致 */
  rounds: Round[];
  tablePlayerMap: Map<string, string[]>;
  onNewTable: () => void;
  onResumeSession: (session: TableSession) => void;
}

export default function HomeView({ players, sessions, rounds, tablePlayerMap, onNewTable, onResumeSession }: Props) {
  const [rankingKey, setRankingKey] = useState(RANKINGS[0].key);
  const ranking = RANKINGS.find(r => r.key === rankingKey) ?? RANKINGS[0];

  const stats = useMemo(
    () => computePlayerStats(rounds, players.map(p => p.id), tablePlayerMap),
    [rounds, players, tablePlayerMap],
  );
  const rows = useMemo(
    () => ranking.rows(stats, rounds).sort((a, b) => b.sort - a.sort).slice(0, 5),
    [ranking, stats, rounds],
  );

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-copy">
          <h2>今晚這桌，交給我算</h2>
          <p>不用籌碼、不用記事本，四個人的輸贏一支手機記好。</p>
          <button className="btn-primary hero-cta" onClick={onNewTable}>建立新牌桌</button>
        </div>
        <div className="hero-tiles" aria-hidden="true">
          {['東', '南', '西', '北'].map(w => <span key={w} className="mini-tile">{w}</span>)}
        </div>
      </section>

      <section className="home-section">
        <div className="section-title">
          <h3>最近牌桌</h3>
          <span>{sessions.length} 桌</span>
        </div>
        {sessions.length === 0 ? (
          <p className="empty-note">還沒有牌桌，建立第一桌後會顯示在這裡。</p>
        ) : (
          <div className="session-list">
            {sessions.slice(0, 4).map(s => (
              <button key={s.id} className="session-row" onClick={() => onResumeSession(s)}>
                <span className="session-row-names">{s.playerIds.map(getPlayerName).join('・')}</span>
                <span className="session-row-meta">
                  {s.endedAt && <span className="tag-muted">已結束</span>}
                  底 {s.baseMoney ?? 0} ／ 台 {s.taiMoney ?? 0}・{new Date(s.startedAt).toLocaleDateString('zh-TW')}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="home-section">
        <div className="section-title"><h3>牌友榜</h3></div>
        <div className="rank-tabs" role="tablist" aria-label="排行榜類型">
          {RANKINGS.map(r => (
            <button
              key={r.key}
              role="tab"
              aria-selected={r.key === rankingKey}
              className={`rank-tab ${r.key === rankingKey ? 'active' : ''}`}
              onClick={() => setRankingKey(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="rank-caption">{ranking.caption}</p>
        {rows.length === 0 ? (
          <p className="empty-note">資料還不夠，多打幾局就會上榜。</p>
        ) : (
          <ol className="rank-list">
            {rows.map((row, i) => (
              <li key={row.playerId} className={i === 0 ? 'rank-first' : ''}>
                <span className="rank-no">{i + 1}</span>
                <span className="rank-name">{getPlayerName(row.playerId)}</span>
                <span className="rank-value">{row.value}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
