import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';

const Welcome = lazy(() => import('./pages/Welcome'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions'));
const AdminApp = lazy(() => import('./AdminApp'));
const ClientApp = lazy(() => import('./ClientApp'));

// Post-login destination per role — kept in sync with useLogin.js and
// pages/Login.jsx so the same map governs redirects everywhere.
const ROLE_HOME = {
  MANAGER: '/admin/dashboard',
  ADMIN: '/admin/dashboard',
  CUSTOMER: '/customer/marketplace',
  DELIVERY: '/delivery/vehicle',
};

// If the user is already signed in, bounce them out of /login|/register|/
// straight into their role's home. Prevents a logged-in manager from
// accidentally landing on the customer marketplace.
function PublicRoute({ children }) {
  const { token, role } = useAuth();
  if (token && role && ROLE_HOME[role]) {
    return <Navigate to={ROLE_HOME[role]} replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <Suspense fallback={
          <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', color: '#237227', fontFamily: 'Space Grotesk, sans-serif' }}>
            Loading SmartPoultry…
          </div>
        }>
          <Routes>
            {/* Public entry points */}
            <Route path="/" element={<PublicRoute><Welcome /></PublicRoute>} />
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsAndConditions />} />

            {/* Back-compat aliases from the pre-reunification split */}
            <Route path="/admin/login" element={<Navigate to="/login" replace />} />
            <Route path="/admin/register" element={<Navigate to="/register" replace />} />

            {/* Manager area — role-guarded inside AdminApp */}
            <Route path="/admin/*" element={<AdminApp />} />

            {/* Customer + Delivery area — role-guarded inside ClientApp.
                Catches /customer/*, /delivery/*, /settings, and anything else. */}
            <Route path="/*" element={<ClientApp />} />
          </Routes>
        </Suspense>
      </CartProvider>
    </BrowserRouter>
  );
}
