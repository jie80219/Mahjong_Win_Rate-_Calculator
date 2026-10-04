import type { Round, TableSession, DealerState, WindName } from '../types';

const WINDS: WindName[] = ['東', '南', '西', '北'];

export function computeDealerState(
  session: TableSession,
  rounds: Round[],
): DealerState | null {
  const seatOrder = session.seatOrder;
  if (!seatOrder || session.initialDealerIndex === undefined) return null;

  const sorted = [...rounds]
    .filter(r => r.tableSessionId === session.id)
    .sort((a, b) => a.sequence - b.sequence);

  const overrides = (session.dealerOverrides ?? [])
    .slice()
    .sort((a, b) => a.afterSequence - b.afterSequence);

  let dealerIdx = session.initialDealerIndex;
  let consecutive = 0;
  let dealerRotations = 0;

  for (const r of sorted) {
    const override = overrides.find(o => o.afterSequence === r.sequence - 1);
    if (override) {
      dealerIdx = override.dealerIndex;
      consecutive = override.consecutive;
      dealerRotations = computeRotationsFromIndex(session.initialDealerIndex, dealerIdx, seatOrder.length);
    }

    const dealerId = seatOrder[dealerIdx];
    const dealerWins =
      r.resultType === 'draw' ||
      (r.winnerId === dealerId);

    if (dealerWins) {
      consecutive++;
    } else {
      consecutive = 0;
      dealerIdx = (dealerIdx + 1) % 4;
      dealerRotations++;
    }
  }

  const lastOverride = overrides.find(o => o.afterSequence >= (sorted.length));
  if (lastOverride) {
    dealerIdx = lastOverride.dealerIndex;
    consecutive = lastOverride.consecutive;
    dealerRotations = computeRotationsFromIndex(session.initialDealerIndex, dealerIdx, seatOrder.length);
  }

  const fullCycles = Math.floor(dealerRotations / 4);
  const windIndex = Math.min(fullCycles, 3);

  return {
    dealerId: seatOrder[dealerIdx],
    consecutive,
    wind: WINDS[windIndex],
    windRound: (dealerRotations % 4) + 1,
  };
}

function computeRotationsFromIndex(initial: number, current: number, size: number): number {
  return (current - initial + size) % size;
}

export function getDealerLabel(state: DealerState): string {
  const consLabel = state.consecutive > 0 ? `連${state.consecutive}` : '';
  return `${state.wind}圈${consLabel ? `・${consLabel}` : ''}`;
}
