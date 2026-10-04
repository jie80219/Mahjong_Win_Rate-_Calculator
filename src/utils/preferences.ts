import type { Preferences } from '../types';

const PREFS_KEY = 'mahjong_preferences';
const LAST_TABLE_KEY = 'mahjong_last_table';

const DEFAULT_PREFS: Preferences = {
  dashboardMode: 'card',
  selectedMetric: 'win',
  selectedPlayerIds: [],
  scope: 'table',
  dateRange: { type: 'all' },
  displayMode: 'rate',
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
