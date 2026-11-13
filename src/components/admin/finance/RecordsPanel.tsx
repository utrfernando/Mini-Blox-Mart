import React, { useEffect, useMemo, useState } from 'react';
import { Lock, Unlock, FileSpreadsheet, DatabaseBackup, History } from 'lucide-react';
import { supabase, formatDate, type Order, type Product } from '../../../lib/supabase';
import { PARTNERS, downloadWorkbook, fetchAll, monthKey, type Expense, type Lock as LockRow, type OrderCost, type PartnerTx } from '../../../lib/finance';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/Input';
import { type PurchasePay, owedOn } from './SupplierPanel';

const lastMonths = (n: number) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); return monthKey(d); });

const BACKUP_TABLES = [
  'products', 'product_costs', 'product_images', 'categories', 'suppliers', 'purchases', 'purchase_items', 'inventory_transactions',
  'orders', 'order_items', 'order_costs', 'payments', 'expenses', 'partner_transactions', 'expense_budgets', 'recurring_expenses',
  'finance_locks', 'discount_codes', 'profiles', 'website_settings', 'audit_logs',
];

const flat = (rows: any[]) => rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v !== null && typeof v === 'object' ? JSON.stringify(v).slice(0, 32000) : v])));

type Props = {
  locks: LockRow[]; orders: Order[]; products: Product[]; expenses: Expense[]; txs: PartnerTx[]; purchases: PurchasePay[]; orderCosts: OrderCost[];
  reload: () => void;
};

const TRACKED = ['expenses', 'partner_transactions', 'purchases', 'order_costs', 'expense_budgets', 'recurring_expenses', 'finance_locks'];
const LABEL: Record<string, string> = { expenses: 'Expense', partner_transactions: 'Partner entry', purchases: 'Purchase', order_costs: 'Order costs', expense_budgets: 'Budget', recurring_expenses: 'Recurring', finance_locks: 'Month lock' };

type Log = { id: string; user_id: string | null; action: string; entity: string; details: any; created_at: string };

