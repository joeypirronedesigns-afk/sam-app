module.exports.config = { api: { bodyParser: { sizeLimit: '1mb' } } };

const SEARCH_QUERIES = [
  'growing small youtube channel',
  'content creator burnout',
  'how to find your voice content creator',
  'youtube algorithm small creator',
  'ai content sounds generic',
  'chatgpt content sounds fake',
  'consistent content creation system',
  'content creator stuck',
  'how to sound like yourself on camera',
  'content creator starting from zero',
];

const QUERIES_PER_REFRESH = 3;
const MAX_RESULTS_PER_QUERY = 10;
const MAX_DAYS_OLD = 90;
const MIN_VIEW_COUNT = 500;
const MAX_TOTAL_TARGETS = 12;

function shortToken() {
  return Math.random().toString(36).slice(2, 10);
}

function tagCommentWithToken(comment, token, platform) {
  if (!comment) return comment;
  const tag = `samforcreators.com/welcome?src=${platform}_${token}`;
  return comment
    .replace(/samforcreators\.com\/welcome(\?[^\s)]*)?/gi, tag)
    .replace(/samforcreators\.com(?!\/welcome)/gi, tag);
}

const BRAND = `SAM BRAND KNOWLEDGE:
SAM is an AI creative director built exclusively for content creators. NOT a general AI. NOT ChatGPT with a new coat of paint.

VOICE DNA is a living profile of how a creator communicates. It grows every session. First session: SAM is good. After ten sessions: SAM sounds exactly like them.

THE 5 CREATOR PAINPOINTS SAM SOLVES:
1. I sound like a robot when I use AI
2. I start from zero every single time
3. Content feels hollow, like it could belong to anyone
4. I have spent years finding my voice - AI erases it
5. I am figuring this out alone

JOEY FOUNDER STORY:
Joey Pirrone. Self-taught creator. Lived in his brothers garage with wife Amanda and their dogs while selling their Indianapolis home. Bought a 28.5ft travel trailer, parked it in his parents backyard while gutting their 1950s cottage. Started posting 6 months ago with zero following, zero experience. Almost quit multiple times. Built SAM using Claude Code. Had never built software before.

TONE RULES - NEVER USE:
journey, authentic, powerful story, resonate, leverage, impactful, unlock, supercharge, game-changer

JOEYS VOICE: Leads with the person. Gratitude first. Vulnerable on purpose. Frames SAM as something he built for himself. Tiny ask, pressure-free. Never marketing language, never pushy, never corporate.`;

