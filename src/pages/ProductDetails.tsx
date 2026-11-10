import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Heart, Minus, Plus, ShoppingBag, Truck, ShieldCheck, RefreshCcw, Star, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { getProductById, getRelatedProducts } from '../lib/queries';
import { type Product, formatCurrency } from '../lib/supabase';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import { primaryImage, effectivePrice } from '../components/ProductCard';
import ProductCard from '../components/ProductCard';
import { ProductImage, Skeleton, EmptyState } from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';

const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart, toggleWishlist, isWishlisted } = useCart();
  const { success } = useToast();
  const { currency, freeDeliveryThreshold, currencySymbol } = useSettings();

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getProductById(id).then(async p => {
      setProduct(p);
      if (p) {
        setActiveImg(0);
        const rel = await getRelatedProducts(p);
        setRelated(rel);
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10 grid lg:grid-cols-2 gap-10">
        <Skeleton className="aspect-square rounded-4xl" />
        <div className="space-y-4"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-6 w-1/3" /><Skeleton className="h-24 w-full" /></div>
      </div>
    );
  }

  if (!product) {
    return <EmptyState title="Product not found" message="This product may have been removed or is no longer available." actionLabel="Back to Shop" onAction={() => navigate('/shop')} />;
  }

  const images = [...(product.images || [])].sort((a, b) => a.sort_order - b.sort_order);
  const mainImg = images[activeImg]?.url || primaryImage(product);
  const price = effectivePrice(product);
  const outOfStock = product.stock_quantity <= 0;
  const lowStock = product.stock_quantity > 0 && product.stock_quantity <= product.low_stock_threshold;
  const wishlisted = isWishlisted(product.id);
  const discountPct = product.discount_price ? Math.round((1 - product.discount_price / product.selling_price) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-bold text-ink-500 hover:text-mint-600 mb-6 transition">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="grid lg:grid-cols-2 gap-10">
        {/* Gallery */}
        <div>
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="product-image-container aspect-square rounded-[2rem] border border-ink-100">
            <ProductImage src={mainImg} alt={product.name} iconClassName="w-28 h-28" />
          </motion.div>
          {images.length > 1 && (
            <div className="flex gap-3 mt-4 overflow-x-auto pb-2">
              {images.map((img, i) => (
                <button key={img.id} onClick={() => setActiveImg(i)} className={cn('w-20 h-20 shrink-0 rounded-2xl overflow-hidden border-4 transition', i === activeImg ? 'border-mint-500' : 'border-transparent hover:border-ink-200')}>
                  <ProductImage src={img.url} alt={img.alt_text || product.name} iconClassName="w-8 h-8" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            {product.is_new && <Badge color="lavender">NEW</Badge>}
            {product.is_best_seller && <Badge color="sunshine"><Star size={11} fill="currentColor" /> BEST SELLER</Badge>}
            {product.is_featured && <Badge color="mint">FEATURED</Badge>}
            {product.category && <Badge color="ink">{product.category.name}</Badge>}
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-ink-900">{product.name}</h1>
          {product.sku && <p className="text-sm text-ink-400 font-semibold mt-1">SKU: {product.sku}</p>}

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-ink-900">{formatCurrency(price, currency)}</span>
            {product.discount_price && (
              <>
                <span className="text-xl text-ink-400 line-through">{formatCurrency(product.selling_price, currency)}</span>
                <Badge color="peach">Save {discountPct}%</Badge>
              </>
            )}
          </div>

          <p className={`mt-2 text-sm font-bold ${outOfStock ? 'text-red-500' : lowStock ? 'text-sunshine-600' : 'text-mint-600'}`}>
            {outOfStock ? 'Out of stock' : lowStock ? `Only ${product.stock_quantity} left — order soon!` : 'In stock & ready to ship'}
          </p>

          {product.description && (
            <p className="mt-5 text-ink-600 leading-relaxed whitespace-pre-line">{product.description}</p>
          )}

          {product.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {product.tags.map(t => <Badge key={t} color="mint">#{t}</Badge>)}
            </div>
          )}

          {/* Qty + actions */}
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <div className="inline-flex items-center rounded-full border-2 border-ink-100 overflow-hidden">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-4 py-2.5 hover:bg-ink-50 text-ink-700"><Minus size={16} /></button>
              <span className="px-5 py-2.5 font-extrabold text-ink-900 min-w-[3rem] text-center">{qty}</span>
              <button onClick={() => setQty(q => Math.min(product.stock_quantity, q + 1))} disabled={outOfStock} className="px-4 py-2.5 hover:bg-ink-50 text-ink-700 disabled:opacity-40"><Plus size={16} /></button>
            </div>
            <Button size="lg" disabled={outOfStock} onClick={() => { addToCart(product, qty); success(`${product.name} added to cart`); }}>
              <ShoppingBag size={18} /> Add to Cart
            </Button>
            <button
              onClick={async () => { const added = await toggleWishlist(product); success(added ? 'Saved to wishlist' : 'Removed from wishlist'); }}
              className={cn('p-3.5 rounded-full border-2 transition active:scale-90', wishlisted ? 'bg-red-500 border-red-500 text-white' : 'border-ink-100 text-ink-500 hover:border-red-300 hover:text-red-400')}
              aria-label="Wishlist"
            >
              <Heart size={20} fill={wishlisted ? 'currentColor' : 'none'} />
            </button>
          </div>

          {/* Perks */}
          <div className="grid grid-cols-3 gap-3 mt-8">
            {[
              { icon: <Truck size={18} />, t: 'Fast Delivery', d: `Free over ${currencySymbol} ${freeDeliveryThreshold.toLocaleString()}` },
              { icon: <ShieldCheck size={18} />, t: 'Secure Pay', d: 'COD & Bank Transfer' },
              { icon: <RefreshCcw size={18} />, t: 'Easy Returns', d: '7-day policy' },
            ].map((p, i) => (
              <div key={i} className="rounded-3xl bg-white border border-ink-100 p-4 text-center">
                <div className="w-10 h-10 mx-auto rounded-full bg-mint-50 text-mint-600 flex items-center justify-center mb-2">{p.icon}</div>
                <p className="text-xs font-extrabold text-ink-900">{p.t}</p>
                <p className="text-[11px] text-ink-500">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-2xl font-extrabold text-ink-900 mb-6">You Might Also Like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {related.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        </section>
      )}
    </div>
  );
};

export default ProductDetails;
