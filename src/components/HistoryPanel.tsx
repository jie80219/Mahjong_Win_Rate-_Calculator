import { useState, useMemo } from 'react';
import type { Round, TableSession } from '../types';
import { getPlayerName } from '../db/players';
import RoundRecorder from './RoundRecorder';
import { computeDealerTimeline, roundDealerLabel, type RoundDealer } from '../utils/dealer';
import { isCriticalTai } from '../utils/rules';
import { computeRoundDealerTai, type RoundDealerTai } from '../utils/money';

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

const NO_DEALER_TAI: RoundDealerTai = { inHand: 0, dealerOnly: 0 };

/** 含莊家台的總台數（閒家自摸時莊家另付的不算） */
function totalTai(r: Round, d: RoundDealerTai): number | null {
  return r.tai === null ? null : r.tai + d.inHand;
}

/** 例如「（含莊家 7 台）」「（莊家另付 9 台）」 */
function dealerTaiText(d: RoundDealerTai): string {
  if (d.inHand) return `（含莊家 ${d.inHand} 台）`;
  if (d.dealerOnly) return `（莊家另付 ${d.dealerOnly} 台）`;
  return '';
}

function roundSummary(r: Round, d: RoundDealerTai): string {
  if (r.resultType === 'draw') return '流局';
  const winner = r.winnerId ? getPlayerName(r.winnerId) : '?';
  const tai = `${totalTai(r, d)} 台${dealerTaiText(d)}`;
  if (r.resultType === 'selfDraw') {
    return `${winner}自摸 ${tai}`;
  }
  const discarder = r.discarderId ? getPlayerName(r.discarderId) : '?';
  return `${winner}胡牌，${discarder}放槍 ${tai}`;
}

function matchesFilter(r: Round, d: RoundDealerTai, filter: { playerId?: string; metric?: string } | null): boolean {
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
      return r.winnerId === playerId && isCriticalTai(totalTai(r, d));
    case 'beCritical':
      return r.resultType === 'discardWin' && r.discarderId === playerId && isCriticalTai(totalTai(r, d));
    default:
      return r.winnerId === playerId || r.discarderId === playerId;
  }
}

export default function HistoryPanel({ rounds, tableSession, sessions, filter, onEdit, onDelete, onClose }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteInput, setDeleteInput] = useState('');

  // 每局開打時的圈風、局、莊家、連莊（依各牌桌全部牌局推算），以及這局的莊家台
  const { dealerByRound, dealerTaiByRound } = useMemo(() => {
    const dealers = new Map<string, RoundDealer>();
    const dealerTai = new Map<string, RoundDealerTai>();
    const sessionIds = new Set(rounds.map(r => r.tableSessionId));
    for (const id of sessionIds) {
      const s = sessions.find(x => x.id === id) ?? (tableSession.id === id ? tableSession : null);
      if (!s) continue;
      for (const [rid, d] of computeDealerTimeline(s, rounds).byRound) dealers.set(rid, d);
      for (const r of rounds) {
        if (r.tableSessionId === id) dealerTai.set(r.id, computeRoundDealerTai(r, s, dealers.get(r.id)));
      }
    }
    return { dealerByRound: dealers, dealerTaiByRound: dealerTai };
  }, [rounds, sessions, tableSession]);
  const dealerTaiOf = (r: Round) => dealerTaiByRound.get(r.id) ?? NO_DEALER_TAI;

  const filtered = useMemo(() => {
    let list = [...rounds];
    if (filter) {
      list = list.filter(r => matchesFilter(r, dealerTaiByRound.get(r.id) ?? NO_DEALER_TAI, filter));
    }
    return list.sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  }, [rounds, filter, dealerTaiByRound]);

  const editingRound = editingId ? rounds.find(r => r.id === editingId) : null;
  const editSession = editingRound
    ? sessions.find(s => s.id === editingRound.tableSessionId) ?? tableSession
    : tableSession;
  const editDealerId = editingRound
    ? computeDealerTimeline(editSession, rounds).byRound.get(editingRound.id)?.dealerId ?? null
    : null;

  const handleEditSave = async (data: Omit<Round, 'id' | 'createdAt' | 'updatedAt' | 'sequence'>) => {
    if (!editingId) return;
    await onEdit(editingId, {
      resultType: data.resultType,
      winnerId: data.winnerId,
      discarderId: data.discarderId,
      tai: data.tai,
      taiNote: data.taiNote,
      multiplier: data.multiplier,
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
            dealerId={editDealerId}
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
                    <span className="history-summary">{roundSummary(r, dealerTaiOf(r))}</span>
                    {isCriticalTai(totalTai(r, dealerTaiOf(r))) && <span className="critical-badge">大牌</span>}
                    {(r.multiplier ?? 1) > 1 && <span className="leopard-badge">金額 ×{r.multiplier}</span>}
                  </div>
                  {r.taiNote && <div className="history-tai-note">{r.taiNote}</div>}
                  <div className="history-meta">
                    {dealerByRound.has(r.id) && (
                      <span className="history-dealer">
                        {roundDealerLabel(dealerByRound.get(r.id), sessions.find(s => s.id === r.tableSessionId) ?? tableSession)}・莊 {getPlayerName(dealerByRound.get(r.id)!.dealerId)}
                      </span>
                    )}
                    <span>{new Date(r.playedAt).toLocaleString('zh-TW')}</span>
                  </div>
                  <div className="history-actions">
                    <button className="btn-link" onClick={() => setEditingId(r.id)}>編輯</button>
                    {deleteConfirm === r.id ? (
                      <div className="delete-confirm-dialog">
                        <p className="delete-confirm-hint">若要刪除紀錄請輸入「123」</p>
                        <div className="delete-confirm-row">
                          <input
                            className="delete-confirm-input"
                            type="text"
                            inputMode="numeric"
                            value={deleteInput}
                            onChange={e => setDeleteInput(e.target.value)}
                            placeholder="請輸入 123"
                            autoFocus
                          />
                          <button
                            className="btn-danger-sm"
                            disabled={deleteInput !== '123'}
                            onClick={() => handleDelete(r.id)}
                          >
                            確認刪除
                          </button>
                          <button className="btn-link" onClick={() => { setDeleteConfirm(null); setDeleteInput(''); }}>取消</button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn-link btn-danger-text" onClick={() => { setDeleteConfirm(r.id); setDeleteInput(''); }}>刪除</button>
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
