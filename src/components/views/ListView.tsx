import { useState, useMemo } from 'react';
import type { ComputedStats } from '../../types';
import { formatRate, isLowSample } from '../../utils/stats';

interface Props {
  stats: ComputedStats[];
  onOpenHistory: (filter?: { playerId?: string; metric?: string }) => void;
}

type SortKey = 'name' | 'selfDraw' | 'win' | 'overallWin' | 'discard' | 'beDrawn' | 'critical' | 'beCritical' | 'drawRate' | 'total';

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
        case 'overallWin': cmp = (a.overallWinRate ?? -1) - (b.overallWinRate ?? -1); break;
        case 'discard': cmp = (a.discardRate ?? -1) - (b.discardRate ?? -1); break;
        case 'beDrawn': cmp = (a.beDrawnRate ?? -1) - (b.beDrawnRate ?? -1); break;
        case 'critical': cmp = (a.criticalRate ?? -1) - (b.criticalRate ?? -1); break;
        case 'beCritical': cmp = (a.beCriticalRate ?? -1) - (b.beCriticalRate ?? -1); break;
        case 'drawRate': cmp = (a.drawRate ?? -1) - (b.drawRate ?? -1); break;
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

  const ariaSort = (key: SortKey) =>
    key !== sortKey ? 'none' : sortAsc ? 'ascending' : 'descending';

  return (
    <div className="list-view-wrapper">
      <div className="list-view">
        <table>
          <thead>
            <tr>
              <th className="sticky-col" aria-sort={ariaSort('name')}><button type="button" className="th-btn" onClick={() => handleSort('name')}>玩家{sortIcon('name')}</button></th>
              <th aria-sort={ariaSort('selfDraw')}><button type="button" className="th-btn" onClick={() => handleSort('selfDraw')}>自摸率{sortIcon('selfDraw')}</button></th>
              <th aria-sort={ariaSort('win')}><button type="button" className="th-btn" onClick={() => handleSort('win')}>胡牌率{sortIcon('win')}</button></th>
              <th aria-sort={ariaSort('overallWin')}><button type="button" className="th-btn" onClick={() => handleSort('overallWin')}>勝率{sortIcon('overallWin')}</button></th>
              <th aria-sort={ariaSort('discard')}><button type="button" className="th-btn" onClick={() => handleSort('discard')}>放槍率{sortIcon('discard')}</button></th>
              <th aria-sort={ariaSort('beDrawn')}><button type="button" className="th-btn" onClick={() => handleSort('beDrawn')}>被摸率{sortIcon('beDrawn')}</button></th>
              <th aria-sort={ariaSort('critical')}><button type="button" className="th-btn" onClick={() => handleSort('critical')}>爆擊率{sortIcon('critical')}</button></th>
              <th aria-sort={ariaSort('beCritical')}><button type="button" className="th-btn" onClick={() => handleSort('beCritical')}>被爆率{sortIcon('beCritical')}</button></th>
              <th aria-sort={ariaSort('drawRate')}><button type="button" className="th-btn" onClick={() => handleSort('drawRate')}>流局率{sortIcon('drawRate')}</button></th>
              <th aria-sort={ariaSort('total')}><button type="button" className="th-btn" onClick={() => handleSort('total')}>局數{sortIcon('total')}</button></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(s => (
              <tr key={s.playerId} className={isLowSample(s) ? 'low-sample' : ''}>
                <td className="sticky-col player-name">
                  {s.displayName}
                  {isLowSample(s) && <span className="low-sample-badge">樣本少</span>}
                </td>
                <td className="clickable"><button type="button" className="cell-btn" onClick={() => onOpenHistory({ playerId: s.playerId, metric: 'selfDraw' })}>{formatRate(s.selfDrawRate)}</button></td>
                <td className="clickable"><button type="button" className="cell-btn" onClick={() => onOpenHistory({ playerId: s.playerId, metric: 'win' })}>{formatRate(s.winRate)}</button></td>
                <td className="clickable"><button type="button" className="cell-btn" onClick={() => onOpenHistory({ playerId: s.playerId, metric: 'overallWin' })}>{formatRate(s.overallWinRate)}</button></td>
                <td className="clickable"><button type="button" className="cell-btn" onClick={() => onOpenHistory({ playerId: s.playerId, metric: 'discard' })}>{formatRate(s.discardRate)}</button></td>
                <td className="clickable"><button type="button" className="cell-btn" onClick={() => onOpenHistory({ playerId: s.playerId, metric: 'beDrawn' })}>{formatRate(s.beDrawnRate)}</button></td>
                <td className="clickable"><button type="button" className="cell-btn" onClick={() => onOpenHistory({ playerId: s.playerId, metric: 'critical' })}>{formatRate(s.criticalRate)}</button></td>
                <td className="clickable"><button type="button" className="cell-btn" onClick={() => onOpenHistory({ playerId: s.playerId, metric: 'beCritical' })}>{formatRate(s.beCriticalRate)}</button></td>
                <td className="clickable"><button type="button" className="cell-btn" onClick={() => onOpenHistory({ playerId: s.playerId, metric: 'drawRate' })}>{formatRate(s.drawRate)}</button></td>
                <td>{s.total}（{s.effective}/{s.draws}）</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
