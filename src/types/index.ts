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
}

export interface TableSession {
  id: string;
  playerIds: [string, string, string, string];
  seatOrder?: [string, string, string, string];
  initialDealerIndex?: number;
  dealerOverrides?: DealerOverride[];
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
}

export interface Preferences {
  dashboardMode: 'bar' | 'line' | 'list' | 'card';
  selectedMetric: MetricKey;
  selectedPlayerIds: string[];
  scope: 'table' | 'all';
  dateRange: DateRange;
  schemaVersion: number;
}

export type MetricKey = 'selfDraw' | 'win' | 'discard' | 'beDrawn' | 'critical' | 'beCritical' | 'overallWin' | 'drawRate';

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
