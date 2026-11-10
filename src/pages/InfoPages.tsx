import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, MessageCircle, Send, ChevronDown } from 'lucide-react';
import { FaInstagram, FaTiktok } from 'react-icons/fa';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { Button } from '../components/ui/Button';
import { Input, Textarea, Field } from '../components/ui/Input';
import { motion, AnimatePresence } from 'framer-motion';

const PageHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="bg-gradient-to-br from-mint-100 via-cream-100 to-sunshine-100 border-b border-ink-100">
    <div className="max-w-4xl mx-auto px-4 py-14 text-center">
      <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-ink-900">{title}</h1>
      {subtitle && <p className="text-ink-600 mt-3 text-lg">{subtitle}</p>}
    </div>
  </div>
);

const Prose: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="max-w-3xl mx-auto px-4 py-12 text-ink-700 leading-relaxed space-y-4">{children}</div>
);

// ------------------------------------------------------------------
export const About: React.FC = () => {
  const { storeName, tagline } = useSettings();
  return (
    <div>
      <PageHeader title={`About ${storeName}`} subtitle={tagline} />
      <Prose>
        <p><strong>{storeName}</strong> started with a simple belief: the smallest things can bring the biggest smiles. We design and curate adorable mini building-block figures, build-it-yourself flower collections and creative gifts that spark imagination — whether you're a collector, a parent, or just someone who loves cute things.</p>
        <p>Every product in our store is hand-picked for quality, safety and that unmistakable Miniblox charm. From tiny characters you can pose and play with, to flower sets that let you craft your own bouquets — there's a little world waiting for everyone.</p>
        <p>We're proud to be a Sri Lankan brand, and we deliver our happiness island-wide with care. Thank you for being part of the {storeName} community — small things, big smiles.</p>
      </Prose>
    </div>
  );
};

// ------------------------------------------------------------------
const FAQS = [
  { q: 'How do I place an order?', a: 'Browse the shop, add items to your cart, and check out. You can pay by Cash on Delivery or Bank Transfer. You\'ll need an account to check out so we can track your order.' },
  { q: 'Which areas do you deliver to?', a: 'We deliver island-wide across Sri Lanka. Delivery charges depend on your district and order value — orders over the free-delivery threshold ship free.' },
  { q: 'How long does delivery take?', a: 'Most orders arrive within 2–5 working days. Remote areas may take a little longer. You can track your order status from your account.' },
  { q: 'What payment methods do you accept?', a: 'Cash on Delivery (pay when your order arrives) and Bank Transfer (we\'ll share account details at checkout and you can upload your receipt).' },
  { q: 'Can I return a product?', a: 'Yes — unused items in original condition can be returned within 7 days of delivery. See our Return Policy for details.' },
  { q: 'Are the products safe for children?', a: 'Our products are designed with safety in mind, but small parts may be a choking hazard for children under 3. Always supervise young children.' },
  { q: 'Do you offer gift wrapping?', a: 'Gift-ready packaging is available on request — add a note at checkout and we\'ll do our best to make it extra special.' },
];

