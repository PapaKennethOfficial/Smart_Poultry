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
 *   login({ email, password })
 *
 * 401 (invalid credentials) is surfaced via `error` for inline display.
 * Non-401 errors fall back to a toast.
 */
export function useLogin() {
  const { setToken, setRole } = useAuth()
  const { showSuccess, showError } = useToast()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: loginUser,

    onSuccess: (data) => {
      setToken(data.token)
      if (data.role) setRole(data.role)
      showSuccess('Welcome back! Redirecting to dashboard…')
      navigate('/dashboard')
    },

    onError: (error) => {
      // 401 is rendered inline by the Login form — skip toast for that case.
      if (error?.response?.status === 401) return
      const message =
        error?.response?.data?.message || 'Login failed. Please try again.'
      showError(message)
    },
  })
}
