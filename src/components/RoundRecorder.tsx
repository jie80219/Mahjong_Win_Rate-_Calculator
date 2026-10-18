import { useState, useCallback } from 'react';
import type { TableSession, ResultType, Round } from '../types';
import { getPlayerName } from '../db/players';
import { nowISO } from '../utils/id';
import { leopardMultiplier } from '../utils/taiTable';
import { loadSeatRotation, saveSeatRotation, loadMe, saveMe } from '../utils/preferences';
import TaiCalculator from './TaiCalculator';

interface Props {
  tableSession: TableSession;
  onSave: (data: Omit<Round, 'id' | 'createdAt' | 'updatedAt' | 'sequence'>) => Promise<void>;
  initialData?: Partial<Round>;
  editMode?: boolean;
  onCancel?: () => void;
  dealerId?: string | null;
}

const TAI_BUTTONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const WINDS = ['東', '南', '西', '北'];
// 座位依逆時針排在桌子四邊：預設東在下、南在右、西在上、北在左，可整桌旋轉讓記錄的人坐在下方
const SEAT_POSITIONS = ['bottom', 'right', 'top', 'left'] as const;

export default function RoundRecorder({ tableSession, onSave, initialData, editMode, onCancel, dealerId }: Props) {
  const [resultType, setResultType] = useState<ResultType | null>(initialData?.resultType ?? null);
  const [winnerId, setWinnerId] = useState<string | null>(initialData?.winnerId ?? null);
  const [discarderId, setDiscarderId] = useState<string | null>(initialData?.discarderId ?? null);
  const [tai, setTai] = useState<number | null>(initialData?.tai ?? null);
  const [customTai, setCustomTai] = useState<number>(initialData?.tai != null && initialData.tai >= 10 ? initialData.tai : 10);
  const [showCustom, setShowCustom] = useState(initialData?.tai != null && initialData.tai >= 10);
  const [saving, setSaving] = useState(false);
  const [taiNote, setTaiNote] = useState(initialData?.taiNote ?? '');
  const [showCalc, setShowCalc] = useState(false);
  const [multiplier, setMultiplier] = useState(initialData?.multiplier ?? 1);
  const [manualRotation, setRotation] = useState(() => loadSeatRotation(tableSession.id));
  const [me, setMe] = useState(loadMe);

  const seats = tableSession.seatOrder ?? tableSession.playerIds;
  // 設定了「我是誰」且我在這桌：自動把我轉到下方；否則用手動轉的方向
  const mySeat = me ? seats.indexOf(me) : -1;
  const rotation = mySeat >= 0 ? (4 - mySeat) % 4 : manualRotation;
  const bottomWind = WINDS[(4 - rotation) % 4];

  const changeMe = useCallback((pid: string) => {
    const next = pid || null;
    saveMe(next);
    setMe(next);
  }, []);

  const rotate = useCallback((step: number) => {
    setRotation(prev => {
      const next = (prev + step + 4) % 4;
      saveSeatRotation(tableSession.id, next);
      return next;
    });
  }, [tableSession.id]);

  const toggleLeopard = useCallback(() => {
    setMultiplier(m => (m > 1 ? 1 : leopardMultiplier()));
  }, []);

  const reset = useCallback(() => {
    setResultType(null);
    setWinnerId(null);
    setDiscarderId(null);
    setTai(null);
    setTaiNote('');
    setShowCustom(false);
    setCustomTai(10);
    setMultiplier(1);
  }, []);

  const handleSeat = useCallback((pid: string) => {
    if (resultType === 'draw' || !winnerId) {
      setResultType(null);
      setWinnerId(pid);
      setDiscarderId(null);
      return;
    }
    if (pid === winnerId) {
      reset();
      return;
    }
    if (pid === discarderId) {
      setDiscarderId(null);
      setResultType(null);
      return;
    }
    setDiscarderId(pid);
    setResultType('discardWin');
  }, [resultType, winnerId, discarderId, reset]);

  const handleSelfDraw = useCallback(() => {
    if (!winnerId) return;
    setResultType('selfDraw');
    setDiscarderId(null);
  }, [winnerId]);

  const handleDraw = useCallback(() => {
    if (resultType === 'draw') {
      reset();
      return;
    }
    reset();
    setResultType('draw');
  }, [resultType, reset]);

  const handleTai = useCallback((t: number) => {
    setTai(t);
    setTaiNote('');
    setShowCustom(false);
  }, []);

  const handleCustomTaiSelect = useCallback(() => {
    setShowCustom(true);
    setTai(customTai);
    setTaiNote('');
  }, [customTai]);

  const handleCalcApply = useCallback((t: number, note: string, m: number) => {
    setTai(t);
    setTaiNote(note);
    setMultiplier(m);
    if (t >= 10) {
      setCustomTai(t);
      setShowCustom(true);
    } else {
      setShowCustom(false);
    }
    setShowCalc(false);
  }, []);

  const isCritical = tai !== null && tai >= 5;
  const needsTai = resultType === 'selfDraw' || resultType === 'discardWin';

  const canSave = (() => {
    if (saving) return false;
    if (!resultType) return false;
    if (resultType === 'draw') return true;
    if (!winnerId) return false;
    if (tai === null) return false;
    if (resultType === 'discardWin' && !discarderId) return false;
    return true;
  })();

  const hint = (() => {
    if (resultType === 'draw') return '';
    if (!winnerId) return '點選胡牌的人，或按「流局」';
    if (!resultType) return '再點放槍的人，或按中間「自摸」';
    if (tai === null) return '選擇台數';
    return '';
  })();

  const summary = (() => {
    if (!resultType) return '';
    if (resultType === 'draw') return '流局';
    if (!winnerId) return '';
    const wName = getPlayerName(winnerId);
    const extra = `${isCritical ? '，大牌' : ''}${multiplier > 1 ? `，豹子 ×${multiplier}` : ''}`;
    if (resultType === 'selfDraw') {
      if (tai === null) return `${wName}自摸`;
      return `${wName}自摸，${tai} 台${extra}`;
    }
    if (!discarderId) return `${wName}胡牌`;
    const dName = getPlayerName(discarderId);
    if (tai === null) return `${wName}胡牌，${dName}放槍`;
    return `${wName}胡牌，${dName}放槍，${tai} 台${extra}`;
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
        taiNote: resultType !== 'draw' && taiNote ? taiNote : undefined,
        multiplier: resultType !== 'draw' && multiplier > 1 ? multiplier : undefined,
      });
      if (!editMode) reset();
    } catch {
      alert('儲存失敗，請重試');
    } finally {
      setSaving(false);
    }
  }, [canSave, resultType, winnerId, discarderId, tai, taiNote, multiplier, tableSession.id, onSave, reset, editMode, initialData]);

  return (
    <div className="round-recorder">
      <div className="recorder-header">
        <h3>{editMode ? '修改牌局' : '記錄一局'}</h3>
        <button className="btn-link" onClick={() => setShowCalc(true)}>📋 台數計算表</button>
      </div>

      <div className="mj-table">
        {seats.map((pid, i) => {
          const role = pid === winnerId
            ? (resultType === 'selfDraw' ? '自摸' : '胡')
            : pid === discarderId ? '放槍' : '';
          return (
            <button
              key={pid}
              className={`mj-seat mj-seat-${SEAT_POSITIONS[(i + rotation) % 4]} ${pid === winnerId ? 'is-winner' : ''} ${pid === discarderId ? 'is-discarder' : ''}`}
              onClick={() => handleSeat(pid)}
            >
              <span className="mj-seat-wind">{WINDS[i]}</span>
              <span className="mj-seat-name">
                {pid === dealerId && <span className="dealer-badge">莊</span>}
                {getPlayerName(pid)}
              </span>
              {role && <span className="mj-seat-role">{role}</span>}
            </button>
          );
        })}
        <div className="mj-center">
          <button
            className={`mj-center-btn ${resultType === 'selfDraw' ? 'active' : ''}`}
            disabled={!winnerId || resultType === 'draw'}
            onClick={handleSelfDraw}
          >
            自摸
          </button>
          <button
            className={`mj-center-btn draw ${resultType === 'draw' ? 'active' : ''}`}
            onClick={handleDraw}
          >
            流局
          </button>
        </div>
      </div>

      <div className="mj-rotate-bar">
        <label>
          我是
          <select value={mySeat >= 0 ? me! : ''} onChange={e => changeMe(e.target.value)}>
            <option value="">未設定</option>
            {seats.map(pid => <option key={pid} value={pid}>{getPlayerName(pid)}</option>)}
          </select>
        </label>
        {mySeat >= 0 ? (
          <span>自動轉到下方（{bottomWind}家）</span>
        ) : (
          <>
            <button className="btn-icon-sm" onClick={() => rotate(-1)} aria-label="桌位逆時針轉">⟲</button>
            <span>下方是{bottomWind}家</span>
            <button className="btn-icon-sm" onClick={() => rotate(1)} aria-label="桌位順時針轉">⟳</button>
          </>
        )}
      </div>

      {hint && <p className="recorder-hint">{hint}</p>}

      {needsTai && (
        <div className="tai-section">
          <div className="tai-label-row">
            <label>台數 {isCritical && <span className="critical-badge">大牌</span>}</label>
            <button className="btn-link btn-calc" onClick={() => setShowCalc(true)}>用計算表算</button>
          </div>
          {taiNote && <p className="tai-note">{taiNote}</p>}
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
          <button
            className={`leopard-toggle ${multiplier > 1 ? 'active' : ''}`}
            onClick={toggleLeopard}
            title="三顆骰子點數一樣：整筆金額（含底、莊家台）乘倍率"
          >
            🎲 骰規豹子 ×{multiplier > 1 ? multiplier : leopardMultiplier()}
          </button>
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

      {showCalc && (
        <TaiCalculator
          resultType={resultType}
          leopard={multiplier > 1}
          onApply={handleCalcApply}
          onClose={() => setShowCalc(false)}
        />
      )}
    </div>
  );
}
