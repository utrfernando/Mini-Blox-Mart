// Vercel serverless function: lets an admin set a customer's password.
// Needs SUPABASE_SECRET_KEY (server-only, never prefixed with VITE_) in Vercel env vars.
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anon || !secret) return res.status(500).json({ error: 'Server is not configured (missing SUPABASE_SECRET_KEY).' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Not signed in.' });

  // Verify the caller and confirm they are an admin.
  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: who, error: whoErr } = await caller.auth.getUser(token);
  if (whoErr || !who.user) return res.status(401).json({ error: 'Invalid session.' });

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await admin.from('profiles').select('role').eq('id', who.user.id).maybeSingle();
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });

  const { userId, password } = req.body || {};
  if (typeof userId !== 'string' || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'A user and a password of at least 8 characters are required.' });
  }

  const { error } = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
