import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { type Product, formatCurrency, hasDiscount, unitPrice } from '../lib/supabase';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import { ProductImage } from './ui/Feedback';
import { cn } from '../lib/utils';

export const primaryImage = (p: Product): string | null => {
  const imgs = p.images || [];
  const primary = imgs.find(i => i.is_primary) || imgs.sort((a, b) => a.sort_order - b.sort_order)[0];
  return primary?.url || null;
};

export const effectivePrice = (p: Product) => unitPrice(p);

const ProductCard: React.FC<{ product: Product; index?: number }> = ({ product, index = 0 }) => {
  const { addToCart, toggleWishlist, isWishlisted } = useCart();
  const { success } = useToast();
  const { currency } = useSettings();
  const wishlisted = isWishlisted(product.id);
  const outOfStock = product.stock_quantity <= 0;
  const price = effectivePrice(product);
  const discountPct = hasDiscount(product)
    ? Math.round((1 - (product.discount_price as number) / product.selling_price) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3) }}
      className="group relative flex flex-col min-w-0 rounded-3xl sm:rounded-4xl border border-ink-100 bg-white overflow-hidden shadow-soft hover:shadow-soft-lg hover:-translate-y-1 transition-all duration-300"
    >
      <Link to={`/product/${product.id}`} className="product-image-container aspect-square block">
        <ProductImage src={primaryImage(product)} alt={product.name} iconClassName="w-20 h-20" className="!object-contain bg-white" />
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex flex-col gap-1 sm:gap-1.5">
          {product.is_new && <span className="rounded-full bg-lavender-500 text-white text-[10px] sm:text-[11px] font-bold px-2 sm:px-2.5 py-0.5 sm:py-1">NEW</span>}
          {product.is_best_seller && <span className="rounded-full bg-sunshine-400 text-ink-900 text-[10px] sm:text-[11px] font-bold px-2 sm:px-2.5 py-0.5 sm:py-1 flex items-center gap-1"><Star size={10} fill="currentColor" />BEST SELLER</span>}
          {discountPct > 0 && <span className="rounded-full bg-peach-500 text-white text-[10px] sm:text-[11px] font-bold px-2 sm:px-2.5 py-0.5 sm:py-1">-{discountPct}%</span>}
        </div>
        {outOfStock && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="rounded-full bg-ink-900 text-white text-sm font-bold px-4 py-2 -rotate-6">Sold Out</span>
          </div>
        )}
      </Link>

      <button
        onClick={async () => {
          const added = await toggleWishlist(product);
          if (added) success('Added to wishlist');
        }}
        className={cn(
          'absolute top-2 right-2 sm:top-3 sm:right-3 z-10 p-2 sm:p-2.5 rounded-full shadow-soft transition-all active:scale-90',
          wishlisted ? 'bg-red-500 text-white' : 'bg-white/90 text-ink-500 hover:text-red-500'
        )}
        aria-label="Toggle wishlist"
      >
        <Heart size={18} fill={wishlisted ? 'currentColor' : 'none'} />
      </button>

      <div className="flex flex-col flex-1 p-3 sm:p-4">
        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide sm:tracking-wider text-mint-600 truncate">{product.category?.name || 'MinibloxRC'}</p>
        <Link to={`/product/${product.id}`} className="font-display font-bold text-ink-900 text-sm sm:text-base leading-snug break-words line-clamp-2 mt-0.5 hover:text-mint-600 transition-colors">
          {product.name}
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0">
          <span className="text-base sm:text-lg font-extrabold text-ink-900 whitespace-nowrap">{formatCurrency(price, currency)}</span>
          {hasDiscount(product) && (
            <span className="text-xs sm:text-sm text-ink-400 line-through whitespace-nowrap">{formatCurrency(product.selling_price, currency)}</span>
          )}
        </div>
        <button
          onClick={() => { addToCart(product); success(`${product.name} added to cart`); }}
          disabled={outOfStock}
          className="mt-3 inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-full bg-mint-500 hover:bg-mint-600 disabled:bg-ink-200 disabled:text-ink-400 text-white text-xs sm:text-sm font-bold px-2 py-2 sm:py-2.5 transition-all active:scale-[0.98]"
        >
          <ShoppingBag size={15} className="shrink-0" />
          {outOfStock ? 'Out of Stock' : 'Add to Cart'}
        </button>
      </div>
    </motion.div>
  );
};

export default ProductCard;
