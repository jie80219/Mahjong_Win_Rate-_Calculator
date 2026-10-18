import { describe, it, expect, afterEach } from 'vitest';
import type { Round } from '../types';
import { getCriticalTai, setCriticalTai, isCriticalTai, DEFAULT_CRITICAL_TAI } from './rules';
import { computePlayerStats } from './stats';

afterEach(() => setCriticalTai(DEFAULT_CRITICAL_TAI));

const win = (tai: number): Round => ({
  id: `r${tai}`, tableSessionId: 's', sequence: tai, playedAt: '2026-01-01T00:00:00Z', resultType: 'discardWin',
  winnerId: 'a', discarderId: 'b', tai, createdAt: '', updatedAt: '',
});

describe('大牌門檻', () => {
  it('預設 5 台以上算大牌', () => {
    expect(getCriticalTai()).toBe(5);
    expect(isCriticalTai(4)).toBe(false);
    expect(isCriticalTai(5)).toBe(true);
    expect(isCriticalTai(null)).toBe(false);
  });

  it('改門檻後，大牌與放大槍統計跟著變', () => {
    const rounds = [win(3), win(4), win(6)];
    const map = new Map([['s', ['a', 'b', 'c', 'd']]]);
    const statsOf = () => computePlayerStats(rounds, ['a', 'b'], map);
    expect(statsOf().find(s => s.playerId === 'a')!.criticals).toBe(1);

    setCriticalTai(4);
    expect(statsOf().find(s => s.playerId === 'a')!.criticals).toBe(2);
    expect(statsOf().find(s => s.playerId === 'b')!.beCriticals).toBe(2);
  });

  it('門檻最少 1 台', () => {
    setCriticalTai(0);
    expect(getCriticalTai()).toBe(1);
  });
});
