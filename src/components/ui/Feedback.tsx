import React from 'react';
import { Blocks, PackageOpen, SearchX, Heart } from 'lucide-react';
import { Button } from './Button';

export const ProductImage: React.FC<{ src?: string | null; alt?: string; className?: string; iconClassName?: string }> = ({ src, alt, className = '', iconClassName = 'w-16 h-16' }) => {
  if (src) {
    return <img src={src} alt={alt || 'Product'} className={`object-cover w-full h-full ${className}`} loading="lazy" decoding="async" />;
  }
  return (
    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-mint-100 via-cream-100 to-lavender-100 ${className}`}>
      <Blocks className={`${iconClassName} text-mint-500/60`} strokeWidth={1.5} />
    </div>
  );
};

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-2xl bg-ink-100 ${className}`} />
);

export const ProductCardSkeleton: React.FC = () => (
  <div className="rounded-4xl border border-ink-100 bg-white overflow-hidden">
    <Skeleton className="aspect-square rounded-none" />
    <div className="p-4 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-6 w-1/3" />
    </div>
  </div>
);

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; message?: string; actionLabel?: string; onAction?: () => void }> = ({
  icon, title, message, actionLabel, onAction,
}) => (
  <div className="flex flex-col items-center justify-center text-center py-16 px-4">
    <div className="w-20 h-20 rounded-full bg-mint-50 flex items-center justify-center mb-4 text-mint-500">
      {icon || <PackageOpen size={36} strokeWidth={1.5} />}
    </div>
    <h3 className="font-display text-xl font-bold text-ink-900 mb-1">{title}</h3>
    {message && <p className="text-ink-500 max-w-sm mb-5">{message}</p>}
    {actionLabel && onAction && <Button onClick={onAction}>{actionLabel}</Button>}
  </div>
);

export const SearchEmpty: React.FC<{ onReset?: () => void }> = ({ onReset }) => (
  <EmptyState icon={<SearchX size={36} strokeWidth={1.5} />} title="No results found" message="Try a different search term or browse all products." actionLabel={onReset ? 'Clear filters' : undefined} onAction={onReset} />
);

export const WishlistEmpty: React.FC = () => <EmptyState icon={<Heart size={36} strokeWidth={1.5} />} title="Your wishlist is empty" message="Tap the heart on any product to save it here for later." />;
