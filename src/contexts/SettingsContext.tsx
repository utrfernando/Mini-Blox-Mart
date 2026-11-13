import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured, type WebsiteSettings, type HomepageSection, type Banner } from '../lib/supabase';

interface SettingsContextType {
  settings: WebsiteSettings;
  sections: HomepageSection[];
  banners: Banner[];
  loading: boolean;
  sectionVisible: (key: string) => boolean;
  sectionByKey: (key: string) => HomepageSection | undefined;
  storeName: string;
  tagline: string;
  currency: string;
  currencySymbol: string;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  checkoutEnabled: boolean;
  supportBotEnabled: boolean;
  checkoutMessage: string;
  refresh: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
};

const DEFAULT_SETTINGS: WebsiteSettings = {
  store: {
    store_name: 'MinibloxRC',
    tagline: 'Small Things. Big Smiles.',
    currency: 'LKR',
    currency_symbol: 'Rs.',
    delivery_fee: 250,
    free_delivery_threshold: 1500,
    contact_email: 'hello@miniblox.lk',
    contact_phone: '+94 77 000 0000',
    whatsapp: '+94 77 000 0000',
    address: 'Colombo, Sri Lanka',
    social: { instagram: 'https://instagram.com/miniblox', tiktok: 'https://tiktok.com/@miniblox' },
  },
  bank: { bank_name: '', account_name: '', account_number: '', branch: '', instructions: '' },
  branding: { logo_url: '', favicon_url: '', primary_color: '#14b8a6', secondary_color: '#f59e0b', font: 'Nunito' },
};

// Settings, homepage sections and banners rarely change, so keep a copy in the browser.
// Visitors see the page instantly and we skip 3 database calls on most page loads.
const CACHE_KEY = 'minibloxrc_settings_v1';
const CACHE_TTL_MS = 5 * 60 * 1000;
type Cached = { t: number; settings: WebsiteSettings; sections: HomepageSection[]; banners: Banner[] };
const readCache = (): Cached | null => {
  try { const raw = localStorage.getItem(CACHE_KEY); return raw ? (JSON.parse(raw) as Cached) : null; } catch { return null; }
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cached = React.useRef(readCache()).current;
  const [settings, setSettings] = useState<WebsiteSettings>(cached?.settings || DEFAULT_SETTINGS);
  const [sections, setSections] = useState<HomepageSection[]>(cached?.sections || []);
  const [banners, setBanners] = useState<Banner[]>(cached?.banners || []);
  const [loading, setLoading] = useState(!cached);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    const [s, sec, ban] = await Promise.all([
      supabase.from('website_settings').select('setting_key, setting_value'),
      supabase.from('homepage_sections').select('*').order('sort_order'),
      supabase.from('banners').select('*').eq('is_active', true).order('sort_order'),
    ]);
    if (s.data?.length) {
      const merged: WebsiteSettings = { ...DEFAULT_SETTINGS };
      for (const row of s.data) {
        (merged as any)[row.setting_key] = row.setting_value;
      }
      setSettings(merged);
    }
    if (sec.data) setSections(sec.data as HomepageSection[]);
    if (ban.data) setBanners(ban.data as Banner[]);
    setLoading(false);
    try {
      if (s.data?.length && sec.data && ban.data) {
        const merged: WebsiteSettings = { ...DEFAULT_SETTINGS };
        for (const row of s.data) (merged as any)[row.setting_key] = row.setting_value;
        localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), settings: merged, sections: sec.data, banners: ban.data }));
      }
    } catch { /* storage full or blocked - fine */ }
  }, []);

  // Fresh cache -> no network call. Admin pages call refresh() after saving, which always fetches.
  useEffect(() => { if (!cached || Date.now() - cached.t > CACHE_TTL_MS) refresh(); else setLoading(false); }, [refresh, cached]);

  // Tab icon: admin-uploaded favicon (Admin > Website > Branding) overrides the built-in one.
  const faviconUrl = settings.branding?.favicon_url;
  useEffect(() => {
    if (!faviconUrl) return;
    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]').forEach(l => { l.href = faviconUrl; l.removeAttribute('type'); });
  }, [faviconUrl]);

  const sectionByKey = (key: string) => sections.find(s => s.section_key === key);
  const sectionVisible = (key: string) => sectionByKey(key)?.is_visible !== false;

  const store = settings.store || {};
  const value: SettingsContextType = {
    settings, sections, banners, loading, sectionVisible, sectionByKey,
    storeName: store.store_name || 'MinibloxRC',
    tagline: store.tagline || 'Small Things. Big Smiles.',
    currency: store.currency || 'LKR',
    currencySymbol: store.currency_symbol || 'Rs.',
    deliveryFee: Number(store.delivery_fee ?? 250),
    freeDeliveryThreshold: Number(store.free_delivery_threshold ?? 1500),
    checkoutEnabled: store.checkout_enabled !== false,
    supportBotEnabled: store.support_bot_enabled !== false,
    checkoutMessage: store.checkout_message || 'Checkout is temporarily paused. Please check back soon.',
    refresh,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};
