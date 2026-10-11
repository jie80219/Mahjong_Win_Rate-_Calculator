import { useState, useEffect, useCallback, useMemo } from 'react';
import type { TableSession, Preferences, Round } from './types';
import { useTableSessions, useRounds, useAllTablePlayerIds } from './hooks/useDB';
import { db } from './db';
import { loadPreferences, savePreferences } from './utils/preferences';
import { getPlayerName } from './db/players';
import { computePlayerStats, filterRoundsByDate } from './utils/stats';
import { computeDealerState } from './utils/dealer';
import { computeAllRoundsMoney, computeCumulativeMoney } from './utils/money';
import { loadLastExport, isBackupStale } from './utils/backupReminder';
import { useToast } from './components/toastContext';
import { SessionNotFoundError } from './hooks/useDB';
import type { DeletedRoundSnapshot } from './hooks/useDB';
import TableSetup from './components/TableSetup';
import RoundRecorder from './components/RoundRecorder';
import Dashboard from './components/Dashboard';
import HistoryPanel from './components/HistoryPanel';
import BackupPanel from './components/BackupPanel';
import DealerAdjustPanel from './components/DealerAdjustPanel';
import './index.css';

type View = 'setup' | 'game';

export default function App() {
  const { sessions, createSession, refresh: refreshSessions } = useTableSessions();
  const [activeSession, setActiveSession] = useState<TableSession | null>(null);
  const { rounds, allRounds, refresh: refreshRounds, addRound, updateRound, deleteRound, restoreRound } = useRounds(activeSession?.id ?? null);
  const { map: tablePlayerMap, refresh: refreshMap } = useAllTablePlayerIds();
  const [view, setView] = useState<View>('setup');
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences);
  const [showHistory, setShowHistory] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<{ playerId?: string; metric?: string } | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(loadLastExport);
  const [mountedAt] = useState(() => Date.now());
  const toast = useToast();

  const dealerState = useMemo(() => {
    if (!activeSession) return null;
    return computeDealerState(activeSession, rounds);
  }, [activeSession, rounds]);

  const refreshAll = useCallback(async () => {
    await refreshSessions();
    await refreshRounds();
    await refreshMap();
  }, [refreshSessions, refreshRounds, refreshMap]);

  useEffect(() => {
    if (activeSession) {
      setView('game');
    }
  }, [activeSession]);

  const updatePrefs = useCallback((partial: Partial<Preferences>) => {
    setPrefs(prev => {
      const next = { ...prev, ...partial };
      savePreferences(next);
      return next;
    });
  }, []);

  const handleStartTable = useCallback(async (args: {
    playerIds: [string, string, string, string];
    seatOrder: [string, string, string, string];
    initialDealerIndex: number;
    baseMoney: number;
    taiMoney: number;
  }) => {
    const session = await createSession(args.playerIds, args.seatOrder, args.initialDealerIndex, args.baseMoney, args.taiMoney);
    setActiveSession(session);
    updatePrefs({ selectedPlayerIds: [...args.playerIds] });
  }, [createSession, updatePrefs]);

  const handleDealerAdjust = useCallback(async (
    newSeatOrder: [string, string, string, string],
    dealerIndex: number,
    consecutive: number,
  ) => {
    if (!activeSession) return;
    const currentSeq = rounds.filter(r => r.tableSessionId === activeSession.id).length;
    const overrides = [...(activeSession.dealerOverrides ?? [])];
    const existingIdx = overrides.findIndex(o => o.afterSequence === currentSeq);
    if (existingIdx >= 0) {
      overrides[existingIdx] = { afterSequence: currentSeq, dealerIndex, consecutive };
    } else {
      overrides.push({ afterSequence: currentSeq, dealerIndex, consecutive });
    }
    const updated = { ...activeSession, seatOrder: newSeatOrder, dealerOverrides: overrides };
    await db.tableSessions.update(activeSession.id, { seatOrder: newSeatOrder, dealerOverrides: overrides });
    setActiveSession(updated);
    await refreshSessions();
  }, [activeSession, rounds, refreshSessions]);

  const reloadActiveSession = useCallback(async (id: string) => {
    const latest = await db.tableSessions.get(id);
    if (latest) setActiveSession(prev => (prev && prev.id === id ? latest : prev));
    await refreshSessions();
  }, [refreshSessions]);

  const handleUndo = useCallback(async (roundId: string) => {
    const round = await db.rounds.get(roundId);
    if (!round) return;
    if (round.updatedAt !== round.createdAt) {
      toast.show({ message: '此牌局已被修改，無法撤銷。請至牌局紀錄查看。', kind: 'error', duration: 4000 });
      return;
    }
    await deleteRound(roundId);
    await refreshMap();
    await reloadActiveSession(round.tableSessionId);
  }, [deleteRound, refreshMap, reloadActiveSession, toast]);

  // 目前牌桌／表單狀態失效時（例如匯入取代了全部資料）返回建桌
  const resetToSetup = useCallback(() => {
    setActiveSession(null);
    setView('setup');
    setShowHistory(false);
    setHistoryFilter(null);
    toast.dismiss('undo');
    toast.dismiss('delete-undo');
  }, [toast]);

  const handleImported = useCallback(async () => {
    resetToSetup();
    await refreshAll();
  }, [resetToSetup, refreshAll]);

  const handleSaveRound = useCallback(async (data: Omit<Round, 'id' | 'createdAt' | 'updatedAt' | 'sequence'>) => {
    const roundData = dealerState
      ? { ...data, dealerId: dealerState.dealerId, dealerConsecutive: dealerState.consecutive }
      : data;
    let round: Round;
    try {
      round = await addRound(roundData);
    } catch (e) {
      if (!(e instanceof SessionNotFoundError)) throw e;
      resetToSetup();
      toast.show({ message: '此牌桌已不存在（資料可能已被匯入取代），請重新建桌', kind: 'error', duration: 5000 });
      return;
    }
    await refreshMap();
    toast.show({
      key: 'undo',
      message: '已儲存牌局',
      actionLabel: '撤銷',
      onAction: () => { void handleUndo(round.id); },
      duration: 5000,
    });
  }, [addRound, refreshMap, dealerState, toast, handleUndo, resetToSetup]);

  const handleEditRound = useCallback(async (id: string, data: Partial<Round>) => {
    await updateRound(id, data);
    await refreshMap();
  }, [updateRound, refreshMap]);

  const handleDeleteRound = useCallback(async (id: string) => {
    const snapshot: DeletedRoundSnapshot | null = await deleteRound(id);
    await refreshMap();
    toast.dismiss('undo');
    if (!snapshot) return;
    await reloadActiveSession(snapshot.round.tableSessionId);
    toast.show({
      key: 'delete-undo',
      message: '已刪除牌局',
      actionLabel: '復原',
      onAction: () => {
        void (async () => {
          try {
            await restoreRound(snapshot);
          } catch (e) {
            if (!(e instanceof SessionNotFoundError)) throw e;
            resetToSetup();
            toast.show({ message: '此牌桌已不存在（資料可能已被匯入取代），無法復原，請重新建桌', kind: 'error', duration: 5000 });
            return;
          }
          await refreshMap();
          await reloadActiveSession(snapshot.round.tableSessionId);
        })();
      },
      duration: 5000,
    });
  }, [deleteRound, restoreRound, refreshMap, reloadActiveSession, toast, resetToSetup]);

  const handleOpenHistory = useCallback((filter?: { playerId?: string; metric?: string }) => {
    setHistoryFilter(filter ?? null);
    setShowHistory(true);
  }, []);

  const handleBackToSetup = useCallback(() => {
    setActiveSession(null);
    setView('setup');
  }, []);

  const scope = prefs.scope;
  const displayRounds = scope === 'all' ? allRounds : rounds;
  const filteredRounds = filterRoundsByDate(displayRounds, prefs.dateRange);

  const scopePlayerIds = scope === 'all'
    ? prefs.selectedPlayerIds
    : (activeSession?.playerIds ? [...activeSession.playerIds] : []);

  const stats = computePlayerStats(
    filteredRounds,
    scopePlayerIds.length > 0 ? scopePlayerIds : (activeSession?.playerIds ? [...activeSession.playerIds] : []),
    tablePlayerMap
  );

  const tableDraw = activeSession
    ? filteredRounds.filter(r => r.resultType === 'draw' && r.tableSessionId === activeSession.id).length
    : filteredRounds.filter(r => r.resultType === 'draw').length;

  const roundsMoney = useMemo(() => {
    if (!activeSession) return [];
    return computeAllRoundsMoney(rounds, activeSession);
  }, [activeSession, rounds]);

  const cumulativeMoney = useMemo(() => {
    if (!activeSession) return {};
    return computeCumulativeMoney(roundsMoney, [...activeSession.playerIds]);
  }, [activeSession, roundsMoney]);

  const oldestSessionStartedAt = sessions.length > 0 ? sessions[sessions.length - 1].startedAt : null;
  const backupStale = isBackupStale(lastExport, oldestSessionStartedAt, mountedAt);

  return (
    <div className="app">
      <header className="app-header">
        <h1>麻將勝率計算器</h1>
        <div className="header-actions">
          <button
            className={`btn-icon ${backupStale ? 'has-reminder' : ''}`}
            onClick={() => setShowBackup(true)}
            title={backupStale ? '備份與還原（已超過 7 天未匯出備份）' : '備份與還原'}
            aria-label={backupStale ? '備份與還原，已超過 7 天未匯出備份' : '備份與還原'}
          >
            <span aria-hidden="true">⚙</span>
            {backupStale && <span className="reminder-dot" aria-hidden="true" />}
          </button>
        </div>
      </header>

      {view === 'setup' && (
        <TableSetup
          sessions={sessions}
          onStartTable={handleStartTable}
          onResumeSession={(s) => { setActiveSession(s); }}
        />
      )}

      {view === 'game' && activeSession && (
        <>
          <div className="table-banner">
            <div className="table-players">
              {activeSession.playerIds.map(pid => (
                <span key={pid} className="player-chip">{getPlayerName(pid)}</span>
              ))}
              {(activeSession.baseMoney != null || activeSession.taiMoney != null) && (
                <span className="money-info-chip">
                  底{activeSession.baseMoney ?? 0} / 台{activeSession.taiMoney ?? 0}
                </span>
              )}
            </div>
            <button className="btn-secondary btn-sm" onClick={handleBackToSetup}>
              換桌
            </button>
          </div>

          {dealerState && (
            <div className="dealer-info-bar">
              <div className="dealer-info-main">
                <span className="dealer-wind">{dealerState.wind}圈</span>
                <span className="dealer-current">
                  <span className="dealer-badge">莊</span>
                  {getPlayerName(dealerState.dealerId)}
                </span>
                {dealerState.consecutive > 0 && (
                  <span className="dealer-consecutive">連{dealerState.consecutive}</span>
                )}
                <DealerAdjustPanel
                  session={activeSession}
                  dealerState={dealerState}
                  onApply={handleDealerAdjust}
                />
              </div>

            </div>
          )}

          <RoundRecorder
            tableSession={activeSession}
            onSave={handleSaveRound}
          />

          <Dashboard
            stats={stats}
            rounds={filteredRounds}
            allRounds={scope === 'all' ? allRounds : rounds}
            tablePlayerMap={tablePlayerMap}
            activeSession={activeSession}
            prefs={prefs}
            onUpdatePrefs={updatePrefs}
            tableDraw={tableDraw}
            onOpenHistory={handleOpenHistory}
            sessions={sessions}
            roundsMoney={roundsMoney}
            cumulativeMoney={cumulativeMoney}
          />

          <div className="section-actions">
            <button className="btn-secondary" onClick={() => handleOpenHistory()}>
              牌局紀錄
            </button>
          </div>
        </>
      )}

      {showHistory && activeSession && (
        <HistoryPanel
          rounds={scope === 'all' ? allRounds : rounds}
          tableSession={activeSession}
          sessions={sessions}
          scope={scope}
          filter={historyFilter}
          onEdit={handleEditRound}
          onDelete={handleDeleteRound}
          onClose={() => { setShowHistory(false); setHistoryFilter(null); }}
          tablePlayerMap={tablePlayerMap}
        />
      )}

      {showBackup && (
        <BackupPanel
          onClose={() => setShowBackup(false)}
          onImported={handleImported}
          onExported={setLastExport}
        />
      )}
    </div>
  );
}
