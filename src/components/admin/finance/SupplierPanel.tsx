import React, { useState } from 'react';
import { Wallet } from 'lucide-react';
import { supabase, formatDate, type Purchase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { Table, Td } from '../ui';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { Input, Field } from '../../ui/Input';
import { Badge } from '../../ui/Badge';

export type PurchasePay = Purchase & { amount_paid?: number | null; last_paid_date?: string | null };

export const owedOn = (p: PurchasePay) => Math.max(0, Number(p.total_cost) - Number(p.amount_paid || 0));

export const PaymentBadge: React.FC<{ p: PurchasePay }> = ({ p }) => {
  const owed = owedOn(p);
  if (owed <= 0) return <Badge color="green">Paid</Badge>;
  return Number(p.amount_paid || 0) > 0 ? <Badge color="sunshine">Part paid</Badge> : <Badge color="red">Unpaid</Badge>;
};

/** Modal to add a payment against one purchase (additive; history is kept in the audit log). */
export const PaymentModal: React.FC<{ purchase: PurchasePay | null; money: (n: number) => string; onClose: () => void; onSaved: () => void }> = ({ purchase, money, onClose, onSaved }) => {
  const { success, error } = useToast();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  React.useEffect(() => { if (purchase) setAmount(String(owedOn(purchase))); }, [purchase]);
  if (!purchase) return null;
  const owed = owedOn(purchase);

  const save = async () => {
    const a = Number(amount);
    if (!(a > 0)) return error('Enter an amount greater than 0.');
    setSaving(true);
    const { error: e } = await supabase.from('purchases').update({ amount_paid: Number(purchase.amount_paid || 0) + a, last_paid_date: date }).eq('id', purchase.id);
    setSaving(false);
    if (e) return error(e.message);
    success('Payment recorded'); onSaved();
  };

  return (
    <Modal open onClose={onClose} title="Record supplier payment">
      <p className="text-sm text-ink-600 mb-4"><b>{purchase.supplier?.name || 'Supplier'}</b> · {purchase.reference || 'Purchase'} · total {money(Number(purchase.total_cost))}, still owed <b className="text-red-500">{money(owed)}</b></p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Amount paid now"><Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
        <Field label="Payment date"><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
      </div>
      <div className="flex justify-end gap-2 mt-5"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={save}>Save payment</Button></div>
    </Modal>
  );
};

/** What you still owe suppliers. */
export const SupplierPanel: React.FC<{ purchases: PurchasePay[]; money: (n: number) => string; reload: () => void }> = ({ purchases, money, reload }) => {
  const [pay, setPay] = useState<PurchasePay | null>(null);
  const [showPaid, setShowPaid] = useState(false);
  const totalOwed = purchases.reduce((s, p) => s + owedOn(p), 0);
  const bySupplier = new Map<string, number>();
  purchases.forEach(p => { const o = owedOn(p); if (o > 0) bySupplier.set(p.supplier?.name || 'No supplier', (bySupplier.get(p.supplier?.name || 'No supplier') || 0) + o); });
  const rows = showPaid ? purchases : purchases.filter(p => owedOn(p) > 0);

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-4xl border border-ink-100 bg-white p-5 shadow-soft sm:col-span-1">
          <p className="text-xs font-extrabold uppercase tracking-wide text-ink-400">Total owed to suppliers</p>
          <p className={`font-display text-3xl font-extrabold mt-2 ${totalOwed > 0 ? 'text-red-500' : 'text-mint-700'}`}>{money(totalOwed)}</p>
        </div>
        <div className="rounded-4xl border border-ink-100 bg-white p-5 shadow-soft sm:col-span-2">
          <p className="text-xs font-extrabold uppercase tracking-wide text-ink-400 mb-2">By supplier</p>
          {bySupplier.size === 0 ? <p className="text-sm text-ink-400">Nothing owed. 🎉</p> : [...bySupplier.entries()].map(([n, v]) => (
            <div key={n} className="flex justify-between text-sm py-0.5"><span className="font-bold text-ink-800">{n}</span><span className="font-bold text-red-500">{money(v)}</span></div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-extrabold text-ink-900">Purchases</h3>
        <label className="flex items-center gap-2 text-xs font-bold text-ink-500 cursor-pointer"><input type="checkbox" checked={showPaid} onChange={e => setShowPaid(e.target.checked)} className="accent-teal-500" /> Show fully paid</label>
      </div>
      <Table head={['Date', 'Supplier', 'Reference', 'Total', 'Paid', 'Owed', 'Status', '']}>
        {rows.length === 0 ? <tr><Td className="text-center py-8 text-ink-400">No outstanding purchases.</Td></tr> : rows.map(p => (
          <tr key={p.id} className="hover:bg-ink-50/50">
            <Td className="text-xs text-ink-500">{formatDate(p.purchase_date)}</Td>
            <Td className="font-bold text-ink-800">{p.supplier?.name || '—'}</Td>
            <Td className="text-ink-600">{p.reference || '—'}</Td>
            <Td>{money(Number(p.total_cost))}</Td>
            <Td>{money(Number(p.amount_paid || 0))}{p.last_paid_date && <span className="block text-[11px] text-ink-400">{formatDate(p.last_paid_date)}</span>}</Td>
            <Td className="font-bold text-red-500">{money(owedOn(p))}</Td>
            <Td><PaymentBadge p={p} /></Td>
            <Td>{owedOn(p) > 0 && <Button size="sm" variant="secondary" onClick={() => setPay(p)}><Wallet size={14} /> Pay</Button>}</Td>
          </tr>
        ))}
      </Table>
      <PaymentModal purchase={pay} money={money} onClose={() => setPay(null)} onSaved={() => { setPay(null); reload(); }} />
    </div>
  );
};
