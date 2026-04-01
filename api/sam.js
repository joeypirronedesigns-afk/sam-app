module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mode, moment, platforms, contentType } = req.body;
  if (!moment || !mode) return res.status(400).json({ error: 'Missing mode or moment' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const platformContext = platforms && platforms.length > 0
    ? 'The creator posts on: ' + platforms.join(', ') + '.'
    : '';

  const formatContext = contentType
    ? 'Content format: ' + contentType + '. Shape all output specifically for this format.'
    : 'Content format: Short-form video.';

  const contentTypePrompts = {
    'Short-form video': 'Output a hook, story spine, full spoken script under 90 seconds, b-roll shots, and CTA.',
    'Long-form YouTube video': 'Output a video title, thumbnail concept, intro hook, chapter structure, key talking points, and end screen CTA. Think 8-15 minute video.',
    'LinkedIn text post': 'Output a strong opening line (no "I" to start), 3-5 short punchy paragraphs, a reflection or question to end on, and 3 relevant hashtags. No emojis.',
    'Instagram caption': 'Output a hook first line, 3-4 short paragraphs with line breaks, a CTA, and 5 relevant hashtags.',
    'Podcast intro': 'Output a 60-90 second spoken intro script that hooks the listener, sets up the episode theme, and teases what they will learn or feel.',
    'Email newsletter': 'Output a subject line, preview text, opening hook, 3 body sections with headers, and a single clear CTA button text.',
    'Blog post': 'Output an SEO-friendly headline, meta description, intro paragraph, 3-4 section headers with brief summaries, and a conclusion with CTA.'
  };

  const formatInstructions = contentTypePrompts[contentType] || contentTypePrompts['Short-form video'];

  const base = 'You are S.A.M. — Strategic Assistant for Making. You help creators turn real moments into content that builds a following. Be sharp, honest, and specific. ' + platformContext + ' ' + formatContext + ' CRITICAL: Respond ONLY with valid JSON. No markdown. No backticks. No explanation outside the JSON.';

  const prompts = {
    story: base + ' ' + formatInstructions + ' Return JSON: {"diagnosis":"2-3 sentences on the real emotional core","hook":"single best opening line","story_spine":"Setup / Tension / Payoff as one string separated by /","cta":"identity-based call to action","content_warning":"one honest risk that could make this underperform"}',
    hook: base + ' Return JSON with 3 different hook options and platform strategies. {"diagnosis":"what makes this moment hook-worthy","hook_1":"emotion-first hook","hook_2":"curiosity-first hook","hook_3":"identity-first hook","winner":"which hook and exactly why in one sentence","visual_note":"what to show on screen during first 3 seconds","platform_strategies":' + (platforms && platforms.length > 0 ? '[{"platform":"name","strategy":"specific posting advice"}]' : '[]') + '}'
  };

  if (mode === 'hook' && platforms && platforms.length > 0) {
    prompts.hook = base + ' Return JSON: {"diagnosis":"what makes this moment hook-worthy","hook_1":"emotion-first hook","hook_2":"curiosity-first hook","hook_3":"identity-first hook","winner":"which hook and why","visual_note":"what to show on screen first 3 seconds","platform_strategies":[{"platform":"platform name","strategy":"specific posting strategy for this moment on this platform"}]}';
  }

  const systemPrompt = prompts[mode];
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
        max_tokens: 1500,
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
