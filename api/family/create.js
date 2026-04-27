'use strict';

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

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

/**
 * Generate a random 6-character alphanumeric invite code (uppercase).
 */
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit 0/O/1/I for readability
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
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

  const { parentId } = body || {};

  if (!parentId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'parentId is required' }));
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

  // Verify parent exists and has role 'parent'
  const { data: parent, error: parentError } = await supabase
    .from('family_users')
    .select('id, role')
    .eq('id', parentId)
    .single();

  if (parentError || !parent) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Parent user not found' }));
    return;
  }

  if (parent.role !== 'parent') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'User is not a parent' }));
    return;
  }

  // Generate a unique invite code (retry on collision)
  let inviteCode;
  let attempts = 0;
  const MAX_ATTEMPTS = 5;

  while (attempts < MAX_ATTEMPTS) {
    inviteCode = generateInviteCode();
    const { data: existing } = await supabase
      .from('family_links')
      .select('id')
      .eq('invite_code', inviteCode)
      .maybeSingle();

    if (!existing) break; // code is unique
    attempts++;
  }

  if (attempts === MAX_ATTEMPTS) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Failed to generate unique invite code' }));
    return;
  }

  // Insert the pending family link (child_id is a placeholder — will be filled on join)
  // We use parent_id as child_id temporarily; the join step overwrites it.
  // Better: use a sentinel value. We'll store parent_id in child_id and rely on status='pending'
  // to indicate the slot isn't claimed yet. On join, child_id gets updated.
  // Actually, since child_id has a NOT NULL FK constraint, we insert parent_id there as a
  // placeholder — join.js will update it to the real child. This avoids schema changes.
  const { data: link, error: linkError } = await supabase
    .from('family_links')
    .insert({
      parent_id: parentId,
      child_id: parentId,   // placeholder — overwritten by join.js
      invite_code: inviteCode,
      status: 'pending',
    })
    .select()
    .single();

  if (linkError) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: linkError.message }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, inviteCode, linkId: link.id }));
};
