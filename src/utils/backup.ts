import { db } from '../db';
import type { TableSession, Round } from '../types';

interface BackupData {
  version: number;
  exportedAt: string;
  tableSessions: TableSession[];
  rounds: Round[];
}

export async function exportData(): Promise<string> {
  const tableSessions = await db.tableSessions.toArray();
  const rounds = await db.rounds.toArray();
  const data: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tableSessions,
    rounds,
  };
  return JSON.stringify(data, null, 2);
}

export interface ImportPreview {
  tableSessions: number;
  rounds: number;
  valid: boolean;
  errors: string[];
}

export function validateImport(json: string): { data: BackupData | null; preview: ImportPreview } {
  const preview: ImportPreview = { tableSessions: 0, rounds: 0, valid: false, errors: [] };

  let data: BackupData;
  try {
    data = JSON.parse(json);
  } catch {
    preview.errors.push('JSON 格式無效');
    return { data: null, preview };
  }

  if (!data.version || !Array.isArray(data.tableSessions) || !Array.isArray(data.rounds)) {
    preview.errors.push('缺少必要欄位 (version, tableSessions, rounds)');
    return { data: null, preview };
  }

  for (const ts of data.tableSessions) {
    if (!ts.id || !Array.isArray(ts.playerIds) || ts.playerIds.length !== 4 || !ts.startedAt) {
      preview.errors.push(`牌桌 ${ts.id ?? '(無ID)'} 資料不完整`);
    }
  }

  for (const r of data.rounds) {
    if (!r.id || !r.tableSessionId || r.resultType === undefined) {
      preview.errors.push(`牌局 ${r.id ?? '(無ID)'} 資料不完整`);
    }
    if (r.resultType === 'selfDraw' && (!r.winnerId || r.tai === null || r.tai === undefined)) {
      preview.errors.push(`牌局 ${r.id} 自摸缺少贏家或台數`);
    }
    if (r.resultType === 'discardWin' && (!r.winnerId || !r.discarderId || r.tai === null || r.tai === undefined)) {
      preview.errors.push(`牌局 ${r.id} 榮胡缺少贏家、放槍者或台數`);
    }
  }

  preview.tableSessions = data.tableSessions.length;
  preview.rounds = data.rounds.length;
  preview.valid = preview.errors.length === 0;

  return { data: preview.valid ? data : null, preview };
}

export async function importData(data: BackupData): Promise<void> {
  await db.transaction('rw', db.tableSessions, db.rounds, async () => {
    await db.tableSessions.clear();
    await db.rounds.clear();
    await db.tableSessions.bulkAdd(data.tableSessions);
    await db.rounds.bulkAdd(data.rounds);
  });
}
