import { describe, it, expect } from 'vitest';
import { toggleTaiItem, sumTai, describeTai, multiplierOf, leopardMultiplier } from './taiTable';

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
    expect(describeTai(c)).toBe('骰規全紅');
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
