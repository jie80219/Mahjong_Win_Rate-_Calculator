// 驗證 B1：匯入取代全部資料後，原牌桌表單不可再寫入（不產生孤立牌局），且重新建桌後可正常儲存
// 用法：npm run dev -- --port 5199 後執行
//   PLAYWRIGHT_CORE=<playwright-core 路徑> CHROME_PATH=<Chrome 執行檔> node scripts/verify-import-replace.mjs
const { chromium } = await import(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const URL = 'http://localhost:5199/Mahjong_Win_Rate-_Calculator/';
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); };

const newPage = async () => {
  const ctx = await b.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e)));
  page.setDefaultTimeout(4000);
  await page.goto(URL);
  return page;
};
const dump = page => page.evaluate(async () => {
  const { db } = await import('/Mahjong_Win_Rate-_Calculator/src/db/index.ts');
  return { sessions: (await db.tableSessions.toArray()).map(s => s.id), rounds: (await db.rounds.toArray()).map(r => r.tableSessionId) };
});
const startTable = async page => {
  const btns = page.locator('.player-btn');
  for (let i = 0; i < 4; i++) await btns.nth(i).click();
  await page.getByRole('button', { name: '下一步：設定莊家' }).click();
  await page.getByRole('button', { name: '開始牌桌' }).click();
  await page.getByRole('heading', { name: '記錄一局' }).waitFor();
};
const saveDraw = async page => {
  await page.getByRole('button', { name: '流局', exact: true }).click();
  await page.getByRole('button', { name: '儲存', exact: true }).click();
};

// 備份來源：獨立 context（乾淨 DB）產生，不影響受測頁
const makeBackup = async kind => {
  const p = await newPage();
  const json = await p.evaluate(async kind => {
    const { db } = await import('/Mahjong_Win_Rate-_Calculator/src/db/index.ts');
    const { exportData } = await import('/Mahjong_Win_Rate-_Calculator/src/utils/backup.ts');
    if (kind === 'nonEmpty') {
      const P = ['p01', 'p02', 'p03', 'p04'];
      const t = new Date().toISOString();
      await db.tableSessions.put({ id: 'B-table', playerIds: P, seatOrder: P, initialDealerIndex: 0, baseMoney: 30, taiMoney: 10, startedAt: t, endedAt: null });
      await db.rounds.put({ id: 'B-r1', tableSessionId: 'B-table', sequence: 1, playedAt: t, resultType: 'draw', winnerId: null, discarderId: null, tai: null, dealerId: 'p01', dealerConsecutive: 0, createdAt: t, updatedAt: t });
    }
    return exportData();
  }, kind);
  await p.context().close();
  return json;
};

for (const kind of ['empty', 'nonEmpty']) {
  const backup = await makeBackup(kind);
  const expectRounds = kind === 'empty' ? 0 : 1;

  // 情境 1：經 UI 匯入 → 必須返回建桌，表單消失
  try {
    const page = await newPage();
    await startTable(page);
    const A = (await dump(page)).sessions[0];
    await page.getByRole('button', { name: '備份與還原' }).click();
    await page.locator('input[type=file]').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
    await page.getByRole('button', { name: /先下載目前資料/ }).click();
    await page.getByRole('button', { name: /確認匯入/ }).click();
    await page.getByRole('button', { name: /下一步|還需選/ }).waitFor();
    check(`[${kind}] UI 匯入後返回建桌`, await page.getByRole('heading', { name: '記錄一局' }).count() === 0);
    const d = await dump(page);
    check(`[${kind}] 原 A 桌已被取代、無孤立牌局`, !d.sessions.includes(A) && !d.rounds.includes(A) && d.rounds.length === expectRounds, JSON.stringify(d));
    await startTable(page);
    await saveDraw(page);
    await page.getByText('已儲存牌局').waitFor();
    const d2 = await dump(page);
    const C = d2.sessions.find(s => s !== 'B-table');
    check(`[${kind}] 重新建桌後可正常儲存`, d2.rounds.filter(s => s === C).length === 1 && !d2.rounds.includes(A), JSON.stringify(d2));
    check(`[${kind}] 無 pageerror`, page.errors.length === 0, page.errors.join(';'));
    await page.context().close();
  } catch (e) { check(`[${kind}] 情境 1 例外`, false, String(e).split('\n')[0]); }

  // 情境 2：資料被取代但畫面未重設（模擬舊表單殘留）→ 儲存端必須拒絕
  try {
    const page = await newPage();
    await startTable(page);
    const A = (await dump(page)).sessions[0];
    await page.evaluate(async json => {
      const { validateImport, importData } = await import('/Mahjong_Win_Rate-_Calculator/src/utils/backup.ts');
      await importData(validateImport(json).data);
    }, backup);
    await page.getByRole('button', { name: '流局', exact: true }).click();
    await page.getByRole('button', { name: '儲存', exact: true }).click();
    await page.getByText('此牌桌已不存在').waitFor();
    const d = await dump(page);
    check(`[${kind}] 儲存端拒絕不存在的牌桌且返回建桌`, !d.rounds.includes(A) && d.rounds.length === expectRounds && await page.getByRole('heading', { name: '記錄一局' }).count() === 0, JSON.stringify(d));
    await startTable(page);
    await saveDraw(page);
    await page.getByText('已儲存牌局').waitFor();
    const d2 = await dump(page);
    check(`[${kind}] 拒絕後重新建桌可儲存`, d2.rounds.length === expectRounds + 1 && !d2.rounds.includes(A), JSON.stringify(d2));
    await page.context().close();
  } catch (e) { check(`[${kind}] 情境 2 例外`, false, String(e).split('\n')[0]); }
}
console.log(`PASS ${results.filter(Boolean).length}/${results.length}`);
process.exitCode = results.every(Boolean) ? 0 : 1;
await b.close();
