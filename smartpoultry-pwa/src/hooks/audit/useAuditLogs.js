import { useQuery } from '@tanstack/react-query'
import api from '../../api/axios'

export function useAuditLogs() {
  return useQuery({
    queryKey: ['auditLogs'],
    queryFn: async () => {
      const { data } = await api.get('/api/logs/audit')
      return data
    },
  })
}
