import React, { useEffect, useMemo, useState } from 'react';
import { Plus, ArrowUpFromLine, Package, Truck } from 'lucide-react';
import { supabase, PRODUCT_COSTS_EMBED, withCosts, formatCurrency, formatDate, type Product, type InventoryTransaction, type Purchase, type Supplier } from '../../lib/supabase';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { AdminHeader, Table, Td, StatCard, stockBadge } from '../../components/admin/ui';
import { Button } from '../../components/ui/Button';
import { Input, Select, Field, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { cn } from '../../lib/utils';

type Tab = 'overview' | 'transactions' | 'purchases' | 'suppliers';

const AdminInventory: React.FC = () => {
  const { currency } = useSettings();
  const { authUserId } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [products, setProducts] = useState<Product[]>([]);
  const [txns, setTxns] = useState<InventoryTransaction[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [adjustFor, setAdjustFor] = useState<Product | null>(null);
  const [purchaseModal, setPurchaseModal] = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);
  const load = async () => {
    const [p, t, pu, s] = await Promise.all([
      supabase.from('products').select('*, category:categories(*), ' + PRODUCT_COSTS_EMBED),
      supabase.from('inventory_transactions').select('*, product:products(id,name,sku)').order('created_at', { ascending: false }).limit(200),
      supabase.from('purchases').select('*, supplier:suppliers(*), items:purchase_items(*)').order('purchase_date', { ascending: false }),
      supabase.from('suppliers').select('*').order('name'),
    ]);
    setProducts(withCosts(p.data) as Product[]);
    setTxns((t.data || []) as InventoryTransaction[]);
    setPurchases((pu.data || []) as Purchase[]);
    setSuppliers((s.data || []) as Supplier[]);
  };
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const totalStock = products.reduce((s, p) => s + p.stock_quantity, 0);
    const available = products.filter(p => p.stock_quantity > 0).length;
    const sold = txns.filter(t => t.reason === 'sale').reduce((s, t) => s + Math.abs(t.quantity_change), 0);
    const low = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold);
    const out = products.filter(p => p.stock_quantity <= 0);
    const stockValue = products.reduce((s, p) => s + (p.landed_cost || 0) * p.stock_quantity, 0);
    return { totalStock, available, sold, low, out, stockValue };
  }, [products, txns]);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Stock Overview' },
    { key: 'transactions', label: 'Movement History' },
    { key: 'purchases', label: 'Purchases' },
    { key: 'suppliers', label: 'Suppliers' },
  ];

  return (
    <div>
      <AdminHeader title="Inventory" subtitle="Stock, purchases & suppliers" />
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn('px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition', tab === t.key ? 'bg-mint-500 text-white' : 'bg-white border border-ink-100 text-ink-600 hover:border-mint-300')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Units" value={String(stats.totalStock)} icon={<Package size={20} />} tone="mint" />
            <StatCard label="Available Products" value={String(stats.available)} icon={<Package size={20} />} tone="sunshine" />
            <StatCard label="Units Sold" value={String(stats.sold)} icon={<ArrowUpFromLine size={20} />} tone="lavender" />
            <StatCard label="Stock Value (landed)" value={formatCurrency(stats.stockValue, currency)} icon={<Truck size={20} />} tone="ink" />
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <StockList title={`Low Stock (${stats.low.length})`} products={stats.low} onAdjust={setAdjustFor} warn />
            <StockList title={`Out of Stock (${stats.out.length})`} products={stats.out} onAdjust={setAdjustFor} />
          </div>
          <div>
            <h3 className="font-display font-bold text-lg text-ink-900 mb-3">All Products — Stock Levels</h3>
            <Table head={['Product', 'Supplier', 'In Stock', 'Threshold', 'Unit Cost', 'Value', '']}>
              {products.map(p => (
                <tr key={p.id} className="hover:bg-ink-50/50">
                  <Td><p className="font-bold text-ink-900">{p.name}</p><p className="text-xs text-ink-400">{p.sku}</p></Td>
                  <Td className="text-ink-600">{suppliers.find(s => s.id === p.supplier_id)?.name || '—'}</Td>
                  <Td><span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold', stockBadge(p.stock_quantity, p.low_stock_threshold))}>{p.stock_quantity}</span></Td>
                  <Td className="text-ink-500">{p.low_stock_threshold}</Td>
                  <Td className="text-ink-600">{formatCurrency(p.landed_cost || p.supplier_cost, currency)}</Td>
                  <Td className="font-bold text-ink-900">{formatCurrency((p.landed_cost || 0) * p.stock_quantity, currency)}</Td>
                  <Td><Button variant="secondary" size="sm" onClick={() => setAdjustFor(p)}>Adjust</Button></Td>
                </tr>
              ))}
            </Table>
          </div>
        </div>
      )}

      {tab === 'transactions' && (
        <Table head={['Date', 'Product', 'Change', 'Reason', 'Reference', 'Notes']}>
          {txns.map(t => (
            <tr key={t.id} className="hover:bg-ink-50/50">
              <Td className="text-ink-500 whitespace-nowrap">{formatDate(t.created_at)}</Td>
              <Td className="font-bold text-ink-900">{t.product?.name || '—'}<span className="block text-xs text-ink-400 font-normal">{t.product?.sku}</span></Td>
              <Td><span className={cn('font-extrabold', t.quantity_change < 0 ? 'text-red-500' : 'text-mint-600')}>{t.quantity_change > 0 ? '+' : ''}{t.quantity_change}</span></Td>
              <Td><Badge color={t.reason === 'sale' ? 'sunshine' : t.reason === 'purchase' ? 'mint' : 'ink'}>{t.reason}</Badge></Td>
              <Td className="text-ink-500 text-xs">{t.reference_type || '—'}</Td>
              <Td className="text-ink-500 text-xs max-w-[220px] truncate">{t.notes || '—'}</Td>
            </tr>
          ))}
        </Table>
      )}

      {tab === 'purchases' && (
        <div className="space-y-4">
          <div className="flex justify-end"><Button onClick={() => setPurchaseModal(true)}><Plus size={16} /> Record Purchase</Button></div>
          {purchases.map(pu => (
            <div key={pu.id} className="rounded-4xl border border-ink-100 bg-white p-5 shadow-soft">
              <div className="flex flex-wrap justify-between gap-2 mb-3">
                <div>
                  <p className="font-display font-bold text-ink-900">{pu.reference || 'Purchase'} · {formatDate(pu.purchase_date)}</p>
                  <p className="text-xs text-ink-400">{pu.supplier?.name || 'No supplier'} · {pu.items?.length || 0} item(s)</p>
                </div>
                <p className="font-extrabold text-ink-900">{formatCurrency(Number(pu.total_cost), currency)}</p>
              </div>
              <div className="text-sm text-ink-600 space-y-1">
                {pu.items?.map((it, i) => {
                  const prod = products.find(p => p.id === it.product_id);
                  return <p key={i}>• {prod?.name || 'Product'} — {it.quantity} × {formatCurrency(it.unit_cost, currency)}</p>;
                })}
              </div>
            </div>
          ))}
          {purchases.length === 0 && <p className="text-ink-400 font-bold text-center py-10">No purchases recorded yet.</p>}
        </div>
      )}

      {tab === 'suppliers' && (
        <div className="space-y-4">
          <div className="flex justify-end"><Button onClick={() => setSupplierModal(true)}><Plus size={16} /> Add Supplier</Button></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map(s => (
              <div key={s.id} className="rounded-4xl border border-ink-100 bg-white p-5 shadow-soft">
                <p className="font-display font-bold text-ink-900">{s.name}</p>
                {s.contact_person && <p className="text-sm text-ink-500">{s.contact_person}</p>}
                {s.phone && <p className="text-sm text-ink-500">{s.phone}</p>}
                {s.email && <p className="text-sm text-mint-600">{s.email}</p>}
                {s.address && <p className="text-xs text-ink-400 mt-1">{s.address}</p>}
              </div>
            ))}
          </div>
          {suppliers.length === 0 && <p className="text-ink-400 font-bold text-center py-10">No suppliers yet.</p>}
        </div>
      )}

      <AdjustModal product={adjustFor} onClose={() => setAdjustFor(null)} onSaved={() => { setAdjustFor(null); load(); }} />
      <PurchaseModal open={purchaseModal} onClose={() => setPurchaseModal(false)} products={products} suppliers={suppliers} userId={authUserId} onSaved={() => { setPurchaseModal(false); load(); }} />
      <SupplierModal open={supplierModal} onClose={() => setSupplierModal(false)} onSaved={() => { setSupplierModal(false); load(); }} />
    </div>
  );
};

