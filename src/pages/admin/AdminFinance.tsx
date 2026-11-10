import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, TrendingUp, Receipt, Wallet, Boxes, Truck, Plus, Download, Trash2, AlertTriangle, Pencil, Paperclip } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import { InvoiceControl } from '../../components/admin/InvoiceControl';
import { supabase, uploadInvoice, PRODUCT_COSTS_EMBED, withCosts, formatCurrency, formatDate, type Order, type Product } from '../../lib/supabase';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { AdminHeader, StatCard, Table, Td } from '../../components/admin/ui';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, Field } from '../../components/ui/Input';

type Expense = { id: string; expense_date: string; category: string; description: string | null; amount: number; paid_to: string | null; payment_method: string | null; reference: string | null; invoice_path?: string | null; invoice_name?: string | null };
type Purchase = { id: string; purchase_date: string; total_cost: number };

const EXPENSE_CATEGORIES = ['Shipping & delivery', 'Packaging', 'Advertising', 'Salaries & wages', 'Rent', 'Utilities', 'Platform & payment fees', 'Software & tools', 'Taxes & licences', 'Other'];
const COLORS = ['#14b8a6', '#f59e0b', '#8b5cf6', '#fb923c', '#2dd4bf', '#fbbf24', '#a78bfa', '#ef4444', '#64748b', '#10b981'];
const RANGES = [
  { v: 'month', l: 'This month' }, { v: '30', l: 'Last 30 days' }, { v: '90', l: 'Last 90 days' }, { v: 'year', l: 'This year' }, { v: 'all', l: 'All time' },
];

const rangeStart = (v: string): Date | null => {
  const n = new Date();
  if (v === 'month') return new Date(n.getFullYear(), n.getMonth(), 1);
  if (v === 'year') return new Date(n.getFullYear(), 0, 1);
  if (v === '30' || v === '90') { const d = new Date(); d.setDate(d.getDate() - Number(v)); return d; }
  return null;
};

const download = (name: string, rows: (string | number)[][]) => {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
};

const blank = { expense_date: new Date().toISOString().slice(0, 10), category: EXPENSE_CATEGORIES[0], description: '', amount: '', paid_to: '', payment_method: 'cash', reference: '' };

