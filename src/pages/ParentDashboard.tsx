import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  getPendingPosts,
  getChildren,
  createFamily,
  resolvePost,
  updateRules,
  type PendingPost,
  type ChildRecord,
  type RuleSet,
} from '../lib/api';
import { useAuthStore } from '../store/authStore';
import PlatformBadge from '../components/shared/PlatformBadge';

type Tab = 'overview' | 'approvals' | 'children' | 'settings';

const PLATFORMS = ['YouTube', 'TikTok', 'Instagram', 'Snapchat', 'X', 'Discord'];


function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="w-7 h-7 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
    </svg>
  );
}

// ---- Overview Tab ----

function OverviewTab({ pendingCount, children, onAddChild }: { pendingCount: number; children: ChildRecord[]; onAddChild: () => void }) {
  if (children.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="text-5xl">👨‍👩‍👧</div>
        <div>
          <p className="text-slate-800 font-bold text-base">No children added yet</p>
          <p className="text-slate-400 text-sm mt-1 leading-relaxed max-w-xs">
            Add a child account and send them an invite link to get started.
          </p>
        </div>
        <button
          onClick={onAddChild}
          className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
        >
          + Add your first child
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Children" value={children.length} />
        <StatCard label="Pending approval" value={pendingCount} highlight={pendingCount > 0} />
      </div>

      {pendingCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-red-700 text-sm font-semibold">{pendingCount} post{pendingCount !== 1 ? 's' : ''} waiting for your review</p>
          <p className="text-red-500 text-xs mt-0.5">Go to the Approvals tab to review them.</p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 text-center ${
        highlight ? 'bg-red-50 border border-red-200' : 'bg-white'
      }`}
    >
      <p className={`text-2xl font-bold ${highlight ? "text-red-600" : "text-slate-800"}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}

// ---- Approvals Tab ----

function ApprovalsTab({ parentId }: { parentId: string }) {
  const qc = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: posts = [], isLoading } = useQuery<PendingPost[]>({
    queryKey: ['pending-posts', parentId],
    queryFn: () => getPendingPosts(parentId),
    refetchInterval: 15000,
  });

  const resolveMutation = useMutation({
    mutationFn: ({ postId, action, reason }: { postId: string; action: 'approve' | 'reject'; reason?: string }) =>
      resolvePost(postId, action, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-posts', parentId] });
      setRejectingId(null);
      setRejectReason('');
    },
  });

  if (isLoading) return <Spinner />;

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <CheckCircleIcon />
        <p className="text-slate-400 text-sm">No posts waiting for approval</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <div key={post.id} className="bg-white rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-800 font-semibold text-sm">{post.childName}</span>
            <div className="flex items-center gap-2">
              <PlatformBadge platform={post.platform} />
              <span className="text-xs text-slate-400">{timeAgo(post.createdAt)}</span>
            </div>
          </div>

          <p className="text-slate-600 text-sm leading-relaxed mb-4">
            {post.content.length > 100 ? `${post.content.slice(0, 100)}...` : post.content}
          </p>

          {rejectingId === post.id ? (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Reason for rejection (optional)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    resolveMutation.mutate({
                      postId: post.id,
                      action: 'reject',
                      reason: rejectReason || undefined,
                    })
                  }
                  disabled={resolveMutation.isPending}
                  className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  Confirm Reject
                </button>
                <button
                  onClick={() => {
                    setRejectingId(null);
                    setRejectReason('');
                  }}
                  className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-600 text-sm font-medium hover:border-slate-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => resolveMutation.mutate({ postId: post.id, action: 'approve' })}
                disabled={resolveMutation.isPending}
                className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => setRejectingId(post.id)}
                disabled={resolveMutation.isPending}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---- Children Tab ----

function ChildRulesPanel({ child }: { child: ChildRecord }) {
  const qc = useQueryClient();
  const [rules, setRules] = useState<RuleSet>({
    postApprovalRequired: true,
    allowedPlatforms: ['YouTube', 'Instagram', 'Discord'],
    screenTimeLimitMinutes: 120,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateRules(child.uid, rules);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      qc.invalidateQueries({ queryKey: ['children'] });
    } finally {
      setSaving(false);
    }
  }

  function togglePlatform(platform: string) {
    setRules((r) => ({
      ...r,
      allowedPlatforms: r.allowedPlatforms.includes(platform)
        ? r.allowedPlatforms.filter((p) => p !== platform)
        : [...r.allowedPlatforms, platform],
    }));
  }

  return (
    <div className="mt-4 border-t border-slate-200 pt-4 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700">Require approval for posts</p>
          <p className="text-xs text-slate-400 mt-0.5">Posts need your approval before going live</p>
        </div>
        <button
          onClick={() => setRules((r) => ({ ...r, postApprovalRequired: !r.postApprovalRequired }))}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            rules.postApprovalRequired ? 'bg-indigo-600' : 'bg-slate-200'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
              rules.postApprovalRequired ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">Allowed platforms</p>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              onClick={() => togglePlatform(p)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                rules.allowedPlatforms.includes(p)
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                  : 'border-slate-600 text-slate-400 hover:border-slate-400'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-slate-700">Screen time limit</p>
          <span className="text-xs text-slate-400">{rules.screenTimeLimitMinutes} min / day</span>
        </div>
        <input
          type="range"
          min={30}
          max={480}
          step={30}
          value={rules.screenTimeLimitMinutes}
          onChange={(e) =>
            setRules((r) => ({ ...r, screenTimeLimitMinutes: Number(e.target.value) }))
          }
          className="w-full accent-indigo-500"
        />
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>30 min</span>
          <span>8 hrs</span>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Rules'}
      </button>
    </div>
  );
}

function ChildrenTab({ parentId }: { parentId: string }) {
  const [expandedChild, setExpandedChild] = useState<string | null>(null);
  const [showInviteFlow, setShowInviteFlow] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [generatingCode, setGeneratingCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: children = [], isLoading } = useQuery<ChildRecord[]>({
    queryKey: ['children', parentId],
    queryFn: () => getChildren(parentId),
  });

  async function handleAddChild() {
    setShowInviteFlow(true);
    setGeneratingCode(true);
    setInviteCode('');
    try {
      const result = await createFamily(parentId);
      setInviteCode(result.inviteCode);
    } catch {
      setInviteCode('ERROR');
    } finally {
      setGeneratingCode(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      {children.map((child) => (
        <div key={child.uid} className="bg-white rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-slate-800 font-semibold text-sm">{child.displayName}</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {child.ageTier}
                </span>
              </div>
              {child.pendingCount > 0 && (
                <p className="text-xs text-red-500 mt-1">
                  {child.pendingCount} post{child.pendingCount !== 1 ? 's' : ''} pending approval
                </p>
              )}
            </div>
            <button
              onClick={() =>
                setExpandedChild(expandedChild === child.uid ? null : child.uid)
              }
              className="text-xs font-medium text-indigo-600 hover:text-indigo-400 transition-colors"
            >
              {expandedChild === child.uid ? 'Close' : 'Manage Rules'}
            </button>
          </div>
          {expandedChild === child.uid && <ChildRulesPanel child={child} />}
        </div>
      ))}

      {!showInviteFlow ? (
        <button
          onClick={handleAddChild}
          className="w-full py-3 border-2 border-dashed border-slate-600 hover:border-indigo-400 rounded-xl text-slate-400 hover:text-indigo-600 text-sm font-medium transition-colors"
        >
          + Add Child
        </button>
      ) : (
        <div className="bg-white rounded-xl p-5 space-y-4">
          <h3 className="text-slate-800 font-semibold">Add a Child</h3>

          {generatingCode ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : inviteCode === 'ERROR' ? (
            <p className="text-red-500 text-sm text-center">
              Failed to generate code. Please try again.
            </p>
          ) : (
            <>
              <p className="text-slate-500 text-sm">Share this code with your child — they enter it after signing up:</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center">
                  <span className="text-3xl font-mono font-bold text-slate-800 tracking-widest">
                    {inviteCode}
                  </span>
                </div>
                <button
                  onClick={handleCopy}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-colors"
                  title="Copy code"
                >
                  <ClipboardIcon />
                </button>
              </div>
              {copied && <p className="text-xs text-emerald-600 text-center">Copied!</p>}
              <p className="text-xs text-slate-400 leading-relaxed">
                Or if your child already sent <em>you</em> a code, enter it in the Join page.
              </p>
            </>
          )}

          <button
            onClick={() => {
              setShowInviteFlow(false);
              setInviteCode('');
            }}
            className="w-full py-2 border border-slate-600 rounded-lg text-slate-600 text-sm font-medium hover:border-slate-400 transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Settings Tab ----

function SettingsTab({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuthStore();

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Account</h2>
        <div>
          <p className="text-xs text-slate-400">Display name</p>
          <p className="text-slate-800 text-sm font-medium mt-0.5">{user?.displayName || 'Not set'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Email</p>
          <p className="text-slate-800 text-sm font-medium mt-0.5">{user?.email || 'Not set'}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">About CertainID Family</h2>
        <p className="text-slate-400 text-sm leading-relaxed">
          All approvals are recorded on the Polygon blockchain for a tamper-proof audit trail.
          Your family's data is encrypted and never shared with third parties.
        </p>
      </div>

      <button
        onClick={onLogout}
        className="w-full py-3 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 font-semibold text-sm transition-colors"
      >
        Sign Out
      </button>
    </div>
  );
}

// ---- Main Dashboard ----

export default function ParentDashboard() {
  const navigate = useNavigate();
  const { user, setUser, setLoading } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const goToAddChild = () => setActiveTab('children');

  const { data: pendingPosts = [] } = useQuery<PendingPost[]>({
    queryKey: ['pending-posts', user?.uid ?? ''],
    queryFn: () => getPendingPosts(user!.uid),
    enabled: !!user,
    refetchInterval: 15000,
  });

  const { data: children = [] } = useQuery<ChildRecord[]>({
    queryKey: ['children', user?.uid ?? ''],
    queryFn: () => getChildren(user!.uid),
    enabled: !!user,
  });

  const handleLogout = useCallback(async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setLoading(false);
    navigate('/login', { replace: true });
  }, [navigate, setUser, setLoading]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'approvals', label: 'Approvals' },
    { id: 'children', label: 'Children' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-slate-800 font-bold text-base">CertainID Family</h1>
          <p className="text-slate-400 text-xs mt-0.5">{user?.displayName || user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-slate-400 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          Sign Out
        </button>
      </header>

      {/* Tab Bar */}
      <nav className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100 flex overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex-1 min-w-max px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'text-indigo-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
            {tab.id === 'approvals' && pendingPosts.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-xs bg-red-600 text-white rounded-full">
                {pendingPosts.length > 9 ? '9+' : pendingPosts.length}
              </span>
            )}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
            )}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 px-4 py-5 max-w-2xl mx-auto w-full">
        {activeTab === 'overview' && (
          <OverviewTab pendingCount={pendingPosts.length} children={children} onAddChild={goToAddChild} />
        )}
        {activeTab === 'approvals' && user && (
          <ApprovalsTab parentId={user.uid} />
        )}
        {activeTab === 'children' && user && (
          <ChildrenTab parentId={user.uid} />
        )}
        {activeTab === 'settings' && (
          <SettingsTab onLogout={handleLogout} />
        )}
      </main>
    </div>
  );
}
