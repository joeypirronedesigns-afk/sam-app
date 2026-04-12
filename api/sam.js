module.exports.config = { api: { bodyParser: { sizeLimit: "10mb" } } };
const { trackUser, trackEvent, saveUserProfile, getUserProfile } = require('./_supabase');

// ── TIER LIMITS ────────────────────────────────────────────────────────────
const TIER_LIMITS = {
  free:    { playbooks: 5,  nextTools: 15,  chatMessages: 20 },
  creator: { playbooks: 10, nextTools: 70,  chatMessages: 50 },
  pro:     { playbooks: 20, nextTools: 200, chatMessages: 150 },
  studio:  { playbooks: 100,nextTools: 999, chatMessages: 999 },
};

async function checkLimit(userId, tier, action, tourStep) {
  // Dev bypass
  if (userId && (userId.startsWith('dev-') || userId === 'dev@sam.com')) {
    return { allowed: true };
  }
  // Tour bypass — users going through guided tour run free
  if (tourStep !== undefined && tourStep !== null && parseInt(tourStep) >= 0 && parseInt(tourStep) <= 5) {
    return { allowed: true, tour: true };
  }
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      let kv;
      try { kv = require('@vercel/kv').kv; }
      catch(pkgErr) { console.log('KV package not available — skipping rate limit'); return { allowed: true }; }
      const today = new Date().toISOString().split('T')[0];
      const key = `${action}:${userId}:${today}`;
      const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
      const limit = limits[action] || 999;
      const current = (await kv.get(key)) || 0;
      if (current >= limit) {
        return { allowed: false, used: current, limit, message: 'Daily limit reached for your plan. Upgrade for more.' };
      }
      await kv.set(key, current + 1, { ex: 90000 });
      return { allowed: true, used: current + 1, limit };
    } catch(e) {
      console.error('KV error — failing open:', e.message);
      return { allowed: true };
    }
  }
  return { allowed: true };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mode, moment, platforms, contentType, creatorContext, tone, audienceDemographics, outputLanguage, emojiPreference, voiceProfile } = req.body;
  const userId = req.body.userId || req.headers['x-forwarded-for'] || 'anon';
  const tier = req.body.tier || 'free';

  // Load user profile from Supabase (for persistent memory)
  let userProfile = null;
  if (userId && userId !== 'anon') {
    userProfile = await getUserProfile(userId).catch(() => null);
  }

  // Track user activity in Supabase (non-blocking) — must run BEFORE saveUserProfile
  if (userId && userId !== 'anon') {
    trackUser({
      uid: userId,
      email: req.body.email || null,
      name: req.body.name || null,
      tier,
      niche: req.body.niche || null,
      platforms: req.body.platforms || null,
      voice_calibrated: !!req.body.voiceProfile
    }).catch(() => {});
    trackEvent(userId, mode || 'chat', { tier }).catch(() => {});
  }

  // Save voice profile + context AFTER trackUser (awaited so row exists first)
  if (userId && userId !== 'anon' && (req.body.voiceProfile || req.body.samContext)) {
    await trackUser({ uid: userId, tier, voice_calibrated: !!req.body.voiceProfile }).catch(() => {});
    await saveUserProfile(userId, {
      voice_profile: req.body.voiceProfile || (userProfile && userProfile.voice_profile) || null,
      sam_context: req.body.samContext || (userProfile && userProfile.sam_context) || null
    }).catch(() => {});
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const tourStep = req.body.tourStep !== undefined ? req.body.tourStep : null;

  if (mode === 'playbook') {
    const check = await checkLimit(userId, tier, 'playbooks', tourStep);
    if (!check.allowed) return res.status(429).json({ error: 'limit_reached', message: check.message });
  }
  if (mode === 'chat' && req.body.messages) {
    const check = await checkLimit(userId, tier, 'chatMessages', tourStep);
    if (!check.allowed) return res.status(429).json({ error: 'limit_reached', message: check.message });
  }

  // ── CHAT MODE ─────────────────────────────────────────────────────────────
  // Two sub-modes:
  //   messages present = SAM chatbot (Haiku, 400 tokens, conversational)
  //   no messages = "tools" mode (Sonnet, 3000 tokens, JSON generation)
  if (mode === 'chat') {
    const { messages, systemPrompt } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // ── CHATBOT sub-mode (has messages array) ────────────────────────────────
    if (messages && Array.isArray(messages)) {
      // Check if any message has image content — use Sonnet for vision
      const hasImage = messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image'));
      const chatModel = hasImage ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';
      const chatMaxTokens = hasImage ? 600 : 400;
      // Inject stored user profile into system prompt if available
      let profileContext = '';
      if (userProfile) {
        const parts = [];
        if (userProfile.name) parts.push('User name: ' + userProfile.name);
        if (userProfile.niche) parts.push('Niche: ' + userProfile.niche);
        if (userProfile.platforms) parts.push('Platforms: ' + userProfile.platforms);
        if (userProfile.voice_profile) parts.push('Voice DNA: ' + userProfile.voice_profile.slice(0, 600));
        if (userProfile.sam_context) parts.push('Story context: ' + userProfile.sam_context.slice(0, 800));
        if (parts.length) profileContext = '\n\nUSER PROFILE (use this to personalize every response):\n' + parts.join('\n');
      }
      const baseSystem = systemPrompt || `You are SAM`;
      const chatSystem = systemPrompt ? systemPrompt + profileContext : `You are SAM — Strategic Assistant for Making — a friendly, sharp creative director built into the SAM app at samforcreators.com. You help creators understand and get the most out of SAM's 5 tools.

THE 5 TOOLS:
1. The Pulse — User describes a real moment in their own words. SAM writes: one powerful hook, a full word-for-word script with b-roll cues, platform captions for all selected platforms. Best for: any real moment, story, setback, win, or emotion worth sharing.
2. The Spark — User describes their niche. SAM generates 5 specific content ideas with a why-it-works breakdown and best platform for each. Each idea can be sent straight to The Pulse.
3. The Blueprint — User describes their niche and selects platforms. SAM builds a complete 7-day posting calendar with content type, caption, and platform for each day.
4. The Vision — User describes their niche or idea. SAM generates one bold unique video concept with premise, hook line, production notes, and a real virality score.
5. The Lens — Two modes: (A) Drop a photo — SAM builds thumbnail strategy. (B) Drop analytics screenshot — SAM reads what's working.

PERSONALITY: Confident, direct, warm. Keep responses to 2-4 sentences max. No jargon.` + profileContext;

      try {
        const chatRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: chatModel,
            max_tokens: chatMaxTokens,
            system: chatSystem,
            messages: messages.slice(-10)
          })
        });
        const data = await chatRes.json();
        const reply = data?.content?.[0]?.text || "I'm here! Try asking again.";
        res.write('data: ' + JSON.stringify({ done: true, result: { reply } }) + '\n\n');
        return res.end();
      } catch(e) {
        res.write('data: ' + JSON.stringify({ error: e.message }) + '\n\n');
        return res.end();
      }
    }

    // ── TOOLS sub-mode (no messages — JSON generation for next tools + regen) ─
    // Uses Sonnet with 3000 tokens so complex JSON (emails, calendars, etc) fits
    const toolPrompt = req.body.toolPrompt || (req.body.messages?.[0]?.content) || moment || '';
    if (!toolPrompt) {
      res.write('data: ' + JSON.stringify({ error: 'No prompt provided' }) + '\n\n');
      return res.end();
    }

    // Trim toolPrompt if too large to prevent Anthropic API errors
    const trimmedPrompt = toolPrompt.length > 6000 ? toolPrompt.slice(0, 6000) + '\n[truncated for length]' : toolPrompt;
    try {
      const toolRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 3000,   // Haiku: fast + cheap for structured JSON tools
          stream: true,
          system: 'You are SAM — Strategic Assistant for Making. Return ONLY valid JSON. No markdown. No backticks. No explanation outside the JSON.',
          messages: [{ role: 'user', content: trimmedPrompt }]
        })
      });

      if (!toolRes.ok) {
        const e = await toolRes.text().catch(() => '');
        res.write('data: ' + JSON.stringify({ error: 'API error ' + toolRes.status }) + '\n\n');
        return res.end();
      }

      const reader = toolRes.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const evt = JSON.parse(raw);
            if (evt.type === 'content_block_delta' && evt.delta?.text) {
              full += evt.delta.text;
              res.write('data: ' + JSON.stringify({ t: evt.delta.text }) + '\n\n');
            }
          } catch(_) {}
        }
      }
      // Parse and return the JSON
      let clean = full.trim().replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```$/i,'').trim();
      const first = clean.indexOf('{'), last = clean.lastIndexOf('}');
      if (first !== -1 && last !== -1) clean = clean.slice(first, last + 1);
      let parsed;
      try { parsed = JSON.parse(clean); }
      catch(e) {
        // Try to recover truncated JSON
        let partial = clean.slice(first !== -1 ? first : 0);
        let opens = 0;
        for (const ch of partial) { if (ch === '{') opens++; else if (ch === '}') opens--; }
        partial = partial + '}'.repeat(Math.max(0, opens));
        try { parsed = JSON.parse(partial); }
        catch(e2) {
          res.write('data: ' + JSON.stringify({ error: 'Could not parse response — try again' }) + '\n\n');
          return res.end();
        }
      }
      // Return as reply field so client-side parsing works consistently
      res.write('data: ' + JSON.stringify({ done: true, result: { reply: JSON.stringify(parsed) } }) + '\n\n');
      return res.end();
    } catch(e) {
      res.write('data: ' + JSON.stringify({ error: e.message }) + '\n\n');
      return res.end();
    }
  }

  if (!mode) return res.status(400).json({ error: 'Missing mode' });
  if (mode !== 'playbook' && mode !== 'chat' && (!moment)) {
    return res.status(400).json({ error: 'Missing moment' });
  }

  const PLATFORM_SPECS = {
    'TikTok':           { limit: 2200, hashtags: '3-5 hashtags', note: 'Hook in first line. First 1-2 seconds decide everything. Under 60s performs best.' },
    'YouTube Shorts':   { limit: 100,  hashtags: '3 hashtags above title', note: 'Title up to 100 chars is the primary discovery hook. Vertical 9:16, under 60s.' },
    'YouTube':          { limit: 5000, hashtags: '5-8 hashtags, first 3 appear above title', note: 'Title up to 100 chars. First 2-3 lines of description show before "more". Front-load keywords.' },
    'Instagram Reels':  { limit: 2200, hashtags: '3-5 focused hashtags', note: 'First 125 chars critical. Reels reach non-followers more than any other IG format.' },
    'Facebook Reels':   { limit: 477,  hashtags: '2-3 hashtags max', note: 'Under 477 chars. Hook in first 3 seconds.' },
    'LinkedIn':         { limit: 3000, hashtags: '3-5 hashtags at end', note: 'First 210 chars show before "see more". Professional but personal works best.' },
    'X (Twitter)':      { limit: 280,  hashtags: '1-2 hashtags max', note: 'Hard 280 char limit including hashtags. Links count as 23 chars.' }
  };

  const getPlatformContext = (platList) => {
    if (!platList || !platList.length) return '';
    return platList.map(p => {
      const s = PLATFORM_SPECS[p]; if (!s) return p;
      return `${p}: ${s.note} Character limit: ${s.limit}. Hashtags: ${s.hashtags}.`;
    }).join(' | ');
  };

  const toneMap = {
    'Authentic/Natural': 'Write in an authentic, real, conversational tone — like a real person talking, not a marketer.',
    'Viral/Hype':        'Write in a bold, punchy, high-energy tone — scroll-stopping but not fake.',
    'Wise/Mentor':       'Write in a wise, thoughtful, mentor-like tone — insight-driven, builds trust.',
    'Bubbly/Energetic':  'Write in a warm, bubbly, energetic tone — fun and uplifting.'
  };
  const toneContext = toneMap[tone] || toneMap['Authentic/Natural'];
  const emojiMap = { no: 'Use zero emojis.', few: 'Use 1-2 emojis maximum, only where they add genuine meaning.', lots: 'Use emojis freely and expressively.' };
  const emojiLine = emojiMap[emojiPreference] || emojiMap['few'];
  const creatorLine = creatorContext
    ? `CREATOR CONTEXT: ${creatorContext} — Use this to make every output specific to this creator's story, niche, audience and voice. Never write generic content when you have this context.`
    : 'No creator context provided — write in a clear, relatable creator voice.';
  const demographicsLine = audienceDemographics
    ? `AUDIENCE DEMOGRAPHICS: ${audienceDemographics}. Tailor vocabulary, cultural references, humour, hook style, caption length and platform recommendations specifically for this demographic.`
    : '';
  const languageLine = outputLanguage ? `Write the ENTIRE output in ${outputLanguage}. JSON field names stay in English.` : '';
  const platformContext = platforms && platforms.length > 0 ? `PLATFORM SPECS (follow exactly): ${getPlatformContext(platforms)}` : '';
  const formatContext = contentType ? `Content format requested: ${contentType}.` : '';
  const voiceLine = voiceProfile
    ? `VOICE PROFILE — THIS IS THE MOST IMPORTANT INSTRUCTION: You have a forensic voice fingerprint for this creator. Their exact traits: ${voiceProfile}

You must ghost-write AS this person — not inspired by them, not in their general direction, but AS them. Apply their voice at the sentence level on every single line of output.

To do this correctly:
- Match their sentence rhythm exactly — if they punch short, you punch short. If they breathe long, you breathe long.
- Use their punctuation personality — their dashes, their ellipses, their caps, their lack of caps
- Use their actual words and phrases — not synonyms, not upgrades, their words
- Mirror their energy signature — if they're dry, stay dry. If they're hype, stay hype. Never drift toward generic AI polish.
- Apply their dialect and filler patterns naturally — don't force it, but don't sanitize it either
- Honor their "tell" — that one unmistakable move that is only them

The test: if you showed this output to the creator and they read it out loud, it should feel like reading their own journal — not a press release about them.

NEVER write in generic AI voice when you have this profile. Generic AI voice is: smooth, balanced, professionally warm, slightly motivational, uses words like "journey", "authentic", "powerful story", "resonate". That is the enemy. Write like the human, not the algorithm.`
    : '';

  const samIdentity = `You are S.A.M. — Strategic Assistant for Making. You are an AI content strategist that helps creators write better scripts, hooks, captions, strategies and content plans.`;

  const base = `${samIdentity} ${toneContext} ${emojiLine} ${creatorLine} ${voiceLine} ${demographicsLine} ${languageLine} ${platformContext} ${formatContext} CRITICAL: Respond ONLY with valid JSON. No markdown. No backticks. No explanation outside the JSON.`;

  const streamCall = async (system, userContent, maxTokens) => {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, stream: true, system, messages: [{ role: 'user', content: userContent }] })
    });
    if (!r.ok) {
      const e = await r.text().catch(() => '');
      throw new Error('Anthropic error ' + r.status + (e ? ': ' + e.slice(0, 200) : ''));
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        try {
          const evt = JSON.parse(raw);
          if (evt.type === 'content_block_delta' && evt.delta?.text) {
            full += evt.delta.text;
            res.write('data: ' + JSON.stringify({ t: evt.delta.text }) + '\n\n');
          }
        } catch (_) {}
      }
    }
    let clean = full.trim().replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```$/i,'').trim();
    const first = clean.indexOf('{');
    const last = clean.lastIndexOf('}');
    if (first !== -1 && last !== -1) clean = clean.slice(first, last + 1);
    let parsed;
    try { parsed = JSON.parse(clean); }
    catch (e) {
      res.write('data: ' + JSON.stringify({ error: 'SAM had trouble formatting the response. Please try again.' }) + '\n\n');
      res.end(); return;
    }
    res.write('data: ' + JSON.stringify({ done: true, result: parsed }) + '\n\n');
    res.end();
  };

  const errOut = (msg) => {
    if (res.headersSent) { res.write('data: ' + JSON.stringify({ error: msg }) + '\n\n'); res.end(); }
    else res.status(500).json({ error: msg });
  };

  try {

    // ── PLAYBOOK MODE ─────────────────────────────────────────────────────────
    if (mode === 'playbook') {
      const wizContext = req.body.wizardContext || '';
      const delivery   = req.body.delivery || 'camera';
      const pace       = req.body.pace || 'natural';
      const imageBase64 = req.body.imageBase64 || null;
      const imageType   = req.body.imageType || 'image/jpeg';

      const scriptStyle = {
        camera:    "Write a punchy, conversational on-camera script. Direct, personal, natural rhythm.",
        narration: "Write a cinematic narration script. More visual, more descriptive. Written to be spoken over footage. Use pauses intentionally.",
        text:      "Write short punchy text blocks for on-screen text. 5-8 words max per line. No speaking required.",
        mix:       "Write a mixed script. Label ON CAMERA and NARRATION sections clearly."
      }[delivery] || '';

      const paceNote = {
        fast:    "Speaker pace: fast. Script should be tight and punchy. 60 seconds max.",
        natural: "Speaker pace: natural. Script should breathe. 75-90 seconds.",
        slow:    "Speaker pace: deliberate. Script can go to 90-120 seconds. Pauses are intentional."
      }[pace] || '';

      const playbookPrompt = `${samIdentity} ${toneContext} ${emojiLine} ${creatorLine} ${demographicsLine} ${languageLine}

