import { useState } from 'react';
import type { Player } from '../types';

interface Props {
  players: Player[];
  onAdd: (name: string) => Promise<void>;
  onUpdate: (id: string, changes: Partial<Omit<Player, 'id'>>) => Promise<void>;
  onClose: () => void;
}

export default function PlayerManager({ players, onAdd, onUpdate, onClose }: Props) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');

  const nameTaken = (name: string, exceptId?: string) =>
    players.some(p => p.displayName === name && p.id !== exceptId);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    if (nameTaken(name)) { setError(`已經有「${name}」了`); return; }
    await onAdd(name);
    setNewName('');
    setError('');
  };

  const handleRename = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    if (nameTaken(name, id)) { setError(`已經有「${name}」了`); return; }
    await onUpdate(id, { displayName: name });
    setEditingId(null);
    setError('');
  };

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <h3>管理玩家</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="player-add-row">
          <input
            className="text-input"
            value={newName}
            placeholder="新玩家名稱"
            maxLength={8}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          />
          <button className="btn-primary btn-sm" disabled={!newName.trim()} onClick={handleAdd}>新增</button>
        </div>
        {error && <p className="warn-text">{error}</p>}
        <p className="setup-hint">隱藏的玩家不會出現在選人名單，但歷史統計會保留。</p>

        <div className="player-manage-list">
          {players.map(p => (
            <div key={p.id} className={`player-manage-item ${p.isActive ? '' : 'inactive'}`}>
              {editingId === p.id ? (
                <>
                  <input
                    className="text-input"
                    value={editName}
                    maxLength={8}
                    autoFocus
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(p.id); }}
                  />
                  <button className="btn-link" onClick={() => handleRename(p.id)}>儲存</button>
                  <button className="btn-link" onClick={() => setEditingId(null)}>取消</button>
                </>
              ) : (
                <>
                  <span className="player-manage-name">{p.displayName}</span>
                  {!p.isActive && <span className="tag-muted">已隱藏</span>}
                  <button className="btn-link" onClick={() => { setEditingId(p.id); setEditName(p.displayName); setError(''); }}>改名</button>
                  <button className="btn-link" onClick={() => onUpdate(p.id, { isActive: !p.isActive })}>
                    {p.isActive ? '隱藏' : '顯示'}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
