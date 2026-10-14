import type { Round, TableSession } from '../types';
import { computeDealerTimeline, type RoundDealer } from './dealer';

export interface RoundMoney {
  roundId: string;
  tableSessionId: string;
  sequence: number;
  playedAt: string;
  amounts: Record<string, number>;
}

export function computeRoundMoney(
  round: Round,
  session: TableSession,
  dealer?: RoundDealer,
): RoundMoney | null {
  const base = session.baseMoney ?? 0;
  const tai = session.taiMoney ?? 0;
  if (base === 0 && tai === 0) return null;

  const players = [...session.playerIds];
  const amounts: Record<string, number> = {};
  for (const p of players) amounts[p] = 0;
  const result: RoundMoney = {
    roundId: round.id,
    tableSessionId: round.tableSessionId,
    sequence: round.sequence,
    playedAt: round.playedAt,
    amounts,
  };

  if (round.resultType === 'draw' || !round.winnerId || round.tai === null) {
    return result;
  }

  const payment = base + round.tai * tai;
  const dealerId = dealer?.dealerId ?? round.dealerId ?? null;
  const consecutive = dealer?.consecutive ?? round.dealerConsecutive ?? 0;
  const dealerExtra = dealerId ? (2 * consecutive + 1) * tai : 0;
  const winnerIsDealer = round.winnerId === dealerId;
  const standard = (session.dealerRule ?? 'legacy') === 'standard';

  if (round.resultType === 'discardWin') {
    if (!round.discarderId) return result;
    let pay = payment;
    if (standard && (winnerIsDealer || round.discarderId === dealerId)) pay += dealerExtra;
    amounts[round.winnerId] = pay;
    amounts[round.discarderId] = -pay;
  }

  if (round.resultType === 'selfDraw') {
    for (const p of players) {
      if (p === round.winnerId) continue;
      let pay = payment;
      if (winnerIsDealer ? standard : p === dealerId) pay += dealerExtra;
      amounts[p] = -pay;
      amounts[round.winnerId] += pay;
    }
  }

  return result;
}

export function computeAllRoundsMoney(
  rounds: Round[],
  session: TableSession,
  allSessionRounds: Round[] = rounds,
): RoundMoney[] {
  // 莊家需用整桌牌局推算，避免日期篩選後連莊數算錯
  const { byRound } = computeDealerTimeline(session, allSessionRounds);
  const sorted = rounds
    .filter(r => r.tableSessionId === session.id)
    .sort((a, b) => a.sequence - b.sequence);

  const result: RoundMoney[] = [];
  for (const r of sorted) {
    const rm = computeRoundMoney(r, session, byRound.get(r.id));
    if (rm) result.push(rm);
  }
  return result;
}

/** 跨牌桌計算金額（全部紀錄用） */
export function computeMoneyAcrossSessions(
  rounds: Round[],
  sessions: TableSession[],
  allRounds: Round[],
): RoundMoney[] {
  const sessionIds = new Set(rounds.map(r => r.tableSessionId));
  const result: RoundMoney[] = [];
  for (const s of sessions) {
    if (!sessionIds.has(s.id)) continue;
    result.push(...computeAllRoundsMoney(rounds, s, allRounds.filter(r => r.tableSessionId === s.id)));
  }
  return result.sort((a, b) => a.playedAt.localeCompare(b.playedAt) || a.sequence - b.sequence);
}

export function computeCumulativeMoney(
  roundsMoney: RoundMoney[],
  playerIds: string[],
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const p of playerIds) totals[p] = 0;
  for (const rm of roundsMoney) {
    for (const [pid, amount] of Object.entries(rm.amounts)) {
      if (pid in totals) totals[pid] += amount;
    }
  }
  return totals;
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

/** 以最少轉帳次數結清（貪婪法：最大債務人付給最大債權人） */
export function computeSettlement(totals: Record<string, number>): Transfer[] {
  const debtors = Object.entries(totals).filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const creditors = Object.entries(totals).filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const transfers: Transfer[] = [];
  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.v - a.v);
    creditors.sort((a, b) => b.v - a.v);
    const d = debtors[0];
    const c = creditors[0];
    const amount = Math.min(d.v, c.v);
    transfers.push({ from: d.id, to: c.id, amount });
    d.v -= amount;
    c.v -= amount;
    if (d.v === 0) debtors.shift();
    if (c.v === 0) creditors.shift();
  }
  return transfers;
}

export function formatMoney(amount: number): string {
  if (amount === 0) return '$0';
  const sign = amount > 0 ? '+' : '-';
  return `${sign}$${Math.abs(amount).toLocaleString()}`;
}
