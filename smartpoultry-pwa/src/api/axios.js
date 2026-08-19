import axios from 'axios'
import { readAuth } from './authStorage'

// baseURL is intentionally empty: in dev, Vite proxies "/api" → backend
// (see vite.config.js). In production, the frontend is served from the same
// origin as the API, so relative paths work everywhere.
// Override per environment via Vite env: VITE_API_BASE_URL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
  // Not localStorage directly: a "Remember me"-off session lives in
  // sessionStorage, and reading only localStorage would drop the header.
  const token = readAuth('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api
