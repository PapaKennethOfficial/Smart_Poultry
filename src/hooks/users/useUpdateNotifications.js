import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateNotifications } from '../../api/users'
import { useToast } from '../../components/Toast'

/**
 * useUpdateNotifications — PATCH /users/me/notifications
 *
 * Accepts a partial preferences object (e.g. { mortality: true }) — the
 * backend merges it into the stored JSON, so the UI can flip one toggle
 * at a time without resending the whole map.
 */
export function useUpdateNotifications() {
  const queryClient = useQueryClient()
  const { showError } = useToast()

  return useMutation({
    mutationFn: updateNotifications,

    onSuccess: (data) => {
      queryClient.setQueryData(['me'], data)
    },

    onError: (error) => {
      const message =
        error?.response?.data?.message || 'Could not save preference'
      showError(message)
    },
  })
}
