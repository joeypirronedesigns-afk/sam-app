// api/ear.js
// The Ear — scans Reddit via Apify, scores with Claude, persists to Supabase.
// Uses same Apify actor as outreach-reddit.js (cryptosignals~reddit-scraper-fast)
// because direct Reddit fetches get blocked from Vercel IPs.
//
// Env vars (required): ANTHROPIC_API_KEY, APIFY_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
// Env vars (optional): SLACK_WEBHOOK_URL

module.exports.config = { api: { bodyParser: { sizeLimit: '1mb' } } };

const { supabaseQuery } = require('./_supabase');

// ─── CONFIG ──────────────────────────────────────────────────────────────
const SUBREDDITS = [
  'NewTubers',
  'SmallYTChannel',
  'ContentCreation',
  'SocialMediaMarketing',
  'youtubers',
  'writing',
];

const POSTS_PER_SUB  = 10;
const MAX_CANDIDATES = 50;
const MIN_SCORE      = 28;
const DIGEST_SIZE    = 10;
const CLAUDE_MODEL   = 'claude-sonnet-4-20250514';

const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const APIFY_KEY     = process.env.APIFY_API_KEY;

// ─── RUBRIC ──────────────────────────────────────────────────────────────
const RUBRIC_PROMPT = `You are screening Reddit posts from content creators to find people who are genuinely struggling with their voice or authorship — not promoting themselves, not asking tactical questions (analytics, thumbnails, lighting), not performing expertise.

Score this post 0-10 on each of five dimensions. Be strict. A 10 is rare. A 5 is "maybe." Most posts should score low — that's the point.

1. EMOTIONAL_HONESTY (0-10): Is this person actually venting, confused, or processing, vs. marketing themselves / farming engagement / posting a listicle? Real honesty = high. Humble brag, growth-hack template, or promotional post = 0-2.

2. VOICE_PAIN (0-10): Is the pain specifically about sounding like themselves, finding their voice, being authentic, or feeling their content is hollow/fake/not them? NOT about views, money, equipment, algorithm — those score 0. Voice-specific pain = high.

3. AI_INVOLVEMENT (0-10): Have they mentioned AI, ChatGPT, AI-written content, "sounds generic," "sounds like everyone else," automation guilt, or the feeling that tools are replacing them? Explicit AI mention = 8-10. Implicit (e.g., "my content feels manufactured") = 4-6. No AI angle at all = 0.

4. SAM_FIT (0-10): Could SAM (a tool that learns a creator's voice DNA from their own writing and generates content that sounds like THEM, not generic AI) plausibly help this person? Voice-lost creator who uses ChatGPT = 9-10. Someone asking about tax deductions = 0. Someone who seems like they'd refuse AI outright = 2-3.

5. VULNERABILITY (0-10): Are they asking for help, confessing, or showing real uncertainty? Or are they giving advice, flexing, or performing? Askers/confessors = high. Advisers/performers = low.

Return ONLY a JSON object, no other text:
{"emotional_honesty": N, "voice_pain": N, "ai_involvement": N, "sam_fit": N, "vulnerability": N, "one_line_why": "15 words or less on why this person matters", "key_quote": "the single most telling sentence from their post, verbatim"}

The post:
TITLE: {TITLE}
BODY: {BODY}`;

// ─── APIFY FETCH (mirrors outreach-reddit.js) ────────────────────────────
async function fetchSubredditViaApify(sub) {
  if (!APIFY_KEY) return [];
  try {
    const url = `https://api.apify.com/v2/acts/cryptosignals~reddit-scraper-fast/run-sync-get-dataset-items?token=${APIFY_KEY}&memory=128&timeout=25`;
    const r = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ subreddit: sub, sort: 'new', maxPosts: POSTS_PER_SUB }),
    });
    if (!r.ok) {
      console.warn(`[ear] apify ${sub} returned ${r.status}`);
      return [];
    }
    const posts = await r.json();
    if (!Array.isArray(posts)) return [];
    return posts
      .filter(p => p && p.title && p.author && p.author !== 'AutoModerator')
      .map(p => ({
        id:        (p.id || p.permalink || p.url || '').replace(/^t3_/, '').slice(-10),
        subreddit: sub,
        title:     p.title || '',
        body:      (p.selftext || '').slice(0, 2000),
        url:       p.url || p.permalink || '',
        score:     p.score || 0,
        comments:  p.numComments || 0,
        created:   p.createdAt ? Math.floor(new Date(p.createdAt).getTime() / 1000) : null,
        author:    p.author || '',
      }));
  } catch (e) {
    console.warn(`[ear] apify ${sub} fetch failed:`, e.message);
    return [];
  }
}

