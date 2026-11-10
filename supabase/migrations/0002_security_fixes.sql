-- =====================================================================
-- 0002: security fixes
--   1. Move cost columns out of public.products into admin-only product_costs
--   2. Draft/archived products + suppliers no longer visible to customers
--   3. Customers can attach a bank-transfer receipt via a safe RPC
-- Safe to run once on top of 0001.
-- =====================================================================

-- 1. Admin-only cost table ------------------------------------------------
create table if not exists public.product_costs (
  product_id uuid primary key references public.products(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_cost numeric(12,2) not null default 0,
  landed_cost numeric(12,2) not null default 0
);

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'products' and column_name = 'supplier_cost') then
    insert into public.product_costs (product_id, supplier_id, supplier_cost, landed_cost)
    select id, supplier_id, supplier_cost, landed_cost from public.products
    on conflict (product_id) do nothing;

    alter table public.products
      drop column supplier_id,
      drop column supplier_cost,
      drop column landed_cost;
  end if;
end $$;

alter table public.product_costs enable row level security;
drop policy if exists "product_costs_admin" on public.product_costs;
create policy "product_costs_admin" on public.product_costs
  for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.product_costs to authenticated;

-- 2. Tighten read policies ------------------------------------------------
drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products
  for select using (status = 'published' or public.is_admin());

drop policy if exists "product_images_public_read" on public.product_images;
create policy "product_images_public_read" on public.product_images
  for select using (
    exists (select 1 from public.products p where p.id = product_id
            and (p.status = 'published' or public.is_admin()))
  );

drop policy if exists "suppliers_admin_read" on public.suppliers;

-- 3. Receipt attachment ----------------------------------------------------
-- proof_url now stores the storage path inside the private 'payment-proofs'
-- bucket; the app creates a short-lived signed URL when viewing it.
create or replace function public.attach_payment_proof(p_order_id uuid, p_proof_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (select 1 from public.orders where id = p_order_id and user_id = auth.uid()) then
    raise exception 'Order not found';
  end if;
  if split_part(p_proof_path, '/', 1) <> auth.uid()::text then
    raise exception 'Invalid receipt path';
  end if;
  update public.payments set proof_url = p_proof_path where order_id = p_order_id;
end $$;

revoke all on function public.attach_payment_proof(uuid, text) from public, anon;
grant execute on function public.attach_payment_proof(uuid, text) to authenticated;
