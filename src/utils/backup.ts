import { db } from '../db';
import type { TableSession, Round } from '../types';
import { getPlayerName } from '../db/players';

interface BackupData {
  version: number;
  exportedAt: string;
  tableSessions: TableSession[];
  rounds: Round[];
}

export async function exportData(): Promise<string> {
  const tableSessions = await db.tableSessions.toArray();
  const rounds = await db.rounds.toArray();
  const data: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tableSessions,
    rounds,
  };
  return JSON.stringify(data, null, 2);
}

export interface ImportPreview {
  tableSessions: number;
  rounds: number;
  valid: boolean;
  errors: string[];
}

export function validateImport(json: string): { data: BackupData | null; preview: ImportPreview } {
  const preview: ImportPreview = { tableSessions: 0, rounds: 0, valid: false, errors: [] };

  let data: BackupData;
  try {
    data = JSON.parse(json);
  } catch {
    preview.errors.push('JSON 格式無效');
    return { data: null, preview };
  }

  if (!data.version || !Array.isArray(data.tableSessions) || !Array.isArray(data.rounds)) {
    preview.errors.push('缺少必要欄位 (version, tableSessions, rounds)');
    return { data: null, preview };
  }

  for (const ts of data.tableSessions) {
    if (!ts.id || !Array.isArray(ts.playerIds) || ts.playerIds.length !== 4 || !ts.startedAt) {
      preview.errors.push(`牌桌 ${ts.id ?? '(無ID)'} 資料不完整`);
    }
  }

  for (const r of data.rounds) {
    if (!r.id || !r.tableSessionId || r.resultType === undefined) {
      preview.errors.push(`牌局 ${r.id ?? '(無ID)'} 資料不完整`);
    }
    if (r.resultType === 'selfDraw' && (!r.winnerId || r.tai === null || r.tai === undefined)) {
      preview.errors.push(`牌局 ${r.id} 自摸缺少贏家或台數`);
    }
    if (r.resultType === 'discardWin' && (!r.winnerId || !r.discarderId || r.tai === null || r.tai === undefined)) {
      preview.errors.push(`牌局 ${r.id} 榮胡缺少贏家、放槍者或台數`);
    }
  }

  preview.tableSessions = data.tableSessions.length;
  preview.rounds = data.rounds.length;
  preview.valid = preview.errors.length === 0;

  return { data: preview.valid ? data : null, preview };
}

export async function importData(data: BackupData): Promise<void> {
  await db.transaction('rw', db.tableSessions, db.rounds, async () => {
    await db.tableSessions.clear();
    await db.rounds.clear();
    await db.tableSessions.bulkAdd(data.tableSessions);
    await db.rounds.bulkAdd(data.rounds);
  });
}

export async function exportHtml(): Promise<string> {
  const rounds = await db.rounds.toArray();

  const roundRows = [...rounds]
    .sort((a, b) => b.playedAt.localeCompare(a.playedAt))
    .map(r => {
      const time = new Date(r.playedAt).toLocaleString('zh-TW');
      let result = '流局';
      if (r.resultType === 'selfDraw') {
        result = `${getPlayerName(r.winnerId!)} 自摸 ${r.tai} 台`;
      } else if (r.resultType === 'discardWin') {
        result = `${getPlayerName(r.winnerId!)} 胡，${getPlayerName(r.discarderId!)} 放槍 ${r.tai} 台`;
      }
      return `<tr><td>${r.sequence}</td><td>${time}</td><td>${result}</td></tr>`;
    })
    .join('\n');

  const now = new Date().toLocaleString('zh-TW');

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>麻將牌局紀錄</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#1a1a2e;color:#e0e0e0;padding:24px 16px;line-height:1.6}
h1{text-align:center;font-size:1.6rem;margin-bottom:4px;color:#fff}
.subtitle{text-align:center;font-size:13px;color:#888;margin-bottom:32px}
.table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{padding:10px 12px;text-align:center;border-bottom:1px solid #2a2a3e}
th{background:#16213e;color:#a8b2d1;font-weight:600;position:sticky;top:0;white-space:nowrap}
td{white-space:nowrap}
tbody tr:nth-child(even){background:#1f1f38}
tbody tr:hover{background:#2a2a50}
.section-note{font-size:12px;color:#666;margin-bottom:16px}
@media(max-width:600px){body{padding:16px 8px}table{font-size:12px}th,td{padding:6px 8px}}
@media print{body{background:#fff;color:#222}th{background:#eee;color:#333}tbody tr:nth-child(even){background:#f8f8f8}tbody tr:hover{background:transparent}}
</style>
</head>
<body>
<h1>麻將牌局紀錄</h1>
<p class="subtitle">匯出時間：${now}</p>
<p class="section-note">共 ${rounds.length} 局</p>
<div class="table-wrap">
<table>
<thead><tr><th>#</th><th>時間</th><th>結果</th></tr></thead>
<tbody>${roundRows}</tbody>
</table>
</div>
</body>
</html>`;
}
