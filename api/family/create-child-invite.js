'use strict';

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  return createClient(url, key);
}

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) code += chars[bytes[i] % chars.length];
  return code;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(200, CORS_HEADERS); res.end(); return; }
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'POST') {
    res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' })); return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { childId } = body || {};
  if (!childId) { res.writeHead(400); res.end(JSON.stringify({ error: 'childId is required' })); return; }

  const supabase = getSupabase();

  const { data: child } = await supabase
    .from('family_users').select('id, role').eq('id', childId).single();
  if (!child || child.role !== 'child') {
    res.writeHead(403); res.end(JSON.stringify({ error: 'User is not a child' })); return;
  }

  // Check if child already has a pending or active link — don't create duplicates
  const { data: existing } = await supabase
    .from('family_links')
    .select('invite_code, status')
    .eq('child_id', childId)
    .in('status', ['pending', 'active'])
    .maybeSingle();

  if (existing?.status === 'active') {
    res.writeHead(409); res.end(JSON.stringify({ error: 'Already connected to a parent' })); return;
  }
  if (existing?.status === 'pending') {
    // Return the existing pending code so child can resend it
    res.writeHead(200); res.end(JSON.stringify({ inviteCode: existing.invite_code })); return;
  }

  // Generate unique code
  let inviteCode;
  for (let i = 0; i < 5; i++) {
    inviteCode = generateInviteCode();
    const { data: clash } = await supabase
      .from('family_links').select('id').eq('invite_code', inviteCode).maybeSingle();
    if (!clash) break;
  }

  // child_id = real child; parent_id = child (placeholder, overwritten when parent accepts)
  const { error } = await supabase.from('family_links').insert({
    parent_id: childId,
    child_id: childId,
    invite_code: inviteCode,
    status: 'pending',
  });

  if (error) { res.writeHead(500); res.end(JSON.stringify({ error: error.message })); return; }

  res.writeHead(200); res.end(JSON.stringify({ inviteCode }));
};
