import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { submitPost, type SubmitPostResult } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import PlatformBadge from '../components/shared/PlatformBadge';

const PLATFORMS = ['YouTube', 'TikTok', 'Instagram', 'Snapchat', 'X', 'Discord'];
const MAX_CHARS = 500;

type SubmitState = { type: 'idle' } | { type: 'success'; parentName?: string } | { type: 'flagged'; flags: string[] };

// ── Waiting / invite screen ──────────────────────────────────────────────────

function InviteParentScreen({ childId }: { childId: string }) {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const { setUser } = useAuthStore();
  const navigate = useNavigate();

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://certainid-family.vercel.app';

  async function generateInvite() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/family/create-child-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create invite');
      setInviteCode(data.inviteCode);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    const link = `${appUrl}/join?code=${inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function emailParent() {
    const link = `${appUrl}/join?code=${inviteCode}`;
    const subject = encodeURIComponent('Join me on CertainID Family');
    const body = encodeURIComponent(
      `Hi,\n\nI've signed up for CertainID Family and I need you to set up your parent account to get started.\n\nClick this link to create your account and accept my invite:\n${link}\n\nSee you there!`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-6 h-6 text-indigo-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6l-8-4z" />
          </svg>
          <span className="font-bold text-slate-800 text-sm">CertainID Family</span>
        </div>
        <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Sign out</button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {!inviteCode ? (
            <div className="text-center">
              <div className="text-6xl mb-4">🔒</div>
              <h1 className="text-xl font-bold text-slate-800">Almost there!</h1>
              <p className="mt-2 text-slate-500 text-sm leading-relaxed">
                A parent needs to join and approve your account before you can use the app.
              </p>
              <p className="mt-1 text-slate-400 text-xs leading-relaxed">
                Generate an invite link and send it to your parent — they just need to click it and set up their account.
              </p>

              {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

              <button
                onClick={generateInvite}
                disabled={loading}
                className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Generating...' : 'Get my invite link'}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="text-center">
                <div className="text-5xl mb-3">📨</div>
                <h1 className="text-xl font-bold text-slate-800">Send this to your parent</h1>
                <p className="mt-1 text-slate-500 text-sm">
                  Once they create an account and accept, you're all set.
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-center">
                <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide font-medium">Your invite code</p>
                <p className="text-4xl font-mono font-bold text-slate-800 tracking-widest">{inviteCode}</p>
                <p className="mt-2 text-xs text-slate-400">{`${typeof window !== 'undefined' ? window.location.origin : ''}/join?code=${inviteCode}`}</p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={emailParent}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <span>✉️</span> Email my parent
                </button>
                <button
                  onClick={copyLink}
                  className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl text-sm transition-colors"
                >
                  {copied ? '✓ Copied!' : 'Copy link (WhatsApp / Telegram / SMS)'}
                </button>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700 text-center leading-relaxed">
                Your parent's contact details stay on your device — we only send the invite when you tap "Email my parent".
              </div>

              <p className="text-center text-xs text-slate-400">
                Waiting for your parent to accept...
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Main child dashboard (only shown after parent is connected) ───────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Pending: 'bg-amber-50 text-amber-600 border border-amber-200',
    Approved: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    Rejected: 'bg-red-50 text-red-500 border border-red-200',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  );
}

function ChildDashboard({ parentId: _parentId }: { parentId: string }) {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();

  const [platform, setPlatform] = useState('');
  const [content, setContent] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>({ type: 'idle' });
  const [validationError, setValidationError] = useState('');

  const { data: auditLog = [] } = useQuery({
    queryKey: ['audit-log', user?.uid],
    queryFn: async () => {
      const { data } = await supabase
        .from('audit_log')
        .select('*')
        .eq('child_id', user!.uid)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!user,
  });

  const submitMutation = useMutation<SubmitPostResult, Error, { childId: string; content: string; platform: string }>({
    mutationFn: ({ childId, content, platform }) => submitPost(childId, content, platform),
    onSuccess: (data) => {
      if (data.flags?.length) {
        setSubmitState({ type: 'flagged', flags: data.flags });
      } else {
        setSubmitState({ type: 'success', parentName: data.parentName });
        setContent('');
        setPlatform('');
      }
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError('');
    if (!platform) { setValidationError('Please select a platform.'); return; }
    if (!content.trim()) { setValidationError('Please enter what you would like to post.'); return; }
    if (!user) return;
    setSubmitState({ type: 'idle' });
    submitMutation.mutate({ childId: user.uid, content: content.trim(), platform });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    navigate('/login', { replace: true });
  }

  const remaining = MAX_CHARS - content.length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-bold text-slate-800 text-sm">Hi, {user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there'} 👋</p>
          <p className="text-xs text-slate-400 mt-0.5">Your posts go to your parent first</p>
        </div>
        <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors">Sign out</button>
      </header>

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-5">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="font-bold text-slate-800 text-base mb-4">Submit a Post for Approval</h2>

          <form onSubmit={handleSubmit} noValidate>
            <p className="text-xs font-medium text-slate-500 mb-2">Platform</p>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { setPlatform(p); setValidationError(''); setSubmitState({ type: 'idle' }); }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    platform === p ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <p className="text-xs font-medium text-slate-500 mb-2">What would you like to post?</p>
            <div className="relative">
              <textarea
                value={content}
                onChange={(e) => { if (e.target.value.length <= MAX_CHARS) { setContent(e.target.value); setValidationError(''); setSubmitState({ type: 'idle' }); } }}
                placeholder="Write your post here..."
                rows={5}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              />
              <span className={`absolute bottom-3 right-3 text-xs ${remaining < 50 ? 'text-red-400' : 'text-slate-400'}`}>{remaining}</span>
            </div>

            {validationError && <p className="mt-2 text-xs text-red-500">{validationError}</p>}
            {submitMutation.isError && <p className="mt-2 text-xs text-red-500">{submitMutation.error?.message}</p>}

            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {submitMutation.isPending ? 'Sending...' : 'Submit for Approval'}
            </button>
          </form>
        </div>

        {submitState.type === 'success' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <p className="text-emerald-700 font-semibold text-sm">Sent for approval ✓</p>
            <p className="text-emerald-600 text-sm mt-1">
              {submitState.parentName ? `Sent to ${submitState.parentName}.` : 'Sent to your parent.'} You'll hear back soon.
            </p>
          </div>
        )}

        {submitState.type === 'flagged' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-amber-700 font-semibold text-sm">We noticed something</p>
            <ul className="mt-2 space-y-1">
              {submitState.flags.map((flag, i) => <li key={i} className="text-amber-600 text-sm">• {flag}</li>)}
            </ul>
            <button onClick={() => setSubmitState({ type: 'idle' })} className="mt-3 text-xs text-amber-600 hover:underline">Edit my post</button>
          </div>
        )}

        {auditLog.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Recent Posts</h3>
            <div className="space-y-2">
              {auditLog.slice(0, 5).map((entry: any) => {
                const status = entry.action?.includes('approved') ? 'Approved' : entry.action?.includes('rejected') ? 'Rejected' : 'Pending';
                return (
                  <div key={entry.id} className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center justify-between gap-2">
                    <div>
                      {entry.detail?.platform && <PlatformBadge platform={entry.detail.platform} />}
                      <p className="text-xs text-slate-400 mt-1">{entry.action}</p>
                    </div>
                    <StatusBadge status={status} />
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

// ── Entry point — checks connection status ────────────────────────────────────

export default function ChildPage() {
  const { user } = useAuthStore();

  const { data: connection, isLoading } = useQuery({
    queryKey: ['family-connection', user?.uid],
    queryFn: async () => {
      const { data } = await supabase
        .from('family_links')
        .select('id, parent_id, child_id, status')
        .eq('child_id', user!.uid)
        .eq('status', 'active')
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    refetchInterval: 10000, // poll every 10s while waiting for parent to accept
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!connection) {
    return <InviteParentScreen childId={user!.uid} />;
  }

  // Only connected children (parent_id !== child_id means real parent accepted)
  const realParentId = connection.parent_id !== connection.child_id ? connection.parent_id : null;
  if (!realParentId) {
    return <InviteParentScreen childId={user!.uid} />;
  }

  return <ChildDashboard parentId={realParentId} />;
}
