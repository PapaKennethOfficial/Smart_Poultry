import { createContext, useContext, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle, XCircle, X } from 'lucide-react'

// ─── Context ────────────────────────────────────────────────────────────────

const ToastContext = createContext(null)

// ─── Provider ───────────────────────────────────────────────────────────────

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((message, type) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => removeToast(id), 4000)
  }, [removeToast])

  const showSuccess = useCallback((message) => addToast(message, 'success'), [addToast])
  const showError   = useCallback((message) => addToast(message, 'error'),   [addToast])

  return (
    <ToastContext.Provider value={{ showSuccess, showError }}>
      {children}
      {createPortal(
        <ToastContainer toasts={toasts} onRemove={removeToast} />,
        document.body
      )}
    </ToastContext.Provider>
  )
}

// ─── Custom Hook ─────────────────────────────────────────────────────────────

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within a ToastProvider')
  return context
}

// ─── Toast Container ─────────────────────────────────────────────────────────

function ToastContainer({ toasts, onRemove }) {
  return (
    <div style={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

// ─── Single Toast Item ────────────────────────────────────────────────────────

function ToastItem({ toast, onRemove }) {
  const isSuccess = toast.type === 'success'

  return (
    <div style={{
      ...styles.toast,
      borderLeft: `4px solid ${isSuccess ? '#237227' : '#ef4444'}`,
      animation: 'toast-slide-in 0.3s ease',
    }}>
      <span style={{ color: isSuccess ? '#237227' : '#ef4444', flexShrink: 0 }}>
        {isSuccess
          ? <CheckCircle size={18} />
          : <XCircle size={18} />
        }
      </span>
      <p style={styles.message}>{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        style={styles.closeBtn}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Inline Styles ────────────────────────────────────────────────────────────

const styles = {
  container: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    pointerEvents: 'none',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#ffffff',
    color: '#1a1a1a',
    padding: '12px 16px',
    borderRadius: '10px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    minWidth: '260px',
    maxWidth: '380px',
    pointerEvents: 'all',
    fontFamily: "'Inter', sans-serif",
    fontSize: '0.875rem',
  },
  message: {
    flex: 1,
    margin: 0,
    lineHeight: '1.4',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9ca3af',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
}
