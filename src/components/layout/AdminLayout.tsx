import React, { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import {
  LayoutDashboard, Package, FolderTree, Boxes, ShoppingCart, Users,
  TicketPercent, Image as ImageIcon, Globe, Settings, MessageSquare,
  Blocks, ArrowLeft, Menu, Truck,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSettings } from '../../contexts/SettingsContext';

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/categories', label: 'Categories', icon: FolderTree },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/discounts', label: 'Discount Codes', icon: TicketPercent },
  { to: '/admin/promotions', label: 'Promotions', icon: ImageIcon },
  { to: '/admin/messages', label: 'Messages', icon: MessageSquare },
  { to: '/admin/website', label: 'Website', icon: Globe },
  { to: '/admin/settings', label: 'Store Settings', icon: Settings },
];

const AdminLayout: React.FC = () => {
  const { storeName } = useSettings();
  const [open, setOpen] = useState(false);

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-white/10">
        <Blocks className="w-7 h-7 text-mint-400" />
        <div>
          <p className="font-display font-extrabold text-cream-50 leading-none">{storeName}</p>
          <p className="text-[10px] font-bold text-mint-400 uppercase tracking-wider">Admin Panel</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-bold transition',
              isActive ? 'bg-mint-500 text-white shadow-soft' : 'text-ink-300 hover:bg-white/5 hover:text-white'
            )}
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-white/10">
        <Link to="/" className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-bold text-ink-300 hover:bg-white/5 hover:text-white transition">
          <ArrowLeft size={18} /> Back to Store
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-ink-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 bg-ink-900 fixed inset-y-0 left-0 z-40">{sidebar}</aside>

      {/* Mobile sidebar */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-ink-950/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-ink-900 animate-slide-up">{sidebar}</aside>
        </div>
      )}

      <div className="flex-1 lg:ml-64 min-w-0">
        <div className="lg:hidden sticky top-0 z-30 bg-ink-900 text-white flex items-center gap-3 px-4 h-14">
          <button onClick={() => setOpen(true)} className="p-2"><Menu size={22} /></button>
          <span className="font-display font-bold">{storeName} Admin</span>
          <Truck size={18} className="ml-auto text-mint-400" />
        </div>
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
