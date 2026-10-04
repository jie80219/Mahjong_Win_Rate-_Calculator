import { useState, useCallback } from 'react';
import type { ComputedStats, Preferences, MetricKey, Round, TableSession } from '../types';
import { PLAYERS, getPlayerName } from '../db/players';
import BarChartView from './views/BarChartView';
import LineChartView from './views/LineChartView';
import ListView from './views/ListView';
import CardView from './views/CardView';

interface Props {
  stats: ComputedStats[];
  rounds: Round[];
  allRounds: Round[];
  tablePlayerMap: Map<string, string[]>;
  activeSession: TableSession;
  prefs: Preferences;
  onUpdatePrefs: (p: Partial<Preferences>) => void;
  tableDraw: number;
  onOpenHistory: (filter?: { playerId?: string; metric?: string }) => void;
  sessions: TableSession[];
}

const METRICS: { key: MetricKey; label: string }[] = [
  { key: 'selfDraw', label: '自摸' },
  { key: 'win', label: '胡牌' },
  { key: 'overallWin', label: '勝率' },
  { key: 'discard', label: '放槍' },
  { key: 'beDrawn', label: '被摸' },
  { key: 'critical', label: '爆擊' },
  { key: 'beCritical', label: '被爆' },
  { key: 'drawRate', label: '流局' },
];

const VIEW_MODES = [
  { key: 'bar' as const, label: '長條' },
  { key: 'line' as const, label: '折線' },
  { key: 'list' as const, label: '清單' },
  { key: 'card' as const, label: '卡片' },
];

const DATE_PRESETS = [
  { key: 'all' as const, label: '全部' },
  { key: 'today' as const, label: '今天' },
  { key: 'week' as const, label: '近 7 天' },
  { key: 'month' as const, label: '近 30 天' },
  { key: 'custom' as const, label: '自訂' },
];

