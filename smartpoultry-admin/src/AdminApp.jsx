import { useState } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import ProtectedRoute from './components/ProtectedRoute';

import Dashboard from './pages/Dashboard';
import Logbook from './pages/Logbook';
import Analytics from './pages/Analytics';
import Deliveries from './pages/Deliveries';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import ManagerInventory from './pages/ManagerInventory';
import VehicleVerification from './pages/VehicleVerification';
import ManagerOrders from './pages/ManagerOrders';

export default function AdminApp() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
      <div className="main-layout">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="page-content">
          <Routes>
            <Route path="dashboard" element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}><Dashboard /></ProtectedRoute>} />
            <Route path="dashboard/verify-vehicles" element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}><VehicleVerification /></ProtectedRoute>} />
            <Route path="dashboard/orders" element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}><ManagerOrders /></ProtectedRoute>} />
            <Route path="dashboard/inventory" element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}><ManagerInventory /></ProtectedRoute>} />
            <Route path="logbook" element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}><Logbook /></ProtectedRoute>} />
            <Route path="analytics" element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}><Analytics /></ProtectedRoute>} />
            <Route path="deliveries" element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}><Deliveries /></ProtectedRoute>} />
            <Route path="reports" element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}><Reports /></ProtectedRoute>} />
            <Route path="settings" element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}><Settings /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </main>
        <footer style={{ padding: '20px', textAlign: 'center', fontSize: '0.85rem', color: '#8da58f', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
          <p>© {new Date().getFullYear()} SmartPoultry Admin. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
