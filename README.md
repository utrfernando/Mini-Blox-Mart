# MinibloxRC — E-Commerce Platform

**Small Things. Big Smiles.** A complete, database-connected online store for mini building-block figures, collectible toys, flower-building sets and creative gifts in Sri Lanka.

## Tech Stack

- **React 19 + Vite + TypeScript**
- **Tailwind CSS** (custom MinibloxRC palette: mint, sunshine, cream, peach, lavender)
- **Supabase** — Auth, PostgreSQL, Storage, Row Level Security
- **React Router**, **React Hook Form + Zod**, **Framer Motion**, **Recharts**, **Lucide icons**

## Features

### Storefront
- Home (configurable hero banners, categories, featured/best-seller/new-arrival rails, promo banners, testimonials, newsletter)
- Shop with search, category & quick filters, sorting
- Product details with gallery, stock states, wishlist
- Cart with quantities, discount codes, delivery calculation
- Checkout (Cash on Delivery / Bank Transfer with receipt upload) — login required
- Customer accounts: profile, password, saved addresses, order history & live status tracking, wishlist
- Contact, About, FAQ, Shipping/Return/Privacy/Terms pages

### Admin (`/admin`)
- **Overview** — revenue, profit (landed-cost based), orders, inventory value, charts, CSV export
- **Products** — full CRUD, multi-image upload, SKU, supplier/landed/selling/discount costs, stock & low-stock alerts, featured/best-seller/new flags, publish/draft/archive
- **Categories & Suppliers** management
- **Inventory** — stock overview, adjustments with reason, full movement history, purchase recording (auto stock-in + landed cost)
- **Orders** — search/filter, status pipeline (Pending→Delivered/Cancelled/Returned), tracking numbers, bank-transfer payment verification, auto-restock on cancel/return
- **Customers**, **Discount codes**, **Promotions/banners**, **Contact messages**
- **Website customization** — homepage section visibility/order/titles, branding (logo, colours, font)
- **Store settings** — contact info, delivery fees, free-delivery threshold, social links, bank details

## Setup

### 1. Install

```bash
npm install
cp .env.example .env   # then fill in your Supabase credentials
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project.
2. In **SQL Editor**, run `supabase/migrations/0001_miniblox_schema.sql` (creates all tables, RLS policies, the `place_order` RPC and seed content).
3. Optionally run `supabase/seed.sql` for demo products (not included — add your own via Admin → Products).

### 3. Environment variables

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...   # anon public key only — never the service-role key
```

### 4. Create the first admin

Sign-ups always create `customer` accounts (users can never self-assign admin). To make the first admin, in the Supabase SQL Editor run:

```sql
-- after the user has registered via the app:
update public.profiles set role = 'admin' where email = 'you@example.com';
```

### 5. Run

```bash
npm run dev      # dev server
npm run build    # typecheck + production build
npm run preview  # preview build
```

## Architecture notes

- **Cart & wishlist** live in `localStorage` for guests and sync to `carts`/`cart_items`/`wishlists` tables on login.
- **Checkout** calls the `place_order` Postgres function (SECURITY DEFINER) which validates stock, applies discount codes, computes delivery, creates the order + items + payment, decrements inventory and logs `inventory_transactions` — atomically.
- **RLS**: customers only see their own orders/addresses/profile; only `role='admin'` profiles can write catalog, settings, orders management, etc. Product price/cost edits are admin-only.
- **Storage buckets**: `products` (public images) and `payment-proofs` (private receipts).

## Roadmap / integrations

- PayHere (or similar) can be added as a third `payment_method` — the `payments` table already stores method/status/proof without card data.
- Edge functions could replace client-side report aggregation for very large datasets.
