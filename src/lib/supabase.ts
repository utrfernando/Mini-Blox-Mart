import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');

// ------------------------------------------------------------------
// Domain types
// ------------------------------------------------------------------
export type UserRole = 'admin' | 'customer';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type Supplier = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

export type ProductStatus = 'draft' | 'published' | 'archived';

export type Product = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  category_id: string | null;
  supplier_id: string | null;
  supplier_cost: number;
  landed_cost: number;
  selling_price: number;
  discount_price: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  status: ProductStatus;
  is_featured: boolean;
  is_best_seller: boolean;
  is_new: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
  // joined
  category?: Category | null;
  images?: ProductImage[];
};

export type ProductImage = {
  id: string;
  product_id: string;
  url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
};

export type Purchase = {
  id: string;
  supplier_id: string | null;
  reference: string | null;
  purchase_date: string;
  total_cost: number;
  notes: string | null;
  invoice_path?: string | null;
  invoice_name?: string | null;
  created_by: string | null;
  created_at: string;
  supplier?: Supplier | null;
  items?: PurchaseItem[];
};

export type PurchaseItem = {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
};

export type InventoryTransaction = {
  id: string;
  product_id: string;
  quantity_change: number;
  reason: 'purchase' | 'sale' | 'adjustment' | 'return' | 'damage' | 'correction';
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  product?: Pick<Product, 'id' | 'name' | 'sku'>;
};

export type Address = {
  id: string;
  user_id: string;
  label: string | null;
  recipient_name: string;
  phone: string;
  address_line: string;
  city: string;
  district: string;
  postal_code: string | null;
  delivery_instructions: string | null;
  is_default: boolean;
  created_at: string;
};

export type DiscountCode = {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_uses: number | null;
  used_count: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
};

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'packed' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
export type PaymentMethod = 'cod' | 'bank_transfer';

export type Order = {
  id: string;
  order_number: string;
  user_id: string | null;
  customer_name: string;
  email: string;
  phone: string;
  address_line: string;
  city: string;
  district: string;
  postal_code: string | null;
  delivery_instructions: string | null;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  subtotal: number;
  discount_amount: number;
  delivery_fee: number;
  total_amount: number;
  discount_code_id: string | null;
  tracking_number: string | null;
  notes: string | null;
  placed_at: string;
  confirmed_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  payments?: Payment[];
  user?: Profile | null;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  sku: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  created_at: string;
};

export type Payment = {
  id: string;
  order_id: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  reference: string | null;
  proof_url: string | null;
  notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  paid_at: string | null;
  created_at: string;
};

export type WebsiteSettings = {
  store?: {
    store_name?: string;
    tagline?: string;
    currency?: string;
    currency_symbol?: string;
    delivery_fee?: number;
    free_delivery_threshold?: number;
    checkout_enabled?: boolean;
    support_bot_enabled?: boolean;
    checkout_message?: string;
    contact_email?: string;
    contact_phone?: string;
    whatsapp?: string;
    address?: string;
    social?: { instagram?: string; tiktok?: string; facebook?: string };
  };
  bank?: {
    bank_name?: string;
    account_name?: string;
    account_number?: string;
    branch?: string;
    instructions?: string;
  };
  branding?: {
    logo_url?: string;
    favicon_url?: string;
    primary_color?: string;
    secondary_color?: string;
    font?: string;
  };
};

export type HomepageSection = {
  id: string;
  section_key: string;
  title: string | null;
  subtitle: string | null;
  is_visible: boolean;
  sort_order: number;
  config: Record<string, any>;
};

export type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_link: string | null;
  placement: string;
  sort_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
};

export type NewsletterSubscriber = {
  id: string;
  email: string;
  created_at: string;
};

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
export const CURRENCY_SYMBOLS: Record<string, string> = {
  LKR: 'Rs.', USD: '$', EUR: '€', GBP: '£', INR: '₹',
};

export const formatCurrency = (amount: number, currency = 'LKR'): string => {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  return `${symbol} ${Number(amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing',
  packed: 'Packed', shipped: 'Shipped', delivered: 'Delivered',
  cancelled: 'Cancelled', returned: 'Returned',
};

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'bg-sunshine-100 text-sunshine-700',
  confirmed: 'bg-mint-100 text-mint-700',
  processing: 'bg-lavender-100 text-lavender-700',
  packed: 'bg-peach-100 text-peach-600',
  shipped: 'bg-sky-100 text-sky-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
  returned: 'bg-ink-100 text-ink-600',
};

// ------------------------------------------------------------------
// Admin helpers
// ------------------------------------------------------------------
// Cost fields live in the admin-only `product_costs` table. Admin queries embed it
// as `costs:product_costs(*)`; this flattens it back onto the product.
export const PRODUCT_COSTS_EMBED = 'costs:product_costs(*)';

export function withCosts<T extends Record<string, any>>(rows: T[] | null | undefined): any[] {
  return (rows || []).map(({ costs, ...p }) => {
    const c = Array.isArray(costs) ? costs[0] : costs;
    return {
      ...p,
      supplier_id: c?.supplier_id ?? null,
      supplier_cost: Number(c?.supplier_cost ?? 0),
      landed_cost: Number(c?.landed_cost ?? 0),
    };
  });
}

// Receipts are stored by path in the private 'payment-proofs' bucket.
export async function openReceipt(pathOrUrl: string) {
  if (/^https?:\/\//.test(pathOrUrl)) { window.open(pathOrUrl, '_blank', 'noopener'); return; }
  const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(pathOrUrl, 300);
  if (error || !data?.signedUrl) { alert('Could not open receipt: ' + (error?.message || 'unknown error')); return; }
  window.open(data.signedUrl, '_blank', 'noopener');
}

// Invoices live in the private admin-only 'invoices' bucket.
export async function uploadInvoice(file: File, folder: string): Promise<{ path: string; name: string }> {
  if (file.size > 15 * 1024 * 1024) throw new Error('File is larger than 15 MB.');
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
  const path = `${folder}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from('invoices').upload(path, file);
  if (error) throw new Error(/not found/i.test(error.message) ? 'Invoice storage is not set up yet - run migration 0004_invoices.sql in Supabase.' : error.message);
  return { path, name: file.name };
}
export async function openInvoice(path: string) {
  const { data, error } = await supabase.storage.from('invoices').createSignedUrl(path, 300);
  if (error || !data?.signedUrl) { alert('Could not open invoice: ' + (error?.message || 'unknown error')); return; }
  window.open(data.signedUrl, '_blank', 'noopener');
}

// A discount only counts when it is a real positive price below the selling price.
export const hasDiscount = (p: { discount_price: number | null; selling_price: number }) =>
  p.discount_price != null && p.discount_price > 0 && p.discount_price < p.selling_price;
export const unitPrice = (p: { discount_price: number | null; selling_price: number }) =>
  hasDiscount(p) ? (p.discount_price as number) : p.selling_price;
