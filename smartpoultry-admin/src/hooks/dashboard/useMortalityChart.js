import { useQuery } from '@tanstack/react-query'
import { getMortalityChart } from '../../api/dashboard'

export function useMortalityChart(weeks = 6) {
  return useQuery({
    queryKey: ['dashboard', 'mortalityChart', weeks],
    queryFn: () => getMortalityChart({ weeks }),
  })
}
