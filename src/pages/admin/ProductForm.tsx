import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Trash2, Upload, Star, Sparkles, Image as ImageIcon } from 'lucide-react';
import { supabase, type Product, type Category, type Supplier } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { generateSku } from '../../lib/utils';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input, Textarea, Select, Field } from '../../components/ui/Input';
import { ProductImage as Img } from '../../components/ui/Feedback';
import { cn } from '../../lib/utils';

const schema = z.object({
  name: z.string().min(2, 'Name required'),
  sku: z.string().optional(),
  description: z.string().optional(),
  category_id: z.string().optional(),
  supplier_id: z.string().optional(),
  supplier_cost: z.coerce.number().min(0),
  landed_cost: z.coerce.number().min(0),
  selling_price: z.coerce.number().min(0, 'Price required'),
  discount_price: z.coerce.number().min(0).optional().or(z.literal('')),
  stock_quantity: z.coerce.number().int().min(0),
  low_stock_threshold: z.coerce.number().int().min(0),
  status: z.enum(['draft', 'published', 'archived']),
  is_featured: z.boolean().optional(),
  is_best_seller: z.boolean().optional(),
  is_new: z.boolean().optional(),
  tags: z.string().optional(),
});

interface Props {
  open: boolean;
  onClose: () => void;
  product: Product | null; // null = create
  onSaved: () => void;
}

