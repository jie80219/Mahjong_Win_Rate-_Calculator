import Dexie, { type Table } from 'dexie';
import type { TableSession, Round, Player } from '../types';
import { DEFAULT_PLAYERS } from './players';

class MahjongDB extends Dexie {
  tableSessions!: Table<TableSession, string>;
  rounds!: Table<Round, string>;
  players!: Table<Player, string>;

  constructor() {
    super('MahjongDB');
    this.version(1).stores({
      tableSessions: 'id, startedAt',
      rounds: 'id, tableSessionId, [tableSessionId+sequence], playedAt, createdAt',
    });
    this.version(2).stores({
      tableSessions: 'id, startedAt',
      rounds: 'id, tableSessionId, [tableSessionId+sequence], playedAt, createdAt',
      players: 'id',
    }).upgrade(tx => tx.table('players').bulkPut(DEFAULT_PLAYERS));
    this.on('populate', tx => { tx.table('players').bulkAdd(DEFAULT_PLAYERS); });
  }
}

export const db = new MahjongDB();
