import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { registerUser } from '../../api/auth'
import { useToast } from '../../components/Toast'

/**
 * useRegister — mutation hook for POST /api/auth/register
 *
 * Usage:
 *   const { mutate: register, isPending, error } = useRegister()
 *   register({ name, email, password, role })
 *
 * On success → redirect to /login with a toast.
 * Field/validation errors are surfaced via `error` for inline display.
 */
export function useRegister() {
  const { showSuccess, showError } = useToast()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: registerUser,

    onSuccess: () => {
      showSuccess('Account created — please sign in')
      navigate('/login')
    },

    onError: (error) => {
      // 400 (Zod) and 409 (duplicate email) are rendered inline by the form.
      const status = error?.response?.status
      if (status === 400 || status === 409) return
      const message =
        error?.response?.data?.message || 'Sign up failed. Please try again.'
      showError(message)
    },
  })
}
