import { useEffect, useState } from 'react'
import { User, Lock, Bell, Database, Users, Loader2, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { useMe } from '../hooks/users/useMe'
import { useUsers } from '../hooks/users/useUsers'
import { useAuditLogs } from '../hooks/audit/useAuditLogs'
import { useUpdateMe } from '../hooks/users/useUpdateMe'
import { useUpdateNotifications } from '../hooks/users/useUpdateNotifications'
import { useUpdatePassword } from '../hooks/users/useUpdatePassword'
import { useToggle2FA } from '../hooks/users/useToggle2FA'
import TableFilter from '../components/TableFilter'
import Pagination from '../components/Pagination'

const sections = [
  { id: 'profile',       icon: User,     label: 'Profile'        },
  { id: 'security',      icon: Lock,     label: 'Security'       },
  { id: 'notifications', icon: Bell,     label: 'Notifications'  },
  { id: 'farm',          icon: Database, label: 'Farm Settings'  },
  { id: 'users',         icon: Users,    label: 'Team & Roles'   },
  { id: 'legal',         icon: FileText, label: 'Legal & Policies'},
  { id: 'audit',         icon: Database, label: 'Audit Trail'    },
]

const MANAGER_NOTIF_ITEMS = [
  { key: 'environmental', title: 'Environmental Alerts',  desc: 'Temp, humidity, ammonia threshold breaches'         },
  { key: 'mortality',     title: 'Mortality Alerts',      desc: 'Unusual death counts detected by AI'                },
  { key: 'delivery',      title: 'Delivery Updates',      desc: 'Order status changes and driver notifications'      },
  { key: 'forecast',      title: 'AI Forecast Ready',     desc: 'When new 10-day yield predictions are available'    },
  { key: 'daily',         title: 'Daily Summary',         desc: 'End-of-day report via email'                        },
  { key: 'feeding',       title: 'Feeding Reminders',     desc: 'Scheduled feed time notifications'                  },
]

const CUSTOMER_NOTIF_ITEMS = [
  { key: 'payment',        title: 'Payment Updates',       desc: 'Payment method selection and payment progress'      },
  { key: 'orderPlaced',    title: 'Order Confirmation',    desc: 'When an order is placed successfully'               },
  { key: 'orderShipped',   title: 'Order Shipped',         desc: 'When your order leaves the farm for delivery'       },
  { key: 'orderDelivered', title: 'Order Delivered',       desc: 'When your order reaches you'                        },
  { key: 'smsPayment',     title: 'SMS Payment Updates',   desc: 'Receive payment updates by SMS'                     },
  { key: 'smsOrderPlaced', title: 'SMS Order Confirmation', desc: 'Receive order confirmation by SMS'                  },
  { key: 'smsOrderShipped', title: 'SMS Order Shipped',    desc: 'Receive shipping updates by SMS'                    },
  { key: 'smsOrderDelivered', title: 'SMS Order Delivered', desc: 'Receive delivery completion updates by SMS'         },
]

const DELIVERY_NOTIF_ITEMS = [
  { key: 'vehicleVerification', title: 'Vehicle Verification', desc: 'Approval, rejection, and requested changes'      },
  { key: 'deliveryAssigned',    title: 'Delivery Assignments',  desc: 'New customer orders assigned to you'            },
  { key: 'orderChat',           title: 'Customer Messages',     desc: 'Messages from customers about active deliveries'},
]

function visibleSectionsForRole(role) {
  if (role === 'CUSTOMER' || role === 'DELIVERY') {
    return sections.filter((s) => s.id === 'profile' || s.id === 'security' || s.id === 'notifications' || s.id === 'legal')
  }
  return sections
}

function notificationItemsForRole(role) {
  if (role === 'CUSTOMER') return CUSTOMER_NOTIF_ITEMS
  if (role === 'DELIVERY') return DELIVERY_NOTIF_ITEMS
  return MANAGER_NOTIF_ITEMS
}

// Convert ISO timestamp into "Today / Yesterday / N days ago / Never"
function relativeLogin(iso) {
  if (!iso) return 'Never'
  const d = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dDay = new Date(d)
  dDay.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today - dDay) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7)   return `${diffDays} days ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function initials(name = '') {
  return name.trim().split(/\s+/).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?'
}

function roleBadgeLabel(role) {
  if (!role) return ''
  if (role === 'DELIVERY') return 'Delivery Staff'
  return role.charAt(0) + role.slice(1).toLowerCase()
}

function Toggle({ enabled, onChange, disabled }) {
  return (
    <div
      className="toggle-track"
      style={{
        background: enabled ? '#237227' : '#dddabd',
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onClick={disabled ? undefined : onChange}
    >
      <div className="toggle-thumb" style={{ left: enabled ? 21 : 3 }} />
    </div>
  )
}

export default function Settings() {
  const [activeSection, setActiveSection] = useState('profile')
  const { role: authRole } = useAuth()
  const { showError } = useToast()
  const visibleSections = visibleSectionsForRole(authRole)
  const notificationItems = notificationItemsForRole(authRole)

  // ─── /users/me ────────────────────────────────────────────────────────────
  const meQuery = useMe()
  const me = meQuery.data

  // ─── Profile form local state (mirrors the API once /me loads) ────────────
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  useEffect(() => {
    if (me) {
      setName(me.name || '')
      setEmail(me.email || '')
      setPhone(me.phone || '')
      setAvatarUrl(me.avatarUrl || '')
    }
  }, [me])

  useEffect(() => {
    if (!visibleSections.some((section) => section.id === activeSection)) {
      setActiveSection('profile')
    }
  }, [activeSection, visibleSections])

  const updateMe = useUpdateMe()
  const handleSaveProfile = () => {
    updateMe.mutate({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      avatarUrl: avatarUrl || null
    })
  }

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    // Quick validation (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showError("Image size should be less than 2MB")
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatarUrl(reader.result)
    }
    reader.readAsDataURL(file)
  }

  // ─── Security (password) ──────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const toggle2FAMutation = useToggle2FA()
  const twoFAEnabled = me?.isTwoFactorEnabled || false

  const updatePassword = useUpdatePassword()
  const handleUpdatePassword = (e) => {
    e?.preventDefault?.()
    if (newPassword !== confirmPassword) {
      showError('New passwords do not match')
      return
    }
    updatePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword('')
          setNewPassword('')
          setConfirmPassword('')
        },
      }
    )
  }

  // ─── Notification toggles ─────────────────────────────────────────────────
  const updateNotifications = useUpdateNotifications()
  const prefs = (me && me.notificationPreferences) || {}
  const handleToggle = (key) => {
    const next = !prefs[key]
    // Optimistic UX comes from React Query's setQueryData inside the hook
    updateNotifications.mutate({ [key]: next })
  }

  // ─── Team & Roles ────────────────────────────────────────────────────────
  const canViewTeam = authRole === 'ADMIN' || authRole === 'MANAGER'
  const usersQuery  = useUsers({ enabled: canViewTeam && activeSection === 'users' })
  const auditQuery  = useAuditLogs()

  // ─── Audit Trail filtering + pagination ────────────────────────────────────
  const [auditSearch, setAuditSearch] = useState('')
  const [auditAction, setAuditAction] = useState('all')
  const [auditPage, setAuditPage] = useState(1)
  const AUDIT_PER_PAGE = 15

  useEffect(() => { setAuditPage(1) }, [auditSearch, auditAction])

  const auditLogs = auditQuery.data || []
  const auditActions = [...new Set(auditLogs.map(l => l.action).filter(Boolean))]
  const filteredAudit = auditLogs.filter(l => {
    const s = auditSearch.toLowerCase()
    const matchesSearch = !s ||
      (l.user || '').toLowerCase().includes(s) ||
      (l.entity || '').toLowerCase().includes(s) ||
      (l.endpoint || '').toLowerCase().includes(s)
    const matchesAction = auditAction === 'all' || l.action === auditAction
    return matchesSearch && matchesAction
  })
  const paginatedAudit = filteredAudit.slice(
    (auditPage - 1) * AUDIT_PER_PAGE,
    auditPage * AUDIT_PER_PAGE
  )

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Settings</div>
        <div className="page-desc">Manage your account security and notification preferences</div>
      </div>

      <div className="settings-layout">
        {/* Settings nav */}
        <div style={{
          background: '#fff', borderRadius: 14, padding: '10px',
          border: '1px solid #dddabd', height: 'fit-content'
        }}>
          {visibleSections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                padding: '9px 11px', borderRadius: 9, cursor: 'pointer',
                border: 'none',
                background: activeSection === s.id ? 'rgba(35,114,39,0.08)' : 'transparent',
                color:      activeSection === s.id ? '#237227' : '#5e7a61',
                fontWeight: activeSection === s.id ? 600 : 400,
                fontSize: '0.84rem', textAlign: 'left',
                fontFamily: 'Inter, sans-serif', transition: 'all 0.15s'
              }}
            >
              <s.icon size={15} />
              {s.label}
            </button>
          ))}
        </div>

        {/* Settings content */}
        <div>
          {/* ── Profile ── */}
          {activeSection === 'profile' && (
            <div className="chart-card">
              <div className="section-title" style={{ marginBottom: 3 }}>Profile Information</div>
              <div style={{ fontSize: '0.78rem', color: '#5e7a61', marginBottom: 22, lineHeight: 1.55 }}>
                Update your personal details and contact information
              </div>

              {/* Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 22, borderBottom: '1px solid #edebd6' }}>
                <div style={{ position: 'relative' }}>
                  {avatarUrl ? (
                    <img 
                      src={avatarUrl} 
                      alt="Avatar" 
                      style={{ width: 62, height: 62, borderRadius: 14, objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: 62, height: 62, borderRadius: 14,
                      background: 'linear-gradient(135deg, #237227, #84be88)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '1.35rem', color: '#fff'
                    }}>
                      {initials(me?.name)}
                    </div>
                  )}
                  <label 
                    style={{ position: 'absolute', bottom: -5, right: -5, background: '#fff', padding: 4, borderRadius: '50%', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', cursor: 'pointer', border: '1px solid #edebd6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Upload new avatar"
                  >
                    <User size={14} color="#5e7a61" />
                    <input type="file" style={{ display: 'none' }} accept="image/*" onChange={handleAvatarUpload} disabled={updateMe.isPending} />
                  </label>
                </div>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '0.98rem', color: '#0d1f0e' }}>
                    {meQuery.isLoading ? 'Loading…' : (me?.name || '—')}
                  </div>
                  <div style={{ fontSize: '0.79rem', color: '#8da58f', marginTop: 2 }}>
                    {roleBadgeLabel(me?.role)} · SmartPoultry
                  </div>
                </div>
              </div>

              {meQuery.isError ? (
                <div style={{ color: '#b91c1c', fontSize: '0.85rem' }}>Could not load profile.</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, maxWidth: 580 }}>
                    <div className="form-group">
                      <label className="form-label">Full Name</label>
                      <input
                        className="form-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={meQuery.isLoading || updateMe.isPending}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email Address</label>
                      <input
                        className="form-input"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={meQuery.isLoading || updateMe.isPending}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone Number</label>
                      <input
                        className="form-input"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+233 XX XXX XXXX"
                        disabled={meQuery.isLoading || updateMe.isPending}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Role</label>
                      <input
                        className="form-input"
                        value={roleBadgeLabel(me?.role) || ''}
                        disabled
                        title="Role is assigned by an administrator"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                    <button
                      className="btn-primary"
                      style={{ padding: '10px 24px', opacity: updateMe.isPending ? 0.75 : 1, width: 'max-content' }}
                      onClick={handleSaveProfile}
                      disabled={meQuery.isLoading || updateMe.isPending}
                    >
                      {updateMe.isPending ? (
                        <>
                          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                          Saving…
                        </>
                      ) : 'Save Changes'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Security ── */}
          {activeSection === 'security' && (
            <div className="chart-card">
              <div className="section-title" style={{ marginBottom: 3 }}>Security Settings</div>
              <div style={{ fontSize: '0.78rem', color: '#5e7a61', marginBottom: 22, lineHeight: 1.55 }}>
                Manage your password and two-factor authentication
              </div>

              <form style={{ maxWidth: 460 }} onSubmit={handleUpdatePassword}>
                <div className="form-group">
                  <label className="form-label">Current Password</label>
                  <input
                    className="form-input"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={updatePassword.isPending}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input
                    className="form-input"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={updatePassword.isPending}
                    required
                    minLength={6}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input
                    className="form-input"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={updatePassword.isPending}
                    required
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                  <button
                    className="btn-primary"
                    style={{ padding: '10px 24px', opacity: updatePassword.isPending ? 0.75 : 1, width: 'max-content' }}
                    onClick={handleUpdatePassword}
                    disabled={updatePassword.isPending || (!currentPassword && !newPassword)}
                  >
                    {updatePassword.isPending ? (
                      <>
                        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        Updating…
                      </>
                    ) : 'Update Password'}
                  </button>
                </div>
              </form>

              <div style={{ marginTop: 26, paddingTop: 22, borderTop: '1px solid #edebd6' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0d1f0e', marginBottom: 12 }}>
                  Two-Factor Authentication
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'rgba(35,114,39,0.06)', borderRadius: 11, padding: '14px 16px',
                  border: '1px solid rgba(35,114,39,0.15)'
                }}>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 500, color: '#0d1f0e' }}>Enable 2FA via SMS</div>
                    <div style={{ fontSize: '0.74rem', color: '#5e7a61', marginTop: 2, lineHeight: 1.5 }}>Receive a code on your phone at each login</div>
                  </div>
                  <Toggle
                    enabled={twoFAEnabled}
                    onChange={() => toggle2FAMutation.mutate(!twoFAEnabled)}
                    disabled={toggle2FAMutation.isPending}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Notifications ── */}
          {activeSection === 'notifications' && (
            <div className="chart-card">
              <div className="section-title" style={{ marginBottom: 3 }}>Notification Preferences</div>
              <div style={{ fontSize: '0.78rem', color: '#5e7a61', marginBottom: 22, lineHeight: 1.55 }}>
                Choose what alerts you receive and how
              </div>

              {notificationItems.map((n, i) => (
                <div key={n.key} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '13px 0', borderBottom: i < notificationItems.length - 1 ? '1px solid #edebd6' : 'none'
                }}>
                  <div>
                    <div style={{ fontSize: '0.845rem', fontWeight: 500, color: '#0d1f0e' }}>{n.title}</div>
                    <div style={{ fontSize: '0.74rem', color: '#5e7a61', marginTop: 2, lineHeight: 1.45 }}>{n.desc}</div>
                  </div>
                  <Toggle
                    enabled={Boolean(prefs[n.key])}
                    onChange={() => handleToggle(n.key)}
                    disabled={meQuery.isLoading || updateNotifications.isPending}
                  />
                </div>
              ))}
            </div>
          )}

          {/* ── Farm Settings (not in current API brief — left as static UI) ── */}
          {activeSection === 'farm' && (
            <div className="chart-card">
              <div className="section-title" style={{ marginBottom: 3 }}>Farm Configuration</div>
              <div style={{ fontSize: '0.78rem', color: '#5e7a61', marginBottom: 22, lineHeight: 1.55 }}>
                Set thresholds for IoT sensor alerts and farm parameters
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, maxWidth: 540 }}>
                {[
                  { label: 'Max Temperature (°C)',      val: '32'   },
                  { label: 'Min Temperature (°C)',      val: '18'   },
                  { label: 'Max Humidity (%)',           val: '75'   },
                  { label: 'Max Ammonia (ppm)',          val: '20'   },
                  { label: 'Daily Egg Target',           val: '1200' },
                  { label: 'Alert Mortality Threshold',  val: '3'    },
                ].map((f, i) => (
                  <div className="form-group" key={i} style={{ marginBottom: 0 }}>
                    <label className="form-label">{f.label}</label>
                    <input className="form-input" type="number" defaultValue={f.val} />
                  </div>
                ))}
              </div>

              <button className="btn-primary" style={{ marginTop: 22 }}>Save Farm Config</button>
            </div>
          )}

          {/* ── Team & Roles ── */}
          {activeSection === 'users' && (
            <div className="chart-card">
              <div className="section-header">
                <div>
                  <div className="section-title">Team & Roles</div>
                  <div className="section-sub">Manage team member access and permissions</div>
                </div>
                <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '7px 14px' }} disabled>
                  + Invite Member
                </button>
              </div>

              {!canViewTeam ? (
                <div style={{
                  marginTop: 14, padding: '14px 16px',
                  background: 'rgba(239,68,68,0.08)', borderRadius: 10,
                  border: '1px solid rgba(239,68,68,0.25)',
                  color: '#b91c1c', fontSize: '0.85rem', lineHeight: 1.5,
                }}>
                  You don't have permission to view team members. Ask an admin or manager.
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Last Login</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersQuery.isLoading && (
                        <tr><td colSpan={6} style={{ color: '#8da58f', textAlign: 'center', padding: 18 }}>
                          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', verticalAlign: 'middle' }} /> Loading team…
                        </td></tr>
                      )}
                      {usersQuery.isError && (
                        <tr><td colSpan={6} style={{ color: '#b91c1c', textAlign: 'center', padding: 18 }}>
                          Could not load team members.
                        </td></tr>
                      )}
                      {!usersQuery.isLoading && !usersQuery.isError && (usersQuery.data || []).map((u) => (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 500 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                              <div style={{
                                width: 30, height: 30, borderRadius: 8,
                                background: 'linear-gradient(135deg, #237227, #84be88)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '0.68rem', color: '#fff'
                              }}>
                                {initials(u.name)}
                              </div>
                              {u.name}
                            </div>
                          </td>
                          <td style={{ color: '#5e7a61', fontSize: '0.82rem' }}>{u.email}</td>
                          <td><span className="badge badge-green">{roleBadgeLabel(u.role)}</span></td>
                          <td><span className="badge badge-green">Active</span></td>
                          <td style={{ color: '#8da58f', fontSize: '0.82rem' }}>{relativeLogin(u.lastLoginAt)}</td>
                          <td>
                            <button className="btn-outline" style={{ padding: '4px 11px', fontSize: '0.74rem' }} disabled>
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!usersQuery.isLoading && !usersQuery.isError && (usersQuery.data || []).length === 0 && (
                        <tr><td colSpan={6} style={{ color: '#8da58f', textAlign: 'center', padding: 18 }}>
                          No team members yet.
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Audit Trail ── */}
          {activeSection === 'audit' && (
            <div className="chart-card">
              <div className="section-header">
                <div>
                  <div className="section-title">Audit Trail</div>
                  <div className="section-sub">System activity logs and events</div>
                </div>
              </div>

              {!canViewTeam ? (
                <div style={{
                  marginTop: 14, padding: '14px 16px',
                  background: 'rgba(239,68,68,0.08)', borderRadius: 10,
                  border: '1px solid rgba(239,68,68,0.25)',
                  color: '#b91c1c', fontSize: '0.85rem', lineHeight: 1.5,
                }}>
                  You don't have permission to view audit logs. Ask an admin or manager.
                </div>
              ) : (
                <>
                  <TableFilter
                    searchValue={auditSearch}
                    onSearchChange={setAuditSearch}
                    searchPlaceholder="Search user, entity, endpoint…"
                    filters={[{
                      key: 'action',
                      label: 'All Actions',
                      value: auditAction,
                      options: auditActions.map(a => ({ label: a, value: a }))
                    }]}
                    onFilterChange={(key, val) => setAuditAction(val)}
                    resultCount={filteredAudit.length}
                  />
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date & Time</th>
                          <th>User</th>
                          <th>Action</th>
                          <th>Entity</th>
                          <th>Endpoint</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditQuery.isLoading && (
                          <tr><td colSpan={5} style={{ color: '#8da58f', textAlign: 'center', padding: 18 }}>
                            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', verticalAlign: 'middle' }} /> Loading audit trail…
                          </td></tr>
                        )}
                        {auditQuery.isError && (
                          <tr><td colSpan={5} style={{ color: '#b91c1c', textAlign: 'center', padding: 18 }}>
                            Could not load audit logs.
                          </td></tr>
                        )}
                        {!auditQuery.isLoading && !auditQuery.isError && paginatedAudit.map((l, i) => (
                          <tr key={l.id || i}>
                            <td style={{ color: '#8da58f', fontSize: '0.82rem' }}>
                              {new Date(l.createdAt).toLocaleString()}
                            </td>
                            <td style={{ fontWeight: 500, color: '#0d1f0e' }}>{l.user}</td>
                            <td><span className="badge badge-gold">{l.action}</span></td>
                            <td>{l.entity}</td>
                            <td style={{ color: '#5e7a61', fontSize: '0.82rem' }}>{l.endpoint}</td>
                          </tr>
                        ))}
                        {!auditQuery.isLoading && !auditQuery.isError && filteredAudit.length === 0 && (
                          <tr><td colSpan={5} style={{ color: '#8da58f', textAlign: 'center', padding: 18 }}>
                            No audit logs found.
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    currentPage={auditPage}
                    totalItems={filteredAudit.length}
                    itemsPerPage={AUDIT_PER_PAGE}
                    onPageChange={setAuditPage}
                  />
                </>
              )}
            </div>
          )}

          {/* ── Legal & Policies ── */}
          {activeSection === 'legal' && (
            <div className="chart-card">
              <div className="section-title" style={{ marginBottom: 3 }}>Legal & Policies</div>
              <div style={{ fontSize: '0.78rem', color: '#5e7a61', marginBottom: 22, lineHeight: 1.55 }}>
                Review our terms of service and privacy practices.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ padding: '16px', border: '1px solid #edebd6', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0d1f0e' }}>Terms & Conditions</div>
                    <div style={{ fontSize: '0.75rem', color: '#5e7a61', marginTop: 2 }}>Rules and guidelines for using the Smart Poultry platform.</div>
                  </div>
                  <Link to="/terms" style={{ padding: '6px 12px', background: '#237227', color: '#fff', borderRadius: '6px', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 500 }}>
                    View
                  </Link>
                </div>
                <div style={{ padding: '16px', border: '1px solid #edebd6', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0d1f0e' }}>Privacy Policy</div>
                    <div style={{ fontSize: '0.75rem', color: '#5e7a61', marginTop: 2 }}>How we collect, use, and protect your data and AI insights.</div>
                  </div>
                  <Link to="/privacy" style={{ padding: '6px 12px', background: '#237227', color: '#fff', borderRadius: '6px', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 500 }}>
                    View
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
