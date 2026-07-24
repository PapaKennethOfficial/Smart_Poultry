import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminRegister = lazy(() => import('./pages/AdminRegister'));
const Welcome = lazy(() => import('./pages/Welcome'));
const AdminApp = lazy(() => import('./AdminApp'));

function PublicRoute({ children }) {
  const { token, role } = useAuth();
  if (token) {
    if (role === 'MANAGER' || role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
    // Since this is admin only, if customer/delivery tries to login here, they shouldn't even be here.
    // But we'll just redirect them out or show an error.
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/admin/login" element={<PublicRoute><AdminLogin /></PublicRoute>} />
          <Route path="/admin/register" element={<PublicRoute><AdminRegister /></PublicRoute>} />
          <Route path="/login" element={<Navigate to="/admin/login" replace />} />
          
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/" element={<Welcome />} />

          {/* Role-specific separated bundles */}
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="/*" element={<Navigate to="/admin/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
