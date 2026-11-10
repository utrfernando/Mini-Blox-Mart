import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured, type Product, type Category, type Banner, type HomepageSection } from './supabase';

const PRODUCT_SELECT = '*, category:categories(*), images:product_images(*)';

export type ProductFilters = {
  categorySlug?: string | null;
  categoryId?: string | null;
  query?: string | null;
  filter?: 'new' | 'bestseller' | 'featured' | null;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'name' | null;
  status?: string;
  featuredOnly?: boolean;
  bestsellerOnly?: boolean;
  newOnly?: boolean;
  limit?: number;
};

export function useProducts(filters: ProductFilters = {}, deps: any[] = []) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    (async () => {
      let q = supabase.from('products').select(PRODUCT_SELECT);

      if (filters.status) q = q.eq('status', filters.status);
      else q = q.eq('status', 'published');

      if (filters.categoryId) q = q.eq('category_id', filters.categoryId);
      if (filters.filter === 'new' || filters.newOnly) q = q.eq('is_new', true);
      if (filters.filter === 'bestseller' || filters.bestsellerOnly) q = q.eq('is_best_seller', true);
      if (filters.filter === 'featured' || filters.featuredOnly) q = q.eq('is_featured', true);
      if (filters.query) q = q.or(`name.ilike.%${filters.query}%,description.ilike.%${filters.query}%,sku.ilike.%${filters.query}%`);

      switch (filters.sort) {
        case 'price_asc': q = q.order('selling_price', { ascending: true }); break;
        case 'price_desc': q = q.order('selling_price', { ascending: false }); break;
        case 'name': q = q.order('name', { ascending: true }); break;
        default: q = q.order('created_at', { ascending: false });
      }

      const { data, error: err } = await q.limit(filters.limit ?? 60);
      if (cancelled) return;
      if (err) { setError(err.message); setProducts([]); }
      else {
        let list = (data || []) as unknown as Product[];
        // category slug filter requires join lookup — resolve via categories table
        setProducts(list);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { products, loading, error };
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    supabase.from('categories').select('*').eq('is_active', true).order('sort_order').then(({ data }) => {
      setCategories((data || []) as Category[]);
      setLoading(false);
    });
  }, []);
  return { categories, loading };
}

export function useBanners(placement = 'home_hero') {
  const [banners, setBanners] = useState<Banner[]>([]);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.from('banners').select('*').eq('is_active', true).eq('placement', placement).order('sort_order').then(({ data }) => {
      setBanners((data || []) as Banner[]);
    });
  }, [placement]);
  return banners;
}

export function useHomepageSections() {
  const [sections, setSections] = useState<HomepageSection[]>([]);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.from('homepage_sections').select('*').order('sort_order').then(({ data }) => {
      setSections((data || []) as HomepageSection[]);
    });
  }, []);
  return sections;
}

export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('id', id)
    .single();
  if (error) return null;
  return data as unknown as Product;
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  let q = supabase.from('products').select(PRODUCT_SELECT).eq('status', 'published').neq('id', product.id);
  if (product.category_id) q = q.eq('category_id', product.category_id);
  const { data } = await q.limit(limit);
  let list = (data || []) as unknown as Product[];
  if (list.length < limit && product.category_id) {
    const { data: more } = await supabase.from('products').select(PRODUCT_SELECT)
      .eq('status', 'published').neq('id', product.id).neq('category_id', product.category_id).limit(limit - list.length);
    list = [...list, ...((more || []) as unknown as Product[])];
  }
  return list;
}

// Resolve category slug -> id once for shop filtering
export async function getCategoryIdBySlug(slug: string): Promise<string | null> {
  const { data } = await supabase.from('categories').select('id').eq('slug', slug).maybeSingle();
  return data?.id ?? null;
}
