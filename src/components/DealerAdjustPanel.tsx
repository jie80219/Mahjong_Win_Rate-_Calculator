import { useState, useCallback } from 'react';
import type { TableSession, DealerState } from '../types';
import { getPlayerName } from '../db/players';

interface Props {
  session: TableSession;
  dealerState: DealerState;
  onApply: (dealerIndex: number, consecutive: number) => void;
}

export default function DealerAdjustPanel({ session, dealerState, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const seatOrder = session.seatOrder!;
  const currentIdx = seatOrder.indexOf(dealerState.dealerId);

  const [selectedIdx, setSelectedIdx] = useState(currentIdx);
  const [consecutive, setConsecutive] = useState(dealerState.consecutive);

  const handleOpen = useCallback(() => {
    setSelectedIdx(seatOrder.indexOf(dealerState.dealerId));
    setConsecutive(dealerState.consecutive);
    setOpen(true);
  }, [seatOrder, dealerState]);

  const handleApply = useCallback(() => {
    onApply(selectedIdx, consecutive);
    setOpen(false);
  }, [selectedIdx, consecutive, onApply]);

  if (!open) {
    return (
      <button className="btn-link dealer-adjust-toggle" onClick={handleOpen}>
        調整
      </button>
    );
  }

  return (
    <div className="dealer-adjust-panel">
      <label className="dealer-adjust-label">莊家</label>
      <div className="dealer-adjust-players">
        {seatOrder.map((pid, i) => (
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
