-- =====================================================================
-- Miniblox E-Commerce — Initial Schema
-- Run this in the Supabase SQL Editor (or via supabase db push).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
create type public.user_role as enum ('admin', 'customer');
create type public.product_status as enum ('draft', 'published', 'archived');
create type public.order_status as enum ('pending','confirmed','processing','packed','shipped','delivered','cancelled','returned');
create type public.payment_status as enum ('pending','paid','failed','refunded','partially_refunded');
create type public.payment_method as enum ('cod','bank_transfer');
create type public.inventory_reason as enum ('purchase','sale','adjustment','return','damage','correction');

-- ---------------------------------------------------------------------
-- PROFILES & ROLES
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  role public.user_role not null default 'customer',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.user_role not null,
  unique(user_id, role)
);

-- Auto-create profile on signup (always as customer — never self-assign admin)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  )
$$;

-- ---------------------------------------------------------------------
-- CATALOG
-- ---------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_cost numeric(12,2) not null default 0,
  landed_cost numeric(12,2) not null default 0,
  selling_price numeric(12,2) not null,
  discount_price numeric(12,2),
  stock_quantity int not null default 0 check (stock_quantity >= 0),
  low_stock_threshold int not null default 5,
  status public.product_status not null default 'draft',
  is_featured boolean not null default false,
  is_best_seller boolean not null default false,
  is_new boolean not null default false,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt_text text,
  sort_order int not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_products_category on public.products(category_id);
create index idx_products_status on public.products(status);
create index idx_products_featured on public.products(is_featured) where is_featured;
create index idx_products_created on public.products(created_at desc);
create index idx_product_images_product on public.product_images(product_id);

-- ---------------------------------------------------------------------
-- INVENTORY
-- ---------------------------------------------------------------------
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete set null,
  reference text,
  purchase_date date not null default current_date,
  total_cost numeric(14,2) not null default 0,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity int not null check (quantity > 0),
  unit_cost numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  quantity_change int not null,
  reason public.inventory_reason not null,
  reference_type text,           -- 'order','purchase','manual'
  reference_id uuid,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_inv_tx_product on public.inventory_transactions(product_id);
create index idx_inv_tx_created on public.inventory_transactions(created_at desc);

-- ---------------------------------------------------------------------
-- CARTS (persisted server-side; localStorage used for guests)
-- ---------------------------------------------------------------------
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity int not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique(cart_id, product_id)
);

-- ---------------------------------------------------------------------
-- WISHLIST
-- ---------------------------------------------------------------------
create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  created_at timestamptz not null default now()
);

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(wishlist_id, product_id)
);

-- ---------------------------------------------------------------------
-- ADDRESSES
-- ---------------------------------------------------------------------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  recipient_name text not null,
  phone text not null,
  address_line text not null,
  city text not null,
  district text not null,
  postal_code text,
  delivery_instructions text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_addresses_user on public.addresses(user_id);

-- ---------------------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------------------
create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  min_order_amount numeric(12,2) not null default 0,
  max_uses int,
  used_count int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  email text not null,
  phone text not null,
  address_line text not null,
  city text not null,
  district text not null,
  postal_code text,
  delivery_instructions text,
  status public.order_status not null default 'pending',
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'pending',
  subtotal numeric(12,2) not null,
  discount_amount numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null,
  discount_code_id uuid references public.discount_codes(id) on delete set null,
  tracking_number text,
  notes text,
  placed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_orders_user on public.orders(user_id);