export const FAQ: React.FC = () => {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div>
      <PageHeader title="Frequently Asked Questions" subtitle="Everything you need to know" />
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-3">
        {FAQS.map((f, i) => (
          <div key={i} className="rounded-3xl border border-ink-100 bg-white overflow-hidden">
            <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between px-6 py-4 font-bold text-ink-900 text-left">
              {f.q}
              <ChevronDown size={20} className={`text-mint-600 transition-transform ${open === i ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {open === i && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <p className="px-6 pb-5 text-ink-600">{f.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
export const Contact: React.FC = () => {
  const { settings } = useSettings();
  const store = settings.store || {};
  const social = store.social || {};
  const { success, error } = useToast();
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    if (isSupabaseConfigured) {
      const { error: err } = await supabase.from('contact_messages').insert(form);
      setSending(false);
      if (err) { error('Could not send message. Please try again.'); return; }
    }
    success('Message sent! We\'ll get back to you soon.');
    setForm({ name: '', email: '', phone: '', subject: '', message: '' });
  };

  return (
    <div>
      <PageHeader title="Contact Us" subtitle="We'd love to hear from you" />
      <div className="max-w-6xl mx-auto px-4 py-12 grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {store.address && <InfoCard icon={<MapPin size={20} />} label="Visit / Post" value={store.address} />}
          {store.contact_email && <InfoCard icon={<Mail size={20} />} label="Email" value={store.contact_email} href={`mailto:${store.contact_email}`} />}
          {store.contact_phone && <InfoCard icon={<Phone size={20} />} label="Phone" value={store.contact_phone} href={`tel:${store.contact_phone}`} />}
          {store.whatsapp && <InfoCard icon={<MessageCircle size={20} />} label="WhatsApp" value={store.whatsapp} href={`https://wa.me/${store.whatsapp.replace(/\D/g, '')}`} />}
          <div className="rounded-4xl border border-ink-100 bg-white p-5 shadow-soft">
            <p className="font-display font-bold text-ink-900 mb-3">Follow the fun</p>
            <div className="flex gap-2">
              {social.instagram && <a href={social.instagram} target="_blank" rel="noreferrer" className="p-2.5 rounded-full bg-gradient-to-br from-lavender-400 to-peach-400 text-white"><FaInstagram size={17} /></a>}
              {social.tiktok && <a href={social.tiktok} target="_blank" rel="noreferrer" className="p-2.5 rounded-full bg-ink-900 text-white"><FaTiktok size={15} /></a>}
            </div>
          </div>
        </div>
        <form onSubmit={submit} className="lg:col-span-3 rounded-4xl border border-ink-100 bg-white p-6 sm:p-8 shadow-soft space-y-4">
          <h2 className="font-display text-xl font-extrabold text-ink-900">Send a Message</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Name"><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Email"><Input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Phone" className="sm:col-span-2"><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Subject" className="sm:col-span-2"><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></Field>
            <Field label="Message" className="sm:col-span-2"><Textarea required value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className="min-h-[140px]" /></Field>
          </div>
          <Button type="submit" loading={sending}><Send size={16} /> Send Message</Button>
        </form>
      </div>
    </div>
  );
};

const InfoCard: React.FC<{ icon: React.ReactNode; label: string; value: string; href?: string }> = ({ icon, label, value, href }) => {
  const inner = (
    <div className="flex items-start gap-4 rounded-4xl border border-ink-100 bg-white p-5 shadow-soft">
      <div className="w-11 h-11 rounded-2xl bg-mint-50 text-mint-600 flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <p className="text-xs font-extrabold uppercase tracking-wide text-ink-400">{label}</p>
        <p className="font-bold text-ink-900">{value}</p>
      </div>
    </div>
  );
  return href ? <a href={href} className="block hover:-translate-y-0.5 transition-transform">{inner}</a> : inner;
};

// ------------------------------------------------------------------
export const ShippingPolicy: React.FC = () => (
  <div>
    <PageHeader title="Shipping Policy" subtitle="How we get your order to you" />
    <Prose>
      <h3 className="font-display text-xl font-bold text-ink-900">Delivery Areas</h3>
      <p>We deliver across all 25 districts of Sri Lanka. Standard delivery takes <strong>2–5 working days</strong>; remote areas may take up to 7 working days.</p>
      <h3 className="font-display text-xl font-bold text-ink-900">Delivery Charges</h3>
      <p>Delivery fees are calculated at checkout based on your district. Orders above the free-delivery threshold ship <strong>free island-wide</strong>.</p>
      <h3 className="font-display text-xl font-bold text-ink-900">Order Tracking</h3>
      <p>Once your order ships you'll receive a tracking number. You can follow every step — Pending → Confirmed → Processing → Packed → Shipped → Delivered — from your account's Orders page.</p>
      <h3 className="font-display text-xl font-bold text-ink-900">Damaged or Lost Packages</h3>
      <p>If your order arrives damaged, contact us within 48 hours with photos and we'll replace or refund it. Lost parcels are covered — we investigate every case.</p>
    </Prose>
  </div>
);

export const ReturnPolicy: React.FC = () => (
  <div>
    <PageHeader title="Return Policy" subtitle="Hassle-free returns, promise" />
    <Prose>
      <h3 className="font-display text-xl font-bold text-ink-900">Return Window</h3>
      <p>You can return unused products in their original condition within <strong>7 days</strong> of delivery.</p>
      <h3 className="font-display text-xl font-bold text-ink-900">Not Eligible</h3>
      <p>Personalised items, opened craft kits where pieces are missing, and products damaged after delivery aren't eligible for return.</p>
      <h3 className="font-display text-xl font-bold text-ink-900">How to Return</h3>
      <p>Contact us via the <Link to="/contact" className="text-mint-600 font-bold underline">Contact page</Link> or WhatsApp with your order number. We'll arrange a pickup or give you a return address. Refunds are processed to your original payment method within 5–7 working days of receiving the item.</p>
    </Prose>
  </div>
);

export const PrivacyPolicy: React.FC = () => (
  <div>
    <PageHeader title="Privacy Policy" subtitle="Your data, our promise" />
    <Prose>
      <p>We collect only the information needed to process your orders: name, email, phone, delivery address and order history. Payment card details are never stored — we accept Cash on Delivery and Bank Transfer only.</p>
      <p>We never sell your data. It is used solely to fulfil orders, provide support and (with your consent) send offers you can unsubscribe from anytime.</p>
      <p>Access, correction or deletion requests can be made via our <Link to="/contact" className="text-mint-600 font-bold underline">Contact page</Link>.</p>
    </Prose>
  </div>
);

export const Terms: React.FC = () => (
  <div>
    <PageHeader title="Terms & Conditions" subtitle="The fine print, friendly version" />
    <Prose>
      <p>By shopping at Miniblox you agree to these terms. Prices are in Sri Lankan Rupees (LKR) and include applicable taxes unless stated otherwise.</p>
      <p>We make every effort to keep product information accurate, but colours may vary slightly between screens. Stock is limited — orders are confirmed subject to availability.</p>
      <p>Miniblox reserves the right to cancel orders with pricing errors, update these terms, and refuse service where necessary. Sri Lankan law governs these terms.</p>
    </Prose>
  </div>
);
