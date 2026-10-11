import type { Round, PlayerStats, ComputedStats, DateRange } from '../types';

const TZ = 'Asia/Taipei';
const DAY_MS = 86400000;

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// 以台北時區的 YYYY-MM-DD 字串比較日期，台北無日光節約時間，可直接用毫秒位移
function taipeiDayKey(ms: number): string {
  return dayFormatter.format(new Date(ms));
}

export function filterRoundsByDate(rounds: Round[], dateRange: DateRange): Round[] {
  if (dateRange.type === 'all') return rounds;

  const nowMs = Date.now();
  let startKey = '';
  let endKey = '9999-12-31';

  switch (dateRange.type) {
    case 'today':
      startKey = taipeiDayKey(nowMs);
      break;
    case 'week':
      startKey = taipeiDayKey(nowMs - 6 * DAY_MS);
      break;
    case 'month':
      startKey = taipeiDayKey(nowMs - 29 * DAY_MS);
      break;
    case 'custom':
      startKey = dateRange.start || '';
      endKey = dateRange.end || taipeiDayKey(nowMs);
      break;
    default:
      return rounds;
  }

  return rounds.filter(r => {
    const key = taipeiDayKey(new Date(r.playedAt).getTime());
    return key >= startKey && key <= endKey;
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
    money: '金額',
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

export function sortRoundsChronologically(rounds: Round[]): Round[] {
  return [...rounds].sort((a, b) => {
    const t = a.playedAt.localeCompare(b.playedAt);
    if (t !== 0) return t;
    const s = a.sequence - b.sequence;
    if (s !== 0) return s;
    return a.id.localeCompare(b.id);
  });
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
  const sorted = sortRoundsChronologically(rounds);

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
