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

  const { childId, rules } = body || {};

  if (!childId || !rules || typeof rules !== 'object') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'childId and rules object are required' }));
    return;
  }

  const { postApprovalRequired, allowedPlatforms, screenTimeDailyMinutes } = rules;

  // Validate fields if provided
  if (postApprovalRequired !== undefined && typeof postApprovalRequired !== 'boolean') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'postApprovalRequired must be a boolean' }));
    return;
  }

  if (allowedPlatforms !== undefined && !Array.isArray(allowedPlatforms)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'allowedPlatforms must be an array' }));
    return;
  }

  if (
    screenTimeDailyMinutes !== undefined &&
    (typeof screenTimeDailyMinutes !== 'number' || screenTimeDailyMinutes < 0)
  ) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({ success: false, error: 'screenTimeDailyMinutes must be a non-negative number' })
    );
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

  // Verify child exists
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
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'User is not a child' }));
    return;
  }

  // Build upsert payload — only include fields that were provided
  const upsertPayload = {
    child_id: childId,
    updated_at: new Date().toISOString(),
  };

  if (postApprovalRequired !== undefined) {
    upsertPayload.post_approval_required = postApprovalRequired;
  }
  if (allowedPlatforms !== undefined) {
    upsertPayload.allowed_platforms = allowedPlatforms.map((p) => p.toLowerCase());
  }
  if (screenTimeDailyMinutes !== undefined) {
    upsertPayload.screen_time_daily_minutes = screenTimeDailyMinutes;
  }

  const { data: updatedRules, error: upsertError } = await supabase
    .from('child_rules')
    .upsert(upsertPayload, { onConflict: 'child_id' })
    .select()
    .single();

  if (upsertError) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: upsertError.message }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, rules: updatedRules }));
};
