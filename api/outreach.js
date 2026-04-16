module.exports.config = { api: { bodyParser: { sizeLimit: '1mb' } } };

const SUBREDDITS = ['NewTubers', 'socialmedia', 'youtubers', 'podcasting', 'SmallYTChannel', 'videography'];
const KEYWORDS = ['content', 'creator', 'video', 'grow', 'views', 'algorithm', 'script', 'caption', 'hook', 'tiktok', 'instagram', 'youtube', 'struggle', 'help', 'advice', 'posting', 'audience', 'followers', 'editing'];

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  // Always scrape fresh — no KV dependency
  const targets = [];

  // Use Apify fast free Reddit scraper
  const APIFY_KEY = process.env.APIFY_API_KEY;
  const results = await Promise.allSettled(
    SUBREDDITS.slice(0,4).map(async sub => {
      try {
        const r = await fetch(`https://api.apify.com/v2/acts/cryptosignals~reddit-scraper-fast/run-sync-get-dataset-items?token=${APIFY_KEY}&memory=128&timeout=25`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subreddit: sub, sort: 'hot', maxPosts: 8 })
        });
        const posts = await r.json();
        return { sub, posts: Array.isArray(posts) ? posts.map(p => ({
          title: p.title || '',
          link: p.url || p.permalink || '',
          author: p.author || '',
          content: (p.selftext || '').slice(0,300),
          score: p.score || 0,
          comments: p.numComments || 0
        })).filter(p => p.title && p.author && p.author !== 'AutoModerator') : [] };
      } catch(e) { return { sub, posts: [], error: e.message }; }
    })
  );

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const { sub, posts } = result.value;
    for (const post of posts) {
      const text = ((post.title || '') + ' ' + (post.content || '')).toLowerCase();
      const matches = KEYWORDS.filter(k => text.includes(k)).length;
      if (matches < 1) continue; // threshold lowered
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
      const allPosts = posts; debugTargets.push(`${sub}: ${allPosts.length} posts | raw: ${result.value.rawStart||'ok'} | titles: ${allPosts.slice(0,2).map(p=>p.title).join(' | ')}`);
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

Write a 2-3 sentence comment. Start with something genuine and specific to their post. Then naturally work in SAM for Creators (samforcreators.com) — frame it as a personal recommendation, like "been using SAM for Creators to help with exactly this kind of thing" or "SAM (samforcreators.com) has been a game changer for my content strategy". Sound like a real creator recommending a tool to another creator. No hashtags. Write ONLY the comment.`;

        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 120, messages: [{ role: 'user', content: prompt }] })
        });
        const d = await r.json();
        top[i].draftComment = (d.content?.[0]?.text?.trim() || '').replace(/^#[^\n]*\n/,'').replace(/^Comment[:\s]*/i,'').trim();
      } catch(e) { top[i].draftComment = ''; }
    })
  );

  // Add curated YouTube targets — high-traffic content creator videos
  const ytVideos = [
    { id: 'yt1', title: 'How to grow on YouTube in 2025 (what actually works)', url: 'https://www.youtube.com/watch?v=8F9ME5cFBJM', creator: 'Think Media', preview: 'Practical YouTube growth strategies for small creators in 2025' },
    { id: 'yt2', title: 'The YouTube algorithm explained for small creators', url: 'https://www.youtube.com/watch?v=RgfMKMqRBQY', creator: 'Paddy Galloway', preview: 'How the YouTube algorithm actually works and how to use it to grow faster' },
    { id: 'yt3', title: 'How to create content consistently without burnout', url: 'https://www.youtube.com/watch?v=4ARcxKRQXF8', creator: 'Matt Ragland', preview: 'Systems for staying consistent as a content creator without burning out' },
    { id: 'yt4', title: 'TikTok growth strategy for beginners in 2025', url: 'https://www.youtube.com/watch?v=SbBT-7BQNQU', creator: 'Sodium', preview: 'How to grow your TikTok from 0 using current algorithm strategies' },
    { id: 'yt5', title: 'How to find your niche as a content creator', url: 'https://www.youtube.com/watch?v=8PYv1wRLMVM', creator: 'Jade Beason', preview: 'Finding and owning your content niche to build a loyal audience' },
  ];

  // Draft YouTube comments
  await Promise.allSettled(ytVideos.map(async (vid, i) => {
    try {
      const prompt = `You are a content creator leaving a genuine helpful comment on a YouTube video.

Video: "${vid.title}" by ${vid.creator}
About: ${vid.preview}

Write a 2-3 sentence comment. Start with something genuine and specific to their content. Then naturally work in a mention of SAM for Creators (samforcreators.com) — frame it as something you personally use, like "been using SAM for Creators to help with exactly this" or "there's a tool called SAM (samforcreators.com) that's been a game changer for my content strategy". Make it feel like a real creator recommending a tool, not an ad. Write ONLY the comment.`;
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 120, messages: [{ role: 'user', content: prompt }] })
      });
      const d = await r.json();
      ytVideos[i].draftComment = (d.content?.[0]?.text?.trim() || '').replace(/^#[^\n]*\n/,'').replace(/^Comment[:\s]*/i,'').trim();
    } catch(e) { ytVideos[i].draftComment = ''; }
  }));

  const allTargets = [...top, ...ytVideos.map(v => ({
    id: v.id, platform: 'YouTube', url: v.url, creator: v.creator,
    title: v.title, preview: v.preview, score: 0, comments: 0,
    subreddit: 'YouTube', relevanceScore: 5, draftComment: v.draftComment || ''
  }))];

  return res.status(200).json({ success: true, targets: allTargets, total: allTargets.length });
};
