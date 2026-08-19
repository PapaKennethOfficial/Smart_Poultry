import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { loginUser } from '../../api/auth'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/Toast'

import { useQueryClient } from '@tanstack/react-query'

/**
 * useLogin — mutation hook for POST /api/auth/login
 *
 * Usage:
 *   const { mutate: login, isPending, error } = useLogin()
 *   login({ email, password, role, remember })
 *
 * `remember` never reaches the API -- it only decides whether the returned
 * token is persisted (localStorage) or scoped to the tab (sessionStorage).
 *
 * 401/403 auth errors are surfaced via `error` for inline display.
 * Other errors fall back to a toast.
 */
export function useLogin() {
  const { setToken, setRole, setUser } = useAuth()
  const { showSuccess, showError } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ remember: _remember, ...credentials }) => loginUser(credentials),

    onSuccess: (data, variables, context) => {
      if (data.requires2FA) {
        showSuccess(data.message || 'OTP sent.')
        // For testing purposes, alert the OTP code directly
        if (data.mockOtp) {
          setTimeout(() => alert(`MOCK SMS RECEIVED\n\nYour SmartPoultry OTP is: ${data.mockOtp}`), 500)
        }
        return
      }
      queryClient.clear() // Prevent stale data from previous sessions
      setToken(data.token, { remember: variables?.remember !== false })
      if (data.role) setRole(data.role)
      if (data.user) setUser(data.user)
      showSuccess('Welcome back! Redirecting to dashboard…')
      if (data.role === 'DELIVERY') navigate('/delivery/vehicle')
      else if (data.role === 'CUSTOMER') navigate('/customer/marketplace')
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
