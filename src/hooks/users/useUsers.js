import { useQuery } from '@tanstack/react-query'
import { listUsers } from '../../api/users'

export function useUsers(options = {}) {
  return useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
    // Caller can disable when current user isn't ADMIN/MANAGER to avoid 403s.
    enabled: options.enabled ?? true,
  })
}
