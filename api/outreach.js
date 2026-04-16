module.exports.config = { api: { bodyParser: { sizeLimit: '1mb' } } };

const SUBREDDITS = ['NewTubers', 'socialmedia', 'youtubers', 'podcasting', 'SmallYTChannel', 'videography'];
const KEYWORDS = ['content', 'creator', 'video', 'grow', 'views', 'algorithm', 'script', 'caption', 'hook', 'tiktok', 'instagram', 'youtube', 'struggle', 'help', 'advice', 'posting', 'audience', 'followers', 'editing'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  // Always scrape fresh — no KV dependency
  const targets = [];

  // Use Apify Reddit scraper with residential proxies
  const APIFY_KEY = process.env.APIFY_API_KEY;
  const results = await Promise.allSettled(
    SUBREDDITS.slice(0,4).map(async sub => {
      try {
        const r = await fetch(`https://api.apify.com/v2/acts/trudax~reddit-scraper-lite/run-sync-get-dataset-items?token=${APIFY_KEY}&memory=128&timeout=25`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subreddits: [sub],
            type: 'hot',
            maxItems: 8,
            proxy: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] }
          })
        });
        const posts = await r.json();
        return { sub, posts: Array.isArray(posts) ? posts.map(p => ({
          title: p.title || '',
          link: p.url || `https://reddit.com${p.permalink||''}`,
          author: p.author || '',
          content: (p.selftext || '').slice(0,300)
        })).filter(p => p.title && p.author && p.author !== 'AutoModerator') : [] };
      } catch(e) { return { sub, posts: [] }; }
    })
  );

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const { sub, posts } = result.value;
    for (const post of posts) {
      const text = ((post.title || '') + ' ' + (post.content || '')).toLowerCase();
      const matches = KEYWORDS.filter(k => text.includes(k)).length;
      if (matches < 2) continue;
      targets.push({
        id: Math.random().toString(36).slice(2),
        platform: 'Reddit',
        url: post.link,
        creator: `u/${post.author}`,
        title: post.title,
        preview: post.content,
        score: 10,
        comments: 0,
        subreddit: `r/${sub}`,
        relevanceScore: matches,
        draftComment: null
      });
    }
  }

  targets.sort((a, b) => b.relevanceScore - a.relevanceScore);
  const top = targets.slice(0, 15);

  if (top.length === 0) {
    // Debug: return raw RSS parse results
    const debugTargets = [];
    for (const result of results) {
      if (result.status !== 'fulfilled') { debugTargets.push('failed: ' + result.reason); continue; }
      const { sub, posts } = result.value;
      debugTargets.push(`${sub}: ${posts.length} posts | raw: ${result.value.rawStart||'ok'}`);
    }
    return res.status(200).json({ success: true, targets: [], total: 0, debug: debugTargets });
  }

  // Draft comments in parallel
  await Promise.allSettled(
    top.map(async (target, i) => {
      try {
        const prompt = `You are a content creator leaving a genuine helpful comment on Reddit in ${target.subreddit}.

Post by ${target.creator}: "${target.title}"
${target.preview ? target.preview.slice(0,150) : ''}

Write a 2-3 sentence genuine, helpful comment. Be relatable and specific to their situation. Only mention SAM (samforcreators.com) if it fits naturally as a tool one creator recommends to another. Never sound like marketing. No hashtags. Write ONLY the comment text.`;

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

  return res.status(200).json({ success: true, targets: top, total: top.length });
};
