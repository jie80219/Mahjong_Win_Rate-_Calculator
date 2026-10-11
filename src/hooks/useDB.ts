import { useState, useEffect, useCallback } from 'react';
import { db } from '../db';
import type { TableSession, Round } from '../types';
import { generateId, nowISO } from '../utils/id';
import { saveLastTable } from '../utils/preferences';
import { sortSessionRounds } from '../utils/dealer';
import { recomputeDealerFields } from '../db/recompute';

export interface DeletedRoundSnapshot {
  round: Round;
  // 刪除當下在排序後的位置（0 起算）；舊資料 sequence 可能有空號，復原不能依賴原 sequence
  ordinal: number;
  dealerOverrides: TableSession['dealerOverrides'];
}

async function ordinalOf(round: Round): Promise<number> {
  const siblings = await db.rounds.where('tableSessionId').equals(round.tableSessionId).toArray();
  return sortSessionRounds(siblings, round.tableSessionId).findIndex(r => r.id === round.id);
}

export async function deleteRoundAndRecompute(id: string): Promise<DeletedRoundSnapshot | null> {
  const round = await db.rounds.get(id);
  if (!round) return null;
  const session = await db.tableSessions.get(round.tableSessionId);
  const ordinal = await ordinalOf(round);
  const snapshot: DeletedRoundSnapshot = { round, ordinal: Math.max(ordinal, 0), dealerOverrides: session?.dealerOverrides };

  await db.rounds.delete(id);
  if (session?.dealerOverrides) {
    await db.tableSessions.update(session.id, {
      dealerOverrides: session.dealerOverrides.map(o =>
        o.afterSequence > ordinal ? { ...o, afterSequence: o.afterSequence - 1 } : o),
    });
  }
  await recomputeDealerFields(round.tableSessionId, Math.max(ordinal, 0));
  return snapshot;
}

export async function restoreRoundAtOrdinal(snapshot: DeletedRoundSnapshot): Promise<void> {
  const { round, ordinal, dealerOverrides } = snapshot;
  // 刪除後 sequence 已重編為 1..n，第 ordinal 位的前後鄰居是 ordinal 與 ordinal+1，故以 ordinal+0.5 插入，再由 recompute 整理成整數
  await db.rounds.put({ ...round, sequence: ordinal + 0.5 });
  if (dealerOverrides) await db.tableSessions.update(round.tableSessionId, { dealerOverrides });
  await recomputeDealerFields(round.tableSessionId, ordinal);
}

export function useTableSessions() {
  const [sessions, setSessions] = useState<TableSession[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await db.tableSessions.orderBy('startedAt').reverse().toArray();
    setSessions(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createSession = useCallback(async (
    playerIds: [string, string, string, string],
    seatOrder?: [string, string, string, string],
    initialDealerIndex?: number,
    baseMoney?: number,
    taiMoney?: number,
  ) => {
    const session: TableSession = {
      id: generateId(),
      playerIds,
      seatOrder,
      initialDealerIndex,
      baseMoney,
      taiMoney,
      startedAt: nowISO(),
      endedAt: null,
    };
    await db.tableSessions.add(session);
    saveLastTable([...playerIds]);
    await refresh();
    return session;
  }, [refresh]);

  return { sessions, loading, refresh, createSession };
}

export function useRounds(tableSessionId: string | null) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [allRounds, setAllRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const all = await db.rounds.orderBy('createdAt').toArray();
    setAllRounds(all);
    if (tableSessionId) {
      setRounds(all.filter(r => r.tableSessionId === tableSessionId));
    } else {
      setRounds(all);
    }
    setLoading(false);
  }, [tableSessionId]);

  useEffect(() => { refresh(); }, [refresh]);

  const addRound = useCallback(async (data: Omit<Round, 'id' | 'createdAt' | 'updatedAt' | 'sequence'>) => {
    const existing = await db.rounds.where('tableSessionId').equals(data.tableSessionId).toArray();
    const maxSeq = existing.reduce((max, r) => Math.max(max, r.sequence), 0);
    const now = nowISO();
    const round: Round = {
      ...data,
      id: generateId(),
      sequence: maxSeq + 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.rounds.add(round);
    await recomputeDealerFields(round.tableSessionId, existing.length);
    await refresh();
    return round;
  }, [refresh]);

  const updateRound = useCallback(async (id: string, data: Partial<Round>) => {
    const round = await db.rounds.get(id);
    await db.rounds.update(id, { ...data, updatedAt: nowISO() });
    if (round) await recomputeDealerFields(round.tableSessionId, Math.max(await ordinalOf(round), 0));
    await refresh();
  }, [refresh]);

  const deleteRound = useCallback(async (id: string): Promise<DeletedRoundSnapshot | null> => {
    const snapshot = await deleteRoundAndRecompute(id);
    await refresh();
    return snapshot;
  }, [refresh]);

  const restoreRound = useCallback(async (snapshot: DeletedRoundSnapshot) => {
    await restoreRoundAtOrdinal(snapshot);
    await refresh();
  }, [refresh]);

  return { rounds, allRounds, loading, refresh, addRound, updateRound, deleteRound, restoreRound };
}

export function useAllTablePlayerIds() {
  const [map, setMap] = useState<Map<string, string[]>>(new Map());

  const refresh = useCallback(async () => {
    const sessions = await db.tableSessions.toArray();
    const m = new Map<string, string[]>();
    for (const s of sessions) {
      m.set(s.id, [...s.playerIds]);
    }
    setMap(m);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { map, refresh };
}
