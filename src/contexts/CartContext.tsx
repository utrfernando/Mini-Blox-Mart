import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured, unitPrice, type Product } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type CartItem = {
  product: Product;
  quantity: number;
};

interface CartContextType {
  items: CartItem[];
  count: number;
  subtotal: number;
  wishlistIds: string[];
  wishlistItems: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  toggleWishlist: (product: Product) => Promise<boolean>;
  isWishlisted: (productId: string) => boolean;
  loading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_KEY = 'miniblox_cart_v1';
const WISHLIST_KEY = 'miniblox_wishlist_v1';

const readLS = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authUserId } = useAuth();
  const [items, setItems] = useState<CartItem[]>(() => readLS<CartItem[]>(CART_KEY, []));
  const [wishlist, setWishlist] = useState<CartItem[]>(() => readLS<CartItem[]>(WISHLIST_KEY, []));
  const [synced, setSynced] = useState(false);

  // Persist to localStorage for guests
  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);
  useEffect(() => {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
  }, [wishlist]);

  // Load server cart/wishlist once per login
  useEffect(() => {
    if (!isSupabaseConfigured || !authUserId || synced) return;
    (async () => {
      const [{ data: cart }, { data: wl }] = await Promise.all([
        supabase.from('carts').select('id').eq('user_id', authUserId).maybeSingle(),
        supabase.from('wishlists').select('id').eq('user_id', authUserId).maybeSingle(),
      ]);

      if (cart?.id) {
        const { data: rows } = await supabase
          .from('cart_items')
          .select('quantity, products(*)')
          .eq('cart_id', cart.id);
        if (rows?.length) {
          setItems(rows
            .filter(r => r.products && (r.products as any).status === 'published')
            .map(r => ({ product: r.products as unknown as Product, quantity: r.quantity })));
        }
      }
      if (wl?.id) {
        const { data: rows } = await supabase
          .from('wishlist_items')
          .select('products(*)')
          .eq('wishlist_id', wl.id);
        if (rows?.length) {
          setWishlist(rows
            .filter(r => r.products)
            .map(r => ({ product: r.products as unknown as Product, quantity: 1 })));
        }
      }
      setSynced(true);
    })();
  }, [authUserId, synced]);

  // Sync cart to DB for logged-in users (fire-and-forget)
  const syncCartToDb = useCallback(async (next: CartItem[]) => {
    if (!isSupabaseConfigured || !authUserId) return;
    const { data: cart } = await supabase.from('carts').upsert(
      { user_id: authUserId }, { onConflict: 'user_id' }
    ).select('id').single();
    if (!cart) return;
    await supabase.from('cart_items').delete().eq('cart_id', cart.id);
    if (next.length) {
      await supabase.from('cart_items').insert(
        next.map(i => ({ cart_id: cart.id, product_id: i.product.id, quantity: i.quantity }))
      );
    }
  }, [authUserId]);

  const syncWishlistToDb = useCallback(async (next: CartItem[]) => {
    if (!isSupabaseConfigured || !authUserId) return;
    const { data: wl } = await supabase.from('wishlists').upsert(
      { user_id: authUserId }, { onConflict: 'user_id' }
    ).select('id').single();
    if (!wl) return;
    await supabase.from('wishlist_items').delete().eq('wishlist_id', wl.id);
    if (next.length) {
      await supabase.from('wishlist_items').insert(
        next.map(i => ({ wishlist_id: wl.id, product_id: i.product.id }))
      );
    }
  }, [authUserId]);

  const addToCart = (product: Product, quantity = 1) => {
    const max = product.stock_quantity;
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      const next = existing
        ? prev.map(i => i.product.id === product.id
            ? { ...i, quantity: Math.min(i.quantity + quantity, max) }
            : i)
        : [...prev, { product, quantity: Math.min(quantity, max) }];
      syncCartToDb(next);
      return next;
    });
  };

  const removeFromCart = (productId: string) => {
    setItems(prev => {
      const next = prev.filter(i => i.product.id !== productId);
      syncCartToDb(next);
      return next;
    });
  };

  const setQuantity = (productId: string, quantity: number) => {
    setItems(prev => {
      const next = quantity <= 0
        ? prev.filter(i => i.product.id !== productId)
        : prev.map(i => i.product.id === productId
            ? { ...i, quantity: Math.min(quantity, i.product.stock_quantity) }
            : i);
      syncCartToDb(next);
      return next;
    });
  };

  const clearCart = () => {
    setItems([]);
    syncCartToDb([]);
  };

  const toggleWishlist = async (product: Product): Promise<boolean> => {
    let added = false;
    setWishlist(prev => {
      const exists = prev.some(i => i.product.id === product.id);
      added = !exists;
      const next = exists
        ? prev.filter(i => i.product.id !== product.id)
        : [...prev, { product, quantity: 1 }];
      syncWishlistToDb(next);
      return next;
    });
    return added;
  };

  const isWishlisted = (productId: string) => wishlist.some(i => i.product.id === productId);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => {
    const price = unitPrice(i.product);
    return s + price * i.quantity;
  }, 0);

  const value = useMemo(() => ({
    items, count, subtotal, wishlistIds: wishlist.map(i => i.product.id), wishlistItems: wishlist,
    addToCart, removeFromCart, setQuantity, clearCart, toggleWishlist, isWishlisted,
    loading: false,
  }), [items, wishlist, count, subtotal]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
