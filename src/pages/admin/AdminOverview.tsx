import React, { useEffect, useMemo, useState } from 'react';
import { Download, Package, ShoppingCart, Banknote, Boxes, TrendingUp, AlertTriangle, Users } from 'lucide-react';
import { supabase, PRODUCT_COSTS_EMBED, withCosts, formatCurrency, type Order, type Product } from '../../lib/supabase';
import { useSettings } from '../../contexts/SettingsContext';
import { StatCard, AdminHeader } from '../../components/admin/ui';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Feedback';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#14b8a6', '#f59e0b', '#8b5cf6', '#fb923c', '#2dd4bf', '#fbbf24', '#a78bfa'];

const AdminOverview: React.FC = () => {
  const { currency } = useSettings();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [o, p, c] = await Promise.all([
        supabase.from('orders').select('*, items:order_items(*)').order('placed_at', { ascending: false }),
        supabase.from('products').select('*, category:categories(*), ' + PRODUCT_COSTS_EMBED),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
      ]);
      setOrders((o.data || []) as Order[]);
      setProducts(withCosts(p.data) as Product[]);
      setCustomers(c.count || 0);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const valid = orders.filter(o => o.status !== 'cancelled' && o.status !== 'returned');
    const revenue = valid.reduce((s, o) => s + Number(o.total_amount), 0);
    const itemsSold = valid.reduce((s, o) => s + (o.items || []).reduce((a, i) => a + i.quantity, 0), 0);
    const cogs = valid.reduce((s, o) => s + (o.items || []).reduce((a, i) => {
      const prod = products.find(p => p.id === i.product_id);
      return a + (prod?.landed_cost || prod?.supplier_cost || 0) * i.quantity;
    }, 0), 0);
    const deliveryCosts = valid.reduce((s, o) => s + Number(o.delivery_fee || 0), 0);
    const inventoryValue = products.reduce((s, p) => s + Number(p.landed_cost || p.supplier_cost || 0) * p.stock_quantity, 0);
    const supplierCost = products.reduce((s, p) => s + Number(p.supplier_cost || 0) * p.stock_quantity, 0);
    const landedCost = products.reduce((s, p) => s + Number(p.landed_cost || 0) * p.stock_quantity, 0);
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - deliveryCosts;
    const lowStock = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold);
    const outOfStock = products.filter(p => p.stock_quantity <= 0);
    return { revenue, itemsSold, cogs, deliveryCosts, inventoryValue, supplierCost, landedCost, grossProfit, netProfit, lowStock, outOfStock, orderCount: valid.length };
  }, [orders, products]);

  // Daily sales last 30 days
  const dailySales = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days[d.toISOString().slice(0, 10)] = 0;
    }
    orders.filter(o => o.status !== 'cancelled' && o.status !== 'returned').forEach(o => {
      const k = o.placed_at.slice(0, 10);
      if (k in days) days[k] += Number(o.total_amount);
    });
    return Object.entries(days).map(([date, total]) => ({ date: date.slice(5), total: Math.round(total) }));
  }, [orders]);

  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    orders.filter(o => o.status !== 'cancelled').forEach(o => (o.items || []).forEach(i => {
      map[i.product_id || i.product_name] = map[i.product_id || i.product_name] || { name: i.product_name, qty: 0, revenue: 0 };
      map[i.product_id || i.product_name].qty += i.quantity;
      map[i.product_id || i.product_name].revenue += Number(i.line_total);
    }));
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 8);
  }, [orders]);

  const categoryPerf = useMemo(() => {
    const map: Record<string, number> = {};
    orders.filter(o => o.status !== 'cancelled').forEach(o => (o.items || []).forEach(i => {
      const prod = products.find(p => p.id === i.product_id);
      const cat = prod?.category?.name || 'Uncategorised';
      map[cat] = (map[cat] || 0) + Number(i.line_total);
    }));
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
  }, [orders, products]);

  const monthlyRevenue = useMemo(() => {
    const map: Record<string, number> = {};
    orders.filter(o => o.status !== 'cancelled' && o.status !== 'returned').forEach(o => {
      const k = o.placed_at.slice(0, 7);
      map[k] = (map[k] || 0) + Number(o.total_amount);
    });
    return Object.entries(map).sort().slice(-8).map(([m, v]) => ({ month: m, revenue: Math.round(v) }));
  }, [orders]);

  const exportCSV = () => {
    const rows = [['Date', 'Orders', 'Revenue']];
    const byDay: Record<string, { count: number; revenue: number }> = {};
    orders.filter(o => o.status !== 'cancelled' && o.status !== 'returned').forEach(o => {
      const k = o.placed_at.slice(0, 10);
      byDay[k] = byDay[k] || { count: 0, revenue: 0 };
      byDay[k].count++; byDay[k].revenue += Number(o.total_amount);
    });
    Object.entries(byDay).sort().forEach(([d, v]) => rows.push([d, String(v.count), v.revenue.toFixed(2)]));
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'miniblox-sales-report.csv'; a.click();
  };

  if (loading) return <div className="space-y-4">{[1, 2].map(i => <Skeleton key={i} className="h-40" />)}</div>;

  const money = (n: number) => formatCurrency(n, currency);

  return (
    <div>
      <AdminHeader title="Business Overview" subtitle="Sales, profit & inventory at a glance"
        actions={<Button variant="secondary" size="sm" onClick={exportCSV}><Download size={16} /> Export CSV</Button>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Sales" value={money(stats.revenue)} icon={<Banknote size={20} />} tone="mint" hint={`${stats.orderCount} orders`} />
        <StatCard label="Products Sold" value={String(stats.itemsSold)} icon={<ShoppingCart size={20} />} tone="sunshine" />
        <StatCard label="Gross Profit" value={money(stats.grossProfit)} icon={<TrendingUp size={20} />} tone="lavender" hint={`COGS ${money(stats.cogs)}`} />
        <StatCard label="Net Profit" value={money(stats.netProfit)} icon={<TrendingUp size={20} />} tone="peach" hint={`after ${money(stats.deliveryCosts)} delivery`} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Inventory Value" value={money(stats.inventoryValue)} icon={<Boxes size={20} />} tone="ink" hint={`landed ${money(stats.landedCost)} / supplier ${money(stats.supplierCost)}`} />
        <StatCard label="Low Stock" value={String(stats.lowStock.length)} icon={<AlertTriangle size={20} />} tone={stats.lowStock.length ? 'sunshine' : 'mint'} />
        <StatCard label="Out of Stock" value={String(stats.outOfStock.length)} icon={<Package size={20} />} tone={stats.outOfStock.length ? 'red' : 'mint'} />
        <StatCard label="Customers" value={String(customers)} icon={<Users size={20} />} tone="lavender" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <ChartCard title="Sales — Last 30 Days">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={dailySales}>
              <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14b8a6" stopOpacity={0.4} /><stop offset="100%" stopColor="#14b8a6" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={v => `${v / 1000}k`} />
              <Tooltip formatter={(v: any) => money(Number(v))} />
              <Area type="monotone" dataKey="total" stroke="#14b8a6" strokeWidth={2.5} fill="url(#g)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Monthly Revenue">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={v => `${v / 1000}k`} />
              <Tooltip formatter={(v: any) => money(Number(v))} />
              <Bar dataKey="revenue" fill="#f59e0b" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard title="Best-Selling Products">
          <ResponsiveContainer width="100%" height={Math.max(220, topProducts.length * 36)}>
            <BarChart data={topProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" />
              <XAxis type="number" fontSize={11} />
              <YAxis type="category" dataKey="name" width={140} fontSize={11} />
              <Tooltip />
              <Bar dataKey="qty" fill="#8b5cf6" radius={[0, 8, 8, 0]} name="Units sold" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Category Performance">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={categoryPerf} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                {categoryPerf.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => money(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
};

const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-4xl border border-ink-100 bg-white p-5 shadow-soft">
    <h3 className="font-display font-bold text-ink-900 mb-4">{title}</h3>
    {children}
  </div>
);

export default AdminOverview;
