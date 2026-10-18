import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ReportApp from './report/ReportApp.tsx'
import { setPlayerCache } from './db/players'

// 匯出的 HTML 報表會在頁面裡帶資料，這時改成唯讀報表模式，不碰本機資料庫
const report = window.__MAHJONG_REPORT__

if (report) setPlayerCache(report.players)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {report ? <ReportApp data={report} /> : <App />}
  </StrictMode>,
)

if (!report && import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