function prefilter(posts) {
  const REJECT = /\b(sub4sub|promote my|check out my|my new video|drop your|collab|feedback on my|rate my)\b/i;
  const TOO_SHORT = 40;
  return posts.filter(p => {
    const combined = `${p.title} ${p.body}`;
    if (combined.length < TOO_SHORT) return false;
    if (REJECT.test(combined)) return false;
    return true;
  });
}

// ─── CLAUDE ──────────────────────────────────────────────────────────────
async function scoreWithClaude(post) {
  const prompt = RUBRIC_PROMPT
    .replace('{TITLE}', post.title)
    .replace('{BODY}', post.body || '(no body)');
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type':      'application/json',
        'x-api-key':         ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      CLAUDE_MODEL,
        max_tokens: 300,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const text = data?.content?.[0]?.text || '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);
    const total =
      (parsed.emotional_honesty || 0) +
      (parsed.voice_pain || 0) +
      (parsed.ai_involvement || 0) +
      (parsed.sam_fit || 0) +
      (parsed.vulnerability || 0);
    return { ...parsed, total };
  } catch (e) {
    return null;
  }
}

// ─── SUPABASE ────────────────────────────────────────────────────────────
async function persistSignal(post, score) {
  return supabaseQuery('ear_signals', 'POST', {
    platform:          'reddit',
    subreddit:         post.subreddit,
    post_id:           post.id,
    post_url:          post.url,
    post_author:       post.author,
    post_title:        post.title,
    post_body:         post.body,
    post_score:        post.score,
    post_comments:     post.comments,
    post_created:      post.created ? new Date(post.created * 1000).toISOString() : null,
    total_score:       score.total,
    emotional_honesty: score.emotional_honesty,
    voice_pain:        score.voice_pain,
    ai_involvement:    score.ai_involvement,
    sam_fit:           score.sam_fit,
    vulnerability:     score.vulnerability,
    key_quote:         score.key_quote,
    one_line_why:      score.one_line_why,
  });
}

// ─── SLACK ───────────────────────────────────────────────────────────────
function formatSlackDigest(entries) {
  const lines = [];
  lines.push('*👂 The Ear — today\'s signal*');
  lines.push(`_${entries.length} creators worth reading. Not leads. Ethnography._`);
  lines.push('');
  entries.forEach((e, i) => {
    const p = e.post, s = e.score;
    lines.push(`*${i + 1}. r/${p.subreddit}  ·  score ${s.total}/50*`);
    lines.push(`<${p.url}|${p.title.slice(0, 120)}>`);
    lines.push(`> ${(s.key_quote || '').slice(0, 280)}`);
    lines.push(`_${s.one_line_why || ''}_`);
    lines.push('');
  });
  return lines.join('\n');
}

async function slackPost(text) {
  if (!SLACK_WEBHOOK) return false;
  try {
    await fetch(SLACK_WEBHOOK, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
    });
    return true;
  } catch (e) {
    console.warn('[ear] slack post failed:', e.message);
    return false;
  }
}

// ─── HANDLER ─────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });
  if (!APIFY_KEY)     return res.status(500).json({ error: 'APIFY_API_KEY not set' });

  // 1. fetch all subs in parallel (Apify handles rate limiting + IP rotation)
  const results = await Promise.allSettled(SUBREDDITS.map(fetchSubredditViaApify));
  const allPosts = [];
  for (const r of results) {
    if (r.status === 'fulfilled') allPosts.push(...r.value);
  }

  // 2. prefilter + cap
  const filtered = prefilter(allPosts).slice(0, MAX_CANDIDATES);

  // 3. score in batches
  const scored = [];
  const BATCH = 5;
  for (let i = 0; i < filtered.length; i += BATCH) {
    const chunk = filtered.slice(i, i + BATCH);
    const batch = await Promise.all(chunk.map(p => scoreWithClaude(p)));
    batch.forEach((s, idx) => {
      if (s && s.total >= MIN_SCORE) scored.push({ post: chunk[idx], score: s });
    });
  }

  // 4. persist (unique constraint dedups)
  let persisted = 0;
  for (const entry of scored) {
    const ok = await persistSignal(entry.post, entry.score);
    if (ok) persisted++;
  }

  // 5. sort, trim for digest
  scored.sort((a, b) => b.score.total - a.score.total);
  const digest = scored.slice(0, DIGEST_SIZE);

  // 6. slack
  let slackPosted = false;
  if (SLACK_WEBHOOK && digest.length) {
    slackPosted = await slackPost(formatSlackDigest(digest));
  }

  return res.status(200).json({
    ok:           true,
    generated:    new Date().toISOString(),
    scanned:      allPosts.length,
    filtered:     filtered.length,
    scored:       scored.length,
    persisted,
    slack_posted: slackPosted,
    digest: digest.map(e => ({
      url:          e.post.url,
      subreddit:    e.post.subreddit,
      title:        e.post.title,
      total:        e.score.total,
      key_quote:    e.score.key_quote,
      one_line_why: e.score.one_line_why,
    })),
  });
};
