import type { RoundMoney } from '../../utils/money';
import { formatMoney } from '../../utils/money';
import { getPlayerName } from '../../db/players';

interface Props {
  roundsMoney: RoundMoney[];
  playerIds: string[];
}

export default function MoneyDetailCards({ roundsMoney, playerIds }: Props) {
  const nonZeroRounds = roundsMoney.filter(rm =>
    Object.values(rm.amounts).some(a => a !== 0)
  );

  if (nonZeroRounds.length === 0) return null;

  return (
    <div className="money-detail-section">
      <h4 className="money-detail-title">每局金額明細</h4>
      <div className="money-detail-list">
        {nonZeroRounds.map(rm => (
          <div key={rm.roundId} className="money-detail-card">
            <div className="money-detail-seq">第 {rm.sequence} 局</div>
            <div className="money-detail-amounts">
              {playerIds.map(pid => {
                const amount = rm.amounts[pid] ?? 0;
                if (amount === 0) return null;
                return (
                  <span key={pid} className={`money-detail-item ${amount > 0 ? 'positive' : 'negative'}`}>
                    {getPlayerName(pid)} {formatMoney(amount)}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
