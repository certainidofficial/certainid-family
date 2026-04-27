'use strict';

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://certainid-family.vercel.app',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const BAD_WORDS = [
  'hate',
  'kill',
  'stupid',
  'idiot',
  'ugly',
  'fat',
  'die',
  'suicide',
];

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
  }
  return createClient(url, key);
}

/**
 * Run simple wordlist moderation.
 * Returns an array of matched flag types (empty if clean).
 */
function moderateContent(content) {
  const lower = content.toLowerCase();
  const foundWords = BAD_WORDS.filter((word) => lower.includes(word));
  if (foundWords.length === 0) return { flags: [], score: 0 };

  // Score: proportion of bad words found, capped at 1.0
  const score = Math.min(foundWords.length / BAD_WORDS.length, 1.0);

  // Map found words to flag categories
  const flags = [];
  const selfHarmWords = ['suicide', 'die', 'kill'];
  const badLangWords = ['hate', 'stupid', 'idiot', 'ugly', 'fat'];

  const hasSelfHarm = foundWords.some((w) => selfHarmWords.includes(w));
  const hasBadLang = foundWords.some((w) => badLangWords.includes(w));

  if (hasSelfHarm) flags.push('self_harm');
  if (hasBadLang) flags.push('bad_language');

  return { flags, score, foundWords };
}

/**
 * Compute SHA-256 content hash with 0x prefix (stand-in for keccak256 until on-chain).
 */
function hashContent(content) {
  return '0x' + crypto.createHash('sha256').update(content).digest('hex');
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

  const { childId, content, platform } = body || {};

  if (!childId || !content || !platform) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'childId, content, and platform are required' }));
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
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'User is not a child' }));
    return;
  }

  // Look up parent from active family link
  const { data: link, error: linkError } = await supabase
    .from('family_links')
    .select('parent_id')
    .eq('child_id', childId)
    .eq('status', 'active')
    .single();

  if (linkError || !link) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'No active family link found for this child' }));
    return;
  }

  const parentId = link.parent_id;

  // Fetch child rules
  const { data: rules } = await supabase
    .from('child_rules')
    .select('post_approval_required, allowed_platforms')
    .eq('child_id', childId)
    .maybeSingle();

  // Check platform allowed
  const allowedPlatforms = rules?.allowed_platforms || ['youtube', 'tiktok'];
  if (!allowedPlatforms.includes(platform.toLowerCase())) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: false,
        error: `Platform "${platform}" is not allowed for this child. Allowed: ${allowedPlatforms.join(', ')}`,
      })
    );
    return;
  }

  // Run moderation
  const { flags: moderationFlags, score: moderationScore } = moderateContent(content);
  const contentHash = hashContent(content);
  const requiresApproval = rules?.post_approval_required !== false; // defaults to true

  // Insert into post_queue
  const { data: post, error: postError } = await supabase
    .from('post_queue')
    .insert({
      child_id: childId,
      parent_id: parentId,
      content,
      content_hash: contentHash,
      platform: platform.toLowerCase(),
      status: requiresApproval ? 'pending' : 'approved',
      moderation_score: moderationScore,
      moderation_flags: moderationFlags.length > 0 ? moderationFlags : null,
    })
    .select()
    .single();

  if (postError) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: postError.message }));
    return;
  }

  // Insert content_flags if moderation found issues
  if (moderationFlags.length > 0) {
    const flagInserts = moderationFlags.map((flagType) => ({
      child_id: childId,
      content_hash: contentHash,
      flag_type: flagType,
      severity: flagType === 'self_harm' ? 5 : 3,
      raw_content: content,
    }));

    const { error: flagError } = await supabase.from('content_flags').insert(flagInserts);
    if (flagError) {
      console.error('Warning: failed to insert content_flags:', flagError.message);
    }
  }

  // Audit log
  await supabase.from('audit_log').insert({
    child_id: childId,
    action: 'post_submitted',
    detail: {
      post_id: post.id,
      platform,
      requires_approval: requiresApproval,
      moderation_flags: moderationFlags,
      moderation_score: moderationScore,
    },
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      success: true,
      postId: post.id,
      requiresApproval,
      moderationFlags,
    })
  );
};