WIZARD CONTEXT:
${wizContext}

SCRIPT STYLE: ${scriptStyle}
${paceNote}

Return ONLY this JSON — be CONCISE in every field to fit within token limits:

{
  "diagnosis": "2 sentences max.",
  "story_architecture": {
    "opening": "8 words max",
    "setup": "8 words max",
    "risk": "8 words max",
    "turn": "8 words max",
    "payoff": "8 words max",
    "cta": "8 words max"
  },
  "hook": "Under 15 words. Creates an open loop.",
  "hook_why": "One sentence.",
  "full_script": "Complete script — 200 words max. Use [BEAT] labels.",
  "narration_script": "If narration delivery — 200 word version. Otherwise null.",
  "pacing_note": "One sentence.",
  "b_roll": ["shot 1", "shot 2", "shot 3"],
  "platform_strategies": [
    {
      "platform": "platform name",
      "strategy": "One sentence.",
      "caption": "Ready-to-post caption at correct character limit.",
      "hashtags": "#tag1 #tag2 #tag3"
    }
  ],
  "audience_profile": {
    "who": "2 sentences.",
    "pain_points": "2 sentences.",
    "secret_want": "1 sentence.",
    "where": "2 sentences.",
    "what_hooks_them": "2 sentences.",
    "what_loses_them": "1 sentence.",
    "voice": "2 sentences.",
    "why": "2 sentences."
  },
  "lead_magnet": {
    "title": "Specific, compelling title",
    "why": "2 sentences.",
    "items": [
      {"heading": "Point 1", "body": "2 sentences max."},
      {"heading": "Point 2", "body": "2 sentences max."},
      {"heading": "Point 3", "body": "2 sentences max."},
      {"heading": "Point 4", "body": "2 sentences max."},
      {"heading": "Point 5", "body": "2 sentences max."}
    ],
    "comment_response": "Under 150 chars. Conversational."
  },
  "focus_directive": "One sentence. The single most important thing to do today."
}