export const RecordsPanel: React.FC<Props> = ({ locks, orders, products, expenses, txs, purchases, orderCosts, reload }) => {
  const { success, error } = useToast();
  const { user } = useAuth();
  const [month, setMonth] = useState(monthKey());
  const [busy, setBusy] = useState<string | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [entity, setEntity] = useState('all');
  const lockedSet = useMemo(() => new Set(locks.map(l => l.month)), [locks]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('audit_logs').select('id,user_id,action,entity,details,created_at').in('entity', TRACKED).order('created_at', { ascending: false }).limit(150);
      const list = (data || []) as Log[];
      setLogs(list);
      const ids = [...new Set(list.map(l => l.user_id).filter(Boolean))] as string[];
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id,full_name,email').in('id', ids);
        setNames(new Map((profs || []).map((p: any) => [p.id, p.full_name || p.email])));
      }
    })();
  }, [locks, expenses, txs, purchases, orderCosts]);

  const toggleLock = async (m: string) => {
    setBusy('lock');
    const { error: e } = lockedSet.has(m)
      ? await supabase.from('finance_locks').delete().eq('month', m)
      : await supabase.from('finance_locks').insert({ month: m, locked_by: user?.id });
    setBusy(null);
    if (e) return error(e.message);
    success(lockedSet.has(m) ? `${m} unlocked` : `${m} locked — its expenses and partner entries can no longer be changed`); reload();
  };

  const monthReport = () => {
    const inM = (d?: string | null) => !!d && d.startsWith(month);
    const pm = new Map(products.map(p => [p.id, p]));
    const oc = new Map(orderCosts.map(c => [c.order_id, c]));
    const sales = orders.filter(o => inM(o.placed_at) && o.status !== 'cancelled' && o.status !== 'returned');
    const exp = expenses.filter(e => inM(e.expense_date));
    const tx = txs.filter(t => inM(t.tx_date));
    let revenue = 0, cogs = 0, extra = 0;
    const orderRows = sales.map(o => {
      const c = (o.items || []).reduce((a, i) => a + Number((i.product_id && pm.get(i.product_id)?.landed_cost) || (i.product_id && pm.get(i.product_id)?.supplier_cost) || 0) * i.quantity, 0);
      const x = Number(oc.get(o.id)?.delivery_cost || 0) + Number(oc.get(o.id)?.payment_fee || 0);
      revenue += Number(o.total_amount); cogs += c; extra += x;
      return { Order: o.order_number, Date: o.placed_at.slice(0, 10), Customer: o.customer_name, Status: o.status, Payment: o.payment_status, Total: Number(o.total_amount), 'Product cost': c, 'Delivery + fees': x, Profit: Number(o.total_amount) - c - x };
    });
    const expTotal = exp.reduce((s, e) => s + Number(e.amount), 0);
    const summary: Record<string, unknown>[] = [
      { Item: 'Month', Value: month },
      { Item: 'Revenue', Value: revenue }, { Item: 'Product cost (COGS)', Value: cogs }, { Item: 'Delivery + payment fees', Value: extra },
      { Item: 'Gross profit', Value: revenue - cogs - extra }, { Item: 'Expenses', Value: expTotal }, { Item: 'Net profit', Value: revenue - cogs - extra - expTotal },
      { Item: 'Owed to suppliers (all time)', Value: purchases.reduce((s, p) => s + owedOn(p), 0) },
      ...PARTNERS.flatMap(p => [
        { Item: `${p} — expenses paid`, Value: exp.filter(e => e.paid_by === p).reduce((s, e) => s + Number(e.amount), 0) },
        { Item: `${p} — contributions`, Value: tx.filter(t => t.partner === p && t.kind === 'contribution').reduce((s, t) => s + Number(t.amount), 0) },
        { Item: `${p} — withdrawals`, Value: tx.filter(t => t.partner === p && t.kind === 'withdrawal').reduce((s, t) => s + Number(t.amount), 0) },
      ]),
    ];
    downloadWorkbook(`month-close-${month}.xlsx`, [
      { name: 'Summary', rows: summary },
      { name: 'Sales', rows: orderRows },
      { name: 'Expenses', rows: exp.map(e => ({ Date: e.expense_date, Category: e.category, Description: e.description, Amount: e.amount, 'Paid by': e.paid_by, 'Paid to': e.paid_to, Method: e.payment_method, Reference: e.reference, Invoice: e.invoice_name })) },
      { name: 'Partners', rows: tx.map(t => ({ Date: t.tx_date, Partner: t.partner, Type: t.kind, Amount: t.amount, Note: t.note })) },
      { name: 'Supplier purchases', rows: purchases.filter(p => inM(p.purchase_date)).map(p => ({ Date: p.purchase_date, Supplier: p.supplier?.name, Reference: p.reference, Total: p.total_cost, Paid: p.amount_paid || 0, Owed: owedOn(p) })) },
    ]);
  };

  const backup = async () => {
    setBusy('backup');
    try {
      const sheets = [];
      for (const t of BACKUP_TABLES) { const rows = await fetchAll(t); if (rows.length) sheets.push({ name: t, rows: flat(rows) }); }
      downloadWorkbook(`minibloxrc-backup-${new Date().toISOString().slice(0, 10)}.xlsx`, sheets);
      success('Backup downloaded. Keep it somewhere safe (Google Drive, email).');
    } catch (e: any) { error(e.message || 'Backup failed'); }
    setBusy(null);
  };

  const describe = (l: Log) => {
    const d = (l.details?.new || l.details?.old || {}) as Record<string, any>;
    const bits = [d.category, d.description, d.partner, d.kind, d.month, d.amount != null ? `Rs ${d.amount}` : d.amount_paid != null ? `paid ${d.amount_paid}` : d.monthly_limit != null ? `limit ${d.monthly_limit}` : d.delivery_cost != null ? `delivery ${d.delivery_cost}` : null].filter(Boolean);
    if (l.action === 'update' && l.details?.old && l.details?.new) {
      const ch = Object.keys(l.details.new).filter(k => !['created_at', 'updated_at'].includes(k) && JSON.stringify(l.details.new[k]) !== JSON.stringify(l.details.old[k]));
      if (ch.length) return `${bits.join(' · ')} — changed: ${ch.map(k => `${k} ${l.details.old[k] ?? '∅'} → ${l.details.new[k] ?? '∅'}`).join(', ')}`;
    }
    return bits.join(' · ');
  };
  const shown = entity === 'all' ? logs : logs.filter(l => l.entity === entity);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-4xl border border-ink-100 bg-white p-5 shadow-soft">
          <h3 className="font-display text-xl font-extrabold text-ink-900 flex items-center gap-2"><FileSpreadsheet size={18} className="text-mint-600" /> Month-close report</h3>
          <p className="text-xs text-ink-400 font-semibold mb-3">Excel file with summary, sales, expenses, partner entries and supplier purchases for one month.</p>
          <div className="flex gap-2"><Select value={month} onChange={e => setMonth(e.target.value)}>{lastMonths(18).map(m => <option key={m} value={m}>{m}</option>)}</Select><Button onClick={monthReport}>Download</Button></div>
        </div>
        <div className="rounded-4xl border border-ink-100 bg-white p-5 shadow-soft">
          <h3 className="font-display text-xl font-extrabold text-ink-900 flex items-center gap-2"><DatabaseBackup size={18} className="text-lavender-500" /> Backup everything</h3>
          <p className="text-xs text-ink-400 font-semibold mb-3">Downloads all products, orders, expenses, suppliers, customers and settings as one Excel file. Do this weekly — the free Supabase plan has no automatic backups.</p>
          <Button variant="secondary" onClick={backup} loading={busy === 'backup'}>Download backup</Button>
        </div>
      </div>

      <div className="rounded-4xl border border-ink-100 bg-white p-5 shadow-soft">
        <h3 className="font-display text-xl font-extrabold text-ink-900 flex items-center gap-2"><Lock size={18} className="text-sunshine-600" /> Close & lock months</h3>
        <p className="text-xs text-ink-400 font-semibold mb-4">A locked month can't have expenses or partner entries added, edited or deleted. Unlock it if you must fix something.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {lastMonths(12).map(m => {
            const on = lockedSet.has(m);
            return (
              <button key={m} disabled={busy === 'lock'} onClick={() => toggleLock(m)} className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-sm font-bold transition ${on ? 'border-sunshine-300 bg-sunshine-50 text-sunshine-700' : 'border-ink-200 text-ink-600 hover:border-mint-400'}`}>
                {m}{on ? <Lock size={15} /> : <Unlock size={15} className="text-ink-300" />}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-display text-xl font-extrabold text-ink-900 flex items-center gap-2"><History size={18} className="text-ink-500" /> Change history</h3>
          <Select value={entity} onChange={e => setEntity(e.target.value)} className="!w-48"><option value="all">Everything</option>{TRACKED.map(t => <option key={t} value={t}>{LABEL[t]}</option>)}</Select>
        </div>
        <div className="rounded-4xl border border-ink-100 bg-white shadow-soft divide-y divide-ink-100">
          {shown.length === 0 ? <p className="text-sm text-ink-400 text-center py-8">No changes recorded yet. (History starts once migration 0009 is run.)</p> : shown.map(l => (
            <div key={l.id} className="px-5 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase ${l.action === 'delete' ? 'bg-red-100 text-red-600' : l.action === 'insert' ? 'bg-mint-100 text-mint-700' : 'bg-sunshine-100 text-sunshine-700'}`}>{l.action === 'insert' ? 'added' : l.action === 'delete' ? 'deleted' : 'edited'}</span>
                <span className="font-bold text-ink-800">{LABEL[l.entity] || l.entity}</span>
                <span className="text-xs text-ink-400 font-semibold">by {l.user_id ? names.get(l.user_id) || 'admin' : 'system'} · {formatDate(l.created_at)} {new Date(l.created_at).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="text-xs text-ink-500 mt-1 break-words">{describe(l)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
