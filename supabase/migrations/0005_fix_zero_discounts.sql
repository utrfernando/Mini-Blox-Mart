-- =====================================================================
-- 0005: a discount price of 0 must never exist (it made products free)
-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- =====================================================================
update public.products set discount_price = null where discount_price is not null and discount_price <= 0;

alter table public.products drop constraint if exists products_discount_price_positive;
alter table public.products
  add constraint products_discount_price_positive check (discount_price is null or discount_price > 0);
