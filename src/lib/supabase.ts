import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl) {
  throw new Error('Missing environment variable: VITE_SUPABASE_URL');
}
if (!supabaseAnonKey) {
  throw new Error('Missing environment variable: VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type FamilyUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: 'parent' | 'child';
  age_tier: 'under13' | 'age13to15' | 'age16to17' | 'age18plus' | null;
  smart_account_address: string | null;
  created_at: string;
};

export type FamilyLink = {
  id: string;
  parent_id: string;
  child_id: string;
  invite_code: string | null;
  status: 'pending' | 'active' | 'revoked';
  created_at: string;
};

export type PostQueue = {
  id: string;
  child_id: string;
  parent_id: string;
  content: string;
  content_hash: string;
  platform: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  on_chain_id: string | null;
  moderation_score: number | null;
  moderation_flags: string[] | null;
  created_at: string;
  resolved_at: string | null;
};

export type ContentFlag = {
  id: string;
  child_id: string;
  content_hash: string;
  flag_type: 'bad_language' | 'negative_sentiment' | 'explicit' | 'self_harm';
  severity: number;
  raw_content: string | null;
  tx_hash: string | null;
  created_at: string;
};

export type AuditLog = {
  id: string;
  child_id: string;
  action: string;
  detail: Record<string, unknown> | null;
  tx_hash: string | null;
  created_at: string;
};

export type ChildRules = {
  child_id: string;
  post_approval_required: boolean;
  allowed_platforms: string[];
  screen_time_daily_minutes: number;
  updated_at: string;
};
