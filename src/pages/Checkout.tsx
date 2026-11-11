import React, { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Banknote, Landmark, Upload, CheckCircle2 } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useCartTotals } from './Cart';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase, isSupabaseConfigured, formatCurrency, unitPrice, type PaymentMethod, type DiscountCode } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input, Textarea, Select, Field } from '../components/ui/Input';
import { EmptyState } from '../components/ui/Feedback';
import { cn } from '../lib/utils';

const schema = z.object({
  customer_name: z.string().min(2, 'Full name is required'),
  phone: z.string().min(9, 'Valid phone number required'),
  email: z.string().email('Valid email required'),
  address_line: z.string().min(5, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  district: z.string().min(2, 'District is required'),
  postal_code: z.string().optional(),
  delivery_instructions: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const DISTRICTS = ['Colombo','Gampaha','Kalutara','Kandy','Matale','Nuwara Eliya','Galle','Matara','Hambantota','Jaffna','Kilinochchi','Mannar','Vavuniya','Trincomalee','Batticaloa','Ampara','Kurunegala','Puttalam','Anuradhapura','Polonnaruwa','Badulla','Monaragala','Ratnapura','Kegalle'];

const Checkout: React.FC = () => {
  const { items, clearCart } = useCart();
  const { user } = useAuth();
  const { settings, currency } = useSettings();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [discount] = useState<DiscountCode | null>(() => {
    try { const raw = sessionStorage.getItem('miniblox_discount'); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const [receipt, setReceipt] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<{ id: string; number: string; total: number } | null>(null);

  const totals = useCartTotals(items, discount);
  const bank = settings.bank || {};

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      customer_name: user?.full_name || '',
      email: user?.email || '',
      phone: user?.phone || '',
    },
  });

  const payload = useMemo(() => items.map(i => ({ product_id: i.product.id, quantity: i.quantity })), [items]);

  if (items.length === 0 && !placedOrder) {
    return <EmptyState title="Nothing to check out" message="Your cart is empty." actionLabel="Browse Products" onAction={() => navigate('/shop')} />;
  }

  if (placedOrder) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <CheckCircle2 size={72} className="mx-auto text-mint-500 mb-4" />
        <h1 className="font-display text-3xl font-extrabold text-ink-900 mb-2">Order Placed!</h1>
        <p className="text-ink-500 mb-6">Thank you! Your order <span className="font-bold text-ink-900">{placedOrder.number}</span> has been received.</p>
        <div className="rounded-4xl border border-ink-100 bg-white p-6 shadow-soft mb-6">
          <p className="text-sm text-ink-500">Total paid on delivery/transfer</p>
          <p className="font-display text-3xl font-extrabold text-ink-900">{formatCurrency(placedOrder.total, currency)}</p>
          {paymentMethod === 'bank_transfer' && <p className="text-xs text-ink-400 mt-2">We'll verify your bank transfer shortly.</p>}
        </div>
        <div className="flex justify-center gap-3">
          <Link to={`/account/orders`}><Button variant="secondary">Track Order</Button></Link>
          <Link to="/shop"><Button>Keep Shopping</Button></Link>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: FormData) => {
    if (!isSupabaseConfigured || !user) {
      toastError('Please ensure Supabase is configured and you are signed in.');
      return;
    }
    setSubmitting(true);
    try {
      // upload receipt for bank transfer
      let proofUrl: string | null = null;
      if (paymentMethod === 'bank_transfer' && receipt) {
        const ext = receipt.name.split('.').pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('payment-proofs').upload(path, receipt);
        if (upErr) throw new Error('Receipt upload failed: ' + upErr.message);
        proofUrl = path;
      }

      const { data: orderId, error: rpcErr } = await supabase.rpc('place_order', {
        payload: {
          ...data,
          items: payload,
          payment_method: paymentMethod,
          discount_code_id: discount?.id ?? null,
        },
      });
      if (rpcErr) throw rpcErr;

      if (proofUrl) {
        const { error: proofErr } = await supabase.rpc('attach_payment_proof', { p_order_id: orderId, p_proof_path: proofUrl });
        if (proofErr) toastError('Order placed, but the receipt could not be attached: ' + proofErr.message);
      }

      const { data: order } = await supabase.from('orders').select('order_number,total_amount').eq('id', orderId).single();
      clearCart();
      sessionStorage.removeItem('miniblox_discount');
      setPlacedOrder({ id: orderId, number: order?.order_number || 'Order', total: order?.total_amount ?? totals.total });
      success('Order placed successfully!');
    } catch (e: any) {
      toastError(e?.message || 'Could not place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-ink-900 mb-8">Checkout</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Contact & delivery */}
          <section className="rounded-4xl border border-ink-100 bg-white p-6 sm:p-8 shadow-soft">
            <h2 className="font-display text-xl font-extrabold text-ink-900 mb-5">Delivery Details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Full Name" error={errors.customer_name?.message}><Input {...register('customer_name')} /></Field>
              <Field label="Phone Number" error={errors.phone?.message}><Input {...register('phone')} placeholder="07X XXX XXXX" /></Field>
              <Field label="Email" error={errors.email?.message} className="sm:col-span-2"><Input type="email" {...register('email')} /></Field>
              <Field label="Address" error={errors.address_line?.message} className="sm:col-span-2"><Textarea {...register('address_line')} placeholder="House no, street, area" /></Field>
              <Field label="City" error={errors.city?.message}><Input {...register('city')} /></Field>
              <Field label="District" error={errors.district?.message}>
                <Select {...register('district')}><option value="">Select district</option>{DISTRICTS.map(d => <option key={d}>{d}</option>)}</Select>
              </Field>
              <Field label="Postal Code"><Input {...register('postal_code')} /></Field>
              <Field label="Delivery Instructions" className="sm:col-span-2"><Textarea {...register('delivery_instructions')} placeholder="Optional — e.g. call on arrival" className="min-h-[70px]" /></Field>
            </div>
          </section>

          {/* Payment */}
          <section className="rounded-4xl border border-ink-100 bg-white p-6 sm:p-8 shadow-soft">
            <h2 className="font-display text-xl font-extrabold text-ink-900 mb-5">Payment Method</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <button type="button" onClick={() => setPaymentMethod('cod')}
                className={cn('rounded-3xl border-2 p-5 text-left transition', paymentMethod === 'cod' ? 'border-mint-500 bg-mint-50' : 'border-ink-100 hover:border-mint-200')}>
                <Banknote size={28} className="text-mint-600 mb-2" />
                <p className="font-extrabold text-ink-900">Cash on Delivery</p>
                <p className="text-xs text-ink-500 mt-1">Pay in cash when your order arrives.</p>
              </button>
              <button type="button" onClick={() => setPaymentMethod('bank_transfer')}
                className={cn('rounded-3xl border-2 p-5 text-left transition', paymentMethod === 'bank_transfer' ? 'border-mint-500 bg-mint-50' : 'border-ink-100 hover:border-mint-200')}>
                <Landmark size={28} className="text-lavender-600 mb-2" />
                <p className="font-extrabold text-ink-900">Bank Transfer</p>
                <p className="text-xs text-ink-500 mt-1">Transfer to our account & upload the receipt.</p>
              </button>
            </div>

            {paymentMethod === 'bank_transfer' && (
              <div className="mt-5 rounded-3xl bg-cream-100 border border-cream-300 p-5">
                <h3 className="font-bold text-ink-900 mb-3">Bank Details</h3>
                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                  {bank.bank_name && <p><span className="text-ink-500">Bank:</span> <span className="font-bold">{bank.bank_name}</span></p>}
                  {bank.account_name && <p><span className="text-ink-500">Name:</span> <span className="font-bold">{bank.account_name}</span></p>}
                  {bank.account_number && <p><span className="text-ink-500">Account:</span> <span className="font-mono font-bold">{bank.account_number}</span></p>}
                  {bank.branch && <p><span className="text-ink-500">Branch:</span> <span className="font-bold">{bank.branch}</span></p>}
                </div>
                {bank.instructions && <p className="text-xs text-ink-500 mt-3">{bank.instructions}</p>}
                <div className="mt-4">
                  <Field label="Upload Payment Receipt (optional now, required before dispatch)">
                    <label className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-ink-200 bg-white px-4 py-3 cursor-pointer hover:border-mint-400 transition">
                      <Upload size={18} className="text-mint-600" />
                      <span className="text-sm font-bold text-ink-700">{receipt ? receipt.name : 'Choose image or PDF'}</span>
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setReceipt(e.target.files?.[0] || null)} />
                    </label>
                  </Field>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Summary */}
        <div>
          <div className="sticky top-28 rounded-4xl border border-ink-100 bg-white p-6 shadow-soft space-y-4">
            <h2 className="font-display text-xl font-extrabold text-ink-900">Your Order</h2>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {items.map(i => (
                <div key={i.product.id} className="flex justify-between text-sm gap-3">
                  <span className="text-ink-600 line-clamp-2">{i.product.name} <span className="text-ink-400">×{i.quantity}</span></span>
                  <span className="font-bold whitespace-nowrap">{formatCurrency(unitPrice(i.product) * i.quantity, currency)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed border-ink-200 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-ink-600"><span>Subtotal</span><span className="font-bold">{formatCurrency(totals.subtotal, currency)}</span></div>
              {discount && <div className="flex justify-between text-mint-600"><span>Discount ({discount.code})</span><span className="font-bold">−{formatCurrency(totals.discountAmt, currency)}</span></div>}
              <div className="flex justify-between text-ink-600"><span>Delivery</span><span className="font-bold">{totals.delivery === 0 ? 'FREE' : formatCurrency(totals.delivery, currency)}</span></div>
              <div className="flex justify-between pt-2 border-t border-ink-100"><span className="font-extrabold text-ink-900">Total</span><span className="font-extrabold text-ink-900 text-lg">{formatCurrency(totals.total, currency)}</span></div>
            </div>
            <Button type="submit" size="lg" className="w-full" loading={submitting} disabled={!isSupabaseConfigured}>
              Place Order · {formatCurrency(totals.total, currency)}
            </Button>
            {!isSupabaseConfigured && (
              <p className="text-xs text-amber-600 font-bold text-center">Supabase is not configured — orders can't be placed yet. See README.</p>
            )}
            <p className="text-center text-xs text-ink-400">By placing this order you agree to our <Link to="/terms" className="underline">Terms</Link> & <Link to="/shipping-policy" className="underline">Shipping Policy</Link>.</p>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Checkout;
