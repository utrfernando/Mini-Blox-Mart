import { formatCurrency } from './supabase';

export type BotLink = { label: string; to: string };
export type BotReply = {
  text: string;
  links?: BotLink[];
  chips?: string[];
  /** extra UI the widget should open */
  action?: 'track' | 'human' | 'search';
  /** product words to look up (action === 'search') */
  query?: string;
};

export type BotContext = {
  storeName: string;
  currency: string;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  bank?: { bank_name?: string; account_name?: string; account_number?: string; branch?: string; instructions?: string };
  contactPhone?: string;
  signedIn: boolean;
};

export const ORDER_NO = /\bMB-\d{6}-\d{4}\b/i;

export const START_CHIPS = ['Track my order', 'Delivery & shipping', 'Payment methods', 'Returns & refunds', 'Find a product', 'Talk to a person'];

const has = (t: string, words: string[]) => words.some(w => t.includes(w));
const STOP = new Set(['do', 'you', 'have', 'any', 'the', 'a', 'an', 'is', 'are', 'there', 'i', 'want', 'need', 'looking', 'for', 'to', 'buy', 'get', 'show', 'me', 'find', 'search', 'price', 'of', 'how', 'much', 'does', 'cost', 'in', 'stock', 'available', 'please', 'can', 'u', 'ur', 'your', 'what', 'about', 'with', 'and', 'or', 'some', 'my', 'it', 'this', 'that']);

/** The words left after removing filler - used to look the product up. */
export const productWords = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP.has(w)).join(' ').trim();

/** Decide what to say. Pure function: no network, easy to extend. */
export function reply(input: string, c: BotContext): BotReply {
  const t = input.toLowerCase().trim();
  const money = (n: number) => formatCurrency(n, c.currency);

  if (!t) return { text: 'Type a question and I\'ll do my best to help!', chips: START_CHIPS };

  if (ORDER_NO.test(input)) return { text: 'Let me look that order up…', action: 'track', query: input.match(ORDER_NO)![0].toUpperCase() };

  if (/^(hi+|hello+|hey+|hola|good (morning|afternoon|evening)|ayubowan)\b/.test(t) && t.length < 25)
    return { text: `Hi there! 👋 I'm the ${c.storeName} helper. What can I do for you?`, chips: START_CHIPS };

  if (has(t, ['thank', 'thanks', 'thx', 'ty '])) return { text: 'You\'re welcome! 😊 Anything else I can help with?', chips: START_CHIPS };

  if (has(t, ['human', 'agent', 'person', 'someone', 'staff', 'representative', 'speak to', 'talk to', 'call me', 'complaint', 'contact']))
    return { text: 'Of course! Leave your details and our team will get back to you, or message us on WhatsApp for the quickest reply.', action: 'human' };

  if (has(t, ['track', 'where is my', 'order status', 'my order', 'parcel', 'tracking', 'delivered yet', 'not received', 'haven\'t received']))
    return c.signedIn
      ? { text: 'Sure! Type your order number (like MB-250101-0001) or choose below.', action: 'track' }
      : { text: 'I can check your order once you\'re signed in. If you have your order number (MB-…), you can also ask our team directly.', links: [{ label: 'Sign in', to: '/login?next=/account/orders' }], action: 'human' };

  if (has(t, ['return', 'refund', 'exchange', 'replace', 'damaged', 'broken', 'wrong item', 'faulty', 'money back']))
    return { text: 'Unused items in original condition can be returned within 7 days of delivery. If something arrived damaged, contact us within 48 hours with photos and we\'ll replace or refund it. Refunds take 5–7 working days after we receive the item.', links: [{ label: 'Return policy', to: '/return-policy' }], action: 'human' };

  if (has(t, ['deliver', 'shipping', 'ship', 'courier', 'how long', 'days', 'arrive', 'postage', 'delivery fee', 'delivery charge', 'free delivery']))
    return { text: `We deliver island-wide. Most orders arrive in 2–5 working days (remote areas up to 7). Delivery is ${money(c.deliveryFee)}, and free for orders over ${money(c.freeDeliveryThreshold)}.`, links: [{ label: 'Shipping policy', to: '/shipping-policy' }], chips: ['Track my order', 'Payment methods'] };

  if (has(t, ['pay', 'payment', 'cod', 'cash on', 'bank', 'transfer', 'card', 'visa', 'account number', 'koko', 'paypal'])) {
    const b = c.bank;
    const bank = b?.account_number ? ` For bank transfer: ${[b.bank_name, b.account_name, b.account_number, b.branch].filter(Boolean).join(' · ')}.${b.instructions ? ' ' + b.instructions : ''}` : ' Bank details are shown at checkout.';
    return { text: `We accept Cash on Delivery and Bank Transfer (no card payments online).${bank}`, chips: ['Delivery & shipping', 'Returns & refunds'] };
  }

  if (has(t, ['discount', 'coupon', 'promo', 'voucher', 'offer', 'sale', 'code']))
    return { text: 'Have a discount code? Enter it in your cart before checking out. Check the home page banners and the shop for current offers.', links: [{ label: 'Open cart', to: '/cart' }, { label: 'Browse shop', to: '/shop' }] };

  if (has(t, ['safe', 'child', 'kid', 'age', 'choking', 'toddler', 'baby']))
    return { text: 'Our products are designed with safety in mind, but small parts can be a choking hazard for children under 3. Please supervise young children.', links: [{ label: 'FAQ', to: '/faq' }] };

  if (has(t, ['gift', 'wrap', 'present', 'birthday']))
    return { text: 'Gift-ready packaging is available on request — add a note at checkout and we\'ll do our best to make it special. 🎁' };

  if (has(t, ['password', 'login', 'log in', 'sign in', 'sign up', 'register', 'account', 'forgot']))
    return { text: 'You can sign up or sign in from the top of the page. If you can\'t get into your account or forgot your password, leave us a message and we\'ll send you a reset link.', links: [{ label: 'Sign in', to: '/login' }, { label: 'Create account', to: '/register' }], action: 'human' };

  if (has(t, ['how to order', 'how do i order', 'place an order', 'how to buy', 'checkout']))
    return { text: 'Add items to your cart, then check out (you\'ll need an account so we can track your order). Pay by Cash on Delivery or Bank Transfer.', links: [{ label: 'Browse shop', to: '/shop' }, { label: 'Create account', to: '/register' }] };

  if (has(t, ['whatsapp', 'phone', 'number', 'call', 'email', 'address', 'location', 'where are you', 'open']))
    return { text: `You can reach us on ${c.contactPhone || 'WhatsApp'} or through the contact form.`, links: [{ label: 'Contact page', to: '/contact' }], action: 'human' };

  // Anything else: maybe they're naming a product.
  const q = productWords(input);
  if (q.length >= 2 || has(t, ['product', 'toy', 'stock', 'available', 'price', 'cost', 'how much', 'have']))
    return { text: q ? `Let me check our shop for "${q}"…` : 'What product are you looking for? Type its name, e.g. "RC crawler" or "flower set".', action: q ? 'search' : undefined, query: q };

  return { text: 'Sorry, I didn\'t catch that. Try one of these, or I can pass you to our team.', chips: START_CHIPS };
}
