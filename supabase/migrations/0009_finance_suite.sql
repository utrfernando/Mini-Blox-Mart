-- =====================================================================
-- 0009: finance suite
--   * partner contributions / withdrawals
--   * supplier payment tracking on purchases
--   * per-order costs (delivery, payment fees) - admin only
--   * monthly category budgets
--   * recurring expenses
--   * month locks (closed months can't be edited)
--   * audit history for finance changes
-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- =====================================================================

-- 2. Partner contributions & withdrawals ------------------------------
create table if not exists public.partner_transactions (
  id uuid primary key default gen_random_uuid(),
  tx_date date not null default current_date,
  partner text not null,
  kind text not null check (kind in ('contribution', 'withdrawal')),
  amount numeric(14,2) not null check (amount > 0),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_partner_tx_date on public.partner_transactions(tx_date desc);

-- 3. Supplier payments on purchases -----------------------------------
alter table public.purchases add column if not exists amount_paid numeric(14,2) not null default 0;
alter table public.purchases add column if not exists last_paid_date date;
-- Existing purchases are assumed to be fully paid so no phantom debt appears.
-- Only purchases recorded from now on start as unpaid.
update public.purchases set amount_paid = total_cost where amount_paid = 0 and last_paid_date is null;

-- 4. Per-order costs (kept off public.orders so customers can't read them)
create table if not exists public.order_costs (
  order_id uuid primary key references public.orders(id) on delete cascade,
  delivery_cost numeric(12,2) not null default 0,
  payment_fee numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);

-- 7. Budgets -----------------------------------------------------------
create table if not exists public.expense_budgets (
  category text primary key,
  monthly_limit numeric(14,2) not null check (monthly_limit >= 0)
);

-- 8. Recurring expenses -----------------------------------------------
create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text,
  amount numeric(14,2) not null check (amount >= 0),
  paid_by text,
  paid_to text,
  payment_method text,
  day_of_month int not null default 1 check (day_of_month between 1 and 28),
  active boolean not null default true,
  last_generated text,           -- 'YYYY-MM' of the last month it was added
  created_at timestamptz not null default now()
);

-- 10. Month locks ------------------------------------------------------
create table if not exists public.finance_locks (
  month text primary key check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  locked_by uuid references public.profiles(id) on delete set null,
  locked_at timestamptz not null default now()
);

-- RLS: admin only on everything above ----------------------------------
do $$
declare t text;
begin
  foreach t in array array['partner_transactions','order_costs','expense_budgets','recurring_expenses','finance_locks']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_admin" on public.%I', t, t);
    execute format('create policy "%s_admin" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Month-lock enforcement ------------------------------------------------
create or replace function public.enforce_month_lock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  col text := tg_argv[0];
  d_old date;
  d_new date;
begin
  if tg_op in ('UPDATE', 'DELETE') then d_old := (to_jsonb(old)->>col)::date; end if;
  if tg_op in ('INSERT', 'UPDATE') then d_new := (to_jsonb(new)->>col)::date; end if;
  if d_old is not null and exists (select 1 from public.finance_locks where month = to_char(d_old, 'YYYY-MM')) then
    raise exception 'The month % is locked. Unlock it in Finance > Records to make changes.', to_char(d_old, 'YYYY-MM');
  end if;
  if d_new is not null and exists (select 1 from public.finance_locks where month = to_char(d_new, 'YYYY-MM')) then
    raise exception 'The month % is locked. Unlock it in Finance > Records to make changes.', to_char(d_new, 'YYYY-MM');
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists expenses_month_lock on public.expenses;
create trigger expenses_month_lock before insert or update or delete on public.expenses
  for each row execute function public.enforce_month_lock('expense_date');
drop trigger if exists partner_tx_month_lock on public.partner_transactions;
create trigger partner_tx_month_lock before insert or update or delete on public.partner_transactions
  for each row execute function public.enforce_month_lock('tx_date');

-- Audit history ---------------------------------------------------------
create or replace function public.log_finance_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rid text := coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'order_id', to_jsonb(old)->>'id', to_jsonb(old)->>'order_id');
begin
  insert into public.audit_logs (user_id, action, entity, entity_id, details)
  values (
    auth.uid(), lower(tg_op), tg_table_name,
    case when rid ~ '^[0-9a-fA-F-]{36}$' then rid::uuid else null end,
    jsonb_build_object(
      'old', case when tg_op <> 'INSERT' then to_jsonb(old) end,
      'new', case when tg_op <> 'DELETE' then to_jsonb(new) end,
      'key', rid
    )
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['expenses','partner_transactions','purchases','order_costs','expense_budgets','recurring_expenses','finance_locks']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.log_finance_change()', t || '_audit', t);
  end loop;
end $$;
