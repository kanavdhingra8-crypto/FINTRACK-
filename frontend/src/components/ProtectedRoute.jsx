import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function ProtectedRoute() {
  const { user, isRestoring } = useAuth();

  if (isRestoring) {
    return <main className="page-loading">Checking your session…</main>;
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