CRITICAL: Return ONLY valid JSON. Keep ALL fields concise — the JSON must be complete and valid.`;

        // ← KEY FIX: increased from 6000 to 8000 to prevent truncation
      const playbookUserContent = imageBase64
        ? [{ type: 'image', source: { type: 'base64', media_type: imageType, data: imageBase64 } }, { type: 'text', text: moment }]
        : moment;
      return await streamCall(playbookPrompt, playbookUserContent, 12000);
    }


    // ── REGEN SECTION MODE ────────────────────────────────────────────────────
    if (mode === 'regen_section') {
      const section = req.body.section || '';
      const sectionLabel = req.body.sectionLabel || section;
      const wizContext = req.body.wizardContext || '';
      const steer = req.body.steer || '';
      const delivery = req.body.delivery || 'camera';
      const pace = req.body.pace || 'natural';
      const platforms = req.body.platforms || [];

      const sectionPrompts = {
        diagnosis: `Rewrite ONLY the story diagnosis for this creator's moment.
Return ONLY: {"diagnosis":"2-3 sentences — what this story is really about beneath the surface","diagnosis_why":"1 sentence on why this framing will resonate"}`,

        architecture: `Rewrite ONLY the story architecture — the 6-beat structure.
Return ONLY: {"story_architecture":{"opening":"hook action/line for 0-3s","setup":"context beat for 3-15s","risk":"stakes beat for 15-30s","turn":"pivot moment for 30-50s","payoff":"resolution for 50-70s","cta":"call to action for final 5s"}}`,

        hook: `Rewrite ONLY the opening hook — the single line that stops the scroll.
