import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from './components/Toast.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)

if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => { /* 瀏覽器不支援或拒絕時維持原行為 */ })
}