const PULSE_SYSTEM = `You are The Pulse, SAM HQs outreach agent. Built by Joey Pirrone, founder of SAM at samforcreators.com.

${BRAND}

YOUR TASK: Draft a single YouTube comment on the video below. This is a PUBLIC comment other viewers will see, not a DM. Your goal is for this comment to be the most useful one in the thread so creators upvote it and Joeys profile earns real attention.

HARD RULES:
1. Lead with a SPECIFIC reaction to something in the video. Prove you watched it.
2. Add something the creator didnt say. Contribute, dont compliment.
3. Mention SAM (samforcreators.com/welcome) ONLY if the videos subject genuinely opens the door. Otherwise write a great comment with no mention. A great comment without a mention beats a forced one.
4. If you mention SAM, frame it like Joey: "Ive been building a tool called SAM for this exact problem". Never "check out SAM, its a game-changer".
5. 2 to 4 sentences. No hashtags. No emojis. No signoff. No "-Joey".
6. Zero banned words.
7. Sound like a real creator who happened to watch this video.

Output ONLY the comment text.`;

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cron-secret');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // v9.113.1 — cron-secret check
  const _cronSecret = process.env.CRON_SECRET;
  const _authHeader = (req.headers['authorization'] || '').toString();
  const _xCronHeader = (req.headers['x-cron-secret'] || '').toString();
  const _validVercel = _cronSecret && _authHeader === `Bearer ${_cronSecret}`;
  const _validCustom = _cronSecret && _xCronHeader === _cronSecret;
  if (!_validVercel && !_validCustom) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const APIFY_KEY = process.env.APIFY_API_KEY;
  if (!ANTHROPIC_KEY || !APIFY_KEY) {
    return res.status(500).json({ success: false, error: 'Missing API keys' });
  }

  const shuffled = [...SEARCH_QUERIES].sort(() => Math.random() - 0.5);
  const activeQueries = shuffled.slice(0, QUERIES_PER_REFRESH);

  const scrapeResults = await Promise.allSettled(
    activeQueries.map(async (query) => {
      try {
        const r = await fetch(
          `https://api.apify.com/v2/acts/streamers~youtube-scraper/run-sync-get-dataset-items?token=${APIFY_KEY}&memory=1024&timeout=120`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              searchKeywords: query,
              maxResults: MAX_RESULTS_PER_QUERY,
              maxResultsShorts: 0,
              maxResultStreams: 0,
            }),
          }
        );
        const videos = await r.json();
        if (!Array.isArray(videos)) return { query, videos: [], error: 'non-array response' };
        return {
          query,
          videos: videos
            .filter(v => v && v.id && v.url && v.title)
            .map(v => ({
              videoId: v.id,
              title: v.title || '',
              url: v.url,
              viewCount: v.viewCount || 0,
              date: v.date || '',
              channelName: v.channelName || 'Unknown',
              channelUrl: v.channelUrl || '',
              subscribers: v.numberOfSubscribers || 0,
              duration: v.duration || '',
              description: (v.text || '').slice(0, 500),
              likes: v.likes || 0,
              commentsCount: v.commentsCount || 0,
            })),
        };
      } catch (e) {
        return { query, videos: [], error: e.message };
      }
    })
  );

  const cutoffDate = Date.now() - (MAX_DAYS_OLD * 24 * 60 * 60 * 1000);
  const seenChannels = new Set();
  const seenVideoIds = new Set();
  const targets = [];

  for (const result of scrapeResults) {
    if (result.status !== 'fulfilled') continue;
    const { query, videos } = result.value;
    for (const v of videos) {
      if (seenVideoIds.has(v.videoId)) continue;
      if (seenChannels.has(v.channelName)) continue;
      if (v.viewCount && v.viewCount < MIN_VIEW_COUNT) continue;
      const parsed = Date.parse(v.date);
      if (!isNaN(parsed) && parsed < cutoffDate) continue;
      seenVideoIds.add(v.videoId);
      seenChannels.add(v.channelName);
      targets.push({
        id: v.videoId,
        token: shortToken(),
        platform: 'YouTube',
        url: v.url,
        creator: v.channelName,
        channelUrl: v.channelUrl,
        title: v.title,
        preview: v.description,
        viewCount: v.viewCount,
        subscribers: v.subscribers,
        date: v.date,
        score: v.likes,
        comments: v.commentsCount,
        foundVia: query,
        draftComment: null,
      });
    }
  }

  targets.sort(() => Math.random() - 0.5);
  const top = targets.slice(0, MAX_TOTAL_TARGETS);

  if (top.length === 0) {
    return res.status(200).json({
      success: true,
      targets: [],
      total: 0,
      debug: {
        queriesRun: activeQueries,
        results: scrapeResults.map(r => r.status === 'fulfilled'
          ? `${r.value.query}: ${r.value.videos.length} videos${r.value.error ? ` (err: ${r.value.error})` : ''}`
          : `rejected: ${r.reason}`),
      },
    });
  }

  await Promise.allSettled(
    top.map(async (target, i) => {
      try {
        const userMessage = `Video title: "${target.title}"
Channel: ${target.creator} (${target.subscribers ? target.subscribers.toLocaleString() + ' subs' : 'sub count unknown'})
Views: ${target.viewCount ? target.viewCount.toLocaleString() : 'unknown'}
Published: ${target.date || 'recently'}
Found via search: "${target.foundVia}"

Video description:
${target.preview || '(no description available)'}

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
        const rawComment = (d.content?.[0]?.text || '').trim();
        top[i].draftComment = tagCommentWithToken(rawComment, top[i].token, 'youtube');
      } catch (e) {
        top[i].draftComment = '';
      }
    })
  );

  return res.status(200).json({
    success: true,
    platform: 'youtube',
    targets: top,
    total: top.length,
    queriesRun: activeQueries,
    scrapedAt: new Date().toISOString(),
  });
};
