// api/daily-brief.js
// Returns SAM's daily brief for the current user, cached per day.
// GET /api/daily-brief?email=user@example.com&timezone=America/New_York&date=2026-04-28
// Returns: { verdict_line, body, primary_cta_label, primary_cta_route, primary_cta_reason, brief_date, cached: bool }

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const FALLBACK_BRIEF = {
  verdict_line: "I'm reading the room before I make today's call.",
  body: "Your dashboard is live, but today's verdict is still assembling from your latest signals. Start with the tool that feels most urgent, and I'll tighten the read once the picture is clearer.",
  primary_cta_label: "See the data",
  primary_cta_route: "today",
  primary_cta_reason: "Review your current state before committing to a direction.",
  brief_date: new Date().toISOString().slice(0, 10),
  cached: false,
  fallback: true
};

async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) throw new Error(`Supabase error ${res.status}`);
  return res.json();
}

async function getUserProfile(email) {
  const data = await supabaseFetch(
    `sam_users?email=eq.${encodeURIComponent(email)}&select=uid,sam_context,voice_profile,voice_calibrated,niche,platforms,story_engine_current_step,reach_platforms_ready&order=last_seen.desc.nullslast&limit=1`
  );
  return data && data.length > 0 ? data[0] : null;
}

async function getCachedBrief(email, briefDate) {
  const data = await supabaseFetch(
    `sam_daily_briefs?email=eq.${encodeURIComponent(email)}&brief_date=eq.${briefDate}&limit=1`
  );
  return data && data.length > 0 ? data[0] : null;
}

async function saveBrief(email, briefDate, timezone, brief, profile) {
  const sourceSnapshot = {
    voice_calibrated: profile.voice_calibrated,
    story_engine_current_step: profile.story_engine_current_step,
    reach_platforms_ready: profile.reach_platforms_ready,
    has_context: !!profile.sam_context
  };
  const sourceHash = JSON.stringify(sourceSnapshot);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/sam_daily_briefs`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
      email,
      brief_date: briefDate,
      timezone: timezone || 'UTC',
      verdict_line: brief.verdict_line,
      body: brief.body,
      primary_cta_label: brief.primary_cta_label,
      primary_cta_route: brief.primary_cta_route,
      primary_cta_reason: brief.primary_cta_reason,
      source_hash: sourceHash,
      source_snapshot: sourceSnapshot,
      model: 'claude-haiku-4-5-20251001',
      updated_at: new Date().toISOString()
    })
  });
  return res.ok;
}

async function generateBrief(profile, briefDate) {
  const niche = profile.niche || 'content creator';
  const platforms = profile.platforms || 'social media';
  const context = profile.sam_context ? profile.sam_context.slice(0, 1200) : '';
  const voiceCalibrated = profile.voice_calibrated ? 'calibrated' : 'not yet calibrated';
  const storyStep = profile.story_engine_current_step;
  const reachReady = profile.reach_platforms_ready;

  const systemPrompt = `You are SAM, a sharp editorial creative director for a solo creator business. Each morning, you write one clear daily verdict based on the creator's current momentum, bottlenecks, and next best move. You are specific, decisive, and slightly cinematic. You do not sound generic, motivational, or corporate. You choose one priority only.

HARD RULES:
- Never use phrases like "keep it up", "unlock your potential", "today is a great day"
- Mention at least one specific signal from the context provided
- Pick exactly one priority and one CTA
- verdict_line must be one sentence only, 8-18 words
- body must be 2-3 sentences only
- primary_cta_route must be one of: story-engine, reach, voice-dna, spark, all-tools, today
- No hedging language like "you might want to"
- No bullet points
- No references to being an AI
- Respond ONLY with valid JSON, no markdown, no backticks

PRIORITY LADDER (use this order):
1. Publishing gap or missing next move
2. Story progress stalled
3. Reach readiness weak or underused
4. Voice DNA not calibrated
5. Otherwise: momentum/consistency verdict`;

  const userPrompt = `Today's date: ${briefDate}
Creator niche: ${niche}
Platforms: ${platforms}
Voice DNA: ${voiceCalibrated}
Story Engine: ${storyStep ? `at step ${storyStep} of 12` : 'not started'}
Reach: ${reachReady ? `ready for ${reachReady} platform(s)` : 'not generated yet'}
Creator context: ${context || 'No context available yet.'}

Write today's daily brief as JSON matching this exact schema:
{
  "verdict_line": "string",
  "body": "string",
  "primary_cta_label": "string",
  "primary_cta_route": "string",
  "primary_cta_reason": "string",
  "source_signals": ["array", "of", "strings"],
  "brief_date": "${briefDate}"
}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });

  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json();
  const raw = data.content && data.content[0] && data.content[0].text ? data.content[0].text : '';
  const clean = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(clean);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPABASE_URL || !SUPABASE_KEY || !ANTHROPIC_API_KEY) {
    return res.status(200).json(FALLBACK_BRIEF);
  }

  const raw = req.query.email;
  const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  const timezone = req.query.timezone || 'UTC';
  const briefDate = req.query.date || new Date().toISOString().slice(0, 10);

  if (!email || !email.includes('@')) {
    return res.status(200).json(FALLBACK_BRIEF);
  }

  try {
    // Check cache first
    const cached = await getCachedBrief(email, briefDate);
    if (cached) {
      return res.status(200).json({
        verdict_line: cached.verdict_line,
        body: cached.body,
        primary_cta_label: cached.primary_cta_label,
        primary_cta_route: cached.primary_cta_route,
        primary_cta_reason: cached.primary_cta_reason,
        brief_date: cached.brief_date,
        cached: true
      });
    }

    // Generate fresh brief
    const profile = await getUserProfile(email);
    if (!profile) return res.status(200).json(FALLBACK_BRIEF);

    const brief = await generateBrief(profile, briefDate);
    await saveBrief(email, briefDate, timezone, brief, profile);

    return res.status(200).json({ ...brief, cached: false });

  } catch (err) {
    console.error('daily-brief error:', err);
    return res.status(200).json(FALLBACK_BRIEF);
  }
};
