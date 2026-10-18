import type { Preferences } from '../types';

const PREFS_KEY = 'mahjong_preferences';
const LAST_TABLE_KEY = 'mahjong_last_table';

const DEFAULT_PREFS: Preferences = {
  dashboardMode: 'card',
  keepAwake: true,
  selectedMetric: 'win',
  selectedPlayerIds: [],
  scope: 'table',
  dateRange: { type: 'all' },
  schemaVersion: 1,
};

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePreferences(prefs: Partial<Preferences>): void {
  try {
    const current = loadPreferences();
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
  } catch { /* storage full or blocked */ }
}

export function loadLastTable(): string[] | null {
  try {
    const raw = localStorage.getItem(LAST_TABLE_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length === 4 ? arr : null;
  } catch {
    return null;
  }
}

export function saveLastTable(playerIds: string[]): void {
  try {
    localStorage.setItem(LAST_TABLE_KEY, JSON.stringify(playerIds));
  } catch { /* ignore */ }
}

const SEAT_ROTATION_KEY = 'mahjong_seat_rotation';

/** 每張牌桌在這台裝置上的桌位方向（0–3，轉幾格），讓記錄的人把自己轉到下方 */
export function loadSeatRotation(sessionId: string): number {
  try {
    const raw = localStorage.getItem(SEAT_ROTATION_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const n = Number(map[sessionId] ?? 0);
    return Number.isInteger(n) ? ((n % 4) + 4) % 4 : 0;
  } catch {
    return 0;
  }
}

export function saveSeatRotation(sessionId: string, rotation: number): void {
  try {
    const raw = localStorage.getItem(SEAT_ROTATION_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[sessionId] = ((rotation % 4) + 4) % 4;
    localStorage.setItem(SEAT_ROTATION_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

const ME_KEY = 'mahjong_me';

/** 這台裝置的使用者是哪位玩家（記錄時自動把他轉到桌子下方） */
export function loadMe(): string | null {
  try {
    return localStorage.getItem(ME_KEY);
  } catch {
    return null;
  }
}

export function saveMe(playerId: string | null): void {
  try {
    if (playerId) localStorage.setItem(ME_KEY, playerId);
    else localStorage.removeItem(ME_KEY);
  } catch { /* ignore */ }
}
