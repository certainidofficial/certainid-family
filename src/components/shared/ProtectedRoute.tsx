import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import LoadingScreen from './LoadingScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
  role?: 'parent' | 'child';
}

export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { user, loading } = useAuthStore();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.role) return <Navigate to="/onboarding" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'parent' ? '/dashboard' : '/child'} replace />;
  }

  return <>{children}</>;
}
