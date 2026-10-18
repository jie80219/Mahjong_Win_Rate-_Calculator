import type { Round, TableSession, DealerState, WindName } from '../types';

const WINDS: WindName[] = ['東', '南', '西', '北'];

export interface RoundDealer {
  dealerId: string;
  consecutive: number;
  /** 莊家座位（0–3），也就是第幾局 */
  dealerIdx?: number;
  /** 當局的圈風（0 = 東風，4 = 第二將東風） */
  windCount?: number;
}

/** 這張牌桌幾圈算一將（牌桌長度選「不提示」時，分段仍以 4 圈為一將） */
export function gameWinds(session: Pick<TableSession, 'windsPerGame'>): number {
  const w = session.windsPerGame;
  return w !== undefined && w > 0 ? w : 4;
}

/** 第幾將的名稱：一將「第2將」、半將「第2個半將」、一圈「第2圈」 */
export function gameName(session: Pick<TableSession, 'windsPerGame'>, n: number): string {
  const w = gameWinds(session);
  return w === 2 ? `第${n}個半將` : w === 1 ? `第${n}圈` : `第${n}將`;
}

/** 例如「第2將 南風西・連1」；舊牌局沒有座位資料時回傳空字串 */
export function roundDealerLabel(d: RoundDealer | undefined, session: Pick<TableSession, 'windsPerGame'> = {}): string {
  if (!d || d.dealerIdx === undefined || d.windCount === undefined) return '';
  const game = Math.floor(d.windCount / gameWinds(session)) + 1;
  return `${game > 1 ? `${gameName(session, game)} ` : ''}${windLabel(d.windCount, d.dealerIdx)}${d.consecutive > 0 ? `・連${d.consecutive}` : ''}`;
}

export interface GameSegment {
  /** 第幾將（從 1 開始） */
  index: number;
  label: string;
  rounds: Round[];
}

/** 把一張牌桌的牌局依「將」分段（同一組人打完一將繼續打，就有第二將、第三將…） */
export function splitGames(session: TableSession, rounds: Round[]): GameSegment[] {
  const sessionRounds = rounds
    .filter(r => r.tableSessionId === session.id)
    .sort((a, b) => a.sequence - b.sequence);
  const { byRound } = computeDealerTimeline(session, sessionRounds);
  const w = gameWinds(session);
  const segments = new Map<number, Round[]>();
  for (const r of sessionRounds) {
    const windCount = byRound.get(r.id)?.windCount ?? 0;
    const index = Math.floor(windCount / w) + 1;
    if (!segments.has(index)) segments.set(index, []);
    segments.get(index)!.push(r);
  }
  return [...segments.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, list]) => ({ index, label: gameName(session, index), rounds: list }));
}

export interface DealerTimeline {
  /** 每一局開打時的莊家與連莊數（依現有牌局即時推算，修改舊牌局後會自動更新） */
  byRound: Map<string, RoundDealer>;
  /** 下一局的莊家狀態 */
  state: DealerState | null;
}

/**
 * 「局」就是莊家坐的位置（西家當莊就是西局），所以只需要另外記圈風。
 * 圈風只在莊家從北家輪回東家時前進；手動換莊時依方向判斷有沒有跨過北→東：
 * 往下家（或隔一家）移且跨過北→東就進一圈，往上家移且跨回去就退一圈，其他情況圈風不變。
 */
export function shiftWindCount(windCount: number, prevDealerIdx: number, newDealerIdx: number): number {
  const forward = (newDealerIdx - prevDealerIdx + 4) % 4;
  if (forward === 0) return windCount;
  if (forward === 3) return newDealerIdx > prevDealerIdx ? Math.max(0, windCount - 1) : windCount;
  return newDealerIdx < prevDealerIdx ? windCount + 1 : windCount;
}

/** 例如「南風西」：圈風看 windCount，局看莊家座位 */
export function windLabel(windCount: number, dealerIdx: number): string {
  return `${WINDS[windCount % 4]}風${WINDS[dealerIdx]}`;
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
  /** 第幾個圈風（0 = 東風，4 = 第二將的東風） */
  let windCount = 0;
  /** 是否剛從北家輪回東家（用來判斷一將打完） */
  let wrapped = false;
  let overridePos = 0;

  const applyOverridesUpTo = (limit: number) => {
    while (overridePos < overrides.length && overrides[overridePos].afterSequence < limit) {
      const o = overrides[overridePos++];
      const prevDealer = seat[dealerIdx];
      if (o.seatOrder) seat = o.seatOrder;
      const prevIdxInNewSeat = Math.max(0, seat.indexOf(prevDealer));
      if (o.windCount !== undefined) windCount = o.windCount;
      // 前一版存的是「換過幾次莊」，圈風是它除以 4
      else if (o.rotations !== undefined) windCount = Math.floor(o.rotations / 4);
      else windCount = shiftWindCount(windCount, prevIdxInNewSeat, o.dealerIndex);
      dealerIdx = o.dealerIndex;
      consecutive = o.consecutive;
      wrapped = false;
    }
  };

  for (const r of sorted) {
    applyOverridesUpTo(r.sequence);

    const dealerId = seat[dealerIdx];
    byRound.set(r.id, { dealerId, consecutive, dealerIdx, windCount });

    const dealerStays = r.resultType === 'draw' || r.winnerId === dealerId;
    if (dealerStays) {
      consecutive++;
      wrapped = false;
    } else {
      consecutive = 0;
      dealerIdx = (dealerIdx + 1) % 4;
      wrapped = dealerIdx === 0;
      if (wrapped) windCount++;
    }
  }

  applyOverridesUpTo(Infinity);

  return {
    byRound,
    state: {
      dealerId: seat[dealerIdx],
      consecutive,
      wind: WINDS[windCount % 4],
      windRound: dealerIdx + 1,
      windCount,
      jiang: Math.floor(windCount / gameWinds(session)) + 1,
      // 牌桌長度選「不提示」（0）時不提示結算
      jiangComplete: session.windsPerGame !== 0 && wrapped && windCount > 0 && windCount % gameWinds(session) === 0,
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
