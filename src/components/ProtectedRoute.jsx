import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { token, role } = useAuth()
  const location = useLocation()

  if (!token) {
    // Preserve the page the user tried to visit so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // User is logged in but does not have the required role
    if (role === 'MANAGER' || role === 'ADMIN') return <Navigate to="/dashboard/verify-vehicles" replace />
    if (role === 'DELIVERY') return <Navigate to="/delivery/vehicle" replace />
    if (role === 'CUSTOMER') return <Navigate to="/customer/marketplace" replace />
    return <Navigate to="/login" replace />
  }

  return children
}
