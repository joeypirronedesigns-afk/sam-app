module.exports.config = { api: { bodyParser: { sizeLimit: '1mb' } } };

const SUBREDDITS = ['NewTubers', 'socialmedia', 'youtubers', 'podcasting', 'SmallYTChannel', 'videography'];
const KEYWORDS = ['content', 'creator', 'video', 'grow', 'views', 'algorithm', 'script', 'caption', 'hook', 'tiktok', 'instagram', 'youtube', 'struggle', 'help', 'advice', 'posting', 'audience', 'followers', 'editing'];

const BRAND = `SAM BRAND KNOWLEDGE:
SAM is an AI creative director built exclusively for content creators. NOT a general AI. NOT ChatGPT with a new coat of paint.

VOICE DNA is a living profile of how a creator communicates. It grows every session. First session: SAM is good. After ten sessions: SAM sounds exactly like them.

THE 5 CREATOR PAINPOINTS SAM SOLVES:
1. I sound like a robot when I use AI
2. I start from zero every single time
3. Content feels hollow
4. I have spent years finding my voice - AI erases it
5. I am figuring this out alone

JOEY FOUNDER STORY:
Joey Pirrone. Self-taught creator. Lived in his brother's garage, then a 28.5ft travel trailer in his parents' backyard while gutting their 1950s cottage. Started posting 6 months ago with zero following. Almost quit multiple times. Built SAM using Claude Code — had never built software before. Hands shook when he realized what he made.

TONE RULES - NEVER USE:
journey, authentic, powerful story, resonate, leverage, impactful, unlock, supercharge, game-changer

JOEY'S VOICE: Leads with the person. Gratitude first. Vulnerable on purpose. Frames SAM as something he built for himself. Tiny ask, pressure-free. Signs -Joey (in DMs only, not public comments).

NEVER: marketing-email language, fake urgency, exaggeration, generic compliments, corporate language, anything pushy.`;

const PULSE_SYSTEM = `You are The Pulse — SAM HQ's outreach agent. Built by Joey Pirrone, founder of SAM at samforcreators.com.

${BRAND}

YOUR TASK RIGHT NOW: Draft a single Reddit comment on the post below. This is a public reply other redditors will read. Your goal is a comment that genuinely helps the OP so it gets upvoted.

HARD RULES:
1. Lead with a SPECIFIC reaction to what the OP actually said. Prove you read their post.
2. Offer something real — a tactic, a reframe, a lived-experience take. Contribute, don't compliment.
3. Mention SAM (samforcreators.com) ONLY if the post's problem directly maps to what SAM solves. If it doesn't, skip the mention entirely — a great comment without a mention beats a forced one.
4. If you do mention it, frame it like Joey does: "been building a tool called SAM because I had this exact problem" — never "check out SAM, game-changer."
5. 2–4 sentences. No hashtags. No signoff. No "-Joey" (that's DMs, not public comments).
6. Zero banned words.
7. Sound like a redditor who happens to be a creator, not a marketer.

Output ONLY the comment text.`;

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const APIFY_KEY = process.env.APIFY_API_KEY;

  const targets = [];
  const results = await Promise.allSettled(
    SUBREDDITS.slice(0, 4).map(async sub => {
      try {
        const r = await fetch(
          `https://api.apify.com/v2/acts/cryptosignals~reddit-scraper-fast/run-sync-get-dataset-items?token=${APIFY_KEY}&memory=128&timeout=25`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subreddit: sub, sort: 'hot', maxPosts: 8 }),
          }
        );
        const posts = await r.json();
        return {
          sub,
          posts: Array.isArray(posts) ? posts.map(p => ({
            title: p.title || '',
            link: p.url || p.permalink || '',
            author: p.author || '',
            content: (p.selftext || '').slice(0, 300),
            score: p.score || 0,
            comments: p.numComments || 0,
          })).filter(p => p.title && p.author && p.author !== 'AutoModerator') : [],
        };
      } catch (e) { return { sub, posts: [], error: e.message }; }
    })
  );

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const { sub, posts } = result.value;
    for (const post of posts) {
      const text = ((post.title || '') + ' ' + (post.content || '')).toLowerCase();
      const matches = KEYWORDS.filter(k => text.includes(k)).length;
      if (matches < 1) continue;
      targets.push({
        id: Math.random().toString(36).slice(2),
        platform: 'Reddit',
        url: post.link,
        creator: `u/${post.author}`,
        title: post.title,
        preview: post.content,
        score: post.score,
        comments: post.comments,
        subreddit: `r/${sub}`,
        relevanceScore: matches,
        draftComment: null,
      });
    }
  }

  targets.sort((a, b) => b.relevanceScore - a.relevanceScore);
  const top = targets.slice(0, 15);

  if (top.length === 0) {
    return res.status(200).json({ success: true, platform: 'reddit', targets: [], total: 0 });
  }

  await Promise.allSettled(
    top.map(async (target, i) => {
      try {
        const userMessage = `Subreddit: ${target.subreddit}
OP: ${target.creator}
Post title: "${target.title}"
Post body: ${target.preview || '(title only)'}

Draft the comment.`;

        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 300,
            system: PULSE_SYSTEM,
            messages: [{ role: 'user', content: userMessage }],
          }),
        });
        const d = await r.json();
        top[i].draftComment = (d.content?.[0]?.text || '').trim();
      } catch (e) { top[i].draftComment = ''; }
    })
  );

  return res.status(200).json({
    success: true,
    platform: 'reddit',
    targets: top,
    total: top.length,
    scrapedAt: new Date().toISOString(),
  });
};
