import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { TableSession, Preferences, Round, DealerRule } from './types';
import { useTableSessions, useRounds, useAllTablePlayerIds, usePlayers } from './hooks/useDB';
import { useWakeLock } from './hooks/useWakeLock';
import { db } from './db';
import { loadPreferences, savePreferences } from './utils/preferences';
import { getPlayerName } from './db/players';
import { useDashboardData } from './hooks/useDashboardData';
import { computeDealerTimeline } from './utils/dealer';
import { computeAllRoundsMoney, formatMoney } from './utils/money';
import { computeStreaks, streakAlerts } from './utils/fun';
import { readShareFromHash } from './utils/share';
import TableSetup from './components/TableSetup';
import RoundRecorder from './components/RoundRecorder';
import Dashboard from './components/Dashboard';
import HistoryPanel from './components/HistoryPanel';
import BackupPanel from './components/BackupPanel';
import DealerAdjustPanel from './components/DealerAdjustPanel';
import PlayerManager from './components/PlayerManager';
import SettlementPanel from './components/SettlementPanel';
import SharePanel from './components/SharePanel';
import ShareImportPanel from './components/ShareImportPanel';
import './index.css';

type View = 'setup' | 'game';

/** 修改或刪除牌局後，把每局儲存的莊家欄位同步成重新推算的結果（不更動 updatedAt） */
async function resyncDealerFields(sessionId: string): Promise<void> {
  const session = await db.tableSessions.get(sessionId);
  if (!session) return;
  const rounds = await db.rounds.where('tableSessionId').equals(sessionId).toArray();
  const { byRound } = computeDealerTimeline(session, rounds);
  await db.transaction('rw', db.rounds, async () => {
    for (const r of rounds) {
      const d = byRound.get(r.id);
      if (!d) continue;
      if (r.dealerId !== d.dealerId || r.dealerConsecutive !== d.consecutive) {
        await db.rounds.update(r.id, { dealerId: d.dealerId, dealerConsecutive: d.consecutive });
      }
    }
  });
}

