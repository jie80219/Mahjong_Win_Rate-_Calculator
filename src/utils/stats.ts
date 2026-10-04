import type { Round, PlayerStats, ComputedStats, DateRange } from '../types';
import { startOfDay, subDays, isWithinInterval, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TZ = 'Asia/Taipei';

function toTaipeiDate(iso: string): Date {
  return toZonedTime(parseISO(iso), TZ);
}

export function filterRoundsByDate(rounds: Round[], dateRange: DateRange): Round[] {
  if (dateRange.type === 'all') return rounds;

  const now = toZonedTime(new Date(), TZ);
  const todayStart = startOfDay(now);

  let start: Date;
  let end: Date = now;

  switch (dateRange.type) {
    case 'today':
      start = todayStart;
      break;
    case 'week':
      start = subDays(todayStart, 6);
      break;
    case 'month':
      start = subDays(todayStart, 29);
      break;
    case 'custom':
      start = dateRange.start ? startOfDay(parseISO(dateRange.start)) : new Date(0);
      end = dateRange.end ? new Date(parseISO(dateRange.end).getTime() + 86400000 - 1) : now;
      break;
    default:
      return rounds;
  }

  return rounds.filter(r => {
    const d = toTaipeiDate(r.playedAt);
    return isWithinInterval(d, { start, end });
  });
}

export function computePlayerStats(
  rounds: Round[],
  playerIds: string[],
  allTablePlayerIds: Map<string, string[]>
): ComputedStats[] {
  return playerIds.map(pid => {
    const playerRounds = rounds.filter(r => {
      const tablePlayers = allTablePlayerIds.get(r.tableSessionId);
      return tablePlayers?.includes(pid);
    });

    const stats: PlayerStats = {
      playerId: pid,
      displayName: '',
      total: playerRounds.length,
      draws: 0,
      effective: 0,
      selfDraws: 0,
      ronWins: 0,
      discards: 0,
      beDrawn: 0,
      criticals: 0,
      beCriticals: 0,
    };

    for (const r of playerRounds) {
      if (r.resultType === 'draw') {
        stats.draws++;
        continue;
      }

      if (r.resultType === 'selfDraw') {
        if (r.winnerId === pid) {
          stats.selfDraws++;
          if (r.tai !== null && r.tai >= 5) stats.criticals++;
        } else {
          stats.beDrawn++;
        }
      } else if (r.resultType === 'discardWin') {
        if (r.winnerId === pid) {
          stats.ronWins++;
          if (r.tai !== null && r.tai >= 5) stats.criticals++;
        } else if (r.discarderId === pid) {
          stats.discards++;
          if (r.tai !== null && r.tai >= 5) stats.beCriticals++;
        }
      }
    }

    stats.effective = stats.total - stats.draws;
    const K = stats.effective;

    const rate = (n: number): number | null => (K === 0 ? null : n / K);

    const wins = stats.selfDraws + stats.ronWins;
    const T = stats.total;
    const rateT = (n: number): number | null => (T === 0 ? null : n / T);

    return {
      ...stats,
      selfDrawRate: rate(stats.selfDraws),
      winRate: rate(wins),
      discardRate: rate(stats.discards),
      beDrawnRate: rate(stats.beDrawn),
      criticalRate: rate(stats.criticals),
      beCriticalRate: rate(stats.beCriticals),
      criticalInWinRate: wins === 0 ? null : stats.criticals / wins,
      overallWinRate: rateT(wins),
      drawRate: rateT(stats.draws),
    };
  });
}

export function formatRate(rate: number | null): string {
  if (rate === null) return '—';
  return (rate * 100).toFixed(1) + '%';
}

export function getRateValue(stats: ComputedStats, metric: string): number | null {
  switch (metric) {
    case 'selfDraw': return stats.selfDrawRate;
    case 'win': return stats.winRate;
    case 'discard': return stats.discardRate;
    case 'beDrawn': return stats.beDrawnRate;
    case 'critical': return stats.criticalRate;
    case 'beCritical': return stats.beCriticalRate;
    case 'overallWin': return stats.overallWinRate;
    case 'drawRate': return stats.drawRate;
    default: return null;
  }
}

export function getMetricLabel(metric: string): string {
  const labels: Record<string, string> = {
    selfDraw: '自摸率',
    win: '胡牌率',
    discard: '放槍率',
    beDrawn: '被摸率',
    critical: '爆擊率',
    beCritical: '被爆率',
    overallWin: '勝率',
    drawRate: '總流局率',
  };
  return labels[metric] ?? metric;
}

export function getMetricNumerator(stats: ComputedStats, metric: string): number {
  switch (metric) {
    case 'selfDraw': return stats.selfDraws;
    case 'win': return stats.selfDraws + stats.ronWins;
    case 'discard': return stats.discards;
    case 'beDrawn': return stats.beDrawn;
    case 'critical': return stats.criticals;
    case 'beCritical': return stats.beCriticals;
    case 'overallWin': return stats.selfDraws + stats.ronWins;
    case 'drawRate': return stats.draws;
    default: return 0;
  }
}

export interface CumulativePoint {
  roundIndex: number;
  roundId: string;
  playedAt: string;
  value: number | null;
  numerator: number;
  denominator: number;
}

export function computeCumulativeLine(
  rounds: Round[],
  playerId: string,
  metric: string,
  allTablePlayerIds: Map<string, string[]>
): CumulativePoint[] {
  const sorted = [...rounds].sort((a, b) => {
    const t = a.playedAt.localeCompare(b.playedAt);
    if (t !== 0) return t;
    const s = a.sequence - b.sequence;
    if (s !== 0) return s;
    return a.id.localeCompare(b.id);
  });

  const points: CumulativePoint[] = [];
  let num = 0;
  let den = 0;
  let idx = 0;

  const useTotalDenominator = metric === 'overallWin' || metric === 'drawRate';

  for (const r of sorted) {
    const tablePlayers = allTablePlayerIds.get(r.tableSessionId);
    if (!tablePlayers?.includes(playerId)) continue;

    if (r.resultType === 'draw') {
      if (useTotalDenominator) {
        den++;
        if (metric === 'drawRate') num++;
        points.push({
          roundIndex: idx++,
          roundId: r.id,
          playedAt: r.playedAt,
          value: den === 0 ? null : num / den,
          numerator: num,
          denominator: den,
        });
      }
      continue;
    }

    den++;
    if (r.resultType === 'selfDraw') {
      if (r.winnerId === playerId) {
        if (metric === 'selfDraw' || metric === 'win' || metric === 'overallWin') num++;
        if (metric === 'critical' && r.tai !== null && r.tai >= 5) num++;
      } else {
        if (metric === 'beDrawn') num++;
      }
    } else if (r.resultType === 'discardWin') {
      if (r.winnerId === playerId) {
        if (metric === 'win' || metric === 'overallWin') num++;
        if (metric === 'critical' && r.tai !== null && r.tai >= 5) num++;
      } else if (r.discarderId === playerId) {
        if (metric === 'discard') num++;
        if (metric === 'beCritical' && r.tai !== null && r.tai >= 5) num++;
      }
    }

    points.push({
      roundIndex: idx++,
      roundId: r.id,
      playedAt: r.playedAt,
      value: den === 0 ? null : num / den,
      numerator: num,
      denominator: den,
    });
  }

  return points;
}
