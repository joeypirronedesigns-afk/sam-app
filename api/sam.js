module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mode, moment, platforms, contentType, creatorContext, tone, audienceDemographics } = req.body;
  if (!moment || !mode) return res.status(400).json({ error: 'Missing mode or moment' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const platformContext = platforms && platforms.length > 0
    ? 'The creator posts on: ' + platforms.join(', ') + '.' : '';

  const formatContext = contentType
    ? 'Content format: ' + contentType + '. Shape all output specifically for this format.' : '';

  const creatorLine = creatorContext
    ? 'About this creator: ' + creatorContext + '.' : '';

  const dialectMap = {
    'Australia': 'Write in authentic Australian vernacular. Use natural Aussie slang where appropriate: "mate", "reckon", "heaps", "arvo", "no worries", "legend", "keen", "smashed it", "bloody", "deadset". Keep it casual, direct, and genuinely Australian — not a caricature, just natural. Avoid American idioms.',
    'UK': 'Write in authentic British English. Use natural UK phrasing: "brilliant", "proper", "mate", "sorted", "gutted", "cheers", "having a go", "dead good". Understated, dry humor is welcome. Avoid American idioms.',
    'Canada': 'Write in Canadian English. Friendly, warm, slightly understated. Natural and conversational. Avoid distinctly American or British idioms.',
    'USA': 'Write in natural American English. Conversational, direct, and relatable.',
    'North America': 'Write in natural North American English. Accessible and conversational.',
    'English-speaking countries': 'Write in clear, accessible English that works across cultures. Avoid region-specific slang.',
    'worldwide': 'Write in simple, clear, universally accessible English. Avoid idioms or slang that may not translate across cultures.'
  };

  let dialectNote = '';
  if (audienceDemographics) {
    for (const [location, dialect] of Object.entries(dialectMap)) {
      if (audienceDemographics.includes(location)) {
        dialectNote = dialect;
        break;
      }
    }
  }

  const audienceLine = audienceDemographics
    ? 'Target audience: ' + audienceDemographics + '. Write hooks, language, and CTAs that speak directly to this specific group. ' + dialectNote : '';

  const toneDescriptions = {
    'Authentic/Natural': 'Tone: Authentic and natural. Real, grounded, conversational, no fluff or hype. Speak like a real person talking to a friend.',
    'Viral/Hype': 'Tone: Viral and high energy. Bold, punchy, scroll-stopping. Use power words, urgency, and excitement. Make it impossible to ignore.',
    'Wise/Mentor': 'Tone: Wise and mentor-like. Thoughtful, measured, insight-driven. Teach something. Build authority and deep trust.',
    'Bubbly/Energetic': 'Tone: Bubbly and energetic. Warm, fun, uplifting. Full of personality and positive energy. Make people smile.'
  };

  const toneContext = toneDescriptions[tone] || toneDescriptions['Authentic/Natural'];

  const contentTypeScriptInstructions = {
    'Short-form video': 'Write a complete word-for-word spoken script for a 60-90 second short-form video. Structure with beats in [BRACKETS]: [HOOK], [SETUP], [TENSION], [PAYOFF], [CTA]. Pacing notes in (parentheses). Every word speakable out loud.',
    'Long-form YouTube video': 'Write a complete word-for-word script for 8-12 minutes. Label: [INTRO HOOK], [CONTEXT], [MAIN STORY], [KEY LESSONS], [OUTRO CTA]. B-roll in (parentheses).',
    'LinkedIn text post': 'Write the complete LinkedIn post. Strong opening line (no "I" to start), short paragraphs, ends with a question. Include 3 hashtags.',
    'Instagram caption': 'Write the complete Instagram caption. Hook first line, body with line breaks, CTA, then 5 hashtags.',
    'Podcast intro': 'Write a complete 60-90 second spoken intro. Hooks listener, sets up theme, teases what they will learn. Tone notes in (parentheses).',
    'Email newsletter': 'Write the complete email: SUBJECT LINE, PREVIEW TEXT, then full BODY with greeting, 3-4 paragraphs, and clear CTA.',
    'Blog post': 'Write: SEO HEADLINE, META DESCRIPTION under 160 chars, full INTRO paragraph, 3-4 SECTION HEADERS with summaries, CONCLUSION with CTA.'
  };

  const scriptInstruction = contentTypeScriptInstructions[contentType] || contentTypeScriptInstructions['Short-form video'];

  const base = 'You are S.A.M. — Strategic Assistant for Making. You help creators turn real moments into content that builds a following. ' + toneContext + ' ' + creatorLine + ' ' + audienceLine + ' ' + platformContext + ' ' + formatContext + ' CRITICAL: Respond ONLY with valid JSON. No markdown. No backticks. No preamble.';

  const storyPrompt = base + ' ' + scriptInstruction + ' Return this exact JSON: {"diagnosis":"2-3 sentences on what this moment is really about emotionally","hook":"single best opening line","story_spine":"Setup / Tension / Payoff separated by /","full_script":"COMPLETE WORD-FOR-WORD SCRIPT with beat labels in [BRACKETS] and pacing notes in (parentheses) — ready to read aloud","b_roll":"4 specific b-roll shots each on its own line","pacing_note":"one specific delivery tip","cta":"identity-based call to action","content_warning":"one honest risk"}';

  const hookPrompt = base + ' Return this exact JSON: {"diagnosis":"what makes this moment hook-worthy for this audience","hook_1":"emotion-first hook","hook_2":"curiosity-first hook","hook_3":"identity-first hook","winner":"which hook and exactly why","visual_note":"what to show on screen first 3 seconds","platform_strategies":' + (platforms && platforms.length > 0 ? '[{"platform":"platform name","strategy":"specific posting strategy for this moment on this platform"}]' : '[]') + '}';

  const systemPrompt = mode === 'story' ? storyPrompt : hookPrompt;
  if (!systemPrompt) return res.status(400).json({ error: 'Invalid mode' });

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: moment }]
      })
    });

    if (!anthropicRes.ok) {
      const errData = await anthropicRes.json().catch(() => ({}));
      throw new Error(errData.error?.message || 'Anthropic API error ' + anthropicRes.status);
    }

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData.content?.[0]?.text || '';
    const clean = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error('SAM API error:', err);
    return res.status(500).json({ error: err.message || 'Something went wrong.' });
  }
};
