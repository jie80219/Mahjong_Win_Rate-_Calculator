import { describe, it, expect } from 'vitest';
import { visiblePlayerIds } from './stats';

const table = ['a', 'b', 'c', 'd'];

describe('圖表顯示哪些玩家', () => {
  it('目前牌桌：不顯示篩選裡殘留的別桌玩家', () => {
    expect(visiblePlayerIds('table', ['a', 'b', 'c', 'x'], table)).toEqual(['a', 'b', 'c']);
  });

  it('目前牌桌：篩選裡沒有本桌的人時顯示全桌', () => {
    expect(visiblePlayerIds('table', ['x', 'y'], table)).toEqual(table);
    expect(visiblePlayerIds('table', [], table)).toEqual(table);
  });

  it('全部紀錄：照篩選', () => {
    expect(visiblePlayerIds('all', ['a', 'x'], table)).toEqual(['a', 'x']);
    expect(visiblePlayerIds('all', [], table)).toEqual(table);
  });
});
