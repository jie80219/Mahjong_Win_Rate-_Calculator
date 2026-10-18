// 各家規則不同、存在這台裝置上的設定

const CRITICAL_KEY = 'mahjong_critical_tai';
export const DEFAULT_CRITICAL_TAI = 5;

let criticalCache: number | null = null;

/** 幾台以上算大牌（放槍給這種牌算放大槍），預設 5 台 */
export function getCriticalTai(): number {
  if (criticalCache !== null) return criticalCache;
  let n = DEFAULT_CRITICAL_TAI;
  try {
    const v = Number(localStorage.getItem(CRITICAL_KEY));
    if (Number.isInteger(v) && v >= 1) n = v;
  } catch { /* 沒有 localStorage（例如測試）就用預設 */ }
  criticalCache = n;
  return n;
}

export function setCriticalTai(n: number): void {
  const v = Number.isFinite(n) ? Math.max(1, Math.round(n)) : DEFAULT_CRITICAL_TAI;
  criticalCache = v;
  try {
    if (v === DEFAULT_CRITICAL_TAI) localStorage.removeItem(CRITICAL_KEY);
    else localStorage.setItem(CRITICAL_KEY, String(v));
  } catch { /* ignore */ }
}

export function isCriticalTai(tai: number | null | undefined): boolean {
  return tai !== null && tai !== undefined && tai >= getCriticalTai();
}

/** JSON 備份時一起帶走的裝置設定（大牌門檻、台數自訂、自訂牌型、隱藏牌型） */
export const SETTING_KEYS = [
  CRITICAL_KEY,
  'mahjong_tai_overrides',
  'mahjong_tai_custom',
  'mahjong_tai_hidden',
] as const;

export function exportSettings(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const k of SETTING_KEYS) {
      const v = localStorage.getItem(k);
      if (v !== null) out[k] = v;
    }
  } catch { /* ignore */ }
  return out;
}

export function importSettings(settings: Record<string, string> | undefined): void {
  if (!settings) return;
  try {
    for (const k of SETTING_KEYS) {
      if (typeof settings[k] === 'string') localStorage.setItem(k, settings[k]);
    }
  } catch { /* ignore */ }
  criticalCache = null;
}
