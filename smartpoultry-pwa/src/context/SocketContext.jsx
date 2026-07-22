import { createContext, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { token, user } = useAuth()
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    if (token && user) {
      // Connect to the backend with the token
      const newSocket = io('http://localhost:5000', {
        auth: { token }
      })

      newSocket.on('connect', () => {
        // Socket connected
      })

      newSocket.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message)
      })

      setSocket(newSocket)

      return () => {
        newSocket.disconnect()
      }
    } else {
      if (socket) {
        socket.disconnect()
        setSocket(null)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id])

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}
