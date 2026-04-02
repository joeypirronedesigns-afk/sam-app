module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mode, moment, platforms, contentType, creatorContext, tone, audienceDemographics, outputLanguage, emojiPreference } = req.body;
  if (!moment || !mode) return res.status(400).json({ error: 'Missing mode or moment' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const platformContext = platforms && platforms.length > 0
    ? 'The creator posts on: ' + platforms.join(', ') + '. Tailor ALL output specifically for these platforms.' : '';
  const formatContext = contentType ? 'Content format: ' + contentType + '.' : '';
  const creatorLine = creatorContext ? 'About this creator: ' + creatorContext + '.' : '';
  const languageLine = outputLanguage
    ? 'IMPORTANT: Write the ENTIRE output in ' + outputLanguage + '. Do not use English except inside JSON field names.' : '';

  const emojiLine = emojiPreference === 'no'
    ? 'IMPORTANT: Do NOT use any emojis anywhere in your output. Zero emojis — not even one.'
    : emojiPreference === 'lots'
    ? 'Use emojis freely and expressively throughout — hooks, script beats, CTAs, tips. Match the energy of top-performing posts on the selected platforms.'
    : 'Use emojis sparingly — maximum 1-2 per output section, only where they genuinely add emphasis or energy. Do not emoji-spam.';

  const dialectMap = {
    'Australia': 'Write in authentic Australian vernacular. Use natural Aussie slang: "mate", "reckon", "heaps", "arvo", "no worries", "legend", "keen", "bloody", "deadset". Casual, direct, genuinely Australian.',
    'UK': 'Write in authentic British English. Natural UK phrasing: "brilliant", "proper", "sorted", "gutted", "cheers". Understated humor welcome.',
    'Canada': 'Write in Canadian English. Friendly, warm, slightly understated.',
    'USA': 'Write in natural American English. Conversational, direct, relatable.',
    'North America': 'Write in natural North American English.',
    'English-speaking countries': 'Write in clear, accessible English. Avoid region-specific slang.',
    'worldwide': 'Write in simple, clear, universally accessible English. Avoid idioms.'
  };

  let dialectNote = '';
  if (audienceDemographics && !outputLanguage) {
    for (const [location, dialect] of Object.entries(dialectMap)) {
      if (audienceDemographics.includes(location)) { dialectNote = dialect; break; }
    }
  }

  const audienceLine = audienceDemographics
    ? 'Target audience: ' + audienceDemographics + '. ' + dialectNote : '';

  const toneDescriptions = {
    'Authentic/Natural': 'Tone: Authentic and natural. Real, grounded, conversational.',
    'Viral/Hype': 'Tone: Viral and high energy. Bold, punchy, scroll-stopping.',
    'Wise/Mentor': 'Tone: Wise and mentor-like. Thoughtful, insight-driven, builds trust.',
    'Bubbly/Energetic': 'Tone: Bubbly and energetic. Warm, fun, uplifting.'
  };
  const toneContext = toneDescriptions[tone] || toneDescriptions['Authentic/Natural'];

  const base = 'You are S.A.M. — Strategic Assistant for Making. ' + toneContext + ' ' + emojiLine + ' ' + creatorLine + ' ' + audienceLine + ' ' + languageLine + ' ' + platformContext + ' ' + formatContext + ' CRITICAL: Respond ONLY with valid JSON. No markdown. No backticks. No preamble.';

  // UPLOAD & STRATEGIZE MODE (vision)
  if (mode === 'upload') {
    const imageBase64 = req.body.imageBase64 || null;
    const imageType = req.body.imageType || 'image/jpeg';
    const uploadPlatforms = req.body.platforms || [];
    const platStr = uploadPlatforms.length > 0 ? 'Platforms: ' + uploadPlatforms.join(', ') + '.' : '';

    const uploadSystem = 'You are S.A.M. — Strategic Assistant for Making. A creator has shared content with you — either text, an image, or both. ' + platStr + ' STEP 1: Identify what was shared. Classify as one of: "analytics" (platform stats/graphs/dashboards/metrics), "photo" (photo/scene/renovation/thumbnail/visual content), or "text_only" (no image, just text). STEP 2: Return the appropriate JSON strategy. IF analytics: {"type":"analytics","headline":"one punchy sentence on the single biggest insight","whats_working":["observation 1","observation 2","observation 3"],"whats_not":["improve 1","improve 2"],"post_next":["content idea 1","content idea 2","content idea 3"],"best_time":"optimal posting time based on data","growth_move":"one bold strategic move based on this data"} IF photo: {"type":"photo","what_sam_sees":"one sentence on what is in the image","thumbnail_strategy":"specific text overlay, emotion to convey, crop direction","hook_ideas":["hook 1","hook 2","hook 3"],"best_platform":"single best platform","platform_reason":"one sentence why","content_angle":"the story this image tells that stops the scroll","caption_starter":"first line of a caption for this image"} IF text_only: {"type":"text_only","diagnosis":"what this idea is really about and why it has potential","hook_ideas":["hook 1","hook 2","hook 3"],"best_platform":"single best platform","platform_reason":"one sentence why","content_angle":"strongest angle to take","next_action":"single most important thing to do with this idea now"} CRITICAL: Return ONLY valid JSON. No markdown. No backticks. No preamble.';

    const userContent = imageBase64
      ? [
          { type: 'image', source: { type: 'base64', media_type: imageType, data: imageBase64 } },
          { type: 'text', text: moment || 'Analyse this image and provide a strategy.' }
        ]
      : moment;

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, system: uploadSystem, messages: [{ role: 'user', content: userContent }] })
      });
      if (!r.ok) throw new Error('API error ' + r.status);
      const d = await r.json();
      return res.status(200).json(JSON.parse(d.content?.[0]?.text?.replace(/```json|```/g, '').trim()));
    } catch (err) { return res.status(500).json({ error: err.message || 'Something went wrong.' }); }
  }

  // CALENDAR MODE
  if (mode === 'calendar') {
    const platList = platforms && platforms.length > 0
      ? platforms
      : ['TikTok', 'Instagram Reels', 'Facebook Reels', 'YouTube Shorts', 'LinkedIn', 'X (Twitter)', 'any platform'];
    const calPrompt = base + ' A creator described a moment or content idea. Build a strategic 7-day posting plan that maximizes reach from this one piece of content. Rotate across these platforms: ' + platList.join(', ') + '. Vary the format each day. Build momentum across the week. Return exactly this JSON with exactly 7 items: {"days":[{"platform":"exact platform name","post_type":"format e.g. Short-form video, Text post, Story, Carousel, Behind-the-scenes","content":"specific ready-to-use post content or caption — 2-3 sentences","tip":"one tactical tip for this post and platform","ideal_time":"specific time + brief reason e.g. Tuesday 6–8 PM — peak scroll time for this platform"}]}';
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, system: calPrompt, messages: [{ role: 'user', content: moment }] })
      });
      if (!r.ok) throw new Error('API error ' + r.status);
      const d = await r.json();
      return res.status(200).json(JSON.parse(d.content?.[0]?.text?.replace(/```json|```/g, '').trim()));
    } catch (err) { return res.status(500).json({ error: err.message || 'Something went wrong.' }); }
  }

  // IDEAS MODE
  if (mode === 'ideas') {
    const ideasPrompt = base + ' A creator described their niche. Generate exactly 10 specific, actionable content ideas they could make this week. Each must be concrete and immediately filmable or postable — not generic advice. Return this exact JSON: {"ideas":[{"title":"specific content idea title","why":"one sentence on why this will perform for their audience","best_platform":"single best platform name e.g. TikTok, YouTube Shorts, Instagram Reels, LinkedIn, Facebook Reels"}]}';
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, system: ideasPrompt, messages: [{ role: 'user', content: moment }] })
      });
      if (!r.ok) throw new Error('API error ' + r.status);
      const d = await r.json();
      return res.status(200).json(JSON.parse(d.content?.[0]?.text?.replace(/```json|```/g, '').trim()));
    } catch (err) { return res.status(500).json({ error: err.message || 'Something went wrong.' }); }
  }

  // CONCEPT MODE
  if (mode === 'concept') {
    const conceptStyle = req.body.contentType || '';
    const conceptPlatforms = req.body.platforms || [];
    const platStr = conceptPlatforms.length > 0 ? 'Target platform(s): ' + conceptPlatforms.join(', ') + '.' : '';
    const styleStr = conceptStyle ? 'Concept style requested: ' + conceptStyle + '.' : '';
    const conceptPrompt = base + ' ' + platStr + ' ' + styleStr + ' A creator described their niche or content idea. Generate ONE bold, unique, never-seen-before video concept for them. This is NOT a topic — it is a FORMAT CONCEPT with a creative twist. Think like a top creative director at a viral studio. The concept must feel original, specific to their niche, and immediately filmable. Return this exact JSON: {"title":"Short punchy concept title — the big idea in 6-10 words","format":"The format type e.g. Reverse Reveal, Split-Screen Challenge, Hidden Camera Experiment, Time-Lapse Documentary, etc.","premise":"2-3 sentences describing exactly what the video IS — what happens, what makes it unique","why_it_works":"2 sentences on the psychology of why this specific concept stops scrolls and gets shared","production_notes":["Specific filming note 1","Specific filming note 2","Specific filming note 3","Specific filming note 4"],"hook_line":"The exact first sentence to say on camera","best_platform":"Single best platform for this concept","platform_reason":"One sentence on why this platform specifically","twist":"The unexpected angle or reveal that makes this concept truly memorable — the thing nobody sees coming","virality_score":85}';
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1200, system: conceptPrompt, messages: [{ role: 'user', content: moment }] })
      });
      if (!r.ok) throw new Error('API error ' + r.status);
      const d = await r.json();
      return res.status(200).json(JSON.parse(d.content?.[0]?.text?.replace(/```json|```/g, '').trim()));
    } catch (err) { return res.status(500).json({ error: err.message || 'Something went wrong.' }); }
  }

  // FOCUS MODE
  if (mode === 'focus') {
    const focusSummary = req.body.focusSummary || '';
    const focusPrompt = base + ' A creator just used S.A.M. and got their output. Now give them ONE specific action to take in the next 30 minutes — not a list, not options, just one thing. Make it ultra-specific to what they described. Start with a verb. Be direct, confident, almost commanding. No fluff. Return this exact JSON: {"action":"one specific action starting with a verb e.g. Film the reveal moment today — no editing, just hit record and show them the tree","sub":"one sentence on why this specific action right now, not tomorrow"}';
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 300, system: focusPrompt, messages: [{ role: 'user', content: moment + ' ' + focusSummary }] })
      });
      if (!r.ok) throw new Error('API error ' + r.status);
      const d = await r.json();
      return res.status(200).json(JSON.parse(d.content?.[0]?.text?.replace(/```json|```/g, '').trim()));
    } catch (err) { return res.status(500).json({ action: 'Pick one thing from the output above and do it in the next 30 minutes.', sub: '' }); }
  }

  // TEXT-BASED FORMAT SCRIPT INSTRUCTIONS
  const textPostInstruction = 'Write a complete text post ready to copy and paste directly. CRITICAL: Do NOT use [BRACKETS], (pacing notes), beat labels, or any video/audio directions. Write in clean paragraphs only. Hook on the first line, story in short punchy paragraphs, ends with a question or CTA. No stage directions. Pure readable text.';

  const contentTypeScriptInstructions = {
    'Short-form video': 'Write a complete word-for-word spoken script for a 60-90 second short-form video. Beats in [BRACKETS]: [HOOK], [SETUP], [TENSION], [PAYOFF], [CTA]. Pacing notes in (parentheses). Every word speakable out loud.',
    'Long-form YouTube video': 'Write a complete word-for-word script for 8-12 minutes. Label: [INTRO HOOK], [CONTEXT], [MAIN STORY], [KEY LESSONS], [OUTRO CTA]. B-roll in (parentheses).',
    'LinkedIn text post': 'Write the complete LinkedIn post. CRITICAL: No [BRACKETS] or (pacing notes). Clean text only. Strong opening line (no "I" to start), short paragraphs, ends with a question. Include 3 hashtags at the end.',
    'Instagram caption': 'Write the complete Instagram caption. CRITICAL: No [BRACKETS] or (pacing notes). Clean text only. Hook first line, body with line breaks, CTA, then 5 hashtags.',
    'Podcast intro': 'Write a complete 60-90 second spoken intro. Hooks listener, sets up theme, teases content. Tone notes in (parentheses) only.',
    'Email newsletter': 'Write complete email: SUBJECT LINE on first line, PREVIEW TEXT on second line, then full BODY. CRITICAL: No [BRACKETS] in body text. Clean readable email with greeting, 3-4 paragraphs, and clear CTA.',
    'Blog post': 'Write: SEO HEADLINE, META DESCRIPTION under 160 chars, full INTRO paragraph, 3-4 SECTION HEADERS with 2-3 sentence summaries, CONCLUSION with CTA. CRITICAL: No [BRACKETS] except section headers.',
    'Text post': textPostInstruction
  };

  const scriptInstruction = contentTypeScriptInstructions[contentType] || contentTypeScriptInstructions['Short-form video'];

  const storyPrompt = base + ' ' + scriptInstruction + ' Return this exact JSON: {"diagnosis":"2-3 sentences on what this moment is really about emotionally","hook":"single best opening line","story_spine":"Setup / Tension / Payoff separated by /","full_script":"COMPLETE OUTPUT as specified — for text formats this is clean readable text with no video directions","b_roll":"4 specific b-roll shots each on its own line — write n/a for text-only formats","pacing_note":"one specific delivery tip — for text formats give a writing/posting tip instead","cta":"identity-based call to action","content_warning":"one honest risk"}';

  const hookPrompt = base + ' Return this exact JSON: {"diagnosis":"what makes this moment hook-worthy for this audience and platform","hook_1":"emotion-first hook","hook_2":"curiosity-first hook","hook_3":"identity-first hook","winner":"which hook and exactly why for these platforms","visual_note":"what to show on screen first 3 seconds — for text formats describe the post thumbnail or cover image instead","platform_strategies":' + (platforms && platforms.length > 0 ? '[{"platform":"exact platform name","strategy":"specific posting strategy tailored to this platform for this exact moment"}]' : '[]') + '}';

  const systemPrompt = mode === 'story' ? storyPrompt : hookPrompt;
  if (!systemPrompt) return res.status(400).json({ error: 'Invalid mode' });

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, system: systemPrompt, messages: [{ role: 'user', content: moment }] })
    });
    if (!anthropicRes.ok) {
      const errData = await anthropicRes.json().catch(() => ({}));
      throw new Error(errData.error?.message || 'API error ' + anthropicRes.status);
    }
    const anthropicData = await anthropicRes.json();
    const parsed = JSON.parse(anthropicData.content?.[0]?.text?.replace(/```json|```/g, '').trim());
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Something went wrong.' });
  }
};
