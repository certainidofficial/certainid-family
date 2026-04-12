import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { joinFamily } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export default function JoinFamilyPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 6) {
      setError('Please enter your 6-character invite code.');
      return;
    }
    if (!user) {
      setError('You must be signed in to join a family.');
      return;
    }

    setLoading(true);
    try {
      await joinFamily(user.uid, trimmed);
      navigate('/child', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid or expired invite code. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Join Your Family</h1>
          <p className="mt-2 text-slate-400 text-sm">
            Enter the invite code from your parent to connect your account.
          </p>
        </div>

        <div className="bg-[#1e293b] rounded-2xl p-6">
          <form onSubmit={handleJoin} noValidate>
            <label htmlFor="invite-code" className="block text-sm font-medium text-slate-300 mb-2">
              Invite Code
            </label>
            <input
              id="invite-code"
              type="text"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
              }
              placeholder="XXXXXX"
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              className="w-full bg-[#0f172a] border border-slate-600 text-white placeholder-slate-500 rounded-lg px-4 py-3 text-2xl font-mono tracking-widest text-center focus:outline-none focus:border-[#6366f1] transition-colors"
            />

            {error && (
              <p className="mt-3 text-xs text-red-400 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || code.trim().length < 6}
              className="mt-5 w-full bg-[#6366f1] hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Joining...' : 'Join Family'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Ask your parent to go to their dashboard and tap "Add Child" to generate a code.
        </p>
      </div>
    </div>
  );
}
