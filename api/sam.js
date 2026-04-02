module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mode, moment, platforms, contentType, creatorContext, tone } = req.body;
  if (!moment || !mode) return res.status(400).json({ error: 'Missing mode or moment' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const platformContext = platforms && platforms.length > 0
    ? 'The creator posts on: ' + platforms.join(', ') + '.' : '';

  const formatContext = contentType
    ? 'Content format: ' + contentType + '. Shape all output specifically for this format.' : '';

  const creatorLine = creatorContext
    ? 'About this creator: ' + creatorContext + '. Use this to make the output specific to their audience, voice, and niche.' : '';

  const toneDescriptions = {
    'Authentic/Natural': 'Tone: Authentic and natural. Real, grounded, conversational, no fluff or hype. Speak like a real person talking to a friend.',
    'Viral/Hype': 'Tone: Viral and high energy. Bold, punchy, scroll-stopping. Use power words, urgency, and excitement. Make it impossible to ignore.',
    'Wise/Mentor': 'Tone: Wise and mentor-like. Thoughtful, measured, insight-driven. Teach something. Build authority and deep trust.',
    'Bubbly/Energetic': 'Tone: Bubbly and energetic. Warm, fun, uplifting. Full of personality and positive energy. Make people smile.'
  };

  const toneContext = toneDescriptions[tone] || toneDescriptions['Authentic/Natural'];

  const contentTypeScriptInstructions = {
    'Short-form video': 'Write a complete word-for-word spoken script for a 60-90 second short-form video. Structure it with clear beats labeled in [BRACKETS]: [HOOK] for the opening line, [SETUP] for context, [TENSION] for the conflict or challenge, [PAYOFF] for the resolution or reveal, [CTA] for the call to action. Include pacing notes in (parentheses) like (pause here) or (show footage of X). Every word should be speakable out loud.',
    'Long-form YouTube video': 'Write a complete word-for-word script for a 8-12 minute YouTube video. Label each section: [INTRO HOOK], [CONTEXT], [MAIN STORY], [KEY LESSONS], [OUTRO CTA]. Include b-roll suggestions in (parentheses). Make it conversational throughout.',
    'LinkedIn text post': 'Write the complete LinkedIn post text, ready to copy and paste. Strong opening line, short paragraphs, no fluff, ends with a question or reflection. Include 3 hashtags at the end.',
    'Instagram caption': 'Write the complete Instagram caption. Hook on first line, storytelling in the body with line breaks, CTA, then 5 relevant hashtags on a new line.',
    'Podcast intro': 'Write a complete word-for-word podcast intro script, 60-90 seconds when spoken. Hooks the listener immediately, sets up the episode theme, teases what they will learn or feel. Include (tone notes) in parentheses.',
    'Email newsletter': 'Write the complete email: SUBJECT LINE on first line, PREVIEW TEXT on second line, then the full BODY with greeting, 3-4 paragraphs, and a clear CTA at the end.',
    'Blog post': 'Write: SEO HEADLINE, META DESCRIPTION (under 160 chars), full INTRO paragraph, 3-4 SECTION HEADERS with 2-3 sentence summaries each, and CONCLUSION with CTA.'
  };

  const scriptInstruction = contentTypeScriptInstructions[contentType] || contentTypeScriptInstructions['Short-form video'];

  const base = 'You are S.A.M. — Strategic Assistant for Making. You help creators turn real moments into content that builds a following. ' + toneContext + ' ' + creatorLine + ' ' + platformContext + ' ' + formatContext + ' CRITICAL: Respond ONLY with valid JSON. No markdown. No backticks. No preamble.';

  const storyPrompt = base + ' The creator described a real moment. ' + scriptInstruction + ' Return this exact JSON: {"diagnosis":"2-3 sentences on what this moment is really about emotionally","hook":"single best opening line","story_spine":"Setup / Tension / Payoff separated by /","full_script":"THE COMPLETE WORD-FOR-WORD SCRIPT with beat labels in [BRACKETS] and pacing notes in (parentheses) — full and complete, ready to read aloud","b_roll":"4 specific b-roll shots each on its own line","pacing_note":"one specific delivery tip","cta":"identity-based call to action","content_warning":"one honest risk"}';

  const hookPrompt = base + ' The creator described a real moment. Return this exact JSON: {"diagnosis":"what makes this moment hook-worthy","hook_1":"emotion-first hook","hook_2":"curiosity-first hook","hook_3":"identity-first hook","winner":"which hook and exactly why","visual_note":"what to show on screen first 3 seconds","platform_strategies":' + (platforms && platforms.length > 0 ? '[{"platform":"platform name","strategy":"specific posting strategy for this moment"}]' : '[]') + '}';

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
