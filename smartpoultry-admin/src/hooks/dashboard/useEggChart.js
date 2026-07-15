import { useQuery } from '@tanstack/react-query'
import { getEggChart } from '../../api/dashboard'

export function useEggChart(days = 7) {
  return useQuery({
    queryKey: ['dashboard', 'eggChart', days],
    queryFn: () => getEggChart({ days }),
  })
}
