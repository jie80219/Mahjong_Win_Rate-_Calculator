import { useState, useCallback, useRef } from 'react';
import { exportData, validateImport, importData } from '../utils/backup';

interface Props {
  onClose: () => void;
  onImported: () => Promise<void>;
}

export default function BackupPanel({ onClose, onImported }: Props) {
  const [importPreview, setImportPreview] = useState<{ tableSessions: number; rounds: number; errors: string[] } | null>(null);
  const [importJson, setImportJson] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(async () => {
    const json = await exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mahjong_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setImportJson(text);
      const { preview } = validateImport(text);
      setImportPreview(preview);
    };
    reader.readAsText(file);
  }, []);

  const handleImport = useCallback(async () => {
    if (!importJson) return;
    setImporting(true);

    const backupJson = await exportData();
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mahjong_backup_before_import_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    try {
      const { data } = validateImport(importJson);
      if (!data) {
        alert('資料驗證失敗');
        return;
      }
      await importData(data);
      await onImported();
      alert('匯入成功');
      onClose();
    } catch {
      alert('匯入失敗');
    } finally {
      setImporting(false);
    }
  }, [importJson, onImported, onClose]);

  return (
    <div className="panel-overlay">
      <div className="panel">
        <div className="panel-header">
          <h3>備份與還原</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="backup-section">
          <h4>匯出備份</h4>
          <button className="btn-primary btn-block" onClick={handleExport}>
            匯出 JSON
          </button>
        </div>

        <div className="backup-section">
          <h4>匯入還原</h4>
          <p className="warn-text">匯入會取代所有現有資料，系統會先自動下載備份。</p>
          <input
            type="file"
            accept=".json"
            ref={fileRef}
            onChange={handleFileChange}
            className="file-input"
          />

          {importPreview && (
            <div className="import-preview">
              <p>牌桌：{importPreview.tableSessions} 個</p>
              <p>牌局：{importPreview.rounds} 局</p>
              {importPreview.errors.length > 0 && (
                <div className="import-errors">
                  <p>驗證錯誤：</p>
                  <ul>
                    {importPreview.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              {importPreview.errors.length === 0 && (
                <button
                  className="btn-primary btn-block"
                  onClick={handleImport}
                  disabled={importing}
                >
                  {importing ? '匯入中...' : '確認匯入（取代現有資料）'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
