import { db } from './index';
import { computeRoundDealers, sortSessionRounds } from '../utils/dealer';

// 重新編號 sequence 為 1..n，並從第 fromOrdinal 局（0 起算）之後重算 dealerId / dealerConsecutive
export async function recomputeDealerFields(sessionId: string, fromOrdinal = 0): Promise<void> {
  await db.transaction('rw', db.rounds, db.tableSessions, async () => {
    const session = await db.tableSessions.get(sessionId);
    if (!session) return;
    const sorted = sortSessionRounds(await db.rounds.where('tableSessionId').equals(sessionId).toArray(), sessionId);
    const dealers = computeRoundDealers(session, sorted);

    for (let i = 0; i < sorted.length; i++) {
      const changes: Record<string, unknown> = {};
      if (sorted[i].sequence !== i + 1) changes.sequence = i + 1;
      if (dealers && i >= fromOrdinal) {
        if (sorted[i].dealerId !== dealers[i].dealerId) changes.dealerId = dealers[i].dealerId;
        if (sorted[i].dealerConsecutive !== dealers[i].consecutive) changes.dealerConsecutive = dealers[i].consecutive;
      }
      if (Object.keys(changes).length > 0) await db.rounds.update(sorted[i].id, changes);
    }
  });
}
