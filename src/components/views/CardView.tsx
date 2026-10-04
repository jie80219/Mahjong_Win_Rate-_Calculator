import type { ComputedStats } from '../../types';
import { formatRate } from '../../utils/stats';

interface Props {
  stats: ComputedStats[];
  onOpenHistory: (filter?: { playerId?: string; metric?: string }) => void;
}

export default function CardView({ stats, onOpenHistory }: Props) {
  return (
    <div className="card-grid">
      {stats.map(s => (
        <div key={s.playerId} className="stat-card">
          <div className="card-header">
            <h4>{s.displayName}</h4>
            <span className="card-rounds">
              {s.total} 局（有效 {s.effective}・流局 {s.draws}）
            </span>
          </div>
          <div className="card-stats">
            <div className="card-stat" onClick={() => onOpenHistory({ playerId: s.playerId, metric: 'selfDraw' })}>
              <span className="stat-label">自摸率</span>
              <span className="stat-value">{formatRate(s.selfDrawRate)}</span>
              <span className="stat-detail">{s.selfDraws}/{s.effective}</span>
            </div>
            <div className="card-stat" onClick={() => onOpenHistory({ playerId: s.playerId, metric: 'win' })}>
              <span className="stat-label">胡牌率</span>
              <span className="stat-value">{formatRate(s.winRate)}</span>
              <span className="stat-detail">{s.selfDraws + s.ronWins}/{s.effective}</span>
            </div>
            <div className="card-stat" onClick={() => onOpenHistory({ playerId: s.playerId, metric: 'discard' })}>
              <span className="stat-label">放槍率</span>
              <span className="stat-value">{formatRate(s.discardRate)}</span>
              <span className="stat-detail">{s.discards}/{s.effective}</span>
            </div>
            <div className="card-stat" onClick={() => onOpenHistory({ playerId: s.playerId, metric: 'beDrawn' })}>
              <span className="stat-label">被摸率</span>
              <span className="stat-value">{formatRate(s.beDrawnRate)}</span>
              <span className="stat-detail">{s.beDrawn}/{s.effective}</span>
            </div>
            <div className="card-stat" onClick={() => onOpenHistory({ playerId: s.playerId, metric: 'critical' })}>
              <span className="stat-label">爆擊率</span>
              <span className="stat-value">{formatRate(s.criticalRate)}</span>
              <span className="stat-detail">{s.criticals}/{s.effective}</span>
            </div>
            <div className="card-stat" onClick={() => onOpenHistory({ playerId: s.playerId, metric: 'beCritical' })}>
              <span className="stat-label">被爆率</span>
              <span className="stat-value">{formatRate(s.beCriticalRate)}</span>
              <span className="stat-detail">{s.beCriticals}/{s.effective}</span>
            </div>
          </div>
          {s.criticalInWinRate !== null && (
            <div className="card-extra">
              胡牌中的爆擊占比：{formatRate(s.criticalInWinRate)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
