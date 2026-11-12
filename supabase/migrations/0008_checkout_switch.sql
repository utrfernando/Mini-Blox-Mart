-- =====================================================================
-- 0008: server-side checkout switch
-- Admin > Store Settings > "Checkout is open" toggle stores
-- store.checkout_enabled. This trigger enforces it in the database, so
-- no order can be created while checkout is stopped.
-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- =====================================================================
create or replace function public.enforce_checkout_enabled()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_off boolean;
begin
  select coalesce((setting_value->>'checkout_enabled')::boolean, true) = false
    into v_off from public.website_settings where setting_key = 'store';
  if coalesce(v_off, false) then
    raise exception 'Checkout is temporarily paused. Please try again later.';
  end if;
  return new;
end $$;

drop trigger if exists orders_checkout_switch on public.orders;
create trigger orders_checkout_switch before insert on public.orders
  for each row execute function public.enforce_checkout_enabled();
