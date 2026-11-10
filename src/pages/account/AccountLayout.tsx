import React, { useState } from 'react';
import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { User, Package, MapPin, Heart, Menu, X, Blocks } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';

const LINKS = [
  { to: '/account', label: 'Profile', icon: User, end: true },
  { to: '/account/orders', label: 'My Orders', icon: Package },
  { to: '/account/addresses', label: 'Addresses', icon: MapPin },
  { to: '/wishlist', label: 'Wishlist', icon: Heart },
];

const AccountLayout: React.FC = () => {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) return <div className="flex-1 flex items-center justify-center py-32 text-ink-400 font-bold">Loading…</div>;
  if (!user) return <Navigate to="/login?next=/account" replace />;

  const nav = (
    <div className="space-y-1">
      {LINKS.map(l => (
        <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setOpen(false)}
          className={({ isActive }) => cn('flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition', isActive ? 'bg-mint-500 text-white shadow-soft' : 'text-ink-700 hover:bg-mint-50')}>
          <l.icon size={18} /> {l.label}
        </NavLink>
      ))}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full">
      <div className="flex items-center gap-3 mb-6 lg:hidden">
        <button onClick={() => setOpen(true)} className="p-2 rounded-full border border-ink-100"><Menu size={20} /></button>
        <h1 className="font-display text-2xl font-extrabold text-ink-900">My Account</h1>
      </div>

      {open && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setOpen(false)} />
          <div className="absolute left-0 inset-y-0 w-72 bg-white p-5">
            <div className="flex items-center justify-between mb-6">
              <span className="font-display font-extrabold text-xl flex items-center gap-2"><Blocks className="text-mint-500" size={24} /> Account</span>
              <button onClick={() => setOpen(false)} className="p-2 rounded-full hover:bg-ink-100"><X size={20} /></button>
            </div>
            {nav}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[240px_1fr] gap-8">
        <aside className="hidden lg:block">
          <div className="sticky top-28 rounded-4xl border border-ink-100 bg-white p-4 shadow-soft">
            <div className="flex items-center gap-3 px-2 pb-4 mb-3 border-b border-ink-100">
              <div className="w-11 h-11 rounded-full bg-mint-100 text-mint-700 flex items-center justify-center font-display font-extrabold">
                {(user.full_name || user.email || '?')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-ink-900 truncate">{user.full_name || 'Customer'}</p>
                <p className="text-xs text-ink-400 truncate">{user.email}</p>
              </div>
            </div>
            {nav}
          </div>
        </aside>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AccountLayout;
