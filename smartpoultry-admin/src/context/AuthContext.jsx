import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || null)
  const [role, setRole] = useState(() => localStorage.getItem('role') || null)
  const [user, setUserState] = useState(() => {
    const raw = localStorage.getItem('user')
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      localStorage.removeItem('user')
      return null
    }
  })

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

  const handleSetToken = (newToken) => {
    setToken(newToken)
    if (newToken) {
      localStorage.setItem('token', newToken)
    } else {
      localStorage.removeItem('token')
    }
  }

  const handleSetRole = (newRole) => {
    setRole(newRole)
    if (newRole) {
      localStorage.setItem('role', newRole)
    } else {
      localStorage.removeItem('role')
    }
  }

  const handleSetUser = (newUser) => {
    setUserState(newUser)
    if (newUser) {
      localStorage.setItem('user', JSON.stringify(newUser))
    } else {
      localStorage.removeItem('user')
    }
  }

  const logout = () => {
    handleSetToken(null)
    handleSetRole(null)
    handleSetUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        role,
        user,
        setToken: handleSetToken,
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

