import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, BarChart2, Truck,
  FileText, Settings, LogOut, Leaf, ShoppingCart, ShieldCheck
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Sidebar() {
  const navigate = useNavigate()
  const { logout, user, role } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getNavItems = () => {
    if (role === 'MANAGER' || role === 'ADMIN') {
      return [
        { label: 'Dashboard',            icon: LayoutDashboard, to: '/dashboard' },
        { label: 'Vehicle Verification', icon: ShieldCheck,     to: '/dashboard/verify-vehicles' },
        { label: 'Customer Orders',      icon: ShoppingCart,    to: '/dashboard/orders' },
        { label: 'Deliveries',           icon: Truck,           to: '/deliveries' },
        { label: 'Farm Logbook',         icon: BookOpen,        to: '/logbook' },
        { label: 'Analytics & AI',       icon: BarChart2,       to: '/analytics' },
        { label: 'Reports',              icon: FileText,        to: '/reports' },
      ]
    }
    if (role === 'DELIVERY') {
      return [
        { label: 'My Vehicle', icon: Truck, to: '/delivery/vehicle' },
        { label: 'Assigned Deliveries', icon: FileText, to: '/delivery/orders' },
      ]
    }
    if (role === 'CUSTOMER') {
      return [
        { label: 'Marketplace', icon: ShoppingCart, to: '/customer/marketplace' },
        { label: 'My Orders', icon: FileText, to: '/customer/orders' },
      ]
    }
    return []
  }

  const navItems = getNavItems()

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="brand">
          <Leaf size={18} color="#FFAA00" />
          Smart<span style={{ color: '#84be88' }}>Poultry</span>
          <span className="dot" />
        </div>
        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.28)', marginTop: 4, paddingLeft: 26 }}>
          AI Farm Management
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Main Menu</div>
        {navItems.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={16} className="icon" />
            {label}
          </NavLink>
        ))}

        <div className="nav-section-label" style={{ marginTop: 12 }}>System</div>
        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <Settings size={16} className="icon" />
          Settings
        </NavLink>

        <div
          className="nav-item"
          style={{ marginTop: 'auto', color: 'rgba(239,68,68,0.75)' }}
          onClick={handleLogout}
        >
          <LogOut size={16} className="icon" />
          Logout
        </div>
      </nav>

      {/* User */}
      <div className="sidebar-user">
        <div className="user-avatar">{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</div>
        <div className="user-info">
          <div className="name">{user?.name || 'User'}</div>
          <div className="role">{role}</div>
        </div>
      </div>
    </aside>
  )
}
