import { lazy, Suspense, useCallback, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import SplashScreen from './components/SplashScreen';

// Once per browser session, not once per page load: the intro plays when
// someone opens the app, but a refresh or a return from a background tab does
// not make them sit through it again. sessionStorage rather than localStorage
// so a fresh tab (a demo, a defence) always gets the full opening.
const SPLASH_KEY = 'smartpoultry_splash_seen';

function splashAlreadySeen() {
  try {
    return sessionStorage.getItem(SPLASH_KEY) === '1';
  } catch {
    // Storage blocked (private mode, policy) — show it and move on rather
    // than throwing during the very first render.
    return false;
  }
}

const Welcome = lazy(() => import('./pages/Welcome'));
const Register = lazy(() => import('./pages/Register'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions'));
const ClientLogin = lazy(() => import('./pages/ClientLogin'));
const ClientApp = lazy(() => import('./ClientApp'));

function PublicRoute({ children }) {
  const { token, role } = useAuth();
  if (token) {
    if (role === 'DELIVERY') return <Navigate to="/delivery/vehicle" replace />;
    if (role === 'CUSTOMER') return <Navigate to="/customer/marketplace" replace />;
  }
  return children;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(() => !splashAlreadySeen());

  const dismissSplash = useCallback(() => {
    try {
      sessionStorage.setItem(SPLASH_KEY, '1');
    } catch { /* nothing to do — worst case it plays again next load */ }
    setShowSplash(false);
  }, []);

  return (
    <BrowserRouter>
      {showSplash && <SplashScreen onComplete={dismissSplash} />}
      <CartProvider>
        <Suspense fallback={null}>
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
