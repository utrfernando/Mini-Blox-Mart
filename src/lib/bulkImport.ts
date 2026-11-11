import * as XLSX from 'xlsx';
import { supabase } from './supabase';
import { slugify, generateSku } from './utils';

/** Canonical columns in the official template. */
export const TEMPLATE_COLUMNS = [
  'sku', 'name', 'description', 'category', 'supplier',
  'supplier_cost_usd', 'supplier_cost', 'landed_cost', 'selling_price', 'discount_price',
  'stock_quantity', 'low_stock_threshold', 'status',
  'is_featured', 'is_best_seller', 'is_new', 'tags', 'image_urls',
] as const;
type Col = typeof TEMPLATE_COLUMNS[number];

/** Header aliases (normalised: lowercase, letters/digits only). Lets supplier invoices upload as-is. */
const ALIASES: Record<string, Col> = {
  sku: 'sku', itemno: 'sku', itemnumber: 'sku', itemcode: 'sku', code: 'sku', modelno: 'sku',
  name: 'name', productname: 'name', title: 'name',
  description: 'description', descriptionofproduct: 'description', desc: 'description', details: 'description',
  category: 'category', categoryname: 'category',
  supplier: 'supplier', suppliername: 'supplier', vendor: 'supplier',
  suppliercostusd: 'supplier_cost_usd', unitprice: 'supplier_cost_usd', unitpriceus: 'supplier_cost_usd',
  unitpriceusd: 'supplier_cost_usd', priceusd: 'supplier_cost_usd', costusd: 'supplier_cost_usd',
  suppliercost: 'supplier_cost', cost: 'supplier_cost',
  landedcost: 'landed_cost',
  sellingprice: 'selling_price', price: 'selling_price', retailprice: 'selling_price',
  discountprice: 'discount_price', saleprice: 'discount_price',
  stockquantity: 'stock_quantity', stock: 'stock_quantity', qty: 'stock_quantity', quantity: 'stock_quantity', qtysets: 'stock_quantity', qtypcs: 'stock_quantity',
  lowstockthreshold: 'low_stock_threshold', reorderlevel: 'low_stock_threshold',
  status: 'status',
  isfeatured: 'is_featured', featured: 'is_featured',
  isbestseller: 'is_best_seller', bestseller: 'is_best_seller',
  isnew: 'is_new', new: 'is_new',
  tags: 'tags',
  imageurls: 'image_urls', imageurl: 'image_urls', images: 'image_urls', image: 'image_urls',
};

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export type ImportOptions = {
  exchangeRate: number;        // store currency per 1 USD
  markupPercent: number;       // used when selling_price is blank
  defaultStatus: 'draft' | 'published';
  existing: 'skip' | 'update' | 'update_add_stock';
  createMissing: boolean;      // create unknown categories / suppliers
};

export type ParsedRow = {
  line: number;
  sku: string;
  name: string;
  description: string;
  category: string;
  supplier: string;
  supplier_cost: number;
  landed_cost: number;
  selling_price: number;
  discount_price: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  status: 'draft' | 'published' | 'archived';
  is_featured: boolean;
  is_best_seller: boolean;
  is_new: boolean;
  tags: string[];
  images: string[];
  errors: string[];
  warnings: string[];
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : null;
};
const bool = (v: unknown) => ['1', 'true', 'yes', 'y', 'x'].includes(String(v ?? '').trim().toLowerCase());
const text = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

export async function readSheet(file: File): Promise<unknown[][]> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames.includes('Products') ? 'Products' : wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: '' });
}

