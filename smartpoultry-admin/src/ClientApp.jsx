import { useState, useRef, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LogOut, User, ChevronDown, Bell, ShoppingCart, ArrowLeft, Leaf, Plus, Minus, ShoppingBag, X } from 'lucide-react';
import ProtectedRoute from './components/ProtectedRoute';
import BottomNav from './components/BottomNav';
import api from './api/axios';
import { useCart } from './context/CartContext';

import VehicleRegistration from './pages/VehicleRegistration';
import AssignedDeliveries from './pages/AssignedDeliveries';
import CustomerMarketplace from './pages/CustomerMarketplace';
import CustomerOrders from './pages/CustomerOrders';
import CustomerWishlist from './pages/CustomerWishlist';
import Settings from './pages/ClientSettings';
import DesktopSidebar from './components/DesktopSidebar';
import CartDrawer from './components/CartDrawer';
import OnboardingTour from './components/OnboardingTour';

export default function ClientApp() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  // Cart & Notifications
  const { cart, isCartOpen, setIsCartOpen, toggleCart, removeFromCart, addToCart, clearCart } = useCart();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifTab, setNotifTab] = useState('unread');
  const notifRef = useRef(null);


  // Click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Poll notifications
  useEffect(() => {
    if (!user) return;
    const loadNotifications = () => {
      api.get('/api/notifications')
        .then(res => {
          setNotifications(res.data.notifications || []);
          setUnreadCount(res.data.unreadCount || 0);
        })
        .catch(() => {});
    };
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleNotificationClick = async () => {
    const nextOpen = !showNotifications;
    setShowNotifications(nextOpen);
    if (!nextOpen || unreadCount === 0) return;
    try {
      await api.patch('/api/notifications/read-all');
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch {
      // Ignore
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const showBackButton = location.pathname !== '/customer/marketplace' && location.pathname !== '/delivery/orders' && location.pathname !== '/delivery/vehicle' && location.pathname !== '/customer/orders';

  const displayName = user?.name || user?.email || (role === 'DELIVERY' ? 'Driver' : 'Customer');
  const roleLabel = role === 'DELIVERY' ? 'Delivery Staff' : 'Customer';

  return (
    <div className="desktop-app-container">
      {/* Desktop Sidebar (Hidden on mobile via CSS) */}
      <div className="desktop-sidebar-wrapper">
        <DesktopSidebar />
      </div>
      
      <div className="desktop-content-area">
        {/* Top header with branding and user menu (Hidden on desktop via CSS) */}
        <header className="client-header">
          <div className="client-header-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {showBackButton && (
              <button onClick={() => navigate(-1)} className="client-back-btn" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <ArrowLeft size={20} color="#fff" />
              </button>
            )}
            <div className="client-header-logo" style={{ background: 'linear-gradient(135deg, rgba(35, 114, 39, 0.8), rgba(132, 190, 136, 0.8))', border: 'none' }}>
              <Leaf color="#fff" size={16} strokeWidth={2.5} />
            </div>
            <span className="client-header-title">SmartPoultry</span>
          </div>

          <div className="client-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {role === 'CUSTOMER' && (
              <button className="client-action-icon" onClick={toggleCart}>
                <ShoppingCart size={20} color="#fff" />
                {Object.keys(cart).length > 0 && <span className="cart-badge">{Object.keys(cart).length}</span>}
              </button>
            )}
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button className="client-action-icon" onClick={handleNotificationClick}>
                <Bell size={20} color="#fff" />
                {unreadCount > 0 && <span className="cart-badge" style={{ background: '#ef4444' }}>{unreadCount}</span>}
              </button>
              {showNotifications && (
                <div className="client-dropdown notif-dropdown">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-heading)' }}>Notifications</div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, borderBottom: '1px solid var(--border-light)' }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setNotifTab('unread'); }}
                      style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, background: 'none', border: 'none', borderBottom: notifTab === 'unread' ? '2px solid var(--primary)' : '2px solid transparent', color: notifTab === 'unread' ? 'var(--primary)' : 'var(--text-subtle)', cursor: 'pointer' }}
                    >
                      Unread
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setNotifTab('all'); }}
                      style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, background: 'none', border: 'none', borderBottom: notifTab === 'all' ? '2px solid var(--primary)' : '2px solid transparent', color: notifTab === 'all' ? 'var(--primary)' : 'var(--text-subtle)', cursor: 'pointer' }}
                    >
                      All
                    </button>
                  </div>

                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {notifications.filter(n => notifTab === 'all' || !n.isRead).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-subtle)', fontSize: '0.8rem' }}>No {notifTab} notifications</div>
                    ) : notifications.filter(n => notifTab === 'all' || !n.isRead).map(n => (
                      <div key={n.id} style={{
                        padding: '12px 10px', borderRadius: 8, marginBottom: 4,
                        background: n.isRead ? 'transparent' : 'var(--bg)',
                        border: '1px solid var(--border-light)',
                      }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-heading)' }}>{n.title}</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{n.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="client-header-user" ref={dropdownRef}>
              <button
                className="client-user-btn"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <div className="client-avatar" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={14} />
                  )}
                </div>
                <ChevronDown size={14} style={{
                  transition: 'transform 0.2s',
                  transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  opacity: 0.6,
                  color: '#fff'
                }} />
              </button>

              {menuOpen && (
                <div className="client-dropdown">
                  <div className="client-dropdown-info">
                    <p className="client-dropdown-name">{displayName}</p>
                    <p className="client-dropdown-role">{roleLabel}</p>
                  </div>
                  <div className="client-dropdown-divider" />
                  <button className="client-dropdown-item" onClick={() => { setMenuOpen(false); navigate('/settings'); }}>
                    <User size={15} />
                    Settings
                  </button>
                  <button className="client-dropdown-item client-dropdown-logout" onClick={handleLogout}>
                    <LogOut size={15} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="client-main">
          <Routes>
            {/* Delivery routes */}
            <Route path="delivery/vehicle" element={<ProtectedRoute allowedRoles={['DELIVERY']}><VehicleRegistration /></ProtectedRoute>} />
            <Route path="delivery/orders" element={<ProtectedRoute allowedRoles={['DELIVERY']}><AssignedDeliveries /></ProtectedRoute>} />

            {/* Customer routes */}
            <Route path="customer/marketplace" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><CustomerMarketplace /></ProtectedRoute>} />
            <Route path="customer/orders" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><CustomerOrders /></ProtectedRoute>} />
            <Route path="customer/wishlist" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><CustomerWishlist /></ProtectedRoute>} />

            {/* Shared settings */}
            <Route path="settings" element={<ProtectedRoute allowedRoles={['CUSTOMER', 'DELIVERY']}><Settings /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <div className="mobile-bottom-nav-wrapper">
          <BottomNav />
        </div>

        {/* Global Cart Drawer Overlay */}
        {role === 'CUSTOMER' && <CartDrawer />}

        {/* Onboarding Tour */}
        {role === 'CUSTOMER' && <OnboardingTour />}
      </div>
    </div>
  );
}
