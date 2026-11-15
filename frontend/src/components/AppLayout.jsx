import { LayoutDashboard, LogOut, ReceiptText } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import NotificationBell from './NotificationBell';

export default function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/dashboard">
          <span className="brand-mark">F</span>
          <span>FinTrack</span>
        </NavLink>
        <nav className="main-nav" aria-label="Main navigation">
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
            <LayoutDashboard size={17} />
            Dashboard
          </NavLink>
          <NavLink to="/transactions" className={({ isActive }) => (isActive ? 'active' : '')}>
            <ReceiptText size={17} />
            Transactions
          </NavLink>
        </nav>
        <div className="topbar-actions">
          <span className="user-email">{user?.email}</span>
          <NotificationBell />
          <button className="icon-button logout-button" type="button" onClick={logout} aria-label="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
