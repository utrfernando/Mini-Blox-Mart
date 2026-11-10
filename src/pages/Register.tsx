import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Blocks, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import { Button } from '../components/ui/Button';
import { Input, Field } from '../components/ui/Input';

const schema = z.object({
  full_name: z.string().min(2, 'Please enter your name'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });
type FormData = z.infer<typeof schema>;

const Register: React.FC = () => {
  const { signUp } = useAuth();
  const { success, error } = useToast();
  const { storeName } = useSettings();
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await signUp(data.email, data.password, data.full_name, data.phone);
      success('Account created! Please sign in.');
      navigate('/login');
    } catch (e: any) {
      error(e?.message?.includes('already') ? 'An account with this email already exists.' : (e?.message || 'Registration failed.'));
    } finally { setLoading(false); }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-14 bg-gradient-to-br from-sunshine-50 via-cream-50 to-mint-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3"><Blocks className="w-10 h-10 text-mint-500" /><span className="font-display text-3xl font-extrabold text-ink-900">{storeName}</span></div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Join the fun!</h1>
          <p className="text-ink-500 text-sm mt-1">Create your account to order & track deliveries</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="rounded-4xl border border-ink-100 bg-white p-7 shadow-soft space-y-4">
          <Field label="Full Name" error={errors.full_name?.message}><Input {...register('full_name')} placeholder="Your name" /></Field>
          <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register('email')} placeholder="you@example.com" /></Field>
          <Field label="Phone (optional)" error={errors.phone?.message}><Input {...register('phone')} placeholder="07X XXX XXXX" /></Field>
          <Field label="Password" error={errors.password?.message}>
            <div className="relative">
              <Input type={showPw ? 'text' : 'password'} autoComplete="new-password" {...register('password')} placeholder="Min. 6 characters" className="pr-11" />
              <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
          <Field label="Confirm Password" error={errors.confirm?.message}><Input type="password" autoComplete="new-password" {...register('confirm')} placeholder="Repeat password" /></Field>
          <Button type="submit" size="lg" className="w-full" loading={loading}>Create Account</Button>
          <p className="text-center text-sm text-ink-500">Already have an account? <Link to="/login" className="font-bold text-mint-600 hover:underline">Sign in</Link></p>
        </form>
      </div>
    </div>
  );
};

export default Register;
