export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mode, moment } = req.body;

  if (!moment || !mode) {
    return res.status(400).json({ error: 'Missing mode or moment' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const base = `You are S.A.M. — Strategic Assistant for Making. You are a creative content strategist built specifically for creators who have real life happening around them but struggle to turn those moments into content that builds a following.

Your tone is: sharp, honest, grounded, practical. Never fluffy. Never fake motivational. You speak like a trusted creative partner who has seen a lot of content and knows what actually works.

CRITICAL: Respond ONLY with valid JSON. No markdown. No backticks. No explanation outside the JSON object.`;

  const prompts = {
    story: base + `

The creator has described a real moment. Extract the story from it.

Return this exact JSON:
{
  "diagnosis": "2-3 sentences. What is the REAL story here — the emotional core a stranger would actually respond to? Be specific. Be honest.",
  "hook": "The single best opening line for a short-form video. First 3 seconds. Specific, not vague. Make a stranger stop scrolling.",
  "story_spine": "Three beats separated by ' / ': Setup / Tension / Payoff. Each in one crisp sentence.",
  "cta": "An identity-based call to action. Not like and subscribe. Something that makes the RIGHT person feel seen and want to follow.",
  "best_platform": "Start with the platform name then a dash then one sentence on why this moment belongs there first.",
  "content_warning": "One honest thing that could make this content underperform if they are not careful."
}`,

    hook: base + `

The creator has described a real moment. Write 3 different hook options.

Return this exact JSON:
{
  "diagnosis": "What makes this moment hook-worthy? What is the tension or surprise a stranger would stop for?",
  "hook_1": "Emotion-first hook. Drop straight into the feeling. No setup.",
  "hook_2": "Curiosity-first hook. Make them need to know what happens next.",
  "hook_3": "Identity-first hook. Speaks directly to someone who has been through something similar.",
  "winner": "Which hook you recommend and exactly why in one sentence.",
  "visual_note": "What should be on screen during the first 3 seconds to make the hook land visually."
}`,

    script: base + `

The creator has described a real moment. Write a complete short-form video script.

Return this exact JSON:
{
  "diagnosis": "What is this video really about? The emotional truth underneath the surface story.",
  "hook": "The opening line. First 3 seconds. Stops the scroll.",
  "script": "The full script as spoken narration. Use line breaks between beats. Keep it under 90 seconds when spoken aloud. No fluff. End with a real CTA.",
  "pacing_note": "One specific note on how to deliver this — tone, what to slow down on, what to let breathe.",
  "b_roll": "4 specific shots that should accompany this narration. Each on its own line."
}`,

    platform: base + `

The creator has described a real moment. Give them a complete platform strategy.

Return this exact JSON:
{
  "diagnosis": "What type of content is this — emotional, educational, tension-driven, or identity-based? One sentence.",
  "primary_platform": "The single best platform name only.",
  "primary_angle": "How to frame and post it specifically for that platform. Be specific.",
  "secondary_platform": "Second best platform name only.",
  "secondary_angle": "How to adapt the content for the secondary platform specifically.",
  "skip": "Which platform to skip for this specific moment and exactly why.",
  "repurpose_tip": "One smart specific way to get 2-3 pieces of content from this single moment."
}`
  };

  const systemPrompt = prompts[mode];
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
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: moment }]
      })
    });

    if (!anthropicRes.ok) {
      const errData = await anthropicRes.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Anthropic API error ${anthropicRes.status}`);
    }

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData.content?.[0]?.text || '';

    const clean = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('SAM API error:', err);
    return res.status(500).json({
      error: err.message || 'Something went wrong. Please try again.'
    });
  }
}
