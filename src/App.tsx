import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
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
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Preserve existing role from store if this is a returning user
        const existingUser = useAuthStore.getState().user;
        const role = existingUser?.uid === firebaseUser.uid ? existingUser?.role ?? null : null;
        const ageTier =
          existingUser?.uid === firebaseUser.uid ? existingUser?.ageTier : undefined;

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          role,
          ageTier,
        });

        // If no role, redirect to onboarding (new user)
        if (!role) {
          navigate('/onboarding', { replace: true });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
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
      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
