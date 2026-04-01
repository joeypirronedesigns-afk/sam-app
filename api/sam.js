module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mode, moment, platforms } = req.body;

  if (!moment || !mode) {
    return res.status(400).json({ error: 'Missing mode or moment' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const platformContext = platforms && platforms.length > 0
    ? 'The creator posts on: ' + platforms.join(', ') + '. Tailor your advice specifically for these platforms.'
    : 'No specific platforms selected — give general advice.';

  const base = 'You are S.A.M. — Strategic Assistant for Making. You are a creative content strategist for creators who have real life happening around them but struggle to turn moments into content that builds a following. Your tone is sharp, honest, grounded, practical. CRITICAL: Respond ONLY with valid JSON. No markdown. No backticks. No explanation outside the JSON. ' + platformContext;

  const prompts = {
    story: base + ' The creator described a real moment. Return this exact JSON: {"diagnosis":"2-3 sentences on the real emotional core a stranger would respond to","hook":"single best opening line for short-form video first 3 seconds","story_spine":"Setup sentence / Tension sentence / Payoff sentence","cta":"identity-based call to action not like and subscribe","content_warning":"one honest thing that could make this underperform"}',
    hook: base + ' The creator described a real moment. Return this exact JSON: {"diagnosis":"what makes this moment hook-worthy","hook_1":"emotion-first hook no setup drop straight into the feeling","hook_2":"curiosity-first hook make them need to know what happens","hook_3":"identity-first hook speaks to someone who has been through something similar","winner":"which hook you recommend and exactly why in one sentence","visual_note":"what to show on screen during first 3 seconds","platform_strategies":' + (platforms && platforms.length > 0 ? '"ARRAY_PLACEHOLDER"' : '[]') + '}',
    script: base + ' The creator described a real moment. Return this exact JSON: {"diagnosis":"emotional truth underneath the surface story","hook":"opening line first 3 seconds","script":"full spoken narration script under 90 seconds with line breaks between beats ending with CTA","pacing_note":"one specific delivery note","b_roll":"4 specific shots each on its own line"}',
    platform: base + ' The creator described a real moment. Return this exact JSON: {"diagnosis":"type of content in one sentence","primary_platform":"best platform name only","primary_angle":"how to frame it for that platform specifically","secondary_platform":"second best platform name only","secondary_angle":"how to adapt for secondary platform","skip":"which platform to skip and exactly why","repurpose_tip":"one smart way to get 2-3 pieces from this moment"}'
  };

  let systemPrompt = prompts[mode];

  if (mode === 'hook' && platforms && platforms.length > 0) {
    const platformStrategiesInstruction = ' Also include a "platform_strategies" array where each item has "platform" and "strategy" fields — one entry per selected platform explaining exactly how to post this specific moment on that platform.';
    systemPrompt = base + ' The creator described a real moment. Return this exact JSON: {"diagnosis":"what makes this moment hook-worthy","hook_1":"emotion-first hook","hook_2":"curiosity-first hook","hook_3":"identity-first hook","winner":"which hook you recommend and why","visual_note":"what to show on screen during first 3 seconds","platform_strategies":[{"platform":"platform name","strategy":"specific posting strategy for this platform"}]}' + platformStrategiesInstruction;
  }

  if (!systemPrompt) {
    return res.status(400).json({ error: 'Invalid mode' });
  }

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
