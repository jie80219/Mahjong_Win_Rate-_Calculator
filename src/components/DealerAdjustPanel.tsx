import { useState, useCallback, useRef } from 'react';
import type { TableSession, DealerState } from '../types';
import { getPlayerName } from '../db/players';

const WINDS = ['東', '南', '西', '北'] as const;

interface Props {
  session: TableSession;
  dealerState: DealerState;
  onApply: (seatOrder: [string, string, string, string], dealerIndex: number, consecutive: number) => void;
}

export default function DealerAdjustPanel({ session, dealerState, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const seatOrder = session.seatOrder!;
  const currentIdx = seatOrder.indexOf(dealerState.dealerId);

  const [order, setOrder] = useState<string[]>([...seatOrder]);
  const [selectedIdx, setSelectedIdx] = useState(currentIdx);
  const [consecutive, setConsecutive] = useState(dealerState.consecutive);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);

  const handleOpen = useCallback(() => {
    const so = [...seatOrder];
    setOrder(so);
    setSelectedIdx(so.indexOf(dealerState.dealerId));
    setConsecutive(dealerState.consecutive);
    setOpen(true);
  }, [seatOrder, dealerState]);

  const swapItems = useCallback((fromIdx: number, toIdx: number) => {
    setOrder(prev => {
      const next = [...prev];
      const [removed] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, removed);
      if (selectedIdx === fromIdx) setSelectedIdx(toIdx);
      else if (fromIdx < toIdx && selectedIdx > fromIdx && selectedIdx <= toIdx) setSelectedIdx(selectedIdx - 1);
      else if (fromIdx > toIdx && selectedIdx >= toIdx && selectedIdx < fromIdx) setSelectedIdx(selectedIdx + 1);
      return next;
    });
  }, [selectedIdx]);

  const handleDragStart = useCallback((idx: number) => {
    dragItem.current = idx;
  }, []);

  const handleDragEnter = useCallback((idx: number) => {
    dragOverItem.current = idx;
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      swapItems(dragItem.current, dragOverItem.current);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  }, [swapItems]);

  const handleTouchStart = useCallback((idx: number, e: React.TouchEvent) => {
    dragItem.current = idx;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragItem.current === null || !listRef.current) return;
    const touchY = e.touches[0].clientY;
    const items = listRef.current.querySelectorAll('.seat-drag-item');
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      if (touchY >= rect.top && touchY <= rect.bottom) {
        dragOverItem.current = i;
        break;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  const moveUp = useCallback((idx: number) => {
    if (idx <= 0) return;
    swapItems(idx, idx - 1);
  }, [swapItems]);

  const handleApply = useCallback(() => {
    onApply(order as [string, string, string, string], selectedIdx, consecutive);
    setOpen(false);
  }, [order, selectedIdx, consecutive, onApply]);

  if (!open) {
    return (
      <button className="btn-link dealer-adjust-toggle" onClick={handleOpen}>
        調整
      </button>
    );
  }

  return (
    <div className="dealer-adjust-panel">
      <label className="dealer-adjust-label">座位順序（拖曳排列）</label>
      <div className="seat-drag-list" ref={listRef}>
        {order.map((pid, i) => (
          <div
            key={pid}
            className={`seat-drag-item ${selectedIdx === i ? 'dealer-selected' : ''}`}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragEnter={() => handleDragEnter(i)}
            onDragEnd={handleDragEnd}
            onDragOver={e => e.preventDefault()}
            onTouchStart={e => handleTouchStart(i, e)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <span className="seat-drag-wind">{WINDS[i]}</span>
            <span className="seat-drag-name">{getPlayerName(pid)}</span>
            <div className="seat-drag-actions">
              {i > 0 && <button className="btn-icon-sm" onClick={() => moveUp(i)}>↑</button>}
              {i < 3 && <button className="btn-icon-sm" onClick={() => moveUp(i + 1)}>↓</button>}
            </div>
            <span className="seat-drag-handle">⠿</span>
          </div>
        ))}
      </div>

      <label className="dealer-adjust-label">莊家</label>
      <div className="dealer-adjust-players">
        {order.map((pid, i) => (
          <button
            key={pid}
            className={`dealer-adjust-btn ${selectedIdx === i ? 'active' : ''}`}
            onClick={() => setSelectedIdx(i)}
          >
            {getPlayerName(pid)}
          </button>
        ))}
      </div>

      <label className="dealer-adjust-label">連莊數</label>
      <div className="dealer-adjust-consecutive">
        <button
          className="tai-adjust"
          onClick={() => setConsecutive(Math.max(0, consecutive - 1))}
        >
          −
        </button>
        <span className="custom-tai-value">{consecutive}</span>
        <button
          className="tai-adjust"
          onClick={() => setConsecutive(consecutive + 1)}
        >
          +
        </button>
      </div>

      <div className="dealer-adjust-actions">
        <button className="btn-primary btn-sm" onClick={handleApply}>套用</button>
        <button className="btn-secondary btn-sm" onClick={() => setOpen(false)}>取消</button>
      </div>
    </div>
  );
}