${steer ? 'CREATOR DIRECTION: ' + steer : ''}
Return ONLY: {"hook":"the hook line — punchy, specific, creates an open loop","hook_why":"1 sentence on why this hook works for this story and audience"}`,

        script: `Rewrite ONLY the full script for this creator's story.
Delivery style: ${delivery}. Pace: ${pace}.
${steer ? 'CREATOR DIRECTION: ' + steer : ''}
Format script lines as plain text. Use [BEAT] for pause markers. Use (note) for delivery notes.
Return ONLY: {"full_script":"the complete script","pacing_note":"one delivery tip"}`,

        platforms: `Rewrite ONLY the platform strategy — captions and hashtags for each platform.
Platforms: ${platforms.join(', ')}.
${steer ? 'CREATOR DIRECTION: ' + steer : ''}
Return ONLY: {"platform_strategies":[{"platform":"platform name","strategy":"1 sentence approach","caption":"ready-to-post caption","hashtags":"hashtags"}]}`,

        audience: `Rewrite ONLY the audience profile — deep psychographic breakdown of the ideal viewer.
${steer ? 'CREATOR DIRECTION: ' + steer : ''}
Return ONLY: {"audience_profile":{"who":"who they are in 1-2 sentences","pain_points":"their real frustrations","secret_want":"what they actually want","where":"where they spend time online","what_hooks_them":"what stops their scroll","what_loses_them":"what makes them leave","voice":"how to talk to them","why":"why this audience for this creator"}}`,

        focus: `Rewrite ONLY the focus directive — the single next move this creator should take.
