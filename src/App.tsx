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

async function fetchRoleFromDB(uid: string): Promise<{ role: 'parent' | 'child' | null; ageTier?: string; displayName?: string }> {
  const { data } = await supabase
    .from('family_users')
    .select('role, age_tier, display_name')
    .eq('id', uid)
    .maybeSingle();
  if (!data) return { role: null };
  return { role: data.role as 'parent' | 'child', ageTier: data.age_tier ?? undefined, displayName: data.display_name ?? undefined };
}

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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const existingUser = useAuthStore.getState().user;
        // Use cached role if uid matches; otherwise fetch from DB
        let role = existingUser?.uid === session.user.id ? existingUser?.role ?? null : null;
        let ageTier = existingUser?.uid === session.user.id ? existingUser?.ageTier : undefined;
        let displayName = (session.user.user_metadata?.full_name as string) ?? existingUser?.displayName ?? null;

        if (!role) {
          const db = await fetchRoleFromDB(session.user.id);
          role = db.role;
          ageTier = db.ageTier;
          displayName = db.displayName ?? displayName;
        }

        setUser({ uid: session.user.id, email: session.user.email ?? null, displayName, role, ageTier });

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
        const displayName = (session.user.user_metadata?.full_name as string) ?? existingUser?.displayName ?? null;
        setUser({ uid: session.user.id, email: session.user.email ?? null, displayName, role, ageTier });
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
