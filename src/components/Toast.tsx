import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ToastContext } from './toastContext';
import type { ToastOptions } from './toastContext';

interface ToastItem extends ToastOptions {
  id: number;
  key: string;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const nextId = useRef(1);

  const dismiss = useCallback((key: string) => {
    const timer = timers.current.get(key);
    if (timer) clearTimeout(timer);
    timers.current.delete(key);
    setToasts(prev => prev.filter(t => t.key !== key));
  }, []);

  const show = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    const key = options.key ?? `toast-${id}`;
    const existing = timers.current.get(key);
    if (existing) clearTimeout(existing);
    timers.current.set(key, setTimeout(() => dismiss(key), options.duration ?? 3000));
    setToasts(prev => [...prev.filter(t => t.key !== key), { ...options, key, id }]);
  }, [dismiss]);

  useEffect(() => {
    const active = timers.current;
    return () => active.forEach(t => clearTimeout(t));
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.kind ?? 'info'}`}>
            <span>{t.message}</span>
            {t.actionLabel && t.onAction && (
              <button
                type="button"
                className="btn-link"
                onClick={() => { t.onAction?.(); dismiss(t.key); }}
              >
                {t.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