${steer ? 'CREATOR DIRECTION: ' + steer : ''}
Return ONLY: {"focus_directive":"2-4 sentences. Direct, specific, actionable. No fluff. Tell them exactly what to do next and why."}`
      };

      const sectionPrompt = sectionPrompts[section];
      if (!sectionPrompt) return res.status(400).json({ error: 'Unknown section: ' + section });

      const fullPrompt = `${base}
WIZARD CONTEXT: ${wizContext}
MOMENT: ${moment || ''}

TASK: ${sectionPrompt}

CRITICAL: Return ONLY valid JSON. No preamble, no explanation, no markdown fences.`;

      const regenMoment = req.body.moment || wizContext || '';
      return await streamCall(fullPrompt, regenMoment, 2000);
    }

    // ── PLAYBOOK ROUTING — non-moment storyTypes branch to correct tool ───────
    const storyTypeRouted = req.body.storyType || 'moment';

    if (storyTypeRouted === 'plan') {
      // "I need a content plan" → Blueprint (calendar)
      const platList = req.body.platforms && req.body.platforms.length > 0
        ? req.body.platforms
        : ['TikTok', 'Instagram Reels', 'YouTube Shorts'];
      const calPrompt = `${base}
WIZARD CONTEXT: ${req.body.wizardContext || ''}
Build a 7-day content posting plan tailored to this creator. Rotate across: ${platList.join(', ')}.
Each caption must respect that platform's exact character limit.
Return ONLY: {"days":[{"platform":"platform name","post_type":"Reel OR Short OR Post OR Video","content":"ready-to-post caption with hashtags"}]}`;
      return await streamCall(calPrompt, moment || req.body.wizardContext || '', 2400);
    }

    if (storyTypeRouted === 'idea') {
      // "I have a content idea" → Spark (ideas)
      const platList = req.body.platforms && req.body.platforms.length > 0
        ? req.body.platforms
        : ['TikTok', 'Instagram Reels', 'YouTube'];
      const ideasPrompt = `${base}
