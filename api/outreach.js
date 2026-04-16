// api/outreach.js
// SAM HQ Outreach Engine — finds content creator targets via Apify, drafts comments

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const APIFY_KEY = process.env.APIFY_API_KEY;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const action = req.method === 'POST' ? req.body?.action : req.query?.action || 'fetch';

  // ── FETCH CACHED TARGETS ─────────────────────────────────────────────────
  if (action === 'fetch') {
    try {
      const { kv } = require('@vercel/kv');
      const cached = await kv.get('outreach:daily_targets');
      if (cached) return res.status(200).json({ success: true, targets: cached, cached: true });
      return res.status(200).json({ success: true, targets: [], cached: false, message: 'No targets yet. Click Refresh to find new targets.' });
    } catch(e) {
      return res.status(200).json({ success: true, targets: [], error: e.message });
    }
  }

  // ── REFRESH — scrape new targets ──────────────────────────────────────────
  if (action === 'refresh') {
    try {
      const targets = [];

      // ── REDDIT: r/content_creators, r/socialmedia, r/NewTubers, r/TikTok ──
      const redditActor = 'trudax/reddit-scraper-lite';
      const subreddits = ['content_creators', 'socialmedia', 'NewTubers', 'Tiktokhelp', 'InstagramMarketing'];

      for (const sub of subreddits.slice(0, 3)) {
        try {
          // Start Apify run
          const runRes = await fetch(`https://api.apify.com/v2/acts/${redditActor}/runs?token=${APIFY_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subreddits: [sub],
              type: 'hot',
              maxItems: 10,
              proxy: { useApifyProxy: true }
            })
          });
          const run = await runRes.json();
          const runId = run?.data?.id;
          if (!runId) continue;

          // Wait for completion (poll up to 30s)
          let finished = false;
          for (let i = 0; i < 6; i++) {
            await new Promise(r => setTimeout(r, 5000));
            const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_KEY}`);
            const status = await statusRes.json();
            if (status?.data?.status === 'SUCCEEDED') { finished = true; break; }
            if (status?.data?.status === 'FAILED') break;
          }

          if (!finished) continue;

          // Get results
          const dataRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_KEY}&limit=10`);
          const posts = await dataRes.json();

          for (const post of (posts || []).slice(0, 3)) {
            if (!post.title) continue;
            // Filter for relevant content creation pain points
            const text = (post.title + ' ' + (post.selftext || '')).toLowerCase();
            const keywords = ['content', 'creator', 'video', 'posting', 'grow', 'views', 'algorithm', 'editing', 'script', 'caption', 'hook', 'tiktok', 'instagram', 'youtube', 'struggle', 'hard', 'help'];
            const matches = keywords.filter(k => text.includes(k)).length;
            if (matches < 2) continue;

            targets.push({
              id: post.id || Math.random().toString(36).slice(2),
              platform: 'Reddit',
              url: `https://reddit.com${post.permalink || ''}`,
              creator: `u/${post.author || 'unknown'}`,
              title: post.title,
              preview: (post.selftext || '').slice(0, 200),
              score: post.score || 0,
              comments: post.numComments || 0,
              subreddit: `r/${sub}`,
              relevanceScore: matches,
              draftComment: null
            });
          }
        } catch(e) { console.log('Reddit error:', sub, e.message); }
      }

      // ── TIKTOK: search for content creator posts ──────────────────────────
      try {
        const ttActor = 'clockworks/free-tiktok-scraper';
        const ttRes = await fetch(`https://api.apify.com/v2/acts/${ttActor}/runs?token=${APIFY_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hashtags: ['contentcreator', 'contentcreatortips', 'growyourtiktok', 'socialmediatips'],
            resultsPerPage: 10,
            maxItems: 20
          })
        });
        const ttRun = await ttRes.json();
        const ttRunId = ttRun?.data?.id;

        if (ttRunId) {
          let finished = false;
          for (let i = 0; i < 6; i++) {
            await new Promise(r => setTimeout(r, 5000));
            const s = await (await fetch(`https://api.apify.com/v2/actor-runs/${ttRunId}?token=${APIFY_KEY}`)).json();
            if (s?.data?.status === 'SUCCEEDED') { finished = true; break; }
            if (s?.data?.status === 'FAILED') break;
          }

          if (finished) {
            const ttData = await (await fetch(`https://api.apify.com/v2/actor-runs/${ttRunId}/dataset/items?token=${APIFY_KEY}&limit=20`)).json();
            for (const vid of (ttData || []).slice(0, 5)) {
              if (!vid.text && !vid.desc) continue;
              targets.push({
                id: vid.id || Math.random().toString(36).slice(2),
                platform: 'TikTok',
                url: vid.webVideoUrl || `https://tiktok.com/@${vid.authorMeta?.name}`,
                creator: `@${vid.authorMeta?.name || 'unknown'}`,
                title: (vid.text || vid.desc || '').slice(0, 100),
                preview: (vid.text || vid.desc || '').slice(0, 200),
                score: vid.diggCount || 0,
                comments: vid.commentCount || 0,
                subreddit: '#contentcreator',
                relevanceScore: 5,
                draftComment: null
              });
            }
          }
        }
      } catch(e) { console.log('TikTok error:', e.message); }

      // Sort by relevance + engagement
      targets.sort((a, b) => (b.relevanceScore * 10 + Math.log(b.score + 1)) - (a.relevanceScore * 10 + Math.log(a.score + 1)));
      const top = targets.slice(0, 20);

      // ── DRAFT COMMENTS via Claude ─────────────────────────────────────────
      for (const target of top.slice(0, 15)) {
        try {
          const prompt = `You are a helpful content creator commenting naturally on social media. Write a genuine, value-add comment for this post. Sound like a real human creator, NOT a bot or marketer.

Platform: ${target.platform}
Creator: ${target.creator}
Post: ${target.title}
${target.preview ? `Content: ${target.preview}` : ''}

Rules:
- 2-4 sentences max
- Genuinely helpful or relatable first
- Soft natural mention of SAM for creators (samforcreators.com) ONLY if it fits naturally — like a creator recommending a tool to another creator
- Never say "I found this tool" or sound promotional
- Match the platform's tone (Reddit = conversational, TikTok = casual/short)
- No hashtags on Reddit
- Sound like a real person who creates content

Write only the comment text, nothing else.`;

          const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 200, messages: [{ role: 'user', content: prompt }] })
          });
          const d = await r.json();
          target.draftComment = d.content?.[0]?.text || '';
        } catch(e) { target.draftComment = ''; }
      }

      // Cache for 24 hours
      try {
        const { kv } = require('@vercel/kv');
        await kv.set('outreach:daily_targets', top, { ex: 86400 });
      } catch(e) {}

      return res.status(200).json({ success: true, targets: top, total: top.length });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'Unknown action' });
};
