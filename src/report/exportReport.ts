import type { Player, Preferences, Round, TableSession } from '../types';
import { db } from '../db';
import { exportHtml } from '../utils/backup';

// HTML 報表：把網頁本身（建置後的 JS／CSS）和資料一起包進單一檔案，
// 打開後就是唯讀版的網頁，長條、折線、清單、卡片、趣味都能切換，畫面跟網頁一模一樣。

export interface ReportData {
  v: 1;
  exportedAt: string;
  players: Player[];
  sessions: TableSession[];
  rounds: Round[];
  activeSessionId: string | null;
  prefs: Preferences;
}

declare global {
  interface Window {
    __MAHJONG_REPORT__?: ReportData;
  }
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

/** 取得目前網頁建置後的 JS 與 CSS；開發模式（未建置）拿不到時回傳 null */
async function loadAppAssets(): Promise<{ js: string; css: string } | null> {
  const script = document.querySelector<HTMLScriptElement>('script[type="module"][src]');
  if (!script || /\/src\//.test(script.src)) return null;
  const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]')];
  try {
    const [js, ...css] = await Promise.all([fetchText(script.src), ...links.map(l => fetchText(l.href))]);
    return { js, css: css.join('\n') };
  } catch {
    return null;
  }
}

export async function exportReportHtml(activeSessionId: string | null, prefs: Preferences): Promise<string> {
  const assets = await loadAppAssets();
  // 拿不到網頁程式（例如開發模式或離線且沒有快取）時，退回舊版的靜態報表
  if (!assets) return exportHtml();

  const [players, sessions, rounds] = await Promise.all([
    db.players.toArray(),
    db.tableSessions.toArray(),
    db.rounds.toArray(),
  ]);
  const data: ReportData = {
    v: 1,
    exportedAt: new Date().toISOString(),
    players,
    sessions,
    rounds,
    activeSessionId,
    prefs,
  };

  // 內嵌時避免內容提早結束 <script>／<style> 標籤
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const js = assets.js.replace(/<\/script/gi, '<\\/script');
  const css = assets.css.replace(/<\/style/gi, '<\\/style');
  const title = `麻將分析報表 ${new Date().toLocaleDateString('zh-TW')}`;

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>window.__MAHJONG_REPORT__=${json};</script>
<script type="module">${js}</script>
</body>
</html>
`;
}
