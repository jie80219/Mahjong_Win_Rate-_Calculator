import { useMemo, useState } from 'react';
import { findWaits, MAX_COPIES, requiredHandSize, SAMPLE_HAND, TILE_GROUPS, TILES } from '../utils/tenpai';
import type { TileDef } from '../utils/tenpai';

function TileFace({ tile }: { tile: TileDef }) {
  return (
    <>
      <span className="tile-top">{tile.top}</span>
      {tile.bottom && <span className="tile-bottom">{tile.bottom}</span>}
    </>
  );
}

export default function TenpaiView() {
  const [hand, setHand] = useState<number[]>([]);
  const [meldCount, setMeldCount] = useState(0);

  const needed = requiredHandSize(meldCount);
  const isComplete = hand.length === needed;
  const waits = useMemo(() => (isComplete ? findWaits(hand) : []), [hand, isComplete]);
  const sorted = useMemo(() => hand.map((t, slot) => ({ t, slot })).sort((a, b) => a.t - b.t), [hand]);

  const copies = (index: number) => hand.filter(t => t === index).length;

  const addTile = (index: number) => {
    if (hand.length < needed && copies(index) < MAX_COPIES) setHand(prev => [...prev, index]);
  };

  const removeSlot = (slot: number) => setHand(prev => prev.filter((_, i) => i !== slot));

  const changeMelds = (next: number) => {
    setMeldCount(next);
    setHand(prev => prev.slice(0, requiredHandSize(next)));
  };

  return (
    <div className="tenpai">
      <h2 className="page-title">聽牌計算機</h2>

      <section className="result-panel" aria-live="polite">
        {!isComplete && (
          <p className="result-waiting">再選 {needed - hand.length} 張，就會算出聽哪些牌。</p>
        )}
        {isComplete && waits.length === 0 && (
          <p className="result-waiting">這副牌還沒聽牌。</p>
        )}
        {isComplete && waits.length > 0 && (
          <>
            <p className="result-summary">
              聽 <strong>{waits.length}</strong> 種牌，手牌外最多還有 <strong>{waits.reduce((sum, w) => sum + w.remaining, 0)}</strong> 張
            </p>
            <ul className="wait-list">
              {waits.map(w => (
                <li key={w.tile.index}>
                  <span className="tile tile-static"><TileFace tile={w.tile} /></span>
                  <span className="wait-count">{w.remaining} 張</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="hand-panel">
        <div className="hand-head">
          <h3>手牌 {hand.length} / {needed}</h3>
          <div className="hand-tools">
            <button className="btn-link" onClick={() => { setMeldCount(0); setHand(SAMPLE_HAND); }}>載入範例</button>
            <button className="btn-link" disabled={hand.length === 0} onClick={() => setHand([])}>清空</button>
          </div>
        </div>
        <div className="hand-tiles">
          {sorted.length === 0 && <p className="hand-empty">從下方點選手牌，不用輸入花牌。</p>}
          {sorted.map(({ t, slot }) => (
            <button
              key={slot}
              className="tile tile-small"
              aria-label={`移除${TILES[t].name}`}
              onClick={() => removeSlot(slot)}
            >
              <TileFace tile={TILES[t]} />
            </button>
          ))}
        </div>
        <div className="meld-row">
          <span id="meld-label">已吃碰槓</span>
          <div className="meld-stepper" role="group" aria-labelledby="meld-label">
            <button aria-label="減少一組" disabled={meldCount === 0} onClick={() => changeMelds(meldCount - 1)}>−</button>
            <b>{meldCount} 組</b>
            <button aria-label="增加一組" disabled={meldCount === 5} onClick={() => changeMelds(meldCount + 1)}>+</button>
          </div>
        </div>
      </section>

      <section className="tile-picker" aria-label="選擇手牌">
        {TILE_GROUPS.map(group => (
          <div key={group} className="tile-row">
            {TILES.filter(t => t.group === group).map(t => {
              const used = copies(t.index);
              return (
                <button
                  key={t.index}
                  className="tile"
                  aria-label={`加入${t.name}，手牌已有 ${used} 張`}
                  disabled={used >= MAX_COPIES || hand.length >= needed}
                  onClick={() => addTile(t.index)}
                >
                  <TileFace tile={t} />
                </button>
              );
            })}
          </div>
        ))}
      </section>

      <p className="tenpai-note">
        只判斷「面子＋一對」的標準牌型，不含七搶一、八仙過海等花牌胡法。剩餘張數只扣除手牌，不會扣除已吃碰槓或桌面上打出的牌。
      </p>
    </div>
  );
}
