import type { ComputedStats, Round, TableSession } from '../types';
import { computeAllRoundsMoney, computeCumulativeMoney } from './money';
import { computePlayerStats } from './stats';

export interface PlayerProfile {
  stats: ComputedStats;
  netMoney: number;
  tableCount: number;
  averageWinTai: number | null;
  highestTai: number | null;
  longestStreak: number;
}

/** 彙整既有統計與金額函式的結果，供戰績頁顯示；不改變任何既有算法。 */
export function buildPlayerProfile(
  playerId: string,
  rounds: Round[],
  taiRounds: Round[],
  sessions: TableSession[],
  tablePlayerMap: Map<string, string[]>,
): PlayerProfile {
  const [stats] = computePlayerStats(taiRounds, [playerId], tablePlayerMap);
  const joined = sessions.filter(s => s.playerIds.includes(playerId));

  let netMoney = 0;
  for (const session of joined) {
    const totals = computeCumulativeMoney(
      computeAllRoundsMoney(rounds.filter(r => r.tableSessionId === session.id), session),
      [playerId],
    );
    netMoney += totals[playerId] ?? 0;
  }

  const winTai = taiRounds
    .filter(r => r.winnerId === playerId && r.tai !== null)
    .map(r => r.tai as number);

  const longestStreak = rounds
    .filter(r => r.dealerId === playerId)
    .reduce((max, r) => Math.max(max, r.dealerConsecutive ?? 0), 0);

  return {
    stats,
    netMoney,
    tableCount: joined.filter(s => rounds.some(r => r.tableSessionId === s.id)).length,
    averageWinTai: winTai.length === 0 ? null : winTai.reduce((a, b) => a + b, 0) / winTai.length,
    highestTai: winTai.length === 0 ? null : Math.max(...winTai),
    longestStreak,
  };
}

export interface StyleAxis {
  label: string;
  score: number;
  detail: string;
}

const clampScore = (ratio: number): number => Math.round(Math.max(0, Math.min(1, ratio)) * 100);

/**
 * 牌風圖五軸。分數只用來畫圖：把比率除以一個「打滿」的參考值後換算成 0–100。
 * 參考值：胡牌率 40%、自摸率 20%、放槍率 30%、大牌率 15%、連莊 5 次。
 */
export function buildStyleAxes(profile: PlayerProfile): StyleAxis[] {
  const { stats, longestStreak } = profile;
  const percent = (rate: number | null) => (rate === null ? '—' : `${(rate * 100).toFixed(1)}%`);

  return [
    { label: '胡牌', score: clampScore((stats.winRate ?? 0) / 0.4), detail: `胡牌率 ${percent(stats.winRate)}` },
    { label: '自摸', score: clampScore((stats.selfDrawRate ?? 0) / 0.2), detail: `自摸率 ${percent(stats.selfDrawRate)}` },
    { label: '爆發', score: clampScore((stats.criticalRate ?? 0) / 0.15), detail: `大牌率 ${percent(stats.criticalRate)}` },
    { label: '續航', score: clampScore(longestStreak / 5), detail: `最長連莊 ${longestStreak} 次` },
    {
      label: '守備',
      score: stats.discardRate === null ? 0 : clampScore(1 - stats.discardRate / 0.3),
      detail: `放槍率 ${percent(stats.discardRate)}`,
    },
  ];
}
