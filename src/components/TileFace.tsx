import type { TileDef } from '../utils/tenpai';

const RED = 'var(--tile-red)';
const GREEN = 'var(--tile-green)';
const BLUE = 'var(--tile-blue)';
const INK = 'var(--tile-ink)';
const FACE = 'var(--tile-face)';

type Pip = [x: number, y: number, color: string];
type StickDef = [x: number, y: number, color: string, tilt?: number];

/** 牌面座標系為 36 × 48。索引 0 是二筒（一筒另外畫）。 */
const PINS: { r: number; pips: Pip[] }[] = [
  { r: 8, pips: [[18, 13, GREEN], [18, 35, BLUE]] },
  { r: 6.5, pips: [[8, 9, BLUE], [18, 24, RED], [28, 39, GREEN]] },
  { r: 7, pips: [[10, 13, BLUE], [26, 13, GREEN], [10, 35, GREEN], [26, 35, BLUE]] },
  { r: 6.5, pips: [[9, 10, BLUE], [27, 10, GREEN], [18, 24, RED], [9, 38, GREEN], [27, 38, BLUE]] },
  { r: 6, pips: [[11, 9, GREEN], [25, 9, GREEN], [11, 24, RED], [25, 24, RED], [11, 39, RED], [25, 39, RED]] },
  { r: 5, pips: [[7, 7, GREEN], [18, 11, GREEN], [29, 15, GREEN], [11, 27, RED], [25, 27, RED], [11, 40, RED], [25, 40, RED]] },
  { r: 5.2, pips: [7.5, 18.5, 29.5, 40.5].flatMap((y): Pip[] => [[11, y, BLUE], [25, y, BLUE]]) },
  { r: 5, pips: ([[9, BLUE], [24, RED], [39, GREEN]] as const).flatMap(([y, c]): Pip[] => [[7.5, y, c], [18, y, c], [28.5, y, c]]) },
];

/** 索引 0 是二索（一索另外畫）。 */
const STICKS: { length: number; sticks: StickDef[] }[] = [
  { length: 18, sticks: [[18, 13, GREEN], [18, 35, BLUE]] },
  { length: 18, sticks: [[18, 13, BLUE], [10, 35, GREEN], [26, 35, GREEN]] },
  { length: 18, sticks: [[10, 13, BLUE], [26, 13, GREEN], [10, 35, GREEN], [26, 35, BLUE]] },
  { length: 17, sticks: [[8, 13, GREEN], [28, 13, BLUE], [18, 24, RED], [8, 35, BLUE], [28, 35, GREEN]] },
  { length: 18, sticks: [7, 18, 29].flatMap((x): StickDef[] => [[x, 13, GREEN], [x, 35, BLUE]]) },
  { length: 12.5, sticks: [[18, 8, RED], ...[7, 18, 29].flatMap((x): StickDef[] => [[x, 24, GREEN], [x, 39, GREEN]])] },
  {
    length: 18,
    sticks: [
      [4, 13, GREEN], [12.5, 13, GREEN, 20], [23.5, 13, GREEN, -20], [32, 13, GREEN],
      [4, 35, BLUE], [12.5, 35, BLUE, -20], [23.5, 35, BLUE, 20], [32, 35, BLUE],
    ],
  },
  { length: 12.5, sticks: ([[7, GREEN], [18, RED], [29, BLUE]] as const).flatMap(([x, c]): StickDef[] => [[x, 9, c], [x, 24, c], [x, 39, c]]) },
];

