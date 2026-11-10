import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, ChevronRight } from 'lucide-react';
import { supabase, formatCurrency, ORDER_STATUS_LABELS, ORDER_STATUS_STYLES, type Order } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { EmptyState, Skeleton } from '../../components/ui/Feedback';
import { Badge } from '../../components/ui/Badge';
import { formatDate } from '../../lib/supabase';

const Orders: React.FC = () => {
  const { authUserId } = useAuth();
  const { currency } = useSettings();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUserId) return;
    supabase.from('orders').select('*, items:order_items(*)').eq('user_id', authUserId).order('placed_at', { ascending: false })
      .then(({ data }) => { setOrders((data || []) as Order[]); setLoading(false); });
  }, [authUserId]);

  if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}</div>;

  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink-900 mb-6">My Orders</h1>
      {orders.length === 0 ? (
        <EmptyState icon={<Package size={36} strokeWidth={1.5} />} title="No orders yet" message="When you place an order it will show up here with live status tracking." actionLabel="Start Shopping" onAction={() => { window.location.href = '/shop'; }} />
      ) : (
        <div className="space-y-4">
          {orders.map(o => (
            <Link key={o.id} to={`/account/orders/${o.id}`} className="block rounded-4xl border border-ink-100 bg-white p-5 shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display font-extrabold text-ink-900">{o.order_number}</p>
                  <p className="text-xs text-ink-400 font-semibold">{formatDate(o.placed_at)} · {o.items?.length || 0} item(s)</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={ORDER_STATUS_STYLES[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                  <span className="font-extrabold text-ink-900">{formatCurrency(o.total_amount, currency)}</span>
                  <ChevronRight size={18} className="text-ink-300" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Orders;
