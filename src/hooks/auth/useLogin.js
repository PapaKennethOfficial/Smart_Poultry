import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { loginUser } from '../../api/auth'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/Toast'

/**
 * useLogin — mutation hook for POST /api/auth/login
 *
 * Usage:
 *   const { mutate: login, isPending, error } = useLogin()
 *   login({ email, password, role })
 *
 * 401/403 auth errors are surfaced via `error` for inline display.
 * Other errors fall back to a toast.
 */
export function useLogin() {
  const { setToken, setRole, setUser } = useAuth()
  const { showSuccess, showError } = useToast()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: loginUser,

    onSuccess: (data) => {
      setToken(data.token)
      if (data.role) setRole(data.role)
      if (data.user) setUser(data.user)
      showSuccess('Welcome back! Redirecting to dashboard…')
      if (data.role === 'DELIVERY') navigate('/delivery/vehicle')
      else if (data.role === 'CUSTOMER') navigate('/customer/marketplace')
      else if (data.role === 'MANAGER' || data.role === 'ADMIN') navigate('/dashboard/verify-vehicles')
      else navigate('/dashboard')
    },

    onError: (error) => {
      // Credential and selected-role errors are rendered inline by the Login form.
      const status = error?.response?.status
      if (status === 401 || status === 403) return
      const message =
        error?.response?.data?.message || 'Login failed. Please try again.'
      showError(message)
    },
  })
}
