import React, { useState } from 'react';
import { Plus, Trash2, Pencil, Repeat, Zap } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { EXPENSE_CATEGORIES, PARTNERS, monthKey, type Recurring } from '../../../lib/finance';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { Input, Select, Field } from '../../ui/Input';

const blank = { category: EXPENSE_CATEGORIES[0], description: '', amount: '', paid_by: '', paid_to: '', payment_method: 'bank', day_of_month: '1' };

/** Monthly repeating expenses (rent, software...). "Add due now" creates this month's entries once. */
export const RecurringPanel: React.FC<{ items: Recurring[]; money: (n: number) => string; reload: () => void }> = ({ items, money, reload }) => {
  const { success, error } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const month = monthKey();
  const today = new Date().getDate();
  const due = items.filter(r => r.active && r.last_generated !== month && today >= r.day_of_month);

  const save = async () => {
    const amount = Number(form.amount);
    if (!(amount >= 0) || form.amount === '') return error('Enter an amount.');
    if (!form.paid_by) return error('Choose who normally pays this.');
    setBusy(true);
    const row = { category: form.category, description: form.description || null, amount, paid_by: form.paid_by, paid_to: form.paid_to || null, payment_method: form.payment_method, day_of_month: Number(form.day_of_month) || 1 };
    const { error: e } = editId ? await supabase.from('recurring_expenses').update(row).eq('id', editId) : await supabase.from('recurring_expenses').insert(row);
    setBusy(false);
    if (e) return error(e.message);
    success('Saved'); setOpen(false); setForm(blank); setEditId(null); reload();
  };

  const generate = async () => {
    setBusy(true);
    try {
      for (const r of due) {
        const date = `${month}-${String(r.day_of_month).padStart(2, '0')}`;
        const { error: e } = await supabase.from('expenses').insert({
          expense_date: date, category: r.category, description: r.description ? `${r.description} (recurring)` : 'Recurring', amount: r.amount,
          paid_by: r.paid_by, paid_to: r.paid_to, payment_method: r.payment_method, created_by: user?.id,
        });
        if (e) throw e;
        await supabase.from('recurring_expenses').update({ last_generated: month }).eq('id', r.id);
      }
      success(`Added ${due.length} recurring expense(s) for ${month}`); reload();
    } catch (e: any) { error(e.message || 'Could not add recurring expenses'); }
    setBusy(false);
  };

  const toggle = async (r: Recurring) => { await supabase.from('recurring_expenses').update({ active: !r.active }).eq('id', r.id); reload(); };
  const remove = async (r: Recurring) => { if (confirm('Delete this recurring expense? Past entries stay.')) { await supabase.from('recurring_expenses').delete().eq('id', r.id); reload(); } };
  const edit = (r: Recurring) => {
    setEditId(r.id);
    setForm({ category: r.category, description: r.description || '', amount: String(r.amount), paid_by: r.paid_by || '', paid_to: r.paid_to || '', payment_method: r.payment_method || 'bank', day_of_month: String(r.day_of_month) });
    setOpen(true);
  };

  return (
    <div className="rounded-4xl border border-ink-100 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="font-display text-xl font-extrabold text-ink-900 flex items-center gap-2"><Repeat size={18} className="text-lavender-500" /> Recurring expenses</h3>
          <p className="text-xs text-ink-400 font-semibold">Rent, subscriptions, salaries — add them to the ledger in one click each month.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => { setEditId(null); setForm(blank); setOpen(true); }}><Plus size={14} /> New</Button>
      </div>
      {due.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-sunshine-50 border border-sunshine-200 px-4 py-3">
          <p className="text-sm font-bold text-sunshine-700">{due.length} recurring expense(s) due for {month}: {money(due.reduce((s, r) => s + Number(r.amount), 0))}</p>
          <Button size="sm" onClick={generate} loading={busy}><Zap size={14} /> Add due now</Button>
        </div>
      )}
      {items.length === 0 ? <p className="text-sm text-ink-400 text-center py-4">Nothing set up yet.</p> : (
        <ul className="divide-y divide-ink-100">
          {items.map(r => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="flex-1 min-w-[180px]">
                <p className={`text-sm font-bold ${r.active ? 'text-ink-900' : 'text-ink-400 line-through'}`}>{r.description || r.category} · {money(Number(r.amount))}</p>
                <p className="text-xs text-ink-400 font-semibold">{r.category} · day {r.day_of_month} · {r.paid_by || 'Unassigned'}{r.last_generated ? ` · last added ${r.last_generated}` : ''}</p>
              </div>
              <button onClick={() => toggle(r)} className={`text-xs font-extrabold rounded-full px-3 py-1 border ${r.active ? 'border-mint-300 text-mint-700' : 'border-ink-200 text-ink-400'}`}>{r.active ? 'Active' : 'Paused'}</button>
              <button onClick={() => edit(r)} className="p-2 rounded-full hover:bg-ink-100 text-ink-500" aria-label="Edit"><Pencil size={15} /></button>
              <button onClick={() => remove(r)} className="p-2 rounded-full hover:bg-red-50 text-red-500" aria-label="Delete"><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Edit recurring expense' : 'New recurring expense'}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Category"><Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Amount"><Input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Paid by"><Select value={form.paid_by} onChange={e => setForm({ ...form, paid_by: e.target.value })}><option value="">Select…</option>{PARTNERS.map(p => <option key={p}>{p}</option>)}</Select></Field>
          <Field label="Day of month (1–28)"><Input type="number" min="1" max="28" value={form.day_of_month} onChange={e => setForm({ ...form, day_of_month: e.target.value })} /></Field>
          <Field label="Paid to"><Input value={form.paid_to} onChange={e => setForm({ ...form, paid_to: e.target.value })} /></Field>
          <Field label="Method"><Select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}><option value="cash">Cash</option><option value="bank">Bank transfer</option><option value="card">Card</option><option value="other">Other</option></Select></Field>
          <div className="sm:col-span-2"><Field label="Description"><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Shop rent, Canva subscription" /></Field></div>
        </div>
        <div className="flex justify-end gap-2 mt-5"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></div>
      </Modal>
    </div>
  );
};
