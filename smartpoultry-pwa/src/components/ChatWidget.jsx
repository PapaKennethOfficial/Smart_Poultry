import { useState, useEffect, useRef } from 'react'
import { Send, X, MessageSquare } from 'lucide-react'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'

export default function ChatWidget({ room, receiverId, receiverName }) {
  const { socket } = useSocket()
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [unread, setUnread] = useState(0)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (!socket || !room) return

    socket.emit('join_order_room', room)

    const handleMessage = (msg) => {
      setMessages(prev => [...prev, msg])
      if (!isOpen) setUnread(prev => prev + 1)
    }

    socket.on('chat_message', handleMessage)

    return () => {
      socket.off('chat_message', handleMessage)
    }
  }, [socket, room, isOpen])

  useEffect(() => {
    if (isOpen) {
      setUnread(0)
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [isOpen, messages])

  const sendMessage = (e) => {
    e.preventDefault()
    if (!input.trim() || !socket || !room) return

    const msg = {
      room,
      senderId: user.id,
      senderName: user.name,
      text: input.trim(),
      timestamp: new Date().toISOString()
    }

    socket.emit('chat_message', msg)
    setInput('')
  }

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <MessageSquare size={24} />
          {unread > 0 && (
            <span style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: '#ef4444',
              color: 'white',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              minWidth: 20,
              height: 20,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px'
            }}>
              {unread}
            </span>
          )}
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 340,
          height: 480,
          background: 'var(--bg-card)',
          borderRadius: 16,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9999,
          overflow: 'hidden',
          border: '1px solid var(--border)'
        }}>
          {/* Header */}
          <div style={{
            padding: '16px',
            background: 'var(--primary)',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontWeight: 600 }}>Chat with {receiverName || 'Support'}</div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex' }}>
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg)' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-subtle)', marginTop: 'auto', marginBottom: 'auto', fontSize: '0.85rem' }}>
                No messages yet. Say hello!
              </div>
            ) : (
              messages.map((msg, i) => {
                const isMe = msg.senderId === user.id
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    {!isMe && <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', marginBottom: 4, marginLeft: 4 }}>{msg.senderName}</span>}
                    <div style={{
                      maxWidth: '85%',
                      padding: '10px 14px',
                      borderRadius: 16,
                      background: isMe ? 'var(--primary)' : 'var(--bg-card)',
                      color: isMe ? 'white' : 'var(--text-body)',
                      border: isMe ? 'none' : '1px solid var(--border)',
                      fontSize: '0.9rem',
                      lineHeight: 1.4,
                      borderBottomRightRadius: isMe ? 4 : 16,
                      borderBottomLeftRadius: !isMe ? 4 : 16
                    }}>
                      {msg.text}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} style={{ padding: 12, background: 'var(--bg-card)', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type a message..."
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 20,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={!input.trim()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                background: input.trim() ? 'var(--primary)' : 'var(--bg)',
                color: input.trim() ? 'white' : 'var(--text-subtle)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() ? 'pointer' : 'default',
                transition: 'background 0.2s'
              }}
            >
              <Send size={18} style={{ marginLeft: 2 }} />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
