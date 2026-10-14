import type { Round, TableSession, ComputedStats } from '../types';
import { computeDealerTimeline } from './dealer';

function chronological(rounds: Round[]): Round[] {
  return [...rounds].sort((a, b) =>
    a.playedAt.localeCompare(b.playedAt) || a.sequence - b.sequence || a.id.localeCompare(b.id));
}

function participates(r: Round, pid: string, tablePlayerMap: Map<string, string[]>): boolean {
  return tablePlayerMap.get(r.tableSessionId)?.includes(pid) ?? false;
}

// ---------- 相剋關係 ----------

export interface RivalryCell {
  count: number;
  tai: number;
}

/** matrix[放槍者][胡牌者] */
export function computeRivalry(rounds: Round[], playerIds: string[]): Record<string, Record<string, RivalryCell>> {
  const m: Record<string, Record<string, RivalryCell>> = {};
  for (const a of playerIds) {
    m[a] = {};
    for (const b of playerIds) m[a][b] = { count: 0, tai: 0 };
  }
  for (const r of rounds) {
    if (r.resultType !== 'discardWin' || !r.discarderId || !r.winnerId) continue;
    const cell = m[r.discarderId]?.[r.winnerId];
    if (!cell) continue;
    cell.count++;
    cell.tai += r.tai ?? 0;
  }
  return m;
}

// ---------- 連續紀錄 ----------

export interface StreakInfo {
  playerId: string;
  /** 目前連續沒胡的局數 */
  currentDrought: number;
  longestDrought: number;
  /** 目前連續胡牌局數（中間流局不中斷） */
  currentWinStreak: number;
  longestWinStreak: number;
}

export function computeStreaks(
  rounds: Round[],
  playerIds: string[],
  tablePlayerMap: Map<string, string[]>,
): StreakInfo[] {
  const sorted = chronological(rounds);
  return playerIds.map(pid => {
    let drought = 0, longestDrought = 0, winStreak = 0, longestWin = 0;
    for (const r of sorted) {
      if (!participates(r, pid, tablePlayerMap)) continue;
      if (r.winnerId === pid) {
        drought = 0;
        winStreak++;
        longestWin = Math.max(longestWin, winStreak);
      } else {
        drought++;
        longestDrought = Math.max(longestDrought, drought);
        if (r.resultType !== 'draw') winStreak = 0;
      }
    }
    return {
      playerId: pid,
      currentDrought: drought,
      longestDrought,
      currentWinStreak: winStreak,
      longestWinStreak: longestWin,
    };
  });
}

// ---------- 台數分布 ----------

export const TAI_BUCKETS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10+'];

export function computeTaiDistribution(rounds: Round[], playerIds: string[]): Record<string, number>[] {
  const rows = TAI_BUCKETS.map(b => {
    const row: Record<string, number> = {};
    for (const pid of playerIds) row[pid] = 0;
    return { bucket: b, row };
  });
  for (const r of rounds) {
    if (r.resultType === 'draw' || !r.winnerId || r.tai === null) continue;
    if (!playerIds.includes(r.winnerId)) continue;
    const idx = Math.min(r.tai, 10);
    rows[idx].row[r.winnerId]++;
  }
  return rows.map(({ row }) => row);
}

// ---------- 個人風格 ----------

export interface PlayStyle {
  playerId: string;
  avgTai: number | null;
  selfDrawShare: number | null;
  tags: string[];
}

export function computePlayStyles(rounds: Round[], stats: ComputedStats[]): PlayStyle[] {
  return stats.map(s => {
    const wins = rounds.filter(r => r.winnerId === s.playerId && r.tai !== null);
    const winCount = wins.length;
    const avgTai = winCount ? wins.reduce((sum, r) => sum + (r.tai ?? 0), 0) / winCount : null;
    const selfDrawShare = winCount ? s.selfDraws / winCount : null;
    const tags: string[] = [];

    if (s.effective < 8) {
      tags.push('樣本不足');
    } else {
      if (avgTai !== null && avgTai >= 4) tags.push('大牌型');
      if (avgTai !== null && avgTai < 2.5 && (s.winRate ?? 0) >= 0.25) tags.push('小胡快攻型');
      if ((s.discardRate ?? 1) <= 0.12) tags.push('鐵壁防守型');
      if ((s.discardRate ?? 0) >= 0.25) tags.push('慈善家');
      if (selfDrawShare !== null && winCount >= 3 && selfDrawShare >= 0.5) tags.push('自摸型');
      if ((s.winRate ?? 0) >= 0.3) tags.push('胡牌機器');
      if (tags.length === 0) tags.push('穩健平衡型');
    }
    return { playerId: s.playerId, avgTai, selfDrawShare, tags };
  });
}

