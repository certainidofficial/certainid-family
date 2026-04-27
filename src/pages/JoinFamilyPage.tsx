import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { joinFamily } from '../lib/api';

export default function JoinFamilyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();

  const urlCode = searchParams.get('code')?.toUpperCase() || '';
  const [code, setCode] = useState(urlCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoJoining, setAutoJoining] = useState(!!urlCode);

  const isParent = user?.role === 'parent';

  // Fire auto-join when role becomes available
  useEffect(() => {
    if (urlCode && user?.role) handleJoin(urlCode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  // Timeout fallback: if auto-join hasn't resolved in 10s, show manual form
  useEffect(() => {
    if (!autoJoining) return;
    const t = setTimeout(() => setAutoJoining(false), 10000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleJoin(joinCode = code) {
    if (!joinCode.trim() || !user) return;
    setLoading(true);
    setError('');
    try {
      if (isParent) {
        const res = await fetch('/api/family/accept-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentId: user.uid, inviteCode: joinCode.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to accept invite');
        navigate('/dashboard', { replace: true });
      } else {
        await joinFamily(user.uid, joinCode.trim());
        navigate('/child', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Invalid code. Please check and try again.');
      setAutoJoining(false);
    } finally {
      setLoading(false);
    }
  }

  // Show spinner while waiting for role — bounded by the 10s timeout above
  if (autoJoining && !user?.role && !error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">{isParent ? '👨‍👩‍👧' : '🔑'}</div>
          <h1 className="text-xl font-bold text-slate-800">
            {isParent ? "Accept your child's invite" : 'Enter the code from your parent'}
          </h1>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            {isParent
              ? 'Enter the 6-character code your child sent you.'
              : 'Ask your parent for their invite code and enter it below.'}
          </p>
        </div>

        {autoJoining && !error ? (
          <div className="text-center space-y-4">
            <div className="w-10 h-10 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-500 text-sm">Connecting your accounts...</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <input
              type="text"
              placeholder="ABC123"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)); setError(''); }}
              maxLength={6}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-center text-2xl font-mono font-bold text-slate-800 tracking-widest focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition uppercase"
            />

            {error && <p className="text-xs text-red-500 text-center">{error}</p>}

            <button
              onClick={() => handleJoin()}
              disabled={loading || code.length < 6}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Connect accounts'}
            </button>

            <button
              onClick={() => navigate(isParent ? '/dashboard' : '/child')}
              className="w-full text-slate-400 text-sm hover:text-slate-600 transition-colors text-center py-1"
            >
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
