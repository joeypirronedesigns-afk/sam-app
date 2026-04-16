// api/outreach.js — SAM HQ Outreach Engine
// Uses Reddit JSON API (free, no auth) + Apify for TikTok
module.exports.config = { api: { bodyParser: { sizeLimit: '1mb' } } };

const SUBREDDITS = ['content_creators', 'NewTubers', 'socialmedia', 'TikTokHelp', 'InstagramMarketing', 'youtubers', 'podcasting'];
const KEYWORDS = ['content', 'creator', 'video', 'grow', 'views', 'algorithm', 'editing', 'script', 'caption', 'hook', 'tiktok', 'instagram', 'youtube', 'struggle', 'help', 'advice', 'tips', 'posting', 'audience', 'followers'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const action = req.method === 'POST' ? req.body?.action : req.query?.action || 'fetch';

  // ── FETCH CACHED ─────────────────────────────────────────────────────────
  if (action === 'fetch') {
    try {
      const { kv } = require('@vercel/kv');
      const cached = await kv.get('outreach:daily_targets');
      if (cached) return res.status(200).json({ success: true, targets: cached, cached: true });
      return res.status(200).json({ success: true, targets: [], cached: false });
    } catch(e) {
      return res.status(200).json({ success: true, targets: [], error: e.message });
    }
  }

  // ── REFRESH ───────────────────────────────────────────────────────────────
  if (action === 'refresh') {
    const targets = [];

    // ── REDDIT via free JSON API ──────────────────────────────────────────
    for (const sub of SUBREDDITS) {
      try {
        const r = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=15`, {
          headers: { 'User-Agent': 'SAMforCreators/1.0 (outreach tool)' }
        });
        if (!r.ok) continue;
        const data = await r.json();
        const posts = data?.data?.children || [];

        for (const { data: post } of posts) {
          if (post.stickied || post.distinguished) continue;
          const text = ((post.title || '') + ' ' + (post.selftext || '')).toLowerCase();
          const matches = KEYWORDS.filter(k => text.includes(k)).length;
          if (matches < 2) continue;
          if (post.score < 5) continue;

          targets.push({
            id: post.id,
            platform: 'Reddit',
            url: `https://reddit.com${post.permalink}`,
            creator: `u/${post.author}`,
            title: post.title,
            preview: (post.selftext || '').slice(0, 200),
            score: post.score,
            comments: post.num_comments,
            subreddit: `r/${sub}`,
            relevanceScore: matches,
            draftComment: null
          });
        }
      } catch(e) { console.log('Reddit error:', sub, e.message); }
    }

    // Sort by relevance + engagement
    targets.sort((a, b) =>
      (b.relevanceScore * 10 + Math.log1p(b.score)) -
      (a.relevanceScore * 10 + Math.log1p(a.score))
    );
    const top = targets.slice(0, 20);

    // ── DRAFT COMMENTS via Claude ─────────────────────────────────────────
    for (const target of top) {
      try {
        const prompt = `You are a content creator leaving a genuine comment on ${target.platform}. Write a real, helpful comment — NOT promotional, NOT a bot.

Post by ${target.creator} in ${target.subreddit}:
"${target.title}"
${target.preview ? `\n${target.preview.slice(0,150)}` : ''}

Rules:
- 2-3 sentences max
- Genuinely helpful or relatable first
- Only mention SAM (samforcreators.com) if it fits NATURALLY as a tool recommendation from one creator to another
- Never say "I found this tool" or sound like marketing
- Sound like a real person who makes content
- Reddit tone: conversational, direct, no hashtags

Write ONLY the comment text.`;

        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 150, messages: [{ role: 'user', content: prompt }] })
        });
        const d = await r.json();
        target.draftComment = d.content?.[0]?.text?.trim() || '';
      } catch(e) { target.draftComment = ''; }
    }

    // Cache 24 hours
    try {
      const { kv } = require('@vercel/kv');
      await kv.set('outreach:daily_targets', top, { ex: 86400 });
    } catch(e) {}

    return res.status(200).json({ success: true, targets: top, total: top.length });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
