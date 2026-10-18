export type ResultType = 'selfDraw' | 'discardWin' | 'draw';

export interface Player {
  id: string;
  displayName: string;
  isActive: boolean;
}

export interface DealerOverride {
  afterSequence: number;
  dealerIndex: number;
  consecutive: number;
  seatOrder?: [string, string, string, string];
  /** 調整後的圈風（0 = 東風，4 = 第二將東風）；局由莊家座位決定 */
  windCount?: number;
  /** 前一版的欄位（換過幾次莊），只用來讀舊資料 */
  rotations?: number;
}

/**
 * standard：莊家胡牌、放槍、被摸皆加計莊家台（1 + 2×連莊）
 * legacy：只有閒家自摸時莊家多付莊家台（舊牌桌的算法）
 */
export type DealerRule = 'standard' | 'legacy';

export interface TableSession {
  id: string;
  playerIds: [string, string, string, string];
  seatOrder?: [string, string, string, string];
  initialSeatOrder?: [string, string, string, string];
  initialDealerIndex?: number;
  dealerOverrides?: DealerOverride[];
  dealerRule?: DealerRule;
  baseMoney?: number;
  taiMoney?: number;
  startedAt: string;
  endedAt: string | null;
}

export interface Round {
  id: string;
  tableSessionId: string;
  sequence: number;
  playedAt: string;
  resultType: ResultType;
  winnerId: string | null;
  discarderId: string | null;
  tai: number | null;
  /** 用台數計算表算出的牌型，例如「門清自摸、混一色」 */
  taiNote?: string;
  /** 骰規豹子等倍率：整筆金額（含底、莊家台）乘上這個數，沒有就是 1 */
  multiplier?: number;
  dealerId?: string | null;
  dealerConsecutive?: number;
  createdAt: string;
  updatedAt: string;
}

export type WindName = '東' | '南' | '西' | '北';

export interface DealerState {
  dealerId: string;
  consecutive: number;
  wind: WindName;
  windRound: number;
  /** 第幾個圈風（0 = 東風，4 = 第二將東風），局則是莊家座位 */
  windCount: number;
  /** 第幾將（四圈打完算一將） */
  jiang: number;
  /** 剛好打完一將（北風北結束） */
  jiangComplete: boolean;
}

export interface Preferences {
  dashboardMode: 'bar' | 'line' | 'list' | 'card' | 'fun';
  keepAwake: boolean;
  selectedMetric: MetricKey;
  selectedPlayerIds: string[];
  scope: 'table' | 'all';
  dateRange: DateRange;
  schemaVersion: number;
}

export type MetricKey = 'selfDraw' | 'win' | 'discard' | 'beDrawn' | 'critical' | 'beCritical' | 'overallWin' | 'drawRate' | 'money';

export interface DateRange {
  type: 'all' | 'today' | 'week' | 'month' | 'custom';
  start?: string;
  end?: string;
}

export interface PlayerStats {
  playerId: string;
  displayName: string;
  total: number;       // T
  draws: number;       // D
  effective: number;   // N = T - D
  selfDraws: number;   // S
  ronWins: number;     // R
  discards: number;    // L
  beDrawn: number;     // M
  criticals: number;   // C
  beCriticals: number; // B
}

export interface ComputedStats extends PlayerStats {
  selfDrawRate: number | null;
  winRate: number | null;
  discardRate: number | null;
  beDrawnRate: number | null;
  criticalRate: number | null;
  beCriticalRate: number | null;
  criticalInWinRate: number | null;
  overallWinRate: number | null;
  drawRate: number | null;
}

export interface RoundSummary extends Round {
  winnerName?: string;
  discarderName?: string;
  isCritical: boolean;
}
