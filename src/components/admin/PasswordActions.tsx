import React, { useState } from 'react';
import { KeyRound, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';

/** "Set password" + "Email reset link" buttons for one user (admin use). */
export const PasswordActions: React.FC<{ userId: string; email: string }> = ({ userId, email }) => {
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [saving, setSaving] = useState(false);

  const sendLink = async () => {
    const { error: e } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (e) error(e.message); else success(`Reset link emailed to ${email}`);
  };

  const save = async () => {
    if (pw.length < 8) return error('Password must be at least 8 characters.');
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin-set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ userId, password: pw }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not set password.');
      success(`Password updated for ${email}`);
      setOpen(false); setPw('');
    } catch (e: any) { error(e.message); } finally { setSaving(false); }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => { setPw(''); setOpen(true); }}><KeyRound size={14} />Set</Button>
        <Button size="sm" variant="secondary" onClick={sendLink}><Send size={14} />Email link</Button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Set password">
        <p className="text-sm text-ink-600 mb-4">Set a new password for <b>{email}</b>. Share it securely, or use "Email link" so they choose their own.</p>
        <Input type="text" value={pw} onChange={e => setPw(e.target.value)} placeholder="New password (min. 8 characters)" autoComplete="off" />
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button loading={saving} onClick={save}>Save password</Button>
        </div>
      </Modal>
    </>
  );
};
