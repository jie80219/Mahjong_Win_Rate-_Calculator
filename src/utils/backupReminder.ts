const LAST_EXPORT_KEY = 'mahjong_last_export';
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

export function loadLastExport(): string | null {
  try {
    return localStorage.getItem(LAST_EXPORT_KEY);
  } catch {
    return null;
  }
}

export function markExported(): string {
  const now = new Date().toISOString();
  try {
    localStorage.setItem(LAST_EXPORT_KEY, now);
  } catch { /* storage blocked */ }
  return now;
}

// 從未匯出時，以最早一桌的開始時間起算
export function isBackupStale(lastExport: string | null, oldestSessionStartedAt: string | null, nowMs: number): boolean {
  const baseline = lastExport ?? oldestSessionStartedAt;
  if (!baseline) return false;
  return nowMs - new Date(baseline).getTime() > STALE_MS;
}
