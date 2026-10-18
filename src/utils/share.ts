import type { Round, TableSession, ResultType, Player } from '../types';
import { db } from '../db';
import { getPlayerName } from '../db/players';

// 分享連結：把一張牌桌壓縮後放進網址 hash，對方開啟即可合併到自己的裝置，不需要伺服器

const TYPE_CODE: Record<ResultType, string> = { selfDraw: 's', discardWin: 'd', draw: 'x' };
const CODE_TYPE: Record<string, ResultType> = { s: 'selfDraw', d: 'discardWin', x: 'draw' };

interface SharePayload {
  v: 1;
  s: TableSession;
  n: Record<string, string>;
  /** [id, sequence, playedAt(epoch 秒), 結果, 贏家 index, 放槍 index, 台數, 牌型?, 倍率?] */
  r: [string, number, number, string, number, number, number, string?, number?][];
}

export interface SharedTable {
  session: TableSession;
  rounds: Round[];
  names: Record<string, string>;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/*
 * v2 精簡格式（網址大約短一半以上）：
 * - 不帶每局的隨機 ID，匯入時用「牌桌 ID-局數」產生（合併時整桌牌局會一起取代，不影響）
 * - 時間只記跟上一局差幾秒（36 進位）
 * - 玩家、座位都用 0–3 的位置表示，牌桌設定只帶必要欄位
 * - 每局寫成一小段文字，例如「d125+gk」= 放槍胡、贏家 1、放槍 2、5 台、距上一局 596 秒；
 *   有倍率加「*倍數」，局數不連號（中間刪過局）加「^跳幾號」
 */
type SharePayloadV2 = [
  v: 2,
  sessionId: string,
  /** 開桌時間（epoch 秒，36 進位） */
  started: string,
  /** 結束時間，未結束為空字串 */
  ended: string,
  baseMoney: number | null,
  taiMoney: number | null,
  /** s = 標準、l = 僅閒家自摸 */
  rule: string,
  initialDealerIndex: number,
  /** 目前座位、起始座位：例如 "0123"，數字是 playerIds 的位置 */
  seat: string,
  initialSeat: string,
  /** 莊家調整：「局數.莊位.連莊.座位.圈風」，多筆用 ; 分隔 */
  overrides: string,
  /** [玩家 ID, 名字]，依 playerIds 順序 */
  players: [string, string][],
  rounds: string,
  /** [局數, 牌型] */
  notes: [number, string][],
];

const b36 = (n: number) => Math.round(n).toString(36);
const fromB36 = (s: string) => parseInt(s, 36);
const toSec = (iso: string) => Math.round(Date.parse(iso) / 1000);
const fromSec = (sec: number) => new Date(sec * 1000).toISOString();

const ROUND_RE = /^([sdx])([0-3_])([0-3_])(\d*)(?:\*(\d+))?(?:\^(\d+))?\+(-?[0-9a-z]+)$/;

function encodeV2(session: TableSession, rounds: Round[]): SharePayloadV2 {
  const players = [...session.playerIds];
  const pos = (id: string | null) => (id && players.includes(id) ? String(players.indexOf(id)) : '_');
  const seatStr = (seat?: string[]) => (seat ?? players).map(id => players.indexOf(id)).join('');
  const started = toSec(session.startedAt);

  let prev = started;
  let prevSeq = 0;
  const sorted = rounds
    .filter(r => r.tableSessionId === session.id)
    .sort((a, b) => a.sequence - b.sequence);
  const roundStr = sorted.map(r => {
    const t = toSec(r.playedAt);
    const mult = (r.multiplier ?? 1) > 1 ? `*${r.multiplier}` : '';
    const gap = r.sequence - prevSeq === 1 ? '' : `^${r.sequence - prevSeq}`;
    const s = `${TYPE_CODE[r.resultType]}${pos(r.winnerId)}${pos(r.discarderId)}${r.tai ?? ''}${mult}${gap}+${b36(t - prev)}`;
    prev = t;
    prevSeq = r.sequence;
    return s;
  }).join(',');

  const overrides = (session.dealerOverrides ?? []).map(o => [
    o.afterSequence,
    o.dealerIndex,
    o.consecutive,
    o.seatOrder ? seatStr(o.seatOrder) : '',
    o.windCount ?? (o.rotations !== undefined ? Math.floor(o.rotations / 4) : ''),
  ].join('.')).join(';');

  return [
    2,
    session.id,
    b36(started),
    session.endedAt ? b36(toSec(session.endedAt)) : '',
    session.baseMoney ?? null,
    session.taiMoney ?? null,
    session.dealerRule === 'standard' ? 's' : session.dealerRule === 'legacy' ? 'l' : '',
    session.initialDealerIndex ?? 0,
    seatStr(session.seatOrder),
    seatStr(session.initialSeatOrder ?? session.seatOrder),
    overrides,
    players.map(id => [id, getPlayerName(id)]),
    roundStr,
    sorted.filter(r => r.taiNote).map(r => [r.sequence, r.taiNote!]),
  ];
}

function decodeV2(p: SharePayloadV2): SharedTable {
  const [, sessionId, started, ended, baseMoney, taiMoney, rule, initialDealerIndex, seat, initialSeat, overrides, players, roundStr, notes] = p;
  const ids = players.map(([id]) => id) as [string, string, string, string];
  if (ids.length !== 4) throw new Error('格式不符');
  const toSeat = (s: string) => s.split('').map(i => ids[Number(i)]) as [string, string, string, string];

  const session: TableSession = {
    id: sessionId,
    playerIds: ids,
    seatOrder: toSeat(seat),
    initialSeatOrder: toSeat(initialSeat),
    initialDealerIndex,
    ...(baseMoney !== null ? { baseMoney } : {}),
    ...(taiMoney !== null ? { taiMoney } : {}),
    ...(rule ? { dealerRule: rule === 's' ? 'standard' as const : 'legacy' as const } : {}),
    ...(overrides ? {
      dealerOverrides: overrides.split(';').map(o => {
        const [after, dealer, cons, st, wind] = o.split('.');
        return {
          afterSequence: Number(after),
          dealerIndex: Number(dealer),
          consecutive: Number(cons),
          ...(st ? { seatOrder: toSeat(st) } : {}),
          ...(wind !== undefined && wind !== '' ? { windCount: Number(wind) } : {}),
        };
      }),
    } : {}),
    startedAt: fromSec(fromB36(started)),
    endedAt: ended ? fromSec(fromB36(ended)) : null,
  };

  const noteBySeq = new Map(notes);
  let t = fromB36(started);
  let sequence = 0;
  const rounds: Round[] = roundStr ? roundStr.split(',').map(s => {
    const m = ROUND_RE.exec(s);
    if (!m) throw new Error('格式不符');
    const [, code, w, d, tai, mult, gap, dt] = m;
    t += fromB36(dt);
    sequence += gap ? Number(gap) : 1;
    const iso = fromSec(t);
    const taiNote = noteBySeq.get(sequence);
    return {
      id: `${sessionId}-${sequence}`,
      tableSessionId: sessionId,
      sequence,
      playedAt: iso,
      resultType: CODE_TYPE[code],
      winnerId: w === '_' ? null : ids[Number(w)],
      discarderId: d === '_' ? null : ids[Number(d)],
      tai: tai === '' ? null : Number(tai),
      ...(taiNote ? { taiNote } : {}),
      ...(mult ? { multiplier: Number(mult) } : {}),
      createdAt: iso,
      updatedAt: iso,
    };
  }) : [];

  return { session, rounds, names: Object.fromEntries(players) };
}

export async function encodeShare(session: TableSession, rounds: Round[]): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(encodeV2(session, rounds)));
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

