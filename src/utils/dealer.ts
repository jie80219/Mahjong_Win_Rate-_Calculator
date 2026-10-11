import type { Round, TableSession, DealerState, WindName } from '../types';

const WINDS: WindName[] = ['東', '南', '西', '北'];

export function sortSessionRounds(rounds: Round[], sessionId: string): Round[] {
  return rounds
    .filter(r => r.tableSessionId === sessionId)
    .sort((a, b) => a.sequence - b.sequence || a.createdAt.localeCompare(b.createdAt));
}

export interface RoundDealer {
  dealerId: string;
  consecutive: number;
}

interface DealerWalk {
  perRound: RoundDealer[];
  dealerIdx: number;
  consecutive: number;
  dealerRotations: number;
}

// override.afterSequence = 該調整發生時已存在的局數，與局號是否連續無關
function walkDealer(session: TableSession, sorted: Round[]): DealerWalk | null {
  const seatOrder = session.seatOrder;
  if (!seatOrder || session.initialDealerIndex === undefined) return null;

  const overrides = (session.dealerOverrides ?? [])
    .slice()
    .sort((a, b) => a.afterSequence - b.afterSequence);

  let dealerIdx = session.initialDealerIndex;
  let consecutive = 0;
  let dealerRotations = 0;
  const perRound: RoundDealer[] = [];

  sorted.forEach((r, i) => {
    const override = overrides.find(o => o.afterSequence === i);
    if (override) {
      dealerIdx = override.dealerIndex;
      consecutive = override.consecutive;
      dealerRotations = computeRotationsFromIndex(session.initialDealerIndex!, dealerIdx, seatOrder.length);
    }

    const dealerId = seatOrder[dealerIdx];
    perRound.push({ dealerId, consecutive });

    if (r.resultType === 'draw' || r.winnerId === dealerId) {
      consecutive++;
    } else {
      consecutive = 0;
      dealerIdx = (dealerIdx + 1) % 4;
      dealerRotations++;
    }
  });

  const lastOverride = overrides.find(o => o.afterSequence >= sorted.length);
  if (lastOverride) {
    dealerIdx = lastOverride.dealerIndex;
    consecutive = lastOverride.consecutive;
    dealerRotations = computeRotationsFromIndex(session.initialDealerIndex, dealerIdx, seatOrder.length);
  }

  return { perRound, dealerIdx, consecutive, dealerRotations };
}

export function computeRoundDealers(session: TableSession, rounds: Round[]): RoundDealer[] | null {
  const walk = walkDealer(session, sortSessionRounds(rounds, session.id));
  return walk ? walk.perRound : null;
}

export function computeDealerState(
  session: TableSession,
  rounds: Round[],
): DealerState | null {
  const walk = walkDealer(session, sortSessionRounds(rounds, session.id));
  if (!walk || !session.seatOrder) return null;

  const fullCycles = Math.floor(walk.dealerRotations / 4);
  const windIndex = Math.min(fullCycles, 3);

  return {
    dealerId: session.seatOrder[walk.dealerIdx],
    consecutive: walk.consecutive,
    wind: WINDS[windIndex],
    windRound: (walk.dealerRotations % 4) + 1,
  };
}

function computeRotationsFromIndex(initial: number, current: number, size: number): number {
  return (current - initial + size) % size;
}

export function getDealerLabel(state: DealerState): string {
  const consLabel = state.consecutive > 0 ? `連${state.consecutive}` : '';
  return `${state.wind}圈${consLabel ? `・${consLabel}` : ''}`;
}