// ------------------------------------------------------------------
const StockList: React.FC<{ title: string; products: Product[]; onAdjust: (p: Product) => void; warn?: boolean }> = ({ title, products, onAdjust, warn }) => (
  <div className="rounded-4xl border border-ink-100 bg-white p-5 shadow-soft">
    <h3 className={cn('font-display font-bold mb-3', warn ? 'text-sunshine-600' : 'text-red-500')}>{title}</h3>
    <div className="space-y-2 max-h-72 overflow-y-auto">
      {products.map(p => (
        <div key={p.id} className="flex items-center justify-between gap-3 py-2 border-b border-ink-50 last:border-0">
          <div className="min-w-0"><p className="font-bold text-ink-900 text-sm truncate">{p.name}</p><p className="text-xs text-ink-400">{p.sku}</p></div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn('rounded-full px-2.5 py-1 text-xs font-extrabold', stockBadge(p.stock_quantity, p.low_stock_threshold))}>{p.stock_quantity}</span>
            <Button variant="ghost" size="sm" onClick={() => onAdjust(p)}>Adjust</Button>
          </div>
        </div>
      ))}
      {products.length === 0 && <p className="text-sm text-ink-400 py-4 text-center">All good!</p>}
    </div>
  </div>
);

// ------------------------------------------------------------------
const AdjustModal: React.FC<{ product: Product | null; onClose: () => void; onSaved: () => void }> = ({ product, onClose, onSaved }) => {
  const { success, error } = useToast();
  const { authUserId } = useAuth();
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState<'adjustment' | 'correction' | 'damage'>('adjustment');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (product) { setQty(''); setNotes(''); } }, [product]);

  const save = async () => {
    const delta = Number(qty);
    if (!product || !delta) { error('Enter a quantity (+ to add, − to remove)'); return; }
    const newStock = product.stock_quantity + delta;
    if (newStock < 0) { error('Stock cannot go below zero'); return; }
    setSaving(true);
    const { error: e } = await supabase.from('products').update({ stock_quantity: newStock }).eq('id', product.id);
    if (e) { error(e.message); setSaving(false); return; }
    await supabase.from('inventory_transactions').insert({
      product_id: product.id, quantity_change: delta, reason, notes: notes || `Manual ${reason}`, created_by: authUserId,
    });
    setSaving(false); success(`Stock updated to ${newStock}`); onSaved();
  };

  return (
    <Modal open={!!product} onClose={onClose} title={`Adjust Stock — ${product?.name}`}>
      <div className="space-y-4">
        <p className="text-sm text-ink-500">Current stock: <strong className="text-ink-900">{product?.stock_quantity}</strong></p>
        <Field label="Quantity Change (+ add / − remove)"><Input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="e.g. 10 or -3" /></Field>
        <Field label="Reason">
          <Select value={reason} onChange={e => setReason(e.target.value as any)}>
            <option value="adjustment">Stock Adjustment</option>
            <option value="correction">Correction</option>
            <option value="damage">Damage / Loss</option>
          </Select>
        </Field>
        <Field label="Notes"><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" /></Field>
        <div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Update Stock</Button></div>
      </div>
    </Modal>
  );
};

