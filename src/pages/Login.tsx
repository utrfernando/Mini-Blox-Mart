import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
type FormData = z.infer<typeof schema>;

const Login: React.FC = () => {
  const { signIn } = useAuth();
  const { error } = useToast();
  const { storeName } = useSettings();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await signIn(data.email, data.password);
      const next = params.get('next');
      navigate(next || '/account', { replace: true });
    } catch (e: any) {
      error(e?.message?.includes('Invalid') ? 'Invalid email or password.' : (e?.message || 'Sign in failed.'));
    } finally { setLoading(false); }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-14 bg-gradient-to-br from-mint-50 via-cream-50 to-sunshine-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3"><Blocks className="w-10 h-10 text-mint-500" /><span className="font-display text-3xl font-extrabold text-ink-900">{storeName}</span></div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Welcome back!</h1>
          <p className="text-ink-500 text-sm mt-1">Sign in to track orders & checkout faster</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="rounded-4xl border border-ink-100 bg-white p-7 shadow-soft space-y-4">
          <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register('email')} placeholder="you@example.com" /></Field>
          <Field label="Password" error={errors.password?.message}>
            <div className="relative">
              <Input type={showPw ? 'text' : 'password'} autoComplete="current-password" {...register('password')} placeholder="••••••••" className="pr-11" />
              <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={loading}>Sign In</Button>
          <p className="text-center text-sm text-ink-500">New here? <Link to="/register" className="font-bold text-mint-600 hover:underline">Create an account</Link></p>
        </form>
      </div>
    </div>
  );
};

export default Login;
