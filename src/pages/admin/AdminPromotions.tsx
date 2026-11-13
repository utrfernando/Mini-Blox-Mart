import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Image as ImageIcon } from 'lucide-react';
import { supabase, formatDate, type Banner } from '../../lib/supabase';
import { optimizeImage, IMAGE_CACHE } from '../../lib/image';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { AdminHeader, Table, Td } from '../../components/admin/ui';
import { Button } from '../../components/ui/Button';
import { Input, Select, Field } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { ProductImage as Img } from '../../components/ui/Feedback';

const empty = { title: '', subtitle: '', image_url: '', cta_label: '', cta_link: '', placement: 'home_hero', sort_order: 0, is_active: true, starts_at: '', ends_at: '' };

const AdminPromotions: React.FC = () => {
  const { authUserId } = useAuth();
  const { success, error } = useToast();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = () => supabase.from('banners').select('*').order('placement').order('sort_order').then(({ data }) => setBanners((data || []) as Banner[]));
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ ...empty, sort_order: banners.length }); setModal(true); };
  const openEdit = (b: Banner) => {
    setEditing(b);
    setForm({ title: b.title, subtitle: b.subtitle || '', image_url: b.image_url || '', cta_label: b.cta_label || '', cta_link: b.cta_link || '', placement: b.placement, sort_order: b.sort_order, is_active: b.is_active, starts_at: b.starts_at?.slice(0, 16) || '', ends_at: b.ends_at?.slice(0, 16) || '' });
    setModal(true);
  };

  const uploadImage = async (file: File) => {
    if (!authUserId) return;
    setUploading(true);
    const img = await optimizeImage(file, 1800);
    const path = `banners/${authUserId}/${Date.now()}.${img.ext}`;
    const { error: e } = await supabase.storage.from('products').upload(path, img.blob, { contentType: img.type, cacheControl: IMAGE_CACHE });
    if (e) { error(e.message); setUploading(false); return; }
    setForm((f: any) => ({ ...f, image_url: supabase.storage.from('products').getPublicUrl(path).data.publicUrl }));
    setUploading(false);
  };

  const save = async () => {
    if (!form.title.trim()) { error('Title required'); return; }
    setSaving(true);
    const payload = {
      title: form.title, subtitle: form.subtitle || null, image_url: form.image_url || null,
      cta_label: form.cta_label || null, cta_link: form.cta_link || null,
      placement: form.placement, sort_order: Number(form.sort_order) || 0, is_active: form.is_active,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    };
    const { error: e } = editing
      ? await supabase.from('banners').update(payload).eq('id', editing.id)
      : await supabase.from('banners').insert(payload);
    setSaving(false);
    if (e) error(e.message); else { success('Banner saved'); setModal(false); load(); }
  };

  const remove = async (b: Banner) => {
    if (!confirm(`Delete banner "${b.title}"?`)) return;
    await supabase.from('banners').delete().eq('id', b.id);
    success('Deleted'); load();
  };

  return (
    <div>
      <AdminHeader title="Promotions & Banners" subtitle="Hero sliders & promo sections on the homepage" actions={<Button onClick={openNew}><Plus size={16} /> New Banner</Button>} />
      <Table head={['Banner', 'Placement', 'Schedule', 'Order', 'Status', 'Actions']}>
        {banners.map(b => (
          <tr key={b.id} className="hover:bg-ink-50/50">
            <Td>
              <div className="flex items-center gap-3">
                <div className="w-14 h-10 rounded-xl overflow-hidden bg-ink-50 shrink-0"><Img src={b.image_url} alt="" iconClassName="w-6 h-6" /></div>
                <div><p className="font-bold text-ink-900">{b.title}</p>{b.subtitle && <p className="text-xs text-ink-400 line-clamp-1 max-w-[200px]">{b.subtitle}</p>}</div>
              </div>
            </Td>
            <Td><Badge color="lavender">{b.placement.replace('home_', 'Home · ')}</Badge></Td>
            <Td className="text-xs text-ink-500">{b.starts_at ? formatDate(b.starts_at) : '—'} → {b.ends_at ? formatDate(b.ends_at) : '∞'}</Td>
            <Td className="text-ink-600">{b.sort_order}</Td>
            <Td><button onClick={async () => { await supabase.from('banners').update({ is_active: !b.is_active }).eq('id', b.id); load(); }}><Badge color={b.is_active ? 'green' : 'ink'}>{b.is_active ? 'Live' : 'Off'}</Badge></button></Td>
            <Td>
              <div className="flex gap-1">
                <button onClick={() => openEdit(b)} className="p-2 rounded-xl hover:bg-mint-50 text-mint-600"><Pencil size={16} /></button>
                <button onClick={() => remove(b)} className="p-2 rounded-xl hover:bg-red-50 text-red-500"><Trash2 size={16} /></button>
              </div>
            </Td>
          </tr>
        ))}
      </Table>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Banner' : 'New Banner'}>
        <div className="space-y-4">
          <Field label="Title"><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Subtitle"><Input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} /></Field>
          <div>
            <p className="text-sm font-bold text-ink-700 mb-1.5">Banner Image</p>
            <div className="flex items-center gap-3">
              <div className="w-28 h-16 rounded-2xl overflow-hidden bg-ink-50 shrink-0"><Img src={form.image_url} alt="" iconClassName="w-8 h-8" /></div>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])} />
                <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink-100 px-4 py-2 text-sm font-bold text-ink-700 hover:border-mint-400">
                  <ImageIcon size={16} /> {uploading ? 'Uploading…' : 'Upload Image'}
                </span>
              </label>
            </div>
            <Input className="mt-2" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="…or paste image URL" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Button Label"><Input value={form.cta_label} onChange={e => setForm({ ...form, cta_label: e.target.value })} placeholder="Shop Now" /></Field>
            <Field label="Button Link"><Input value={form.cta_link} onChange={e => setForm({ ...form, cta_link: e.target.value })} placeholder="/shop or /shop?filter=new" /></Field>
            <Field label="Placement">
              <Select value={form.placement} onChange={e => setForm({ ...form, placement: e.target.value })}>
                <option value="home_hero">Home — Hero Slider</option>
                <option value="home_promo">Home — Promo Section</option>
              </Select>
            </Field>
            <Field label="Sort Order"><Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} /></Field>
            <Field label="Starts"><Input type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></Field>
            <Field label="Ends"><Input type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold text-ink-700"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 accent-mint-500" /> Active</label>
          <div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save Banner</Button></div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminPromotions;
