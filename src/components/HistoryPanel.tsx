import { useState, useMemo } from 'react';
import type { Round, TableSession } from '../types';
import { getPlayerName } from '../db/players';
import RoundRecorder from './RoundRecorder';

interface Props {
  rounds: Round[];
  tableSession: TableSession;
  sessions: TableSession[];
  scope: 'table' | 'all';
  filter: { playerId?: string; metric?: string } | null;
  onEdit: (id: string, data: Partial<Round>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
  tablePlayerMap: Map<string, string[]>;
}

function roundSummary(r: Round): string {
  if (r.resultType === 'draw') return '流局';
  const winner = r.winnerId ? getPlayerName(r.winnerId) : '?';
  const isCritical = r.tai !== null && r.tai >= 5;
  if (r.resultType === 'selfDraw') {
    return `${winner}自摸 ${r.tai} 台${isCritical ? ' 爆擊' : ''}`;
  }
  const discarder = r.discarderId ? getPlayerName(r.discarderId) : '?';
  return `${winner}榮胡，${discarder}放槍 ${r.tai} 台${isCritical ? ' 爆擊' : ''}`;
}

function matchesFilter(r: Round, filter: { playerId?: string; metric?: string } | null): boolean {
  if (!filter) return true;
  const { playerId, metric } = filter;
  if (!playerId) return true;

  if (r.resultType === 'draw') return false;

  switch (metric) {
    case 'selfDraw':
      return r.resultType === 'selfDraw' && r.winnerId === playerId;
    case 'win':
      return r.winnerId === playerId;
    case 'discard':
      return r.resultType === 'discardWin' && r.discarderId === playerId;
    case 'beDrawn':
      return r.resultType === 'selfDraw' && r.winnerId !== playerId;
    case 'critical':
      return r.winnerId === playerId && r.tai !== null && r.tai >= 5;
    case 'beCritical':
      return r.resultType === 'discardWin' && r.discarderId === playerId && r.tai !== null && r.tai >= 5;
    default:
      return r.winnerId === playerId || r.discarderId === playerId;
  }
}

export default function HistoryPanel({ rounds, tableSession, sessions, filter, onEdit, onDelete, onClose }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = [...rounds];
    if (filter) {
      list = list.filter(r => matchesFilter(r, filter));
    }
    return list.sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  }, [rounds, filter]);

  const editingRound = editingId ? rounds.find(r => r.id === editingId) : null;
  const editSession = editingRound
    ? sessions.find(s => s.id === editingRound.tableSessionId) ?? tableSession
    : tableSession;

  const handleEditSave = async (data: Omit<Round, 'id' | 'createdAt' | 'updatedAt' | 'sequence'>) => {
    if (!editingId) return;
    await onEdit(editingId, {
      resultType: data.resultType,
      winnerId: data.winnerId,
      discarderId: data.discarderId,
      tai: data.tai,
    });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    await onDelete(id);
    setDeleteConfirm(null);
  };

  const filterDesc = filter
    ? `篩選：${filter.playerId ? getPlayerName(filter.playerId) : ''}${filter.metric ? ` · ${filter.metric}` : ''}`
    : '';

  return (
    <div className="panel-overlay">
      <div className="panel">
        <div className="panel-header">
          <h3>牌局紀錄</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        {filterDesc && <div className="filter-desc">{filterDesc}</div>}

        {editingId && editingRound ? (
          <RoundRecorder
            tableSession={editSession}
            onSave={handleEditSave}
            initialData={editingRound}
            editMode
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div className="history-list">
            {filtered.length === 0 ? (
              <div className="no-data">
                <p>無符合條件的紀錄</p>
                {filter && <p className="no-data-hint">嘗試清除篩選條件</p>}
              </div>
            ) : (
              filtered.map(r => (
                <div key={r.id} className="history-item">
                  <div className="history-main">
                    <span className="history-seq">#{r.sequence}</span>
                    <span className="history-summary">{roundSummary(r)}</span>
                    {r.tai !== null && r.tai >= 5 && <span className="critical-badge">爆擊</span>}
                  </div>
                  <div className="history-meta">
                    <span>{new Date(r.playedAt).toLocaleString('zh-TW')}</span>
                  </div>
                  <div className="history-actions">
                    <button className="btn-link" onClick={() => setEditingId(r.id)}>編輯</button>
                    {deleteConfirm === r.id ? (
                      <span className="delete-confirm">
                        確定刪除？
                        <button className="btn-danger-sm" onClick={() => handleDelete(r.id)}>刪除</button>
                        <button className="btn-link" onClick={() => setDeleteConfirm(null)}>取消</button>
                      </span>
                    ) : (
                      <button className="btn-link btn-danger-text" onClick={() => setDeleteConfirm(r.id)}>刪除</button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
