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

export async function encodeShare(session: TableSession, rounds: Round[]): Promise<string> {
  const players = [...session.playerIds];
  const idx = (id: string | null) => (id ? players.indexOf(id) : -1);
  const payload: SharePayload = {
    v: 1,
    s: session,
    n: Object.fromEntries(players.map(id => [id, getPlayerName(id)])),
    r: rounds
      .filter(r => r.tableSessionId === session.id)
      .sort((a, b) => a.sequence - b.sequence)
      .map(r => [
        r.id,
        r.sequence,
        Math.round(Date.parse(r.playedAt) / 1000),
        TYPE_CODE[r.resultType],
        idx(r.winnerId),
        idx(r.discarderId),
        r.tai ?? -1,
        // 有倍率時牌型欄位要佔位，倍率才會在第 9 格
        ...((r.multiplier ?? 1) > 1 ? [r.taiNote ?? '', r.multiplier] : r.taiNote ? [r.taiNote] : []),
      ] as SharePayload['r'][number]),
  };
  const json = new TextEncoder().encode(JSON.stringify(payload));
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

export async function decodeShare(data: string): Promise<SharedTable> {
  const bytes = await pipe(fromBase64Url(data), new DecompressionStream('deflate-raw'));
  const payload = JSON.parse(new TextDecoder().decode(bytes)) as SharePayload;
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
