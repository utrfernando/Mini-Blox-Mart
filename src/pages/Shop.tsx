import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { supabase, isSupabaseConfigured, type Category } from '../lib/supabase';
import { useProducts } from '../lib/queries';
import ProductCard from '../components/ProductCard';
import { ProductCardSkeleton, EmptyState, SearchEmpty } from '../components/ui/Feedback';
import { Select } from '../components/ui/Input';
import { cn } from '../lib/utils';

const FILTERS = [
  { key: '', label: 'All Products' },
  { key: 'new', label: 'New Arrivals' },
  { key: 'bestseller', label: 'Best Sellers' },
  { key: 'featured', label: 'Featured' },
];

const Shop: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const categorySlug = params.get('category') || '';
  const filter = (params.get('filter') || '') as any;
  const sort = params.get('sort') || 'newest';

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [mobileFilters, setMobileFilters] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.from('categories').select('*').eq('is_active', true).order('sort_order')
      .then(({ data }) => setCategories((data || []) as Category[]));
  }, []);

  useEffect(() => {
    if (!categorySlug) { setCategoryId(null); return; }
    supabase.from('categories').select('id').eq('slug', categorySlug).maybeSingle()
      .then(({ data }) => setCategoryId(data?.id ?? null));
  }, [categorySlug]);

  const { products, loading } = useProducts({
    categoryId, query: q || null,
    filter: filter || null,
    sort: (sort as any) || 'newest',
  }, [categoryId, q, filter, sort]);

  const activeCategory = categories.find(c => c.slug === categorySlug);
  const pageTitle = activeCategory?.name || (filter === 'new' ? 'New Arrivals' : filter === 'bestseller' ? 'Best Sellers' : filter === 'featured' ? 'Featured Products' : 'Shop All');

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };

  const clearAll = () => setParams(new URLSearchParams());

  const filterPanel = (
    <div className="space-y-6">
      <div>
        <h4 className="font-display font-bold text-ink-900 mb-3">Collections</h4>
        <div className="space-y-1">
          <button onClick={() => { setParam('category', ''); setParam('filter', ''); }} className={cn('block w-full text-left px-3 py-2 rounded-xl text-sm font-bold transition', !categorySlug && !filter ? 'bg-mint-100 text-mint-700' : 'text-ink-600 hover:bg-ink-50')}>
            All Products
          </button>
          {categories.map(c => (
            <button key={c.id} onClick={() => { setParam('category', c.slug); setParam('filter', ''); }} className={cn('block w-full text-left px-3 py-2 rounded-xl text-sm font-bold transition', categorySlug === c.slug ? 'bg-mint-100 text-mint-700' : 'text-ink-600 hover:bg-ink-50')}>
              {c.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h4 className="font-display font-bold text-ink-900 mb-3">Quick Filters</h4>
        <div className="flex flex-wrap gap-2">
          {FILTERS.slice(1).map(f => (
            <button key={f.key} onClick={() => { setParam('filter', filter === f.key ? '' : f.key); setParam('category', ''); }}
              className={cn('px-3.5 py-1.5 rounded-full text-xs font-bold border-2 transition', filter === f.key ? 'bg-sunshine-400 border-sunshine-400 text-ink-900' : 'border-ink-100 text-ink-600 hover:border-mint-300')}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb / header */}
      <div className="mb-6">
        <p className="text-sm text-ink-400 font-semibold"><Link to="/" className="hover:text-mint-600">Home</Link> / Shop{activeCategory ? ` / ${activeCategory.name}` : ''}</p>
        <div className="flex items-end justify-between mt-2">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-ink-900">{pageTitle}</h1>
            {q && <p className="text-ink-500 mt-1">Results for "{q}"</p>}
          </div>
          <button onClick={() => setMobileFilters(true)} className="lg:hidden inline-flex items-center gap-2 rounded-full border-2 border-ink-100 px-4 py-2 text-sm font-bold text-ink-700">
            <SlidersHorizontal size={16} /> Filters
          </button>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-28 rounded-4xl border border-ink-100 bg-white p-5">{filterPanel}</div>
        </aside>

        {/* Mobile filter drawer */}
        {mobileFilters && (
          <div className="fixed inset-0 z-[80] lg:hidden">
            <div className="absolute inset-0 bg-ink-950/50" onClick={() => setMobileFilters(false)} />
            <div className="absolute right-0 inset-y-0 w-80 bg-white p-5 overflow-y-auto animate-slide-up">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-bold text-xl">Filters</h3>
                <button onClick={() => setMobileFilters(false)} className="p-2 rounded-full hover:bg-ink-100"><X size={20} /></button>
              </div>
              {filterPanel}
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Sort bar */}
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-ink-500 font-semibold">{loading ? 'Loading…' : `${products.length} product${products.length === 1 ? '' : 's'}`}</p>
            <Select value={sort} onChange={e => setParam('sort', e.target.value)} className="!w-auto !py-2 text-sm font-bold rounded-full">
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="name">Name A–Z</option>
            </Select>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
              {Array.from({ length: 9 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : products.length === 0 ? (
            q ? <SearchEmpty onReset={clearAll} /> : <EmptyState title="No products here yet" message="Check back soon — we're adding new cute things all the time." />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
              {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Shop;
