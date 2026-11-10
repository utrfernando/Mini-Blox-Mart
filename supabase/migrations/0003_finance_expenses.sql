-- =====================================================================
-- 0003: finance — business expenses ledger (admin-only)
-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- =====================================================================
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null,            -- e.g. Shipping, Packaging, Ads, Salaries, Rent, Utilities, Platform fees, Other
  description text,
  amount numeric(14,2) not null check (amount >= 0),
  paid_to text,
  payment_method text,               -- cash, bank, card ...
  reference text,                    -- receipt / invoice number
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_expenses_date on public.expenses(expense_date desc);

alter table public.expenses enable row level security;
drop policy if exists "expenses_admin" on public.expenses;
create policy "expenses_admin" on public.expenses
  for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.expenses to authenticated;
