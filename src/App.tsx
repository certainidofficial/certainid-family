import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/authStore';
import LoadingScreen from './components/shared/LoadingScreen';
import ProtectedRoute from './components/shared/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import ParentDashboard from './pages/ParentDashboard';
import ChildPage from './pages/ChildPage';
import JoinFamilyPage from './pages/JoinFamilyPage';

function RootRedirect() {
  const { user, loading } = useAuthStore();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.role) return <Navigate to="/onboarding" replace />;
  if (user.role === 'parent') return <Navigate to="/dashboard" replace />;
  return <Navigate to="/child" replace />;
}

export default function App() {
  const { loading, setUser, setLoading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const existingUser = useAuthStore.getState().user;
        const role = existingUser?.uid === session.user.id ? existingUser?.role ?? null : null;
        const ageTier = existingUser?.uid === session.user.id ? existingUser?.ageTier : undefined;

        setUser({
          uid: session.user.id,
          email: session.user.email ?? null,
          displayName: (session.user.user_metadata?.full_name as string) ?? null,
          role,
          ageTier,
        });

        if (!role) {
          navigate('/onboarding', { replace: true });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const existingUser = useAuthStore.getState().user;
        const role = existingUser?.uid === session.user.id ? existingUser?.role ?? null : null;
        const ageTier = existingUser?.uid === session.user.id ? existingUser?.ageTier : undefined;

        setUser({
          uid: session.user.id,
          email: session.user.email ?? null,
          displayName: (session.user.user_metadata?.full_name as string) ?? null,
          role,
          ageTier,
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/join" element={<JoinFamilyPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute role="parent">
            <ParentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/child"
        element={
          <ProtectedRoute role="child">
            <ChildPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
