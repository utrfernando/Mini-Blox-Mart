import React, { useMemo, useState } from 'react';
import { formatDate, type Order, type Product } from '../../../lib/supabase';
import { type OrderCost } from '../../../lib/finance';
import { Table, Td } from '../ui';

type Cat = { id: string; name: string };

const unitCost = (p?: Product) => Number(p?.landed_cost || p?.supplier_cost || 0);

/** Profit by product, by category and per order (revenue − product cost − delivery − fees). */
export const ProfitPanel: React.FC<{
  orders: Order[]; products: (Product & { category_id?: string | null })[]; categories: Cat[]; orderCosts: OrderCost[]; money: (n: number) => string;
}> = ({ orders, products, categories, orderCosts, money }) => {
  const [view, setView] = useState<'product' | 'category' | 'order'>('product');

  const data = useMemo(() => {
    const pm = new Map(products.map(p => [p.id, p]));
    const cm = new Map(categories.map(c => [c.id, c.name]));
    const oc = new Map(orderCosts.map(c => [c.order_id, c]));
    const byProduct = new Map<string, { name: string; cat: string; units: number; revenue: number; cost: number }>();
    const perOrder = orders.map(o => {
      let cogs = 0;
      (o.items || []).forEach(i => {
        const p = i.product_id ? pm.get(i.product_id) : undefined;
        const cost = unitCost(p) * i.quantity;
        cogs += cost;
        const key = i.product_id || i.product_name;
        const row = byProduct.get(key) || { name: i.product_name, cat: (p && p.category_id && cm.get(p.category_id)) || 'Uncategorised', units: 0, revenue: 0, cost: 0 };
        row.units += i.quantity; row.revenue += Number(i.line_total); row.cost += cost;
        byProduct.set(key, row);
      });
      const c = oc.get(o.id);
      const extra = Number(c?.delivery_cost || 0) + Number(c?.payment_fee || 0);
      return { o, cogs, extra, profit: Number(o.total_amount) - cogs - extra, hasCosts: !!c };
    });
    const products_ = [...byProduct.values()].map(r => ({ ...r, profit: r.revenue - r.cost })).sort((a, b) => b.profit - a.profit);
    const cats = new Map<string, { units: number; revenue: number; cost: number }>();
    products_.forEach(r => { const c = cats.get(r.cat) || { units: 0, revenue: 0, cost: 0 }; c.units += r.units; c.revenue += r.revenue; c.cost += r.cost; cats.set(r.cat, c); });
    const categories_ = [...cats.entries()].map(([name, v]) => ({ name, ...v, profit: v.revenue - v.cost })).sort((a, b) => b.profit - a.profit);
    return { products_, categories_, perOrder };
  }, [orders, products, categories, orderCosts]);

  const pct = (profit: number, revenue: number) => (revenue > 0 ? `${((profit / revenue) * 100).toFixed(0)}%` : '—');
  const tab = (k: typeof view, l: string) => (
    <button onClick={() => setView(k)} className={`rounded-full px-4 py-1.5 text-xs font-extrabold border transition ${view === k ? 'bg-mint-500 border-mint-500 text-white' : 'bg-white border-ink-200 text-ink-600 hover:border-mint-400'}`}>{l}</button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">{tab('product', 'By product')}{tab('category', 'By category')}{tab('order', 'Per order')}
        <span className="text-xs text-ink-400 font-semibold ml-1">Product profit = sales − landed cost. Order profit also subtracts delivery cost and payment fees you enter on each order.</span>
      </div>
      {view === 'product' && (
        <Table head={['Product', 'Category', 'Units', 'Revenue', 'Cost', 'Profit', 'Margin']}>
          {data.products_.length === 0 ? <tr><Td className="text-center py-8 text-ink-400">No sales in this period.</Td></tr> : data.products_.map((r, i) => (
            <tr key={i} className="hover:bg-ink-50/50">
              <Td className="font-bold text-ink-800">{r.name}</Td><Td className="text-ink-500">{r.cat}</Td><Td>{r.units}</Td>
              <Td>{money(r.revenue)}</Td><Td className="text-ink-500">{money(r.cost)}</Td>
              <Td className={`font-bold ${r.profit < 0 ? 'text-red-500' : 'text-mint-700'}`}>{money(r.profit)}</Td><Td className="text-ink-600">{pct(r.profit, r.revenue)}</Td>
            </tr>
          ))}
        </Table>
      )}
      {view === 'category' && (
        <Table head={['Category', 'Units', 'Revenue', 'Cost', 'Profit', 'Margin']}>
          {data.categories_.length === 0 ? <tr><Td className="text-center py-8 text-ink-400">No sales in this period.</Td></tr> : data.categories_.map(r => (
            <tr key={r.name} className="hover:bg-ink-50/50">
              <Td className="font-bold text-ink-800">{r.name}</Td><Td>{r.units}</Td><Td>{money(r.revenue)}</Td><Td className="text-ink-500">{money(r.cost)}</Td>
              <Td className={`font-bold ${r.profit < 0 ? 'text-red-500' : 'text-mint-700'}`}>{money(r.profit)}</Td><Td className="text-ink-600">{pct(r.profit, r.revenue)}</Td>
            </tr>
          ))}
        </Table>
      )}
      {view === 'order' && (
        <Table head={['Order', 'Date', 'Revenue', 'Product cost', 'Delivery + fees', 'Profit']}>
          {data.perOrder.length === 0 ? <tr><Td className="text-center py-8 text-ink-400">No orders in this period.</Td></tr> : data.perOrder.slice(0, 200).map(({ o, cogs, extra, profit, hasCosts }) => (
            <tr key={o.id} className="hover:bg-ink-50/50">
              <Td className="font-bold text-ink-800">{o.order_number}</Td><Td className="text-xs text-ink-500">{formatDate(o.placed_at)}</Td>
              <Td>{money(Number(o.total_amount))}</Td><Td className="text-ink-500">{money(cogs)}</Td>
              <Td className="text-ink-500">{hasCosts ? money(extra) : <span className="text-ink-300">not entered</span>}</Td>
              <Td className={`font-bold ${profit < 0 ? 'text-red-500' : 'text-mint-700'}`}>{money(profit)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
};
