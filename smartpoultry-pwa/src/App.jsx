import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';

import Welcome from './pages/Welcome';
import Register from './pages/Register';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsAndConditions from './pages/TermsAndConditions';
import ClientLogin from './pages/ClientLogin';
import ClientApp from './ClientApp';

function PublicRoute({ children }) {
  const { token, role } = useAuth();
  if (token) {
    if (role === 'DELIVERY') return <Navigate to="/delivery/vehicle" replace />;
    if (role === 'CUSTOMER') return <Navigate to="/customer/marketplace" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <Suspense fallback={
          <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', color: '#237227', fontFamily: 'Space Grotesk, sans-serif' }}>
            Loading Smart Poultry...
          </div>
        }>
          <Routes>
            <Route path="/" element={<PublicRoute><Welcome /></PublicRoute>} />
            <Route path="/login" element={<PublicRoute><ClientLogin /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsAndConditions />} />

            {/* Role-specific separated bundles */}
            <Route path="/*" element={<ClientApp />} />
          </Routes>
        </Suspense>
      </CartProvider>
    </BrowserRouter>
  );
}
