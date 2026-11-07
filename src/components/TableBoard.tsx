import { useCallback, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type { DealerState, Round, TableSession } from '../types';
import { getPlayerName } from '../db/players';
import { computeAllRoundsMoney, computeCumulativeMoney, computeRoundMoney, formatMoney } from '../utils/money';
import { nowISO } from '../utils/id';

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

  const totals = useMemo(
    () => computeCumulativeMoney(computeAllRoundsMoney(rounds, session), [...session.playerIds]),
    [rounds, session],
  );

  const dealerIndex = dealerState ? seats.indexOf(dealerState.dealerId) : -1;

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
              <strong>{dealerState.wind}圈 第 {dealerState.windRound} 局</strong>
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
          const windIndex = dealerIndex >= 0 ? (i - dealerIndex + 4) % 4 : i;
          const state = [
            payerId === pid || drag?.from === pid && drag.active ? 'is-payer' : '',
            drag?.overId === pid ? 'is-target' : '',
            selfDrawMode ? 'is-pickable' : '',
          ].join(' ');
          return (
            <div key={pid} className={`seat seat-${SEAT_POSITIONS[i]}`}>
              <button
                type="button"
                data-seat={pid}
                className={`seat-tile ${state}`}
                aria-label={`${getPlayerName(pid)}，${SEAT_WINDS[windIndex]}家${isDealer ? '，莊家' : ''}，累計 ${formatMoney(amount)}`}
                onClick={() => handleSeatClick(pid)}
                onPointerDown={e => handlePointerDown(pid, e)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => setDrag(null)}
              >
                <span className="seat-wind">{SEAT_WINDS[windIndex]}</span>
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
          onConfirm={async (tai) => {
            await onSave({
              tableSessionId: session.id,
              playedAt: nowISO(),
              resultType: settlement.type,
              winnerId: settlement.type === 'draw' ? null : settlement.winnerId,
              discarderId: settlement.type === 'discardWin' ? settlement.discarderId : null,
              tai,
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
  onConfirm: (tai: number | null) => Promise<void>;
}

function SettlementSheet({ settlement, session, dealerState, onCancel, onConfirm }: SheetProps) {
  const [tai, setTai] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const isDraw = settlement.type === 'draw';
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
      dealerId: dealerState?.dealerId ?? null,
      dealerConsecutive: dealerState?.consecutive ?? 0,
    }, session);
  }, [settlement, tai, session, dealerState]);

  const canConfirm = !saving && (isDraw || tai !== null);

  const confirm = async () => {
    setSaving(true);
    setFailed(false);
    try {
      await onConfirm(isDraw ? null : tai);
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
              {tai !== null && tai >= 5 && <span className="critical-badge">爆擊</span>}
            </div>
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
    </div>
  );
}
