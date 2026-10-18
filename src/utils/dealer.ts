import type { Round, TableSession, DealerState, WindName } from '../types';

const WINDS: WindName[] = ['東', '南', '西', '北'];

export interface RoundDealer {
  dealerId: string;
  consecutive: number;
}

export interface DealerTimeline {
  /** 每一局開打時的莊家與連莊數（依現有牌局即時推算，修改舊牌局後會自動更新） */
  byRound: Map<string, RoundDealer>;
  /** 下一局的莊家狀態 */
  state: DealerState | null;
}

/**
 * 手動換莊時推算圈數：往下家移是往前輪，往上家移（改回上一個莊）是往回退。
 * 以前一律當成往前輪，往回改一個莊會多跳 3 局，看起來就像多跳了一個圈風。
 */
export function shiftRotations(rotations: number, prevDealerIdx: number, newDealerIdx: number): number {
  const forward = (newDealerIdx - prevDealerIdx + 4) % 4;
  const delta = forward === 3 ? -1 : forward;
  return Math.max(0, rotations + delta);
}

export function rotationsLabel(rotations: number): string {
  return `${WINDS[Math.floor(rotations / 4) % 4]}風${WINDS[rotations % 4]}`;
}

export function computeDealerTimeline(
  session: TableSession,
  rounds: Round[],
): DealerTimeline {
  const byRound = new Map<string, RoundDealer>();
  const currentSeat = session.seatOrder;
  if (!currentSeat || session.initialDealerIndex === undefined) {
    return { byRound, state: null };
  }

  const sorted = rounds
    .filter(r => r.tableSessionId === session.id)
    .sort((a, b) => a.sequence - b.sequence);

  const overrides = (session.dealerOverrides ?? [])
    .slice()
    .sort((a, b) => a.afterSequence - b.afterSequence);

  let seat = session.initialSeatOrder ?? currentSeat;
  let dealerIdx = session.initialDealerIndex;
  let consecutive = 0;
  let rotations = 0;
  let overridePos = 0;

  const applyOverridesUpTo = (limit: number) => {
    while (overridePos < overrides.length && overrides[overridePos].afterSequence < limit) {
      const o = overrides[overridePos++];
      const prevDealer = seat[dealerIdx];
      if (o.seatOrder) seat = o.seatOrder;
      const prevIdxInNewSeat = Math.max(0, seat.indexOf(prevDealer));
      rotations = o.rotations ?? shiftRotations(rotations, prevIdxInNewSeat, o.dealerIndex);
      dealerIdx = o.dealerIndex;
      consecutive = o.consecutive;
    }
  };

  for (const r of sorted) {
    applyOverridesUpTo(r.sequence);

    const dealerId = seat[dealerIdx];
    byRound.set(r.id, { dealerId, consecutive });

    const dealerStays = r.resultType === 'draw' || r.winnerId === dealerId;
    if (dealerStays) {
      consecutive++;
    } else {
      consecutive = 0;
      dealerIdx = (dealerIdx + 1) % 4;
      rotations++;
    }
  }

  applyOverridesUpTo(Infinity);

  return {
    byRound,
    state: {
      dealerId: seat[dealerIdx],
      consecutive,
      wind: WINDS[Math.floor(rotations / 4) % 4],
      windRound: (rotations % 4) + 1,
      rotations,
      jiang: Math.floor(rotations / 16) + 1,
      jiangComplete: rotations > 0 && rotations % 16 === 0 && consecutive === 0,
    },
  };
}

export function computeDealerState(
  session: TableSession,
  rounds: Round[],
): DealerState | null {
  return computeDealerTimeline(session, rounds).state;
}

export function getDealerLabel(state: DealerState): string {
  const consLabel = state.consecutive > 0 ? `連${state.consecutive}` : '';
  return `${state.wind}圈${consLabel ? `・${consLabel}` : ''}`;
}
