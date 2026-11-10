import React from 'react';
import { useCart } from '../contexts/CartContext';
import ProductCard from '../components/ProductCard';
import { WishlistEmpty } from '../components/ui/Feedback';

const Wishlist: React.FC = () => {
  const { wishlistItems } = useCart();

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-ink-900 mb-8">My Wishlist</h1>
      {wishlistItems.length === 0 ? (
        <WishlistEmpty />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {wishlistItems.map((i, idx) => <ProductCard key={i.product.id} product={i.product} index={idx} />)}
        </div>
      )}
    </div>
  );
};

export default Wishlist;
