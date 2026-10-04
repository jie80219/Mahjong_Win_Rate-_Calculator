import { useState, useEffect, useCallback } from 'react';
import { db } from '../db';
import type { TableSession, Round } from '../types';
import { generateId, nowISO } from '../utils/id';
import { saveLastTable } from '../utils/preferences';

export function useTableSessions() {
  const [sessions, setSessions] = useState<TableSession[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await db.tableSessions.orderBy('startedAt').reverse().toArray();
    setSessions(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createSession = useCallback(async (playerIds: [string, string, string, string]) => {
    const session: TableSession = {
      id: generateId(),
      playerIds,
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
    const round: Round = {
      ...data,
      id: generateId(),
      sequence: maxSeq + 1,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    await db.rounds.add(round);
    await refresh();
    return round;
  }, [refresh]);

  const updateRound = useCallback(async (id: string, data: Partial<Round>) => {
    await db.rounds.update(id, { ...data, updatedAt: nowISO() });
    await refresh();
  }, [refresh]);

  const deleteRound = useCallback(async (id: string) => {
    await db.rounds.delete(id);
    await refresh();
  }, [refresh]);

  return { rounds, allRounds, loading, refresh, addRound, updateRound, deleteRound };
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