WIZARD CONTEXT: ${req.body.wizardContext || ''}
Generate exactly 5 specific, compelling content ideas this creator could actually make based on their context.
Return ONLY: {"ideas":[{"title":"specific content idea","why":"one sentence on why this resonates with their specific audience","best_platform":"single platform name"}]}`;
      return await streamCall(ideasPrompt, moment || req.body.wizardContext || '', 1200);
    }

    if (storyTypeRouted === 'concept') {
      // "I want a unique video concept" → Vision (concept)
      const conceptPlatforms = req.body.platforms && req.body.platforms.length > 0
        ? req.body.platforms
        : ['TikTok', 'YouTube Shorts'];
      const conceptPrompt = `${base}
WIZARD CONTEXT: ${req.body.wizardContext || ''}
Generate ONE bold, specific video concept for this creator to actually make.
Assign a real virality_score 60-100 based on genuine concept strength.
Return ONLY: {"title":"6-10 word concept title","format":"Reel OR Short OR YouTube video OR etc","premise":"2-3 sentences","why_it_works":"2 sentences","production_notes":["note 1","note 2","note 3"],"hook_line":"exact first sentence the creator speaks on camera","twist":"the unexpected angle that makes this memorable","virality_score":72}`;
      return await streamCall(conceptPrompt, moment || req.body.wizardContext || '', 1200);
    }

    if (storyTypeRouted === 'analyse') {
      // "I want to analyse what's working" → Lens (analytics text mode)
      const analysePrompt = `${base}
WIZARD CONTEXT: ${req.body.wizardContext || ''}
Based on this creator's context, analyse what content strategy is likely working and what to improve.
Return ONLY: {"type":"analytics","headline":"the single biggest strategic insight in one punchy sentence","whats_working":["specific observation 1","specific observation 2","specific observation 3"],"whats_not":["specific area to improve 1","specific area to improve 2"],"post_next":["specific content idea 1","specific content idea 2","specific content idea 3"],"growth_move":"one bold, specific strategic move to make this week"}`;
      return await streamCall(analysePrompt, moment || req.body.wizardContext || '', 1000);
    }

    // ── CALENDAR ─────────────────────────────────────────────────────────────
    if (mode === 'calendar') {
      const platList = platforms && platforms.length > 0 ? platforms : ['TikTok', 'Instagram Reels', 'YouTube Shorts'];
      const prompt = `${base}
