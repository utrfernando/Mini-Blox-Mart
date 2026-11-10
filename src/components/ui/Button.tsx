import React from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'sunshine' | 'lavender' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary', size = 'md', loading, className, children, disabled, ...props
}) => {
  const base = 'inline-flex items-center justify-center gap-2 rounded-full font-bold transition-all duration-200 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';
  const variants = {
    primary: 'bg-mint-500 text-white hover:bg-mint-600 shadow-soft',
    sunshine: 'bg-sunshine-400 text-ink-900 hover:bg-sunshine-300 shadow-playful',
    lavender: 'bg-lavender-400 text-white hover:bg-lavender-500 shadow-soft',
    secondary: 'bg-cream-200 text-ink-900 hover:bg-cream-300',
    outline: 'border-2 border-mint-500 text-mint-700 hover:bg-mint-50',
    ghost: 'text-ink-700 hover:bg-ink-100',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  };
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-5 py-2.5 text-base', lg: 'px-7 py-3.5 text-lg' };

  return (
    <button className={cn(base, variants[variant], sizes[size], className)} disabled={disabled || loading} {...props}>
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {children}
    </button>
  );
};
