import type { Player } from '../types';

export const PLAYERS: Player[] = [
  { id: 'p01', displayName: '傑智', isActive: true },
  { id: 'p02', displayName: '忠喆', isActive: true },
  { id: 'p03', displayName: '柏穎', isActive: true },
  { id: 'p04', displayName: '柏愷', isActive: true },
  { id: 'p05', displayName: '晴欣', isActive: true },
  { id: 'p06', displayName: '翌如', isActive: true },
  { id: 'p07', displayName: '仲盛', isActive: true },
  { id: 'p08', displayName: '旭東', isActive: true },
  { id: 'p09', displayName: '璿風', isActive: true },
  { id: 'p10', displayName: '同隆', isActive: true },
  { id: 'p11', displayName: '炮哥', isActive: true },
  { id: 'p12', displayName: '偉杰', isActive: true },
];

export function getPlayerName(id: string): string {
  return PLAYERS.find(p => p.id === id)?.displayName ?? id;
}

export function getPlayerMap(): Map<string, Player> {
  return new Map(PLAYERS.map(p => [p.id, p]));
}
