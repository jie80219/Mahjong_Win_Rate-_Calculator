// 用法：npm run dev -- --port 5199 後執行
//   PLAYWRIGHT_CORE=<playwright-core 路徑> CHROME_PATH=<Chrome 執行檔> node scripts/verify-delete-restore.mjs
// 驗證舊資料 sequence 有空號時，刪除→復原每一局後順序、莊家、金額、override 皆與刪除前一致
const { chromium } = await import(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
const page = await b.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto('http://localhost:5199/Mahjong_Win_Rate-_Calculator/');
const res = await page.evaluate(async () => {
  const { db } = await import('/Mahjong_Win_Rate-_Calculator/src/db/index.ts');
  const { deleteRoundAndRecompute, restoreRoundAtOrdinal } = await import('/Mahjong_Win_Rate-_Calculator/src/hooks/useDB.ts');
  const { recomputeDealerFields } = await import('/Mahjong_Win_Rate-_Calculator/src/db/recompute.ts');
  const { computeAllRoundsMoney } = await import('/Mahjong_Win_Rate-_Calculator/src/utils/money.ts');
  const { sortSessionRounds } = await import('/Mahjong_Win_Rate-_Calculator/src/utils/dealer.ts');
  const out = [];
  const snap = async (sid) => {
    const session = await db.tableSessions.get(sid);
    const rs = sortSessionRounds(await db.rounds.where('tableSessionId').equals(sid).toArray(), sid);
    return JSON.stringify({
      order: rs.map(r => r.id), seq: rs.map(r => r.sequence),
      dealer: rs.map(r => [r.dealerId, r.dealerConsecutive]),
      money: computeAllRoundsMoney(rs, session).map(m => [m.roundId, m.amounts]), overrides: session.dealerOverrides ?? null,
      updated: rs.map(r => r.updatedAt),
    });
  };
  const P = ['a', 'b', 'c', 'd'];
  const kinds = [
    ['selfDraw', 'a', null, 3], ['discardWin', 'b', 'c', 2], ['draw', null, null, null], ['discardWin', 'a', 'd', 4],
    ['selfDraw', 'c', null, 1], ['draw', null, null, null], ['discardWin', 'd', 'a', 2],
  ];
  const seed = async (sid, seqs, overrides) => {
    await db.tableSessions.put({ id: sid, playerIds: P, seatOrder: P, initialDealerIndex: 0, baseMoney: 30, taiMoney: 10, startedAt: new Date().toISOString(), endedAt: null, dealerOverrides: overrides });
    for (let i = 0; i < seqs.length; i++) {
      const [t, w, d, tai] = kinds[i];
      const ts = new Date(2026, 0, 1, 0, i).toISOString();
      await db.rounds.put({ id: `${sid}-r${i}`, tableSessionId: sid, sequence: seqs[i], playedAt: ts, resultType: t, winnerId: w, discarderId: d, tai, createdAt: ts, updatedAt: ts });
    }
    await recomputeDealerFields(sid, 0);
  };
  // 舊資料空號：模擬 main 上刪過局後 sequence 殘留 1,2,3,5,6,7,8 並且 recompute 之前的原始資料
  const cases = {
    'gap-no-override': [[1, 2, 3, 5, 6, 7, 8], undefined],
    'gap-with-override': [[1, 2, 3, 5, 6, 7, 8], [{ afterSequence: 4, dealerIndex: 2, consecutive: 0 }]],
    'no-gap': [[1, 2, 3, 4, 5, 6, 7], undefined],
  };
  for (const [name, [seqs, ov]] of Object.entries(cases)) {
    const sid = 's-' + name;
    for (let i = 0; i < seqs.length; i++) {
      // 每次 delete 前重新 seed 原始資料，並把 sequence 還原成空號狀態（recompute 會正規化，故事後再 update）
      await db.rounds.where('tableSessionId').equals(sid).delete();
      await seed(sid, seqs, ov);
      for (let j = 0; j < seqs.length; j++) await db.rounds.update(`${sid}-r${j}`, { sequence: seqs[j] });
      const before = JSON.parse(await snap(sid));
      const s = await deleteRoundAndRecompute(`${sid}-r${i}`);
      await restoreRoundAtOrdinal(s);
      const after = JSON.parse(await snap(sid));
      // sequence 會被正規化為 1..n，其餘欄位（順序、莊家、金額、override、updatedAt）須與刪除前完全一致
      const diff = ['order', 'dealer', 'money', 'overrides', 'updated'].filter(k => JSON.stringify(after[k]) !== JSON.stringify(before[k]));
      const seqOk = JSON.stringify(after.seq) === JSON.stringify(after.seq.map((_, j) => j + 1));
      out.push({ name, deleted: i, ordinal: s.ordinal, same: diff.length === 0, diff, seqOk, order: after.order.map(x => x.split('-r')[1]).join('') });
    }
  }
  return out;
});
console.log(res.map(r => JSON.stringify(r)).join('\n'));
const pass = res.filter(r => r.same && r.seqOk).length;
console.log(`PASS ${pass}/${res.length}`, 'pageerrors:', errs);
process.exitCode = pass === res.length && !errs.length ? 0 : 1;
await b.close();
