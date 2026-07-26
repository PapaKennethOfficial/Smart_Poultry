import { useQuery } from '@tanstack/react-query'
import { fetchSalesTracker } from '../../api/analytics'

/**
 * useSalesTracker(days)
 *
 * Fetches the full transaction-side dashboard payload from
 * GET /api/analytics/sales-tracker?days=N. Cached per window length so
 * flipping between 7/30/90 doesn't re-fetch when the user toggles back.
 */
export function useSalesTracker(days = 30) {
  return useQuery({
    queryKey: ['analytics', 'sales-tracker', days],
    queryFn: () => fetchSalesTracker(days),
    staleTime: 60 * 1000, // 1 min — orders change frequently
    retry: 1,
  })
}
