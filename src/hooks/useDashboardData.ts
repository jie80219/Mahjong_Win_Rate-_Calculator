import { useMemo } from 'react';
import type { Preferences, Round, TableSession } from '../types';
import { computePlayerStats, filterRoundsByDate } from '../utils/stats';
import { computeAllRoundsMoney, computeMoneyAcrossSessions, computeCumulativeMoney, withDealerTai } from '../utils/money';

interface Args {
  activeSession: TableSession | null;
  /** 目前牌桌的全部牌局 */
  rounds: Round[];
  allRounds: Round[];
  sessions: TableSession[];
  tablePlayerMap: Map<string, string[]>;
  prefs: Preferences;
}

/** 儀表板要用的統計與金額；網頁和匯出的 HTML 報表共用，確保兩邊算出來一樣 */
export function useDashboardData({ activeSession, rounds, allRounds, sessions, tablePlayerMap, prefs }: Args) {
  const scope = prefs.scope;
  const displayRounds = scope === 'all' ? allRounds : rounds;
  const filteredRounds = useMemo(
    () => filterRoundsByDate(displayRounds, prefs.dateRange),
    [displayRounds, prefs.dateRange],
  );

  const scopePlayerIds = scope === 'all'
    ? prefs.selectedPlayerIds
    : (activeSession?.playerIds ? [...activeSession.playerIds] : []);
  const statPlayerIds = scopePlayerIds.length > 0 ? scopePlayerIds : (activeSession?.playerIds ? [...activeSession.playerIds] : []);

  // 圖表、大牌、台數分布看的是含莊家台的總台數；算錢仍用原始牌局
  const taiRounds = useMemo(
    () => withDealerTai(filteredRounds, sessions, allRounds),
    [filteredRounds, sessions, allRounds],
  );

  const stats = computePlayerStats(taiRounds, statPlayerIds, tablePlayerMap);

  const tableDraw = activeSession && scope === 'table'
    ? filteredRounds.filter(r => r.resultType === 'draw' && r.tableSessionId === activeSession.id).length
    : filteredRounds.filter(r => r.resultType === 'draw').length;

  const roundsMoney = useMemo(() => {
    if (!activeSession) return [];
    if (scope === 'all') return computeMoneyAcrossSessions(filteredRounds, sessions, allRounds);
    return computeAllRoundsMoney(filteredRounds, activeSession, rounds);
  }, [activeSession, scope, filteredRounds, sessions, allRounds, rounds]);

  const statPlayerKey = statPlayerIds.join(',');
  const cumulativeMoney = useMemo(
    () => computeCumulativeMoney(roundsMoney, statPlayerKey ? statPlayerKey.split(',') : []),
    [roundsMoney, statPlayerKey],
  );

  return { filteredRounds, taiRounds, stats, tableDraw, roundsMoney, cumulativeMoney };
}
