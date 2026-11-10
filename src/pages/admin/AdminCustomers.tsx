import React, { useEffect, useMemo, useState } from 'react';
import { Search, Mail, Phone } from 'lucide-react';
import { supabase, formatCurrency, formatDate, type Profile, type Order } from '../../lib/supabase';
import { useSettings } from '../../contexts/SettingsContext';
import { AdminHeader, Table, Td } from '../../components/admin/ui';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { PasswordActions } from '../../components/admin/PasswordActions';

const AdminCustomers: React.FC = () => {
  const { currency } = useSettings();
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  useEffect(() => {
    (async () => {
      const [p, o] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'customer').order('created_at', { ascending: false }),
        supabase.from('orders').select('user_id,total_amount,status,placed_at'),
      ]);
      setCustomers((p.data || []) as Profile[]);
      setOrders((o.data || []) as Order[]);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const map = new Map<string, { count: number; spent: number }>();
    orders.forEach(o => {
      if (!o.user_id || o.status === 'cancelled' || o.status === 'returned') return;
      const cur = map.get(o.user_id) || { count: 0, spent: 0 };
      cur.count++; cur.spent += Number(o.total_amount);
      map.set(o.user_id, cur);
    });
    return map;
  }, [orders]);

  const filtered = customers.filter(c => !q || c.full_name?.toLowerCase().includes(q.toLowerCase()) || c.email.toLowerCase().includes(q.toLowerCase()) || c.phone?.includes(q));

  return (
    <div>
      <AdminHeader title="Customers" subtitle={`${customers.length} registered customer(s)`} />
      <div className="relative max-w-sm mb-5">
        <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search customers…" className="!pl-10" />
      </div>
      <Table head={['Customer', 'Contact', 'Orders', 'Total Spent', 'Joined', 'Password']}>
        {loading ? <tr><Td className="text-center py-8 text-ink-400">Loading…</Td></tr> :
        filtered.map(c => {
          const s = stats.get(c.id) || { count: 0, spent: 0 };
          return (
            <tr key={c.id} className="hover:bg-ink-50/50">
              <Td>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-mint-100 text-mint-700 flex items-center justify-center font-display font-extrabold">{(c.full_name || c.email)[0].toUpperCase()}</div>
                  <div><p className="font-bold text-ink-900">{c.full_name || '—'}</p><p className="text-xs text-ink-400">{c.email}</p></div>
                </div>
              </Td>
              <Td>
                <p className="flex items-center gap-1.5 text-ink-600 text-xs"><Mail size={13} />{c.email}</p>
                {c.phone && <p className="flex items-center gap-1.5 text-ink-600 text-xs mt-0.5"><Phone size={13} />{c.phone}</p>}
              </Td>
              <Td><Badge color="mint">{s.count}</Badge></Td>
              <Td className="font-bold text-ink-900">{formatCurrency(s.spent, currency)}</Td>
              <Td className="text-ink-500 text-xs">{formatDate(c.created_at)}</Td>
              <Td><PasswordActions userId={c.id} email={c.email} /></Td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
};

export default AdminCustomers;
