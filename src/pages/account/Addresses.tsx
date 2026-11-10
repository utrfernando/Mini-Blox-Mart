import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { type Address } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input, Select, Field } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/Feedback';

const schema = z.object({
  label: z.string().optional(),
  recipient_name: z.string().min(2, 'Name required'),
  phone: z.string().min(9, 'Phone required'),
  address_line: z.string().min(5, 'Address required'),
  city: z.string().min(2, 'City required'),
  district: z.string().min(2, 'District required'),
  postal_code: z.string().optional(),
  delivery_instructions: z.string().optional(),
  is_default: z.boolean().optional(),
});

const DISTRICTS = ['Colombo','Gampaha','Kalutara','Kandy','Matale','Nuwara Eliya','Galle','Matara','Hambantota','Jaffna','Kilinochchi','Mannar','Vavuniya','Trincomalee','Batticaloa','Ampara','Kurunegala','Puttalam','Anuradhapura','Polonnaruwa','Badulla','Monaragala','Ratnapura','Kegalle'];

const Addresses: React.FC = () => {
  const { authUserId } = useAuth();
  const { success, error } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!authUserId) return;
    const { data } = await supabase.from('addresses').select('*').eq('user_id', authUserId).order('is_default', { ascending: false });
    setAddresses((data || []) as Address[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [authUserId]);

  const form = useForm<any>({ resolver: zodResolver(schema), defaultValues: { is_default: false } });

  const openNew = () => { setEditing(null); form.reset({ is_default: addresses.length === 0 }); setModal(true); };
  const openEdit = (a: Address) => {
    setEditing(a);
    form.reset({ label: a.label || '', recipient_name: a.recipient_name, phone: a.phone, address_line: a.address_line, city: a.city, district: a.district, postal_code: a.postal_code || '', delivery_instructions: a.delivery_instructions || '', is_default: a.is_default });
    setModal(true);
  };

  const save = async (data: any) => {
    if (!authUserId) return;
    setSaving(true);
    const payload = { ...data, user_id: authUserId, label: data.label || null, postal_code: data.postal_code || null, delivery_instructions: data.delivery_instructions || null };
    if (editing) {
      const { error: e } = await supabase.from('addresses').update(payload).eq('id', editing.id);
      if (e) { error(e.message); setSaving(false); return; }
    } else {
      const { error: e } = await supabase.from('addresses').insert(payload);
      if (e) { error(e.message); setSaving(false); return; }
    }
    if (data.is_default) {
      await supabase.from('addresses').update({ is_default: false }).eq('user_id', authUserId).neq('id', editing?.id || '');
      await supabase.from('addresses').update({ is_default: true }).eq('user_id', authUserId).order('created_at', { ascending: false }).limit(1);
    }
    setSaving(false); setModal(false); success('Address saved'); load();
  };

  const remove = async (a: Address) => {
    if (!confirm('Delete this address?')) return;
    await supabase.from('addresses').delete().eq('id', a.id);
    success('Address deleted'); load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink-900">Saved Addresses</h1>
        <Button onClick={openNew} size="sm"><Plus size={16} /> Add Address</Button>
      </div>

      {loading ? <p className="text-ink-400 font-bold">Loading…</p> : addresses.length === 0 ? (
        <EmptyState icon={<MapPin size={36} strokeWidth={1.5} />} title="No saved addresses" message="Save an address for faster checkout." actionLabel="Add Address" onAction={openNew} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {addresses.map(a => (
            <div key={a.id} className="rounded-4xl border border-ink-100 bg-white p-5 shadow-soft relative">
              {a.is_default && <span className="absolute top-4 right-4 rounded-full bg-mint-100 text-mint-700 text-[11px] font-extrabold px-2.5 py-1">DEFAULT</span>}
              <p className="font-display font-bold text-ink-900">{a.label || 'Address'}</p>
              <p className="text-sm font-bold text-ink-800 mt-1">{a.recipient_name} · {a.phone}</p>
              <p className="text-sm text-ink-600 mt-1">{a.address_line}, {a.city}, {a.district} {a.postal_code}</p>
              {a.delivery_instructions && <p className="text-xs text-ink-400 italic mt-1">"{a.delivery_instructions}"</p>}
              <div className="flex gap-2 mt-4">
                <Button variant="secondary" size="sm" onClick={() => openEdit(a)}><Pencil size={14} /> Edit</Button>
                <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => remove(a)}><Trash2 size={14} /> Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Address' : 'New Address'}>
        <form onSubmit={form.handleSubmit(save)} className="grid sm:grid-cols-2 gap-4">
          <Field label="Label (e.g. Home)" className="sm:col-span-2"><Input {...form.register('label')} placeholder="Home / Office / Other" /></Field>
          <Field label="Recipient Name" error={form.formState.errors.recipient_name?.message as string}><Input {...form.register('recipient_name')} /></Field>
          <Field label="Phone" error={form.formState.errors.phone?.message as string}><Input {...form.register('phone')} /></Field>
          <Field label="Address" error={form.formState.errors.address_line?.message as string} className="sm:col-span-2"><Input {...form.register('address_line')} /></Field>
          <Field label="City" error={form.formState.errors.city?.message as string}><Input {...form.register('city')} /></Field>
          <Field label="District" error={form.formState.errors.district?.message as string}>
            <Select {...form.register('district')}><option value="">Select</option>{DISTRICTS.map(d => <option key={d}>{d}</option>)}</Select>
          </Field>
          <Field label="Postal Code"><Input {...form.register('postal_code')} /></Field>
          <Field label="Delivery Instructions"><Input {...form.register('delivery_instructions')} /></Field>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm font-bold text-ink-700">
            <input type="checkbox" {...form.register('is_default')} className="w-4 h-4 accent-mint-500" /> Set as default address
          </label>
          <div className="sm:col-span-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save Address</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Addresses;
