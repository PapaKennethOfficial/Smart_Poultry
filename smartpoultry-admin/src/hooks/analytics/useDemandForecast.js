import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDemandForecast, retrainDemandForecast } from '../../api/aiAnalytics'
import { useToast } from '../../components/Toast'

/**
 * Fetches the Prophet demand forecast. Long stale-time because the model
 * only retrains on a schedule (or via the Retrain button), so re-hitting
 * the endpoint every focus would burn compute for no new info.
 */
export function useDemandForecast(days = 14) {
  return useQuery({
    queryKey: ['ai', 'demand-forecast', days],
    queryFn: () => getDemandForecast({ days }),
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: 1,
  })
}

/** Manual "Retrain now" button hook. */
export function useRetrainDemandForecast() {
  const qc = useQueryClient()
  const { showSuccess, showError } = useToast()

  return useMutation({
    mutationFn: retrainDemandForecast,
    onSuccess: (data) => {
      showSuccess(
        data?.metrics?.mape != null
          ? `Model retrained. MAPE ${data.metrics.mape}% / RMSE ${data.metrics.rmse ?? '—'}`
          : 'Model retrained'
      )
      qc.invalidateQueries({ queryKey: ['ai', 'demand-forecast'] })
    },
    onError: (err) => {
      const message = err?.response?.data?.message || 'Retrain failed'
      showError(message)
    },
  })
}
