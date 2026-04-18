import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

function ShieldIcon() {
  return (
    <svg
      className="w-12 h-12 text-[#6366f1]"
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6l-8-4z" />
    </svg>
  );
}

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Incorrect email or password.';
  if (m.includes('already registered') || m.includes('already exists')) return 'An account with this email already exists.';
  if (m.includes('password') && m.includes('6')) return 'Password must be at least 6 characters.';
  if (m.includes('email') && m.includes('valid')) return 'Please enter a valid email address.';
  if (m.includes('confirm')) return 'Please check your email to confirm your account.';
  return 'Something went wrong. Please try again.';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
        if (!data.user) throw new Error('Signup failed — no user returned.');

        setUser({
          uid: data.user.id,
          email: data.user.email ?? null,
          displayName: (data.user.user_metadata?.full_name as string) ?? null,
          role: null,
        });
        navigate('/onboarding');
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
        if (!data.user) throw new Error('Sign in failed — no user returned.');

        setUser({
          uid: data.user.id,
          email: data.user.email ?? null,
          displayName: (data.user.user_metadata?.full_name as string) ?? null,
          role: null,
        });
        navigate('/');
      }
    } catch (err: any) {
      setError(friendlyError(err.message || ''));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <ShieldIcon />
          <h1 className="mt-3 text-2xl font-bold text-white tracking-tight">CertainID Family</h1>
          <p className="mt-1 text-sm text-slate-400">Keep your family safe online</p>
        </div>

        <div className="bg-[#1e293b] rounded-2xl p-6 shadow-xl">
          <form onSubmit={handleEmailSubmit} noValidate>
            <div className="space-y-3">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-[#0f172a] border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#6366f1] transition-colors"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className="w-full bg-[#0f172a] border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#6366f1] transition-colors"
              />
              {mode === 'signup' && (
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full bg-[#0f172a] border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#6366f1] transition-colors"
                />
              )}
            </div>

            {error && (
              <p className="mt-3 text-xs text-red-400 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-4 w-full bg-[#6366f1] hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting
                ? mode === 'signup'
                  ? 'Creating account...'
                  : 'Signing in...'
                : mode === 'signup'
                ? 'Create account'
                : 'Sign in'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-400">
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError('');
                setPassword('');
                setConfirmPassword('');
              }}
              className="text-[#6366f1] font-semibold hover:underline"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
