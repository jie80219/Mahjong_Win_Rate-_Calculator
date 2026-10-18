import { useState, useMemo, useCallback } from 'react';
import type { Preferences, TableSession } from '../types';
import type { ReportData } from './exportReport';
import { getPlayerName } from '../db/players';
import { useDashboardData } from '../hooks/useDashboardData';
import Dashboard from '../components/Dashboard';
import HistoryPanel from '../components/HistoryPanel';

// 匯出的 HTML 報表：用跟網頁同一套儀表板元件，只是資料來自檔案、不能修改

function sessionLabel(s: TableSession): string {
  const date = new Date(s.startedAt).toLocaleDateString('zh-TW');
  const names = s.playerIds.map(getPlayerName).join('、');
  return `${date}　${names}${s.endedAt ? '' : '（進行中）'}`;
}

export default function ReportApp({ data }: { data: ReportData }) {
  const sessions = useMemo(
    () => [...data.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [data.sessions],
  );
  const allRounds = data.rounds;
  const tablePlayerMap = useMemo(
    () => new Map(data.sessions.map(s => [s.id, [...s.playerIds]])),
    [data.sessions],
  );

  const initialSession = sessions.find(s => s.id === data.activeSessionId) ?? sessions[0] ?? null;
  const [sessionId, setSessionId] = useState(initialSession?.id ?? null);
  const [prefs, setPrefs] = useState<Preferences>(() => (
    initialSession && initialSession.id !== data.activeSessionId
      ? { ...data.prefs, selectedPlayerIds: [...initialSession.playerIds] }
      : data.prefs
  ));
  const [historyFilter, setHistoryFilter] = useState<{ playerId?: string; metric?: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const activeSession = sessions.find(s => s.id === sessionId) ?? null;
  const rounds = useMemo(
    () => (sessionId ? allRounds.filter(r => r.tableSessionId === sessionId) : []),
    [allRounds, sessionId],
  );

  const { filteredRounds, stats, tableDraw, roundsMoney, cumulativeMoney } = useDashboardData({
    activeSession, rounds, allRounds, sessions, tablePlayerMap, prefs,
  });

  const updatePrefs = useCallback((partial: Partial<Preferences>) => {
    setPrefs(prev => ({ ...prev, ...partial }));
  }, []);

  const handleSessionChange = useCallback((id: string) => {
    const s = sessions.find(x => x.id === id);
    if (!s) return;
    setSessionId(id);
    // 換牌桌時玩家篩選跟著換成該桌的人（跟網頁換桌一樣）
    if (prefs.scope === 'table') setPrefs(prev => ({ ...prev, selectedPlayerIds: [...s.playerIds] }));
  }, [sessions, prefs.scope]);

  const handleOpenHistory = useCallback((filter?: { playerId?: string; metric?: string }) => {
    setHistoryFilter(filter ?? null);
    setShowHistory(true);
  }, []);

  const noop = useCallback(async () => {}, []);

  return (
    <div className="app">
      <header className="app-header report-header">
        <h1>麻將分析報表</h1>
        <span className="report-exported">
          匯出於 {new Date(data.exportedAt).toLocaleString('zh-TW')}
        </span>
      </header>

      {!activeSession ? (
        <div className="no-data"><p>報表裡沒有牌桌紀錄</p></div>
      ) : (
        <>
          <div className="report-table-select">
            <label htmlFor="report-session">牌桌</label>
            <select
              id="report-session"
              value={activeSession.id}
              onChange={e => handleSessionChange(e.target.value)}
            >
              {sessions.map(s => <option key={s.id} value={s.id}>{sessionLabel(s)}</option>)}
            </select>
          </div>

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
          </div>

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
          </div>

          {showHistory && (
            <HistoryPanel
              rounds={prefs.scope === 'all' ? allRounds : rounds}
              tableSession={activeSession}
              sessions={sessions}
              scope={prefs.scope}
              filter={historyFilter}
              onEdit={noop}
              onDelete={noop}
              onClose={() => { setShowHistory(false); setHistoryFilter(null); }}
              tablePlayerMap={tablePlayerMap}
              readOnly
            />
          )}
        </>
      )}
    </div>
  );
}
