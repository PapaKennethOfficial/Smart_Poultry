import { useMutation } from '@tanstack/react-query'
import { updatePassword } from '../../api/users'
import { useToast } from '../../components/Toast'

/**
 * useUpdatePassword — PATCH /users/me/password
 *
 * 401 → "Current password is incorrect" (from the server)
 * 400 → first Zod field error
 */
export function useUpdatePassword() {
  const { showSuccess, showError } = useToast()

  return useMutation({
    mutationFn: updatePassword,

    onSuccess: () => {
      showSuccess('Password updated')
    },

    onError: (error) => {
      const fieldErrors = error?.response?.data?.errors
      const firstFieldMsg = fieldErrors
        ? Object.values(fieldErrors).flat()[0]
        : null
      const message =
        firstFieldMsg ||
        error?.response?.data?.message ||
        'Could not update password'
      showError(message)
    },
  })
}
