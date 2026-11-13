import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { ToastProvider } from './contexts/ToastContext';
import StoreLayout from './components/layout/StoreLayout';
import Home from './pages/Home';

// Everything except the home page is loaded on demand, so first visits download far less code.
const AdminLayout = lazy(() => import('./components/layout/AdminLayout'));
const AccountLayout = lazy(() => import('./pages/account/AccountLayout'));
const Shop = lazy(() => import('./pages/Shop'));
const ProductDetails = lazy(() => import('./pages/ProductDetails'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Profile = lazy(() => import('./pages/account/Profile'));
const Orders = lazy(() => import('./pages/account/Orders'));
const OrderDetail = lazy(() => import('./pages/account/OrderDetail'));
const Addresses = lazy(() => import('./pages/account/Addresses'));
const named = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, key: K) => lazy(() => load().then(m => ({ default: m[key] })));
const Contact = named(() => import('./pages/InfoPages'), 'Contact');
const About = named(() => import('./pages/InfoPages'), 'About');
const FAQ = named(() => import('./pages/InfoPages'), 'FAQ');
const ShippingPolicy = named(() => import('./pages/InfoPages'), 'ShippingPolicy');
const ReturnPolicy = named(() => import('./pages/InfoPages'), 'ReturnPolicy');
const PrivacyPolicy = named(() => import('./pages/InfoPages'), 'PrivacyPolicy');
const Terms = named(() => import('./pages/InfoPages'), 'Terms');

const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'));
const AdminInventory = lazy(() => import('./pages/admin/AdminInventory'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers'));
const AdminDiscounts = lazy(() => import('./pages/admin/AdminDiscounts'));
const AdminPromotions = lazy(() => import('./pages/admin/AdminPromotions'));
const AdminMessages = lazy(() => import('./pages/admin/AdminMessages'));
const AdminWebsite = lazy(() => import('./pages/admin/AdminWebsite'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminFinance = lazy(() => import('./pages/admin/AdminFinance'));

const PageLoading: React.FC = () => <div className="flex-1 flex items-center justify-center py-32 text-ink-400 font-bold">Loading…</div>;

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
    case 'users': return <AdminUsers />;
    case 'finance': return <AdminFinance />;
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
              <Suspense fallback={<PageLoading />}>
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
                  <Route path="/reset-password" element={<ResetPassword />} />
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
              </Suspense>
            </Router>
          </ToastProvider>
        </CartProvider>
      </SettingsProvider>
    </AuthProvider>
  );
};

export default App;
