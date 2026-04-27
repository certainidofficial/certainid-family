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

  const { postId, action, reason } = body || {};

  if (!postId || !action) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'postId and action are required' }));
    return;
  }

  if (!['approve', 'reject'].includes(action)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'action must be "approve" or "reject"' }));
    return;
  }

  if (action === 'reject' && !reason) {
    // Allow rejection without reason — it's optional
  }

  let supabase;
  try {
    supabase = getSupabase();
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: err.message }));
    return;
  }

  // Fetch post to verify it exists and is pending
  const { data: post, error: fetchError } = await supabase
    .from('post_queue')
    .select('id, child_id, parent_id, status')
    .eq('id', postId)
    .single();

  if (fetchError || !post) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Post not found' }));
    return;
  }

  if (post.status !== 'pending') {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: false,
        error: `Post has already been resolved (status: ${post.status})`,
      })
    );
    return;
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const resolvedAt = new Date().toISOString();

  const updatePayload = {
    status: newStatus,
    resolved_at: resolvedAt,
  };

  if (action === 'reject' && reason) {
    updatePayload.rejection_reason = reason;
  }

  const { error: updateError } = await supabase
    .from('post_queue')
    .update(updatePayload)
    .eq('id', postId);

  if (updateError) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: updateError.message }));
    return;
  }

  // Audit log
  await supabase.from('audit_log').insert({
    child_id: post.child_id,
    action: action === 'approve' ? 'post_approved' : 'post_rejected',
    detail: {
      post_id: postId,
      parent_id: post.parent_id,
      rejection_reason: reason || null,
      resolved_at: resolvedAt,
    },
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true }));
};
