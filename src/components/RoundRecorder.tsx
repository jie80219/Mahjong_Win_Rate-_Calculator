import { useState, useCallback } from 'react';
import type { TableSession, ResultType, Round } from '../types';
import { getPlayerName } from '../db/players';
import { nowISO } from '../utils/id';

interface Props {
  tableSession: TableSession;
  onSave: (data: Omit<Round, 'id' | 'createdAt' | 'updatedAt' | 'sequence'>) => Promise<void>;
  initialData?: Partial<Round>;
  editMode?: boolean;
  onCancel?: () => void;
}

const TAI_BUTTONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function RoundRecorder({ tableSession, onSave, initialData, editMode, onCancel }: Props) {
  const [resultType, setResultType] = useState<ResultType | null>(initialData?.resultType ?? null);
  const [winnerId, setWinnerId] = useState<string | null>(initialData?.winnerId ?? null);
  const [discarderId, setDiscarderId] = useState<string | null>(initialData?.discarderId ?? null);
  const [tai, setTai] = useState<number | null>(initialData?.tai ?? null);
  const [customTai, setCustomTai] = useState<number>(10);
  const [showCustom, setShowCustom] = useState(initialData?.tai !== null && initialData?.tai !== undefined && initialData.tai >= 10);
  const [saving, setSaving] = useState(false);

  const players = tableSession.playerIds;

  const reset = useCallback(() => {
    setResultType(null);
    setWinnerId(null);
    setDiscarderId(null);
    setTai(null);
    setShowCustom(false);
    setCustomTai(10);
  }, []);

  const handleResultType = useCallback((type: ResultType) => {
    if (type === resultType) return;
    setResultType(type);
    if (type === 'draw') {
      setWinnerId(null);
      setDiscarderId(null);
      setTai(null);
      setShowCustom(false);
    } else if (type === 'selfDraw') {
      setDiscarderId(null);
    }
  }, [resultType]);

  const handleWinner = useCallback((pid: string) => {
    setWinnerId(prev => prev === pid ? null : pid);
    if (pid === discarderId) {
      setDiscarderId(null);
    }
  }, [discarderId]);

  const handleDiscarder = useCallback((pid: string) => {
    setDiscarderId(prev => prev === pid ? null : pid);
  }, []);

  const handleTai = useCallback((t: number) => {
    setTai(t);
    setShowCustom(false);
  }, []);

  const handleCustomTaiSelect = useCallback(() => {
    setShowCustom(true);
    setTai(customTai);
  }, [customTai]);

  const isCritical = tai !== null && tai >= 5;

  const canSave = (() => {
    if (saving) return false;
    if (!resultType) return false;
    if (resultType === 'draw') return true;
    if (!winnerId) return false;
    if (tai === null) return false;
    if (resultType === 'discardWin' && !discarderId) return false;
    return true;
  })();

  const summary = (() => {
    if (!resultType) return '';
    if (resultType === 'draw') return '流局';
    if (!winnerId) return '';
    const wName = getPlayerName(winnerId);
    if (resultType === 'selfDraw') {
      if (tai === null) return `${wName}自摸`;
      return `${wName}自摸，${tai} 台${isCritical ? '，爆擊' : ''}`;
    }
    if (!discarderId) return `${wName}榮胡`;
    const dName = getPlayerName(discarderId);
    if (tai === null) return `${wName}榮胡，${dName}放槍`;
    return `${wName}榮胡，${dName}放槍，${tai} 台${isCritical ? '，爆擊' : ''}`;
  })();

  const handleSave = useCallback(async () => {
    if (!canSave || !resultType) return;
    setSaving(true);
    try {
      await onSave({
        tableSessionId: tableSession.id,
        playedAt: initialData?.playedAt ?? nowISO(),
        resultType,
        winnerId: resultType === 'draw' ? null : winnerId,
        discarderId: resultType === 'discardWin' ? discarderId : null,
        tai: resultType === 'draw' ? null : tai,
      });
      if (!editMode) reset();
    } catch {
      alert('儲存失敗，請重試');
    } finally {
      setSaving(false);
    }
  }, [canSave, resultType, winnerId, discarderId, tai, tableSession.id, onSave, reset, editMode, initialData]);

  return (
    <div className="round-recorder">
      <h3>{editMode ? '修改牌局' : '記錄一局'}</h3>

      <div className="result-buttons">
        {(['selfDraw', 'discardWin', 'draw'] as ResultType[]).map(type => (
          <button
            key={type}
            className={`result-btn ${resultType === type ? 'active' : ''}`}
            onClick={() => handleResultType(type)}
          >
            {{ selfDraw: '自摸', discardWin: '榮胡', draw: '流局' }[type]}
          </button>
        ))}
      </div>

      {resultType && resultType !== 'draw' && (
        <div className="player-select-section">
          <label>{resultType === 'selfDraw' ? '自摸者' : '胡牌者'}</label>
          <div className="player-select-row">
            {players.map(pid => (
              <button
                key={pid}
                className={`player-select-btn ${winnerId === pid ? 'active' : ''}`}
                onClick={() => handleWinner(pid)}
              >
                {winnerId === pid && <span className="check">✓</span>}
                {getPlayerName(pid)}
              </button>
            ))}
          </div>
        </div>
      )}

      {resultType === 'discardWin' && winnerId && (
        <div className="player-select-section">
          <label>放槍者</label>
          <div className="player-select-row">
            {players.filter(pid => pid !== winnerId).map(pid => (
              <button
                key={pid}
                className={`player-select-btn ${discarderId === pid ? 'active' : ''}`}
                onClick={() => handleDiscarder(pid)}
              >
                {discarderId === pid && <span className="check">✓</span>}
                {getPlayerName(pid)}
              </button>
            ))}
          </div>
        </div>
      )}

      {resultType && resultType !== 'draw' && winnerId && (resultType !== 'discardWin' || discarderId) && (
        <div className="tai-section">
          <label>台數 {isCritical && <span className="critical-badge">爆擊</span>}</label>
          <div className="tai-buttons">
            {TAI_BUTTONS.map(t => (
              <button
                key={t}
                className={`tai-btn ${tai === t && !showCustom ? 'active' : ''} ${t >= 5 ? 'critical-tai' : ''}`}
                onClick={() => handleTai(t)}
              >
                {t}
              </button>
            ))}
            <button
              className={`tai-btn ${showCustom ? 'active' : ''}`}
              onClick={handleCustomTaiSelect}
            >
              10+
            </button>
          </div>
          {showCustom && (
            <div className="custom-tai">
              <button className="tai-adjust" onClick={() => { const v = Math.max(10, customTai - 1); setCustomTai(v); setTai(v); }}>−</button>
              <span className="custom-tai-value">{customTai}</span>
              <button className="tai-adjust" onClick={() => { const v = customTai + 1; setCustomTai(v); setTai(v); }}>+</button>
            </div>
          )}
        </div>
      )}

      {summary && (
        <div className="round-summary">
          {summary}
        </div>
      )}

      <div className="recorder-actions">
        <button
          className="btn-primary btn-block"
          disabled={!canSave}
          onClick={handleSave}
        >
          {saving ? '儲存中...' : editMode ? '儲存修改' : '儲存'}
        </button>
        {editMode && onCancel && (
          <button className="btn-secondary btn-block" onClick={onCancel}>取消</button>
        )}
      </div>
    </div>
  );
}
