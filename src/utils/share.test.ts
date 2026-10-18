import { describe, it, expect, beforeAll } from 'vitest';
import type { Round, TableSession } from '../types';
import { setPlayerCache } from '../db/players';
import { encodeShare, decodeShare } from './share';

const P: [string, string, string, string] = ['p01', 'p02', 'mxyz12ab34', 'p04'];
const T0 = Date.parse('2026-10-18T11:00:00Z');

beforeAll(() => {
  setPlayerCache(P.map((id, i) => ({ id, displayName: ['傑智', '忠喆', '柏穎', '柏愷'][i], isActive: true })));
});

const session: TableSession = {
  id: 'mgk2x9a1b2c3',
  playerIds: P,
  seatOrder: [P[1], P[0], P[2], P[3]],
  initialSeatOrder: P,
  initialDealerIndex: 0,
  dealerOverrides: [{ afterSequence: 5, dealerIndex: 2, consecutive: 1, seatOrder: [P[1], P[0], P[2], P[3]], windCount: 1 }],
  dealerRule: 'standard',
  baseMoney: 50,
  taiMoney: 20,
  startedAt: new Date(T0).toISOString(),
  endedAt: new Date(T0 + 7200_000).toISOString(),
};

function makeRounds(n: number): Round[] {
  const rounds: Round[] = [];
  let seq = 0;
  for (let i = 0; i < n; i++) {
    seq += i === 7 ? 2 : 1; // 第 8 局前刪過一局，局數不連號
    const iso = new Date(T0 + i * 600_000 + (i % 5) * 17_000).toISOString();
    const type = i % 9 === 8 ? 'draw' : i % 3 === 0 ? 'selfDraw' : 'discardWin';
    rounds.push({
      id: `random${i}xyz`,
      tableSessionId: session.id,
      sequence: seq,
      playedAt: iso,
      resultType: type,
      winnerId: type === 'draw' ? null : P[i % 4],
      discarderId: type === 'discardWin' ? P[(i + 1) % 4] : null,
      tai: type === 'draw' ? null : (i * 5) % 12,
      ...(i % 4 === 1 ? { taiNote: '門清自摸、混一色' } : {}),
      ...(i === 4 ? { multiplier: 3 } : {}),
      createdAt: iso,
      updatedAt: iso,
    });
  }
  return rounds;
}

/** 比對時忽略每局的 ID（v2 匯入時重新產生） */
const strip = (rounds: Round[]) => rounds.map(({ id: _id, ...rest }) => rest);

describe('分享連結', () => {
  it('編碼再解碼，牌桌與牌局內容不變', async () => {
    const rounds = makeRounds(30);
    const shared = await decodeShare(await encodeShare(session, rounds));
    expect(shared.session).toEqual(session);
    expect(strip(shared.rounds)).toEqual(strip(rounds));
    expect(shared.names).toEqual({ p01: '傑智', p02: '忠喆', mxyz12ab34: '柏穎', p04: '柏愷' });
    expect(new Set(shared.rounds.map(r => r.id)).size).toBe(30);
  });

  it('沒有設定金額、沒有牌局的牌桌也能分享', async () => {
    const bare: TableSession = { id: 's2', playerIds: P, seatOrder: P, initialDealerIndex: 0, startedAt: session.startedAt, endedAt: null };
    const shared = await decodeShare(await encodeShare(bare, []));
    expect(shared.session).toEqual({ ...bare, initialSeatOrder: P });
    expect(shared.rounds).toEqual([]);
  });

  it('網址比舊版短很多', async () => {
    const rounds = makeRounds(60);
    const v2 = await encodeShare(session, rounds);
    const v1 = await encodeV1(session, rounds);
    expect(v2.length).toBeLessThan(v1.length * 0.6);
  });

  it('舊版（v1）連結仍然可以開', async () => {
    const rounds = makeRounds(10);
    const shared = await decodeShare(await encodeV1(session, rounds));
    expect(shared.session).toEqual(session);
    expect(shared.rounds).toEqual(rounds);
  });
});

/** 舊版分享格式的編碼方式，用來確認相容 */
async function encodeV1(s: TableSession, rounds: Round[]): Promise<string> {
  const players = [...s.playerIds];
  const idx = (id: string | null) => (id ? players.indexOf(id) : -1);
  const payload = {
    v: 1,
    s,
    n: { p01: '傑智', p02: '忠喆', mxyz12ab34: '柏穎', p04: '柏愷' },
    r: rounds.map(r => [
      r.id, r.sequence, Math.round(Date.parse(r.playedAt) / 1000), { selfDraw: 's', discardWin: 'd', draw: 'x' }[r.resultType],
      idx(r.winnerId), idx(r.discarderId), r.tai ?? -1,
      ...((r.multiplier ?? 1) > 1 ? [r.taiNote ?? '', r.multiplier] : r.taiNote ? [r.taiNote] : []),
    ]),
  };
  const json = new TextEncoder().encode(JSON.stringify(payload));
  const out = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(out).arrayBuffer());
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
