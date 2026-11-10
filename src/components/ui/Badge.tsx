import React from 'react';
import { cn } from '../../lib/utils';

export const Badge: React.FC<{ children: React.ReactNode; color?: 'mint' | 'sunshine' | 'lavender' | 'peach' | 'red' | 'ink' | 'green'; className?: string }> = ({ children, color = 'mint', className }) => {
  const colors = {
    mint: 'bg-mint-100 text-mint-700',
    sunshine: 'bg-sunshine-100 text-sunshine-700',
    lavender: 'bg-lavender-100 text-lavender-700',
    peach: 'bg-peach-100 text-peach-600',
    red: 'bg-red-100 text-red-600',
    green: 'bg-emerald-100 text-emerald-700',
    ink: 'bg-ink-100 text-ink-700',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold', colors[color], className)}>
      {children}
    </span>
  );
};
