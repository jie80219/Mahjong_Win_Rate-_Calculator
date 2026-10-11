// 驗證 B1 競態：儲存／復原與「取代全部資料」的匯入並行時，不可留下孤立牌局（tableSessionId 對不到任何牌桌）
// 用法：npm run dev -- --port 5199 後執行
//   PLAYWRIGHT_CORE=<playwright-core 路徑> CHROME_PATH=<Chrome 執行檔> node scripts/verify-import-race.mjs
const { chromium } = await import(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
const page = await b.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto('http://localhost:5199/Mahjong_Win_Rate-_Calculator/');

const res = await page.evaluate(async () => {
  const base = '/Mahjong_Win_Rate-_Calculator/src';
  const { db } = await import(`${base}/db/index.ts`);
  const { insertRound, deleteRoundAndRecompute, restoreRoundAtOrdinal, SessionNotFoundError } = await import(`${base}/hooks/useDB.ts`);
  const { importData, validateImport, exportData } = await import(`${base}/utils/backup.ts`);

  await db.rounds.clear(); await db.tableSessions.clear();
  const emptyBackup = validateImport(await exportData()).data;
  const P = ['p01', 'p02', 'p03', 'p04'];
  const t = new Date().toISOString();
  const roundData = { tableSessionId: 'A', playedAt: t, resultType: 'draw', winnerId: null, discarderId: null, tai: null };
  const seedA = async () => {
    await db.rounds.clear(); await db.tableSessions.clear();
    await db.tableSessions.put({ id: 'A', playerIds: P, seatOrder: P, initialDealerIndex: 0, baseMoney: 30, taiMoney: 10, startedAt: t, endedAt: null });
    for (let i = 0; i < 3; i++) await insertRound(roundData);
  };
  const orphans = async () => {
    const ids = new Set((await db.tableSessions.toArray()).map(s => s.id));
    return (await db.rounds.toArray()).filter(r => !ids.has(r.tableSessionId)).length;
  };
  const swallow = p => p.catch(e => { if (!(e instanceof SessionNotFoundError)) throw e; return 'rejected'; });

  const N = 40;
  const out = { insert: { orphanRuns: 0, rejected: 0 }, restore: { orphanRuns: 0, rejected: 0 } };
  for (let n = 0; n < N; n++) {
    // 儲存 vs 匯入；交替啟動順序
    await seedA();
    const ins = () => swallow(insertRound(roundData)), imp = () => importData(emptyBackup);
    const r = n % 2 ? await Promise.all([ins(), imp()]) : (await Promise.all([imp(), ins()])).reverse();
    if (r[0] === 'rejected') out.insert.rejected++;
    if (await orphans() > 0) out.insert.orphanRuns++;

    // 復原 vs 匯入
    await seedA();
    const first = (await db.rounds.toArray())[0];
    const snap = await deleteRoundAndRecompute(first.id);
    const res2 = n % 2 ? await Promise.all([swallow(restoreRoundAtOrdinal(snap)), imp()]) : (await Promise.all([imp(), swallow(restoreRoundAtOrdinal(snap))])).reverse();
    if (res2[0] === 'rejected') out.restore.rejected++;
    if (await orphans() > 0) out.restore.orphanRuns++;
  }
  // 無競態時行為不變：一般儲存／復原仍成功
  await seedA();
  const before = await db.rounds.count();
  const s = await deleteRoundAndRecompute((await db.rounds.toArray())[0].id);
  await restoreRoundAtOrdinal(s);
  await insertRound(roundData);
  out.normal = (await db.rounds.count()) === before + 1 && (await orphans()) === 0;
  out.N = N;
  return out;
});
console.log(JSON.stringify(res));
const ok = res.insert.orphanRuns === 0 && res.restore.orphanRuns === 0 && res.normal && !errs.length;
console.log(ok ? `PASS 孤立牌局 0/${res.N * 2} 次（儲存 ${res.N}、復原 ${res.N}）` : `FAIL 儲存孤立 ${res.insert.orphanRuns}/${res.N}、復原孤立 ${res.restore.orphanRuns}/${res.N}`, errs);
process.exitCode = ok ? 0 : 1;
await b.close();