const ProductForm: React.FC<Props> = ({ open, onClose, product, onSaved }) => {
  const { authUserId } = useAuth();
  const { success, error } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [images, setImages] = useState<{ url: string; is_primary: boolean; id?: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'draft', stock_quantity: 0, low_stock_threshold: 5, supplier_cost: 0, landed_cost: 0, selling_price: 0 },
  });

  useEffect(() => {
    if (!open) return;
    supabase.from('categories').select('*').order('sort_order').then(({ data }) => setCategories((data || []) as Category[]));
    supabase.from('suppliers').select('*').then(({ data }) => setSuppliers((data || []) as Supplier[]));

    if (product) {
      reset({
        name: product.name, sku: product.sku || '', description: product.description || '',
        category_id: product.category_id || '', supplier_id: product.supplier_id || '',
        supplier_cost: Number(product.supplier_cost), landed_cost: Number(product.landed_cost),
        selling_price: Number(product.selling_price), discount_price: product.discount_price ? Number(product.discount_price) : '',
        stock_quantity: product.stock_quantity, low_stock_threshold: product.low_stock_threshold,
        status: product.status, is_featured: product.is_featured, is_best_seller: product.is_best_seller,
        is_new: product.is_new, tags: (product.tags || []).join(', '),
      });
      setImages((product.images || []).map(i => ({ id: i.id, url: i.url, is_primary: i.is_primary })));
    } else {
      reset({ status: 'draft', stock_quantity: 0, low_stock_threshold: 5, supplier_cost: 0, landed_cost: 0, selling_price: 0, sku: generateSku(), tags: '' });
      setImages([]);
    }
  }, [open, product, reset]);

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length || !authUserId) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const path = `products/${authUserId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('products').upload(path, file);
      if (upErr) { error(`Upload failed: ${upErr.message}`); continue; }
      const url = supabase.storage.from('products').getPublicUrl(path).data.publicUrl;
      setImages(prev => [...prev, { url, is_primary: prev.length === 0 }]);
    }
    setUploading(false);
  };

  const save = async (data: any) => {
    setSaving(true);
    const payload = {
      name: data.name,
      sku: data.sku || generateSku(),
      description: data.description || null,
      category_id: data.category_id || null,
      selling_price: Number(data.selling_price),
      discount_price: data.discount_price === '' || data.discount_price == null ? null : Number(data.discount_price),
      stock_quantity: Number(data.stock_quantity),
      low_stock_threshold: Number(data.low_stock_threshold),
      status: data.status,
      is_featured: !!data.is_featured,
      is_best_seller: !!data.is_best_seller,
      is_new: !!data.is_new,
      tags: data.tags ? data.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
    };

    const costs = {
      supplier_id: data.supplier_id || null,
      supplier_cost: Number(data.supplier_cost) || 0,
      landed_cost: Number(data.landed_cost) || 0,
    };

    let productId = product?.id;
    if (productId) {
      const { error: e } = await supabase.from('products').update(payload).eq('id', productId);
      if (e) { error(e.message); setSaving(false); return; }
      await supabase.from('product_images').delete().eq('product_id', productId);
    } else {
      const { data: created, error: e } = await supabase.from('products').insert(payload).select('id').single();
      if (e) { error(e.message); setSaving(false); return; }
      productId = created.id;
      // record opening stock
      if (payload.stock_quantity > 0) {
        await supabase.from('inventory_transactions').insert({ product_id: productId, quantity_change: payload.stock_quantity, reason: 'purchase', notes: 'Opening stock' });
      }
    }

    const { error: costErr } = await supabase.from('product_costs').upsert({ product_id: productId, ...costs });
    if (costErr) error('Product saved, but costs failed: ' + costErr.message);

    if (images.length) {
      await supabase.from('product_images').insert(
        images.map((img, i) => ({ product_id: productId, url: img.url, is_primary: img.is_primary, sort_order: i }))
      );
    }
    setSaving(false);
    success(product ? 'Product updated' : 'Product created');
    onSaved(); onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={product ? 'Edit Product' : 'New Product'} wide>
      <form onSubmit={handleSubmit(save)} className="grid md:grid-cols-2 gap-5">
        <div className="md:col-span-2"><Field label="Product Name" error={errors.name?.message as string}><Input {...register('name')} placeholder="e.g. Mini Builder Sam — Sunset Edition" /></Field></div>
        <Field label="SKU / Item Code"><Input {...register('sku')} /></Field>
        <Field label="Category">
          <Select {...register('category_id')}><option value="">Uncategorised</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </Field>
        <Field label="Supplier">
          <Select {...register('supplier_id')}><option value="">—</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        </Field>
        <Field label="Tags (comma separated)"><Input {...register('tags')} placeholder="cute, gift, collectible" /></Field>
        <div className="md:col-span-2"><Field label="Description"><Textarea {...register('description')} className="min-h-[90px]" /></Field></div>

        <div className="rounded-3xl bg-cream-100 p-4 md:col-span-2">
          <p className="text-xs font-extrabold uppercase tracking-wide text-ink-500 mb-3">Pricing &amp; Costs (LKR)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Supplier Cost"><Input type="number" step="0.01" {...register('supplier_cost')} /></Field>
            <Field label="Landed Cost" hint="incl. shipping/duties"><Input type="number" step="0.01" {...register('landed_cost')} /></Field>
            <Field label="Selling Price" error={errors.selling_price?.message as string}><Input type="number" step="0.01" {...register('selling_price')} /></Field>
            <Field label="Discount Price"><Input type="number" step="0.01" {...register('discount_price')} placeholder="Optional" /></Field>
          </div>
        </div>

        <div className="rounded-3xl bg-mint-50 p-4 md:col-span-2">
          <p className="text-xs font-extrabold uppercase tracking-wide text-mint-700 mb-3">Inventory</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Stock Quantity"><Input type="number" {...register('stock_quantity')} /></Field>
            <Field label="Low Stock Alert At"><Input type="number" {...register('low_stock_threshold')} /></Field>
          </div>
        </div>

        {/* Flags */}
        <div className="md:col-span-2 flex flex-wrap gap-3">
          <Field label="Status">
            <Select {...register('status')} className="!w-40">
              <option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option>
            </Select>
          </Field>
          {([['is_featured','Featured',Star],['is_best_seller','Best Seller',Sparkles],['is_new','New Arrival',ImageIcon]] as const).map(([key,label,Icon]) => (
            <label key={key} className="flex items-center gap-2 rounded-2xl border border-ink-100 px-4 py-2.5 text-sm font-bold text-ink-700 cursor-pointer hover:bg-ink-50">
              <input type="checkbox" {...register(key)} className="w-4 h-4 accent-mint-500" />
              <Icon size={15} className="text-mint-600" /> {label}
            </label>
          ))}
        </div>

        {/* Images */}
        <div className="md:col-span-2">
          <p className="text-xs font-extrabold uppercase tracking-wide text-ink-500 mb-2">Product Images</p>
          <div className="flex flex-wrap gap-3 mb-3">
            {images.map((img, i) => (
              <div key={i} className={cn('relative w-24 h-24 rounded-2xl overflow-hidden border-2', img.is_primary ? 'border-mint-500' : 'border-ink-100')}>
                <Img src={img.url} alt="" iconClassName="w-8 h-8" />
                <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white"><Trash2 size={12} /></button>
                {!img.is_primary && <button type="button" onClick={() => setImages(images.map((im, j) => ({ ...im, is_primary: j === i })))} className="absolute bottom-1 left-1 text-[9px] font-extrabold bg-white/90 rounded-full px-1.5 py-0.5">SET MAIN</button>}
              </div>
            ))}
            <label className={cn('w-24 h-24 rounded-2xl border-2 border-dashed border-ink-200 flex flex-col items-center justify-center text-ink-400 hover:border-mint-400 hover:text-mint-600 cursor-pointer transition', uploading && 'opacity-50')}>
              <Upload size={20} />
              <span className="text-[10px] font-bold mt-1">{uploading ? 'Uploading…' : 'Add'}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => uploadFiles(e.target.files)} />
            </label>
          </div>
        </div>

        <div className="md:col-span-2 flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{product ? 'Save Changes' : 'Create Product'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default ProductForm;
