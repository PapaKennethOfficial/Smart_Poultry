import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toggle2FA } from '../../api/users'
import { useToast } from '../../components/Toast'

export function useToggle2FA() {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useToast()

  return useMutation({
    mutationFn: (enabled) => toggle2FA(enabled),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['me'], updatedUser)
      showSuccess(`Two-Factor Authentication ${updatedUser.isTwoFactorEnabled ? 'enabled' : 'disabled'}.`)
    },
    onError: (error) => {
      showError(error?.response?.data?.message || 'Failed to update 2FA setting.')
    },
  })
}
