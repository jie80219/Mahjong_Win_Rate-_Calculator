import { useCallback, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type { DealerState, Round, TableSession } from '../types';
import { getPlayerName } from '../db/players';
import { computeAllRoundsMoney, computeCumulativeMoney, computeRoundMoney, formatMoney } from '../utils/money';
import { gameName } from '../utils/dealer';
import { nowISO } from '../utils/id';
import { isCriticalTai } from '../utils/rules';
import { leopardMultiplier } from '../utils/taiTable';
import { loadMe, loadSeatRotation, saveMe, saveSeatRotation } from '../utils/preferences';
import TaiCalculator from './TaiCalculator';

const SEAT_WINDS = ['東', '南', '西', '北'];
const SEAT_POSITIONS = ['bottom', 'right', 'top', 'left'] as const;
const TAI_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const DRAG_THRESHOLD = 8;

type Settlement =
  | { type: 'selfDraw'; winnerId: string }
  | { type: 'discardWin'; winnerId: string; discarderId: string }
  | { type: 'draw' };

interface DragState {
  from: string;
  originX: number;
  originY: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  overId: string | null;
}

interface Props {
  session: TableSession;
  rounds: Round[];
  dealerState: DealerState | null;
  dealerControl: ReactNode;
  onSave: (data: Omit<Round, 'id' | 'createdAt' | 'updatedAt' | 'sequence'>) => Promise<void>;
  onOpenHistory: () => void;
  onLeave: () => void;
}

export default function TableBoard({ session, rounds, dealerState, dealerControl, onSave, onOpenHistory, onLeave }: Props) {
  const seats = session.seatOrder ?? session.playerIds;
  const [selfDrawMode, setSelfDrawMode] = useState(false);
  const [payerId, setPayerId] = useState<string | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const [manualRotation, setManualRotation] = useState(() => loadSeatRotation(session.id));
  const [me, setMe] = useState(loadMe);

  // 設定了「我是誰」且我在這桌：自動把我轉到下方；否則用手動轉的方向
  const mySeat = me ? seats.indexOf(me) : -1;
  const rotation = mySeat >= 0 ? (4 - mySeat) % 4 : manualRotation;
  const bottomWind = SEAT_WINDS[(4 - rotation) % 4];

  const changeMe = useCallback((pid: string) => {
    const next = pid || null;
    saveMe(next);
    setMe(next);
  }, []);

  const rotate = useCallback((step: number) => {
    setManualRotation(prev => {
      const next = (prev + step + 4) % 4;
      saveSeatRotation(session.id, next);
      return next;
    });
  }, [session.id]);

  const totals = useMemo(
    () => computeCumulativeMoney(computeAllRoundsMoney(rounds, session), [...session.playerIds]),
    [rounds, session],
  );

  const clearSelection = useCallback(() => {
    setSelfDrawMode(false);
    setPayerId(null);
  }, []);

  const openSettlement = useCallback((next: Settlement) => {
    clearSelection();
    setSettlement(next);
  }, [clearSelection]);

  const handleSeatClick = useCallback((pid: string) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (selfDrawMode) {
      openSettlement({ type: 'selfDraw', winnerId: pid });
    } else if (payerId === null) {
      setPayerId(pid);
    } else if (payerId === pid) {
      setPayerId(null);
    } else {
      openSettlement({ type: 'discardWin', winnerId: pid, discarderId: payerId });
    }
  }, [selfDrawMode, payerId, openSettlement]);

  const handlePointerDown = useCallback((pid: string, e: ReactPointerEvent<HTMLButtonElement>) => {
    suppressClick.current = false;
    if (selfDrawMode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = boardRef.current?.getBoundingClientRect();
    setDrag({
      from: pid,
      originX: rect?.left ?? 0,
      originY: rect?.top ?? 0,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      active: false,
      overId: null,
    });
  }, [selfDrawMode]);

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    const { clientX, clientY } = e;
    setDrag(prev => {
      if (!prev) return prev;
      const moved = Math.hypot(clientX - prev.startX, clientY - prev.startY) > DRAG_THRESHOLD;
      const target = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-seat]');
      const seat = target?.dataset.seat ?? null;
      return {
        ...prev,
        x: clientX,
        y: clientY,
        active: prev.active || moved,
        overId: seat && seat !== prev.from ? seat : null,
      };
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    if (drag?.active) {
      suppressClick.current = true;
      if (drag.overId) {
        openSettlement({ type: 'discardWin', winnerId: drag.overId, discarderId: drag.from });
      }
    }
    setDrag(null);
  }, [drag, openSettlement]);

  const dragLine = (() => {
    if (!drag?.active) return null;
    return {
      x1: drag.startX - drag.originX,
      y1: drag.startY - drag.originY,
      x2: drag.x - drag.originX,
      y2: drag.y - drag.originY,
    };
  })();

  const hint = (() => {
    if (selfDrawMode) return '點選自摸的玩家';
    if (payerId) return `${getPlayerName(payerId)} 放槍，再點胡牌的玩家`;
    return '把放槍者拖到胡牌者身上，或依序點兩人';
  })();

  return (
    <section className="board-section" aria-label="牌桌">
      <div className="board-head">
        <div>
          <p className="board-stakes">底 {session.baseMoney ?? 0} ／ 台 {session.taiMoney ?? 0}</p>
          <p className="board-round-count">已記錄 {rounds.length} 局</p>
        </div>
        <button className="btn-secondary btn-sm" onClick={onLeave}>離開此桌</button>
      </div>

      <div className="board" ref={boardRef}>
        <div className="board-center">
          {dealerState ? (
            <>
              <strong>
                {dealerState.jiang > 1 && `${gameName(session, dealerState.jiang)} `}
                {dealerState.wind}風{'東南西北'[dealerState.windRound - 1]}
              </strong>
              <span>
                {getPlayerName(dealerState.dealerId)} 坐莊
                {dealerState.consecutive > 0 && `・連 ${dealerState.consecutive}`}
              </span>
            </>
          ) : (
            <strong>本桌未設定莊家</strong>
          )}
        </div>

        {seats.map((pid, i) => {
          const amount = totals[pid] ?? 0;
          const isDealer = dealerState?.dealerId === pid;
          const state = [
            payerId === pid || drag?.from === pid && drag.active ? 'is-payer' : '',
            drag?.overId === pid ? 'is-target' : '',
            selfDrawMode ? 'is-pickable' : '',
          ].join(' ');
          return (
            <div key={pid} className={`seat seat-${SEAT_POSITIONS[(i + rotation) % 4]}`}>
              <button
                type="button"
                data-seat={pid}
                className={`seat-tile ${state}`}
                aria-label={`${getPlayerName(pid)}，${SEAT_WINDS[i]}家${isDealer ? '，莊家' : ''}，累計 ${formatMoney(amount)}`}
                onClick={() => handleSeatClick(pid)}
                onPointerDown={e => handlePointerDown(pid, e)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => setDrag(null)}
              >
                <span className="seat-wind">{SEAT_WINDS[i]}</span>
                <span className="seat-name">{getPlayerName(pid)}</span>
                {isDealer && <span className="seat-dealer">莊</span>}
              </button>
              <span className={`seat-money ${amount > 0 ? 'gain' : amount < 0 ? 'loss' : ''}`}>
                {formatMoney(amount)}
              </span>
            </div>
          );
        })}

        {dragLine && (
          <svg className="board-drag-layer" aria-hidden="true">
            <line {...dragLine} />
            <circle cx={dragLine.x2} cy={dragLine.y2} r="6" />
          </svg>
        )}
      </div>

      <p className="board-hint" aria-live="polite">{hint}</p>

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

      <div className="board-actions">
        <button
          className={`board-action board-action-main ${selfDrawMode ? 'is-on' : ''}`}
          aria-pressed={selfDrawMode}
          onClick={() => { setPayerId(null); setSelfDrawMode(on => !on); }}
        >
          {selfDrawMode ? '取消自摸' : '自摸'}
        </button>
        <button className="board-action" onClick={() => openSettlement({ type: 'draw' })}>流局</button>
        <button className="board-action" onClick={onOpenHistory}>牌局紀錄</button>
      </div>

      {dealerState && <div className="board-tools">{dealerControl}</div>}

      {settlement && (
        <SettlementSheet
          settlement={settlement}
          session={session}
          dealerState={dealerState}
          onCancel={() => setSettlement(null)}
          onConfirm={async (tai, taiNote, multiplier) => {
            await onSave({
              tableSessionId: session.id,
              playedAt: nowISO(),
              resultType: settlement.type,
              winnerId: settlement.type === 'draw' ? null : settlement.winnerId,
              discarderId: settlement.type === 'discardWin' ? settlement.discarderId : null,
              tai,
              taiNote: settlement.type !== 'draw' && taiNote ? taiNote : undefined,
              multiplier: settlement.type !== 'draw' && multiplier > 1 ? multiplier : undefined,
            });
            setSettlement(null);
          }}
        />
      )}
    </section>
  );
}

