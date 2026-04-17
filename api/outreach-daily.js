module.exports.config = { api: { bodyParser: { sizeLimit: '1mb' } } };

// ─── CONFIG ──────────────────────────────────────────────────────────────
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL || '';
const SELF_URL = 'https://samforcreators.com';
const TOP_N_PER_PLATFORM = 3;   // top 3 Reddit + top 3 YouTube = 6 daily

// ─── HELPERS ─────────────────────────────────────────────────────────────
function shortToken() {
  return Math.random().toString(36).slice(2, 10);
}

async function slackPost(text, blocks) {
  try {
    await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, blocks }),
    });
  } catch (e) {
    console.error('Slack post failed:', e.message);
  }
}

async function supabaseInsert(row) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/outreach_queue`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(row),
    });
    if (!r.ok) {
      console.error('Supabase insert failed:', r.status, await r.text());
      return null;
    }
    const data = await r.json();
    return data[0];
  } catch (e) {
    console.error('Supabase insert error:', e.message);
    return null;
  }
}

// Rewrite any samforcreators.com URL in the comment to include the tracking token
function tagCommentWithToken(comment, token, platform) {
  if (!comment) return comment;
  const tag = `samforcreators.com/welcome?src=${platform}_${token}`;
  return comment
    .replace(/samforcreators\.com\/welcome/gi, tag)
    .replace(/samforcreators\.com(?!\/welcome)/gi, tag);
}

// ─── HANDLER ─────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // Allow both GET (for Vercel cron) and POST (for manual trigger)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const runId = shortToken();
  const startTime = Date.now();

  await slackPost(`☀️ *SAM Outreach Daily Run* starting (run: ${runId})`);

  // Step 1 — fire both outreach endpoints in parallel
  const [redditRes, youtubeRes] = await Promise.allSettled([
    fetch(`${SELF_URL}/api/outreach-reddit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'daily' }),
    }).then(r => r.json()),
    fetch(`${SELF_URL}/api/outreach-youtube`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'daily' }),
    }).then(r => r.json()),
  ]);

  const redditTargets = redditRes.status === 'fulfilled' && Array.isArray(redditRes.value?.targets)
    ? redditRes.value.targets
    : [];
  const youtubeTargets = youtubeRes.status === 'fulfilled' && Array.isArray(youtubeRes.value?.targets)
    ? youtubeRes.value.targets
    : [];

  // Step 2 — pick top N per platform by relevance/engagement
  const topReddit = redditTargets
    .filter(t => t.draftComment && t.draftComment.length > 20)
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .slice(0, TOP_N_PER_PLATFORM);

  const topYouTube = youtubeTargets
    .filter(t => t.draftComment && t.draftComment.length > 20)
    .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
    .slice(0, TOP_N_PER_PLATFORM);

  const selected = [...topReddit, ...topYouTube];

  if (selected.length === 0) {
    await slackPost(`⚠️ *SAM Outreach Daily* (${runId}) — no targets found this run. Reddit: ${redditTargets.length} raw, YouTube: ${youtubeTargets.length} raw.`);
    return res.status(200).json({
      success: true,
      runId,
      totalCandidates: redditTargets.length + youtubeTargets.length,
      queued: 0,
    });
  }

  // Step 3 — write each to Supabase with a token, tag the comment's URL, post to Slack
  const queued = [];
  for (const target of selected) {
    const token = shortToken();
    const platformKey = (target.platform || 'unknown').toLowerCase();
    const taggedComment = tagCommentWithToken(target.draftComment, token, platformKey);

    const row = await supabaseInsert({
      token,
      platform: platformKey,
      target_url: target.url,
      creator: target.creator || '',
      title: (target.title || '').slice(0, 500),
      draft_comment: taggedComment,
      found_via: target.foundVia || target.subreddit || '',
      status: 'pending',
    });

    if (!row) continue;
    queued.push({ ...target, token, taggedComment });
  }

  // Step 4 — deliver to Slack
  for (const t of queued) {
    const statsLine = t.platform === 'YouTube'
      ? `${(t.viewCount || 0).toLocaleString()} views · ${(t.subscribers || 0).toLocaleString()} subs`
      : `${t.score || 0} upvotes · r/${(t.subreddit || '').replace(/^r\//,'')}`;

    const emoji = t.platform === 'YouTube' ? '▶️' : '🟠';
    const text = `${emoji} *${t.platform}* — ${t.creator}\n*${(t.title || '').slice(0, 120)}*\n_${statsLine}_\n\n${t.taggedComment}\n\n🔗 <${t.url}|Open Post>  ·  Token: \`${t.token}\``;

    await slackPost(text);
  }

  // Step 5 — summary message
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  await slackPost(`✅ *SAM Outreach Daily complete* (${runId}) — ${queued.length} targets queued · ${elapsed}s · Reddit: ${topReddit.length} · YouTube: ${topYouTube.length}`);

  return res.status(200).json({
    success: true,
    runId,
    queued: queued.length,
    redditCount: topReddit.length,
    youtubeCount: topYouTube.length,
    elapsedSec: elapsed,
  });
};
