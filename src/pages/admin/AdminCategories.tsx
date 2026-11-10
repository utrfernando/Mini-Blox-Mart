import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { type Category } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { slugify } from '../../lib/utils';
import { AdminHeader, Table, Td } from '../../components/admin/ui';
import { Button } from '../../components/ui/Button';
import { Input, Field } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { ProductImage as Img } from '../../components/ui/Feedback';

const AdminCategories: React.FC = () => {
  const { success, error } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '', image_url: '', sort_order: 0 });

  const load = () => supabase.from('categories').select('*').order('sort_order').then(({ data }) => setCategories((data || []) as Category[]));
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: '', slug: '', description: '', image_url: '', sort_order: categories.length + 1 }); setModal(true); };
  const openEdit = (c: Category) => { setEditing(c); setForm({ name: c.name, slug: c.slug, description: c.description || '', image_url: c.image_url || '', sort_order: c.sort_order }); setModal(true); };

  const save = async () => {
    if (!form.name.trim()) { error('Name required'); return; }
    const payload = { ...form, slug: form.slug || slugify(form.name) };
    const { error: e } = editing
      ? await supabase.from('categories').update(payload).eq('id', editing.id)
      : await supabase.from('categories').insert(payload);
    if (e) { error(e.message); return; }
    success('Category saved'); setModal(false); load();
  };

  const remove = async (c: Category) => {
    if (!confirm(`Delete category "${c.name}"? Products in it become uncategorised.`)) return;
    const { error: e } = await supabase.from('categories').delete().eq('id', c.id);
    if (e) error(e.message); else { success('Deleted'); load(); }
  };

  return (
    <div>
      <AdminHeader title="Categories" subtitle="Organise your collections" actions={<Button onClick={openNew}><Plus size={16} /> Add Category</Button>} />
      <Table head={['Category', 'Slug', 'Products', 'Order', 'Status', 'Actions']}>
        {categories.map(c => (
          <tr key={c.id} className="hover:bg-ink-50/50">
            <Td>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-mint-50 shrink-0"><Img src={c.image_url} alt="" iconClassName="w-5 h-5" /></div>
                <div><p className="font-bold text-ink-900">{c.name}</p>{c.description && <p className="text-xs text-ink-400 line-clamp-1 max-w-[240px]">{c.description}</p>}</div>
              </div>
            </Td>
            <Td className="text-ink-500 font-mono text-xs">{c.slug}</Td>
            <Td className="text-ink-600">—</Td>
            <Td className="text-ink-600">{c.sort_order}</Td>
            <Td><Badge color={c.is_active ? 'green' : 'ink'}>{c.is_active ? 'Active' : 'Hidden'}</Badge></Td>
            <Td>
              <div className="flex gap-1">
                <button onClick={() => openEdit(c)} className="p-2 rounded-xl hover:bg-mint-50 text-mint-600"><Pencil size={16} /></button>
                <button onClick={() => remove(c)} className="p-2 rounded-xl hover:bg-red-50 text-red-500"><Trash2 size={16} /></button>
              </div>
            </Td>
          </tr>
        ))}
      </Table>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Category' : 'New Category'}>
        <div className="space-y-4">
          <Field label="Name"><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value, slug: editing ? form.slug : slugify(e.target.value) })} /></Field>
          <Field label="Slug"><Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} /></Field>
          <Field label="Description"><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Image URL"><Input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" /></Field>
          <Field label="Sort Order"><Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} /></Field>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Save' : 'Create'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminCategories;