interface SheetProps {
  settlement: Settlement;
  session: TableSession;
  dealerState: DealerState | null;
  onCancel: () => void;
  onConfirm: (tai: number | null, taiNote: string, multiplier: number) => Promise<void>;
}

function SettlementSheet({ settlement, session, dealerState, onCancel, onConfirm }: SheetProps) {
  const [tai, setTaiValue] = useState<number | null>(null);
  const [taiNote, setTaiNote] = useState('');
  const [multiplier, setMultiplier] = useState(1);
  const [showCalc, setShowCalc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const isDraw = settlement.type === 'draw';
  // 手動改台數時，計算表帶來的牌型說明就不再準確
  const setTai = (value: number | null | ((prev: number | null) => number | null)) => {
    setTaiValue(value);
    setTaiNote('');
  };
  const isCustom = tai !== null && tai >= 10;

  const title = (() => {
    if (settlement.type === 'draw') return '這局流局';
    if (settlement.type === 'selfDraw') return `${getPlayerName(settlement.winnerId)} 自摸`;
    return `${getPlayerName(settlement.discarderId)} 放槍給 ${getPlayerName(settlement.winnerId)}`;
  })();

  const preview = useMemo(() => {
    if (settlement.type === 'draw' || tai === null) return null;
    return computeRoundMoney({
      id: 'preview',
      tableSessionId: session.id,
      sequence: 0,
      playedAt: '',
      createdAt: '',
      updatedAt: '',
      resultType: settlement.type,
      winnerId: settlement.winnerId,
      discarderId: settlement.type === 'discardWin' ? settlement.discarderId : null,
      tai,
      multiplier: multiplier > 1 ? multiplier : undefined,
      dealerId: dealerState?.dealerId ?? null,
      dealerConsecutive: dealerState?.consecutive ?? 0,
    }, session);
  }, [settlement, tai, multiplier, session, dealerState]);

  const canConfirm = !saving && (isDraw || tai !== null);

  const confirm = async () => {
    setSaving(true);
    setFailed(false);
    try {
      await onConfirm(isDraw ? null : tai, taiNote, multiplier);
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="sheet-title">{title}</h3>

        {isDraw ? (
          <p className="sheet-note">流局不計金額，也不計入有效局。</p>
        ) : (
          <>
            <div className="sheet-label">
              <span>台數</span>
              {isCriticalTai(tai) && <span className="critical-badge">大牌</span>}
              <button className="btn-link btn-calc sheet-calc" onClick={() => setShowCalc(true)}>用計算表算</button>
            </div>
            {taiNote && <p className="tai-note">{taiNote}</p>}
            <div className="tai-pad">
              {TAI_OPTIONS.map(t => (
                <button
                  key={t}
                  className={`tai-key ${tai === t ? 'active' : ''}`}
                  aria-pressed={tai === t}
                  onClick={() => setTai(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="tai-more">
              <button
                className="tai-step"
                aria-label="減少台數"
                disabled={!isCustom}
                onClick={() => setTai(v => Math.max(10, (v ?? 10) - 1))}
              >
                −
              </button>
              <button className={`tai-key tai-key-wide ${isCustom ? 'active' : ''}`} onClick={() => setTai(v => (v !== null && v >= 10 ? v : 10))}>
                {isCustom ? `${tai} 台` : '10 台以上'}
              </button>
              <button
                className="tai-step"
                aria-label="增加台數"
                onClick={() => setTai(v => (v !== null && v >= 10 ? v + 1 : 10))}
              >
                +
              </button>
            </div>

            <button
              className={`leopard-toggle ${multiplier > 1 ? 'active' : ''}`}
              aria-pressed={multiplier > 1}
              onClick={() => setMultiplier(m => (m > 1 ? 1 : leopardMultiplier()))}
              title="三顆骰子點數一樣：整筆金額（含底、莊家台）乘倍率"
            >
              🎲 骰規豹子 ×{multiplier > 1 ? multiplier : leopardMultiplier()}
            </button>

            {preview && (
              <ul className="sheet-preview">
                {(session.seatOrder ?? session.playerIds).map(pid => {
                  const amount = preview.amounts[pid] ?? 0;
                  return (
                    <li key={pid}>
                      <span>{getPlayerName(pid)}</span>
                      <b className={amount > 0 ? 'gain' : amount < 0 ? 'loss' : ''}>{formatMoney(amount)}</b>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {failed && <p className="sheet-error" role="alert">儲存失敗，請再試一次。</p>}

        <div className="sheet-actions">
          <button className="btn-secondary" onClick={onCancel}>取消</button>
          <button className="btn-primary" disabled={!canConfirm} onClick={confirm}>
            {saving ? '儲存中…' : '記下這局'}
          </button>
        </div>
      </div>

      {showCalc && (
        <div onClick={e => e.stopPropagation()}>
          <TaiCalculator
            resultType={settlement.type}
            leopard={multiplier > 1}
            onApply={(t, note, m) => {
              setTaiValue(t);
              setTaiNote(note);
              setMultiplier(m);
              setShowCalc(false);
            }}
            onClose={() => setShowCalc(false)}
          />
        </div>
      )}
    </div>
  );
}
