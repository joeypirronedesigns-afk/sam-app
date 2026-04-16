module.exports.config = { api: { bodyParser: { sizeLimit: '1mb' } } };

const SUBREDDITS = ['content_creators', 'NewTubers', 'socialmedia', 'TikTokHelp', 'youtubers'];
const KEYWORDS = ['content', 'creator', 'video', 'grow', 'views', 'algorithm', 'script', 'caption', 'hook', 'tiktok', 'instagram', 'youtube', 'struggle', 'help', 'advice', 'posting', 'audience', 'followers'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const action = req.method === 'POST' ? req.body?.action : req.query?.action || 'fetch';

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

  if (action === 'refresh') {
    const targets = [];

    // Fetch all subreddits in parallel
    const results = await Promise.allSettled(
      SUBREDDITS.map(sub =>
        fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=10`, {
          headers: { 'User-Agent': 'SAMforCreators/1.0' }
        }).then(r => r.json()).then(data => ({ sub, posts: data?.data?.children || [] }))
      )
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const { sub, posts } = result.value;
      for (const { data: post } of posts) {
        if (post.stickied || post.score < 5) continue;
        const text = ((post.title || '') + ' ' + (post.selftext || '')).toLowerCase();
        const matches = KEYWORDS.filter(k => text.includes(k)).length;
        if (matches < 2) continue;
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
    }

    targets.sort((a, b) =>
      (b.relevanceScore * 10 + Math.log1p(b.score)) -
      (a.relevanceScore * 10 + Math.log1p(a.score))
    );
    const top = targets.slice(0, 15);

    // Draft all comments in parallel with Promise.allSettled
    await Promise.allSettled(
      top.map(async (target, i) => {
        try {
          const prompt = `You are a content creator leaving a genuine helpful comment on Reddit in r/${target.subreddit.replace('r/','')}. 

Post: "${target.title}"
${target.preview ? target.preview.slice(0,100) : ''}

Write a 2-3 sentence genuine comment. Be helpful and relatable. Only mention SAM (samforcreators.com) if it fits naturally as a tool recommendation. Sound like a real creator, not a marketer. No hashtags. Write ONLY the comment.`;

          const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 120, messages: [{ role: 'user', content: prompt }] })
          });
          const d = await r.json();
          top[i].draftComment = d.content?.[0]?.text?.trim() || '';
        } catch(e) { top[i].draftComment = ''; }
      })
    );

    try {
      const { kv } = require('@vercel/kv');
      await kv.set('outreach:daily_targets', top, { ex: 86400 });
    } catch(e) {}

    return res.status(200).json({ success: true, targets: top, total: top.length });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
