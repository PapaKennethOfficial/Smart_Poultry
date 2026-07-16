import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, BarChart2, Truck, Package,
  FileText, Settings, LogOut, Leaf, ShoppingCart, ShieldCheck
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { X } from 'lucide-react'

export default function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate()
  const { logout, user, role } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getNavItems = () => {
    if (role === 'MANAGER' || role === 'ADMIN') {
      return [
        { label: 'Dashboard',            icon: LayoutDashboard, to: '/admin/dashboard' },
        { label: 'Vehicle Verification', icon: ShieldCheck,     to: '/admin/dashboard/verify-vehicles' },
        { label: 'Customer Orders',      icon: ShoppingCart,    to: '/admin/dashboard/orders' },
        { label: 'Inventory',            icon: Package,         to: '/admin/dashboard/inventory' },
        { label: 'Deliveries',           icon: Truck,           to: '/admin/deliveries' },
        { label: 'Farm Logbook',         icon: BookOpen,        to: '/admin/logbook' },
        { label: 'Analytics & AI',       icon: BarChart2,       to: '/admin/analytics' },
        { label: 'Reports',              icon: FileText,        to: '/admin/reports' },
      ]
    }
    // Note: Drivers and Customers don't use the Sidebar anymore in the new mobile-first design,
    // but we leave this here just in case of future desktop client portal usage.
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

  const handleNavClick = () => {
    if (onClose) onClose()
  }

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
            end={to === '/admin/dashboard'}
            onClick={handleNavClick}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={16} className="icon" />
            {label}
          </NavLink>
        ))}

        <div className="nav-section-label" style={{ marginTop: 12 }}>System</div>
        <NavLink
          to="/admin/settings"
          onClick={handleNavClick}
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