Build a 7-day content posting plan. Rotate across: ${platList.join(', ')}.
Each caption must respect that platform's character limit exactly.
Return ONLY: {"days":[{"platform":"platform name","post_type":"Reel OR Short OR Post OR Video","content":"ready-to-post caption respecting character limit with hashtags"}]}`;
      return await streamCall(prompt, moment, 1600, 'claude-haiku-4-5-20251001');
    }

    // ── IDEAS ─────────────────────────────────────────────────────────────────
    if (mode === 'ideas') {
      const platList = platforms && platforms.length > 0 ? platforms : ['TikTok', 'Instagram Reels', 'YouTube'];
      const prompt = `${base}
Generate exactly 5 specific, compelling content ideas this creator could actually make.
Return ONLY: {"ideas":[{"title":"specific content idea","why":"one sentence on why this resonates with their specific audience","best_platform":"single platform name"}]}`;
      return await streamCall(prompt, moment, 900);
    }

    // ── UPLOAD ────────────────────────────────────────────────────────────────
    if (mode === 'upload') {
      const imageBase64 = req.body.imageBase64 || null;
      const imageType = req.body.imageType || 'image/jpeg';
      const forceType = req.body.forceType || null;

      if (forceType === 'photo' || (!forceType && imageBase64)) {
        const contextNote = moment && moment !== 'Analyse this image.'
          ? `The creator described this moment: "${moment}". Write headlines that reflect what THEY said, not what you see in the photo.`
          : `Use the creator context to write headlines that reflect their niche and voice.`;

        const photoSystem = `${samIdentity} ${toneContext} ${emojiLine} ${creatorLine}
${contextNote}
safe_template: pick one of: splitPanel, cinematic, newsFlash
bold_template: pick a DIFFERENT one of: giantWord, cornerBurst, diagonalSlash, stackedBoxes
Return ONLY this JSON:
{"type":"photo","what_sam_sees":"face position and composition only","face_side":"left OR right OR center","face_size":"large OR medium OR small","content_type":"transformation OR emotional OR achievement OR tutorial OR personal OR shock OR renovation","content_angle":"one sentence","safe_template":"splitPanel OR cinematic OR newsFlash","bold_template":"giantWord OR cornerBurst OR diagonalSlash OR stackedBoxes","headline_safe":"5-8 WORD HEADLINE","headline_bold":"3-6 WORD BOLD HEADLINE","subtext_safe":"3-5 word supporting line","subtext_bold":"3-5 word contrast line","thumbnail_color":"#hexcolor","platforms":[{"platform":"TikTok","title":"hook title under 60 chars","description":"caption under 150 chars","hashtags":"#tag1 #tag2 #tag3"},{"platform":"YouTube","title":"SEO title under 70 chars","description":"description under 150 chars","hashtags":"#tag1 #tag2 #tag3"},{"platform":"Instagram Reels","title":"","description":"caption under 125 chars","hashtags":"#tag1 #tag2 #tag3"}]}
CRITICAL: Return ONLY valid JSON.`;

        const userContent = imageBase64
          ? [{ type: 'image', source: { type: 'base64', media_type: imageType, data: imageBase64 } }, { type: 'text', text: moment || 'Analyse this image.' }]
          : moment;
        return await streamCall(photoSystem, userContent, 1400, 'claude-haiku-4-5-20251001');
      }

      if (forceType === 'analytics') {
        const analyticsSystem = `${samIdentity} ${toneContext} ${emojiLine} ${creatorLine}
Analyse this analytics screenshot. Give honest, specific, actionable insights.
Return ONLY this JSON:
{"type":"analytics","headline":"the single biggest insight in one punchy sentence","whats_working":["specific observation 1","specific observation 2","specific observation 3"],"whats_not":["specific area to improve 1","specific area to improve 2"],"post_next":["specific content idea 1","specific content idea 2","specific content idea 3"],"growth_move":"one bold, specific strategic move to make this week"}
CRITICAL: Return ONLY valid JSON.`;

        const userContent = imageBase64
          ? [{ type: 'image', source: { type: 'base64', media_type: imageType, data: imageBase64 } }, { type: 'text', text: moment || 'Analyse my analytics.' }]
          : moment;
        return await streamCall(analyticsSystem, userContent, 900, 'claude-haiku-4-5-20251001');
      }

      if (forceType === 'reach') {
        const reachPrompt = req.body.moment || '';
        const reachContent = imageBase64
          ? [{ type: 'image', source: { type: 'base64', media_type: imageType, data: imageBase64 } }, { type: 'text', text: reachPrompt }]
          : reachPrompt;
        const reachSystem = `You are SAM — a strategic content assistant. Generate platform-ready post content based on the photo and context provided. Write in plain text only. NO JSON, no markdown, no code blocks.

