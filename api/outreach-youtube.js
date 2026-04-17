module.exports.config = { api: { bodyParser: { sizeLimit: '1mb' } } };

// ─── SEARCH QUERIES — these define "ideal SAM user" signal ──────────────
// Queries map to the 5 SAM painpoints. Pulse will find creators talking
// about these problems — which means their audiences have them too.
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

// ─── FILTERS ────────────────────────────────────────────────────────────
const MAX_VIDEOS_PER_QUERY   = 5;    // Apify pulls this many per search
const MAX_DAYS_OLD           = 60;   // skip videos older than this
const MIN_VIEW_COUNT         = 1000; // skip low-traffic dead videos
const MAX_TOTAL_TARGETS      = 12;   // final list size after dedup
const QUERIES_PER_REFRESH    = 5;    // randomly pick N queries each refresh (rotation)

// ─── SAM BRAND + PULSE SYSTEM PROMPT (mirrors api/daily.js exactly) ─────
const BRAND = `SAM BRAND KNOWLEDGE:
SAM is an AI creative director built exclusively for content creators. NOT a general AI. NOT ChatGPT with a new coat of paint.

VOICE DNA - THE EXCLUSIVE DIFFERENTIATOR:
Voice DNA is a living profile of how a creator communicates - their rhythm, humor, phrasing, emotional register, sentence structure. It grows every session. It never overwrites - only gets deeper. First session: SAM is good. After ten sessions: SAM sounds exactly like them.

THE 5 CREATOR PAINPOINTS SAM SOLVES:
1. I sound like a robot when I use AI
2. I start from zero every single time
3. Content feels hollow, like it could belong to anyone
4. I have spent years finding my voice - AI erases it
5. I am figuring this out alone

JOEY FOUNDER STORY:
Joey Pirrone. Self-taught creator. Moved Fort Myers → Indianapolis → Upper Marlboro, MD. Lived in his brother's garage with wife Amanda and their dogs while selling their Indianapolis home. Bought a 28.5ft Forest River travel trailer, parked it in his parents' backyard while gutting their 1950s cottage — "From Studs to Sanctuary." Started posting 6 months ago. Zero following, zero experience. Almost quit multiple times. Tried Claude Code, built SAM — had never built software before. Hands shook when he realized what he made.

TONE RULES - NEVER USE:
journey, authentic, powerful story, resonate, leverage, impactful, unlock, supercharge, game-changer

JOEY'S REAL OUTREACH VOICE:
"Hey Jon, I'm a fellow creator. I follow your stuff and wanted to say thank you for the idea of the introduction video, I applied what you said to do, and it worked great! I love your content. You're super authentic and that's why I thought of you this morning… cause your content is all about helping others like me. Your heart is in the right place. I'm a little nervous about reaching out to you like this. we don't know each other personally and so I'll just cut to the Chase… I developed an app because I felt like my content ideas were scattered and random. It's basically an app to help me solve some of the problems I was having for social media posting and sharing my home renovations journey over on my channel. I'd like to share it with you if that's OK: to test it and get feedback. I know how this might look or sound to you, but it's completely free for you to use. i'm just looking for other content creators who might find it useful and get real feedback before I start letting others know about it. -Joey"

WHAT THIS REVEALS:
1. Leads with the person, never the product
2. Gratitude first, specific compliment, then ask
3. Vulnerable on purpose
4. Frames SAM as something he built for himself
5. Tiny ask, pressure-free exit

WHAT JOEY WOULD NEVER WRITE:
- Marketing-email language, fake urgency, exaggeration
- Generic compliments, corporate language
- Anything pushy or condescending`;

const PULSE_SYSTEM = `You are The Pulse — SAM HQ's outreach agent. Built by Joey Pirrone, founder of SAM at samforcreators.com.

${BRAND}

YOUR TASK RIGHT NOW: Draft a single YouTube comment on the video below. This is a PUBLIC comment that other viewers will see, not a DM. Your goal is for this comment to be the most useful one in the thread so other creators upvote it and Joey's profile earns real attention.

HARD RULES:
1. Lead with a SPECIFIC reaction to something in the video — a framing choice, a line in the title/description, a point you can tell the video is making. Prove you watched it.
2. Add something the creator didn't say — a lived-experience angle, a tactical add, a thoughtful counter. You are contributing, not complimenting.
3. Mention SAM (samforcreators.com) ONLY if the video's subject genuinely opens the door — e.g., the video is about AI content, finding your voice, creator burnout, or sounding generic. If it doesn't open the door, write a great comment with no mention at all. A great comment with no mention beats a forced mention every time.
4. If you do mention SAM, frame it the way Joey does — "I've been building a tool called SAM for this exact problem" — never "check out SAM, it's a game-changer."
5. 2–4 sentences. No hashtags. No emojis. No signoff. No "-Joey" (that's for DMs, not public comments).
6. Zero banned words.
7. Sound like a real creator who happened to watch this video. Not a marketer. Not an AI.

Output ONLY the comment text. No preamble, no labels, no quotes.`;

