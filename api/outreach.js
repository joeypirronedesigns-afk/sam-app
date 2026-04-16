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

  // Add curated YouTube targets — high-traffic content creator videos
  const ytVideos = [
    { id: 'yt1', title: 'How to grow your YouTube channel from 0 in 2025', url: 'https://www.youtube.com/watch?v=XpCoNQYPFUo', creator: 'Think Media', preview: 'Step by step guide to growing a YouTube channel from scratch with no subscribers' },
    { id: 'yt2', title: 'Why your content isn't going viral (and how to fix it)', url: 'https://www.youtube.com/watch?v=mxqGDLcLcYo', creator: 'Paddy Galloway', preview: 'The real reasons creators struggle to get views and what to do about it' },
    { id: 'yt3', title: 'How I grew to 100k subscribers posting consistently', url: 'https://www.youtube.com/watch?v=K2bCpK9WcCo', creator: 'Creator Booth', preview: 'Consistency, thumbnails, and hooks — the three pillars of YouTube growth' },
    { id: 'yt4', title: 'TikTok content strategy that actually works in 2025', url: 'https://www.youtube.com/watch?v=7htSC3gCGFI', creator: 'Hayley Paige', preview: 'How to create content that gets pushed by the TikTok algorithm' },
    { id: 'yt5', title: 'Instagram growth tips for small creators', url: 'https://www.youtube.com/watch?v=pqMpPFl5O7s', creator: 'Jade Beason', preview: 'How to grow on Instagram when you have under 1000 followers' },
  ];

  // Draft YouTube comments
  await Promise.allSettled(ytVideos.map(async (vid, i) => {
    try {
      const prompt = `You are a content creator leaving a genuine helpful comment on a YouTube video.

Video: "${vid.title}" by ${vid.creator}
About: ${vid.preview}

Write a 2-3 sentence genuine comment that adds value. Be specific to the video topic. Only mention SAM (samforcreators.com) if it fits naturally as a tool recommendation. Sound like a real creator. Write ONLY the comment.`;
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 120, messages: [{ role: 'user', content: prompt }] })
      });
      const d = await r.json();
      ytVideos[i].draftComment = d.content?.[0]?.text?.trim() || '';
    } catch(e) { ytVideos[i].draftComment = ''; }
  }));

  const allTargets = [...top, ...ytVideos.map(v => ({
    id: v.id, platform: 'YouTube', url: v.url, creator: v.creator,
    title: v.title, preview: v.preview, score: 0, comments: 0,
    subreddit: 'YouTube', relevanceScore: 5, draftComment: v.draftComment || ''
  }))];

  return res.status(200).json({ success: true, targets: allTargets, total: allTargets.length });
};
