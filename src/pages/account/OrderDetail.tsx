import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, PackageCheck, Truck, CheckCircle2, XCircle, MapPin, CreditCard } from 'lucide-react';
import { supabase, openReceipt, formatCurrency, ORDER_STATUS_LABELS, ORDER_STATUS_STYLES, type Order, type OrderStatus } from '../../lib/supabase';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { ProductImage, Skeleton } from '../../components/ui/Feedback';
import { primaryImage } from '../../components/ProductCard';
import { Badge } from '../../components/ui/Badge';
import { formatDate } from '../../lib/supabase';

const STEPS: OrderStatus[] = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered'];

const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { authUserId } = useAuth();
  const { currency } = useSettings();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !authUserId) return;
    supabase.from('orders').select('*, items:order_items(*), payments:payments(*)').eq('id', id).eq('user_id', authUserId).single()
      .then(({ data }) => { setOrder(data as Order); setLoading(false); });
  }, [id, authUserId]);

  if (loading) return <Skeleton className="h-96" />;
  if (!order) return <p className="text-ink-500 font-bold">Order not found.</p>;

  const stepIdx = order.status === 'cancelled' || order.status === 'returned' ? -1 : STEPS.indexOf(order.status);
  const payment = order.payments?.[0];

  return (
    <div>
      <Link to="/account/orders" className="inline-flex items-center gap-2 text-sm font-bold text-ink-500 hover:text-mint-600 mb-5"><ArrowLeft size={16} /> All orders</Link>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink-900">{order.order_number}</h1>
          <p className="text-sm text-ink-400 font-semibold">Placed {formatDate(order.placed_at)}</p>
        </div>
        <Badge className={`${ORDER_STATUS_STYLES[order.status]} !text-sm !px-4 !py-1.5`}>{ORDER_STATUS_LABELS[order.status]}</Badge>
      </div>

      {/* Status timeline */}
      {stepIdx >= 0 ? (
        <div className="rounded-4xl border border-ink-100 bg-white p-6 shadow-soft mb-6">
          <div className="flex items-center justify-between overflow-x-auto pb-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex flex-col items-center min-w-[80px]">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${i <= stepIdx ? 'bg-mint-500 text-white' : 'bg-ink-100 text-ink-400'}`}>
                  {i < stepIdx ? <CheckCircle2 size={18} /> : i === stepIdx ? <PackageCheck size={18} /> : <div className="w-2.5 h-2.5 rounded-full bg-current opacity-50" />}
                </div>
                <span className={`text-[11px] font-bold ${i <= stepIdx ? 'text-mint-700' : 'text-ink-400'}`}>{ORDER_STATUS_LABELS[s]}</span>
              </div>
            ))}
          </div>
          {order.tracking_number && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-sunshine-50 px-4 py-3 text-sm font-bold text-ink-800">
              <Truck size={17} className="text-sunshine-600" /> Tracking: {order.tracking_number}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-4xl border border-red-100 bg-red-50 p-6 mb-6 flex items-center gap-3 text-red-600 font-bold">
          <XCircle size={22} /> This order was {order.status}.
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <section className="rounded-4xl border border-ink-100 bg-white p-6 shadow-soft">
            <h2 className="font-display text-lg font-extrabold text-ink-900 mb-4">Items</h2>
            <div className="space-y-4">
              {order.items?.map(item => (
                <div key={item.id} className="flex gap-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0">
                    <ProductImage src={primaryImage({ images: [] } as any)} alt="" iconClassName="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-ink-900">{item.product_name}</p>
                    {item.sku && <p className="text-xs text-ink-400">SKU: {item.sku}</p>}
                    <p className="text-sm text-ink-500">Qty: {item.quantity} × {formatCurrency(item.unit_price, currency)}</p>
                  </div>
                  <p className="font-extrabold text-ink-900">{formatCurrency(item.line_total, currency)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          {/* Totals */}
          <section className="rounded-4xl border border-ink-100 bg-white p-6 shadow-soft">
            <h2 className="font-display text-lg font-extrabold text-ink-900 mb-4">Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-ink-600"><span>Subtotal</span><span className="font-bold">{formatCurrency(order.subtotal, currency)}</span></div>
              {order.discount_amount > 0 && <div className="flex justify-between text-mint-600"><span>Discount</span><span className="font-bold">−{formatCurrency(order.discount_amount, currency)}</span></div>}
              <div className="flex justify-between text-ink-600"><span>Delivery</span><span className="font-bold">{order.delivery_fee === 0 ? 'FREE' : formatCurrency(order.delivery_fee, currency)}</span></div>
              <div className="flex justify-between pt-2 border-t border-ink-100 text-base"><span className="font-extrabold">Total</span><span className="font-extrabold text-lg">{formatCurrency(order.total_amount, currency)}</span></div>
            </div>
          </section>

          {/* Payment */}
          <section className="rounded-4xl border border-ink-100 bg-white p-6 shadow-soft">
            <h2 className="font-display text-lg font-extrabold text-ink-900 mb-4 flex items-center gap-2"><CreditCard size={18} className="text-mint-600" /> Payment</h2>
            <p className="text-sm font-bold text-ink-800 capitalize">{order.payment_method === 'cod' ? 'Cash on Delivery' : 'Bank Transfer'}</p>
            <Badge color={order.payment_status === 'paid' ? 'green' : order.payment_status === 'pending' ? 'sunshine' : 'red'} className="mt-2">{order.payment_status}</Badge>
            {payment?.proof_url && (
              <button type="button" onClick={() => openReceipt(payment.proof_url!)} className="mt-3 block text-sm font-bold text-mint-600 hover:underline">View uploaded receipt</button>
            )}
          </section>

          {/* Delivery address */}
          <section className="rounded-4xl border border-ink-100 bg-white p-6 shadow-soft">
            <h2 className="font-display text-lg font-extrabold text-ink-900 mb-4 flex items-center gap-2"><MapPin size={18} className="text-peach-500" /> Deliver To</h2>
            <p className="font-bold text-ink-900">{order.customer_name}</p>
            <p className="text-sm text-ink-600">{order.address_line}</p>
            <p className="text-sm text-ink-600">{order.city}, {order.district} {order.postal_code}</p>
            <p className="text-sm text-ink-500 mt-1">{order.phone}</p>
            {order.delivery_instructions && <p className="text-xs text-ink-400 mt-2 italic">"{order.delivery_instructions}"</p>}
          </section>
        </div>
      </div>
    </div>
  );
};

export default OrderDetail;
