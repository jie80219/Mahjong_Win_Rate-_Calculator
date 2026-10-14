import { useMemo, useState, useEffect } from 'react';
import type { Round, TableSession } from '../types';
import { getPlayerName } from '../db/players';
import { computeAllRoundsMoney, computeCumulativeMoney, computeSettlement, formatMoney } from '../utils/money';
import { computePlayerStats } from '../utils/stats';
import { drawReportCard, type ReportCardData } from '../utils/reportCard';

interface Props {
  session: TableSession;
  rounds: Round[];
  onClose: () => void;
  /** 結束牌桌後開啟時顯示的標題 */
  ended?: boolean;
}

export default function SettlementPanel({ session, rounds, onClose, ended }: Props) {
  const [copied, setCopied] = useState(false);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const [generating, setGenerating] = useState(false);

  const playerIds = useMemo(() => [...session.playerIds], [session]);
  const sessionRounds = useMemo(() => rounds.filter(r => r.tableSessionId === session.id), [rounds, session.id]);
  const hasMoney = (session.baseMoney ?? 0) > 0 || (session.taiMoney ?? 0) > 0;

  const totals = useMemo(
    () => computeCumulativeMoney(computeAllRoundsMoney(sessionRounds, session), playerIds),
    [sessionRounds, session, playerIds],
  );
  const transfers = useMemo(() => computeSettlement(totals), [totals]);
  const stats = useMemo(
    () => computePlayerStats(sessionRounds, playerIds, new Map([[session.id, playerIds]])),
    [sessionRounds, playerIds, session.id],
  );

  const ranking = useMemo(() => playerIds
    .map(pid => {
      const s = stats.find(x => x.playerId === pid)!;
      return { pid, name: getPlayerName(pid), money: totals[pid] ?? 0, wins: s.selfDraws + s.ronWins, discards: s.discards };
    })
    .sort((a, b) => (hasMoney ? b.money - a.money : b.wins - a.wins || a.discards - b.discards)),
  [playerIds, stats, totals, hasMoney]);

  const dateText = new Date(session.startedAt).toLocaleDateString('zh-TW');
  const drawCount = sessionRounds.filter(r => r.resultType === 'draw').length;

  const settlementText = useMemo(() => {
    const lines = [`🀄 麻將結算 ${dateText}`, `共 ${sessionRounds.length} 局（流局 ${drawCount}）`];
    if (hasMoney) lines.push(`底 ${session.baseMoney ?? 0} / 台 ${session.taiMoney ?? 0}`);
    lines.push('');
    for (const r of ranking) {
      lines.push(hasMoney ? `${r.name}　${formatMoney(r.money)}` : `${r.name}　胡 ${r.wins}・放槍 ${r.discards}`);
    }
    if (hasMoney && transfers.length) {
      lines.push('', '💸 轉帳');
      for (const t of transfers) lines.push(`${getPlayerName(t.from)} → ${getPlayerName(t.to)}　$${t.amount.toLocaleString()}`);
    }
    return lines.join('\n');
  }, [dateText, sessionRounds.length, drawCount, hasMoney, session, ranking, transfers]);

  useEffect(() => () => { if (cardUrl) URL.revokeObjectURL(cardUrl); }, [cardUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(settlementText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleGenerateCard = async () => {
    setGenerating(true);
    try {
      const wins = sessionRounds.filter(r => r.winnerId && r.tai !== null);
      const biggest = wins.reduce<Round | null>((b, r) => (!b || (r.tai ?? 0) > (b.tai ?? 0) ? r : b), null);
      const topBy = (key: 'selfDraws' | 'discards' | 'criticals') => {
        const max = Math.max(...stats.map(s => s[key]));
        if (max <= 0) return null;
        return { names: stats.filter(s => s[key] === max).map(s => getPlayerName(s.playerId)).join('、'), max };
      };
      const highlights: ReportCardData['highlights'] = [];
      highlights.push({ icon: '🏆', label: 'MVP', value: ranking[0]?.name ?? '—' });
      const last = ranking[ranking.length - 1];
      if (last && hasMoney && last.money < 0) highlights.push({ icon: '😭', label: '最慘', value: `${last.name} ${formatMoney(last.money)}` });
      if (biggest?.winnerId) highlights.push({ icon: '🐉', label: '最大一把', value: `${getPlayerName(biggest.winnerId)} ${biggest.tai} 台` });
      const sd = topBy('selfDraws');
      if (sd) highlights.push({ icon: '🀄', label: '自摸王', value: `${sd.names} ×${sd.max}` });
      const dc = topBy('discards');
      if (dc) highlights.push({ icon: '🎁', label: '放槍王', value: `${dc.names} ×${dc.max}` });
      const cr = topBy('criticals');
      if (cr) highlights.push({ icon: '🌟', label: '大牌王', value: `${cr.names} ×${cr.max}` });

      const blob = await drawReportCard({
        title: '今日戰報',
        dateText,
        roundsText: `共 ${sessionRounds.length} 局`,
        hasMoney,
        ranking: ranking.map(r => ({ name: r.name, money: r.money, wins: r.wins, discards: r.discards })),
        highlights,
      });
      if (cardUrl) URL.revokeObjectURL(cardUrl);
      setCardBlob(blob);
      setCardUrl(URL.createObjectURL(blob));
    } finally {
      setGenerating(false);
    }
  };

  const handleShareCard = async () => {
    if (!cardBlob || !cardUrl) return;
    const file = new File([cardBlob], `mahjong_${dateText.replace(/\//g, '-')}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: '麻將戰報' }); return; } catch { /* 使用者取消 */ return; }
    }
    const a = document.createElement('a');
    a.href = cardUrl;
    a.download = file.name;
    a.click();
  };

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <h3>{ended ? '牌桌已結束・結算' : '結算'}</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <p className="setup-hint">{dateText}・共 {sessionRounds.length} 局（流局 {drawCount}）</p>

        <div className="settle-ranking">
          {ranking.map((r, i) => (
            <div key={r.pid} className="settle-row">
              <span className="settle-rank">{i + 1}</span>
              <span className="settle-name">{r.name}</span>
              <span className="settle-sub">胡 {r.wins}・槍 {r.discards}</span>
              {hasMoney && (
                <span className={`settle-money ${r.money > 0 ? 'positive' : r.money < 0 ? 'negative' : ''}`}>
                  {formatMoney(r.money)}
                </span>
              )}
            </div>
          ))}
        </div>

        {hasMoney && (
          <div className="settle-transfers">
            <h4>轉帳方式（最少次數）</h4>
            {transfers.length === 0 ? (
              <p className="setup-hint">大家打平，不用轉帳</p>
            ) : transfers.map((t, i) => (
              <div key={i} className="transfer-row">
                <span>{getPlayerName(t.from)}</span>
                <span className="transfer-arrow">→</span>
                <span>{getPlayerName(t.to)}</span>
                <span className="transfer-amount">${t.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        <div className="export-buttons">
          <button className="btn-primary btn-block" onClick={handleCopy}>
            {copied ? '已複製 ✓' : '複製結算文字（貼到 LINE）'}
          </button>
          <button className="btn-secondary btn-block" onClick={handleGenerateCard} disabled={generating || sessionRounds.length === 0}>
            {generating ? '產生中...' : '產生戰報圖卡'}
          </button>
        </div>

        {cardUrl && (
          <div className="report-card-preview">
            <img src={cardUrl} alt="戰報圖卡" />
            <button className="btn-primary btn-block" onClick={handleShareCard}>分享 / 下載圖卡</button>
          </div>
        )}
      </div>
    </div>
  );
}
