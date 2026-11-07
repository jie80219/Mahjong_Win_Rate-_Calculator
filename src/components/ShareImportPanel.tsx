import { useEffect, useState } from 'react';
import { decodeShare, mergeSharedTable, type SharedTable } from '../utils/share';
import { db } from '../db';

interface Props {
  data: string;
  onDone: (sessionId: string | null) => void;
}

export default function ShareImportPanel({ data, onDone }: Props) {
  const [shared, setShared] = useState<SharedTable | null>(null);
  const [existingRounds, setExistingRounds] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await decodeShare(data);
        setShared(s);
        const exists = await db.tableSessions.get(s.session.id);
        if (exists) setExistingRounds(await db.rounds.where('tableSessionId').equals(s.session.id).count());
      } catch {
        setError('分享連結無法讀取，可能已損毀或不完整。');
      }
    })();
  }, [data]);

  const handleImport = async () => {
    if (!shared) return;
    setImporting(true);
    try {
      await mergeSharedTable(shared);
      onDone(shared.session.id);
    } catch {
      setError('匯入失敗，請再試一次');
      setImporting(false);
    }
  };

  const names = shared ? shared.session.playerIds.map(id => shared.names[id] ?? id).join('、') : '';

  return (
    <div className="panel-overlay">
      <div className="panel">
        <div className="panel-header">
          <h3>收到分享的牌桌</h3>
          <button className="btn-icon" onClick={() => onDone(null)}>✕</button>
        </div>

        {error && <p className="warn-text">{error}</p>}
        {!shared && !error && <p className="setup-hint">讀取中...</p>}

        {shared && (
          <>
            <div className="import-preview">
              <p>玩家：{names}</p>
              <p>日期：{new Date(shared.session.startedAt).toLocaleString('zh-TW')}</p>
              <p>牌局：{shared.rounds.length} 局</p>
              {existingRounds !== null && (
                <p className="warn-text">
                  本機已有這桌（{existingRounds} 局），匯入後會以分享內容為準更新這桌。
                </p>
              )}
            </div>
            <p className="setup-hint">只會新增或更新這一桌，其他紀錄不受影響。</p>
            <div className="export-buttons">
              <button className="btn-primary btn-block" disabled={importing} onClick={handleImport}>
                {importing ? '匯入中...' : existingRounds !== null ? '更新這桌' : '加入到本機'}
              </button>
              <button className="btn-secondary btn-block" onClick={() => onDone(null)}>不要匯入</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