For each platform requested, use this exact format:

PLATFORM: [Platform Name]
HOOK: [attention-grabbing opening line]
CAPTION: [full caption text]
DESCRIPTION: [longer description if needed]
CTA: [call to action]
HASHTAGS: [relevant hashtags]

Make every caption feel personal, story-driven, and native to that platform. Write in the creator's voice.`;
        return await streamCall(reachSystem, reachContent, 1800, 'claude-sonnet-4-6');
      }

      const textSystem = `${base} Analyse this content idea. Return ONLY: {"type":"text_only","diagnosis":"what this idea is really about and why it has potential — 2 sentences","hook_ideas":["hook 1","hook 2","hook 3"],"content_angle":"the strongest angle to take","best_platform":"single best platform","next_action":"the one most important thing to do with this idea right now"}`;
      return await streamCall(textSystem, moment, 700, 'claude-haiku-4-5-20251001');
    }

    // ── CONCEPT ───────────────────────────────────────────────────────────────
    if (mode === 'concept') {
      const conceptStyle = req.body.contentType || '';
      const conceptPlatforms = req.body.platforms && req.body.platforms.length > 0 ? req.body.platforms : ['TikTok', 'YouTube Shorts'];
      const styleStr = conceptStyle ? `Requested style: ${conceptStyle}.` : '';
      const prompt = `${base} Target platforms: ${conceptPlatforms.join(', ')}. ${styleStr}
Generate ONE bold, specific video concept for this creator to actually make.
Assign a real virality_score 60-100 based on genuine concept strength — not always 90+.
Return ONLY: {"title":"6-10 word concept title","format":"Reel OR Short OR YouTube video OR etc","premise":"2-3 sentences","why_it_works":"2 sentences","production_notes":["practical filming note 1","practical filming note 2","practical filming note 3"],"hook_line":"exact first sentence the creator speaks on camera","twist":"the unexpected angle that makes this memorable","virality_score":72}`;
      return await streamCall(prompt, moment, 1000, 'claude-haiku-4-5-20251001');
    }

    // ── THE PULSE ─────────────────────────────────────────────────────────────
    const textPostFormats = ['LinkedIn text post', 'Instagram caption', 'Email newsletter', 'Text post', 'Blog post'];
    const scriptInstructions = {
      'Short-form video':       'Write a complete word-for-word SCRIPT for the creator to deliver on camera. 60-90 seconds spoken. Beats in [BRACKETS]. Pacing notes in (parentheses).',
      'Long-form YouTube video':'Write a complete word-for-word SCRIPT for 8-12 minutes. Label: [INTRO HOOK],[CONTEXT],[MAIN STORY],[KEY LESSONS],[OUTRO CTA].',
      'LinkedIn text post':     'Write the complete LinkedIn post text. No brackets. Strong opening line, short paragraphs, ends with a question. 3 hashtags at end.',
      'Instagram caption':      'Write the complete Instagram caption. Hook in first line under 125 chars, body copy, CTA, then 5 focused hashtags.',
      'Email newsletter':       'Write complete email: SUBJECT LINE on first line, PREVIEW TEXT on second line, then full BODY.',
      'Text post':              'Write a complete text post. No brackets. Hook first, short paragraphs, ends with CTA.',
      'Blog post':              'Write: SEO HEADLINE, META DESCRIPTION under 160 chars, then the full article body with section headers.'
    };
    const scriptInstruction = scriptInstructions[contentType] || scriptInstructions['Short-form video'];
    const allPlatList = platforms && platforms.length > 0 ? platforms : ['TikTok', 'Instagram Reels'];
    const platStratInstruction = `Write a ready-to-post caption and hashtags for EACH of these platforms, respecting their exact character limits: ${allPlatList.join(', ')}.`;

    const pulsePrompt = `${base}
${scriptInstruction}
${platStratInstruction}
Return ONLY this JSON:
{"diagnosis":"2-3 sentences on the emotional core and why it will resonate","hook":"SAM's single best opening line","visual_note":"what to show on screen in the first 3 seconds","full_script":"COMPLETE script or post text","b_roll":["shot 1","shot 2","shot 3","shot 4"],"pacing_note":"one specific delivery tip","cta":"a specific call to action","platform_strategies":[{"platform":"platform name","strategy":"one specific posting tip","caption":"ready-to-post caption respecting character limit","hashtags":"hashtags"}]}`;

    return await streamCall(pulsePrompt, moment, 2400);

  } catch (err) {
    errOut(err.message || 'Something went wrong.');
  }
};
