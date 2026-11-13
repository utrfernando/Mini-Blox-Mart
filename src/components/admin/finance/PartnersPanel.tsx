import React, { useMemo, useState } from 'react';
import { Plus, Trash2, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { supabase, formatDate } from '../../../lib/supabase';
import { PARTNERS, type Expense, type PartnerTx } from '../../../lib/finance';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { Table, Td } from '../ui';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { Input, Select, Field } from '../../ui/Input';

const blank = { tx_date: new Date().toISOString().slice(0, 10), partner: '', kind: 'contribution', amount: '', note: '' };

/** Money each partner put in / took out, plus expenses they paid personally. */
export const PartnersPanel: React.FC<{ txs: PartnerTx[]; expenses: Expense[]; money: (n: number) => string; reload: () => void }> = ({ txs, expenses, money, reload }) => {
  const { success, error } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  const stats = useMemo(() => PARTNERS.map(p => {
    const contributed = txs.filter(t => t.partner === p && t.kind === 'contribution').reduce((s, t) => s + Number(t.amount), 0);
    const withdrawn = txs.filter(t => t.partner === p && t.kind === 'withdrawal').reduce((s, t) => s + Number(t.amount), 0);
    const spent = expenses.filter(e => e.paid_by === p).reduce((s, e) => s + Number(e.amount), 0);
    return { p, contributed, withdrawn, spent, net: contributed + spent - withdrawn };
  }), [txs, expenses]);
  const totalNet = stats.reduce((s, x) => s + x.net, 0);

  const save = async () => {
    const amount = Number(form.amount);
    if (!form.partner) return error('Choose the partner.');
    if (!(amount > 0)) return error('Enter an amount greater than 0.');
    setSaving(true);
    const { error: e } = await supabase.from('partner_transactions').insert({ ...form, amount, note: form.note || null, created_by: user?.id });
    setSaving(false);
    if (e) return error(e.message);
    success('Recorded'); setOpen(false); setForm(blank); reload();
  };
  const remove = async (t: PartnerTx) => {
    if (!confirm(`Delete this ${money(Number(t.amount))} ${t.kind}?`)) return;
    const { error: e } = await supabase.from('partner_transactions').delete().eq('id', t.id);
    if (e) error(e.message); else reload();
  };

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        {stats.map(s => (
          <div key={s.p} className="rounded-4xl border border-ink-100 bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-xl font-extrabold text-ink-900">{s.p}</h3>
              <span className="rounded-full bg-lavender-50 text-lavender-600 px-3 py-1 text-xs font-extrabold">{totalNet > 0 ? Math.round((s.net / totalNet) * 100) : 0}% of total put in</span>
            </div>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Cash put in (contributions)</dt><dd className="font-bold text-ink-900">{money(s.contributed)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Business expenses paid</dt><dd className="font-bold text-ink-900">{money(s.spent)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Taken out (withdrawals)</dt><dd className="font-bold text-red-500">−{money(s.withdrawn)}</dd></div>
              <div className="flex justify-between border-t border-ink-100 pt-2 mt-2"><dt className="font-extrabold text-ink-800">Net invested</dt><dd className="font-extrabold text-mint-700">{money(s.net)}</dd></div>
            </dl>
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-400 font-semibold -mt-3">Net invested = contributions + expenses paid from own pocket − withdrawals. Use this to settle up when you split profit.</p>

      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-extrabold text-ink-900">Contributions & withdrawals</h3>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> Add entry</Button>
      </div>
      <Table head={['Date', 'Partner', 'Type', 'Note', 'Amount', '']}>
        {txs.length === 0 ? <tr><Td className="text-center py-8 text-ink-400">No entries yet.</Td></tr> : txs.map(t => (
          <tr key={t.id} className="hover:bg-ink-50/50">
            <Td className="text-xs text-ink-500">{formatDate(t.tx_date)}</Td>
            <Td className="font-bold text-ink-800">{t.partner}</Td>
            <Td>{t.kind === 'contribution'
              ? <span className="inline-flex items-center gap-1 text-xs font-extrabold text-mint-700"><ArrowDownToLine size={13} /> Put in</span>
              : <span className="inline-flex items-center gap-1 text-xs font-extrabold text-red-500"><ArrowUpFromLine size={13} /> Taken out</span>}</Td>
            <Td className="text-ink-600">{t.note || '—'}</Td>
            <Td className="font-bold text-ink-900">{money(Number(t.amount))}</Td>
            <Td><button onClick={() => remove(t)} className="p-2 rounded-full hover:bg-red-50 text-red-500" aria-label="Delete"><Trash2 size={15} /></button></Td>
          </tr>
        ))}
      </Table>

      <Modal open={open} onClose={() => setOpen(false)} title="Add partner entry">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Date"><Input type="date" value={form.tx_date} onChange={e => setForm({ ...form, tx_date: e.target.value })} /></Field>
          <Field label="Amount"><Input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Partner"><Select value={form.partner} onChange={e => setForm({ ...form, partner: e.target.value })}><option value="">Select…</option>{PARTNERS.map(p => <option key={p}>{p}</option>)}</Select></Field>
          <Field label="Type"><Select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}><option value="contribution">Put money in (contribution)</option><option value="withdrawal">Took money out (withdrawal / profit share)</option></Select></Field>
          <div className="sm:col-span-2"><Field label="Note"><Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="e.g. First stock order, profit share for March" /></Field></div>
        </div>
        <div className="flex justify-end gap-2 mt-5"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save}>Save</Button></div>
      </Modal>
    </div>
  );
};