// ---------- 稱號 ----------

export interface TitleAward {
  key: string;
  icon: string;
  title: string;
  holders: string[];
  detail: string;
}

function topHolders<T>(items: T[], value: (t: T) => number, id: (t: T) => string): { ids: string[]; value: number } | null {
  if (items.length === 0) return null;
  const max = Math.max(...items.map(value));
  if (!(max > 0)) return null;
  return { ids: items.filter(t => value(t) === max).map(id), value: max };
}

export function computeTitles(args: {
  rounds: Round[];
  stats: ComputedStats[];
  streaks: StreakInfo[];
  sessions: TableSession[];
  allRounds: Round[];
  playerIds: string[];
}): TitleAward[] {
  const { rounds, stats, streaks, sessions, allRounds, playerIds } = args;
  const awards: TitleAward[] = [];
  const push = (key: string, icon: string, title: string, top: { ids: string[]; value: number } | null, detail: (v: number) => string) => {
    if (top) awards.push({ key, icon, title, holders: top.ids, detail: detail(top.value) });
  };

  push('selfDraw', '🀄', '自摸王', topHolders(stats, s => s.selfDraws, s => s.playerId), v => `自摸 ${v} 次`);
  push('critical', '🌟', '大牌王', topHolders(stats, s => s.criticals, s => s.playerId), v => `5 台以上 ${v} 次`);
  push('discard', '🎁', '放槍之王', topHolders(stats, s => s.discards, s => s.playerId), v => `放槍 ${v} 次`);

  const biggest = rounds
    .filter(r => r.winnerId && r.tai !== null && playerIds.includes(r.winnerId))
    .reduce<Round | null>((best, r) => (!best || (r.tai ?? 0) > (best.tai ?? 0) ? r : best), null);
  if (biggest && biggest.winnerId) {
    awards.push({
      key: 'biggest', icon: '🐉', title: '單局最大',
      holders: [biggest.winnerId],
      detail: `${biggest.tai} 台${biggest.resultType === 'selfDraw' ? '自摸' : ''}`,
    });
  }

  // 連莊王：用每桌莊家時間軸找最長連莊
  const dealerMax: Record<string, number> = {};
  const roundIds = new Set(rounds.map(r => r.id));
  for (const s of sessions) {
    const sessionRounds = allRounds.filter(r => r.tableSessionId === s.id);
    if (!sessionRounds.some(r => roundIds.has(r.id))) continue;
    const { byRound, state } = computeDealerTimeline(s, sessionRounds);
    for (const [rid, d] of byRound) {
      if (!roundIds.has(rid)) continue;
      dealerMax[d.dealerId] = Math.max(dealerMax[d.dealerId] ?? 0, d.consecutive);
    }
    if (state) dealerMax[state.dealerId] = Math.max(dealerMax[state.dealerId] ?? 0, state.consecutive);
  }
  push('dealer', '👑', '連莊王',
    topHolders(playerIds.map(id => ({ id, v: dealerMax[id] ?? 0 })), x => x.v, x => x.id),
    v => `最高連 ${v}`);

  push('drought', '🏜️', '最長乾旱', topHolders(streaks, s => s.longestDrought, s => s.playerId), v => `連續 ${v} 局沒胡`);
  const hot = topHolders(streaks, s => s.longestWinStreak, s => s.playerId);
  push('hot', '🔥', '手氣最旺', hot && hot.value >= 2 ? hot : null, v => `連胡 ${v} 局`);

  const qualified = stats.filter(s => s.effective >= 10 && s.discardRate !== null);
  if (qualified.length >= 2) {
    const min = Math.min(...qualified.map(s => s.discardRate!));
    awards.push({
      key: 'wall', icon: '🛡️', title: '銅牆鐵壁',
      holders: qualified.filter(s => s.discardRate === min).map(s => s.playerId),
      detail: `放槍率 ${(min * 100).toFixed(1)}%`,
    });
  }

  return awards;
}

/** 牌桌上的即時提醒：乾旱或連胡 */
export function streakAlerts(streaks: StreakInfo[], getName: (id: string) => string): string[] {
  const alerts: string[] = [];
  for (const s of streaks) {
    if (s.currentWinStreak >= 2) alerts.push(`🔥 ${getName(s.playerId)} 已連胡 ${s.currentWinStreak} 局`);
    if (s.currentDrought >= 8) alerts.push(`🏜️ ${getName(s.playerId)} 已連續 ${s.currentDrought} 局沒胡`);
  }
  return alerts;
}
