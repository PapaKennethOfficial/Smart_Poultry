import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateMe } from '../../api/users'
import { useToast } from '../../components/Toast'

/**
 * useUpdateMe — PUT /users/me
 *
 * Success → green toast + invalidate ['me'].
 * Error   → red toast with the server message (or a fallback).
 */
export function useUpdateMe() {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useToast()

  return useMutation({
    mutationFn: updateMe,

    onSuccess: (data) => {
      queryClient.setQueryData(['me'], data)
      showSuccess('Profile updated')
    },

    onError: (error) => {
      const fieldErrors = error?.response?.data?.errors
      const firstFieldMsg = fieldErrors
        ? Object.values(fieldErrors).flat()[0]
        : null
      const message =
        firstFieldMsg ||
        error?.response?.data?.message ||
        'Could not update profile'
      showError(message)
    },
  })
}
