const HAND_TYPES = [
  { name: '門清', tai: '1 台', desc: '沒有吃、碰、明槓，全部牌都在手上。' },
  { name: '自摸', tai: '1 台', desc: '胡的那張牌是自己摸進來的。' },
  { name: '莊家', tai: '1 台', desc: '莊家胡牌，或別人胡牌時由莊家放槍、被自摸。' },
  { name: '連莊', tai: '每連 1 次加 2 台', desc: '俗稱「連 N 拉 N」，連莊越多，莊家相關的輸贏越大。' },
  { name: '風牌、三元牌刻子', tai: '1 台', desc: '圈風、門風或中發白湊成三張相同。' },
  { name: '花牌', tai: '每張 1 台', desc: '摸到與自己座位相符的花牌。' },
  { name: '平胡', tai: '2 台', desc: '五組全是順子，沒有花也沒有字，且不是自摸或單聽。' },
  { name: '全求人', tai: '2 台', desc: '全部吃碰槓出去，手上只剩一張單吊，靠別人放槍胡牌。' },
  { name: '三暗刻', tai: '2 台', desc: '手上藏著三組自己摸到的刻子。' },
  { name: '碰碰胡', tai: '4 台', desc: '五組全是刻子或槓子。' },
  { name: '混一色', tai: '4 台', desc: '數字牌只有一種花色，再搭配字牌。' },
  { name: '小三元', tai: '4 台', desc: '中發白其中兩組刻子，另一種當眼。' },
  { name: '清一色', tai: '8 台', desc: '整副牌只有一種花色，不含字牌。' },
  { name: '大三元', tai: '8 台', desc: '中、發、白三組刻子全到齊。' },
  { name: '小四喜', tai: '8 台', desc: '東南西北其中三組刻子，另一種當眼。' },
  { name: '字一色', tai: '16 台', desc: '整副牌都是字牌。' },
  { name: '大四喜', tai: '16 台', desc: '東南西北四組刻子全到齊。' },
];

export default function RulesView() {
  return (
    <div className="rules">
      <h2 className="page-title">台灣十六張規則速查</h2>

      <details className="rule-block" open>
        <summary>一局怎麼進行</summary>
        <ol>
          <li>四人就座，決定東南西北與第一位莊家。</li>
          <li>莊家起手 17 張，其他人 16 張；花牌要亮出並補牌。</li>
          <li>輪流摸一張、打一張。可依規定吃上家的牌，或碰、槓任何人的牌。</li>
          <li>湊成 5 組面子加 1 對眼就能胡牌；牌牆摸完沒人胡則流局。</li>
          <li>莊家胡牌或流局就連莊，否則下一家接莊；四家都輪過一次就換圈。</li>
        </ol>
      </details>

      <details className="rule-block" open>
        <summary>本工具怎麼算錢</summary>
        <ul>
          <li><b>每份金額</b>＝底＋台數 × 台錢。</li>
          <li><b>放槍胡牌：</b>放槍者付一份給胡牌者，其餘兩人不用付。</li>
          <li><b>自摸：</b>其他三家各付一份給自摸者。</li>
          <li><b>閒家自摸：</b>莊家另外多付（2 × 連莊數＋1）× 台錢。</li>
          <li><b>爆擊：</b>單局 5 台以上。流局不計金額，也不算有效局。</li>
        </ul>
      </details>

      <section className="rule-block rule-table">
        <h3>常見台型</h3>
        <p className="rule-note">各地和各桌算法不盡相同，開打前先約定好，以牌桌共識為準。</p>
        <ul className="hand-type-list">
          {HAND_TYPES.map(h => (
            <li key={h.name}>
              <div>
                <b>{h.name}</b>
                <span>{h.desc}</span>
              </div>
              <em>{h.tai}</em>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
