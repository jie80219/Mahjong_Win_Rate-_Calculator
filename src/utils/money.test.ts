import { describe, it, expect } from 'vitest';
import type { Round, TableSession, DealerRule } from '../types';
import { computeRoundMoney, computeSettlement, computeCumulativeMoney, computeAllRoundsMoney, withDealerTai } from './money';

const P: [string, string, string, string] = ['a', 'b', 'c', 'd'];

function session(dealerRule: DealerRule = 'standard'): TableSession {
  return {
    id: 's', playerIds: P, seatOrder: P, initialDealerIndex: 0, dealerRule,
    baseMoney: 50, taiMoney: 20, startedAt: '', endedAt: null,
  };
}

function round(r: Partial<Round>): Round {
  return {
    id: 'r', tableSessionId: 's', sequence: 1, playedAt: '', resultType: 'discardWin',
    winnerId: null, discarderId: null, tai: 0, createdAt: '', updatedAt: '', ...r,
  };
}

const money = (r: Partial<Round>, dealerId = 'a', consecutive = 0, rule: DealerRule = 'standard') =>
  computeRoundMoney(round(r), session(rule), { dealerId, consecutive })!.amounts;

describe('每局金額', () => {
  it('閒家放槍給閒家：底 + 台×台錢', () => {
    expect(money({ winnerId: 'b', discarderId: 'c', tai: 3 })).toEqual({ a: 0, b: 110, c: -110, d: 0 });
  });

  it('莊家放槍：加莊家台（1 + 2×連莊）', () => {
    expect(money({ winnerId: 'b', discarderId: 'a', tai: 3 }, 'a', 1)).toEqual({ a: -170, b: 170, c: 0, d: 0 });
  });

  it('閒家自摸：三家付，莊家多付莊家台', () => {
    expect(money({ resultType: 'selfDraw', winnerId: 'b', tai: 2 })).toEqual({ a: -110, b: 290, c: -90, d: -90 });
  });

  it('莊家自摸（標準）：三家都加莊家台', () => {
    expect(money({ resultType: 'selfDraw', winnerId: 'a', tai: 1 })).toEqual({ a: 270, b: -90, c: -90, d: -90 });
  });

  it('僅閒家自摸規則：莊家放槍不加莊家台', () => {
    expect(money({ winnerId: 'b', discarderId: 'a', tai: 3 }, 'a', 1, 'legacy')).toEqual({ a: -110, b: 110, c: 0, d: 0 });
  });

  it('流局不算錢', () => {
    expect(money({ resultType: 'draw', tai: null })).toEqual({ a: 0, b: 0, c: 0, d: 0 });
  });

  it('沒設底和台錢就不算', () => {
    const s = { ...session(), baseMoney: 0, taiMoney: 0 };
    expect(computeRoundMoney(round({ winnerId: 'b', discarderId: 'c', tai: 3 }), s)).toBeNull();
  });
});

describe('骰規豹子', () => {
  it('整筆含莊家台 ×3：(50 + 3×20 + 3×20) × 3 = 510', () => {
    expect(money({ winnerId: 'b', discarderId: 'a', tai: 3, multiplier: 3 }, 'a', 1)).toEqual({ a: -510, b: 510, c: 0, d: 0 });
  });

  it('自摸三家都 ×3', () => {
    expect(money({ resultType: 'selfDraw', winnerId: 'b', tai: 3, multiplier: 3 }, 'a', 1))
      .toEqual({ a: -510, b: 1170, c: -330, d: -330 });
  });
});

describe('總額與結算', () => {
  const rounds: Round[] = [
    round({ id: 'r1', sequence: 1, winnerId: 'b', discarderId: 'a', tai: 2 }),
    round({ id: 'r2', sequence: 2, resultType: 'selfDraw', winnerId: 'c', tai: 4, multiplier: 3 }),
    round({ id: 'r3', sequence: 3, resultType: 'draw', tai: null }),
    round({ id: 'r4', sequence: 4, winnerId: 'a', discarderId: 'd', tai: 1 }),
  ];

  it('每局四家加總為 0', () => {
    for (const rm of computeAllRoundsMoney(rounds, session())) {
      expect(Object.values(rm.amounts).reduce((x, y) => x + y, 0)).toBe(0);
    }
  });

  it('最少轉帳後每個人都結清', () => {
    const totals = computeCumulativeMoney(computeAllRoundsMoney(rounds, session()), [...P]);
    const transfers = computeSettlement(totals);
    const after = { ...totals };
    for (const t of transfers) {
      after[t.from] += t.amount;
      after[t.to] -= t.amount;
    }
    expect(Object.values(after).every(v => v === 0)).toBe(true);
    expect(transfers.length).toBeLessThanOrEqual(3);
  });
});

describe('含莊家台的總台數', () => {
  // 座位 a b c d、a 起莊：#1 a 自摸（連0）、#2 a 胡 b（連1）、#3 b 自摸 1 台（a 連2，莊家另付不算進總台數）、#4 c 胡 b（b 當莊連0）
  const rounds = [
    round({ id: '1', sequence: 1, resultType: 'selfDraw', winnerId: 'a', tai: 2 }),
    round({ id: '2', sequence: 2, winnerId: 'a', discarderId: 'b', tai: 1 }),
    round({ id: '3', sequence: 3, resultType: 'selfDraw', winnerId: 'b', tai: 1 }),
    round({ id: '4', sequence: 4, winnerId: 'c', discarderId: 'b', tai: 2 }),
  ];
  const taiOf = (rule: DealerRule) => withDealerTai(rounds, [session(rule)]).map(r => r.tai);

  it('標準：莊家胡牌、莊家放槍都加莊家台；閒家自摸不加', () => {
    expect(taiOf('standard')).toEqual([3, 4, 1, 3]);
  });

  it('僅閒家自摸規則：總台數不變', () => {
    expect(taiOf('legacy')).toEqual([2, 1, 1, 2]);
  });

  it('不改原始牌局，算錢照舊', () => {
    withDealerTai(rounds, [session()]);
    expect(rounds.map(r => r.tai)).toEqual([2, 1, 1, 2]);
  });
});
