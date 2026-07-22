import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { registerUser } from '../../api/auth'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/Toast'

/**
 * useRegister — mutation hook for POST /api/auth/register
 *
 * Usage:
 *   const { mutate: register, isPending, error } = useRegister()
 *   register({ name, email, password, role })
 *
 * On success → auto-login and redirect to role-specific dashboard.
 * Field/validation errors are surfaced via `error` for inline display.
 */
export function useRegister() {
  const { setToken, setRole, setUser } = useAuth()
  const { showSuccess, showError } = useToast()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: registerUser,

    onSuccess: (data) => {
      // Auto-login: set token, role and user from registration response
      if (data.token) {
        setToken(data.token)
        if (data.role) setRole(data.role)
        if (data.user) setUser(data.user)
        showSuccess('Account created — welcome to SmartPoultry!')

        // Redirect based on role
        if (data.role === 'DELIVERY') navigate('/delivery/vehicle')
        else if (data.role === 'CUSTOMER') navigate('/customer/marketplace')
        else if (data.role === 'MANAGER' || data.role === 'ADMIN') navigate('/dashboard')
        else navigate('/dashboard')
      } else {
        // Fallback: redirect to login if no token returned
        showSuccess('Account created — please sign in')
        navigate('/login')
      }
    },

    onError: (error) => {
      // 400 (Zod), 403 (role/access code), and 409 (duplicate email) are rendered inline by the form.
      const status = error?.response?.status
      if (status === 400 || status === 403 || status === 409) return
      const message =
        error?.response?.data?.message || 'Sign up failed. Please try again.'
      showError(message)
    },
  })
}
