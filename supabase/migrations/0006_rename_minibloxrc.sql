-- =====================================================================
-- 0006: rename the store to MinibloxRC in the database
-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- (You can also change the store name later in Admin > Store Settings.)
-- =====================================================================
update public.website_settings
set setting_value = jsonb_set(setting_value, '{store_name}', '"MinibloxRC"')
where setting_key = 'store';

update public.homepage_sections
set title = 'Why Shop With MinibloxRC'
where section_key = 'whyus';
