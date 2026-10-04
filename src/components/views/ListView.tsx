import { useState, useMemo } from 'react';
import type { ComputedStats } from '../../types';
import { formatRate } from '../../utils/stats';

interface Props {
  stats: ComputedStats[];
  onOpenHistory: (filter?: { playerId?: string; metric?: string }) => void;
}

type SortKey = 'name' | 'selfDraw' | 'win' | 'discard' | 'beDrawn' | 'critical' | 'beCritical' | 'total';

export default function ListView({ stats, onOpenHistory }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === 'name');
    }
  };

  const sorted = useMemo(() => {
    const arr = [...stats];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.displayName.localeCompare(b.displayName, 'zh-TW'); break;
        case 'selfDraw': cmp = (a.selfDrawRate ?? -1) - (b.selfDrawRate ?? -1); break;
        case 'win': cmp = (a.winRate ?? -1) - (b.winRate ?? -1); break;
        case 'discard': cmp = (a.discardRate ?? -1) - (b.discardRate ?? -1); break;
        case 'beDrawn': cmp = (a.beDrawnRate ?? -1) - (b.beDrawnRate ?? -1); break;
        case 'critical': cmp = (a.criticalRate ?? -1) - (b.criticalRate ?? -1); break;
        case 'beCritical': cmp = (a.beCriticalRate ?? -1) - (b.beCriticalRate ?? -1); break;
        case 'total': cmp = a.total - b.total; break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [stats, sortKey, sortAsc]);

  const sortIcon = (key: SortKey) => {
    if (key !== sortKey) return '';
    return sortAsc ? ' ↑' : ' ↓';
  };

  return (
    <div className="list-view-wrapper">
      <div className="list-view">
        <table>
          <thead>
            <tr>
              <th className="sticky-col" onClick={() => handleSort('name')}>玩家{sortIcon('name')}</th>
              <th onClick={() => handleSort('selfDraw')}>自摸率{sortIcon('selfDraw')}</th>
              <th onClick={() => handleSort('win')}>胡牌率{sortIcon('win')}</th>
              <th onClick={() => handleSort('discard')}>放槍率{sortIcon('discard')}</th>
              <th onClick={() => handleSort('beDrawn')}>被摸率{sortIcon('beDrawn')}</th>
              <th onClick={() => handleSort('critical')}>爆擊率{sortIcon('critical')}</th>
              <th onClick={() => handleSort('beCritical')}>被爆率{sortIcon('beCritical')}</th>
              <th onClick={() => handleSort('total')}>局數{sortIcon('total')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(s => (
              <tr key={s.playerId}>
                <td className="sticky-col player-name">{s.displayName}</td>
                <td onClick={() => onOpenHistory({ playerId: s.playerId, metric: 'selfDraw' })} className="clickable">{formatRate(s.selfDrawRate)}</td>
                <td onClick={() => onOpenHistory({ playerId: s.playerId, metric: 'win' })} className="clickable">{formatRate(s.winRate)}</td>
                <td onClick={() => onOpenHistory({ playerId: s.playerId, metric: 'discard' })} className="clickable">{formatRate(s.discardRate)}</td>
                <td onClick={() => onOpenHistory({ playerId: s.playerId, metric: 'beDrawn' })} className="clickable">{formatRate(s.beDrawnRate)}</td>
                <td onClick={() => onOpenHistory({ playerId: s.playerId, metric: 'critical' })} className="clickable">{formatRate(s.criticalRate)}</td>
                <td onClick={() => onOpenHistory({ playerId: s.playerId, metric: 'beCritical' })} className="clickable">{formatRate(s.beCriticalRate)}</td>
                <td>{s.total}（{s.effective}/{s.draws}）</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
