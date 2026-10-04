import Dexie, { type Table } from 'dexie';
import type { TableSession, Round } from '../types';

class MahjongDB extends Dexie {
  tableSessions!: Table<TableSession, string>;
  rounds!: Table<Round, string>;

  constructor() {
    super('MahjongDB');
    this.version(1).stores({
      tableSessions: 'id, startedAt',
      rounds: 'id, tableSessionId, [tableSessionId+sequence], playedAt, createdAt',
    });
  }
}

export const db = new MahjongDB();