export default function App() {
  const { players, ready: playersReady, refresh: refreshPlayers, addPlayer, updatePlayer } = usePlayers();
  const { sessions, createSession, refresh: refreshSessions } = useTableSessions();
  const [activeSession, setActiveSession] = useState<TableSession | null>(null);
  const { rounds, allRounds, refresh: refreshRounds, addRound, updateRound, deleteRound } = useRounds(activeSession?.id ?? null);
  const { map: tablePlayerMap, refresh: refreshMap } = useAllTablePlayerIds();
  const [view, setView] = useState<View>('setup');
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences);
  const [showHistory, setShowHistory] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showPlayers, setShowPlayers] = useState(false);
  const [showSettlement, setShowSettlement] = useState<false | 'view' | 'ended'>(false);
  const [showShare, setShowShare] = useState(false);
  const [shareData, setShareData] = useState<string | null>(readShareFromHash);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<{ playerId?: string; metric?: string } | null>(null);
  const [undoRoundId, setUndoRoundId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const wakeActive = useWakeLock(prefs.keepAwake && view === 'game' && !!activeSession && !activeSession.endedAt);

  const timeline = useMemo(() => {
    if (!activeSession) return null;
    return computeDealerTimeline(activeSession, rounds);
  }, [activeSession, rounds]);
  const dealerState = timeline?.state ?? null;

  const refreshAll = useCallback(async () => {
    await refreshPlayers();
    await refreshSessions();
    await refreshRounds();
    await refreshMap();
  }, [refreshPlayers, refreshSessions, refreshRounds, refreshMap]);

  useEffect(() => {
    if (activeSession) {
      setView('game');
    }
  }, [activeSession]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const showToast = useCallback((message: string | null, undoId: string | null, ms = 5000) => {
    window.clearTimeout(toastTimer.current);
    setToast(message);
    setUndoRoundId(undoId);
    if (message) toastTimer.current = window.setTimeout(() => { setToast(null); setUndoRoundId(null); }, ms);
  }, []);

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
    dealerRule: DealerRule;
  }) => {
    const session = await createSession(
      args.playerIds, args.seatOrder, args.initialDealerIndex, args.baseMoney, args.taiMoney, args.dealerRule,
    );
    await refreshMap();
    setActiveSession(session);
    updatePrefs({ selectedPlayerIds: [...args.playerIds] });
  }, [createSession, refreshMap, updatePrefs]);

  const handleDealerAdjust = useCallback(async (
    newSeatOrder: [string, string, string, string],
    dealerIndex: number,
    consecutive: number,
    windCount: number,
  ) => {
    if (!activeSession) return;
    const currentSeq = rounds.reduce((max, r) => Math.max(max, r.sequence), 0);
    const overrides = [...(activeSession.dealerOverrides ?? [])];
    const override = { afterSequence: currentSeq, dealerIndex, consecutive, seatOrder: newSeatOrder, windCount };
    const existingIdx = overrides.findIndex(o => o.afterSequence === currentSeq);
    if (existingIdx >= 0) {
      overrides[existingIdx] = override;
    } else {
      overrides.push(override);
    }
    // 記住原始座位，之後換位置時過去牌局的莊家才不會跟著變
    const initialSeatOrder = activeSession.initialSeatOrder ?? activeSession.seatOrder;
    const changes = { seatOrder: newSeatOrder, dealerOverrides: overrides, initialSeatOrder };
    await db.tableSessions.update(activeSession.id, changes);
    setActiveSession({ ...activeSession, ...changes });
    await refreshSessions();
  }, [activeSession, rounds, refreshSessions]);

  const handleSaveRound = useCallback(async (data: Omit<Round, 'id' | 'createdAt' | 'updatedAt' | 'sequence'>) => {
    const roundData = dealerState
      ? { ...data, dealerId: dealerState.dealerId, dealerConsecutive: dealerState.consecutive }
      : data;
    const round = await addRound(roundData);
    await refreshMap();
    showToast('已儲存', round.id);
  }, [addRound, refreshMap, dealerState, showToast]);

  const handleUndo = useCallback(async () => {
    if (!undoRoundId) return;
    const round = allRounds.find(r => r.id === undoRoundId) ?? rounds.find(r => r.id === undoRoundId);
    if (!round) return;
    if (round.updatedAt !== round.createdAt) {
      showToast('此牌局已被修改，無法撤銷，請至牌局紀錄查看', null, 3000);
      return;
    }
    await deleteRound(undoRoundId);
    await refreshMap();
    showToast('已撤銷', null, 2000);
  }, [undoRoundId, allRounds, rounds, deleteRound, refreshMap, showToast]);

  const handleEditRound = useCallback(async (id: string, data: Partial<Round>) => {
    const round = allRounds.find(r => r.id === id);
    await updateRound(id, data);
    if (round) await resyncDealerFields(round.tableSessionId);
    await refreshRounds();
    await refreshMap();
  }, [allRounds, updateRound, refreshRounds, refreshMap]);

  const handleDeleteRound = useCallback(async (id: string) => {
    const round = allRounds.find(r => r.id === id);
    await deleteRound(id);
    if (round) await resyncDealerFields(round.tableSessionId);
    await refreshRounds();
    await refreshMap();
    if (id === undoRoundId) showToast(null, null);
  }, [allRounds, deleteRound, refreshRounds, refreshMap, undoRoundId, showToast]);

  const handleOpenHistory = useCallback((filter?: { playerId?: string; metric?: string }) => {
    setHistoryFilter(filter ?? null);
    setShowHistory(true);
  }, []);

  const handleBackToSetup = useCallback(() => {
    setActiveSession(null);
    setView('setup');
    showToast(null, null);
  }, [showToast]);

  const handleEndTable = useCallback(async () => {
    if (!activeSession) return;
    const endedAt = new Date().toISOString();
    await db.tableSessions.update(activeSession.id, { endedAt });
    setActiveSession({ ...activeSession, endedAt });
    await refreshSessions();
    setConfirmEnd(false);
    setShowSettlement('ended');
  }, [activeSession, refreshSessions]);

  const handleReopenTable = useCallback(async () => {
    if (!activeSession) return;
    await db.tableSessions.update(activeSession.id, { endedAt: null });
    setActiveSession({ ...activeSession, endedAt: null });
    await refreshSessions();
  }, [activeSession, refreshSessions]);

  // 打開一張既有牌桌：玩家篩選換成這桌的人，避免殘留上一桌的玩家
  const openSession = useCallback((s: TableSession) => {
    setActiveSession(s);
    updatePrefs({ selectedPlayerIds: [...s.playerIds] });
  }, [updatePrefs]);

  const handleShareDone = useCallback(async (sessionId: string | null) => {
    history.replaceState(null, '', location.pathname + location.search);
    setShareData(null);
    if (!sessionId) return;
    await refreshAll();
    const s = await db.tableSessions.get(sessionId);
    if (s) openSession(s);
  }, [refreshAll, openSession]);

  const scope = prefs.scope;
  const { filteredRounds, stats, tableDraw, roundsMoney, cumulativeMoney } = useDashboardData({
    activeSession, rounds, allRounds, sessions, tablePlayerMap, prefs,
  });

  // 剛存的那局金額，顯示在提示裡
  const toastMoney = useMemo(() => {
    if (!activeSession || !undoRoundId || toast !== '已儲存') return null;
    const rm = computeAllRoundsMoney(rounds, activeSession).find(m => m.roundId === undoRoundId);
    if (!rm) return null;
    const parts = Object.entries(rm.amounts)
      .filter(([, v]) => v !== 0)
      .sort((a, b) => b[1] - a[1])
      .map(([pid, v]) => `${getPlayerName(pid)} ${formatMoney(v)}`);
    return parts.length ? parts.join('、') : null;
  }, [activeSession, undoRoundId, toast, rounds]);

  const alerts = useMemo(() => {
    if (!activeSession) return [];
    return streakAlerts(computeStreaks(rounds, [...activeSession.playerIds], tablePlayerMap), getPlayerName);
  }, [activeSession, rounds, tablePlayerMap]);

  if (!playersReady) return <div className="app" />;

  const ended = !!activeSession?.endedAt;

  return (
    <div className="app">
      <header className="app-header">
        <h1 onClick={activeSession ? handleBackToSetup : undefined} style={activeSession ? { cursor: 'pointer' } : undefined}>
          麻將勝率計算器
        </h1>
        <div className="header-actions">
          {view === 'game' && activeSession && !ended && 'wakeLock' in navigator && (
            <button
              className={`btn-icon wake-btn ${prefs.keepAwake && wakeActive ? 'on' : ''}`}
              onClick={() => updatePrefs({ keepAwake: !prefs.keepAwake })}
              title={prefs.keepAwake ? '螢幕常亮：開（點擊關閉）' : '螢幕常亮：關（點擊開啟）'}
            >
              {prefs.keepAwake ? '☀' : '☾'}
            </button>
          )}
          <button className="btn-icon" onClick={() => setShowPlayers(true)} title="管理玩家">
            👥
          </button>
          <button className="btn-icon" onClick={() => setShowBackup(true)} title="備份與還原">
            ⚙
          </button>
        </div>
      </header>

      {view === 'setup' && (
        <TableSetup
          players={players}
          sessions={sessions}
          onStartTable={handleStartTable}
          onResumeSession={openSession}
          onManagePlayers={() => setShowPlayers(true)}
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

          {ended ? (
            <div className="ended-banner">
              <span>此牌桌已於 {new Date(activeSession.endedAt!).toLocaleString('zh-TW')} 結束</span>
              <button className="btn-link" onClick={handleReopenTable}>重新開啟</button>
            </div>
          ) : (
            <>
              {dealerState && (
                <div className="dealer-info-bar">
                  <div className="dealer-info-main">
                    {dealerState.jiang > 1 && <span className="dealer-jiang">第{dealerState.jiang}將</span>}
                    <span className="dealer-wind">{dealerState.wind}風{'東南西北'[dealerState.windRound - 1]}</span>
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

              {dealerState?.jiangComplete && (
                <div className="jiang-banner">
                  <p>🀄 第 {dealerState.jiang - 1} 將（北風北）已打完！</p>
                  <div className="jiang-actions">
                    <button className="btn-primary btn-sm" onClick={() => setConfirmEnd(true)}>結束牌桌並結算</button>
                    <span className="setup-hint">或直接記錄下一局繼續打</span>
                  </div>
                </div>
              )}

              {alerts.length > 0 && (
                <div className="streak-alerts">
                  {alerts.map(a => <span key={a} className="streak-alert">{a}</span>)}
                </div>
              )}

              <RoundRecorder
                tableSession={activeSession}
                onSave={handleSaveRound}
                dealerId={dealerState?.dealerId ?? null}
              />
            </>
          )}

          {toast && (
            <div className="undo-toast">
              <div className="toast-body">
                <span>{toast}</span>
                {toastMoney && <span className="toast-money">{toastMoney}</span>}
              </div>
              {undoRoundId && <button className="btn-link" onClick={handleUndo}>撤銷</button>}
            </div>
          )}

          <Dashboard
            stats={stats}
            rounds={filteredRounds}
            allRounds={allRounds}
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
            <button className="btn-secondary" onClick={() => setShowSettlement('view')}>
              結算
            </button>
            <button className="btn-secondary" onClick={() => setShowShare(true)}>
              分享
            </button>
            {!ended && (
              <button className="btn-secondary btn-end" onClick={() => setConfirmEnd(true)}>
                結束牌桌
              </button>
            )}
          </div>

          {confirmEnd && (
            <div className="panel-overlay" onClick={() => setConfirmEnd(false)}>
              <div className="panel" onClick={e => e.stopPropagation()}>
                <div className="panel-header">
                  <h3>結束牌桌？</h3>
                  <button className="btn-icon" onClick={() => setConfirmEnd(false)}>✕</button>
                </div>
                <p className="setup-hint">結束後會顯示結算，之後仍可從「最近牌桌」重新開啟。</p>
                <div className="clear-buttons">
                  <button className="btn-secondary" onClick={() => setConfirmEnd(false)}>取消</button>
                  <button className="btn-primary" onClick={handleEndTable}>結束並結算</button>
                </div>
              </div>
            </div>
          )}
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

      {showSettlement && activeSession && (
        <SettlementPanel
          session={activeSession}
          rounds={rounds}
          ended={showSettlement === 'ended'}
          onClose={() => setShowSettlement(false)}
        />
      )}

      {showShare && activeSession && (
        <SharePanel session={activeSession} rounds={rounds} onClose={() => setShowShare(false)} />
      )}

      {showPlayers && (
        <PlayerManager
          players={players}
          onAdd={addPlayer}
          onUpdate={updatePlayer}
          onClose={() => setShowPlayers(false)}
        />
      )}

      {showBackup && (
        <BackupPanel
          onClose={() => setShowBackup(false)}
          onImported={refreshAll}
          activeSessionId={activeSession?.id ?? null}
          prefs={prefs}
        />
      )}

      {shareData && <ShareImportPanel data={shareData} onDone={handleShareDone} />}
    </div>
  );
}
