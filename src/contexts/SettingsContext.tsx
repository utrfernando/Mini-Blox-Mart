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

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<WebsiteSettings>(DEFAULT_SETTINGS);
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

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
    checkoutMessage: store.checkout_message || 'Checkout is temporarily paused. Please check back soon.',
    refresh,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};
