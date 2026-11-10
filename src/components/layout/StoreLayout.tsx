import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, Heart, User, Menu, X, Mail, Phone, MapPin, Blocks, ChevronDown, LogOut } from 'lucide-react';
import { FaInstagram, FaTiktok, FaFacebookF } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, isSupabaseConfigured, type Category } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useSettings } from '../../contexts/SettingsContext';
import { cn } from '../../lib/utils';

// ------------------------------------------------------------------
// Announcement bar
// ------------------------------------------------------------------
const AnnouncementBar: React.FC = () => {
  const { settings, freeDeliveryThreshold, deliveryFee, currencySymbol } = useSettings();
  const msg = `Free delivery on orders over ${currencySymbol} ${freeDeliveryThreshold.toLocaleString()} · Otherwise just ${currencySymbol} ${deliveryFee}`;
  return (
    <div className="bg-ink-900 text-cream-100 text-xs sm:text-sm font-semibold overflow-hidden">
      <div className="animate-marquee whitespace-nowrap py-2 flex gap-12">
        {[0, 1].map(i => (
          <span key={i} className="flex gap-12">
            <span>{msg}</span><span>✦</span><span>{settings.store?.tagline}</span><span>✦</span>
            <span>New arrivals every week — follow us for cute surprises!</span><span>✦</span>
          </span>
        ))}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// Header
// ------------------------------------------------------------------
const Header: React.FC = () => {
  const { user, signOut, isAdmin } = useAuth();
  const { count } = useCart();
  const { storeName, tagline, settings } = useSettings();
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const navigate = useNavigate();
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.from('categories').select('*').eq('is_active', true).order('sort_order').then(({ data }) => {
      if (data) setCategories(data as Category[]);
    });
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/shop?q=${encodeURIComponent(query.trim())}`);
    setMobileOpen(false);
  };

  const navLinks = [
    { to: '/shop', label: 'Shop All' },
    ...categories.slice(0, 4).map(c => ({ to: `/shop?category=${c.slug}`, label: c.name })),
    { to: '/shop?filter=new', label: 'New Arrivals' },
    { to: '/shop?filter=bestseller', label: 'Best Sellers' },
  ];

  const logo = settings.branding?.logo_url;

  return (
    <header className="sticky top-0 z-50 bg-cream-50/90 backdrop-blur-md border-b border-ink-100">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-3 h-16 sm:h-20">
          <button className="lg:hidden p-2 -ml-2 text-ink-700" onClick={() => setMobileOpen(true)} aria-label="Menu">
            <Menu size={24} />
          </button>

          <Link to="/" className="flex items-center gap-2 shrink-0">
            {logo ? (
              <img src={logo} alt={storeName} className="h-9 w-auto" />
            ) : (
              <span className="flex items-center gap-1.5">
                <Blocks className="w-8 h-8 text-mint-500" strokeWidth={2.2} />
                <span className="font-display text-2xl font-extrabold text-ink-900 tracking-tight">{storeName}</span>
              </span>
            )}
          </Link>
          <span className="hidden xl:block text-xs font-bold text-peach-500 -ml-1 mt-1">{tagline}</span>

          {/* Desktop search */}
          <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-md mx-auto">
            <div className="relative w-full">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search mini figures, flowers, gifts..."
                className="w-full rounded-full border-2 border-ink-100 bg-white pl-11 pr-4 py-2.5 text-sm font-semibold text-ink-900 placeholder-ink-300 focus:border-mint-400 focus:ring-2 focus:ring-mint-100 transition"
              />
            </div>
          </form>

          <div className="flex items-center gap-1 sm:gap-2 ml-auto">
            <Link to="/wishlist" className="p-2.5 rounded-full hover:bg-mint-50 text-ink-700 transition" aria-label="Wishlist">
              <Heart size={22} />
            </Link>
            <Link to="/cart" className="relative p-2.5 rounded-full hover:bg-mint-50 text-ink-700 transition" aria-label="Cart">
              <ShoppingBag size={22} />
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1 rounded-full bg-sunshine-400 text-ink-900 text-[11px] font-extrabold flex items-center justify-center border-2 border-cream-50">
                  {count}
                </span>
              )}
            </Link>
            <div className="relative" ref={accountRef}>
              <button onClick={() => setAccountOpen(o => !o)} className="p-2.5 rounded-full hover:bg-mint-50 text-ink-700 transition flex items-center gap-1" aria-label="Account">
                <User size={22} />
                <ChevronDown size={14} className={cn('hidden sm:block transition-transform', accountOpen && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {accountOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    className="absolute right-0 mt-2 w-56 rounded-3xl bg-white border border-ink-100 shadow-soft-lg p-2 z-50"
                  >
                    {user ? (
                      <>
                        <div className="px-3 py-2 border-b border-ink-100 mb-1">
                          <p className="font-bold text-ink-900 truncate">{user.full_name || user.email}</p>
                          <p className="text-xs text-ink-400 truncate">{user.email}</p>
                        </div>
                        <MenuLink to="/account" label="My Account" onClick={() => setAccountOpen(false)} />
                        <MenuLink to="/account/orders" label="My Orders" onClick={() => setAccountOpen(false)} />
                        <MenuLink to="/wishlist" label="Wishlist" onClick={() => setAccountOpen(false)} />
                        {isAdmin && <MenuLink to="/admin" label="Admin Dashboard" accent onClick={() => setAccountOpen(false)} />}
                        <button onClick={async () => { await signOut(); setAccountOpen(false); navigate('/'); }} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl text-sm font-bold text-red-500 hover:bg-red-50">
                          <LogOut size={16} /> Sign Out
                        </button>
                      </>
                    ) : (
                      <>
                        <MenuLink to="/login" label="Sign In" onClick={() => setAccountOpen(false)} />
                        <MenuLink to="/register" label="Create Account" onClick={() => setAccountOpen(false)} />
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1 pb-3 overflow-x-auto">
          {navLinks.map(l => (
            <NavLink
              key={l.to + l.label}
              to={l.to}
              className={({ isActive }) => cn(
                'px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition',
                isActive ? 'bg-mint-500 text-white' : 'text-ink-700 hover:bg-mint-50 hover:text-mint-700'
              )}
            >
              {l.label}
            </NavLink>
          ))}
          <NavLink to="/contact" className={({ isActive }) => cn('px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition', isActive ? 'bg-lavender-500 text-white' : 'text-ink-700 hover:bg-lavender-50 hover:text-lavender-600')}>
            Contact
          </NavLink>
        </nav>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-ink-950/50 z-[60]" onClick={() => setMobileOpen(false)} />
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 28 }} className="fixed inset-y-0 left-0 w-80 bg-cream-50 z-[70] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-ink-100">
                <span className="font-display text-xl font-extrabold text-ink-900">{storeName}</span>
                <button onClick={() => setMobileOpen(false)} className="p-2 rounded-full hover:bg-ink-100"><X size={22} /></button>
              </div>
              <form onSubmit={submitSearch} className="p-4">
                <div className="relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search..." className="w-full rounded-full border-2 border-ink-100 bg-white pl-11 pr-4 py-2.5 text-sm font-semibold focus:border-mint-400" />
                </div>
              </form>
              <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
                {navLinks.map(l => (
                  <NavLink key={l.label} to={l.to} onClick={() => setMobileOpen(false)} className={({ isActive }) => cn('block px-4 py-3 rounded-2xl font-bold', isActive ? 'bg-mint-500 text-white' : 'text-ink-800 hover:bg-mint-50')}>
                    {l.label}
                  </NavLink>
                ))}
                <NavLink to="/about" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-2xl font-bold text-ink-800 hover:bg-mint-50">About Us</NavLink>
                <NavLink to="/faq" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-2xl font-bold text-ink-800 hover:bg-mint-50">FAQ</NavLink>
                <NavLink to="/contact" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-2xl font-bold text-ink-800 hover:bg-mint-50">Contact Us</NavLink>
              </nav>
              <div className="p-4 border-t border-ink-100 space-y-2">
                {user ? (
                  <>
                    <Link to="/account" onClick={() => setMobileOpen(false)} className="block w-full text-center rounded-full bg-mint-500 text-white font-bold py-3">My Account</Link>
                    {isAdmin && <Link to="/admin" onClick={() => setMobileOpen(false)} className="block w-full text-center rounded-full bg-lavender-500 text-white font-bold py-3">Admin Dashboard</Link>}
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setMobileOpen(false)} className="block w-full text-center rounded-full border-2 border-mint-500 text-mint-700 font-bold py-3">Sign In</Link>
                    <Link to="/register" onClick={() => setMobileOpen(false)} className="block w-full text-center rounded-full bg-sunshine-400 text-ink-900 font-bold py-3">Create Account</Link>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
};

const MenuLink: React.FC<{ to: string; label: string; onClick: () => void; accent?: boolean }> = ({ to, label, onClick, accent }) => (
  <Link to={to} onClick={onClick} className={cn('block px-3 py-2.5 rounded-2xl text-sm font-bold transition', accent ? 'text-lavender-600 hover:bg-lavender-50' : 'text-ink-800 hover:bg-mint-50')}>
    {label}
  </Link>
);

// ------------------------------------------------------------------
// Footer
// ------------------------------------------------------------------
const Footer: React.FC = () => {
  const { storeName, tagline, settings, currencySymbol } = useSettings();
  const store = settings.store || {};
  const social = store.social || {};
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-ink-900 text-cream-100">
      <div className="max-w-7xl mx-auto px-4 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Blocks className="w-8 h-8 text-mint-400" />
            <span className="font-display text-2xl font-extrabold">{storeName}</span>
          </div>
          <p className="text-ink-300 text-sm mb-4">{tagline}</p>
          <p className="text-ink-400 text-sm">Mini building blocks, flower sets and creative gifts — handcrafted joy, delivered across Sri Lanka.</p>
          <div className="flex gap-2 mt-5">
            {social.instagram && <a href={social.instagram} target="_blank" rel="noreferrer" className="p-2.5 rounded-full bg-white/10 hover:bg-mint-500 transition"><FaInstagram size={17} /></a>}
            {social.tiktok && <a href={social.tiktok} target="_blank" rel="noreferrer" className="p-2.5 rounded-full bg-white/10 hover:bg-ink-950 transition"><FaTiktok size={16} /></a>}
            {social.facebook && <a href={social.facebook} target="_blank" rel="noreferrer" className="p-2.5 rounded-full bg-white/10 hover:bg-sky-600 transition"><FaFacebookF size={15} /></a>}
          </div>
        </div>

        <div>
          <h4 className="font-display font-bold text-lg mb-4 text-sunshine-300">Shop</h4>
          <ul className="space-y-2.5 text-sm text-ink-300">
            <li><Link to="/shop" className="hover:text-mint-300 transition">All Products</Link></li>
            <li><Link to="/shop?filter=new" className="hover:text-mint-300 transition">New Arrivals</Link></li>
            <li><Link to="/shop?filter=bestseller" className="hover:text-mint-300 transition">Best Sellers</Link></li>
            <li><Link to="/shop?filter=featured" className="hover:text-mint-300 transition">Featured</Link></li>
            <li><Link to="/wishlist" className="hover:text-mint-300 transition">Wishlist</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display font-bold text-lg mb-4 text-sunshine-300">Help</h4>
          <ul className="space-y-2.5 text-sm text-ink-300">
            <li><Link to="/faq" className="hover:text-mint-300 transition">FAQ</Link></li>
            <li><Link to="/shipping-policy" className="hover:text-mint-300 transition">Shipping Policy</Link></li>
            <li><Link to="/return-policy" className="hover:text-mint-300 transition">Return Policy</Link></li>
            <li><Link to="/contact" className="hover:text-mint-300 transition">Contact Us</Link></li>
            <li><Link to="/about" className="hover:text-mint-300 transition">About {storeName}</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display font-bold text-lg mb-4 text-sunshine-300">Get in Touch</h4>
          <ul className="space-y-3 text-sm text-ink-300">
            {store.address && <li className="flex gap-2.5"><MapPin size={17} className="text-mint-400 shrink-0 mt-0.5" />{store.address}</li>}
            {store.contact_email && <li className="flex gap-2.5"><Mail size={17} className="text-mint-400 shrink-0 mt-0.5" /><a href={`mailto:${store.contact_email}`} className="hover:text-mint-300">{store.contact_email}</a></li>}
            {store.contact_phone && <li className="flex gap-2.5"><Phone size={17} className="text-mint-400 shrink-0 mt-0.5" /><a href={`tel:${store.contact_phone}`} className="hover:text-mint-300">{store.contact_phone}</a></li>}
          </ul>
          <div className="mt-5 rounded-3xl bg-white/5 p-4 text-xs text-ink-400">
            We accept <span className="font-bold text-cream-100">Cash on Delivery</span> and <span className="font-bold text-cream-100">Bank Transfer</span>. All prices in {currencySymbol} {store.currency || 'LKR'}.
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-400">
          <p>© {year} {storeName}. All rights reserved.</p>
          <div className="flex gap-5">
            <Link to="/privacy-policy" className="hover:text-mint-300">Privacy</Link>
            <Link to="/terms" className="hover:text-mint-300">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

// ------------------------------------------------------------------
// Layout
// ------------------------------------------------------------------
const StoreLayout: React.FC = () => (
  <div className="flex flex-col min-h-screen bg-cream-50">
    <AnnouncementBar />
    <Header />
    <main className="flex-1">
      <Outlet />
    </main>
    <Footer />
  </div>
);

export default StoreLayout;
