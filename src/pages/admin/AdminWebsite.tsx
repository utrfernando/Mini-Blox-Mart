import React, { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Eye, EyeOff, Save, Palette } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { optimizeImage, IMAGE_CACHE } from '../../lib/image';
import { type HomepageSection, type WebsiteSettings } from '../../lib/supabase';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { AdminHeader } from '../../components/admin/ui';
import { Button } from '../../components/ui/Button';
import { Input, Field } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { cn } from '../../lib/utils';

const SECTION_LABELS: Record<string, string> = {
  hero: 'Hero Banner', categories: 'Shop by Category', featured: 'Featured Products',
  bestsellers: 'Best Sellers', newarrivals: 'New Arrivals', promo: 'Promo Banners',
  whyus: 'Why Shop With Us', testimonials: 'Testimonials', newsletter: 'Newsletter Signup',
};

const AdminWebsite: React.FC = () => {
  const { refresh } = useSettings();
  const { authUserId } = useAuth();
  const { success, error } = useToast();
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [branding, setBranding] = useState<WebsiteSettings['branding']>({});
  const [savingBranding, setSavingBranding] = useState(false);
  const [uploading, setUploading] = useState<'logo_url' | 'favicon_url' | null>(null);

  const uploadBrand = async (key: 'logo_url' | 'favicon_url', file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return error('Please choose an image file.');
    setUploading(key);
    try {
      const img = key === 'logo_url' ? await optimizeImage(file, 600) : { blob: file as Blob, ext: file.name.split('.').pop() || 'png', type: file.type };
      const path = `branding/${key}-${Date.now()}.${img.ext}`;
      const { error: e } = await supabase.storage.from('products').upload(path, img.blob, { upsert: true, contentType: img.type, cacheControl: IMAGE_CACHE });
      if (e) throw e;
      const url = supabase.storage.from('products').getPublicUrl(path).data.publicUrl;
      setBranding(b => ({ ...b, [key]: url }));
      success('Uploaded. Press Save Branding to apply.');
    } catch (e: any) { error(e.message || 'Upload failed'); }
    setUploading(null);
  };

  const load = async () => {
    const [s, b] = await Promise.all([
      supabase.from('homepage_sections').select('*').order('sort_order'),
      supabase.from('website_settings').select('setting_value').eq('setting_key', 'branding').maybeSingle(),
    ]);
    setSections((s.data || []) as HomepageSection[]);
    if (b.data?.setting_value) setBranding(b.data.setting_value);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (s: HomepageSection) => {
    await supabase.from('homepage_sections').update({ is_visible: !s.is_visible }).eq('id', s.id);
    setSections(sections.map(x => x.id === s.id ? { ...x, is_visible: !x.is_visible } : x));
    refresh();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= sections.length) return;
    const a = sections[idx], b = sections[j];
    await Promise.all([
      supabase.from('homepage_sections').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('homepage_sections').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    const next = [...sections];
    [next[idx], next[j]] = [next[j], next[idx]];
    setSections(next); refresh();
  };

  const saveSection = async (s: HomepageSection) => {
    await supabase.from('homepage_sections').update({ title: s.title, subtitle: s.subtitle }).eq('id', s.id);
    success('Section updated'); refresh();
  };

  const saveBranding = async () => {
    setSavingBranding(true);
    const { error: e } = await supabase.from('website_settings').upsert({
      setting_key: 'branding', setting_value: branding, updated_by: authUserId,
    }, { onConflict: 'setting_key' });
    setSavingBranding(false);
    if (e) error(e.message); else { success('Branding saved'); refresh(); }
  };

  return (
    <div className="space-y-8">
      <AdminHeader title="Website Customization" subtitle="Control homepage content & branding — no code needed" />

      {/* Homepage sections */}
      <section className="rounded-4xl border border-ink-100 bg-white p-6 shadow-soft">
        <h2 className="font-display text-lg font-extrabold text-ink-900 mb-1">Homepage Sections</h2>
        <p className="text-sm text-ink-500 mb-5">Toggle visibility, reorder and retitle sections.</p>
        <div className="space-y-3">
          {sections.map((s, i) => (
            <div key={s.id} className={cn('flex flex-wrap items-center gap-3 rounded-3xl border p-4', s.is_visible ? 'border-ink-100' : 'border-ink-100 bg-ink-50/50 opacity-70')}>
              <div className="flex flex-col gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded-lg hover:bg-ink-100 disabled:opacity-30"><ArrowUp size={15} /></button>
                <button onClick={() => move(i, 1)} disabled={i === sections.length - 1} className="p-1 rounded-lg hover:bg-ink-100 disabled:opacity-30"><ArrowDown size={15} /></button>
              </div>
              <div className="flex-1 min-w-[200px]">
                <p className="font-bold text-ink-900 text-sm">{SECTION_LABELS[s.section_key] || s.section_key}</p>
                <div className="flex gap-2 mt-1.5">
                  <Input defaultValue={s.title || ''} placeholder="Section title" className="!py-1.5 text-xs flex-1" onBlur={e => { const v = e.target.value; if (v !== s.title) { const upd = { ...s, title: v }; setSections(sections.map(x => x.id === s.id ? upd : x)); saveSection(upd); } }} />
                  <Input defaultValue={s.subtitle || ''} placeholder="Subtitle" className="!py-1.5 text-xs flex-1" onBlur={e => { const v = e.target.value; if (v !== s.subtitle) { const upd = { ...s, subtitle: v }; setSections(sections.map(x => x.id === s.id ? upd : x)); saveSection(upd); } }} />
                </div>
              </div>
              <button onClick={() => toggle(s)} className="p-2.5 rounded-2xl hover:bg-ink-100 text-ink-500">
                {s.is_visible ? <Eye size={18} className="text-mint-600" /> : <EyeOff size={18} />}
              </button>
              <Badge color={s.is_visible ? 'green' : 'ink'}>{s.is_visible ? 'Visible' : 'Hidden'}</Badge>
            </div>
          ))}
        </div>
      </section>

      {/* Branding */}
      <section className="rounded-4xl border border-ink-100 bg-white p-6 shadow-soft">
        <h2 className="font-display text-lg font-extrabold text-ink-900 mb-1 flex items-center gap-2"><Palette size={20} className="text-lavender-500" /> Branding</h2>
        <p className="text-sm text-ink-500 mb-5">Logo, colours and fonts applied across the store.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Logo (header)">
            <div className="flex items-center gap-3">
              {branding?.logo_url && <img src={branding.logo_url} alt="" className="h-11 max-w-[120px] rounded-xl border border-ink-100 object-contain bg-white" />}
              <label className="inline-flex items-center rounded-full border border-ink-200 px-4 py-2 text-xs font-extrabold text-ink-700 cursor-pointer hover:border-mint-400">
                {uploading === 'logo_url' ? 'Uploading…' : 'Upload image'}
                <input type="file" accept="image/*" className="hidden" onChange={e => { uploadBrand('logo_url', e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              {branding?.logo_url && <button type="button" onClick={() => setBranding({ ...branding, logo_url: '' })} className="text-xs font-bold text-red-500 hover:underline">Remove</button>}
            </div>
          </Field>
          <Field label="Tab icon (favicon)" hint="Square PNG/SVG, at least 64×64. Leave empty to use the default MinibloxRC icon.">
            <div className="flex items-center gap-3">
              <img src={branding?.favicon_url || '/brand/favicon.png'} alt="" className="w-11 h-11 rounded-xl border border-ink-100 object-cover bg-white" />
              <label className="inline-flex items-center rounded-full border border-ink-200 px-4 py-2 text-xs font-extrabold text-ink-700 cursor-pointer hover:border-mint-400">
                {uploading === 'favicon_url' ? 'Uploading…' : 'Upload image'}
                <input type="file" accept="image/*" className="hidden" onChange={e => { uploadBrand('favicon_url', e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              {branding?.favicon_url && <button type="button" onClick={() => setBranding({ ...branding, favicon_url: '' })} className="text-xs font-bold text-red-500 hover:underline">Use default</button>}
            </div>
          </Field>
          <Field label="Primary Colour"><div className="flex gap-2"><input type="color" value={branding?.primary_color || '#14b8a6'} onChange={e => setBranding({ ...branding, primary_color: e.target.value })} className="w-12 h-11 rounded-xl border border-ink-100 cursor-pointer" /><Input value={branding?.primary_color || ''} onChange={e => setBranding({ ...branding, primary_color: e.target.value })} /></div></Field>
          <Field label="Accent Colour"><div className="flex gap-2"><input type="color" value={branding?.secondary_color || '#f59e0b'} onChange={e => setBranding({ ...branding, secondary_color: e.target.value })} className="w-12 h-11 rounded-xl border border-ink-100 cursor-pointer" /><Input value={branding?.secondary_color || ''} onChange={e => setBranding({ ...branding, secondary_color: e.target.value })} /></div></Field>
          <Field label="Font"><Input value={branding?.font || 'Nunito'} onChange={e => setBranding({ ...branding, font: e.target.value })} placeholder="Nunito / Quicksand / Baloo 2" /></Field>
        </div>
        <div className="mt-4"><Button onClick={saveBranding} loading={savingBranding}><Save size={16} /> Save Branding</Button></div>
      </section>

      {/* Navigation note */}
      <section className="rounded-4xl border border-ink-100 bg-white p-6 shadow-soft">
        <h2 className="font-display text-lg font-extrabold text-ink-900 mb-2">Navigation & Footer</h2>
        <p className="text-sm text-ink-500">The main menu is generated from your active categories plus Shop All / New / Best Sellers. Footer links are managed in <strong>Store Settings → Contact & Social</strong>. Banners & promos live under <strong>Promotions</strong>.</p>
      </section>
    </div>
  );
};

export default AdminWebsite;