export default function Dashboard({
  stats,
  rounds,
  tablePlayerMap,
  activeSession,
  prefs,
  onUpdatePrefs,
  tableDraw,
  onOpenHistory,
}: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const scope = prefs.scope;

  const handleScopeChange = useCallback((newScope: 'table' | 'all') => {
    if (newScope === 'all') {
      onUpdatePrefs({
        scope: 'all',
        selectedPlayerIds: [...activeSession.playerIds],
      });
    } else {
      onUpdatePrefs({ scope: 'table', selectedPlayerIds: [...activeSession.playerIds] });
    }
  }, [activeSession, onUpdatePrefs]);

  const togglePlayerFilter = useCallback((pid: string) => {
    const current = prefs.selectedPlayerIds;
    if (current.includes(pid)) {
      if (current.length <= 1) return;
      onUpdatePrefs({ selectedPlayerIds: current.filter(id => id !== pid) });
    } else {
      onUpdatePrefs({ selectedPlayerIds: [...current, pid] });
    }
  }, [prefs.selectedPlayerIds, onUpdatePrefs]);

  const availablePlayers = scope === 'all' ? PLAYERS : PLAYERS.filter(p => activeSession.playerIds.includes(p.id));

  const dateLabel = (() => {
    switch (prefs.dateRange.type) {
      case 'all': return '全部日期';
      case 'today': return '今天';
      case 'week': return '近 7 天';
      case 'month': return '近 30 天';
      case 'custom': return `${prefs.dateRange.start ?? '?'} ~ ${prefs.dateRange.end ?? '?'}`;
    }
  })();

  const settingSummary = `有效局為分母 · 被爆僅放槍 · ${dateLabel}`;

  const totalRounds = rounds.length;
  const effectiveRounds = rounds.filter(r => r.resultType !== 'draw').length;

  const statsWithNames = stats.map(s => ({
    ...s,
    displayName: getPlayerName(s.playerId),
  }));

  const noData = totalRounds === 0;

  return (
    <div className="dashboard">
      <div className="scope-bar">
        <button
          className={`scope-btn ${scope === 'table' ? 'active' : ''}`}
          onClick={() => handleScopeChange('table')}
        >
          目前牌桌
        </button>
        <button
          className={`scope-btn ${scope === 'all' ? 'active' : ''}`}
          onClick={() => handleScopeChange('all')}
        >
          全部紀錄
        </button>
      </div>

      <div className="player-filter">
        {availablePlayers.map(p => (
          <button
            key={p.id}
            className={`filter-btn ${prefs.selectedPlayerIds.includes(p.id) ? 'active' : ''}`}
            onClick={() => togglePlayerFilter(p.id)}
          >
            {p.displayName}
          </button>
        ))}
      </div>

      <div className="view-bar">
        {VIEW_MODES.map(v => (
          <button
            key={v.key}
            className={`view-btn ${prefs.dashboardMode === v.key ? 'active' : ''}`}
            onClick={() => onUpdatePrefs({ dashboardMode: v.key })}
          >
            {v.label}
          </button>
        ))}
      </div>

      {(prefs.dashboardMode === 'bar' || prefs.dashboardMode === 'line') && (
        <>
          <div className="metric-bar">
            {METRICS.map(m => (
              <button
                key={m.key}
                className={`metric-btn ${prefs.selectedMetric === m.key ? 'active' : ''}`}
                onClick={() => onUpdatePrefs({ selectedMetric: m.key })}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="display-mode-bar">
            <button
              className={`display-mode-btn ${prefs.displayMode === 'rate' ? 'active' : ''}`}
              onClick={() => onUpdatePrefs({ displayMode: 'rate' })}
            >
              比例
            </button>
            <button
              className={`display-mode-btn ${prefs.displayMode === 'count' ? 'active' : ''}`}
              onClick={() => onUpdatePrefs({ displayMode: 'count' })}
            >
              次數
            </button>
          </div>
        </>
      )}

      <div className="settings-toggle">
        <button className="btn-link settings-link" onClick={() => setShowSettings(!showSettings)}>
          統計設定
        </button>
        <span className="settings-summary">{settingSummary}</span>
      </div>

      {showSettings && (
        <div className="settings-panel">
          <div className="date-presets">
            {DATE_PRESETS.map(d => (
              <button
                key={d.key}
                className={`date-btn ${prefs.dateRange.type === d.key ? 'active' : ''}`}
                onClick={() => {
                  if (d.key === 'custom') {
                    onUpdatePrefs({ dateRange: { type: 'custom', start: '', end: '' } });
                  } else {
                    onUpdatePrefs({ dateRange: { type: d.key } });
                  }
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
          {prefs.dateRange.type === 'custom' && (
            <div className="custom-date">
              <input
                type="date"
                value={prefs.dateRange.start ?? ''}
                onChange={e => onUpdatePrefs({ dateRange: { ...prefs.dateRange, start: e.target.value } })}
              />
              <span>~</span>
              <input
                type="date"
                value={prefs.dateRange.end ?? ''}
                onChange={e => onUpdatePrefs({ dateRange: { ...prefs.dateRange, end: e.target.value } })}
              />
            </div>
          )}
        </div>
      )}

      {noData ? (
        <div className="no-data">
          <p>尚無牌局紀錄</p>
          <p className="no-data-hint">按上方「記錄一局」開始</p>
        </div>
      ) : (
        <>
          <div className="draw-summary">
            流局：{tableDraw} 局 ｜ 共 {totalRounds} 局（有效 {effectiveRounds} 局）
          </div>

          <div className="chart-area">
            {prefs.dashboardMode === 'bar' && (
              <BarChartView
                stats={statsWithNames}
                metric={prefs.selectedMetric}
                displayMode={prefs.displayMode}
                onOpenHistory={onOpenHistory}
              />
            )}
            {prefs.dashboardMode === 'line' && (
              <LineChartView
                rounds={rounds}
                playerIds={prefs.selectedPlayerIds.length > 0 ? prefs.selectedPlayerIds : [...activeSession.playerIds]}
                metric={prefs.selectedMetric}
                tablePlayerMap={tablePlayerMap}
              />
            )}
            {prefs.dashboardMode === 'list' && (
              <ListView stats={statsWithNames} onOpenHistory={onOpenHistory} />
            )}
            {prefs.dashboardMode === 'card' && (
              <CardView stats={statsWithNames} onOpenHistory={onOpenHistory} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
