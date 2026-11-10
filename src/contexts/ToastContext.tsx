import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
type Toast = { id: number; type: ToastType; message: string };

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  success: (m: string) => void;
  error: (m: string) => void;
  info: (m: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
const STYLES = {
  success: 'bg-mint-600 text-white',
  error: 'bg-red-500 text-white',
  info: 'bg-ink-800 text-white',
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  const value = {
    toast,
    success: (m: string) => toast(m, 'success'),
    error: (m: string) => toast(m, 'error'),
    info: (m: string) => toast(m, 'info'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full px-4">
        {toasts.map(t => {
          const Icon = ICONS[t.type];
          return (
            <div key={t.id} className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-soft-lg animate-slide-up ${STYLES[t.type]}`}>
              <Icon size={20} className="shrink-0" />
              <span className="text-sm font-semibold flex-1">{t.message}</span>
              <button onClick={() => setToasts(x => x.filter(y => y.id !== t.id))} className="opacity-70 hover:opacity-100">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
