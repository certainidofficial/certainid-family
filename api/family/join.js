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

  const { childId, inviteCode } = body || {};
  if (!childId || !inviteCode) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'childId and inviteCode are required' })); return;
  }

  let supabase;
  try { supabase = getSupabase(); } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: err.message })); return;
  }

  try {
    const { data: child } = await supabase.from('family_users').select('id, role').eq('id', childId).single();
    if (!child || child.role !== 'child') {
      res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'User is not a child' })); return;
    }

    const { data: link } = await supabase
      .from('family_links').select('id, parent_id, status').eq('invite_code', inviteCode).eq('status', 'pending').single();
    if (!link) {
      res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invite code not found or already used' })); return;
    }

    if (link.parent_id === childId) {
      res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Cannot join your own invite' })); return;
    }

    const { error: updateError } = await supabase
      .from('family_links').update({ child_id: childId, status: 'active' }).eq('id', link.id);
    if (updateError) {
      res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: updateError.message })); return;
    }

    await supabase.from('child_rules').upsert({
      child_id: childId, post_approval_required: true,
      allowed_platforms: ['youtube', 'tiktok'], screen_time_limit_minutes: 120,
    }, { onConflict: 'child_id' });

    await supabase.from('audit_log').insert({
      child_id: childId, action: 'family_joined',
      detail: { parent_id: link.parent_id, invite_code: inviteCode },
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, parentId: link.parent_id }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
  }
}
