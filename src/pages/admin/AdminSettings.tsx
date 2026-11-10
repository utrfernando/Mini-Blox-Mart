import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { AdminHeader } from '../../components/admin/ui';
import { Button } from '../../components/ui/Button';
import { Input, Textarea, Field } from '../../components/ui/Input';

const AdminSettings: React.FC = () => {
  const { settings, refresh } = useSettings();
  const { authUserId } = useAuth();
  const { success, error } = useToast();
  const [store, setStore] = useState<any>({});
  const [bank, setBank] = useState<any>({});
  const [saving, setSaving] = useState<'store' | 'bank' | null>(null);

  useEffect(() => {
    setStore(settings.store || {});
    setBank(settings.bank || {});
  }, [settings]);

  const save = async (key: 'store' | 'bank', value: any) => {
    setSaving(key);
    const { error: e } = await supabase.from('website_settings').upsert({
      setting_key: key, setting_value: value, updated_by: authUserId,
    }, { onConflict: 'setting_key' });
    setSaving(null);
    if (e) error(e.message); else { success('Settings saved'); refresh(); }
  };

  return (
    <div className="space-y-8">
      <AdminHeader title="Store Settings" subtitle="Contact info, delivery, payments & social links" />

      <section className="rounded-4xl border border-ink-100 bg-white p-6 shadow-soft">
        <h2 className="font-display text-lg font-extrabold text-ink-900 mb-4">Store Information</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Store Name"><Input value={store.store_name || ''} onChange={e => setStore({ ...store, store_name: e.target.value })} /></Field>
          <Field label="Tagline"><Input value={store.tagline || ''} onChange={e => setStore({ ...store, tagline: e.target.value })} /></Field>
          <Field label="Currency Code"><Input value={store.currency || 'LKR'} onChange={e => setStore({ ...store, currency: e.target.value })} className="!w-32" /></Field>
          <Field label="Currency Symbol"><Input value={store.currency_symbol || 'Rs.'} onChange={e => setStore({ ...store, currency_symbol: e.target.value })} className="!w-32" /></Field>
          <Field label="Contact Email"><Input value={store.contact_email || ''} onChange={e => setStore({ ...store, contact_email: e.target.value })} /></Field>
          <Field label="Contact Phone"><Input value={store.contact_phone || ''} onChange={e => setStore({ ...store, contact_phone: e.target.value })} /></Field>
          <Field label="WhatsApp"><Input value={store.whatsapp || ''} onChange={e => setStore({ ...store, whatsapp: e.target.value })} placeholder="+94 7X XXX XXXX" /></Field>
          <Field label="Address"><Input value={store.address || ''} onChange={e => setStore({ ...store, address: e.target.value })} /></Field>
          <Field label="Delivery Fee (LKR)"><Input type="number" value={store.delivery_fee ?? 250} onChange={e => setStore({ ...store, delivery_fee: Number(e.target.value) })} /></Field>
          <Field label="Free Delivery Above (LKR)"><Input type="number" value={store.free_delivery_threshold ?? 1500} onChange={e => setStore({ ...store, free_delivery_threshold: Number(e.target.value) })} /></Field>
          <Field label="Instagram URL" className="sm:col-span-2"><Input value={store.social?.instagram || ''} onChange={e => setStore({ ...store, social: { ...store.social, instagram: e.target.value } })} placeholder="https://instagram.com/…" /></Field>
          <Field label="TikTok URL" className="sm:col-span-2"><Input value={store.social?.tiktok || ''} onChange={e => setStore({ ...store, social: { ...store.social, tiktok: e.target.value } })} placeholder="https://tiktok.com/@…" /></Field>
          <Field label="Facebook URL" className="sm:col-span-2"><Input value={store.social?.facebook || ''} onChange={e => setStore({ ...store, social: { ...store.social, facebook: e.target.value } })} /></Field>
        </div>
        <div className="mt-4"><Button onClick={() => save('store', store)} loading={saving === 'store'}><Save size={16} /> Save Store Settings</Button></div>
      </section>

      <section className="rounded-4xl border border-ink-100 bg-white p-6 shadow-soft">
        <h2 className="font-display text-lg font-extrabold text-ink-900 mb-4">Bank Transfer Details</h2>
        <p className="text-sm text-ink-500 mb-4">Shown to customers who choose bank transfer at checkout.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Bank Name"><Input value={bank.bank_name || ''} onChange={e => setBank({ ...bank, bank_name: e.target.value })} /></Field>
          <Field label="Account Name"><Input value={bank.account_name || ''} onChange={e => setBank({ ...bank, account_name: e.target.value })} /></Field>
          <Field label="Account Number"><Input value={bank.account_number || ''} onChange={e => setBank({ ...bank, account_number: e.target.value })} /></Field>
          <Field label="Branch"><Input value={bank.branch || ''} onChange={e => setBank({ ...bank, branch: e.target.value })} /></Field>
          <Field label="Instructions" className="sm:col-span-2"><Textarea value={bank.instructions || ''} onChange={e => setBank({ ...bank, instructions: e.target.value })} className="min-h-[70px]" placeholder="e.g. Use your order number as the transfer reference…" /></Field>
        </div>
        <div className="mt-4"><Button onClick={() => save('bank', bank)} loading={saving === 'bank'}><Save size={16} /> Save Bank Details</Button></div>
      </section>
    </div>
  );
};

export default AdminSettings;
