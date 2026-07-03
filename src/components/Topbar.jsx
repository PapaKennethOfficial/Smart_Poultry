import { Bell, Search, RefreshCw, Menu } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../api/axios'

const pageTitles = {
  '/dashboard':  'Dashboard',
  '/logbook':    'Farm Logbook',
  '/analytics':  'Analytics & AI Insights',
  '/deliveries': 'Delivery Management',
  '/reports':    'Reports',
  '/settings':   'Settings',
  '/dashboard/verify-vehicles': 'Vehicle Verification',
  '/dashboard/orders': 'Customer Orders',
  '/delivery/vehicle': 'Vehicle Registration',
  '/delivery/orders': 'Assigned Deliveries',
  '/customer/marketplace': 'Marketplace',
  '/customer/orders': 'My Orders',
}

export default function Topbar({ onMenuClick }) {
  const location = useLocation()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const title = pageTitles[location.pathname] || 'SmartPoultry'
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  useEffect(() => {
    const loadNotifications = () => {
      api.get('/api/notifications')
        .then(res => {
          setNotifications(res.data.notifications || [])
          setUnreadCount(res.data.unreadCount || 0)
        })
        .catch(() => {})
    }

    loadNotifications()
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleNotificationClick = async () => {
    const nextOpen = !showNotifications
    setShowNotifications(nextOpen)
    if (!nextOpen || unreadCount === 0) return
    try {
      await api.patch('/api/notifications/read-all')
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    } catch {
      // Keep the dropdown usable even if read state fails.
    }
  }

  return (
    <div className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="topbar-btn mobile-menu-btn" onClick={onMenuClick}>
          <Menu size={16} />
        </button>
        <div>
          <div className="topbar-title">{title}</div>
          <div className="topbar-date">{dateStr}</div>
        </div>
      </div>

      <div className="topbar-right">
        {/* Search bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#F7F6E5', border: '1.5px solid #dddabd',
          borderRadius: 9, padding: '7px 13px', width: 210
        }}>
          <Search size={13} color="#8da58f" />
          <input
            placeholder="Search..."
            style={{
              border: 'none', background: 'transparent', outline: 'none',
              fontSize: '0.8rem', color: '#2a3d2b', width: '100%',
              fontFamily: 'Inter, sans-serif'
            }}
          />
        </div>

        {/* Refresh */}
        <button className="topbar-btn" title="Refresh data" onClick={() => window.location.reload()}>
          <RefreshCw size={14} />
        </button>

        {/* Notifications */}
        <div style={{ position: 'relative' }}>
          <button className="topbar-btn" title="Notifications" onClick={handleNotificationClick}>
            <Bell size={14} />
            {unreadCount > 0 && <span className="notif-badge" />}
          </button>
          {showNotifications && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: 44,
              width: 320,
              maxHeight: 360,
              overflowY: 'auto',
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: '0 12px 30px rgba(0,0,0,0.14)',
              zIndex: 1000,
              padding: 10,
            }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-heading)', padding: '4px 4px 8px' }}>
                Notifications
              </div>
              {notifications.length === 0 ? (
                <div style={{ padding: 18, textAlign: 'center', color: 'var(--text-subtle)', fontSize: '0.8rem' }}>
                  No notifications yet.
                </div>
              ) : notifications.map(n => (
                <div key={n.id} style={{
                  padding: '10px 8px',
                  borderRadius: 8,
                  background: n.isRead ? 'transparent' : 'var(--primary-subtle)',
                  borderBottom: '1px solid var(--border-light)',
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: 3 }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', marginTop: 5 }}>
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,170,0,0.10)', border: '1px solid rgba(255,170,0,0.28)',
          borderRadius: 20, padding: '4px 12px'
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#FFAA00', display: 'inline-block',
            boxShadow: '0 0 6px #FFAA00', animation: 'pulse 2s infinite'
          }} />
          <span style={{ fontSize: '0.72rem', color: '#8a5f00', fontWeight: 600 }}>Live</span>
        </div>
      </div>
    </div>
  )
}
