import { createClient } from '@supabase/supabase-js';

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

  const { parentId, inviteCode } = body || {};
  if (!parentId || !inviteCode) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'parentId and inviteCode are required' })); return;
  }

  let supabase;
  try { supabase = getSupabase(); } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: err.message })); return;
  }

  try {
    const { data: parent } = await supabase
      .from('family_users').select('id, role').eq('id', parentId).single();
    if (!parent || parent.role !== 'parent') {
      res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'User is not a parent' })); return;
    }

    const { data: link } = await supabase
      .from('family_links').select('id, parent_id, child_id, status').eq('invite_code', inviteCode).eq('status', 'pending').single();
    if (!link) {
      res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invite code not found or already used' })); return;
    }

    if (link.parent_id !== link.child_id) {
      res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'This code is for a child to join, not a parent. Use the join endpoint instead.' })); return;
    }

    const childId = link.child_id;

    const { error: updateError } = await supabase
      .from('family_links').update({ parent_id: parentId, status: 'active' }).eq('id', link.id);
    if (updateError) {
      res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: updateError.message })); return;
    }

    await supabase.from('child_rules').upsert({
      child_id: childId, post_approval_required: true,
      allowed_platforms: ['youtube', 'tiktok'], screen_time_limit_minutes: 120,
    }, { onConflict: 'child_id' });

    await supabase.from('audit_log').insert({
      child_id: childId, action: 'family_joined',
      detail: { parent_id: parentId, invite_code: inviteCode, initiated_by: 'child' },
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, childId }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
  }
}
