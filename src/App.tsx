import { useState, useEffect, useCallback } from 'react';
import type { TableSession, Preferences, Round } from './types';
import { useTableSessions, useRounds, useAllTablePlayerIds } from './hooks/useDB';
import { loadPreferences, savePreferences } from './utils/preferences';
import { getPlayerName } from './db/players';
import { computePlayerStats, filterRoundsByDate } from './utils/stats';
import TableSetup from './components/TableSetup';
import RoundRecorder from './components/RoundRecorder';
import Dashboard from './components/Dashboard';
import HistoryPanel from './components/HistoryPanel';
import BackupPanel from './components/BackupPanel';
import './index.css';

type View = 'setup' | 'game';

export default function App() {
  const { sessions, createSession, refresh: refreshSessions } = useTableSessions();
  const [activeSession, setActiveSession] = useState<TableSession | null>(null);
  const { rounds, allRounds, refresh: refreshRounds, addRound, updateRound, deleteRound } = useRounds(activeSession?.id ?? null);
  const { map: tablePlayerMap, refresh: refreshMap } = useAllTablePlayerIds();
  const [view, setView] = useState<View>('setup');
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences);
  const [showHistory, setShowHistory] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<{ playerId?: string; metric?: string } | null>(null);
  const [undoRoundId, setUndoRoundId] = useState<string | null>(null);
  const [showUndo, setShowUndo] = useState(false);

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

  const handleStartTable = useCallback(async (playerIds: [string, string, string, string]) => {
    const session = await createSession(playerIds);
    setActiveSession(session);
    updatePrefs({ selectedPlayerIds: [...playerIds] });
  }, [createSession, updatePrefs]);

  const handleSaveRound = useCallback(async (data: Omit<Round, 'id' | 'createdAt' | 'updatedAt' | 'sequence'>) => {
    const round = await addRound(data);
    await refreshMap();
    setUndoRoundId(round.id);
    setShowUndo(true);
    setTimeout(() => setShowUndo(false), 5000);
  }, [addRound, refreshMap]);

  const handleUndo = useCallback(async () => {
    if (!undoRoundId) return;
    const round = allRounds.find(r => r.id === undoRoundId) ?? rounds.find(r => r.id === undoRoundId);
    if (!round) return;
    if (round.updatedAt !== round.createdAt) {
      alert('此牌局已被修改，無法撤銷。請至牌局紀錄查看。');
      setShowUndo(false);
      return;
    }
    await deleteRound(undoRoundId);
    await refreshMap();
    setShowUndo(false);
    setUndoRoundId(null);
  }, [undoRoundId, allRounds, rounds, deleteRound, refreshMap]);

  const handleEditRound = useCallback(async (id: string, data: Partial<Round>) => {
    await updateRound(id, data);
    await refreshMap();
  }, [updateRound, refreshMap]);

  const handleDeleteRound = useCallback(async (id: string) => {
    await deleteRound(id);
    await refreshMap();
    if (id === undoRoundId) {
      setShowUndo(false);
      setUndoRoundId(null);
    }
  }, [deleteRound, refreshMap, undoRoundId]);

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

  return (
    <div className="app">
      <header className="app-header">
        <h1 onClick={activeSession ? handleBackToSetup : undefined} style={activeSession ? { cursor: 'pointer' } : undefined}>
          麻將勝率計算器
        </h1>
        <div className="header-actions">
          <button className="btn-icon" onClick={() => setShowBackup(true)} title="備份與還原">
            ⚙
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
            </div>
            <button className="btn-secondary btn-sm" onClick={handleBackToSetup}>
              換桌
            </button>
          </div>

          <RoundRecorder
            tableSession={activeSession}
            onSave={handleSaveRound}
          />

          {showUndo && (
            <div className="undo-toast">
              已儲存牌局
              <button className="btn-link" onClick={handleUndo}>撤銷</button>
            </div>
          )}

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
          onImported={refreshAll}
        />
      )}
    </div>
  );
}
