import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser } from '../lib/api';
import { useAuthStore } from '../store/authStore';

const AGE_TIERS = [
  { value: 'under13', label: 'Under 13' },
  { value: 'age13to15', label: '13 – 15' },
  { value: 'age16to17', label: '16 – 17' },
];

function UsersIcon() {
  return (
    <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();

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

  async function handleAgeTierContinue() {
    if (!ageTier) {
      setError('Please select your age group.');
      return;
    }
    await completeOnboarding('child', ageTier);
  }

  async function completeOnboarding(role: 'parent' | 'child', tier?: string) {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      await registerUser(
        user.uid,
        user.email ?? '',
        user.displayName ?? 'User',
        role,
        tier
      );
      setUser({ ...user, role, ageTier: tier });
      navigate(role === 'parent' ? '/dashboard' : '/child', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to set up your account. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Welcome to CertainID Family</h1>
          <p className="mt-2 text-slate-400 text-sm">
            {step === 'role'
              ? "Let's get you set up. How will you be using this app?"
              : 'One more thing — what is your age group?'}
          </p>
        </div>

        {step === 'role' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <RoleCard
              icon={<UsersIcon />}
              title="I'm a Parent"
              description="Manage your child's online activity and approvals"
              onClick={() => handleRoleSelect('parent')}
              disabled={loading}
            />
            <RoleCard
              icon={<PersonIcon />}
              title="I'm a Young Person"
              description="Share posts with parent approval"
              onClick={() => handleRoleSelect('child')}
              disabled={loading}
            />
          </div>
        )}

        {step === 'age-tier' && (
          <div className="bg-[#1e293b] rounded-2xl p-6">
            <p className="text-white font-semibold mb-4">Select your age group</p>
            <div className="space-y-3">
              {AGE_TIERS.map((tier) => (
                <button
                  key={tier.value}
                  onClick={() => {
                    setAgeTier(tier.value);
                    setError('');
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors font-medium text-sm ${
                    ageTier === tier.value
                      ? 'border-[#6366f1] bg-indigo-900/30 text-white'
                      : 'border-slate-600 text-slate-300 hover:border-slate-400'
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>

            {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setStep('role');
                  setAgeTier('');
                  setError('');
                }}
                className="flex-1 py-2.5 px-4 rounded-lg border border-slate-600 text-slate-300 text-sm font-medium hover:border-slate-400 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleAgeTierContinue}
                disabled={loading || !ageTier}
                className="flex-1 py-2.5 px-4 rounded-lg bg-[#6366f1] hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? 'Setting up...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {loading && step === 'role' && (
          <div className="mt-6 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

interface RoleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled: boolean;
}

function RoleCard({ icon, title, description, onClick, disabled }: RoleCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group flex flex-col items-center text-center gap-4 bg-[#1e293b] hover:bg-slate-700 border border-slate-700 hover:border-[#6366f1] rounded-2xl p-6 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className="text-[#6366f1] group-hover:scale-110 transition-transform">{icon}</span>
      <div>
        <p className="text-white font-semibold text-base">{title}</p>
        <p className="mt-1 text-slate-400 text-xs leading-relaxed">{description}</p>
      </div>
    </button>
  );
}
