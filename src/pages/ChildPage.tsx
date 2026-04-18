import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { submitPost, getAuditLog, type SubmitPostResult, type AuditEntry } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import PlatformBadge from '../components/shared/PlatformBadge';

const PLATFORMS = ['YouTube', 'TikTok', 'Instagram', 'Snapchat', 'X', 'Discord'];
const MAX_CHARS = 500;

type SubmitState =
  | { type: 'idle' }
  | { type: 'success'; parentName?: string }
  | { type: 'flagged'; flags: string[] };

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Pending: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800',
    Approved: 'bg-green-900/40 text-green-400 border border-green-800',
    Rejected: 'bg-red-900/40 text-red-400 border border-red-800',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles[status] ?? 'bg-slate-700 text-slate-300'}`}>
      {status}
    </span>
  );
}

export default function ChildPage() {
  const navigate = useNavigate();
  const { user, setUser, setLoading } = useAuthStore();

  const [platform, setPlatform] = useState('');
  const [content, setContent] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>({ type: 'idle' });
  const [validationError, setValidationError] = useState('');

  // TODO: wire to getAuditLog for real post history
  const { data: auditLog = [] } = useQuery<AuditEntry[]>({
    queryKey: ['audit-log', user?.uid ?? ''],
    queryFn: () => getAuditLog(user!.uid),
    enabled: !!user,
  });

  const submitMutation = useMutation<SubmitPostResult, Error, { childId: string; content: string; platform: string }>({
    mutationFn: ({ childId, content, platform }) => submitPost(childId, content, platform),
    onSuccess: (data) => {
      if (data.flags && data.flags.length > 0) {
        setSubmitState({ type: 'flagged', flags: data.flags });
      } else if (data.requiresApproval) {
        setSubmitState({ type: 'success', parentName: data.parentName });
        setContent('');
        setPlatform('');
      }
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError('');

    if (!platform) {
      setValidationError('Please select a platform.');
      return;
    }
    if (content.trim().length < 1) {
      setValidationError('Please enter what you would like to post.');
      return;
    }
    if (!user) return;

    setSubmitState({ type: 'idle' });
    submitMutation.mutate({ childId: user.uid, content: content.trim(), platform });
  }

  async function handleLogout() {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setLoading(false);
    navigate('/login', { replace: true });
  }

  const remaining = MAX_CHARS - content.length;

  // Build a simple post history from audit log entries
  const postHistory = auditLog.slice(0, 5);

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col">
      {/* Header */}
      <header className="bg-[#1e293b] border-b border-slate-700 px-4 py-3 flex items-center justify-between">
        <h1 className="text-white font-bold text-base">
          Hi, {user?.displayName?.split(' ')[0] || 'there'}
        </h1>
        <button
          onClick={handleLogout}
          className="text-xs text-slate-400 hover:text-white border border-slate-600 hover:border-slate-400 px-3 py-1.5 rounded-lg transition-colors"
        >
          Sign Out
        </button>
      </header>

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-6">
        {/* Submit Card */}
        <div className="bg-[#1e293b] rounded-2xl p-5">
          <h2 className="text-white font-bold text-lg mb-5">Share a Post</h2>

          <form onSubmit={handleSubmit} noValidate>
            {/* Platform Selector */}
            <p className="text-xs font-medium text-slate-400 mb-2">Choose a platform</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPlatform(p);
                    setValidationError('');
                    setSubmitState({ type: 'idle' });
                  }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    platform === p
                      ? 'border-[#6366f1] bg-indigo-900/40 text-indigo-300'
                      : 'border-slate-600 text-slate-400 hover:border-slate-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Textarea */}
            <p className="text-xs font-medium text-slate-400 mb-2">What would you like to post?</p>
            <div className="relative">
              <textarea
                value={content}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_CHARS) {
                    setContent(e.target.value);
                    setValidationError('');
                    setSubmitState({ type: 'idle' });
                  }
                }}
                placeholder="What would you like to post?"
                rows={5}
                className="w-full bg-[#0f172a] border border-slate-600 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-[#6366f1] transition-colors"
              />
              <span
                className={`absolute bottom-3 right-3 text-xs ${
                  remaining < 50 ? 'text-red-400' : 'text-slate-500'
                }`}
              >
                {remaining}
              </span>
            </div>

            {/* Validation / mutation errors */}
            {validationError && (
              <p className="mt-2 text-xs text-red-400">{validationError}</p>
            )}
            {submitMutation.isError && (
              <p className="mt-2 text-xs text-red-400">
                {submitMutation.error?.message || 'Something went wrong. Please try again.'}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="mt-4 w-full bg-[#6366f1] hover:bg-indigo-500 text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
            >
              {submitMutation.isPending ? 'Sending...' : 'Submit for Approval'}
            </button>
          </form>
        </div>

        {/* Result states */}
        {submitState.type === 'success' && (
          <div className="bg-green-900/30 border border-green-700 rounded-2xl p-5">
            <p className="text-green-300 font-semibold text-sm">Sent for approval!</p>
            <p className="text-green-400/80 text-sm mt-1 leading-relaxed">
              {submitState.parentName
                ? `Sent to ${submitState.parentName} for approval! You'll be able to post once they approve it.`
                : "Sent to your parent for approval! You'll be able to post once they approve it."}
            </p>
          </div>
        )}

        {submitState.type === 'flagged' && (
          <div className="bg-orange-900/30 border border-orange-700 rounded-2xl p-5">
            <p className="text-orange-300 font-semibold text-sm">We noticed something in your post</p>
            <ul className="mt-2 space-y-1">
              {submitState.flags.map((flag, i) => (
                <li key={i} className="text-orange-400/80 text-sm flex items-start gap-2">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                  {flag}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-orange-400/70 text-xs">Please review your post before submitting.</p>
            <button
              onClick={() => setSubmitState({ type: 'idle' })}
              className="mt-3 text-xs text-orange-300 hover:underline"
            >
              Edit my post
            </button>
          </div>
        )}

        {/* Post History */}
        {postHistory.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Recent Posts
            </h3>
            <div className="space-y-3">
              {postHistory.map((entry) => {
                const status = entry.action.includes('approved')
                  ? 'Approved'
                  : entry.action.includes('rejected')
                  ? 'Rejected'
                  : 'Pending';

                return (
                  <div key={entry.id} className="bg-[#1e293b] rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      {entry.platform && <PlatformBadge platform={entry.platform} />}
                      <StatusBadge status={status} />
                    </div>
                    <p className="text-slate-400 text-xs mt-1">{entry.action}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
