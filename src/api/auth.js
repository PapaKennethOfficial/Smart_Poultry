import api from './axios'

/**
 * POST /api/auth/login
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ token: string, role: string, user: object }>}
 */
export const loginUser = (credentials) =>
  api.post('/api/auth/login', credentials).then((res) => res.data)

/**
 * POST /api/auth/register
 * @param {{ name: string, email: string, password: string, role?: string }} payload
 * @returns {Promise<{ message: string, user: object }>}
 */
export const registerUser = (payload) =>
  api.post('/api/auth/register', payload).then((res) => res.data)
