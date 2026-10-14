// 台灣十六張麻將常見台數表。莊家／連莊台由莊家系統自動計算，這裡不列入。

export interface TaiItem {
  key: string;
  name: string;
  tai: number;
  desc: string;
  /** 可以重複計算（例如花牌、三元牌刻子） */
  max?: number;
  /** 選了這項就不能同時算的項目 */
  excludes?: string[];
}

export interface TaiGroup {
  title: string;
  items: TaiItem[];
}

export const TAI_GROUPS: TaiGroup[] = [
  {
    title: '基本',
    items: [
      { key: 'menqing', name: '門清', tai: 1, desc: '沒有吃、碰、明槓', excludes: ['menqingZimo', 'quanqiu'] },
      { key: 'zimo', name: '自摸', tai: 1, desc: '自己摸進胡牌', excludes: ['menqingZimo'] },
      { key: 'menqingZimo', name: '門清自摸', tai: 3, desc: '門清又自摸（取代門清＋自摸）', excludes: ['menqing', 'zimo', 'quanqiu', 'banqiu'] },
      { key: 'dutin', name: '獨聽', tai: 1, desc: '單吊、中洞、邊張只聽一張' },
      { key: 'banqiu', name: '半求人', tai: 1, desc: '吃碰到只剩一張單吊並自摸', excludes: ['quanqiu', 'menqing', 'menqingZimo'] },
      { key: 'quanqiu', name: '全求人', tai: 2, desc: '全部吃碰，單吊別人放槍', excludes: ['menqing', 'menqingZimo', 'banqiu', 'zimo'] },
      { key: 'pinghu', name: '平胡', tai: 2, desc: '無字無花、全順子、聽兩面、非自摸' },
    ],
  },
  {
    title: '字牌與花牌',
    items: [
      { key: 'quanfeng', name: '圈風', tai: 1, desc: '本圈風牌的刻子' },
      { key: 'menfeng', name: '門風', tai: 1, desc: '自己座位風牌的刻子' },
      { key: 'sanyuan', name: '三元牌', tai: 1, desc: '中、發、白的刻子（每組 1 台）', max: 3 },
      { key: 'flower', name: '花牌', tai: 1, desc: '對到自己位置的花（每張 1 台）', max: 2 },
      { key: 'huagang', name: '花槓', tai: 2, desc: '春夏秋冬或梅蘭竹菊一整組', max: 2 },
    ],
  },
  {
    title: '特殊胡法',
    items: [
      { key: 'gangkai', name: '槓上開花', tai: 1, desc: '槓牌後補牌自摸' },
      { key: 'qianggang', name: '搶槓', tai: 1, desc: '胡別人加槓的那張牌' },
      { key: 'haidi', name: '海底撈月', tai: 1, desc: '摸最後一張牌自摸' },
      { key: 'hedi', name: '河底撈魚', tai: 1, desc: '胡最後一張打出的牌' },
    ],
  },
  {
    title: '牌型',
    items: [
      { key: 'sananke', name: '三暗刻', tai: 2, desc: '三組自己摸到的刻子', excludes: ['siananke', 'wuananke'] },
      { key: 'pengpeng', name: '碰碰胡', tai: 4, desc: '全部都是刻子' },
      { key: 'hunyise', name: '混一色', tai: 4, desc: '一種花色加字牌', excludes: ['qingyise', 'ziyise'] },
      { key: 'xiaosanyuan', name: '小三元', tai: 4, desc: '三元牌兩刻一對', excludes: ['dasanyuan'] },
      { key: 'siananke', name: '四暗刻', tai: 5, desc: '四組暗刻', excludes: ['sananke', 'wuananke'] },
      { key: 'qingyise', name: '清一色', tai: 8, desc: '只有一種花色', excludes: ['hunyise', 'ziyise'] },
      { key: 'wuananke', name: '五暗刻', tai: 8, desc: '五組暗刻', excludes: ['sananke', 'siananke'] },
      { key: 'dasanyuan', name: '大三元', tai: 8, desc: '中發白都是刻子', excludes: ['xiaosanyuan', 'sanyuan'] },
      { key: 'xiaosixi', name: '小四喜', tai: 8, desc: '風牌三刻一對', excludes: ['dasixi'] },
      { key: 'dasixi', name: '大四喜', tai: 16, desc: '東南西北都是刻子', excludes: ['xiaosixi', 'quanfeng', 'menfeng'] },
      { key: 'ziyise', name: '字一色', tai: 16, desc: '全部都是字牌', excludes: ['hunyise', 'qingyise'] },
      { key: 'baxian', name: '八仙過海', tai: 8, desc: '八張花全拿', excludes: ['flower', 'huagang'] },
      { key: 'qiqiangyi', name: '七搶一', tai: 8, desc: '七張花搶別人一張' },
    ],
  },
  {
    title: '天地人胡',
    items: [
      { key: 'tianhu', name: '天胡', tai: 16, desc: '莊家起手就胡' },
      { key: 'dihu', name: '地胡', tai: 16, desc: '閒家第一輪自摸' },
      { key: 'renhu', name: '人胡', tai: 8, desc: '第一輪胡別人打出的牌' },
    ],
  },
];

export const ALL_TAI_ITEMS: TaiItem[] = TAI_GROUPS.flatMap(g => g.items);

const OVERRIDE_KEY = 'mahjong_tai_overrides';

/** 各家規則不同，允許自訂每一項的台數（存在本機） */
export function loadTaiOverrides(): Record<string, number> {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveTaiOverrides(overrides: Record<string, number>): void {
  try {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
  } catch { /* ignore */ }
}

export function taiOf(item: TaiItem, overrides: Record<string, number>): number {
  return overrides[item.key] ?? item.tai;
}

/** counts：每一項選了幾次 */
export function sumTai(counts: Record<string, number>, overrides: Record<string, number>, extra = 0): number {
  let total = extra;
  for (const item of ALL_TAI_ITEMS) total += (counts[item.key] ?? 0) * taiOf(item, overrides);
  return Math.max(0, total);
}

export function describeTai(counts: Record<string, number>): string {
  return ALL_TAI_ITEMS
    .filter(i => (counts[i.key] ?? 0) > 0)
    .map(i => (counts[i.key] > 1 ? `${i.name}×${counts[i.key]}` : i.name))
    .join('、');
}
