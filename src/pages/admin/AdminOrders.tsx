import React, { useEffect, useMemo, useState } from 'react';
import { Search, Eye, CheckCircle2 } from 'lucide-react';
import { supabase, openReceipt, formatCurrency, formatDate, ORDER_STATUS_LABELS, ORDER_STATUS_STYLES, type Order, type OrderStatus } from '../../lib/supabase';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { AdminHeader, Table, Td } from '../../components/admin/ui';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';

const STATUS_OPTIONS: OrderStatus[] = ['pending','confirmed','processing','packed','shipped','delivered','cancelled','returned'];

const AdminOrders: React.FC = () => {
  const { currency } = useSettings();
  const { authUserId } = useAuth();
  const { success, error } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);

  const load = async () => {
    setLoading(true);
    let query = supabase.from('orders').select('*, items:order_items(*), payments:payments(*)').order('placed_at', { ascending: false });
    if (statusFilter) query = query.eq('status', statusFilter);
    if (from) query = query.gte('placed_at', from);
    if (to) query = query.lte('placed_at', to + 'T23:59:59');
    const { data } = await query;
    const list = (data || []) as Order[];
    const ids = [...new Set(list.map(o => o.user_id).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id,full_name,email,phone').in('id', ids);
      const map = new Map((profs || []).map((p: any) => [p.id, p]));
      list.forEach(o => { (o as any).user = o.user_id ? map.get(o.user_id) : null; });
    }
    setOrders(list);
    setLoading(false);
  };
  useEffect(() => { load(); }, [statusFilter, from, to]);

  const filtered = useMemo(() => {
    if (!q) return orders;
    const s = q.toLowerCase();
    return orders.filter(o => o.order_number.toLowerCase().includes(s) || o.customer_name.toLowerCase().includes(s) || o.phone.includes(s) || o.email.toLowerCase().includes(s));
  }, [orders, q]);

  const openOrder = async (o: Order) => {
    const { data } = await supabase.from('orders').select('*, items:order_items(*), payments:payments(*)').eq('id', o.id).single();
    setSelected(data as Order);
  };

  const updateStatus = async (o: Order, status: OrderStatus) => {
    const patch: any = { status };
    if (status === 'confirmed') patch.confirmed_at = new Date().toISOString();
    if (status === 'delivered') patch.delivered_at = new Date().toISOString();
    const { error: e } = await supabase.from('orders').update(patch).eq('id', o.id);
    if (e) { error(e.message); return; }

    // restock on cancel/return
    if ((status === 'cancelled' || status === 'returned') && o.items?.length) {
      for (const item of o.items) {
        if (!item.product_id) continue;
        const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
        if (prod) {
          await supabase.from('products').update({ stock_quantity: prod.stock_quantity + item.quantity }).eq('id', item.product_id);
          await supabase.from('inventory_transactions').insert({ product_id: item.product_id, quantity_change: item.quantity, reason: status === 'cancelled' ? 'return' : 'return', reference_type: 'order', reference_id: o.id, notes: `Order ${o.order_number} ${status}`, created_by: authUserId });
        }
      }
    }
    success(`Order marked ${ORDER_STATUS_LABELS[status]}`);
    setSelected(null); load();
  };

  const verifyPayment = async (o: Order) => {
    const payment = o.payments?.[0];
    if (!payment) return;
    const { error: e } = await supabase.from('payments').update({ status: 'paid', verified_by: authUserId, verified_at: new Date().toISOString(), paid_at: new Date().toISOString() }).eq('id', payment.id);
    if (!e) {
      await supabase.from('orders').update({ payment_status: 'paid' }).eq('id', o.id);
      success('Payment verified'); setSelected(null); load();
    } else error(e.message);
  };

  return (
    <div>
      <AdminHeader title="Orders" subtitle={`${filtered.length} order(s)`} />

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search order #, name, phone, email…" className="!pl-10" />
        </div>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="!w-44">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
        </Select>
        <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="!w-40" title="From date" />
        <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="!w-40" title="To date" />
      </div>

      <Table head={['Order', 'Customer', 'Items', 'Total', 'Payment', 'Status', 'Placed', '']}>
        {loading ? <tr><Td className="text-center py-8 text-ink-400">Loading…</Td></tr> :
        filtered.length === 0 ? <tr><Td className="text-center py-8 text-ink-400">No orders found</Td></tr> :
        filtered.map(o => (
          <tr key={o.id} className="hover:bg-ink-50/50">
            <Td><p className="font-bold text-ink-900">{o.order_number}</p><p className="text-xs text-ink-400 capitalize">{o.payment_method === 'cod' ? 'COD' : 'Bank Transfer'}</p></Td>
            <Td><p className="font-semibold text-ink-900">{o.customer_name}</p><p className="text-xs text-ink-400">{o.phone}</p></Td>
            <Td className="text-ink-600">{o.items?.length || 0}</Td>
            <Td className="font-bold text-ink-900">{formatCurrency(Number(o.total_amount), currency)}</Td>
            <Td><Badge color={o.payment_status === 'paid' ? 'green' : o.payment_status === 'pending' ? 'sunshine' : 'red'}>{o.payment_status}</Badge></Td>
            <Td><Badge className={ORDER_STATUS_STYLES[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge></Td>
            <Td className="text-ink-500 text-xs whitespace-nowrap">{formatDate(o.placed_at)}</Td>
            <Td><Button variant="secondary" size="sm" onClick={() => openOrder(o)}><Eye size={14} /> View</Button></Td>
          </tr>
        ))}
      </Table>

      <OrderModal order={selected} onClose={() => setSelected(null)} onStatus={updateStatus} onVerify={verifyPayment} />
    </div>
  );
};

// ------------------------------------------------------------------
const OrderModal: React.FC<{ order: Order | null; onClose: () => void; onStatus: (o: Order, s: OrderStatus) => void; onVerify: (o: Order) => void }> = ({ order, onClose, onStatus, onVerify }) => {
  const { currency } = useSettings();
  const { success, error } = useToast();
  const [tracking, setTracking] = useState('');

  useEffect(() => { setTracking(order?.tracking_number || ''); }, [order]);

  if (!order) return null;
  const payment = order.payments?.[0];

  const saveTracking = async () => {
    const { error: e } = await supabase.from('orders').update({ tracking_number: tracking || null }).eq('id', order.id);
    if (e) error(e.message); else success('Tracking number saved');
  };

  return (
    <Modal open={!!order} onClose={onClose} title={`Order ${order.order_number}`} wide>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-5">
          <div>
            <p className="text-xs font-extrabold uppercase text-ink-400 mb-2">Items</p>
            {order.items?.map(i => (
              <div key={i.id} className="flex justify-between py-2 border-b border-ink-50 text-sm">
                <span className="text-ink-700">{i.product_name} <span className="text-ink-400">×{i.quantity}</span></span>
                <span className="font-bold">{formatCurrency(i.line_total, currency)}</span>
              </div>
            ))}
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between text-ink-600"><span>Subtotal</span><span>{formatCurrency(order.subtotal, currency)}</span></div>
              <div className="flex justify-between text-ink-600"><span>Discount</span><span>−{formatCurrency(order.discount_amount, currency)}</span></div>
              <div className="flex justify-between text-ink-600"><span>Delivery</span><span>{formatCurrency(order.delivery_fee, currency)}</span></div>
              <div className="flex justify-between font-extrabold text-base pt-1"><span>Total</span><span>{formatCurrency(order.total_amount, currency)}</span></div>
            </div>
          </div>

          <div>
            <p className="text-xs font-extrabold uppercase text-ink-400 mb-2">Customer & Delivery</p>
            <p className="font-bold text-ink-900">{order.customer_name} · {order.phone}</p>
            <p className="text-sm text-ink-600">{order.email}</p>
            <p className="text-sm text-ink-600 mt-1">{order.address_line}, {order.city}, {order.district} {order.postal_code}</p>
            {order.delivery_instructions && <p className="text-xs text-ink-400 italic mt-1">"{order.delivery_instructions}"</p>}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-extrabold uppercase text-ink-400 mb-2">Status</p>
            <Select value={order.status} onChange={e => onStatus(order, e.target.value as OrderStatus)} className="!w-full font-bold">
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
            </Select>
          </div>

          <div>
            <p className="text-xs font-extrabold uppercase text-ink-400 mb-2">Tracking Number</p>
            <div className="flex gap-2">
              <Input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="e.g. LK123456" className="!py-2 text-sm" />
              <Button size="sm" variant="secondary" onClick={saveTracking}>Save</Button>
            </div>
          </div>

          <div className="rounded-3xl bg-cream-100 p-4">
            <p className="text-xs font-extrabold uppercase text-ink-400 mb-2">Payment</p>
            <p className="text-sm font-bold capitalize">{order.payment_method === 'cod' ? 'Cash on Delivery' : 'Bank Transfer'}</p>
            <Badge color={order.payment_status === 'paid' ? 'green' : 'sunshine'} className="mt-1">{order.payment_status}</Badge>
            {payment?.proof_url && (
              <button type="button" onClick={() => openReceipt(payment.proof_url!)} className="block mt-2 text-xs font-bold text-mint-600 hover:underline">View receipt ↗</button>
            )}
            {payment && payment.status !== 'paid' && order.payment_method === 'bank_transfer' && (
              <Button size="sm" className="mt-3 w-full" onClick={() => onVerify(order)}><CheckCircle2 size={15} /> Verify Payment</Button>
            )}
          </div>

          {order.notes && <p className="text-xs text-ink-400 italic">Note: {order.notes}</p>}
        </div>
      </div>
    </Modal>
  );
};

export default AdminOrders;
