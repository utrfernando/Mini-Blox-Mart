import React from 'react';
import { Boxes, Package, ShoppingCart, Banknote, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

export const AdminHeader: React.FC<{ title: string; subtitle?: string; actions?: React.ReactNode }> = ({ title, subtitle, actions }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
    <div>
      <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink-900">{title}</h1>
      {subtitle && <p className="text-sm text-ink-500 font-semibold mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex gap-2">{actions}</div>}
  </div>
);

export const StatCard: React.FC<{ label: string; value: string; icon?: React.ReactNode; tone?: 'mint' | 'sunshine' | 'lavender' | 'peach' | 'red' | 'ink'; hint?: string }> = ({ label, value, icon, tone = 'mint', hint }) => {
  const tones = {
    mint: 'bg-mint-50 text-mint-600',
    sunshine: 'bg-sunshine-50 text-sunshine-600',
    lavender: 'bg-lavender-50 text-lavender-600',
    peach: 'bg-peach-50 text-peach-600',
    red: 'bg-red-50 text-red-500',
    ink: 'bg-ink-100 text-ink-600',
  };
  return (
    <div className="rounded-4xl border border-ink-100 bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-xs font-extrabold uppercase tracking-wide text-ink-400">{label}</p>
        <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center', tones[tone])}>{icon}</div>
      </div>
      <p className="font-display text-2xl sm:text-3xl font-extrabold text-ink-900 mt-2">{value}</p>
      {hint && <p className="text-xs text-ink-400 font-semibold mt-1">{hint}</p>}
    </div>
  );
};

export const Table: React.FC<{ head: string[]; children: React.ReactNode }> = ({ head, children }) => (
  <div className="rounded-4xl border border-ink-100 bg-white shadow-soft overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="bg-ink-50 text-left">
            {head.map((h, i) => <th key={i} className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-ink-500">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">{children}</tbody>
      </table>
    </div>
  </div>
);

export const Td: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <td className={cn('px-4 py-3 align-middle', className)}>{children}</td>
);

export const stockBadge = (qty: number, threshold: number) =>
  qty <= 0 ? 'bg-red-100 text-red-600' : qty <= threshold ? 'bg-sunshine-100 text-sunshine-700' : 'bg-mint-100 text-mint-700';

export const ADMIN_ICONS = { Boxes, Package, ShoppingCart, Banknote, TrendingUp, AlertTriangle };