export async function decodeShare(data: string): Promise<SharedTable> {
  const bytes = await pipe(fromBase64Url(data), new DecompressionStream('deflate-raw'));
  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  if (Array.isArray(parsed) && parsed[0] === 2) return decodeV2(parsed as SharePayloadV2);
  // 舊版（v1）分享連結
  const payload = parsed as SharePayload;
  if (payload.v !== 1 || !payload.s?.id || !Array.isArray(payload.r)) throw new Error('格式不符');
  const players = [...payload.s.playerIds];
  const rounds: Round[] = payload.r.map(([id, sequence, ts, code, w, d, tai, taiNote, multiplier]) => {
    const iso = new Date(ts * 1000).toISOString();
    return {
      id,
      tableSessionId: payload.s.id,
      sequence,
      playedAt: iso,
      resultType: CODE_TYPE[code],
      winnerId: w >= 0 ? players[w] : null,
      discarderId: d >= 0 ? players[d] : null,
      tai: tai >= 0 ? tai : null,
      ...(taiNote ? { taiNote } : {}),
      ...(multiplier && multiplier > 1 ? { multiplier } : {}),
      createdAt: iso,
      updatedAt: iso,
    };
  });
  return { session: payload.s, rounds, names: payload.n ?? {} };
}

export function buildShareUrl(data: string): string {
  return `${location.origin}${location.pathname}#share=${data}`;
}

export function readShareFromHash(): string | null {
  const m = location.hash.match(/^#share=([A-Za-z0-9_-]+)$/);
  return m ? m[1] : null;
}

/** 合併分享的牌桌：同 ID 的牌桌與牌局以分享內容為準，其他資料不動 */
export async function mergeSharedTable(shared: SharedTable): Promise<void> {
  await db.transaction('rw', db.tableSessions, db.rounds, db.players, async () => {
    const existingPlayers = new Set((await db.players.toArray()).map(p => p.id));
    const newPlayers: Player[] = Object.entries(shared.names)
      .filter(([id]) => !existingPlayers.has(id))
      .map(([id, displayName]) => ({ id, displayName, isActive: true }));
    if (newPlayers.length) await db.players.bulkAdd(newPlayers);

    await db.tableSessions.put(shared.session);
    await db.rounds.where('tableSessionId').equals(shared.session.id).delete();
    await db.rounds.bulkPut(shared.rounds);
  });
}
