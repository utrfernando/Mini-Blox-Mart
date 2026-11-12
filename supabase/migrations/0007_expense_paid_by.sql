-- =====================================================================
-- 0007: track which partner paid each expense (Davide / Randima)
-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- =====================================================================
alter table public.expenses add column if not exists paid_by text;
create index if not exists expenses_paid_by_idx on public.expenses (paid_by);
