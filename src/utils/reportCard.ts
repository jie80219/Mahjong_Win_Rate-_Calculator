export interface ReportCardData {
  title: string;
  dateText: string;
  roundsText: string;
  hasMoney: boolean;
  ranking: { name: string; money: number; wins: number; discards: number }[];
  highlights: { icon: string; label: string; value: string }[];
}

const W = 1080;
const H = 1350;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function moneyText(v: number): string {
  if (v === 0) return '$0';
  return `${v > 0 ? '+' : '-'}$${Math.abs(v).toLocaleString()}`;
}

/** 繪製可分享到群組的戰報圖卡 */
export async function drawReportCard(data: ReportCardData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const font = (size: number, weight = 600) =>
    `${weight} ${size}px -apple-system, "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif`;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0f3d2e');
  bg.addColorStop(1, '#06231a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(245, 197, 66, 0.55)';
  ctx.lineWidth = 6;
  roundRect(ctx, 30, 30, W - 60, H - 60, 32);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5c542';
  ctx.font = font(76, 800);
  ctx.fillText(data.title, W / 2, 150);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = font(34, 500);
  ctx.fillText(`${data.dateText}　${data.roundsText}`, W / 2, 210);

  // 排名
  const medals = ['🥇', '🥈', '🥉', '　'];
  let y = 290;
  data.ranking.forEach((p, i) => {
    ctx.fillStyle = i === 0 ? 'rgba(245, 197, 66, 0.18)' : 'rgba(255,255,255,0.07)';
    roundRect(ctx, 80, y, W - 160, 106, 22);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = font(54, 600);
    ctx.fillText(medals[i] ?? '', 110, y + 72);
    ctx.fillStyle = '#ffffff';
    ctx.font = font(50, 700);
    ctx.fillText(p.name, 200, y + 70);

    ctx.textAlign = 'right';
    if (data.hasMoney) {
      ctx.fillStyle = p.money > 0 ? '#4ade80' : p.money < 0 ? '#f87171' : '#e5e5e5';
      ctx.font = font(52, 800);
      ctx.fillText(moneyText(p.money), W - 110, y + 72);
    } else {
      ctx.fillStyle = '#e5e5e5';
      ctx.font = font(40, 600);
      ctx.fillText(`胡 ${p.wins}・槍 ${p.discards}`, W - 110, y + 68);
    }
    y += 122;
  });

  // 亮點
  y += 30;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f5c542';
  ctx.font = font(38, 700);
  ctx.fillText('本場焦點', 90, y);
  y += 30;
  const colW = (W - 200) / 2;
  data.highlights.slice(0, 6).forEach((h, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 90 + col * (colW + 20);
    const yy = y + row * 122;
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    roundRect(ctx, x, yy, colW, 106, 20);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = font(30, 500);
    ctx.fillText(`${h.icon} ${h.label}`, x + 26, yy + 42);
    ctx.fillStyle = '#ffffff';
    ctx.font = font(38, 700);
    ctx.fillText(h.value, x + 26, yy + 86, colW - 52);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = font(26, 500);
  ctx.fillText('麻將勝率計算器', W / 2, H - 60);

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}
