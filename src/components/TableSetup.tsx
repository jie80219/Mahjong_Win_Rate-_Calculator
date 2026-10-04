import { useState, useCallback } from 'react';
import type { TableSession } from '../types';
import { PLAYERS, getPlayerName } from '../db/players';
import { loadLastTable } from '../utils/preferences';

interface Props {
  sessions: TableSession[];
  onStartTable: (playerIds: [string, string, string, string]) => void;
  onResumeSession: (session: TableSession) => void;
}

export default function TableSetup({ sessions, onStartTable, onResumeSession }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const lastTable = loadLastTable();

  const togglePlayer = useCallback((pid: string) => {
    setSelected(prev => {
      if (prev.includes(pid)) return prev.filter(id => id !== pid);
      if (prev.length >= 4) return prev;
      return [...prev, pid];
    });
  }, []);

  const moveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setSelected(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const handleUseLastTable = useCallback(() => {
    if (lastTable) setSelected(lastTable);
  }, [lastTable]);

  const canStart = selected.length === 4;

  return (
    <div className="table-setup">
      <h2>建立牌桌</h2>

      <div className="seat-slots">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`seat-slot ${selected[i] ? 'filled' : ''}`}>
            {selected[i] ? (
              <div className="seat-content">
                <span>{getPlayerName(selected[i])}</span>
                <div className="seat-actions">
                  {i > 0 && <button className="btn-icon-sm" onClick={() => moveUp(i)} title="上移">↑</button>}
                  {i < selected.length - 1 && <button className="btn-icon-sm" onClick={() => moveUp(i + 1)} title="下移">↓</button>}
                  <button className="btn-icon-sm" onClick={() => togglePlayer(selected[i])} title="移除">✕</button>
                </div>
              </div>
            ) : (
              <span className="seat-empty">座位 {i + 1}</span>
            )}
          </div>
        ))}
      </div>

      <div className="select-count">已選 {selected.length} / 4 人</div>

      {lastTable && selected.length === 0 && (
        <button className="btn-secondary btn-block" onClick={handleUseLastTable}>
          使用上次四人（{lastTable.map(id => getPlayerName(id)).join('、')}）
        </button>
      )}

      <div className="player-grid">
        {PLAYERS.map(p => {
          const isSelected = selected.includes(p.id);
          const isDisabled = !isSelected && selected.length >= 4;
          return (
            <button
              key={p.id}
              className={`player-btn ${isSelected ? 'selected' : ''}`}
              disabled={isDisabled}
              onClick={() => togglePlayer(p.id)}
            >
              {isSelected && <span className="check">✓</span>}
              {p.displayName}
            </button>
          );
        })}
      </div>

      <button
        className="btn-primary btn-block"
        disabled={!canStart}
        onClick={() => onStartTable(selected as [string, string, string, string])}
      >
        {canStart ? '開始牌桌' : `還需選 ${4 - selected.length} 人`}
      </button>

      {sessions.length > 0 && (
        <div className="recent-sessions">
          <h3>最近牌桌</h3>
          {sessions.slice(0, 5).map(s => (
            <button
              key={s.id}
              className="session-item"
              onClick={() => onResumeSession(s)}
            >
              <span className="session-players">
                {s.playerIds.map(id => getPlayerName(id)).join('、')}
              </span>
              <span className="session-date">
                {new Date(s.startedAt).toLocaleDateString('zh-TW')}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
