import React, { useEffect, useState } from 'react';
import { Upload, Plus, Search, Pencil, Archive, Trash2, Eye } from 'lucide-react';
import { supabase, PRODUCT_COSTS_EMBED, withCosts, formatCurrency, unitPrice, hasDiscount, type Product, type Category } from '../../lib/supabase';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { AdminHeader, Table, Td, stockBadge } from '../../components/admin/ui';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { ProductImage as Img } from '../../components/ui/Feedback';
import { primaryImage } from '../../components/ProductCard';
import ProductForm from './ProductForm';
import BulkUploadModal from '../../components/admin/BulkUploadModal';
import { cn } from '../../lib/utils';

const AdminProducts: React.FC = () => {
  const { currency } = useSettings();
  const { success } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [catId, setCatId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const load = async () => {
    setLoading(true);
    let query = supabase.from('products').select('*, category:categories(*), images:product_images(*), ' + PRODUCT_COSTS_EMBED).order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    if (catId) query = query.eq('category_id', catId);
    const { data } = await query;
    let list = withCosts(data) as Product[];
    if (q) {
      const s = q.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s));
    }
    setProducts(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, [status, catId]);
  useEffect(() => {
    supabase.from('categories').select('*').order('sort_order').then(({ data }) => setCategories((data || []) as Category[]));
  }, []);

  const archive = async (p: Product) => {
    await supabase.from('products').update({ status: 'archived' }).eq('id', p.id);
    success('Product archived'); load();
  };
  const remove = async (p: Product) => {
    if (!confirm(`Permanently delete "${p.name}"? This cannot be undone.`)) return;
    await supabase.from('products').delete().eq('id', p.id);
    success('Product deleted'); load();
  };

  return (
    <div>
      <AdminHeader title="Products" subtitle={`${products.length} product(s)`}
        actions={<div className="flex gap-2"><Button variant="outline" onClick={() => setBulkOpen(true)}><Upload size={16} /> Bulk Upload</Button><Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={16} /> Add Product</Button></div>} />
      <BulkUploadModal open={bulkOpen} onClose={() => setBulkOpen(false)} onDone={load} />

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or SKU…" className="!pl-10" />
        </div>
        <Select value={status} onChange={e => setStatus(e.target.value)} className="!w-44">
          <option value="">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option>
        </Select>
        <Select value={catId} onChange={e => setCatId(e.target.value)} className="!w-48">
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Button variant="secondary" onClick={load}>Refresh</Button>
      </div>

      <Table head={['Product', 'Category', 'Price', 'Stock', 'Status', 'Flags', 'Actions']}>
        {loading ? (
          <tr><Td className="text-center text-ink-400 py-8" >Loading…</Td></tr>
        ) : products.length === 0 ? (
          <tr><Td className="text-center text-ink-400 py-8">No products found</Td></tr>
        ) : products.map(p => (
          <tr key={p.id} className="hover:bg-ink-50/50">
            <Td>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0"><Img src={primaryImage(p)} alt="" iconClassName="w-6 h-6" /></div>
                <div className="min-w-0">
                  <p className="font-bold text-ink-900 truncate max-w-[220px]">{p.name}</p>
                  <p className="text-xs text-ink-400">{p.sku || '—'}</p>
                </div>
              </div>
            </Td>
            <Td className="text-ink-600">{p.category?.name || '—'}</Td>
            <Td>
              <p className="font-bold text-ink-900">{formatCurrency(unitPrice(p), currency)}</p>
              {hasDiscount(p) && <p className="text-xs text-ink-400 line-through">{formatCurrency(p.selling_price, currency)}</p>}
            </Td>
            <Td>
              <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold', stockBadge(p.stock_quantity, p.low_stock_threshold))}>
                {p.stock_quantity <= 0 ? 'Out' : p.stock_quantity}
              </span>
            </Td>
            <Td>
              <Badge color={p.status === 'published' ? 'green' : p.status === 'draft' ? 'sunshine' : 'ink'}>{p.status}</Badge>
            </Td>
            <Td>
              <div className="flex gap-1">
                {p.is_featured && <Badge color="lavender">F</Badge>}
                {p.is_best_seller && <Badge color="sunshine">B</Badge>}
                {p.is_new && <Badge color="mint">N</Badge>}
              </div>
            </Td>
            <Td>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(p); setFormOpen(true); }} className="p-2 rounded-xl hover:bg-mint-50 text-mint-600" title="Edit"><Pencil size={16} /></button>
                {p.status === 'published' && <a href={`/product/${p.id}`} target="_blank" rel="noreferrer" className="p-2 rounded-xl hover:bg-ink-100 text-ink-500" title="View"><Eye size={16} /></a>}
                {p.status !== 'archived' && <button onClick={() => archive(p)} className="p-2 rounded-xl hover:bg-sunshine-50 text-sunshine-600" title="Archive"><Archive size={16} /></button>}
                <button onClick={() => remove(p)} className="p-2 rounded-xl hover:bg-red-50 text-red-500" title="Delete"><Trash2 size={16} /></button>
              </div>
            </Td>
          </tr>
        ))}
      </Table>

      <ProductForm open={formOpen} onClose={() => setFormOpen(false)} product={editing} onSaved={load} />
    </div>
  );
};

export default AdminProducts;
