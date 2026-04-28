import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://certainid-family.vercel.app',
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
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) code += chars[bytes[i] % chars.length];
  return code;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(200, CORS_HEADERS); res.end(); return; }
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' })); return;
  }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid JSON body' })); return; }

  const { childId } = body || {};
  if (!childId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'childId is required' })); return;
  }

  let supabase;
  try { supabase = getSupabase(); } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: err.message })); return;
  }

  try {
    const { data: child } = await supabase
      .from('family_users').select('id, role').eq('id', childId).single();
    if (!child || child.role !== 'child') {
      res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'User is not a child' })); return;
    }

    const { data: existing } = await supabase
      .from('family_links').select('invite_code, status').eq('child_id', childId).in('status', ['pending', 'active']).maybeSingle();

    if (existing?.status === 'active') {
      res.writeHead(409, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Already connected to a parent' })); return;
    }
    if (existing?.status === 'pending') {
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ inviteCode: existing.invite_code })); return;
    }

    let inviteCode;
    for (let i = 0; i < 5; i++) {
      inviteCode = generateInviteCode();
      const { data: clash } = await supabase.from('family_links').select('id').eq('invite_code', inviteCode).maybeSingle();
      if (!clash) break;
    }

    const { error } = await supabase.from('family_links').insert({
      parent_id: childId, child_id: childId, invite_code: inviteCode, status: 'pending',
    });
    if (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: error.message })); return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ inviteCode }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
  }
}