create index idx_orders_status on public.orders(status);
create index idx_orders_placed on public.orders(placed_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  sku text,
  unit_price numeric(12,2) not null,
  quantity int not null check (quantity > 0),
  line_total numeric(12,2) not null,
  created_at timestamptz not null default now()
);
create index idx_order_items_order on public.order_items(order_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method public.payment_method not null,
  amount numeric(12,2) not null,
  status public.payment_status not null default 'pending',
  reference text,               -- bank slip ref / transfer ref
  proof_url text,               -- uploaded receipt in storage
  notes text,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_payments_order on public.payments(order_id);

-- ---------------------------------------------------------------------
-- CONTENT / SETTINGS
-- ---------------------------------------------------------------------
create table public.website_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value jsonb not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.homepage_sections (
  id uuid primary key default gen_random_uuid(),
  section_key text not null unique,   -- hero, categories, featured, bestsellers, newarrivals, promo, whyus, testimonials, newsletter
  title text,
  subtitle text,
  is_visible boolean not null default true,
  sort_order int not null default 0,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_url text,
  cta_label text,
  cta_link text,
  placement text not null default 'home_hero', -- home_hero, home_promo, category
  sort_order int not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  subject text,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_created on public.audit_logs(created_at desc);

-- ---------------------------------------------------------------------
-- UPDATED_AT TRIGGER
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','products','orders','website_settings','homepage_sections','carts']
  loop
    execute format('drop trigger if exists touch_%I on public.%I', t, t);
    execute format('create trigger touch_%I before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- ORDER NUMBER GENERATOR + PLACE ORDER RPC
-- ---------------------------------------------------------------------
create or replace function public.generate_order_number()
returns text language plpgsql as $$
declare seq int;
begin
  -- simple sequence based on count for demo; replace with a dedicated sequence in production
  select count(*)::int + 1000 into seq from public.orders;
  return 'MB-' || to_char(now(), 'YYMMDD') || '-' || lpad(seq::text, 4, '0');
end $$;

-- Atomically validate stock, create order + items + payment, decrement stock,
-- record inventory transactions, and consume discount usage.
create or replace function public.place_order(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_order_id uuid;
  v_item jsonb;
  v_product record;
  v_qty int;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_delivery numeric := 0;
  v_total numeric;
  v_discount_id uuid := nullif(payload->>'discount_code_id','')::uuid;
  v_code record;
  v_free_threshold numeric := 1500;
  v_delivery_fee numeric := 250;
  v_payment_method public.payment_method := (payload->>'payment_method')::public.payment_method;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  -- delivery pricing from settings
  select coalesce((setting_value->>'delivery_fee')::numeric, 250) into v_delivery_fee
    from public.website_settings where setting_key = 'store';
  select coalesce((setting_value->>'free_delivery_threshold')::numeric, 1500) into v_free_threshold
    from public.website_settings where setting_key = 'store';
  v_delivery_fee := coalesce(v_delivery_fee, 250);
  v_free_threshold := coalesce(v_free_threshold, 1500);

  -- validate items & stock, compute subtotal
  for v_item in select * from jsonb_array_elements(payload->'items') loop
    v_qty := (v_item->>'quantity')::int;
    select id, name, sku, stock_quantity, selling_price,
           coalesce(discount_price, selling_price) as price
      into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid
        and status = 'published';
    if not found then
      raise exception 'Product % is unavailable', v_item->>'product_id';
    end if;
    if v_product.stock_quantity < v_qty then
      raise exception 'Insufficient stock for % (available: %)', v_product.name, v_product.stock_quantity;
    end if;
    v_subtotal := v_subtotal + v_product.price * v_qty;
  end loop;

  -- discount code
  if v_discount_id is not null then
    select * into v_code from public.discount_codes where id = v_discount_id and is_active;
    if found and (v_code.starts_at is null or v_code.starts_at <= now())
       and (v_code.ends_at is null or v_code.ends_at >= now())
       and (v_code.max_uses is null or v_code.used_count < v_code.max_uses)
       and v_subtotal >= v_code.min_order_amount then
      if v_code.discount_type = 'percent' then
        v_discount := round(v_subtotal * v_code.discount_value / 100, 2);
      else
        v_discount := least(v_code.discount_value, v_subtotal);
      end if;
    end if;
  end if;

  if v_subtotal - v_discount >= v_free_threshold then
    v_delivery := 0;
  else
    v_delivery := v_delivery_fee;
  end if;
  v_total := v_subtotal - v_discount + v_delivery;

  insert into public.orders (
    order_number, user_id, customer_name, email, phone,
    address_line, city, district, postal_code, delivery_instructions,
    status, payment_method, payment_status,
    subtotal, discount_amount, delivery_fee, total_amount,
    discount_code_id, notes
  ) values (
    public.generate_order_number(), v_user,
    payload->>'customer_name', payload->>'email', payload->>'phone',
    payload->>'address_line', payload->>'city', payload->>'district',
    payload->>'postal_code', payload->>'delivery_instructions',
    'pending', v_payment_method, 'pending',
    v_subtotal, v_discount, v_delivery, v_total,
    v_discount_id, payload->>'notes'
  ) returning id into v_order_id;

  -- order items + stock decrement + inventory log
  for v_item in select * from jsonb_array_elements(payload->'items') loop
    v_qty := (v_item->>'quantity')::int;
    select id, name, sku, coalesce(discount_price, selling_price) as price
      into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid;

    insert into public.order_items (order_id, product_id, product_name, sku, unit_price, quantity, line_total)
    values (v_order_id, v_product.id, v_product.name, v_product.sku, v_product.price, v_qty, v_product.price * v_qty);

    update public.products
      set stock_quantity = stock_quantity - v_qty
      where id = v_product.id;

    insert into public.inventory_transactions (product_id, quantity_change, reason, reference_type, reference_id, notes)
    values (v_product.id, -v_qty, 'sale', 'order', v_order_id, 'Order ' || (payload->>'order_number_hint'));
  end loop;

  insert into public.payments (order_id, method, amount, status)
  values (v_order_id, v_payment_method, v_total, 'pending');

  if v_discount_id is not null and v_discount > 0 then
    update public.discount_codes set used_count = used_count + 1 where id = v_discount_id;
  end if;

  return v_order_id;
end $$;

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.addresses enable row level security;
alter table public.discount_codes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.website_settings enable row level security;
alter table public.homepage_sections enable row level security;
alter table public.banners enable row level security;
alter table public.contact_messages enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.audit_logs enable row level security;

-- profiles: users read/update own; admin reads all. Role changes are admin-only.
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));
create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

create policy "user_roles_select_own_or_admin" on public.user_roles
  for select using (auth.uid() = user_id or public.is_admin());
create policy "user_roles_admin_all" on public.user_roles
  for all using (public.is_admin()) with check (public.is_admin());

-- Catalog: everyone reads published products/categories/banners/settings;
-- only admins write.
create policy "categories_public_read" on public.categories for select using (true);
create policy "categories_admin_write" on public.categories for all using (public.is_admin()) with check (public.is_admin());

create policy "suppliers_admin" on public.suppliers for all using (public.is_admin()) with check (public.is_admin());
create policy "suppliers_admin_read" on public.suppliers for select using (public.is_admin() or auth.role() = 'authenticated');

create policy "products_public_read" on public.products
  for select using (status = 'published' or public.is_admin() or auth.role() = 'authenticated');
create policy "products_admin_write" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

create policy "product_images_public_read" on public.product_images
  for select using (
    exists (select 1 from public.products p where p.id = product_id
            and (p.status = 'published' or public.is_admin() or auth.role() = 'authenticated'))
  );
create policy "product_images_admin_write" on public.product_images
  for all using (public.is_admin()) with check (public.is_admin());

-- Inventory: admin only
create policy "purchases_admin" on public.purchases for all using (public.is_admin()) with check (public.is_admin());
create policy "purchase_items_admin" on public.purchase_items for all using (public.is_admin()) with check (public.is_admin());
create policy "inv_tx_admin_read" on public.inventory_transactions for select using (public.is_admin());
create policy "inv_tx_admin_write" on public.inventory_transactions for insert with check (public.is_admin());
create policy "inv_tx_admin_update" on public.inventory_transactions for update using (public.is_admin());

-- Carts / wishlist: owner only (admin read for support)
create policy "carts_owner" on public.carts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cart_items_owner" on public.cart_items for all
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));
create policy "wishlists_owner" on public.wishlists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "wishlist_items_owner" on public.wishlist_items for all
  using (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.user_id = auth.uid()));

