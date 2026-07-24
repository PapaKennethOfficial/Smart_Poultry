import { useMutation, useQuery } from '@tanstack/react-query'
import { getMorningBriefing, askInsight } from '../../api/aiAnalytics'
import { useToast } from '../../components/Toast'

/**
 * Fetches (and caches) the morning briefing. Auto-runs once when a manager
 * opens the analytics page; refresh happens on manual "Regenerate" or when
 * the underlying data would obviously have moved.
 */
export function useMorningBriefing() {
  return useQuery({
    queryKey: ['ai', 'morning-briefing'],
    queryFn: getMorningBriefing,
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 0, // 503 (no LLM key) shouldn't be retried
  })
}

/**
 * "Ask the data" mutation — one prompt at a time. The Analytics page
 * pushes each Q/A pair into its own local list so history is preserved
 * across a session without a server-side conversation store.
 */
export function useAskInsight() {
  const { showError } = useToast()
  return useMutation({
    mutationFn: askInsight,
    onError: (err) => {
      const message =
        err?.response?.data?.message
        || 'Could not reach the AI Advisor. Check that GOOGLE_API_KEY is set on the AI service.'
      showError(message)
    },
  })
}
