import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Blocks, Flower2, Gift, PartyPopper, Sparkles, Truck,
  ShieldCheck, Headphones, RefreshCcw, Send, Star, Quote,
} from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useProducts, useCategories, useBanners, useHomepageSections } from '../lib/queries';
import { supabase, isSupabaseConfigured, type Banner } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import ProductCard from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'building-blocks': <Blocks size={34} strokeWidth={1.8} />,
  'flower-collections': <Flower2 size={34} strokeWidth={1.8} />,
  collectibles: <Sparkles size={34} strokeWidth={1.8} />,
  'creative-gifts': <Gift size={34} strokeWidth={1.8} />,
  'party-fun': <PartyPopper size={34} strokeWidth={1.8} />,
};
const CATEGORY_COLORS = ['bg-mint-100 text-mint-600', 'bg-sunshine-100 text-sunshine-600', 'bg-lavender-100 text-lavender-600', 'bg-peach-100 text-peach-500', 'bg-cream-200 text-ink-600'];

// ------------------------------------------------------------------
const Hero: React.FC<{ banners: Banner[] }> = ({ banners }) => {
  const { tagline } = useSettings();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % banners.length), 6000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (banners.length > 0) {
    const b = banners[idx % banners.length];
    return (
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
          <motion.div
            key={b.id}
            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}
            className="relative rounded-[2.5rem] overflow-hidden min-h-[380px] sm:min-h-[440px] flex items-center"
          >
            {b.image_url ? (
              <img src={b.image_url} alt={b.title} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-mint-400 via-mint-300 to-sunshine-200" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-ink-950/60 via-ink-950/30 to-transparent" />
            <div className="relative p-8 sm:p-14 max-w-xl text-white">
              <span className="inline-block rounded-full bg-white/20 backdrop-blur px-4 py-1 text-xs font-bold mb-4">{tagline}</span>
              <h1 className="font-display text-4xl sm:text-5xl font-extrabold leading-tight mb-3">{b.title}</h1>
              {b.subtitle && <p className="text-white/85 text-lg mb-6">{b.subtitle}</p>}
              {b.cta_label && (
                <Link to={b.cta_link || '/shop'}>
                  <Button variant="sunshine" size="lg">{b.cta_label} <ArrowRight size={18} /></Button>
                </Link>
              )}
            </div>
          </motion.div>
          {banners.length > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {banners.map((_, i) => (
                <button key={i} onClick={() => setIdx(i)} className={`h-2.5 rounded-full transition-all ${i === idx ? 'w-8 bg-mint-500' : 'w-2.5 bg-ink-200'}`} />
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  // Default hero when no banners configured
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-mint-400 via-mint-300 to-sunshine-200">
      <div className="absolute inset-0 bg-dots opacity-30" />
      <div className="max-w-7xl mx-auto px-4 py-16 sm:py-24 grid lg:grid-cols-2 gap-10 items-center relative">
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
          <span className="inline-block rounded-full bg-white/30 backdrop-blur px-4 py-1.5 text-sm font-bold text-ink-900 mb-5">{tagline}</span>
          <h1 className="font-display text-5xl sm:text-6xl font-extrabold text-ink-900 leading-[1.05] mb-5">
            Tiny Blocks,<br />Huge <span className="text-peach-600">Smiles</span>
          </h1>
          <p className="text-ink-800/80 text-lg max-w-md mb-8">
            Discover adorable mini building-block figures, build-it-yourself flower sets and delightful gifts — made for collectors and dreamers across Sri Lanka.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/shop"><Button variant="sunshine" size="lg">Shop Now <ArrowRight size={18} /></Button></Link>
            <Link to="/shop?filter=new"><Button variant="outline" size="lg" className="bg-white/60 border-ink-900/20 text-ink-900 hover:bg-white">New Arrivals</Button></Link>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.15 }} className="relative hidden lg:block">
          <div className="grid grid-cols-2 gap-4">
            {['from-lavender-300 to-lavender-100', 'from-sunshine-300 to-sunshine-100', 'from-peach-300 to-peach-100', 'from-mint-300 to-mint-100'].map((g, i) => (
              <motion.div
                key={i}
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: 'easeInOut' }}
                className={`aspect-square rounded-[2rem] bg-gradient-to-br ${g} shadow-soft-lg flex items-center justify-center border-4 border-white/60`}
              >
                <Blocks size={64} className="text-ink-900/25" strokeWidth={1.4} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// ------------------------------------------------------------------
const ProductRow: React.FC<{ title: string; subtitle?: string; products: any[]; loading: boolean; viewAll?: string }> = ({ title, subtitle, products, loading, viewAll }) => {
  if (!loading && products.length === 0) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-ink-900">{title}</h2>
          {subtitle && <p className="text-ink-500 mt-1">{subtitle}</p>}
        </div>
        {viewAll && <Link to={viewAll} className="hidden sm:inline-flex items-center gap-1.5 font-bold text-mint-600 hover:text-mint-700 transition">View all <ArrowRight size={16} /></Link>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
          : products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
      </div>
      {viewAll && <Link to={viewAll} className="sm:hidden mt-5 inline-flex items-center gap-1.5 font-bold text-mint-600">View all <ArrowRight size={16} /></Link>}
    </section>
  );
};

const TESTIMONIALS = [
  { name: 'Nadeesha P.', city: 'Colombo', text: 'The flower-building sets are SO satisfying. My daughter plays with them every day and they still look brand new!', rating: 5 },
  { name: 'Tharindu M.', city: 'Kandy', text: 'Ordered a birthday gift for my niece — she screamed with joy. Delivery was fast and packaging was adorable.', rating: 5 },
  { name: 'Ayesha R.', city: 'Galle', text: 'Finally a local store with genuinely cute collectibles. The mini figures are high quality for the price.', rating: 5 },
  { name: 'Kavindu S.', city: 'Negombo', text: 'Cash on delivery made it so easy. Will definitely be ordering again — the new arrivals are always exciting.', rating: 4 },
];

// ------------------------------------------------------------------
const Home: React.FC = () => {
  const { sectionVisible, storeName } = useSettings();
  const dbSections = useHomepageSections();
  const { categories } = useCategories();
  const heroBanners = useBanners('home_hero');
  const promoBanners = useBanners('home_promo');
  const featured = useProducts({ featuredOnly: true, limit: 8 }, []);
  const bestsellers = useProducts({ bestsellerOnly: true, limit: 8 }, []);
  const newArrivals = useProducts({ newOnly: true, limit: 8 }, []);
  const [email, setEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const { success, error } = useToast();

  const secVisible = (key: string) => {
    if (dbSections.length === 0) return sectionVisible(key);
    const s = dbSections.find(x => x.section_key === key);
    return s ? s.is_visible : true;
  };

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribing(true);
    if (isSupabaseConfigured) {
      const { error: err } = await supabase.from('newsletter_subscribers').insert({ email: email.trim() });
      setSubscribing(false);
      if (err && !err.message.includes('duplicate')) { error('Could not subscribe. Please try again.'); return; }
    }
    success("You're subscribed! Check your inbox for cute surprises.");
    setEmail('');
  };

  return (
    <div>
      {secVisible('hero') && <Hero banners={heroBanners} />}

      {/* Shop by Category */}
      {secVisible('categories') && categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-14">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-ink-900">Shop by Category</h2>
            <p className="text-ink-500 mt-2">Find your next favourite little world</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {categories.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
                <Link to={`/shop?category=${c.slug}`} className="group flex flex-col items-center gap-3 rounded-4xl border border-ink-100 bg-white p-6 hover:shadow-soft-lg hover:-translate-y-1 transition-all duration-300">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]} group-hover:scale-110 transition-transform`}>
                    {CATEGORY_ICONS[c.slug] || <Blocks size={30} />}
                  </div>
                  <span className="font-display font-bold text-ink-900 text-center">{c.name}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {secVisible('featured') && (
        <div className="bg-mint-50/60 -mx-4 sm:mx-0"><ProductRow title="Featured Products" subtitle="Hand-picked favourites" products={featured.products} loading={featured.loading} viewAll="/shop?filter=featured" /></div>
      )}
      {secVisible('bestsellers') && (
        <ProductRow title="Best Sellers" subtitle="Loved by our community" products={bestsellers.products} loading={bestsellers.loading} viewAll="/shop?filter=bestseller" />
      )}
      {secVisible('newarrivals') && (
        <div className="bg-sunshine-50/60 -mx-4 sm:mx-0"><ProductRow title="New Arrivals" subtitle="Fresh off the shelf" products={newArrivals.products} loading={newArrivals.loading} viewAll="/shop?filter=new" /></div>
      )}

      {/* Promo banners */}
      {secVisible('promo') && promoBanners.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-10 space-y-4">
          {promoBanners.slice(0, 2).map(b => (
            <motion.div key={b.id} whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 20 }} viewport={{ once: true }} className="relative rounded-[2rem] overflow-hidden">
              {b.image_url ? <img src={b.image_url} alt={b.title} className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0 bg-gradient-to-r from-lavender-500 to-peach-400" />}
              <div className="absolute inset-0 bg-ink-950/30" />
              <div className="relative px-8 py-10 sm:py-14 max-w-lg text-white">
                <h3 className="font-display text-3xl font-extrabold mb-2">{b.title}</h3>
                {b.subtitle && <p className="mb-5 text-white/85">{b.subtitle}</p>}
                {b.cta_label && <Link to={b.cta_link || '/shop'}><Button variant="sunshine">{b.cta_label}</Button></Link>}
              </div>
            </motion.div>
          ))}
        </section>
      )}

      {/* Why shop with us */}
      {secVisible('whyus') && (
        <section className="bg-white border-y border-ink-100">
          <div className="max-w-7xl mx-auto px-4 py-14">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-ink-900 text-center mb-10">Why Shop With {storeName}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: <Truck size={30} />, title: 'Island-wide Delivery', desc: 'Fast, careful delivery anywhere in Sri Lanka' },
                { icon: <ShieldCheck size={30} />, title: 'Quality Guaranteed', desc: 'Every piece checked before it ships' },
                { icon: <RefreshCcw size={30} />, title: 'Easy Returns', desc: 'Hassle-free returns within 7 days' },
                { icon: <Headphones size={30} />, title: 'Friendly Support', desc: 'Real humans, always happy to help' },
              ].map((f, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="text-center p-6 rounded-4xl bg-cream-100/60">
                  <div className="w-14 h-14 mx-auto rounded-full bg-white shadow-soft flex items-center justify-center text-mint-600 mb-4">{f.icon}</div>
                  <h3 className="font-display font-bold text-ink-900 mb-1">{f.title}</h3>
                  <p className="text-sm text-ink-500">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {secVisible('testimonials') && (
        <section className="max-w-7xl mx-auto px-4 py-14">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-ink-900 text-center mb-10">What Our Customers Say</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }} className="rounded-4xl border border-ink-100 bg-white p-6 shadow-soft">
                <Quote size={26} className="text-sunshine-400 mb-3" fill="currentColor" />
                <div className="flex gap-0.5 mb-3">{Array.from({ length: t.rating }).map((_, j) => <Star key={j} size={15} className="text-sunshine-400" fill="currentColor" />)}</div>
                <p className="text-sm text-ink-700 mb-4 leading-relaxed">"{t.text}"</p>
                <p className="font-bold text-ink-900 text-sm">{t.name} <span className="text-ink-400 font-semibold">· {t.city}</span></p>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Newsletter */}
      {secVisible('newsletter') && (
        <section className="max-w-7xl mx-auto px-4 pb-16">
          <div className="relative rounded-[2.5rem] bg-gradient-to-r from-lavender-500 to-lavender-400 overflow-hidden px-8 py-12 sm:py-16 text-center text-white">
            <div className="absolute inset-0 bg-dots opacity-20" />
            <div className="relative max-w-xl mx-auto">
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold mb-3">Stay in the Loop</h2>
              <p className="text-white/85 mb-7">Get early access to new arrivals, subscriber-only discounts and the cutest building-block inspo.</p>
              <form onSubmit={subscribe} className="flex flex-col sm:flex-row gap-3">
                <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="flex-1 bg-white/95 border-transparent" />
                <Button type="submit" variant="sunshine" size="lg" loading={subscribing}><Send size={18} /> Subscribe</Button>
              </form>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default Home;
