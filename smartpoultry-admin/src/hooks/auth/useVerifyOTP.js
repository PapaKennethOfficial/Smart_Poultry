import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { verifyOTP } from '../../api/auth'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/Toast'

export function useVerifyOTP() {
  const { setToken, setRole, setUser } = useAuth()
  const { showSuccess, showError } = useToast()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: verifyOTP,

    onSuccess: (data) => {
      setToken(data.token)
      if (data.role) setRole(data.role)
      if (data.user) setUser(data.user)
      showSuccess('Login successful! Redirecting to dashboard…')
      if (data.role === 'DELIVERY') navigate('/delivery/vehicle')
      else if (data.role === 'CUSTOMER') navigate('/customer/marketplace')
      else navigate('/dashboard')
    },

    onError: (error) => {
      const message = error?.response?.data?.message || 'Invalid OTP.'
      showError(message)
    },
  })
}
