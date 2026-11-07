import { useState } from 'react';
import type { ResultType } from '../types';
import {
  TAI_GROUPS, loadTaiOverrides, saveTaiOverrides, taiOf, sumTai, describeTai, toggleTaiItem, coveredBy,
  multiplierOf, loadCustomTaiItems, saveCustomTaiItems, newCustomTaiItem, loadHiddenTaiKeys, saveHiddenTaiKeys,
  type TaiItem,
} from '../utils/taiTable';

interface Props {
  resultType?: ResultType | null;
  /** 記錄頁目前是否已勾豹子，打開計算表時帶入 */
  leopard?: boolean;
  onApply?: (tai: number, note: string, multiplier: number) => void;
  onClose: () => void;
}

export default function TaiCalculator({ resultType, leopard, onApply, onClose }: Props) {
  const [hidden, setHidden] = useState<string[]>(loadHiddenTaiKeys);
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    if (resultType === 'selfDraw' && !hidden.includes('zimo')) init.zimo = 1;
    if (leopard) init.leopard = 1;
    return init;
  });
  const [extra, setExtra] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, number>>(loadTaiOverrides);
  const [custom, setCustom] = useState<TaiItem[]>(loadCustomTaiItems);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('1');
  const [newIsMultiplier, setNewIsMultiplier] = useState(false);

  const groups = custom.length ? [...TAI_GROUPS, { title: '自訂', items: custom }] : TAI_GROUPS;
  const total = sumTai(counts, overrides, extra);
  const note = describeTai(counts);
  const multiplier = multiplierOf(counts, overrides);

  const toggle = (key: string) => setCounts(prev => toggleTaiItem(prev, key));

  const updateCustom = (items: TaiItem[]) => {
    saveCustomTaiItems(items);
    setCustom(loadCustomTaiItems());
  };

  const setValue = (item: TaiItem, value: string) => {
    const n = Number(value.replace(/[^0-9]/g, ''));
    if (item.key.startsWith('c_')) {
      updateCustom(loadCustomTaiItems().map(i => (i.key === item.key ? { ...i, tai: n } : i)));
      return;
    }
    setOverrides(prev => {
      const next = { ...prev };
      if (value === '' || n === item.tai) delete next[item.key];
      else next[item.key] = n;
      saveTaiOverrides(next);
      return next;
    });
  };

  const toggleHidden = (key: string) => {
    const next = hidden.includes(key) ? hidden.filter(k => k !== key) : [...hidden, key];
    saveHiddenTaiKeys(next);
    setHidden(next);
    if (!hidden.includes(key)) setCounts(prev => ({ ...prev, [key]: 0 }));
  };

  const removeCustom = (key: string) => {
    updateCustom(loadCustomTaiItems().filter(i => i.key !== key));
    setCounts(prev => ({ ...prev, [key]: 0 }));
  };

  const addCustom = () => {
    if (!newName.trim()) return;
    updateCustom([...loadCustomTaiItems(), newCustomTaiItem(newName, Number(newValue), newIsMultiplier)]);
    setNewName('');
    setNewValue('1');
    setNewIsMultiplier(false);
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
          <span className="setup-hint">
            {editing
              ? '改台數、隱藏不用的牌型，或在最下面新增家規牌型'
              : '點選牌型加總台數；莊家、連莊台會自動另外計算'}
          </span>
          <button className="btn-link" onClick={() => setEditing(!editing)}>
            {editing ? '完成' : '自訂'}
          </button>
        </div>
        {editing && Object.keys(overrides).length > 0 && (
          <button className="btn-link tai-reset" onClick={resetOverrides}>恢復預設台數</button>
        )}

        {groups.map(group => {
          const items = editing ? group.items : group.items.filter(i => !hidden.includes(i.key));
          if (items.length === 0) return null;
          return (
            <section key={group.title} className="tai-group">
              <h4>{group.title}</h4>
              <div className="tai-items">
                {items.map(item => {
                  const count = counts[item.key] ?? 0;
                  const value = taiOf(item, overrides);
                  const isCustom = item.key.startsWith('c_');
                  if (editing) {
                    const isHidden = hidden.includes(item.key);
                    return (
                      <div key={item.key} className={`tai-item editing ${isHidden ? 'is-hidden' : ''}`}>
                        <span className="tai-item-name">{item.name}</span>
                        <input
                          className="tai-item-input"
                          inputMode="numeric"
                          value={String(value)}
                          onChange={e => setValue(item, e.target.value)}
                        />
                        <span className="tai-item-unit">{item.multiplier ? '倍' : '台'}</span>
                        {isCustom ? (
                          <button className="btn-link tai-item-action danger" onClick={() => removeCustom(item.key)}>刪除</button>
                        ) : (
                          <button className="btn-link tai-item-action" onClick={() => toggleHidden(item.key)}>
                            {isHidden ? '顯示' : '隱藏'}
                          </button>
                        )}
                      </div>
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
                        {cover
                          ? `已含在${cover.name}`
                          : item.multiplier ? `金額 ×${value}` : `${value} 台${item.max ? '／個' : ''}`}
                      </span>
                      <span className="tai-item-desc">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        {editing && (
          <section className="tai-group">
            <h4>新增牌型</h4>
            <div className="tai-add">
              <input
                className="tai-add-name"
                placeholder="名稱，例如：花胡"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
              <input
                className="tai-item-input"
                inputMode="numeric"
                value={newValue}
                onChange={e => setNewValue(e.target.value.replace(/[^0-9]/g, ''))}
              />
              <div className="tai-add-unit">
                <button className={`date-btn ${!newIsMultiplier ? 'active' : ''}`} onClick={() => setNewIsMultiplier(false)}>台</button>
                <button className={`date-btn ${newIsMultiplier ? 'active' : ''}`} onClick={() => setNewIsMultiplier(true)}>倍</button>
              </div>
              <button className="btn-primary btn-sm" onClick={addCustom} disabled={!newName.trim()}>新增</button>
            </div>
            <p className="setup-hint">「台」會加進台數；「倍」是整筆金額乘倍率（像豹子）</p>
          </section>
        )}

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
            <div>
              <span className="tai-calc-number">{total}</span> 台
              {multiplier > 1 && <span className="leopard-badge">金額 ×{multiplier}</span>}
            </div>
            {note && <span className="tai-calc-note">{note}</span>}
          </div>
          <div className="tai-calc-actions">
            <button className="btn-secondary btn-sm" onClick={() => { setCounts({}); setExtra(0); }}>清除</button>
            {onApply && (
              <button className="btn-primary btn-sm" onClick={() => onApply(total, note, multiplier)}>
                套用 {total} 台{multiplier > 1 ? ` ×${multiplier}` : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
