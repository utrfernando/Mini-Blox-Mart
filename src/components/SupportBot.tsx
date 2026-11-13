import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageCircle, X, Send, Bot, Phone, ExternalLink } from 'lucide-react';
import { supabase, isSupabaseConfigured, formatCurrency, unitPrice, ORDER_STATUS_LABELS, type OrderStatus } from '../lib/supabase';
import { reply, START_CHIPS, type BotLink } from '../lib/supportBot';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';

type Msg = { id: number; from: 'bot' | 'me'; text: string; links?: BotLink[]; chips?: string[]; form?: 'human' | 'track' };

const KEY = 'minibloxrc_chat_v1';
let uid = 1;

const load = (): Msg[] | null => { try { const r = sessionStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return null; } };

/** Floating help bot: FAQ answers, order tracking, product lookup and a hand-off to the team. */
const SupportBot: React.FC = () => {
  const { storeName, currency, deliveryFee, freeDeliveryThreshold, settings } = useSettings();
  const { user } = useAuth();
  const store = settings.store || {};
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(() => load() || [{ id: uid++, from: 'bot', text: `Hi! 👋 I'm the ${storeName} helper. Ask me about orders, delivery, payments or products.`, chips: START_CHIPS }]);
  const end = useRef<HTMLDivElement>(null);
  // product pages have a sticky add-to-cart bar on phones - float above it
  const onProduct = useLocation().pathname.startsWith('/product/');

  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-40))); } catch { /* ignore */ } }, [msgs]);
  useEffect(() => { uid = Math.max(uid, ...msgs.map(m => m.id + 1)); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, open, busy]);

  const add = (m: Omit<Msg, 'id'>) => setMsgs(p => [...p, { ...m, id: uid++ }]);

  const trackOrder = async (number?: string) => {
    if (!isSupabaseConfigured || !user) { add({ from: 'bot', text: 'Please sign in first so I can find your orders.', links: [{ label: 'Sign in', to: '/login?next=/account/orders' }] }); return; }
    setBusy(true);
    let q = supabase.from('orders').select('order_number,status,payment_status,total_amount,tracking_number,placed_at').eq('user_id', user.id).order('placed_at', { ascending: false });
    q = number ? q.eq('order_number', number) : q.limit(3);
    const { data } = await q;
    setBusy(false);
    if (!data?.length) { add({ from: 'bot', text: number ? `I couldn't find ${number} on your account. Check the number, or ask our team.` : 'You have no orders yet.', chips: ['Talk to a person'] }); return; }
    data.forEach((o: any) => add({
      from: 'bot',
      text: `📦 ${o.order_number} — ${ORDER_STATUS_LABELS[o.status as OrderStatus] || o.status}\nTotal ${formatCurrency(Number(o.total_amount), currency)} · payment ${o.payment_status}${o.tracking_number ? `\nTracking no: ${o.tracking_number}` : ''}`,
      links: [{ label: 'Order details', to: '/account/orders' }],
    }));
  };

  const searchProducts = async (q: string) => {
    if (!isSupabaseConfigured) { add({ from: 'bot', text: 'Browse our full range in the shop.', links: [{ label: 'Open shop', to: '/shop' }] }); return; }
    setBusy(true);
    const words = q.split(' ').filter(Boolean).slice(0, 4);
    const safe = words.map(w => w.replace(/[%,()]/g, ''));
    const { data } = await supabase.from('products').select('id,name,selling_price,discount_price,stock_quantity')
      .eq('status', 'published').or(safe.flatMap(w => [`name.ilike.%${w}%`, `sku.ilike.%${w}%`]).join(',')).limit(40);
    setBusy(false);
    // rank by how many of the words appear in the name
    const ranked = (data || []).map((p: any) => ({ p, score: safe.filter(w => p.name.toLowerCase().includes(w.toLowerCase())).length }))
      .sort((a, b) => b.score - a.score).slice(0, 3).map(x => x.p);
    if (!ranked.length) { add({ from: 'bot', text: `I couldn't find "${q}". Try another word, or browse the shop.`, links: [{ label: 'Open shop', to: `/shop?q=${encodeURIComponent(q)}` }], chips: ['Talk to a person'] }); return; }
    ranked.forEach((p: any) => add({
      from: 'bot',
      text: `🧱 ${p.name}\n${formatCurrency(unitPrice(p), currency)} · ${p.stock_quantity > 0 ? (p.stock_quantity <= 5 ? `only ${p.stock_quantity} left` : 'in stock') : 'out of stock'}`,
      links: [{ label: 'View product', to: `/product/${p.id}` }],
    }));
  };

  const send = async (raw: string) => {
    const input = raw.trim();
    if (!input || busy) return;
    setText('');
    add({ from: 'me', text: input });
    const r = reply(input, { storeName, currency, deliveryFee, freeDeliveryThreshold, bank: settings.bank, contactPhone: store.contact_phone, signedIn: !!user });
    add({ from: 'bot', text: r.text, links: r.links, chips: r.chips });
    if (r.action === 'track') { if (r.query) await trackOrder(r.query); else add({ from: 'bot', text: 'Which order?', form: 'track' }); }
    else if (r.action === 'search' && r.query) await searchProducts(r.query);
    else if (r.action === 'human') add({ from: 'bot', text: '', form: 'human' });
  };

  const wa = (store.whatsapp || store.contact_phone || '').replace(/\D/g, '').replace(/^0/, '94');

  return (
    <>
      {open && (
        <div className={`fixed z-[80] right-3 ${onProduct ? 'bottom-44' : 'bottom-24'} sm:bottom-24 sm:right-6 w-[calc(100vw-1.5rem)] sm:w-[380px] max-h-[75vh] flex flex-col rounded-4xl bg-white border border-ink-100 shadow-soft-lg overflow-hidden`} role="dialog" aria-label="Support chat">
          <div className="flex items-center gap-3 bg-mint-500 px-4 py-3 text-white">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center"><Bot size={20} /></div>
            <div className="flex-1"><p className="font-display font-extrabold leading-tight">{storeName} Helper</p><p className="text-[11px] opacity-90">Usually replies instantly</p></div>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-white/20" aria-label="Close chat"><X size={18} /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-cream-50 min-h-[260px]">
            {msgs.map((m, i) => (
              <div key={m.id} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[86%] ${m.from === 'me' ? '' : 'space-y-1.5'}`}>
                  {m.text && <div className={`whitespace-pre-line rounded-3xl px-4 py-2 text-sm ${m.from === 'me' ? 'bg-mint-500 text-white rounded-br-lg' : 'bg-white border border-ink-100 text-ink-800 rounded-bl-lg'}`}>{m.text}</div>}
                  {m.links?.map(l => <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="inline-flex items-center gap-1 mr-1 rounded-full border border-mint-300 bg-white px-3 py-1 text-xs font-extrabold text-mint-700 hover:bg-mint-50">{l.label} <ExternalLink size={11} /></Link>)}
                  {m.form === 'human' && <HumanForm onDone={t => add({ from: 'bot', text: t })} wa={wa} defaults={{ name: user?.full_name || '', email: user?.email || '', phone: user?.phone || '' }} />}
                  {m.form === 'track' && <TrackForm onPick={n => (n ? send(n) : trackOrder())} />}
                  {m.chips && i === msgs.length - 1 && <div className="flex flex-wrap gap-1.5 pt-0.5">{m.chips.map(c => <button key={c} onClick={() => send(c)} className="rounded-full bg-mint-50 border border-mint-200 px-3 py-1 text-xs font-bold text-mint-700 hover:bg-mint-100">{c}</button>)}</div>}
                </div>
              </div>
            ))}
            {busy && <div className="text-xs text-ink-400 font-semibold px-2">typing…</div>}
            <div ref={end} />
          </div>

          <form onSubmit={e => { e.preventDefault(); send(text); }} className="flex items-center gap-2 border-t border-ink-100 bg-white p-2.5">
            <input value={text} onChange={e => setText(e.target.value)} placeholder="Type your question…" maxLength={200} className="flex-1 rounded-full border border-ink-200 px-4 py-2 text-sm focus:border-mint-400" />
            <button type="submit" disabled={!text.trim() || busy} className="w-10 h-10 rounded-full bg-mint-500 text-white flex items-center justify-center disabled:opacity-40" aria-label="Send"><Send size={17} /></button>
          </form>
        </div>
      )}

      <button onClick={() => setOpen(o => !o)} aria-label={open ? 'Close help chat' : 'Open help chat'}
        className={`fixed z-[80] right-3 sm:right-6 ${onProduct ? 'bottom-24' : 'bottom-5'} sm:bottom-5 w-14 h-14 rounded-full bg-mint-500 text-white shadow-soft-lg flex items-center justify-center hover:bg-mint-600 transition active:scale-95`}>
        {open ? <X size={24} /> : <MessageCircle size={26} />}
      </button>
    </>
  );
};

const TrackForm: React.FC<{ onPick: (n?: string) => void }> = ({ onPick }) => {
  const [v, setV] = useState('');
  return (
    <div className="rounded-3xl border border-ink-100 bg-white p-3 space-y-2">
      <input value={v} onChange={e => setV(e.target.value.toUpperCase())} placeholder="MB-250101-0001" className="w-full rounded-full border border-ink-200 px-3 py-1.5 text-sm" />
      <div className="flex gap-2">
        <button onClick={() => v.trim() && onPick(v.trim())} className="flex-1 rounded-full bg-mint-500 text-white text-xs font-extrabold py-1.5">Find this order</button>
        <button onClick={() => onPick(undefined)} className="flex-1 rounded-full border border-mint-300 text-mint-700 text-xs font-extrabold py-1.5">My latest orders</button>
      </div>
    </div>
  );
};

const HumanForm: React.FC<{ onDone: (t: string) => void; wa: string; defaults: { name: string; email: string; phone: string } }> = ({ onDone, wa, defaults }) => {
  const [f, setF] = useState({ ...defaults, message: '' });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const ok = f.name.trim() && /\S+@\S+\.\S+/.test(f.email) && f.message.trim().length > 3;

  const submit = async () => {
    if (!ok) { setErr('Please add your name, a valid email and your message.'); return; }
    setSending(true); setErr('');
    const { error } = await supabase.from('contact_messages').insert({ name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim() || null, subject: 'Chat helper request', message: f.message.trim() });
    setSending(false);
    if (error) { setErr('Could not send. Please try WhatsApp or the contact page.'); return; }
    setSent(true); onDone('Thanks! Your message is with our team — we\'ll reply by email (or phone) soon. 💚');
  };

  if (sent) return null;
  const input = 'w-full rounded-2xl border border-ink-200 px-3 py-1.5 text-sm';
  return (
    <div className="rounded-3xl border border-ink-100 bg-white p-3 space-y-2">
      <input className={input} placeholder="Your name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
      <input className={input} placeholder="Email" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
      <input className={input} placeholder="Phone (optional)" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
      <textarea className={input} rows={3} placeholder="How can we help? Include your order number if you have one." value={f.message} onChange={e => setF({ ...f, message: e.target.value })} />
      {err && <p className="text-xs font-semibold text-red-500">{err}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={sending} className="flex-1 rounded-full bg-mint-500 text-white text-xs font-extrabold py-2 disabled:opacity-50">{sending ? 'Sending…' : 'Send to our team'}</button>
        {wa && <a href={`https://wa.me/${wa}?text=${encodeURIComponent('Hi! I need help' + (f.message ? ': ' + f.message : ''))}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-mint-300 text-mint-700 text-xs font-extrabold px-3"><Phone size={12} /> WhatsApp</a>}
      </div>
    </div>
  );
};

export default SupportBot;
