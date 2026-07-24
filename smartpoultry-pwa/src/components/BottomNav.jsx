import { NavLink } from 'react-router-dom';
import { ShoppingCart, FileText, Settings, Truck, Store, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './BottomNav.css';

export default function BottomNav() {
  const { role } = useAuth();

  const getNavItems = () => {
    if (role === 'DELIVERY') {
      return [
        { label: 'Vehicle', icon: Truck, to: '/delivery/vehicle' },
        { label: 'Deliveries', icon: FileText, to: '/delivery/orders' },
        { label: 'Earnings', icon: Wallet, to: '/delivery/earnings' },
        { label: 'Settings', icon: Settings, to: '/settings' }
      ];
    }
    if (role === 'CUSTOMER') {
      return [
        { label: 'Market', icon: Store, to: '/customer/marketplace' },
        { label: 'Orders', icon: FileText, to: '/customer/orders' },
        { label: 'Settings', icon: Settings, to: '/settings' }
      ];
    }
    return [];
  };

  const navItems = getNavItems();

  if (navItems.length === 0) return null;

  return (
    <nav className="bottom-nav">
      {navItems.map(({ label, icon: Icon, to }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <Icon size={24} className="icon" />
          <span className="label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
