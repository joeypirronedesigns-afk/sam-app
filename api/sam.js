module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mode, moment, platforms, contentType, creatorContext, tone, audienceDemographics, outputLanguage, emojiPreference } = req.body;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  // ── CHAT MODE (SAM chatbot — Haiku, short conversational replies) ──────────
  if (mode === 'chat') {
    const { messages, systemPrompt } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required for chat mode' });
    }

    const chatSystem = systemPrompt || `You are SAM — Strategic Assistant for Making — a friendly, sharp creative director built into the SAM app at samforcreators.com. You help creators understand and get the most out of SAM's 5 tools.

THE 5 TOOLS:
1. The Pulse — User describes a real moment in their own words. SAM writes: one powerful hook, a full word-for-word script with b-roll cues, platform captions for all selected platforms. Best for: any real moment, story, setback, win, or emotion worth sharing.
2. The Spark — User describes their niche. SAM generates 5 specific content ideas with a why-it-works breakdown and best platform for each. Each idea can be sent straight to The Pulse.
3. The Blueprint — User describes their niche and selects platforms. SAM builds a complete 7-day posting calendar with content type, caption, and platform for each day. Each day can be sent to The Pulse or The Vision.
4. The Vision — User describes their niche or idea. SAM generates one bold unique video concept with premise, hook line, production notes, and a real virality score.
5. The Lens — Two modes: (A) Drop a photo — SAM builds thumbnail strategy: safe + bold headline options, layout direction, face-aware composition, color palette, and platform captions. (B) Drop analytics screenshot — SAM reads the numbers and tells you what's working, what to fix, and 3 posts to make this week.

PRICING:
- Free trial: 3 full days, all tools, unlimited runs — just needs an email to unlock. No card ever.
- SAM Pro: $9/month founding member rate (goes to $19 at public launch) — unlimited runs, priority speed, all new tools first, 7-day money-back guarantee.

HOW TO GET THE BEST RESULTS FROM EACH TOOL:
- The Pulse: The more specific and personal the moment description, the better the output. Raw and unpolished is good — SAM finds the story in it.
- The Spark: Include your niche, audience, and what makes your content unique. The more context, the more specific the ideas.
- The Blueprint: Fill in your About Me first so SAM knows your niche. Select the platforms you actually post on.
- The Vision: Describe what makes you different. SAM will build a concept nobody else could make.
- The Lens: For photos, add context about the moment in the text box — SAM writes headlines based on YOUR story, not just what's in the photo.

PERSONALITY: Confident, direct, warm. Talk like a trusted creative director — not a support bot. Be specific. No fluff. If someone asks which tool to use, tell them exactly which one and why in one sentence. Keep all responses to 2-4 sentences max unless they explicitly ask for more detail. Use plain everyday language. No jargon.`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      const chatRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
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

  // ── ALL OTHER MODES need moment + mode (playbook is more flexible) ────────
  if (!mode) return res.status(400).json({ error: 'Missing mode' });
  if (mode !== 'playbook' && mode !== 'chat' && (!moment)) {
    return res.status(400).json({ error: 'Missing moment' });
  }

  // ── WHAT SAM ACTUALLY DOES (honest capabilities) ──────────────────────────
  // SAM writes: scripts, hooks, captions, hashtags, content strategies, ideas,
  //             posting calendars, video concepts, thumbnail strategy
  // SAM does NOT: make videos, edit footage, post content, design graphics,
  //               guarantee results, replace the creator's voice or presence
  // Every output helps the CREATOR make better content — SAM is the strategy
  // brain, the creator is still the one who films, edits and shows up.
  // ──────────────────────────────────────────────────────────────────────────

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
    ? `AUDIENCE DEMOGRAPHICS: ${audienceDemographics}. Tailor vocabulary, cultural references, humour, hook style, caption length and platform recommendations specifically for this demographic. A hook for a 55+ audience on Facebook sounds completely different to a hook for an 18-24 audience on TikTok — get it right.`
    : '';

  const languageLine = outputLanguage ? `Write the ENTIRE output in ${outputLanguage}. JSON field names stay in English.` : '';
  const platformContext = platforms && platforms.length > 0 ? `PLATFORM SPECS (follow exactly): ${getPlatformContext(platforms)}` : '';
  const formatContext = contentType ? `Content format requested: ${contentType}.` : '';

  const samIdentity = `You are S.A.M. — Strategic Assistant for Making. You are an AI content strategist that helps creators write better scripts, hooks, captions, strategies and content plans. You give creators the words, the structure and the strategy — they bring the camera, the personality and the story. Never claim SAM makes videos, posts content, or does anything the creator still needs to do themselves. Be honest about what you've produced: scripts to be read, captions to be posted, strategies to be executed.`;

  const base = `${samIdentity} ${toneContext} ${emojiLine} ${creatorLine} ${demographicsLine} ${languageLine} ${platformContext} ${formatContext} CRITICAL: Respond ONLY with valid JSON. No markdown. No backticks. No explanation outside the JSON.`;

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
    let clean = full.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
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


    // ── PLAYBOOK MODE (wizard full build) ─────────────────────────────────────
    if (mode === 'playbook') {
      const wizContext = req.body.wizardContext || '';
      const delivery   = req.body.delivery || 'camera';
      const pace       = req.body.pace || 'natural';
      const storyType  = req.body.storyType || 'moment';
      const hasPhoto   = req.body.includeThumb && req.body.imageBase64;

      const scriptStyle = {
        camera:    "Write a punchy, conversational on-camera script. Direct, personal, natural rhythm.",
        narration: "Write a cinematic narration script. More visual, more descriptive. Written to be spoken over footage. Use pauses intentionally. Each sentence should earn its place.",
        text:      "Write short punchy text blocks for on-screen text. 5-8 words max per line. No speaking required.",
        mix:       "Write a mixed script. Label ON CAMERA and NARRATION sections clearly. Creator chooses what to use."
      }[delivery] || '';

      const paceNote = {
        fast:    "Speaker pace: fast. Script should be tight and punchy. 60 seconds max. Cut anything that does not serve the story.",
        natural: "Speaker pace: natural. Script should breathe. 75-90 seconds. Room for a pause or two.",
        slow:    "Speaker pace: deliberate. Script can go to 90-120 seconds. Pauses are intentional and emotional."
      }[pace] || '';

      const playbookPrompt = `${samIdentity} ${toneContext} ${emojiLine} ${creatorLine} ${demographicsLine} ${languageLine}

WIZARD CONTEXT:
${wizContext}

SCRIPT STYLE: ${scriptStyle}
${paceNote}

YOUR JOB — Build a complete content playbook. Be concise but powerful. Return ONLY this JSON with NO additional text:

{
  "diagnosis": "2 sentences max — the emotional core and why it resonates. Specific to their story.",
  "story_architecture": {
    "opening": "10 words max — the scroll-stopping opener",
    "setup": "10 words max — why people should care",
    "risk": "10 words max — the stakes",
    "turn": "10 words max — the moment things changed",
    "payoff": "10 words max — the emotional resolution",
    "cta": "10 words max — what you want them to do"
  },
  "hook": "The single best opening line — under 15 words. Creates an open loop.",
  "hook_why": "One sentence — why this hook works.",
  "full_script": "Complete script — 150 words max. Use [BEAT] labels. Natural speech rhythm.",
  "narration_script": "If narration delivery — 150 word narration version. Otherwise null.",
  "pacing_note": "One sentence delivery tip.",
  "b_roll": ["shot 1", "shot 2", "shot 3"],
  "platform_strategies": [
    {
      "platform": "platform name",
      "strategy": "One sentence posting tip specific to this platform and story.",
      "caption": "Ready-to-post caption at correct character limit.",
      "hashtags": "#tag1 #tag2 #tag3"
    }
  ],
  "audience_profile": {
    "who": "2-3 sentences — who they really are in real life. Not just age/gender. Their actual life situation, values, what fills their days, what they care about deeply.",
    "pain_points": "2 sentences — what frustrates or worries them. What problem are they quietly trying to solve?",
    "secret_want": "1-2 sentences — what they secretly hope this creator gives them. Permission, validation, a shortcut, community?",
    "where": "2 sentences — where they spend time online, WHY they go there, and how they consume content (scroll/watch/save/share).",
    "what_hooks_them": "2 sentences — what makes them stop scrolling specifically. What format, tone, and opening line lands with them.",
    "what_loses_them": "1 sentence — what kills their interest immediately. What feels fake, boring, or irrelevant to them.",
    "voice": "2 sentences — exact tone, vocabulary level, and communication style to use. What they respond to vs. tune out.",
    "why": "2-3 sentences — why SAM sees THIS specific audience for THIS specific creator based on their actual story and content."
  },
  "lead_magnet": {
    "title": "Free resource title — specific, compelling, clearly useful",
    "why": "2 sentences — why this specific resource for this specific audience. What problem does it solve for them?",
    "items": [
      {"heading": "Point 1", "body": "2-3 sentences — real, specific, actionable. From the creator's genuine experience."},
      {"heading": "Point 2", "body": "2-3 sentences — honest and grounded. No fluff."},
      {"heading": "Point 3", "body": "2-3 sentences. Include something surprising or counterintuitive."},
      {"heading": "Point 4", "body": "2-3 sentences. Address a common mistake or misconception."},
      {"heading": "Point 5", "body": "2-3 sentences — ends with something that makes the audience feel seen and want to follow the creator."}
    ],
    "comment_response": "Under 150 chars. Conversational. Sounds like a real person wrote it, not a marketing bot."
  },
  "focus_directive": "One sentence. The single most important thing to do today."
}

CRITICAL RULES:
- Return ONLY valid JSON. No markdown. No backticks. Nothing outside the JSON.
- Keep ALL text fields concise — max 3 sentences per field unless it is full_script, lead_magnet items, or audience_profile fields.
- full_script: max 300 words total.
- lead_magnet items: each item body max 2 sentences. Real and specific but brief.
- audience_profile fields: max 2 sentences each.
- platform_strategies caption: respect character limits strictly.
- The JSON MUST be complete and valid — never cut off mid-response.
- If you are running long, cut detail from b_roll and visual_note first, never from hook, script or lead_magnet.`;

      return await streamCall(playbookPrompt, moment, 6000);
    }

    // ── CALENDAR ─────────────────────────────────────────────────────────────
    if (mode === 'calendar') {
      const platList = platforms && platforms.length > 0 ? platforms : ['TikTok', 'Instagram Reels', 'YouTube Shorts'];
      const prompt = `${base}
Build a 7-day content posting plan. Each day gives the creator a specific, actionable content idea with a ready-to-post caption.
Be honest: these are CAPTION and CONTENT IDEAS for the creator to execute — not finished videos.
Rotate across: ${platList.join(', ')}.
Each caption must respect that platform's character limit exactly.
Return ONLY: {"days":[{"platform":"platform name","post_type":"Reel OR Short OR Post OR Video","content":"ready-to-post caption respecting character limit with hashtags"}]}`;
      return await streamCall(prompt, moment, 1600);
    }

    // ── IDEAS ─────────────────────────────────────────────────────────────────
    if (mode === 'ideas') {
      const platList = platforms && platforms.length > 0 ? platforms : ['TikTok', 'Instagram Reels', 'YouTube'];
      const prompt = `${base}
Generate exactly 5 specific, compelling content ideas this creator could actually make.
These are IDEAS for the creator to execute — not finished content.
Make each idea specific to their niche, not generic. Each should feel like something only THEY could make.
For each idea: title should be the actual video/post concept, why should explain the specific audience insight, best_platform should name one platform.
Return ONLY: {"ideas":[{"title":"specific content idea","why":"one sentence on why this resonates with their specific audience","best_platform":"single platform name"}]}`;
      return await streamCall(prompt, moment, 900);
    }

    // ── UPLOAD (photo or analytics) ──────────────────────────────────────────
    if (mode === 'upload') {
      const imageBase64 = req.body.imageBase64 || null;
      const imageType = req.body.imageType || 'image/jpeg';
      const forceType = req.body.forceType || null;

      if (forceType === 'photo' || (!forceType && imageBase64)) {
        const contextNote = moment && moment !== 'Analyse this image.'
          ? `The creator described this moment: "${moment}". This description is the PRIMARY source for headlines — write headlines that reflect what THEY said, not what you see in the photo.`
          : `No context provided. Use the creator context to write headlines that reflect their niche and voice.`;

        const photoSystem = `${samIdentity} ${toneContext} ${emojiLine} ${creatorLine}

YOUR TWO JOBS:

JOB 1 — READ THE IMAGE FOR COMPOSITION ONLY:
Look at where the face/body is positioned. Is it on the left, right, or center?
How large is the face in the frame — large (close up), medium, or small (full body)?
Use this ONLY for face_side, face_size fields. Do NOT base headlines on objects in the photo.

JOB 2 — WRITE STRATEGY FROM THE CREATOR'S VOICE:
${contextNote}
Headlines must sound like THIS creator talking to THEIR audience.
Be honest: these are thumbnail TEXT IDEAS and CAPTION SUGGESTIONS — not finished designs.
The creator will take these into Canva, CapCut or their design tool.

safe_template: pick one of: splitPanel, cinematic, newsFlash
bold_template: pick a DIFFERENT one of: giantWord, cornerBurst, diagonalSlash, stackedBoxes
They must be different from each other.

Return ONLY this JSON:
{"type":"photo","what_sam_sees":"face position and composition only — no story interpretation","face_side":"left OR right OR center","face_size":"large OR medium OR small","content_type":"transformation OR emotional OR achievement OR tutorial OR personal OR shock OR renovation","content_angle":"the story angle based on creator context — one sentence","safe_template":"splitPanel OR cinematic OR newsFlash","bold_template":"giantWord OR cornerBurst OR diagonalSlash OR stackedBoxes","headline_safe":"5-8 WORD HEADLINE IN CREATOR VOICE","headline_bold":"3-6 WORD BOLD HEADLINE IN CREATOR VOICE","subtext_safe":"3-5 word supporting line","subtext_bold":"3-5 word contrast line","thumbnail_color":"#hexcolor that fits the mood and content","platforms":[{"platform":"TikTok","title":"hook title under 60 chars","description":"caption under 150 chars — honest about what the content actually is","hashtags":"#tag1 #tag2 #tag3"},{"platform":"YouTube","title":"SEO title under 70 chars","description":"description under 150 chars","hashtags":"#tag1 #tag2 #tag3"},{"platform":"Instagram Reels","title":"","description":"caption under 125 chars","hashtags":"#tag1 #tag2 #tag3"}]}
CRITICAL: Return ONLY valid JSON. Nothing else.`;

        const userContent = imageBase64
          ? [{ type: 'image', source: { type: 'base64', media_type: imageType, data: imageBase64 } }, { type: 'text', text: moment || 'Analyse this image.' }]
          : moment;
        return await streamCall(photoSystem, userContent, 1400);
      }

      if (forceType === 'analytics') {
        const analyticsSystem = `${samIdentity} ${toneContext} ${emojiLine} ${creatorLine}
Analyse this analytics screenshot. Give honest, specific, actionable insights.
Be direct about what the numbers actually mean — what's working, what isn't, and exactly what to do next.
Make recommendations specific to this creator's niche, not generic advice.
Return ONLY this JSON:
{"type":"analytics","headline":"the single biggest insight in one punchy sentence","whats_working":["specific observation 1","specific observation 2","specific observation 3"],"whats_not":["specific area to improve 1","specific area to improve 2"],"post_next":["specific content idea 1 based on what's working","specific content idea 2","specific content idea 3"],"growth_move":"one bold, specific strategic move to make this week"}
CRITICAL: Return ONLY valid JSON. Nothing else.`;

        const userContent = imageBase64
          ? [{ type: 'image', source: { type: 'base64', media_type: imageType, data: imageBase64 } }, { type: 'text', text: moment || 'Analyse my analytics.' }]
          : moment;
        return await streamCall(analyticsSystem, userContent, 900);
      }

      // Text only fallback
      const textSystem = `${base} Analyse this content idea. Return ONLY: {"type":"text_only","diagnosis":"what this idea is really about and why it has potential — 2 sentences","hook_ideas":["hook 1","hook 2","hook 3"],"content_angle":"the strongest angle to take","best_platform":"single best platform","next_action":"the one most important thing to do with this idea right now"}`;
      return await streamCall(textSystem, moment, 700);
    }

    // ── CONCEPT ───────────────────────────────────────────────────────────────
    if (mode === 'concept') {
      const conceptStyle = req.body.contentType || '';
      const conceptPlatforms = req.body.platforms && req.body.platforms.length > 0 ? req.body.platforms : ['TikTok', 'YouTube Shorts'];
      const styleStr = conceptStyle ? `Requested style: ${conceptStyle}.` : '';
      const prompt = `${base} Target platforms: ${conceptPlatforms.join(', ')}. ${styleStr}
Generate ONE bold, specific video concept for this creator to actually make.
Be honest: this is a CONCEPT and SCRIPT OUTLINE — the creator still needs to film and edit it.
The concept should feel like something only THEY could make given their story and niche.
Assign a real virality_score 60-100 based on genuine concept strength — not always 90+.
Return ONLY: {"title":"6-10 word concept title","format":"Reel OR Short OR YouTube video OR etc","premise":"2-3 sentences — what the video actually is","why_it_works":"2 sentences on why this specific creator's audience will respond","production_notes":["practical filming note 1","practical filming note 2","practical filming note 3"],"hook_line":"exact first sentence the creator speaks on camera","twist":"the unexpected angle that makes this memorable","virality_score":72}`;
      return await streamCall(prompt, moment, 1000);
    }

    // ── THE PULSE ─────────────────────────────────────────────────────────────
    const textPostFormats = ['LinkedIn text post', 'Instagram caption', 'Email newsletter', 'Text post', 'Blog post'];
    const isTextPost = textPostFormats.includes(contentType);

    const scriptInstructions = {
      'Short-form video':       'Write a complete word-for-word SCRIPT for the creator to deliver on camera. 60-90 seconds spoken. Beats in [BRACKETS]: [HOOK],[SETUP],[TENSION],[PAYOFF],[CTA]. Pacing notes in (parentheses). This is a script — the creator films it.',
      'Long-form YouTube video':'Write a complete word-for-word SCRIPT for 8-12 minutes. Label: [INTRO HOOK],[CONTEXT],[MAIN STORY],[KEY LESSONS],[OUTRO CTA]. This is a script — the creator films it.',
      'LinkedIn text post':     'Write the complete LinkedIn post text. No brackets. Strong opening line, short paragraphs, ends with a question. 3 hashtags at end.',
      'Instagram caption':      'Write the complete Instagram caption. Hook in first line under 125 chars, body copy, CTA, then 5 focused hashtags.',
      'Email newsletter':       'Write complete email: SUBJECT LINE on first line, PREVIEW TEXT on second line, then full BODY.',
      'Text post':              'Write a complete text post. No brackets. Hook first, short paragraphs, ends with CTA.',
      'Blog post':              'Write: SEO HEADLINE, META DESCRIPTION under 160 chars, then the full article body with section headers.'
    };
    const scriptInstruction = scriptInstructions[contentType] || scriptInstructions['Short-form video'];

    const allPlatList = platforms && platforms.length > 0 ? platforms : ['TikTok', 'Instagram Reels'];
    const platStratInstruction = `Write a ready-to-post caption and hashtags for EACH of these platforms, respecting their exact character limits: ${allPlatList.join(', ')}. Be honest in captions about what the content IS — a script, a post, a strategy — not a finished video SAM made.`;

    const pulsePrompt = `${base}
${scriptInstruction}
${platStratInstruction}

IMPORTANT — HONESTY IN CAPTIONS:
When writing platform captions, be accurate about what SAM has produced:
- SAM wrote a SCRIPT for the creator to deliver
- SAM wrote CAPTIONS for the creator to post
- SAM built a STRATEGY for the creator to execute
- The creator still films, edits, shows up and posts
- Never say "SAM made this video" or "AI created this content" — say "AI wrote the script" or "SAM helped me plan this"

Return ONLY this JSON:
{"diagnosis":"2-3 sentences on the emotional core of this moment and why it will resonate","hook":"SAM's single best opening line — the creator delivers this on camera or in text","visual_note":"what to show on screen in the first 3 seconds (for video) or the key visual element","full_script":"COMPLETE script or post text as specified above","b_roll":["specific shot or visual to capture","shot 2","shot 3","shot 4"],"pacing_note":"one specific delivery tip for the creator","cta":"a specific call to action that builds community not just views","platform_strategies":[{"platform":"platform name","strategy":"one specific posting tip for this platform","caption":"ready-to-post caption respecting character limit","hashtags":"hashtags"}]}`;

    return await streamCall(pulsePrompt, moment, 2400);

  } catch (err) {
    errOut(err.message || 'Something went wrong.');
  }
};