const AdminFinance: React.FC = () => {
  const { currency } = useSettings();
  const { user } = useAuth();
  const { success, error } = useToast();
  const money = (n: number) => formatCurrency(n, currency);

  const [range, setRange] = useState('month');
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<typeof blank>(blank);
  const [editId, setEditId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [o, p, e, pu] = await Promise.all([
      supabase.from('orders').select('*, items:order_items(*)').order('placed_at', { ascending: false }),
      supabase.from('products').select('id,name,stock_quantity,' + PRODUCT_COSTS_EMBED),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('purchases').select('id,purchase_date,total_cost'),
    ]);
    setOrders((o.data || []) as Order[]);
    setProducts(withCosts(p.data) as Product[]);
    setMissingTable(!!e.error);
    setExpenses((e.data || []) as Expense[]);
    setPurchases((pu.data || []) as Purchase[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const start = rangeStart(range);
  const inRange = (d: string) => !start || new Date(d) >= start;

  const f = useMemo(() => {
    const productMap = new Map(products.map(p => [p.id, p]));
    const valid = orders.filter(o => inRange(o.placed_at) && o.status !== 'cancelled' && o.status !== 'returned');
    const revenue = valid.reduce((s, o) => s + Number(o.total_amount), 0);
    const collected = valid.filter(o => o.payment_status === 'paid').reduce((s, o) => s + Number(o.total_amount), 0);
    const outstanding = valid.filter(o => o.payment_status === 'pending').reduce((s, o) => s + Number(o.total_amount), 0);
    const cogs = valid.reduce((s, o) => s + (o.items || []).reduce((a, i) => {
      const p = i.product_id ? productMap.get(i.product_id) : undefined;
      return a + Number(p?.landed_cost || p?.supplier_cost || 0) * i.quantity;
    }, 0), 0);
    const exp = expenses.filter(e => inRange(e.expense_date));
    const expenseTotal = exp.reduce((s, e) => s + Number(e.amount), 0);
    const purchaseSpend = purchases.filter(p => inRange(p.purchase_date)).reduce((s, p) => s + Number(p.total_cost), 0);
    const gross = revenue - cogs;
    const net = gross - expenseTotal;
    const inventoryValue = products.reduce((s, p) => s + Number(p.landed_cost || p.supplier_cost || 0) * p.stock_quantity, 0);
    const margin = revenue > 0 ? (net / revenue) * 100 : 0;
    return { valid, revenue, collected, outstanding, cogs, exp, expenseTotal, purchaseSpend, gross, net, inventoryValue, margin };
  }, [orders, products, expenses, purchases, range]);

  const monthly = useMemo(() => {
    const productMap = new Map(products.map(p => [p.id, p]));
    const m = new Map<string, { month: string; Revenue: number; Costs: number; Profit: number }>();
    const row = (d: string) => { const k = d.slice(0, 7); if (!m.has(k)) m.set(k, { month: k, Revenue: 0, Costs: 0, Profit: 0 }); return m.get(k)!; };
    orders.filter(o => inRange(o.placed_at) && o.status !== 'cancelled' && o.status !== 'returned').forEach(o => {
      const r = row(o.placed_at);
      r.Revenue += Number(o.total_amount);
      r.Costs += (o.items || []).reduce((a, i) => { const p = i.product_id ? productMap.get(i.product_id) : undefined; return a + Number(p?.landed_cost || p?.supplier_cost || 0) * i.quantity; }, 0);
    });
    expenses.filter(e => inRange(e.expense_date)).forEach(e => { row(e.expense_date).Costs += Number(e.amount); });
    return [...m.values()].sort((a, b) => a.month.localeCompare(b.month)).map(r => ({ ...r, Revenue: Math.round(r.Revenue), Costs: Math.round(r.Costs), Profit: Math.round(r.Revenue - r.Costs) }));
  }, [orders, products, expenses, range]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    f.exp.forEach(e => m.set(e.category, (m.get(e.category) || 0) + Number(e.amount)));
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [f.exp]);

  const openNew = () => { setEditId(null); setForm(blank); setFile(null); setFormOpen(true); };
  const openEdit = (x: Expense) => {
    setEditId(x.id); setFile(null);
    setForm({ expense_date: x.expense_date, category: x.category, description: x.description || '', amount: String(x.amount), paid_to: x.paid_to || '', payment_method: x.payment_method || 'cash', reference: x.reference || '' });
    setFormOpen(true);
  };

  const saveExpense = async () => {
    const amount = Number(form.amount);
    if (!(amount >= 0) || form.amount === '') return error('Enter an amount.');
    setSaving(true);
    try {
      const row: Record<string, unknown> = {
        expense_date: form.expense_date, category: form.category, description: form.description || null, amount,
        paid_to: form.paid_to || null, payment_method: form.payment_method || null, reference: form.reference || null,
      };
      if (file) { const up = await uploadInvoice(file, 'expenses'); row.invoice_path = up.path; row.invoice_name = up.name; }
      if (editId) {
        const old = expenses.find(x => x.id === editId);
        const { error: e } = await supabase.from('expenses').update(row).eq('id', editId);
        if (e) throw e;
        if (file && old?.invoice_path) await supabase.storage.from('invoices').remove([old.invoice_path]);
      } else {
        const { error: e } = await supabase.from('expenses').insert({ ...row, created_by: user?.id });
        if (e) throw e;
      }
      success(editId ? 'Expense updated' : 'Expense recorded'); setFormOpen(false); setForm(blank); setFile(null); setEditId(null); load();
    } catch (e: any) { error(e.message || 'Could not save expense'); }
    finally { setSaving(false); }
  };
  const removeExpense = async (x: Expense) => {
    if (!confirm(`Delete this ${money(Number(x.amount))} expense?`)) return;
    await supabase.from('expenses').delete().eq('id', x.id);
    if (x.invoice_path) await supabase.storage.from('invoices').remove([x.invoice_path]);
    load();
  };

  const exportExpenses = () => download(`expenses-${range}.csv`, [
    ['Date', 'Category', 'Description', 'Amount', 'Paid to', 'Method', 'Reference', 'Invoice file'],
    ...f.exp.map(e => [e.expense_date, e.category, e.description || '', e.amount, e.paid_to || '', e.payment_method || '', e.reference || '', e.invoice_name || '']),
  ]);
  const exportOrders = () => download(`sales-${range}.csv`, [
    ['Order', 'Date', 'Customer', 'Status', 'Payment', 'Method', 'Subtotal', 'Discount', 'Delivery', 'Total'],
    ...f.valid.map(o => [o.order_number, o.placed_at.slice(0, 10), o.customer_name, o.status, o.payment_status, o.payment_method, o.subtotal, o.discount_amount, o.delivery_fee, o.total_amount]),
  ]);

  return (
    <div>
      <AdminHeader title="Finance" subtitle="Sales, costs, expenses and profit in one place"
        actions={<>
          <Select value={range} onChange={e => setRange(e.target.value)} className="!py-2">{RANGES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}</Select>
          <Button variant="outline" onClick={exportOrders}><Download size={16} /> Sales CSV</Button>
          <Button onClick={openNew} disabled={missingTable}><Plus size={16} /> Add Expense</Button>
        </>} />

      {missingTable && (
        <div className="mb-6 rounded-3xl bg-sunshine-50 border border-sunshine-200 p-4 text-sm text-ink-800 flex gap-3">
          <AlertTriangle className="shrink-0 text-sunshine-600" />
          <span>The expenses table isn't set up yet. In Supabase open <b>SQL Editor</b>, paste the contents of <code>supabase/migrations/0003_finance_expenses.sql</code> and run it, then refresh this page. Sales figures below work without it.</span>
        </div>
      )}

      {loading ? <p className="text-ink-400">Loading…</p> : <>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <StatCard label="Revenue" value={money(f.revenue)} icon={<Banknote size={20} />} tone="mint" hint={`${f.valid.length} orders`} />
          <StatCard label="Gross profit" value={money(f.gross)} icon={<TrendingUp size={20} />} tone="lavender" hint={`Cost of goods ${money(f.cogs)}`} />
          <StatCard label="Expenses" value={money(f.expenseTotal)} icon={<Receipt size={20} />} tone="peach" hint={`${f.exp.length} entries`} />
          <StatCard label="Net profit" value={money(f.net)} icon={<Wallet size={20} />} tone={f.net >= 0 ? 'mint' : 'red'} hint={`${f.margin.toFixed(1)}% margin`} />
          <StatCard label="Cash collected" value={money(f.collected)} icon={<Banknote size={20} />} tone="mint" hint="Orders marked paid" />
          <StatCard label="Outstanding" value={money(f.outstanding)} icon={<AlertTriangle size={20} />} tone="sunshine" hint="Unpaid / COD pending" />
          <StatCard label="Stock purchases" value={money(f.purchaseSpend)} icon={<Truck size={20} />} tone="ink" hint="From supplier purchases" />
          <StatCard label="Inventory value" value={money(f.inventoryValue)} icon={<Boxes size={20} />} tone="lavender" hint="Stock on hand at cost" />
        </div>

        <div className="grid lg:grid-cols-3 gap-5 mb-6">
          <div className="lg:col-span-2 rounded-4xl border border-ink-100 bg-white p-5 shadow-soft">
            <h3 className="font-display font-extrabold text-ink-900 mb-3">Revenue vs costs by month</h3>
            {monthly.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Legend />
                  <Bar dataKey="Revenue" fill="#14b8a6" radius={[6, 6, 0, 0]} /><Bar dataKey="Costs" fill="#fb923c" radius={[6, 6, 0, 0]} /><Bar dataKey="Profit" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-ink-400 py-12 text-center">No sales or expenses in this period yet.</p>}
          </div>
          <div className="rounded-4xl border border-ink-100 bg-white p-5 shadow-soft">
            <h3 className="font-display font-extrabold text-ink-900 mb-3">Expenses by category</h3>
            {byCategory.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart><Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>{byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: any) => money(Number(v))} /><Legend /></PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-ink-400 py-12 text-center">No expenses recorded.</p>}
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-xl font-extrabold text-ink-900">Expense ledger</h3>
          <Button variant="ghost" size="sm" onClick={exportExpenses} disabled={!f.exp.length}><Download size={14} /> Export CSV</Button>
        </div>
        <Table head={['Date', 'Category', 'Description', 'Paid to', 'Ref', 'Invoice', 'Amount', '']}>
          {f.exp.length === 0 ? <tr><Td className="text-center py-8 text-ink-400">No expenses in this period.</Td></tr> :
          f.exp.map(e => (
            <tr key={e.id} className="hover:bg-ink-50/50">
              <Td className="text-xs text-ink-500">{formatDate(e.expense_date)}</Td>
              <Td className="font-bold text-ink-800">{e.category}</Td>
              <Td className="text-ink-600">{e.description || '—'}</Td>
              <Td className="text-ink-600">{e.paid_to || '—'}</Td>
              <Td className="text-xs text-ink-500">{e.reference || '—'}</Td>
              <Td><InvoiceControl table="expenses" id={e.id} path={e.invoice_path} name={e.invoice_name} onChanged={load} /></Td>
              <Td className="font-bold text-ink-900">{money(Number(e.amount))}</Td>
              <Td><div className="flex"><button onClick={() => openEdit(e)} className="p-2 rounded-full hover:bg-ink-100 text-ink-500" aria-label="Edit"><Pencil size={15} /></button><button onClick={() => removeExpense(e)} className="p-2 rounded-full hover:bg-red-50 text-red-500" aria-label="Delete"><Trash2 size={15} /></button></div></Td>
            </tr>
          ))}
        </Table>
      </>}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editId ? "Edit expense" : "Add expense"}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Date"><Input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} /></Field>
          <Field label="Amount"><Input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Category"><Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Payment method"><Select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}><option value="cash">Cash</option><option value="bank">Bank transfer</option><option value="card">Card</option><option value="other">Other</option></Select></Field>
          <Field label="Paid to"><Input value={form.paid_to} onChange={e => setForm({ ...form, paid_to: e.target.value })} /></Field>
          <Field label="Receipt / invoice no."><Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></Field>
          <div className="sm:col-span-2">
            <Field label="Invoice / receipt (optional)">
              <label className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 px-4 py-3 text-sm cursor-pointer hover:border-mint-400">
                <Paperclip size={16} className="text-mint-600" />
                <span className="font-semibold text-ink-700 truncate">{file ? file.name : editId ? 'Choose a file to replace the current invoice' : 'PDF, image or spreadsheet (max 15 MB)'}</span>
                <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.doc,.docx" onChange={e => setFile(e.target.files?.[0] || null)} />
              </label>
            </Field>
          </div>
          <div className="sm:col-span-2"><Field label="Description"><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field></div>
        </div>
        <div className="flex justify-end gap-2 mt-5"><Button variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button><Button loading={saving} onClick={saveExpense}>{editId ? 'Save changes' : 'Save expense'}</Button></div>
      </Modal>
    </div>
  );
};

export default AdminFinance;
