import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Logbook from './pages/Logbook'
import Analytics from './pages/Analytics'
import Deliveries from './pages/Deliveries'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsAndConditions from './pages/TermsAndConditions'
import ManagerInventory from './pages/ManagerInventory'

// New Role-Specific Pages
import VehicleVerification from './pages/VehicleVerification'
import ManagerOrders from './pages/ManagerOrders'
import VehicleRegistration from './pages/VehicleRegistration'
import AssignedDeliveries from './pages/AssignedDeliveries'
import CustomerMarketplace from './pages/CustomerMarketplace'
import CustomerOrders from './pages/CustomerOrders'

// Redirects logged-in users away from public-only pages (e.g. /login)
function PublicRoute({ children }) {
  const { token, role } = useAuth()
  if (token) {
    if (role === 'MANAGER' || role === 'ADMIN') return <Navigate to="/dashboard" replace />
    if (role === 'DELIVERY') return <Navigate to="/delivery/vehicle" replace />
    if (role === 'CUSTOMER') return <Navigate to="/customer/marketplace" replace />
    return <Navigate to="/dashboard" replace />
  }
  return children
}

function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
      <div className="main-layout">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="page-content">
          {children}
        </main>
        <footer style={{ padding: '20px', textAlign: 'center', fontSize: '0.85rem', color: '#8da58f', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
          <p>© {new Date().getFullYear()} SmartPoultry. All rights reserved.</p>
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center', gap: '15px' }}>
            <Link to="/privacy" style={{ color: '#237227', textDecoration: 'none' }}>Privacy Policy</Link>
            <Link to="/terms" style={{ color: '#237227', textDecoration: 'none' }}>Terms & Conditions</Link>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsAndConditions />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Protected routes - Manager / Common */}
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
        <Route path="/dashboard/verify-vehicles" element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}><AppLayout><VehicleVerification /></AppLayout></ProtectedRoute>} />
        <Route path="/dashboard/orders" element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}><AppLayout><ManagerOrders /></AppLayout></ProtectedRoute>} />
        <Route path="/dashboard/inventory" element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}><AppLayout><ManagerInventory /></AppLayout></ProtectedRoute>} />
        <Route path="/logbook" element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}><AppLayout><Logbook /></AppLayout></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}><AppLayout><Analytics /></AppLayout></ProtectedRoute>} />
        <Route path="/deliveries" element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}><AppLayout><Deliveries /></AppLayout></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}><AppLayout><Reports /></AppLayout></ProtectedRoute>} />
        
        {/* Settings is available to all authenticated users, so we omit allowedRoles */}
        <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />

        {/* Protected routes - Delivery */}
        <Route path="/delivery/vehicle" element={<ProtectedRoute allowedRoles={['DELIVERY']}><AppLayout><VehicleRegistration /></AppLayout></ProtectedRoute>} />
        <Route path="/delivery/orders" element={<ProtectedRoute allowedRoles={['DELIVERY']}><AppLayout><AssignedDeliveries /></AppLayout></ProtectedRoute>} />

        {/* Protected routes - Customer */}
        <Route path="/customer/marketplace" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><AppLayout><CustomerMarketplace /></AppLayout></ProtectedRoute>} />
        <Route path="/customer/orders" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><AppLayout><CustomerOrders /></AppLayout></ProtectedRoute>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