function Pin({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  return (
    <>
      <circle cx={x} cy={y} r={r} fill={color} />
      <circle cx={x} cy={y} r={r * 0.64} fill={FACE} />
      <circle cx={x} cy={y} r={r * 0.36} fill={color} />
    </>
  );
}

function OnePin() {
  const petals = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
  return (
    <>
      <circle cx={18} cy={24} r={15} fill={GREEN} />
      <circle cx={18} cy={24} r={12.6} fill={FACE} />
      {petals.map(a => (
        <circle key={a} cx={18 + 9 * Math.cos(a)} cy={24 + 9 * Math.sin(a)} r={2} fill={BLUE} />
      ))}
      <circle cx={18} cy={24} r={5.4} fill={RED} />
      <circle cx={18} cy={24} r={2} fill={FACE} />
    </>
  );
}

function Stick({ x, y, length, color, tilt = 0 }: { x: number; y: number; length: number; color: string; tilt?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
      <rect x={-2.5} y={-length / 2} width={5} height={length} rx={1.8} fill={color} />
      <rect x={-3} y={-1} width={6} height={2} rx={1} fill={color} />
      <rect x={-0.4} y={-length / 2 + 1.8} width={0.8} height={length / 2 - 3.6} fill={FACE} />
      <rect x={-0.4} y={1.8} width={0.8} height={length / 2 - 3.6} fill={FACE} />
    </g>
  );
}

function OneBamboo() {
  return (
    <>
      <path d="M20 26C26 25 32 28 33 37C27 36 22 33 20 26Z" fill={BLUE} />
      <path d="M19 30C24 32 27 36 27 42C22 41 19 36 19 30Z" fill={RED} />
      <path d="M7 15C7 8 15 6 18 11C25 16 25 28 18 32C11 34 7 24 7 15Z" fill={GREEN} />
      <path d="M9 19C9 26 12 30 16 30C13 27 12 23 12 18Z" fill={FACE} />
      <path d="M14 16C20 16 23 22 21 29C17 27 14 23 14 16Z" fill={BLUE} />
      <path d="M11 8C11 5 14 3 17 3C15.5 5 15 7 15 9Z" fill={RED} />
      <path d="M7.5 11.5L2.5 14L8 15Z" fill={RED} />
      <circle cx={11} cy={12} r={1.8} fill={FACE} />
      <circle cx={10.7} cy={12} r={0.9} fill={INK} />
      <path d="M14 32L13 41M18 32L19 41" stroke={RED} strokeWidth={1.3} strokeLinecap="round" />
      <Stick x={18} y={42.5} length={26} color={GREEN} tilt={90} />
    </>
  );
}

function Glyph({ text, y = 24, size, color }: { text: string; y?: number; size: number; color: string }) {
  return (
    <text x={18} y={y} fontSize={size} fill={color} textAnchor="middle" dominantBaseline="central">
      {text}
    </text>
  );
}

function Face({ tile }: { tile: TileDef }) {
  const rank = tile.index % 9;
  switch (tile.group) {
    case '萬':
      return (
        <>
          <Glyph text={tile.top} y={14} size={17} color={INK} />
          <Glyph text="萬" y={34} size={20} color={RED} />
        </>
      );
    case '筒': {
      if (rank === 0) return <OnePin />;
      const { r, pips } = PINS[rank - 1];
      return pips.map(([x, y, color]) => <Pin key={`${x},${y}`} x={x} y={y} r={r} color={color} />);
    }
    case '索': {
      if (rank === 0) return <OneBamboo />;
      const { length, sticks } = STICKS[rank - 1];
      return sticks.map(([x, y, color, tilt]) => (
        <Stick key={`${x},${y}`} x={x} y={y} length={length} color={color} tilt={tilt} />
      ));
    }
    case '字':
      if (tile.top === '中') return <Glyph text="中" size={31} color={RED} />;
      if (tile.top === '發') return <Glyph text="發" size={29} color={GREEN} />;
      if (tile.top === '白') {
        return <rect x={6} y={7} width={24} height={34} rx={2} fill="none" stroke="#000" strokeWidth={2} />;
      }
      return <Glyph text={tile.top} size={27} color={INK} />;
  }
}

export default function TileFace({ tile }: { tile: TileDef }) {
  return (
    <svg className="tile-face" viewBox="0 0 36 48" role="img" aria-label={tile.name}>
      <Face tile={tile} />
    </svg>
  );
}
