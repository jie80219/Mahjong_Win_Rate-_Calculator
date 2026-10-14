import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { Round, TableSession } from '../types';
import { encodeShare, buildShareUrl } from '../utils/share';

interface Props {
  session: TableSession;
  rounds: Round[];
  onClose: () => void;
}

export default function SharePanel({ session, rounds, onClose }: Props) {
  const [url, setUrl] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [qrTooLong, setQrTooLong] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const link = buildShareUrl(await encodeShare(session, rounds));
        if (cancelled) return;
        setUrl(link);
        try {
          const data = await QRCode.toDataURL(link, { errorCorrectionLevel: 'L', margin: 2, width: 320 });
          if (!cancelled) setQr(data);
        } catch {
          if (!cancelled) setQrTooLong(true);
        }
      } catch {
        if (!cancelled) setError('此瀏覽器不支援壓縮功能，無法產生分享連結');
      }
    })();
    return () => { cancelled = true; };
  }, [session, rounds]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleNativeShare = async () => {
    try { await navigator.share({ title: '麻將牌桌紀錄', url }); } catch { /* 使用者取消 */ }
  };

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <h3>分享這桌</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <p className="setup-hint">
          牌友用手機掃描或開啟連結，就能把這桌紀錄合併到自己的裝置。資料直接放在連結裡，不會上傳到任何伺服器。
        </p>

        {error && <p className="warn-text">{error}</p>}
        {!url && !error && <p className="setup-hint">產生中...</p>}

        {qr && (
          <div className="share-qr">
            <img src={qr} alt="分享 QR code" />
          </div>
        )}
        {qrTooLong && <p className="setup-hint">這桌局數太多，QR code 放不下，請改用連結分享。</p>}

        {url && (
          <div className="export-buttons">
            <button className="btn-primary btn-block" onClick={handleCopy}>{copied ? '已複製 ✓' : '複製分享連結'}</button>
            {typeof navigator.share === 'function' && (
              <button className="btn-secondary btn-block" onClick={handleNativeShare}>用其他 App 分享</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
