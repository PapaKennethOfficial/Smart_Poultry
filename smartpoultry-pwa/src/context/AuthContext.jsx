import { createContext, useContext, useState, useEffect, useRef } from 'react'
import api from '../api/axios'
import { readAuth, writeAuth, clearAuth, rememberedByDefault } from '../api/authStorage'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readAuth('token') || null)
  const [role, setRole] = useState(() => readAuth('role') || null)
  const [user, setUserState] = useState(() => {
    const raw = readAuth('user')
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      writeAuth('user', null, true)
      writeAuth('user', null, false)
      return null
    }
  })

  // A ref, not state: setToken/setRole/setUser are called back-to-back on
  // sign-in, and a state update would still be queued when the second and
  // third of them ran -- they would write to the wrong store. The ref is
  // current the instant setToken assigns it.
  const rememberRef = useRef(rememberedByDefault())

  // Hydrate user profile from the backend on mount when a token exists.
  // This ensures the real username is always available even after a page refresh.
  useEffect(() => {
    if (!token) return
    api.get('/api/users/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        const userData = res.data?.user || res.data
        if (userData) {
          handleSetUser(userData)
          if (userData.role) handleSetRole(userData.role)
        }
      })
      .catch((err) => {
        // Only logout on 401 (expired/invalid token). Other errors (network, 500)
        // should not wipe the session.
        if (err?.response?.status === 401) {
          logout()
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  /**
   * Sign-in entry point. Pass `{ remember }` to choose where the session is
   * stored; omit it and the previous choice is reused, which is what the
   * background profile refresh below wants.
   */
  const handleSetToken = (newToken, options = {}) => {
    if (typeof options.remember === 'boolean') rememberRef.current = options.remember
    setToken(newToken)
    writeAuth('token', newToken, rememberRef.current)
  }

  const handleSetRole = (newRole) => {
    setRole(newRole)
    writeAuth('role', newRole, rememberRef.current)
  }

  const handleSetUser = (newUser) => {
    setUserState(newUser)
    writeAuth('user', newUser ? JSON.stringify(newUser) : null, rememberRef.current)
  }

  const logout = () => {
    setToken(null)
    setRole(null)
    setUserState(null)
    // Wipe both stores, not just the active one, so a stale token from an
    // earlier "Remember me" login can never resurrect the session.
    clearAuth()
    rememberRef.current = true
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        role,
        user,
        setToken: handleSetToken,
        remember: rememberRef.current,
        setRole: handleSetRole,
        setUser: handleSetUser,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

