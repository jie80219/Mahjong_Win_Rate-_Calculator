import { createContext, useContext } from 'react';

export interface ToastOptions {
  message: string;
  kind?: 'info' | 'success' | 'error';
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
  // 相同 key 的 toast 會取代舊的並重置計時器
  key?: string;
}

export interface ToastApi {
  show: (options: ToastOptions) => void;
  dismiss: (key: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

