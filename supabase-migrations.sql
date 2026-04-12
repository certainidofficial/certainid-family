-- CertainID Family — Supabase Migration
-- Run this in the Supabase SQL editor (or via supabase db push)

-- Users table (maps Firebase UID to app data)
CREATE TABLE IF NOT EXISTS family_users (
  id TEXT PRIMARY KEY,              -- Firebase UID
  email TEXT,
  display_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('parent', 'child')),
  age_tier TEXT CHECK (age_tier IN ('under13', 'age13to15', 'age16to17', 'age18plus')),
  smart_account_address TEXT,       -- future: Biconomy ERC-4337 address
  created_at TIMESTAMP DEFAULT NOW()
);

-- Family links (parent → child relationships)
CREATE TABLE IF NOT EXISTS family_links (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  parent_id TEXT NOT NULL REFERENCES family_users(id),
  child_id TEXT NOT NULL REFERENCES family_users(id),
  invite_code TEXT UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(parent_id, child_id)
);

-- Post approval queue
CREATE TABLE IF NOT EXISTS post_queue (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  child_id TEXT NOT NULL REFERENCES family_users(id),
  parent_id TEXT NOT NULL REFERENCES family_users(id),
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,       -- keccak256 of content (for on-chain)
  platform TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  on_chain_id TEXT,                 -- postId from PostApprovalQueue.sol (future)
  moderation_score FLOAT,           -- 0-1 from NLP check
  moderation_flags TEXT[],          -- ['bad_language', 'negative_sentiment', etc]
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

-- Content flags (NLP violations)
CREATE TABLE IF NOT EXISTS content_flags (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  child_id TEXT NOT NULL REFERENCES family_users(id),
  content_hash TEXT NOT NULL,
  flag_type TEXT NOT NULL,          -- 'bad_language' | 'negative_sentiment' | 'explicit' | 'self_harm'
  severity INTEGER NOT NULL,        -- 1-5
  raw_content TEXT,                 -- kept server-side only, not on-chain
  tx_hash TEXT,                     -- on-chain event tx (future)
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit log (mirrors on-chain events, fast to query)
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  child_id TEXT NOT NULL,
  action TEXT NOT NULL,
  detail JSONB,
  tx_hash TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Child rules (per-child settings set by parent)
CREATE TABLE IF NOT EXISTS child_rules (
  child_id TEXT PRIMARY KEY REFERENCES family_users(id),
  post_approval_required BOOLEAN DEFAULT TRUE,
  allowed_platforms TEXT[] DEFAULT ARRAY['youtube', 'tiktok'],
  screen_time_daily_minutes INTEGER DEFAULT 120,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- RLS: allow all for MVP
ALTER TABLE family_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all family_users" ON family_users;
DROP POLICY IF EXISTS "Allow all family_links" ON family_links;
DROP POLICY IF EXISTS "Allow all post_queue" ON post_queue;
DROP POLICY IF EXISTS "Allow all content_flags" ON content_flags;
DROP POLICY IF EXISTS "Allow all audit_log" ON audit_log;
DROP POLICY IF EXISTS "Allow all child_rules" ON child_rules;

CREATE POLICY "Allow all family_users" ON family_users FOR ALL USING (true);
CREATE POLICY "Allow all family_links" ON family_links FOR ALL USING (true);
CREATE POLICY "Allow all post_queue" ON post_queue FOR ALL USING (true);
CREATE POLICY "Allow all content_flags" ON content_flags FOR ALL USING (true);
CREATE POLICY "Allow all audit_log" ON audit_log FOR ALL USING (true);
CREATE POLICY "Allow all child_rules" ON child_rules FOR ALL USING (true);
