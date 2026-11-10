import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input, Field } from '../../components/ui/Input';

const profileSchema = z.object({
  full_name: z.string().min(2, 'Name is required'),
  phone: z.string().optional(),
});

const passwordSchema = z.object({
  password: z.string().min(6, 'Min. 6 characters'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });

const Profile: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const { success, error } = useToast();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const profileForm = useForm({ resolver: zodResolver(profileSchema), defaultValues: { full_name: user?.full_name || '', phone: user?.phone || '' } });
  const pwForm = useForm({ resolver: zodResolver(passwordSchema) });

  const saveProfile = async (data: any) => {
    if (!user) return;
    setSavingProfile(true);
    const { error: e } = await supabase.from('profiles').update({ full_name: data.full_name, phone: data.phone || null }).eq('id', user.id);
    setSavingProfile(false);
    if (e) error(e.message); else { success('Profile updated'); refreshProfile(); }
  };

  const changePassword = async (data: any) => {
    setSavingPw(true);
    const { error: e } = await supabase.auth.updateUser({ password: data.password });
    setSavingPw(false);
    if (e) error(e.message); else { success('Password updated'); pwForm.reset(); }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink-900">Profile</h1>

      <section className="rounded-4xl border border-ink-100 bg-white p-6 sm:p-8 shadow-soft">
        <h2 className="font-display text-lg font-extrabold text-ink-900 mb-5">Personal Details</h2>
        <form onSubmit={profileForm.handleSubmit(saveProfile)} className="grid sm:grid-cols-2 gap-4">
          <Field label="Full Name" error={profileForm.formState.errors.full_name?.message as string}><Input {...profileForm.register('full_name')} /></Field>
          <Field label="Phone"><Input {...profileForm.register('phone')} placeholder="07X XXX XXXX" /></Field>
          <Field label="Email"><Input value={user?.email || ''} disabled className="opacity-60" /></Field>
          <div className="sm:col-span-2">
            <Button type="submit" loading={savingProfile}><Save size={16} /> Save Changes</Button>
          </div>
        </form>
      </section>

      <section className="rounded-4xl border border-ink-100 bg-white p-6 sm:p-8 shadow-soft">
        <h2 className="font-display text-lg font-extrabold text-ink-900 mb-5">Change Password</h2>
        <form onSubmit={pwForm.handleSubmit(changePassword)} className="grid sm:grid-cols-2 gap-4 max-w-lg">
          <Field label="New Password" error={pwForm.formState.errors.password?.message as string} className="sm:col-span-2">
            <div className="relative">
              <Input type={showPw ? 'text' : 'password'} {...pwForm.register('password')} placeholder="Min. 6 characters" className="pr-11" />
              <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400"><Eye size={17} />{showPw ? <EyeOff size={17} className="hidden" /> : null}</button>
            </div>
          </Field>
          <Field label="Confirm Password" error={pwForm.formState.errors.confirm?.message as string} className="sm:col-span-2"><Input type="password" {...pwForm.register('confirm')} /></Field>
          <div><Button type="submit" loading={savingPw}>Update Password</Button></div>
        </form>
      </section>
    </div>
  );
};

export default Profile;