-- Addresses: owner only
create policy "addresses_owner" on public.addresses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Orders: customers see own; admins see all. Insert only via place_order RPC.
create policy "orders_select" on public.orders for select using (auth.uid() = user_id or public.is_admin());
create policy "orders_admin_update" on public.orders for update using (public.is_admin()) with check (public.is_admin());
create policy "orders_admin_delete" on public.orders for delete using (public.is_admin());

create policy "order_items_select" on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));

create policy "payments_select" on public.payments for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
create policy "payments_admin_update" on public.payments for update using (public.is_admin()) with check (public.is_admin());
create policy "payments_admin_insert" on public.payments for insert with check (public.is_admin());

-- Discounts: public can validate (read active), admin manages
create policy "discounts_public_read" on public.discount_codes for select using (is_active or public.is_admin());
create policy "discounts_admin_write" on public.discount_codes for all using (public.is_admin()) with check (public.is_admin());

-- Settings/content: public read, admin write
create policy "settings_public_read" on public.website_settings for select using (true);
create policy "settings_admin_write" on public.website_settings for all using (public.is_admin()) with check (public.is_admin());

create policy "homepage_sections_public_read" on public.homepage_sections for select using (true);
create policy "homepage_sections_admin_write" on public.homepage_sections for all using (public.is_admin()) with check (public.is_admin());

create policy "banners_public_read" on public.banners for select using (is_active or public.is_admin());
create policy "banners_admin_write" on public.banners for all using (public.is_admin()) with check (public.is_admin());

