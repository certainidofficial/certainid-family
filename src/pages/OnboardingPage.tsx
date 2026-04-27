import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { registerUser } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

const AGE_TIERS = [
  { value: 'under13', label: 'Under 13' },
  { value: 'age13to15', label: '13 – 15' },
  { value: 'age16to17', label: '16 – 17' },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, setUser } = useAuthStore();
  const inviteCode = searchParams.get('code') || '';

  const [step, setStep] = useState<'role' | 'age-tier'>('role');
  const [ageTier, setAgeTier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRoleSelect(role: 'parent' | 'child') {
    if (role === 'child') {
      setStep('age-tier');
    } else {
      await completeOnboarding('parent', undefined);
    }
  }

  async function completeOnboarding(role: 'parent' | 'child', tier?: string) {
    setLoading(true);
    setError('');
    try {
      // Re-fetch from Supabase if the store's user was wiped by an auth event
      let activeUser = user;
      if (!activeUser) {
        const { data: { user: sbUser } } = await supabase.auth.getUser();
        if (!sbUser) {
          setError('Session expired. Please sign in again.');
          setLoading(false);
          return;
        }
        activeUser = {
          uid: sbUser.id,
          email: sbUser.email ?? null,
          displayName: (sbUser.user_metadata?.full_name as string) ?? null,
          role: null,
        };
        setUser(activeUser);
      }
      await registerUser(activeUser.uid, activeUser.email ?? '', activeUser.displayName ?? 'User', role, tier);
      setUser({ ...activeUser, role, ageTier: tier });
      if (role === 'parent') {
        navigate(inviteCode ? `/join?code=${inviteCode}` : '/dashboard', { replace: true });
      } else {
        navigate('/child', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to set up your account. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-50 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-indigo-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6l-8-4z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome to CertainID Family</h1>
          <p className="mt-2 text-slate-500 text-sm">
            {step === 'role' ? 'How will you be using this app?' : 'One more thing — what is your age group?'}
          </p>
        </div>

        {step === 'role' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <RoleCard
              emoji="👨‍👩‍👧"
              title="I'm a Parent"
              description="Monitor and approve your child's posts before they go live"
              onClick={() => handleRoleSelect('parent')}
              disabled={loading}
            />
            <RoleCard
              emoji="🧒"
              title="I'm a Young Person"
              description="Share posts with your parent's approval"
              onClick={() => handleRoleSelect('child')}
              disabled={loading}
            />
          </div>
        )}

        {step === 'age-tier' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <p className="text-slate-700 font-semibold mb-4">Select your age group</p>
            <div className="space-y-2">
              {AGE_TIERS.map((tier) => (
                <button
                  key={tier.value}
                  onClick={() => { setAgeTier(tier.value); setError(''); }}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                    ageTier === tier.value
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>

            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setStep('role'); setAgeTier(''); setError(''); }}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => { if (!ageTier) { setError('Please select your age group.'); return; } completeOnboarding('child', ageTier); }}
                disabled={loading || !ageTier}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? 'Setting up...' : 'Continue'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RoleCard({ emoji, title, description, onClick, disabled }: {
  emoji: string; title: string; description: string; onClick: () => void; disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group flex flex-col items-center text-center gap-3 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl p-6 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className="text-4xl">{emoji}</span>
      <div>
        <p className="text-slate-800 font-semibold text-base">{title}</p>
        <p className="mt-1 text-slate-500 text-xs leading-relaxed">{description}</p>
      </div>
    </button>
  );
}
