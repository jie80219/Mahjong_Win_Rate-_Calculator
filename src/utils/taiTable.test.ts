import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  toggleTaiItem, sumTai, describeTai, multiplierOf, leopardMultiplier,
  newCustomTaiItem, saveCustomTaiItems, loadCustomTaiItems, saveHiddenTaiKeys, loadHiddenTaiKeys,
} from './taiTable';

const pick = (...keys: string[]) => keys.reduce<Record<string, number>>((c, k) => toggleTaiItem(c, k), {});

describe('台數計算表', () => {
  it('門清自摸取代門清與自摸', () => {
    const c = pick('menqing', 'zimo', 'menqingZimo');
    expect(sumTai(c, {})).toBe(3);
  });

  it('嚦咕已含門清，門清自摸會改成自摸', () => {
    const c = pick('menqingZimo', 'ligu');
    expect(describeTai(c)).toBe('自摸、嚦咕嚦咕');
    expect(sumTai(c, {})).toBe(9);
  });

  it('可重複的項目累加到上限後歸零', () => {
    expect(sumTai(pick('flower', 'flower'), {})).toBe(2);
    expect(sumTai(pick('flower', 'flower', 'flower'), {})).toBe(0);
  });

  it('自訂台數', () => {
    expect(sumTai(pick('migi'), { migi: 10 })).toBe(10);
  });
});

describe('骰規豹子', () => {
  it('不加台數，是倍率', () => {
    const c = pick('leopard', 'diceRed');
    expect(sumTai(c, {})).toBe(1);
    expect(multiplierOf(c, {})).toBe(3);
    expect(describeTai(c)).toBe('骰規全紅、骰規豹子');
  });

  it('預設 3 倍，可自訂', () => {
    expect(leopardMultiplier({})).toBe(3);
    expect(leopardMultiplier({ leopard: 5 })).toBe(5);
    expect(multiplierOf(pick('leopard'), { leopard: 2 })).toBe(2);
  });

  it('沒選豹子倍率是 1', () => {
    expect(multiplierOf(pick('zimo'), {})).toBe(1);
  });

  it('豹子不能跟順子同時成立，可以跟全紅疊加', () => {
    expect(pick('diceStraight', 'leopard').diceStraight).toBe(0);
    expect(pick('diceRed', 'leopard').diceRed).toBe(1);
  });
});

describe('自訂牌型', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('新增台數牌型會加進台數，倍率牌型會乘金額', () => {
    const flowerWin = newCustomTaiItem('花胡', 6, false);
    const double = newCustomTaiItem('家規加倍', 2, true);
    saveCustomTaiItems([flowerWin, double]);
    expect(loadCustomTaiItems().map(i => i.name)).toEqual(['花胡', '家規加倍']);

    const c = pick('zimo', flowerWin.key, double.key);
    expect(sumTai(c, {})).toBe(7);
    expect(multiplierOf(c, {})).toBe(2);
    expect(describeTai(c)).toBe('自摸、花胡、家規加倍');
  });

  it('豹子跟自訂倍率會相乘', () => {
    const double = newCustomTaiItem('家規加倍', 2, true);
    saveCustomTaiItems([double]);
    expect(multiplierOf(pick('leopard', double.key), {})).toBe(6);
  });

  it('隱藏的牌型清單會存起來', () => {
    saveHiddenTaiKeys(['migi', 'qiqiangyi']);
    expect(loadHiddenTaiKeys()).toEqual(['migi', 'qiqiangyi']);
  });
});
