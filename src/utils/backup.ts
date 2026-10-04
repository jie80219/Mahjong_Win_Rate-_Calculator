import { db } from '../db';
import type { TableSession, Round } from '../types';
import { computePlayerStats, formatRate } from './stats';
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
  const sessions = await db.tableSessions.toArray();
  const rounds = await db.rounds.toArray();

  const tablePlayerMap = new Map<string, string[]>();
  for (const s of sessions) tablePlayerMap.set(s.id, s.playerIds);

  const allPlayerIds = [...new Set(sessions.flatMap(s => s.playerIds))];
  const stats = computePlayerStats(rounds, allPlayerIds, tablePlayerMap);
  stats.forEach(s => { s.displayName = getPlayerName(s.playerId); });

  const names = stats.map(s => s.displayName);
  const toP = (v: number | null) => v === null ? 0 : +(v * 100).toFixed(1);

  const chartData = {
    names,
    selfDrawRate: stats.map(s => toP(s.selfDrawRate)),
    winRate: stats.map(s => toP(s.winRate)),
    overallWinRate: stats.map(s => toP(s.overallWinRate)),
    discardRate: stats.map(s => toP(s.discardRate)),
    beDrawnRate: stats.map(s => toP(s.beDrawnRate)),
    criticalRate: stats.map(s => toP(s.criticalRate)),
    beCriticalRate: stats.map(s => toP(s.beCriticalRate)),
    drawRate: stats.map(s => toP(s.drawRate)),
  };

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
<title>麻將分析報表</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.7/chart.umd.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#121220;color:#e0e0e0;padding:24px 16px;line-height:1.6;max-width:900px;margin:0 auto}
h1{text-align:center;font-size:1.6rem;margin-bottom:4px;color:#fff}
.subtitle{text-align:center;font-size:13px;color:#888;margin-bottom:28px}
h2{font-size:1.1rem;margin:36px 0 16px;padding-bottom:6px;border-bottom:2px solid #2a2a40;color:#ccc}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:8px}
.card{background:#1a1a30;border-radius:10px;padding:16px;border:1px solid #2a2a40}
.card-name{font-size:15px;font-weight:700;color:#fff;margin-bottom:8px}
.card-row{display:flex;justify-content:space-between;font-size:13px;padding:3px 0;border-bottom:1px solid #1f1f35}
.card-row:last-child{border:none}
.card-label{color:#888}
.card-val{font-weight:600;font-variant-numeric:tabular-nums}
.card-val.highlight{color:#4fc3f7}
.chart-section{margin-bottom:32px}
.chart-box{background:#1a1a30;border-radius:10px;padding:16px;border:1px solid #2a2a40;margin-bottom:16px}
.chart-box canvas{width:100%!important;max-height:300px}
.table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:8px}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{padding:10px 12px;text-align:center;border-bottom:1px solid #2a2a3e}
th{background:#16213e;color:#a8b2d1;font-weight:600;position:sticky;top:0;white-space:nowrap}
td{white-space:nowrap}
tbody tr:nth-child(even){background:#1a1a30}
tbody tr:hover{background:#2a2a50}
.section-note{font-size:12px;color:#666;margin-bottom:16px}
details{margin-top:8px}
details summary{cursor:pointer;color:#60a5fa;font-weight:600;padding:8px 0}
@media(max-width:600px){body{padding:16px 8px}.cards{grid-template-columns:1fr 1fr}table{font-size:12px}th,td{padding:6px 8px}}
@media print{body{background:#fff;color:#222;max-width:none}.card{background:#f8f8f8;border-color:#ddd}.card-name{color:#111}.card-label{color:#666}.chart-box{background:#f8f8f8;border-color:#ddd}th{background:#eee;color:#333}tbody tr:nth-child(even){background:#f8f8f8}tbody tr:hover{background:transparent}}
</style>
</head>
<body>
<h1>麻將分析報表</h1>
<p class="subtitle">匯出時間：${now}　共 ${rounds.length} 局</p>

<h2>玩家數據</h2>
<div class="cards">
${stats.map(s => `<div class="card">
<div class="card-name">${s.displayName}</div>
<div class="card-row"><span class="card-label">總局數</span><span class="card-val">${s.total}（有效 ${s.effective}・流局 ${s.draws}）</span></div>
<div class="card-row"><span class="card-label">自摸率</span><span class="card-val">${formatRate(s.selfDrawRate)}　<small>${s.selfDraws}/${s.effective}</small></span></div>
<div class="card-row"><span class="card-label">胡牌率</span><span class="card-val">${formatRate(s.winRate)}　<small>${s.selfDraws + s.ronWins}/${s.effective}</small></span></div>
<div class="card-row"><span class="card-label">勝率</span><span class="card-val highlight">${formatRate(s.overallWinRate)}　<small>${s.selfDraws + s.ronWins}/${s.total}</small></span></div>
<div class="card-row"><span class="card-label">放槍率</span><span class="card-val">${formatRate(s.discardRate)}　<small>${s.discards}/${s.effective}</small></span></div>
<div class="card-row"><span class="card-label">被摸率</span><span class="card-val">${formatRate(s.beDrawnRate)}　<small>${s.beDrawn}/${s.effective}</small></span></div>
<div class="card-row"><span class="card-label">爆擊率</span><span class="card-val">${formatRate(s.criticalRate)}　<small>${s.criticals}/${s.effective}</small></span></div>
<div class="card-row"><span class="card-label">被爆率</span><span class="card-val">${formatRate(s.beCriticalRate)}　<small>${s.beCriticals}/${s.effective}</small></span></div>
<div class="card-row"><span class="card-label">流局率</span><span class="card-val">${formatRate(s.drawRate)}　<small>${s.draws}/${s.total}</small></span></div>
</div>`).join('\n')}
</div>

<h2>分析圖表</h2>
<div class="chart-section">
<div class="chart-box"><canvas id="chartWin"></canvas></div>
<div class="chart-box"><canvas id="chartAttack"></canvas></div>
<div class="chart-box"><canvas id="chartDefense"></canvas></div>
</div>

<h2>牌局明細</h2>
<p class="section-note">共 ${rounds.length} 局</p>
<details>
<summary>展開牌局明細</summary>
<div class="table-wrap">
<table>
<thead><tr><th>#</th><th>時間</th><th>結果</th></tr></thead>
<tbody>${roundRows}</tbody>
</table>
</div>
</details>

<script>
const D = ${JSON.stringify(chartData)};
const COLORS = ['#4F86C6','#E07A5F','#81B29A','#F2CC8F','#3D405B','#E36414'];
Chart.defaults.color = '#a8b2d1';
Chart.defaults.borderColor = '#2a2a40';
Chart.defaults.font.family = '-apple-system,BlinkMacSystemFont,sans-serif';

function bar(id, title, datasets) {
  new Chart(document.getElementById(id), {
    type: 'bar',
    data: { labels: D.names, datasets },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: title, font: { size: 14, weight: '600' }, color: '#fff' },
        tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + ctx.raw + '%' } },
        legend: { labels: { boxWidth: 12, padding: 12 } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => v + '%' }, grid: { color: '#1f1f35' } },
        x: { grid: { display: false } }
      }
    }
  });
}

bar('chartWin', '勝率 / 胡牌率 / 自摸率', [
  { label: '勝率 (含流局)', data: D.overallWinRate, backgroundColor: '#4fc3f7' },
  { label: '胡牌率', data: D.winRate, backgroundColor: '#4F86C6' },
  { label: '自摸率', data: D.selfDrawRate, backgroundColor: '#81B29A' },
]);

bar('chartAttack', '爆擊率 / 被爆率', [
  { label: '爆擊率', data: D.criticalRate, backgroundColor: '#F2CC8F' },
  { label: '被爆率', data: D.beCriticalRate, backgroundColor: '#E07A5F' },
]);

bar('chartDefense', '放槍率 / 被摸率 / 流局率', [
  { label: '放槍率', data: D.discardRate, backgroundColor: '#E07A5F' },
  { label: '被摸率', data: D.beDrawnRate, backgroundColor: '#3D405B' },
  { label: '流局率', data: D.drawRate, backgroundColor: '#888' },
]);
</script>
</body>
</html>`;
}