// ------------------------------------------------------------------
const PurchaseModal: React.FC<{ open: boolean; onClose: () => void; products: Product[]; suppliers: Supplier[]; userId: string | null; onSaved: () => void }> = ({ open, onClose, products, suppliers, userId, onSaved }) => {
  const { success, error } = useToast();
  const [reference, setReference] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<{ product_id: string; quantity: number; unit_cost: number }[]>([{ product_id: '', quantity: 1, unit_cost: 0 }]);
  const [saving, setSaving] = useState(false);

  const total = rows.reduce((s, r) => s + r.quantity * r.unit_cost, 0);

  const save = async () => {
    const valid = rows.filter(r => r.product_id && r.quantity > 0);
    if (!valid.length) { error('Add at least one item'); return; }
    setSaving(true);
    const { data: purchase, error: e } = await supabase.from('purchases').insert({
      supplier_id: supplierId || null, reference: reference || null, purchase_date: date,
      total_cost: total, notes: notes || null, created_by: userId,
    }).select('id').single();
    if (e) { error(e.message); setSaving(false); return; }
    await supabase.from('purchase_items').insert(valid.map(r => ({ purchase_id: purchase.id, product_id: r.product_id, quantity: r.quantity, unit_cost: r.unit_cost })));
    for (const r of valid) {
      const prod = products.find(p => p.id === r.product_id);
      if (!prod) continue;
      await supabase.from('products').update({ stock_quantity: prod.stock_quantity + r.quantity }).eq('id', r.product_id);
      await supabase.from('product_costs').upsert({
        product_id: r.product_id,
        supplier_id: prod.supplier_id ?? null,
        supplier_cost: prod.supplier_cost || 0,
        landed_cost: r.unit_cost || prod.landed_cost || 0,
      });
      await supabase.from('inventory_transactions').insert({ product_id: r.product_id, quantity_change: r.quantity, reason: 'purchase', reference_type: 'purchase', reference_id: purchase.id, notes: `Purchase ${reference || ''}`.trim(), created_by: userId });
    }
    setSaving(false); success('Purchase recorded & stock updated'); onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title="Record Purchase" wide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Reference"><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="PO-001" /></Field>
          <Field label="Supplier">
            <Select value={supplierId} onChange={e => setSupplierId(e.target.value)}><option value="">—</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          </Field>
          <Field label="Date"><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_90px_110px_36px] gap-2 text-xs font-extrabold uppercase text-ink-400 px-1">
            <span>Product</span><span>Qty</span><span>Unit Cost</span><span />
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_90px_110px_36px] gap-2">
              <Select value={r.product_id} onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, product_id: e.target.value } : x))}>
                <option value="">Select…</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
              <Input type="number" min={1} value={r.quantity} onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} />
              <Input type="number" step="0.01" value={r.unit_cost} onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, unit_cost: Number(e.target.value) } : x))} />
              <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="p-2 text-red-400 hover:text-red-600"><TrashIcon /></button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={() => setRows([...rows, { product_id: '', quantity: 1, unit_cost: 0 }])}><Plus size={14} /> Add Row</Button>
        </div>
        <Field label="Notes"><Textarea value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[60px]" /></Field>
        <div className="flex items-center justify-between">
          <p className="font-extrabold text-ink-900">Total: {formatCurrency(total, 'LKR')}</p>
          <div className="flex gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Save Purchase</Button></div>
        </div>
      </div>
    </Modal>
  );
};

const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>;

const SupplierModal: React.FC<{ open: boolean; onClose: () => void; onSaved: () => void }> = ({ open, onClose, onSaved }) => {
  const { success, error } = useToast();
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.name.trim()) { error('Name required'); return; }
    setSaving(true);
    const { error: e } = await supabase.from('suppliers').insert(form);
    setSaving(false);
    if (e) error(e.message); else { success('Supplier added'); setForm({ name: '', contact_person: '', phone: '', email: '', address: '', notes: '' }); onSaved(); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Add Supplier">
      <div className="space-y-4">
        <Field label="Company Name"><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Contact Person"><Input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
        </div>
        <Field label="Email"><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Address"><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></Field>
        <Field label="Notes"><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="min-h-[60px]" /></Field>
        <div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
      </div>
    </Modal>
  );
};

export default AdminInventory;
