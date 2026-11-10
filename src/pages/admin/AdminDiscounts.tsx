import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, TicketPercent } from 'lucide-react';
import { supabase, formatCurrency, formatDate, type DiscountCode } from '../../lib/supabase';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { AdminHeader, Table, Td } from '../../components/admin/ui';
import { Button } from '../../components/ui/Button';
import { Input, Select, Field } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';

const empty = { code: '', description: '', discount_type: 'percent' as 'percent' | 'fixed', discount_value: 10, min_order_amount: 0, max_uses: '', starts_at: '', ends_at: '' };

const AdminDiscounts: React.FC = () => {
  const { currency } = useSettings();
  const { success, error } = useToast();
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<DiscountCode | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);

  const load = () => supabase.from('discount_codes').select('*').order('created_at', { ascending: false }).then(({ data }) => setCodes((data || []) as DiscountCode[]));
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (c: DiscountCode) => {
    setEditing(c);
    setForm({ code: c.code, description: c.description || '', discount_type: c.discount_type, discount_value: c.discount_value, min_order_amount: c.min_order_amount, max_uses: c.max_uses ?? '', starts_at: c.starts_at?.slice(0, 16) || '', ends_at: c.ends_at?.slice(0, 16) || '' });
    setModal(true);
  };

  const save = async () => {
    if (!form.code.trim()) { error('Code required'); return; }
    setSaving(true);
    const payload = {
      code: form.code.toUpperCase().trim(),
      description: form.description || null,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      min_order_amount: Number(form.min_order_amount) || 0,
      max_uses: form.max_uses === '' ? null : Number(form.max_uses),
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    };
    const { error: e } = editing
      ? await supabase.from('discount_codes').update(payload).eq('id', editing.id)
      : await supabase.from('discount_codes').insert({ ...payload, is_active: true });
    setSaving(false);
    if (e) error(e.message); else { success('Discount code saved'); setModal(false); load(); }
  };

  const toggle = async (c: DiscountCode) => {
    await supabase.from('discount_codes').update({ is_active: !c.is_active }).eq('id', c.id);
    load();
  };
  const remove = async (c: DiscountCode) => {
    if (!confirm(`Delete code ${c.code}?`)) return;
    await supabase.from('discount_codes').delete().eq('id', c.id);
    success('Deleted'); load();
  };

  return (
    <div>
      <AdminHeader title="Discount Codes" subtitle="Promotions & coupons" actions={<Button onClick={openNew}><Plus size={16} /> New Code</Button>} />
      <Table head={['Code', 'Discount', 'Min Order', 'Used', 'Valid', 'Status', 'Actions']}>
        {codes.map(c => (
          <tr key={c.id} className="hover:bg-ink-50/50">
            <Td>
              <div className="flex items-center gap-2"><TicketPercent size={16} className="text-sunshine-500" /><div><p className="font-mono font-extrabold text-ink-900">{c.code}</p>{c.description && <p className="text-xs text-ink-400">{c.description}</p>}</div></div>
            </Td>
            <Td className="font-bold text-ink-900">{c.discount_type === 'percent' ? `${c.discount_value}%` : formatCurrency(c.discount_value, currency)}</Td>
            <Td className="text-ink-600">{formatCurrency(c.min_order_amount, currency)}</Td>
            <Td className="text-ink-600">{c.used_count}{c.max_uses ? `/${c.max_uses}` : ''}</Td>
            <Td className="text-xs text-ink-500">{c.starts_at ? formatDate(c.starts_at) : '—'} → {c.ends_at ? formatDate(c.ends_at) : '∞'}</Td>
            <Td><button onClick={() => toggle(c)}><Badge color={c.is_active ? 'green' : 'ink'}>{c.is_active ? 'Active' : 'Off'}</Badge></button></Td>
            <Td>
              <div className="flex gap-1">
                <button onClick={() => openEdit(c)} className="p-2 rounded-xl hover:bg-mint-50 text-mint-600"><Pencil size={16} /></button>
                <button onClick={() => remove(c)} className="p-2 rounded-xl hover:bg-red-50 text-red-500"><Trash2 size={16} /></button>
              </div>
            </Td>
          </tr>
        ))}
      </Table>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Code' : 'New Discount Code'}>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Code"><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SUMMER20" /></Field>
            <Field label="Type">
              <Select value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value })}>
                <option value="percent">Percent (%)</option><option value="fixed">Fixed Amount</option>
              </Select>
            </Field>
            <Field label={form.discount_type === 'percent' ? 'Percent off' : 'Amount off (LKR)'}><Input type="number" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: e.target.value })} /></Field>
            <Field label="Min Order Amount"><Input type="number" value={form.min_order_amount} onChange={e => setForm({ ...form, min_order_amount: e.target.value })} /></Field>
            <Field label="Max Uses (blank = unlimited)"><Input type="number" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: e.target.value })} /></Field>
            <Field label="Description"><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Starts"><Input type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></Field>
            <Field label="Ends"><Input type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminDiscounts;
