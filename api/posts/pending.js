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

  // Get all active children for this parent
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
    res.end(JSON.stringify({ success: true, posts: [] }));
    return;
  }

  const childIds = links.map((l) => l.child_id);

  // Fetch pending posts for all children of this parent
  const { data: posts, error: postsError } = await supabase
    .from('post_queue')
    .select('*')
    .eq('parent_id', parentId)
    .eq('status', 'pending')
    .in('child_id', childIds)
    .order('created_at', { ascending: false });

  if (postsError) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: postsError.message }));
    return;
  }

  if (!posts || posts.length === 0) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, posts: [] }));
    return;
  }

  // Fetch child display names
  const uniqueChildIds = [...new Set(posts.map((p) => p.child_id))];
  const { data: childUsers, error: usersError } = await supabase
    .from('family_users')
    .select('id, display_name, email')
    .in('id', uniqueChildIds);

  if (usersError) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: usersError.message }));
    return;
  }

  const childMap = {};
  (childUsers || []).forEach((u) => {
    childMap[u.id] = { displayName: u.display_name, email: u.email };
  });

  // Enrich posts with child info
  const enrichedPosts = posts.map((p) => ({
    ...p,
    childDisplayName: childMap[p.child_id]?.displayName || null,
    childEmail: childMap[p.child_id]?.email || null,
  }));

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, posts: enrichedPosts }));
};
