-- =====================================================================
-- 0004: invoice attachments for expenses and supplier purchases
-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- Requires 0003_finance_expenses.sql to have been run first.
-- =====================================================================
alter table public.expenses  add column if not exists invoice_path text, add column if not exists invoice_name text;
alter table public.purchases add column if not exists invoice_path text, add column if not exists invoice_name text;

-- Private bucket: only admins can upload / read / replace / delete invoices.
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

drop policy if exists "invoices_admin_select" on storage.objects;
drop policy if exists "invoices_admin_insert" on storage.objects;
drop policy if exists "invoices_admin_update" on storage.objects;
drop policy if exists "invoices_admin_delete" on storage.objects;
create policy "invoices_admin_select" on storage.objects for select using (bucket_id = 'invoices' and public.is_admin());
create policy "invoices_admin_insert" on storage.objects for insert with check (bucket_id = 'invoices' and public.is_admin());
create policy "invoices_admin_update" on storage.objects for update using (bucket_id = 'invoices' and public.is_admin());
create policy "invoices_admin_delete" on storage.objects for delete using (bucket_id = 'invoices' and public.is_admin());
