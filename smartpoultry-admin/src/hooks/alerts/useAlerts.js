import { useQuery } from '@tanstack/react-query'
import { listAlerts } from '../../api/alerts'

/**
 * Polls /api/alerts every 30 seconds so the dashboard alerts panel
 * stays fresh without the user reloading.
 */
export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: listAlerts,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  })
}
