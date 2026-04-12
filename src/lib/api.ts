const BASE_URL = import.meta.env.VITE_API_URL || '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export function registerUser(
  uid: string,
  email: string,
  displayName: string,
  role: 'parent' | 'child',
  ageTier?: string
) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ uid, email, displayName, role, ageTier }),
  });
}

export function createFamily(parentId: string): Promise<{ inviteCode: string }> {
  return request('/api/family/create', {
    method: 'POST',
    body: JSON.stringify({ parentId }),
  });
}

export function joinFamily(childId: string, inviteCode: string) {
  return request('/api/family/join', {
    method: 'POST',
    body: JSON.stringify({ childId, inviteCode }),
  });
}

export function getChildren(parentId: string): Promise<ChildRecord[]> {
  return request(`/api/family/children?parentId=${encodeURIComponent(parentId)}`);
}

export function getPendingPosts(parentId: string): Promise<PendingPost[]> {
  return request(`/api/posts/pending?parentId=${encodeURIComponent(parentId)}`);
}

export function submitPost(
  childId: string,
  content: string,
  platform: string
): Promise<SubmitPostResult> {
  return request('/api/posts/submit', {
    method: 'POST',
    body: JSON.stringify({ childId, content, platform }),
  });
}

export function resolvePost(postId: string, action: 'approve' | 'reject', reason?: string) {
  return request('/api/posts/resolve', {
    method: 'POST',
    body: JSON.stringify({ postId, action, reason }),
  });
}

export function updateRules(childId: string, rules: RuleSet) {
  return request('/api/rules/update', {
    method: 'POST',
    body: JSON.stringify({ childId, rules }),
  });
}

export function getAuditLog(childId: string): Promise<AuditEntry[]> {
  return request(`/api/audit/log?childId=${encodeURIComponent(childId)}`);
}

// ---- Shared types ----

export interface ChildRecord {
  uid: string;
  displayName: string;
  ageTier: string;
  pendingCount: number;
}

export interface PendingPost {
  id: string;
  childId: string;
  childName: string;
  platform: string;
  content: string;
  createdAt: string;
}

export interface SubmitPostResult {
  requiresApproval: boolean;
  parentName?: string;
  flags?: string[];
  postId?: string;
}

export interface RuleSet {
  postApprovalRequired: boolean;
  allowedPlatforms: string[];
  screenTimeLimitMinutes: number;
}

export interface AuditEntry {
  id: string;
  childId: string;
  childName: string;
  action: string;
  platform?: string;
  timestamp: string;
}
