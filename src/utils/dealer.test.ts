import { describe, it, expect } from 'vitest';
import type { Round, TableSession, DealerOverride, ResultType } from '../types';
import { computeDealerTimeline, shiftWindCount, windLabel, roundDealerLabel } from './dealer';

const P: [string, string, string, string] = ['a', 'b', 'c', 'd'];

function session(overrides: DealerOverride[] = [], initialDealerIndex = 0): TableSession {
  return {
    id: 's', playerIds: P, seatOrder: P, initialSeatOrder: P, initialDealerIndex,
    dealerOverrides: overrides, startedAt: '2026-01-01T00:00:00Z', endedAt: null,
  };
}

function round(sequence: number, resultType: ResultType, winnerId: string | null): Round {
  return {
    id: `r${sequence}`, tableSessionId: 's', sequence, playedAt: '', resultType,
    winnerId, discarderId: null, tai: resultType === 'draw' ? null : 1, createdAt: '', updatedAt: '',
  };
}

/** 每局都由莊家的下家胡，所以每局都換莊 */
function passDealer(n: number, startIdx = 0): Round[] {
  return Array.from({ length: n }, (_, i) => round(i + 1, 'discardWin', P[(startIdx + i + 1) % 4]));
}

function label(s: TableSession, rounds: Round[]): string {
  const st = computeDealerTimeline(s, rounds).state!;
  return `${st.jiang > 1 ? `第${st.jiang}將 ` : ''}${st.wind}風${'東南西北'[st.windRound - 1]} 莊${st.dealerId}`;
}

describe('圈風與局', () => {
  it('依序輪莊：東風東 → 北風北 → 第二將東風東', () => {
    expect(label(session(), passDealer(0))).toBe('東風東 莊a');
    expect(label(session(), passDealer(1))).toBe('東風南 莊b');
    expect(label(session(), passDealer(3))).toBe('東風北 莊d');
    expect(label(session(), passDealer(4))).toBe('南風東 莊a');
    expect(label(session(), passDealer(15))).toBe('北風北 莊d');
    expect(label(session(), passDealer(16))).toBe('第2將 東風東 莊a');
  });

  it('打完一將才提示結算', () => {
    expect(computeDealerTimeline(session(), passDealer(15)).state!.jiangComplete).toBe(false);
    expect(computeDealerTimeline(session(), passDealer(16)).state!.jiangComplete).toBe(true);
  });

  it('局一定是莊家的座位', () => {
    for (let n = 0; n < 40; n++) {
      const rounds = Array.from({ length: n }, (_, i) =>
        i % 3 === 0 ? round(i + 1, 'draw', null) : round(i + 1, 'discardWin', P[(i * 7) % 4]));
      const st = computeDealerTimeline(session(), rounds).state!;
      expect(P[st.windRound - 1]).toBe(st.dealerId);
    }
  });

  it('莊家胡牌或流局就連莊', () => {
    const rounds = [round(1, 'selfDraw', 'a'), round(2, 'draw', null)];
    const st = computeDealerTimeline(session(), rounds).state!;
    expect(st.dealerId).toBe('a');
    expect(st.consecutive).toBe(2);
    expect(label(session(), rounds)).toBe('東風東 莊a');
  });

  it('每局記下開打時的莊家、連莊、圈風', () => {
    const rounds = [round(1, 'selfDraw', 'a'), round(2, 'discardWin', 'c'), round(3, 'discardWin', 'c')];
    const { byRound } = computeDealerTimeline(session(), rounds);
    expect(byRound.get('r1')).toEqual({ dealerId: 'a', consecutive: 0, dealerIdx: 0, windCount: 0 });
    expect(byRound.get('r2')).toEqual({ dealerId: 'a', consecutive: 1, dealerIdx: 0, windCount: 0 });
    expect(byRound.get('r3')).toEqual({ dealerId: 'b', consecutive: 0, dealerIdx: 1, windCount: 0 });
    expect(roundDealerLabel(byRound.get('r2'))).toBe('東風東・連1');
  });
});

describe('手動調整莊家', () => {
  it('東風南改回上一家，不會多跳一圈', () => {
    const s = session([{ afterSequence: 1, dealerIndex: 0, consecutive: 0 }]);
    expect(label(s, passDealer(1))).toBe('東風東 莊a');
  });

  it('東風北改到下一家（東）進到南風', () => {
    const s = session([{ afterSequence: 3, dealerIndex: 0, consecutive: 0 }]);
    expect(label(s, passDealer(3))).toBe('南風東 莊a');
  });

  it('指定圈風時以指定為準', () => {
    const s = session([{ afterSequence: 0, dealerIndex: 2, consecutive: 1, windCount: 1 }]);
    const st = computeDealerTimeline(s, []).state!;
    expect(label(s, [])).toBe('南風西 莊c');
    expect(st.consecutive).toBe(1);
  });

  it('前一版存的 rotations 會換算成圈風', () => {
    const s = session([{ afterSequence: 0, dealerIndex: 2, consecutive: 0, rotations: 5 }]);
    expect(label(s, [])).toBe('南風西 莊c');
  });

  it('換座位時過去的莊家不變', () => {
    const swapped: [string, string, string, string] = ['b', 'a', 'c', 'd'];
    const s = { ...session([{ afterSequence: 2, dealerIndex: 2, consecutive: 0, seatOrder: swapped }]), seatOrder: swapped };
    const rounds = passDealer(3);
    const { byRound } = computeDealerTimeline(s, rounds);
    expect(byRound.get('r1')!.dealerId).toBe('a');
    expect(byRound.get('r2')!.dealerId).toBe('b');
    expect(byRound.get('r3')!.dealerId).toBe('c');
  });

  it('shiftWindCount 只在跨過北→東時改圈風', () => {
    expect(shiftWindCount(0, 0, 1)).toBe(0);
    expect(shiftWindCount(0, 3, 0)).toBe(1);
    expect(shiftWindCount(0, 2, 0)).toBe(1);
    expect(shiftWindCount(1, 0, 3)).toBe(0);
    expect(shiftWindCount(0, 0, 3)).toBe(0);
    expect(shiftWindCount(2, 1, 1)).toBe(2);
  });

  it('windLabel', () => {
    expect(windLabel(0, 2)).toBe('東風西');
    expect(windLabel(5, 3)).toBe('南風北');
  });
});