// ─── HANDLER ─────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const APIFY_KEY = process.env.APIFY_API_KEY;

  if (!ANTHROPIC_KEY || !APIFY_KEY) {
    return res.status(500).json({ success: false, error: 'Missing API keys' });
  }

  // Step 1 — shuffle queries and pick a random subset (rotation mechanism)
  const shuffled = [...SEARCH_QUERIES].sort(() => Math.random() - 0.5);
  const activeQueries = shuffled.slice(0, QUERIES_PER_REFRESH);

  // Step 2 — scrape each query in parallel via Apify
  const scrapeResults = await Promise.allSettled(
    activeQueries.map(async (query) => {
      try {
        const r = await fetch(
          `https://api.apify.com/v2/acts/apidojo~youtube-scraper/run-sync-get-dataset-items?token=${APIFY_KEY}&memory=512&timeout=60`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              searchQueries: [query],
              maxItems: MAX_VIDEOS_PER_QUERY,
              sortBy: 'r',       // relevance
              dateFilter: 'm',   // this month
              type: 'v',         // videos only (no shorts, no channels)
            }),
          }
        );
        const videos = await r.json();
        if (!Array.isArray(videos)) return { query, videos: [], error: 'non-array response' };
        return {
          query,
          videos: videos.map(v => ({
            videoId: v.id || v.videoId || '',
            title: v.title || '',
            url: v.url || (v.id ? `https://www.youtube.com/watch?v=${v.id}` : ''),
            viewCount: parseInt(v.viewCount || v.views || 0, 10) || 0,
            date: v.date || v.publishedAt || v.uploadDate || v.publishedTimeText || '',
            channelName: v.channelName || v.author || v.uploader || 'Unknown',
            channelUrl: v.channelUrl || v.authorUrl || '',
            duration: v.duration || '',
            description: (v.description || v.text || '').slice(0, 500),
          })).filter(v => v.videoId && v.url && v.title),
        };
      } catch (e) {
        return { query, videos: [], error: e.message };
      }
    })
  );

  // Step 3 — flatten + filter + dedupe by channel
  const cutoffDate = Date.now() - (MAX_DAYS_OLD * 24 * 60 * 60 * 1000);
  const seenChannels = new Set();
  const seenVideoIds = new Set();
  const targets = [];

  for (const result of scrapeResults) {
    if (result.status !== 'fulfilled') continue;
    const { query, videos } = result.value;
    for (const v of videos) {
      // Skip duplicates
      if (seenVideoIds.has(v.videoId)) continue;
      if (seenChannels.has(v.channelName)) continue;

      // View threshold
      if (v.viewCount && v.viewCount < MIN_VIEW_COUNT) continue;

      // Date filter — only enforce if we can parse the date
      const parsed = Date.parse(v.date);
      if (!isNaN(parsed) && parsed < cutoffDate) continue;

      seenVideoIds.add(v.videoId);
      seenChannels.add(v.channelName);

      targets.push({
        id: v.videoId,
        platform: 'YouTube',
        url: v.url,
        creator: v.channelName,
        channelUrl: v.channelUrl,
        title: v.title,
        preview: v.description,
        viewCount: v.viewCount,
        date: v.date,
        score: v.viewCount,      // display compatibility with existing card
        comments: 0,
        foundVia: query,
        draftComment: null,
      });
    }
  }

  // Shuffle targets so display order varies each refresh
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

  // Step 4 — draft comments via The Pulse (Sonnet + full brain)
  await Promise.allSettled(
    top.map(async (target, i) => {
      try {
        const userMessage = `Video title: "${target.title}"
Channel: ${target.creator}
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
        top[i].draftComment = (d.content?.[0]?.text || '').trim();
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
