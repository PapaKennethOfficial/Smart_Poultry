import { useQuery } from '@tanstack/react-query'
import { getMe } from '../../api/users'

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: getMe,
  })
}
