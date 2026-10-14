import { useState } from 'react';
import type { ResultType } from '../types';
import {
  TAI_GROUPS, ALL_TAI_ITEMS, loadTaiOverrides, saveTaiOverrides, taiOf, sumTai, describeTai, toggleTaiItem, coveredBy,
} from '../utils/taiTable';

interface Props {
  resultType?: ResultType | null;
  onApply?: (tai: number, note: string) => void;
  onClose: () => void;
}

export default function TaiCalculator({ resultType, onApply, onClose }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    (resultType === 'selfDraw' ? { zimo: 1 } : {}) as Record<string, number>);
  const [extra, setExtra] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, number>>(loadTaiOverrides);
  const [editing, setEditing] = useState(false);

  const total = sumTai(counts, overrides, extra);
  const note = describeTai(counts);

  const toggle = (key: string) => setCounts(prev => toggleTaiItem(prev, key));

  const setOverride = (key: string, value: string) => {
    const item = ALL_TAI_ITEMS.find(i => i.key === key)!;
    const n = Number(value.replace(/[^0-9]/g, ''));
    setOverrides(prev => {
      const next = { ...prev };
      if (value === '' || n === item.tai) delete next[key];
      else next[key] = n;
      saveTaiOverrides(next);
      return next;
    });
  };

  const resetOverrides = () => {
    setOverrides({});
    saveTaiOverrides({});
  };

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="panel tai-calc" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <h3>台數計算表</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="tai-calc-toolbar">
          <span className="setup-hint">點選牌型加總台數；莊家、連莊台會自動另外計算</span>
          <button className="btn-link" onClick={() => setEditing(!editing)}>
            {editing ? '完成' : '自訂台數'}
          </button>
        </div>
        {editing && Object.keys(overrides).length > 0 && (
          <button className="btn-link tai-reset" onClick={resetOverrides}>恢復預設台數</button>
        )}

        {TAI_GROUPS.map(group => (
          <section key={group.title} className="tai-group">
            <h4>{group.title}</h4>
            <div className="tai-items">
              {group.items.map(item => {
                const count = counts[item.key] ?? 0;
                const value = taiOf(item, overrides);
                if (editing) {
                  return (
                    <label key={item.key} className="tai-item editing">
                      <span className="tai-item-name">{item.name}</span>
                      <input
                        className="tai-item-input"
                        inputMode="numeric"
                        value={String(value)}
                        onChange={e => setOverride(item.key, e.target.value)}
                      />
                      <span className="tai-item-unit">台</span>
                    </label>
                  );
                }
                const cover = coveredBy(counts, item.key);
                return (
                  <button
                    key={item.key}
                    className={`tai-item ${count > 0 ? 'active' : ''} ${cover ? 'covered' : ''}`}
                    onClick={() => toggle(item.key)}
                    disabled={!!cover}
                    title={item.desc}
                  >
                    <span className="tai-item-name">
                      {item.name}
                      {count > 1 && <span className="tai-item-count">×{count}</span>}
                    </span>
                    <span className="tai-item-tai">
                      {cover ? `已含在${cover.name}` : `${value} 台${item.max ? '／個' : ''}`}
                    </span>
                    <span className="tai-item-desc">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        {!editing && (
          <section className="tai-group">
            <h4>其他加減</h4>
            <div className="custom-tai">
              <button className="tai-adjust" onClick={() => setExtra(extra - 1)}>−</button>
              <span className="custom-tai-value">{extra > 0 ? `+${extra}` : extra}</span>
              <button className="tai-adjust" onClick={() => setExtra(extra + 1)}>+</button>
            </div>
          </section>
        )}

        <div className="tai-calc-footer">
          <div className="tai-calc-total">
            <div><span className="tai-calc-number">{total}</span> 台</div>
            {note && <span className="tai-calc-note">{note}</span>}
          </div>
          <div className="tai-calc-actions">
            <button className="btn-secondary btn-sm" onClick={() => { setCounts({}); setExtra(0); }}>清除</button>
            {onApply && (
              <button className="btn-primary btn-sm" onClick={() => onApply(total, note)}>
                套用 {total} 台
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
