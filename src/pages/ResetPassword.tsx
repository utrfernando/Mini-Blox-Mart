import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Blocks } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { Button } from '../components/ui/Button';
import { Input, Field } from '../components/ui/Input';

const ResetPassword: React.FC = () => {
  const { success, error } = useToast();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // The emailed link signs the user in with a recovery session.
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setReady(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return error('Password must be at least 8 characters.');
    if (pw !== confirm) return error('Passwords do not match.');
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (err) return error(err.message);
    success('Password updated. Please sign in.');
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-14 bg-gradient-to-br from-sunshine-50 via-cream-50 to-mint-50">
      <div className="w-full max-w-md rounded-4xl border border-ink-100 bg-white p-8 shadow-soft">
        <div className="flex items-center gap-2 mb-4"><Blocks className="w-8 h-8 text-mint-500" /><h1 className="font-display text-2xl font-extrabold text-ink-900">Set a new password</h1></div>
        {!ready ? (
          <p className="text-sm text-ink-500">This link is invalid or has expired. Ask the store for a new reset link, or <Link to="/login" className="text-mint-700 font-bold">go to sign in</Link>.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label="New password"><Input type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" /></Field>
            <Field label="Confirm password"><Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" /></Field>
            <Button type="submit" loading={saving} className="w-full">Update password</Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
