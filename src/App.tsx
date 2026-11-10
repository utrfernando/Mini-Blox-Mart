import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { ToastProvider } from './contexts/ToastContext';
import StoreLayout from './components/layout/StoreLayout';
import AdminLayout from './components/layout/AdminLayout';
import AccountLayout from './pages/account/AccountLayout';

import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Wishlist from './pages/Wishlist';
import Login from './pages/Login';
import Register from './pages/Register';
import { Contact, About, FAQ, ShippingPolicy, ReturnPolicy, PrivacyPolicy, Terms } from './pages/InfoPages';
import Profile from './pages/account/Profile';
import Orders from './pages/account/Orders';
import OrderDetail from './pages/account/OrderDetail';
import Addresses from './pages/account/Addresses';

import AdminOverview from './pages/admin/AdminOverview';
import AdminProducts from './pages/admin/AdminProducts';
import AdminCategories from './pages/admin/AdminCategories';
import AdminInventory from './pages/admin/AdminInventory';
import AdminOrders from './pages/admin/AdminOrders';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminDiscounts from './pages/admin/AdminDiscounts';
import AdminPromotions from './pages/admin/AdminPromotions';
import AdminMessages from './pages/admin/AdminMessages';
import AdminWebsite from './pages/admin/AdminWebsite';
import AdminSettings from './pages/admin/AdminSettings';

// ------------------------------------------------------------------
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex-1 flex items-center justify-center py-32 text-ink-400 font-bold">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="flex-1 flex items-center justify-center py-32 text-ink-400 font-bold">Loading…</div>;
  if (!user) return <Navigate to="/login?next=/admin" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AdminSection: React.FC = () => {
  const { '*': splat = '' } = useParams();
  const section = splat.split('/')[0];
  switch (section) {
    case 'products': return <AdminProducts />;
    case 'categories': return <AdminCategories />;
    case 'inventory': return <AdminInventory />;
    case 'orders': return <AdminOrders />;
    case 'customers': return <AdminCustomers />;
    case 'discounts': return <AdminDiscounts />;
    case 'promotions': return <AdminPromotions />;
    case 'messages': return <AdminMessages />;
    case 'website': return <AdminWebsite />;
    case 'settings': return <AdminSettings />;
    default: return <AdminOverview />;
  }
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <SettingsProvider>
        <CartProvider>
          <ToastProvider>
            <Router>
              <Routes>
                <Route element={<StoreLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/shop" element={<Shop />} />
                  <Route path="/product/:id" element={<ProductDetails />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
                  <Route path="/wishlist" element={<Wishlist />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/faq" element={<FAQ />} />
                  <Route path="/shipping-policy" element={<ShippingPolicy />} />
                  <Route path="/return-policy" element={<ReturnPolicy />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                  <Route path="/terms" element={<Terms />} />

                  <Route path="/account" element={<RequireAuth><AccountLayout /></RequireAuth>}>
                    <Route index element={<Profile />} />
                    <Route path="orders" element={<Orders />} />
                    <Route path="orders/:id" element={<OrderDetail />} />
                    <Route path="addresses" element={<Addresses />} />
                  </Route>
                </Route>

                <Route path="/admin/*" element={
                  <RequireAdmin>
                    <AdminLayout />
                  </RequireAdmin>
                }>
                  <Route index element={<AdminOverview />} />
                  <Route path="*" element={<AdminSection />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Router>
          </ToastProvider>
        </CartProvider>
      </SettingsProvider>
    </AuthProvider>
  );
};

export default App;
