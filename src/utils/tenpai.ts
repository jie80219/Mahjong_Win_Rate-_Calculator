export type TileGroup = '萬' | '筒' | '索' | '字';

export interface TileDef {
  index: number;
  group: TileGroup;
  top: string;
  bottom: string;
  name: string;
}

const NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const HONORS = ['東', '南', '西', '北', '中', '發', '白'];
const SUITS: TileGroup[] = ['萬', '筒', '索'];

export const TILES: TileDef[] = [
  ...SUITS.flatMap((suit, s) =>
    NUMERALS.map((n, i) => ({
      index: s * 9 + i,
      group: suit,
      top: n,
      bottom: suit,
      name: `${n}${suit}`,
    })),
  ),
  ...HONORS.map((h, i) => ({
    index: 27 + i,
    group: '字' as const,
    top: h,
    bottom: '',
    name: h,
  })),
];

export const TILE_GROUPS: TileGroup[] = ['萬', '筒', '索', '字'];
export const HAND_SIZE = 16;
export const MAX_COPIES = 4;

export function requiredHandSize(meldCount: number): number {
  return HAND_SIZE - meldCount * 3;
}

function canFormSets(counts: number[], from = 0): boolean {
  let i = from;
  while (i < counts.length && counts[i] === 0) i++;
  if (i === counts.length) return true;

  if (counts[i] >= 3) {
    counts[i] -= 3;
    const ok = canFormSets(counts, i);
    counts[i] += 3;
    if (ok) return true;
  }

  const canRun = i < 27 && i % 9 <= 6 && counts[i + 1] > 0 && counts[i + 2] > 0;
  if (canRun) {
    counts[i]--;
    counts[i + 1]--;
    counts[i + 2]--;
    const ok = canFormSets(counts, i);
    counts[i]++;
    counts[i + 1]++;
    counts[i + 2]++;
    if (ok) return true;
  }

  return false;
}

function isWinningShape(counts: number[]): boolean {
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] < 2) continue;
    counts[i] -= 2;
    const ok = canFormSets(counts);
    counts[i] += 2;
    if (ok) return true;
  }
  return false;
}

export interface Wait {
  tile: TileDef;
  remaining: number;
}

/** 回傳手牌在「N 組面子＋一對」牌型下聽的牌；remaining 只扣除手牌內的張數。 */
export function findWaits(hand: number[]): Wait[] {
  const counts = new Array<number>(TILES.length).fill(0);
  for (const t of hand) counts[t]++;

  const waits: Wait[] = [];
  for (const tile of TILES) {
    if (counts[tile.index] >= MAX_COPIES) continue;
    counts[tile.index]++;
    if (isWinningShape(counts)) {
      waits.push({ tile, remaining: MAX_COPIES - (counts[tile.index] - 1) });
    }
    counts[tile.index]--;
  }
  return waits;
}

/** 範例：一二三萬、四五六筒、七八九索、東東東、中中、五六萬，聽四萬與七萬。 */
export const SAMPLE_HAND: number[] = [0, 1, 2, 12, 13, 14, 24, 25, 26, 27, 27, 27, 31, 31, 4, 5];