export function parseRows(grid: unknown[][], opt: ImportOptions): { rows: ParsedRow[]; recognised: Col[]; headerLine: number } {
  // Find the header row (invoices have several title rows above it).
  let headerIdx = -1, best = 0;
  grid.slice(0, 60).forEach((r, i) => {
    const hits = r.filter(c => ALIASES[norm(c)]).length;
    if (hits > best) { best = hits; headerIdx = i; }
  });
  if (headerIdx < 0 || best < 2) throw new Error('Could not find a header row. Use the template or include columns like "sku", "name", "selling_price".');

  const map: (Col | null)[] = grid[headerIdx].map(c => ALIASES[norm(c)] ?? null);
  const recognised = [...new Set(map.filter(Boolean) as Col[])];
  const rows: ParsedRow[] = [];

  grid.slice(headerIdx + 1).forEach((r, i) => {
    const o: Partial<Record<Col, unknown>> = {};
    map.forEach((c, ci) => { if (c && o[c] === undefined) o[c] = r[ci]; });

    const sku = text(o.sku);
    const nameRaw = text(o.name);
    const desc = text(o.description);
    // Skip blank/total/footer rows.
    if (!sku && !nameRaw) return;
    if (/^(total|subtotal|sum|grand)/i.test(sku || nameRaw)) return;

    const errors: string[] = [], warnings: string[] = [];
    const usd = num(o.supplier_cost_usd);
    let supplier_cost = num(o.supplier_cost) ?? (usd !== null ? usd * opt.exchangeRate : 0);
    if (usd !== null && num(o.supplier_cost) === null && !(opt.exchangeRate > 0)) errors.push('Set an exchange rate to convert USD costs');
    supplier_cost = Math.round(supplier_cost * 100) / 100;
    const landed = num(o.landed_cost) ?? supplier_cost;

    let selling = num(o.selling_price);
    if (selling === null) {
      if (opt.markupPercent > 0 && landed > 0) {
        selling = Math.round(landed * (1 + opt.markupPercent / 100));
        warnings.push(`Selling price calculated from ${opt.markupPercent}% markup`);
      } else errors.push('Missing selling_price (or set a markup %)');
    }
    const discountRaw = num(o.discount_price);
    const discount = discountRaw !== null && discountRaw > 0 ? discountRaw : null; // 0 / blank = no discount
    if (selling !== null && discount !== null && discount >= selling) warnings.push('Discount price is not lower than selling price');
    const stock = Math.max(0, Math.round(num(o.stock_quantity) ?? 0));
    if ((num(o.stock_quantity) ?? 0) < 0) errors.push('Negative stock');

    const statusRaw = text(o.status).toLowerCase();
    const status = (['draft', 'published', 'archived'].includes(statusRaw) ? statusRaw : opt.defaultStatus) as ParsedRow['status'];
    const name = nameRaw || [desc || 'Item', sku].filter(Boolean).join(' ');
    if (!nameRaw) warnings.push('No name given — generated from description + SKU');
    if (!sku) warnings.push('No SKU — one will be generated');

    rows.push({
      line: headerIdx + 2 + i,
      sku, name,
      description: nameRaw ? desc : '',
      category: text(o.category),
      supplier: text(o.supplier),
      supplier_cost: supplier_cost || 0,
      landed_cost: Math.round(landed * 100) / 100,
      selling_price: selling ?? 0,
      discount_price: discount,
      stock_quantity: stock,
      low_stock_threshold: Math.round(num(o.low_stock_threshold) ?? 5),
      status,
      is_featured: bool(o.is_featured), is_best_seller: bool(o.is_best_seller), is_new: bool(o.is_new),
      tags: text(o.tags).split(/[,;|]/).map(t => t.trim()).filter(Boolean),
      images: text(o.image_urls).split(/[\s|,;]+/).filter(u => /^https?:\/\//i.test(u)),
      errors, warnings,
    });
  });

  // Duplicate SKUs inside the file.
  const seen = new Map<string, number>();
  rows.forEach(r => {
    if (!r.sku) return;
    const k = r.sku.toLowerCase();
    if (seen.has(k)) r.errors.push(`Duplicate SKU (also on line ${seen.get(k)})`); else seen.set(k, r.line);
  });
  return { rows, recognised, headerLine: headerIdx + 1 };
}

export type ImportResult = { created: number; updated: number; skipped: number; failed: { sku: string; message: string }[]; newCategories: string[]; newSuppliers: string[] };

const chunk = <T,>(a: T[], n = 100) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export async function runImport(rows: ParsedRow[], opt: ImportOptions, onProgress?: (done: number, total: number) => void): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: [], newCategories: [], newSuppliers: [] };
  const valid = rows.filter(r => !r.errors.length);

  const [cats, sups, prods] = await Promise.all([
    supabase.from('categories').select('id,name'),
    supabase.from('suppliers').select('id,name'),
    supabase.from('products').select('id,sku,stock_quantity'),
  ]);
  const catMap = new Map((cats.data || []).map((c: any) => [c.name.toLowerCase(), c.id as string]));
  const supMap = new Map((sups.data || []).map((s: any) => [s.name.toLowerCase(), s.id as string]));
  const prodMap = new Map((prods.data || []).filter((p: any) => p.sku).map((p: any) => [p.sku.toLowerCase(), p as { id: string; stock_quantity: number }]));

  // Create missing categories / suppliers.
  if (opt.createMissing) {
    for (const name of [...new Set(valid.map(r => r.category).filter(n => n && !catMap.has(n.toLowerCase())))]) {
      const { data, error } = await supabase.from('categories').insert({ name, slug: slugify(name) }).select('id').single();
      if (!error && data) { catMap.set(name.toLowerCase(), data.id); result.newCategories.push(name); }
    }
    for (const name of [...new Set(valid.map(r => r.supplier).filter(n => n && !supMap.has(n.toLowerCase())))]) {
      const { data, error } = await supabase.from('suppliers').insert({ name }).select('id').single();
      if (!error && data) { supMap.set(name.toLowerCase(), data.id); result.newSuppliers.push(name); }
    }
  }

  const payload = (r: ParsedRow) => ({
    name: r.name,
    sku: r.sku || generateSku(),
    description: r.description || null,
    category_id: r.category ? catMap.get(r.category.toLowerCase()) ?? null : null,
    selling_price: r.selling_price,
    discount_price: r.discount_price,
    low_stock_threshold: r.low_stock_threshold,
    status: r.status,
    is_featured: r.is_featured, is_best_seller: r.is_best_seller, is_new: r.is_new,
    tags: r.tags,
  });
  const costs = (r: ParsedRow, product_id: string) => ({
    product_id,
    supplier_id: r.supplier ? supMap.get(r.supplier.toLowerCase()) ?? null : null,
    supplier_cost: r.supplier_cost, landed_cost: r.landed_cost,
  });

  const toCreate: ParsedRow[] = [];
  const toUpdate: { row: ParsedRow; id: string; stock: number }[] = [];
  valid.forEach(r => {
    const hit = r.sku ? prodMap.get(r.sku.toLowerCase()) : undefined;
    if (!hit) toCreate.push(r);
    else if (opt.existing === 'skip') result.skipped++;
    else toUpdate.push({ row: r, id: hit.id, stock: hit.stock_quantity });
  });

  const total = toCreate.length + toUpdate.length;
  let done = 0;
  const tick = () => onProgress?.(++done, total);

  // Create new products in batches.
  for (const group of chunk(toCreate)) {
    const payloads = group.map(payload);
    const { data, error } = await supabase.from('products').insert(payloads.map((p, i) => ({ ...p, stock_quantity: group[i].stock_quantity }))).select('id,sku');
    if (error || !data) {
      group.forEach(r => result.failed.push({ sku: r.sku, message: error?.message || 'Insert failed' }));
      done += group.length; onProgress?.(done, total); continue;
    }
    const idBySku = new Map(data.map((d: any) => [d.sku.toLowerCase(), d.id as string]));
    const costRows: any[] = [], imgRows: any[] = [], txRows: any[] = [];
    group.forEach((r, i) => {
      const id = idBySku.get(payloads[i].sku.toLowerCase());
      if (!id) { result.failed.push({ sku: r.sku, message: 'Not created' }); return; }
      costRows.push(costs(r, id));
      r.images.forEach((url, k) => imgRows.push({ product_id: id, url, is_primary: k === 0, sort_order: k }));
      if (r.stock_quantity > 0) txRows.push({ product_id: id, quantity_change: r.stock_quantity, reason: 'purchase', reference_type: 'purchase', notes: 'Bulk import — opening stock' });
      result.created++;
    });
    const ce = (await supabase.from('product_costs').upsert(costRows)).error;
    if (ce) result.failed.push({ sku: '(costs)', message: ce.message });
    if (imgRows.length) await supabase.from('product_images').insert(imgRows);
    if (txRows.length) await supabase.from('inventory_transactions').insert(txRows);
    group.forEach(tick);
  }

  // Update existing products.
  for (const { row: r, id, stock } of toUpdate) {
    const p = payload(r);
    const upd: Record<string, unknown> = { ...p };
    if (opt.existing === 'update_add_stock') upd.stock_quantity = stock + r.stock_quantity;
    const { error } = await supabase.from('products').update(upd).eq('id', id);
    if (error) { result.failed.push({ sku: r.sku, message: error.message }); tick(); continue; }
    await supabase.from('product_costs').upsert(costs(r, id));
    if (r.images.length) {
      await supabase.from('product_images').delete().eq('product_id', id);
      await supabase.from('product_images').insert(r.images.map((url, k) => ({ product_id: id, url, is_primary: k === 0, sort_order: k })));
    }
    if (opt.existing === 'update_add_stock' && r.stock_quantity > 0) {
      await supabase.from('inventory_transactions').insert({ product_id: id, quantity_change: r.stock_quantity, reason: 'purchase', reference_type: 'purchase', notes: 'Bulk import — restock' });
    }
    result.updated++; tick();
  }
  return result;
}