create policy "contact_insert" on public.contact_messages for insert with check (true);
create policy "contact_admin_read" on public.contact_messages for select using (public.is_admin());
create policy "contact_admin_update" on public.contact_messages for update using (public.is_admin());

create policy "newsletter_insert" on public.newsletter_subscribers for insert with check (true);
create policy "newsletter_admin" on public.newsletter_subscribers for all using (public.is_admin()) with check (public.is_admin());

create policy "audit_admin" on public.audit_logs for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- GRANTS (anon/authenticated via PostgREST)
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.categories, public.products, public.product_images, public.banners,
  public.homepage_sections, public.website_settings, public.discount_codes to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.place_order(jsonb) to authenticated;
grant execute on function public.is_admin() to authenticated, anon;

-- ---------------------------------------------------------------------
-- SEED: categories, settings, homepage sections, demo discount
-- ---------------------------------------------------------------------
insert into public.categories (name, slug, description, sort_order) values
  ('Building Blocks', 'building-blocks', 'Mini building-block figures and construction sets', 1),
  ('Flower Collections', 'flower-collections', 'Build-your-own flower arrangements', 2),
  ('Collectibles', 'collectibles', 'Limited edition and rare finds', 3),
  ('Creative Gifts', 'creative-gifts', 'Thoughtful gifts for every occasion', 4),
  ('Party & Fun', 'party-fun', 'Playful picks for parties and playtime', 5)
on conflict (slug) do nothing;

insert into public.website_settings (setting_key, setting_value) values
  ('store', '{
    "store_name": "Miniblox",
    "tagline": "Small Things. Big Smiles.",
    "currency": "LKR",
    "currency_symbol": "Rs.",
    "delivery_fee": 250,
    "free_delivery_threshold": 1500,
    "contact_email": "hello@miniblox.lk",
    "contact_phone": "+94 77 000 0000",
    "whatsapp": "+94 77 000 0000",
    "address": "Colombo, Sri Lanka",
    "social": {"instagram": "https://instagram.com/miniblox", "tiktok": "", "facebook": ""}
  }'),
  ('bank', '{
    "bank_name": "Bank of Ceylon",
    "account_name": "Miniblox (Pvt) Ltd",
    "account_number": "XXXXXXXXXXXX",
    "branch": "Colombo",
    "instructions": "Please use your order number as the transfer reference and upload the receipt after checkout."
  }'),
  ('branding', '{
    "logo_url": "",
    "favicon_url": "",
    "primary_color": "#14b8a6",
    "secondary_color": "#f59e0b",
    "font": "Nunito"
  }')
on conflict (setting_key) do nothing;

insert into public.homepage_sections (section_key, title, subtitle, is_visible, sort_order) values
  ('hero', 'Hero Banner', 'Main promotional banner', true, 1),
  ('categories', 'Shop by Category', 'Browse our collections', true, 2),
  ('featured', 'Featured Products', 'Hand-picked favourites', true, 3),
  ('bestsellers', 'Best Sellers', 'Loved by our community', true, 4),
  ('newarrivals', 'New Arrivals', 'Fresh off the shelf', true, 5),
  ('promo', 'Promotion', 'Special offers', true, 6),
  ('whyus', 'Why Shop With Miniblox', 'Our promise to you', true, 7),
  ('testimonials', 'What Our Customers Say', 'Real smiles, real reviews', true, 8),
  ('newsletter', 'Stay in the Loop', 'Get cute updates & offers', true, 9)
on conflict (section_key) do nothing;

insert into public.discount_codes (code, description, discount_type, discount_value, min_order_amount) values
  ('WELCOME10', '10% off your first order', 'percent', 10, 0),
  ('MINIBLOX250', 'Rs. 250 off orders over Rs. 2,000', 'fixed', 250, 2000)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- STORAGE BUCKETS
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('products', 'products', true), ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

-- Product images: public read, admin write
create policy "product_images_storage_public_read" on storage.objects
  for select using (bucket_id = 'products');
create policy "product_images_storage_admin_write" on storage.objects
  for insert with check (bucket_id = 'products' and public.is_admin());
create policy "product_images_storage_admin_update" on storage.objects
  for update using (bucket_id = 'products' and public.is_admin());
create policy "product_images_storage_admin_delete" on storage.objects
  for delete using (bucket_id = 'products' and public.is_admin());

-- Payment proofs: owner upload, admin read
create policy "payment_proofs_owner_insert" on storage.objects
  for insert with check (bucket_id = 'payment-proofs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "payment_proofs_owner_read" on storage.objects
  for select using (bucket_id = 'payment-proofs' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin()));
