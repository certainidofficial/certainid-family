'use strict';

const { createClient } = require('@supabase/supabase-js');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://certainid-family.vercel.app',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
  }
  return createClient(url, key);
}

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, CORS_HEADERS);
    res.end();
    return;
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
    return;
  }

  const parentId = req.query?.parentId || new URL(req.url, 'http://localhost').searchParams.get('parentId');

  if (!parentId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'parentId query param is required' }));
    return;
  }

  let supabase;
  try {
    supabase = getSupabase();
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: err.message }));
    return;
  }

  // Get all active family links for this parent
  const { data: links, error: linksError } = await supabase
    .from('family_links')
    .select('child_id')
    .eq('parent_id', parentId)
    .eq('status', 'active');

  if (linksError) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: linksError.message }));
    return;
  }

  if (!links || links.length === 0) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, children: [] }));
    return;
  }

  const childIds = links.map((l) => l.child_id);

  // Fetch child user records
  const { data: users, error: usersError } = await supabase
    .from('family_users')
    .select('id, display_name, email, age_tier')
    .in('id', childIds);

  if (usersError) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: usersError.message }));
    return;
  }

  // Fetch rules for all children
  const { data: rulesRows, error: rulesError } = await supabase
    .from('child_rules')
    .select('*')
    .in('child_id', childIds);

  if (rulesError) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: rulesError.message }));
    return;
  }

  // Fetch pending post counts for all children
  const { data: pendingPosts, error: postsError } = await supabase
    .from('post_queue')
    .select('child_id')
    .in('child_id', childIds)
    .eq('status', 'pending');

  if (postsError) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: postsError.message }));
    return;
  }

  // Build lookup maps
  const rulesMap = {};
  (rulesRows || []).forEach((r) => {
    rulesMap[r.child_id] = r;
  });

  const pendingCountMap = {};
  (pendingPosts || []).forEach((p) => {
    pendingCountMap[p.child_id] = (pendingCountMap[p.child_id] || 0) + 1;
  });

  // Assemble response
  const children = (users || []).map((u) => ({
    id: u.id,
    displayName: u.display_name,
    email: u.email,
    ageTier: u.age_tier,
    rules: rulesMap[u.id]
      ? {
          postApprovalRequired: rulesMap[u.id].post_approval_required,
          allowedPlatforms: rulesMap[u.id].allowed_platforms,
          screenTimeDailyMinutes: rulesMap[u.id].screen_time_daily_minutes,
        }
      : null,
    pendingPostCount: pendingCountMap[u.id] || 0,
  }));

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, children }));
};
