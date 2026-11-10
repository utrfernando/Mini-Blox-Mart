import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  wide?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, wide }) => {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative w-full bg-white rounded-t-4xl sm:rounded-4xl shadow-soft-lg max-h-[92vh] overflow-y-auto animate-slide-up', wide ? 'sm:max-w-4xl' : 'sm:max-w-lg')}>
        <div className="sticky top-0 bg-white/95 backdrop-blur px-6 py-4 border-b border-ink-100 flex items-center justify-between z-10 rounded-t-4xl">
          <h3 className="font-display text-xl font-bold text-ink-900">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-ink-100 text-ink-500"><X size={20} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};
