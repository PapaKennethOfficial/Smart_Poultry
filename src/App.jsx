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

// Redirects logged-in users away from public-only pages (e.g. /login)
function PublicRoute({ children }) {
  const { token } = useAuth()
  return token ? <Navigate to="/dashboard" replace /> : children
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

        {/* Protected routes */}
        <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
        <Route path="/logbook" element={<ProtectedRoute><AppLayout><Logbook /></AppLayout></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><AppLayout><Analytics /></AppLayout></ProtectedRoute>} />
        <Route path="/deliveries" element={<ProtectedRoute><AppLayout><Deliveries /></AppLayout></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><AppLayout><Reports /></AppLayout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
