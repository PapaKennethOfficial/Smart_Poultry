import { NavLink } from 'react-router-dom';
import { ShoppingCart, FileText, Settings, Truck, Leaf, LogOut, ShoppingBag, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import './DesktopSidebar.css';

export default function DesktopSidebar() {
  const { role, logout } = useAuth();
  const { cartCount, setIsCartOpen } = useCart();

  const getNavItems = () => {
    if (role === 'DELIVERY') {
      return [
        { label: 'Vehicle Log', icon: Truck, to: '/delivery/vehicle' },
        { label: 'Assigned Orders', icon: FileText, to: '/delivery/orders' },
        { label: 'Earnings', icon: Wallet, to: '/delivery/earnings' },
        { label: 'Settings', icon: Settings, to: '/settings' }
      ];
    }
    if (role === 'CUSTOMER') {
      return [
        { label: 'Marketplace', icon: ShoppingCart, to: '/customer/marketplace' },
        { label: 'My Orders', icon: FileText, to: '/customer/orders' },
        { label: 'Settings', icon: Settings, to: '/settings' }
      ];
    }
    return [];
  };

  const navItems = getNavItems();

  const handleLogout = () => {
    logout();
  };

  if (navItems.length === 0) return null;

  return (
    <aside className="desktop-sidebar">
      {/* Logo */}
      <div className="desktop-sidebar-logo" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="brand">
          <Leaf size={18} color="#FFAA00" />
          Smart<span style={{ color: '#84be88' }}>Poultry</span>
          <span className="dot" />
        </div>
        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.28)', marginTop: 4, paddingLeft: 26 }}>
          AI Farm Management
        </div>
      </div>
      
      <div className="desktop-sidebar-nav">
        <div className="desktop-nav-section-label">Main Menu</div>
        {navItems.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `desktop-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={16} className="icon" />
            <span>{label}</span>
          </NavLink>
        ))}

        <div className="desktop-nav-section-label" style={{ marginTop: 12 }}>System</div>
        {role === 'CUSTOMER' && (
          <button className="desktop-nav-item desktop-logout-btn" onClick={() => setIsCartOpen(true)} style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ShoppingBag size={16} className="icon" />
              <span>Cart</span>
            </div>
            {cartCount > 0 && <span className="cart-badge" style={{ position: 'relative', top: 0, right: 0, transform: 'none' }}>{cartCount}</span>}
          </button>
        )}
        <button
          className="desktop-nav-item desktop-logout-btn"
          style={{ color: 'rgba(239,68,68,0.75)' }}
          onClick={handleLogout}
        >
          <LogOut size={16} className="icon" />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
}
