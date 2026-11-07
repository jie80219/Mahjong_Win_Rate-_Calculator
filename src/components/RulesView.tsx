import { getCriticalTai } from '../utils/rules';
import { TAI_GROUPS, loadCustomTaiItems, loadHiddenTaiKeys, loadTaiOverrides, taiOf } from '../utils/taiTable';
import type { TaiItem } from '../utils/taiTable';

/** 台數一律讀台數計算表，規則頁才不會和實際記帳的設定不一致 */
function taiGroups(): { title: string; items: TaiItem[] }[] {
  const hidden = new Set(loadHiddenTaiKeys());
  const groups = TAI_GROUPS.map(g => ({ title: g.title, items: g.items.filter(i => !hidden.has(i.key)) }));
  const custom = loadCustomTaiItems().filter(i => !hidden.has(i.key));
  return [...groups, { title: '家規', items: custom }].filter(g => g.items.length > 0);
}

export default function RulesView() {
  const overrides = loadTaiOverrides();

  return (
    <div className="rules">
      <h2 className="page-title">台灣十六張規則速查</h2>

      <details className="rule-block" open>
        <summary>一局怎麼進行</summary>
        <ol>
          <li>四人就座，決定東南西北；起莊的人固定坐東。</li>
          <li>莊家起手 17 張，其他人 16 張；花牌要亮出並補牌。</li>
          <li>輪流摸一張、打一張。可依規定吃上家的牌，或碰、槓任何人的牌。</li>
          <li>湊成 5 組面子加 1 對眼就能胡牌；牌牆摸完沒人胡則流局。</li>
          <li>莊家胡牌或流局就連莊，否則下一家接莊；北家下莊、輪回東家時，圈風才往前走。</li>
        </ol>
      </details>

      <details className="rule-block" open>
        <summary>本工具怎麼算錢</summary>
        <ul>
          <li><b>每份金額</b>＝底＋（台數＋莊家台）× 台錢。</li>
          <li><b>放槍胡牌：</b>放槍者付一份給胡牌者，其餘兩人不用付。</li>
          <li><b>自摸：</b>其他三家各付一份給自摸者。</li>
          <li><b>莊家台：</b>1＋2 × 連莊數，依建立牌桌時選的算法計入。</li>
          <li><b>「標準」算法：</b>莊家胡牌、放槍或自摸時，莊家台算進這手牌；閒家自摸時，莊家另外多付莊家台。</li>
          <li><b>「僅閒家自摸」算法：</b>只有閒家自摸時，莊家多付莊家台。</li>
          <li><b>骰規豹子：</b>整筆金額（含底、莊家台）乘倍率，自摸時三家都乘。</li>
          <li><b>大牌：</b>含莊家台達 {getCriticalTai()} 台以上，門檻可在設定調整。流局不計金額，也不算有效局。</li>
        </ul>
      </details>

      <section className="rule-block rule-table">
        <h3>台數表</h3>
        <p className="rule-note">這裡顯示你在台數計算表的設定。莊家與連莊台由系統自動計算，不用另外加。各桌算法不盡相同，開打前先約定好。</p>
        {taiGroups().map(group => (
          <div key={group.title}>
            <h4 className="hand-type-group">{group.title}</h4>
            <ul className="hand-type-list">
              {group.items.map(item => (
                <li key={item.key}>
                  <div>
                    <b>{item.name}</b>
                    <span>{item.desc}</span>
                  </div>
                  <em>{item.multiplier ? `金額 ×${taiOf(item, overrides)}` : `${taiOf(item, overrides)} 台`}</em>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
