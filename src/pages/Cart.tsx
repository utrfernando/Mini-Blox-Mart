import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag, TicketPercent, ArrowRight } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase, isSupabaseConfigured, formatCurrency, type DiscountCode } from '../lib/supabase';
import { primaryImage, effectivePrice } from '../components/ProductCard';
import { ProductImage, EmptyState } from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';

export const useCartTotals = (items: { product: any; quantity: number }[], discount?: DiscountCode | null) => {
  const { deliveryFee, freeDeliveryThreshold, currency } = useSettings();
  const subtotal = items.reduce((s, i) => s + effectivePrice(i.product) * i.quantity, 0);
  let discountAmt = 0;
  if (discount) {
    discountAmt = discount.discount_type === 'percent'
      ? subtotal * discount.discount_value / 100
      : Math.min(discount.discount_value, subtotal);
  }
  const afterDiscount = subtotal - discountAmt;
  const delivery = afterDiscount >= freeDeliveryThreshold || afterDiscount === 0 ? 0 : deliveryFee;
  return { subtotal, discountAmt, delivery, total: afterDiscount + delivery, currency };
};

const Cart: React.FC = () => {
  const { items, setQuantity, removeFromCart } = useCart();
  const { user } = useAuth();
  const { currency, checkoutEnabled, checkoutMessage, refresh } = useSettings();
  // settings are cached in the browser; re-check here so a paused checkout is never missed
  React.useEffect(() => { refresh(); }, [refresh]);
  const { success } = useToast();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [discount, setDiscount] = useState<DiscountCode | null>(() => {
    try { const raw = sessionStorage.getItem('miniblox_discount'); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const [codeError, setCodeError] = useState('');
  const [validating, setValidating] = useState(false);

  const totals = useCartTotals(items, discount);

  const applyCode = async () => {
    if (!code.trim()) return;
    setValidating(true); setCodeError('');
    if (!isSupabaseConfigured) { setCodeError('Discount codes require a connected database.'); setValidating(false); return; }
    const { data } = await supabase.from('discount_codes').select('*').ilike('code', code.trim()).maybeSingle();
    setValidating(false);
    const d = data as DiscountCode | null;
    if (!d || !d.is_active) { setCodeError('Invalid or expired code.'); return; }
    if (d.starts_at && new Date(d.starts_at) > new Date()) { setCodeError('This code is not active yet.'); return; }
    if (d.ends_at && new Date(d.ends_at) < new Date()) { setCodeError('This code has expired.'); return; }
    if (d.max_uses && d.used_count >= d.max_uses) { setCodeError('This code has been fully used.'); return; }
    if (totals.subtotal < d.min_order_amount) { setCodeError(`Minimum order ${formatCurrency(d.min_order_amount, currency)} required.`); return; }
    setDiscount(d);
    sessionStorage.setItem('miniblox_discount', JSON.stringify(d));
    success(`Code ${d.code} applied!`);
  };

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag size={36} strokeWidth={1.5} />}
        title="Your cart is empty"
        message="Fill it with tiny treasures — your future favourites are waiting."
        actionLabel="Start Shopping"
        onAction={() => navigate('/shop')}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-ink-900 mb-8">Your Cart <span className="text-mint-500">({items.reduce((s, i) => s + i.quantity, 0)})</span></h1>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map(({ product, quantity }) => {
            const price = effectivePrice(product);
            const img = primaryImage(product);
            return (
              <div key={product.id} className="flex gap-4 rounded-4xl border border-ink-100 bg-white p-4 shadow-soft">
                <Link to={`/product/${product.id}`} className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden shrink-0 product-image-container">
                  <ProductImage src={img} alt={product.name} iconClassName="w-10 h-10" />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/product/${product.id}`} className="font-display font-bold text-ink-900 hover:text-mint-600 line-clamp-2">{product.name}</Link>
                  <p className="text-xs text-ink-400 font-semibold mt-0.5">{product.category?.name}</p>
                  <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                    <div className="inline-flex items-center rounded-full border-2 border-ink-100">
                      <button onClick={() => setQuantity(product.id, quantity - 1)} className="px-3 py-1.5 hover:bg-ink-50"><Minus size={14} /></button>
                      <span className="px-3 font-extrabold text-sm">{quantity}</span>
                      <button onClick={() => setQuantity(product.id, quantity + 1)} disabled={quantity >= product.stock_quantity} className="px-3 py-1.5 hover:bg-ink-50 disabled:opacity-40"><Plus size={14} /></button>
                    </div>
                    <p className="font-extrabold text-ink-900">{formatCurrency(price * quantity, currency)}</p>
                  </div>
                  {product.stock_quantity <= quantity && product.stock_quantity > 0 && (
                    <p className="text-xs text-sunshine-600 font-bold mt-1">Max available: {product.stock_quantity}</p>
                  )}
                </div>
                <button onClick={() => { removeFromCart(product.id); success('Removed from cart'); }} className="self-start p-2 text-ink-300 hover:text-red-500 transition" aria-label="Remove">
                  <Trash2 size={18} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-28 rounded-4xl border border-ink-100 bg-white p-6 shadow-soft space-y-4">
            <h2 className="font-display text-xl font-extrabold text-ink-900">Order Summary</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-ink-600"><span>Subtotal</span><span className="font-bold">{formatCurrency(totals.subtotal, currency)}</span></div>
              {discount && <div className="flex justify-between text-mint-600"><span className="flex items-center gap-1"><TicketPercent size={14} /> {discount.code}</span><span className="font-bold">−{formatCurrency(totals.discountAmt, currency)}</span></div>}
              <div className="flex justify-between text-ink-600"><span>Delivery</span><span className="font-bold">{totals.delivery === 0 ? <span className="text-mint-600">FREE</span> : formatCurrency(totals.delivery, currency)}</span></div>
              <div className="border-t border-dashed border-ink-200 pt-3 flex justify-between text-base"><span className="font-extrabold text-ink-900">Total</span><span className="font-extrabold text-ink-900 text-lg">{formatCurrency(totals.total, currency)}</span></div>
            </div>

            {!discount ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Discount code" className="!py-2 text-sm" />
                  <Button variant="secondary" size="sm" onClick={applyCode} loading={validating}>Apply</Button>
                </div>
                {codeError && <p className="text-xs text-red-500 font-semibold">{codeError}</p>}
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-2xl bg-mint-50 px-4 py-2.5">
                <Badge color="mint"><TicketPercent size={12} /> {discount.code} applied</Badge>
                <button onClick={() => { setDiscount(null); setCode(''); sessionStorage.removeItem('miniblox_discount'); }} className="text-xs font-bold text-red-500 hover:underline">Remove</button>
              </div>
            )}

            {!checkoutEnabled && <p className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600">{checkoutMessage}</p>}
            <Button size="lg" className="w-full" disabled={!checkoutEnabled} onClick={() => {
              if (!user) { navigate('/login?next=/checkout'); return; }
              navigate('/checkout');
            }}>
              {user ? 'Proceed to Checkout' : 'Sign In to Checkout'} <ArrowRight size={18} />
            </Button>
            <p className="text-center text-xs text-ink-400 font-semibold">Cash on Delivery & Bank Transfer accepted</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
