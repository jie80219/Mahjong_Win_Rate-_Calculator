import type { Round, TableSession } from '../types';

export interface RoundMoney {
  roundId: string;
  sequence: number;
  amounts: Record<string, number>;
}

export function computeRoundMoney(
  round: Round,
  session: TableSession,
): RoundMoney | null {
  const base = session.baseMoney ?? 0;
  const tai = session.taiMoney ?? 0;
  if (base === 0 && tai === 0) return null;

  const players = [...session.playerIds];
  const amounts: Record<string, number> = {};
  for (const p of players) amounts[p] = 0;

  if (round.resultType === 'draw' || !round.winnerId || round.tai === null) {
    return { roundId: round.id, sequence: round.sequence, amounts };
  }

  const payment = base + round.tai * tai;

  if (round.resultType === 'discardWin') {
    if (!round.discarderId) return { roundId: round.id, sequence: round.sequence, amounts };
    amounts[round.winnerId] = payment;
    amounts[round.discarderId] = -payment;
  }

  if (round.resultType === 'selfDraw') {
    const dealerId = round.dealerId ?? null;
    const consecutive = round.dealerConsecutive ?? 0;
    const winnerIsDealer = round.winnerId === dealerId;

    for (const p of players) {
      if (p === round.winnerId) continue;
      let pay = payment;
      if (!winnerIsDealer && p === dealerId) {
        const dealerExtraTai = 2 * consecutive + 1;
        pay += dealerExtraTai * tai;
      }
      amounts[p] = -pay;
      amounts[round.winnerId] += pay;
    }
  }

  return { roundId: round.id, sequence: round.sequence, amounts };
}

export function computeAllRoundsMoney(
  rounds: Round[],
  session: TableSession,
): RoundMoney[] {
  const sorted = [...rounds]
    .filter(r => r.tableSessionId === session.id)
    .sort((a, b) => a.sequence - b.sequence);

  const result: RoundMoney[] = [];
  for (const r of sorted) {
    const rm = computeRoundMoney(r, session);
    if (rm) result.push(rm);
  }
  return result;
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

export function formatMoney(amount: number): string {
  if (amount === 0) return '$0';
  const sign = amount > 0 ? '+' : '';
  return `${sign}$${amount.toLocaleString()}`;
}
