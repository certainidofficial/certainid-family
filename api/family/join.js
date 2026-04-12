'use strict';

const { createClient } = require('@supabase/supabase-js');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
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

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Invalid JSON body' }));
    return;
  }

  const { childId, inviteCode } = body || {};

  if (!childId || !inviteCode) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'childId and inviteCode are required' }));
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

  // Verify child exists and has role 'child'
  const { data: child, error: childError } = await supabase
    .from('family_users')
    .select('id, role')
    .eq('id', childId)
    .single();

  if (childError || !child) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Child user not found' }));
    return;
  }

  if (child.role !== 'child') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'User is not a child' }));
    return;
  }

  // Find pending invite
  const { data: link, error: linkError } = await supabase
    .from('family_links')
    .select('id, parent_id, status')
    .eq('invite_code', inviteCode)
    .eq('status', 'pending')
    .single();

  if (linkError || !link) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Invite code not found or already used' }));
    return;
  }

  // Prevent parent joining their own invite
  if (link.parent_id === childId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Cannot join your own invite' }));
    return;
  }

  // Update the link: set child_id and mark active
  const { error: updateError } = await supabase
    .from('family_links')
    .update({ child_id: childId, status: 'active' })
    .eq('id', link.id);

  if (updateError) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: updateError.message }));
    return;
  }

  // Create default child_rules row for this child (upsert in case it already exists)
  const { error: rulesError } = await supabase
    .from('child_rules')
    .upsert(
      {
        child_id: childId,
        post_approval_required: true,
        allowed_platforms: ['youtube', 'tiktok'],
        screen_time_daily_minutes: 120,
      },
      { onConflict: 'child_id' }
    );

  if (rulesError) {
    // Non-fatal — log but do not fail the join
    console.error('Warning: failed to create child_rules:', rulesError.message);
  }

  // Add audit_log entry
  await supabase.from('audit_log').insert({
    child_id: childId,
    action: 'family_joined',
    detail: { parent_id: link.parent_id, invite_code: inviteCode },
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, parentId: link.parent_id }));
};
