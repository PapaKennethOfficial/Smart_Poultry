import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import ProtectedRoute from './components/ProtectedRoute'
import SplashScreen from './components/SplashScreen'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Logbook from './pages/Logbook'
import Analytics from './pages/Analytics'
import Deliveries from './pages/Deliveries'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

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
    if (role === 'MANAGER' || role === 'ADMIN') return <Navigate to="/dashboard/verify-vehicles" replace />
    if (role === 'DELIVERY') return <Navigate to="/delivery/vehicle" replace />
    if (role === 'CUSTOMER') return <Navigate to="/customer/marketplace" replace />
    return <Navigate to="/dashboard" replace />
  }
  return children
}

function AppLayout({ children }) {
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <Topbar />
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  // Show splash only once per browser session
  const [splashDone, setSplashDone] = useState(
    () => sessionStorage.getItem('sp_splash_done') === '1'
  )

  if (!splashDone) {
    return (
      <SplashScreen onComplete={() => {
        sessionStorage.setItem('sp_splash_done', '1')
        setSplashDone(true)
      }} />
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Protected routes - Manager / Common */}
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
        <Route path="/dashboard/verify-vehicles" element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}><AppLayout><VehicleVerification /></AppLayout></ProtectedRoute>} />
        <Route path="/dashboard/orders" element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}><AppLayout><ManagerOrders /></AppLayout></ProtectedRoute>} />
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
