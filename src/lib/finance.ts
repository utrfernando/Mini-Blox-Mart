import * as XLSX from 'xlsx';
import { supabase, formatCurrency, formatDate, type Order } from './supabase';

export const PARTNERS = ['Davide', 'Randima'];
export const EXPENSE_CATEGORIES = ['Shipping & delivery', 'Packaging', 'Advertising', 'Salaries & wages', 'Rent', 'Utilities', 'Platform & payment fees', 'Software & tools', 'Taxes & licences', 'Other'];

export type Expense = {
  id: string; expense_date: string; category: string; description: string | null; amount: number;
  paid_to: string | null; payment_method: string | null; reference: string | null; paid_by?: string | null;
  invoice_path?: string | null; invoice_name?: string | null;
};
export type PartnerTx = { id: string; tx_date: string; partner: string; kind: 'contribution' | 'withdrawal'; amount: number; note: string | null };
export type OrderCost = { order_id: string; delivery_cost: number; payment_fee: number };
export type Budget = { category: string; monthly_limit: number };
export type Recurring = {
  id: string; category: string; description: string | null; amount: number; paid_by: string | null; paid_to: string | null;
  payment_method: string | null; day_of_month: number; active: boolean; last_generated: string | null;
};
export type Lock = { month: string; locked_at: string };

export const monthKey = (d: Date = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Read every row of a table (Supabase returns max 1000 per request). */
export async function fetchAll(table: string, select = '*'): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + 999);
    if (error) return rows; // table may not exist yet - skip it
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

/** Download several sheets as one .xlsx file. */
export function downloadWorkbook(filename: string, sheets: { name: string; rows: Record<string, unknown>[] }[]) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(s => {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ note: 'no data' }]);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  });
  XLSX.writeFile(wb, filename);
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

type StoreInfo = { store_name?: string; contact_email?: string; contact_phone?: string; address?: string };

/** Opens a print-ready invoice. In the print dialog choose "Save as PDF". */
export function printOrderInvoice(order: Order, store: StoreInfo, currency: string) {
  const m = (n: number) => formatCurrency(Number(n || 0), currency);
  const rows = (order.items || []).map(i => `<tr><td>${esc(i.product_name)}${i.sku ? `<br><small>${esc(i.sku)}</small>` : ''}</td><td class="r">${i.quantity}</td><td class="r">${m(i.unit_price)}</td><td class="r">${m(i.line_total)}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(order.order_number)}</title>
<style>
  *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;margin:0;padding:32px;max-width:760px;margin:auto}
  h1{margin:0;font-size:26px;color:#0f766e} .muted{color:#6b7280;font-size:13px}
  .top{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #14b8a6;padding-bottom:16px;margin-bottom:20px}
  .box{display:flex;justify-content:space-between;gap:24px;margin-bottom:20px;font-size:14px}
  table{width:100%;border-collapse:collapse;font-size:14px} th{background:#f0fdfa;text-align:left;padding:8px;font-size:12px;text-transform:uppercase;color:#0f766e}
  td{padding:8px;border-bottom:1px solid #e5e7eb;vertical-align:top} .r{text-align:right} small{color:#9ca3af}
  .tot{margin-left:auto;width:280px;margin-top:14px;font-size:14px} .tot div{display:flex;justify-content:space-between;padding:3px 0}
  .tot .g{font-weight:bold;font-size:17px;border-top:2px solid #1f2937;margin-top:6px;padding-top:8px}
  .stamp{display:inline-block;border:2px solid ${order.payment_status === 'paid' ? '#16a34a' : '#d97706'};color:${order.payment_status === 'paid' ? '#16a34a' : '#d97706'};padding:2px 10px;border-radius:6px;font-weight:bold;text-transform:uppercase;font-size:12px}
  .foot{margin-top:32px;text-align:center;color:#6b7280;font-size:12px}
  @media print{body{padding:0}}
</style></head><body>
<div class="top"><div><h1>${esc(store.store_name || 'MinibloxRC')}</h1><div class="muted">${esc(store.address || '')}<br>${esc(store.contact_phone || '')} ${store.contact_email ? '· ' + esc(store.contact_email) : ''}</div></div>
<div style="text-align:right"><div style="font-size:20px;font-weight:bold">INVOICE</div><div class="muted">${esc(order.order_number)}<br>${esc(formatDate(order.placed_at))}</div></div></div>
<div class="box"><div><b>Billed to</b><br>${esc(order.customer_name)}<br>${esc(order.address_line)}, ${esc(order.city)}<br>${esc(order.district)} ${esc(order.postal_code || '')}<br>${esc(order.phone)}</div>
<div style="text-align:right"><b>Payment</b><br>${order.payment_method === 'cod' ? 'Cash on Delivery' : 'Bank Transfer'}<br><span class="stamp">${esc(order.payment_status)}</span></div></div>
<table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Total</th></tr></thead><tbody>${rows}</tbody></table>
<div class="tot"><div><span>Subtotal</span><span>${m(order.subtotal)}</span></div>
${Number(order.discount_amount) > 0 ? `<div><span>Discount</span><span>−${m(order.discount_amount)}</span></div>` : ''}
<div><span>Delivery</span><span>${m(order.delivery_fee)}</span></div>
<div class="g"><span>Total</span><span>${m(order.total_amount)}</span></div></div>
<div class="foot">Thank you for shopping with ${esc(store.store_name || 'MinibloxRC')}!</div>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) { alert('Please allow pop-ups to print the invoice.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

/** wa.me link with a short order summary, for sending to the customer on WhatsApp. */
export function whatsappLink(order: Order, store: StoreInfo, currency: string) {
  let n = (order.phone || '').replace(/\D/g, '');
  if (n.startsWith('0')) n = '94' + n.slice(1);
  const lines = [
    `Hi ${order.customer_name}, thank you for your order with ${store.store_name || 'MinibloxRC'}!`,
    `Order: ${order.order_number}`,
    ...(order.items || []).map(i => `• ${i.product_name} ×${i.quantity} — ${formatCurrency(i.line_total, currency)}`),
    `Delivery: ${formatCurrency(order.delivery_fee, currency)}`,
    `Total: ${formatCurrency(order.total_amount, currency)} (${order.payment_method === 'cod' ? 'Cash on Delivery' : 'Bank Transfer'}, ${order.payment_status})`,
  ];
  return `https://wa.me/${n}?text=${encodeURIComponent(lines.join('\n'))}`;
}
