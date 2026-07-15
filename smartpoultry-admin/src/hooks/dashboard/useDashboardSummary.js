import { useQuery } from '@tanstack/react-query'
import { getSummary } from '../../api/dashboard'

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: getSummary,
  })
}
