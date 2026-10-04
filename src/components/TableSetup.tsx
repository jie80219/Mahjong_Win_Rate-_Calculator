import { useState, useCallback } from 'react';
import type { TableSession } from '../types';
import { PLAYERS, getPlayerName } from '../db/players';
import { loadLastTable } from '../utils/preferences';

interface StartTableArgs {
  playerIds: [string, string, string, string];
  seatOrder: [string, string, string, string];
  initialDealerIndex: number;
  baseMoney: number;
  taiMoney: number;
}

interface Props {
  sessions: TableSession[];
  onStartTable: (args: StartTableArgs) => void;
  onResumeSession: (session: TableSession) => void;
}

type Step = 'select' | 'seat';

export default function TableSetup({ sessions, onStartTable, onResumeSession }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [step, setStep] = useState<Step>('select');
  const [seatOrder, setSeatOrder] = useState<string[]>([]);
  const [dealerIndex, setDealerIndex] = useState<number>(0);
  const [baseMoneyStr, setBaseMoneyStr] = useState('100');
  const [taiMoneyStr, setTaiMoneyStr] = useState('100');
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

  const goToSeatStep = useCallback(() => {
    setSeatOrder([...selected]);
    setDealerIndex(0);
    setStep('seat');
  }, [selected]);

  const seatMoveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setSeatOrder(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      if (dealerIndex === index) setDealerIndex(index - 1);
      else if (dealerIndex === index - 1) setDealerIndex(index);
      return next;
    });
  }, [dealerIndex]);

  const handleConfirmStart = useCallback(() => {
    onStartTable({
      playerIds: selected as [string, string, string, string],
      seatOrder: seatOrder as [string, string, string, string],
      initialDealerIndex: dealerIndex,
      baseMoney: Math.max(0, Number(baseMoneyStr) || 0),
      taiMoney: Math.max(0, Number(taiMoneyStr) || 0),
    });
  }, [selected, seatOrder, dealerIndex, baseMoneyStr, taiMoneyStr, onStartTable]);

  if (step === 'seat') {
    return (
      <div className="table-setup">
        <h2>設定座位順序與莊家</h2>
        <p className="setup-hint">調整輪轉順序，並選擇起始莊家</p>

        <div className="seat-slots">
          {seatOrder.map((pid, i) => (
            <div
              key={pid}
              className={`seat-slot filled ${dealerIndex === i ? 'dealer' : ''}`}
              onClick={() => setDealerIndex(i)}
            >
              <div className="seat-content">
                <span>
                  {dealerIndex === i && <span className="dealer-badge">莊</span>}
                  {getPlayerName(pid)}
                </span>
                <div className="seat-actions">
                  {i > 0 && <button className="btn-icon-sm" onClick={(e) => { e.stopPropagation(); seatMoveUp(i); }} title="上移">↑</button>}
                  {i < 3 && <button className="btn-icon-sm" onClick={(e) => { e.stopPropagation(); seatMoveUp(i + 1); }} title="下移">↓</button>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="setup-hint">點擊玩家選為莊家，用箭頭調整順序</p>

        <div className="money-settings">
          <h3>金額設定</h3>
          <div className="money-row">
            <label className="money-label">底</label>
            <input
              type="text"
              inputMode="numeric"
              className="money-input"
              value={baseMoneyStr}
              onChange={e => setBaseMoneyStr(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
          <div className="money-row">
            <label className="money-label">台錢</label>
            <input
              type="text"
              inputMode="numeric"
              className="money-input"
              value={taiMoneyStr}
              onChange={e => setTaiMoneyStr(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
        </div>

        <div className="recorder-actions">
          <button className="btn-primary btn-block" onClick={handleConfirmStart}>
            開始牌桌
          </button>
          <button className="btn-secondary btn-block" onClick={() => setStep('select')}>
            返回選人
          </button>
        </div>
      </div>
    );
  }

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
        onClick={goToSeatStep}
      >
        {canStart ? '下一步：設定莊家' : `還需選 ${4 - selected.length} 人`}
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
