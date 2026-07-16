import api from './axios'

/**
 * GET /api/users/me
 * @returns {Promise<{ id, name, email, phone, role, notificationPreferences, lastLoginAt, createdAt }>}
 */
export const getMe = () =>
  api.get('/api/users/me').then((res) => res.data)

/**
 * PUT /api/users/me
 * @param {{ name?: string, email?: string, phone?: string|null }} payload
 */
export const updateMe = (payload) =>
  api.put('/api/users/me', payload).then((res) => res.data)

/**
 * PATCH /api/users/me/notifications
 * Merges the supplied preferences into the stored JSON blob.
 * @param {Record<string, boolean>} preferences
 */
export const updateNotifications = (preferences) =>
  api.patch('/api/users/me/notifications', { preferences }).then((res) => res.data)

/**
 * PATCH /api/users/me/password
 * @param {{ currentPassword: string, newPassword: string }} payload
 */
export const updatePassword = (payload) =>
  api.patch('/api/users/me/password', payload).then((res) => res.data)

/**
 * GET /api/users  (ADMIN / MANAGER only)
 * @returns {Promise<Array>}
 */
export const listUsers = () =>
  api.get('/api/users').then((res) => res.data)

export const toggle2FA = (enabled) =>
  api.patch('/api/users/me/2fa', { enabled }).then((res) => res.data)
