module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mode, moment, platforms, contentType, creatorContext, tone, audienceDemographics, outputLanguage } = req.body;
  if (!moment || !mode) return res.status(400).json({ error: 'Missing mode or moment' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const platformContext = platforms && platforms.length > 0
    ? 'The creator posts on: ' + platforms.join(', ') + '. Tailor ALL output specifically for these platforms.' : '';
  const formatContext = contentType ? 'Content format: ' + contentType + '.' : '';
  const creatorLine = creatorContext ? 'About this creator: ' + creatorContext + '.' : '';
  const languageLine = outputLanguage
    ? 'IMPORTANT: Write the ENTIRE output in ' + outputLanguage + '. Do not use English except inside JSON field names.' : '';

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

  const base = 'You are S.A.M. — Strategic Assistant for Making. ' + toneContext + ' ' + creatorLine + ' ' + audienceLine + ' ' + languageLine + ' ' + platformContext + ' ' + formatContext + ' CRITICAL: Respond ONLY with valid JSON. No markdown. No backticks. No preamble.';

  // CALENDAR MODE
  if (mode === 'calendar') {
    const platList = platforms && platforms.length > 0
      ? platforms
      : ['TikTok', 'Instagram Reels', 'Facebook Reels', 'YouTube Shorts', 'LinkedIn', 'X (Twitter)', 'any platform'];
    const calPrompt = base + ' A creator described a moment or content idea. Build a strategic 7-day posting plan that maximizes reach from this one piece of content. Rotate across these platforms where possible: ' + platList.join(', ') + '. Vary the format each day. Build momentum. For ideal_time give a specific time like "6:00 PM" and reason like "Tuesday 6PM — highest engagement window for this platform". Return exactly this JSON with exactly 7 items: {"days":[{"platform":"exact platform name from the list","post_type":"format e.g. Short-form video, Text post, Story, Carousel, Behind-the-scenes","content":"specific post description or ready-to-use caption — 2-3 sentences","tip":"one tactical tip for this specific post and platform","ideal_time":"specific day + time + brief reason e.g. Tuesday 6–8 PM — peak scroll time for this platform"}]}';

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, system: calPrompt, messages: [{ role: 'user', content: moment }] })
      });
      if (!r.ok) throw new Error('API error ' + r.status);
      const d = await r.json();
      const parsed = JSON.parse(d.content?.[0]?.text?.replace(/```json|```/g, '').trim());
      return res.status(200).json(parsed);
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Something went wrong.' });
    }
  }

  // IDEAS MODE
  if (mode === 'ideas') {
    const ideasPrompt = base + ' A creator described their niche. Generate exactly 10 specific, actionable content ideas they could make this week. Each must be concrete and immediately filmable — not generic advice. For best_platform recommend the single best platform for each idea based on content type. Return this exact JSON: {"ideas":[{"title":"specific content idea title","why":"one sentence on why this will perform for their audience","best_platform":"single best platform name e.g. TikTok, YouTube Shorts, Instagram Reels, LinkedIn, Facebook Reels"}]}';
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, system: ideasPrompt, messages: [{ role: 'user', content: moment }] })
      });
      if (!r.ok) throw new Error('API error ' + r.status);
      const d = await r.json();
      const parsed = JSON.parse(d.content?.[0]?.text?.replace(/```json|```/g, '').trim());
      return res.status(200).json(parsed);
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Something went wrong.' });
    }
  }

  // STORY + HOOK MODES
  const contentTypeScriptInstructions = {
    'Short-form video': 'Write a complete word-for-word spoken script for a 60-90 second short-form video. Beats in [BRACKETS]: [HOOK], [SETUP], [TENSION], [PAYOFF], [CTA]. Pacing notes in (parentheses).',
    'Long-form YouTube video': 'Write a complete word-for-word script for 8-12 minutes. Label: [INTRO HOOK], [CONTEXT], [MAIN STORY], [KEY LESSONS], [OUTRO CTA].',
    'LinkedIn text post': 'Write the complete LinkedIn post. Strong opening, short paragraphs, ends with a question. 3 hashtags.',
    'Instagram caption': 'Write the complete Instagram caption. Hook first, body with line breaks, CTA, 5 hashtags.',
    'Podcast intro': 'Write a complete 60-90 second spoken intro. Hooks listener, sets theme, teases content.',
    'Email newsletter': 'Write complete email: SUBJECT LINE, PREVIEW TEXT, full BODY with greeting, 3-4 paragraphs, CTA.',
    'Blog post': 'Write: SEO HEADLINE, META DESCRIPTION under 160 chars, full INTRO, 3-4 SECTION HEADERS with summaries, CONCLUSION with CTA.',
    'Text post': 'Write a complete text-only post ready to copy and paste. No images needed. Hook on first line, story in short punchy paragraphs, ends with a question or CTA. Works across Facebook, LinkedIn, X, or any text-based feed.'
  };

  const scriptInstruction = contentTypeScriptInstructions[contentType] || contentTypeScriptInstructions['Short-form video'];

  const storyPrompt = base + ' ' + scriptInstruction + ' Return this exact JSON: {"diagnosis":"2-3 sentences on what this moment is really about emotionally","hook":"single best opening line","story_spine":"Setup / Tension / Payoff separated by /","full_script":"COMPLETE WORD-FOR-WORD SCRIPT with beat labels in [BRACKETS] and pacing notes in (parentheses)","b_roll":"4 specific b-roll shots each on its own line","pacing_note":"one specific delivery tip","cta":"identity-based call to action","content_warning":"one honest risk"}';

  const hookPrompt = base + ' Return this exact JSON: {"diagnosis":"what makes this moment hook-worthy for this specific audience and platform","hook_1":"emotion-first hook tailored to selected platforms","hook_2":"curiosity-first hook tailored to selected platforms","hook_3":"identity-first hook tailored to selected platforms","winner":"which hook and exactly why for these platforms","visual_note":"what to show on screen first 3 seconds","platform_strategies":' + (platforms && platforms.length > 0 ? '[{"platform":"exact platform name","strategy":"specific posting strategy tailored to this platform for this exact moment"}]' : '[]') + '}';

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
