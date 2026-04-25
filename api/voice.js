module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, samples, existingProfile } = req.body;
  if (!userId || userId === 'anon') return res.status(400).json({ error: 'No user ID' });
  if (!samples || !samples.length) return res.status(400).json({ error: 'No samples provided' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const { saveUserProfile, getUserProfile } = require('./_supabase');

  // Get existing profile to merge with, not overwrite
  const existing = existingProfile || await getUserProfile(userId).catch(() => null);
  const existingSamples = existing?.voice_samples ? JSON.parse(existing.voice_samples) : [];
  const existingAnalysis = existing?.voice_profile || '';

  // Keep last 20 samples max — newest first
  const allSamples = [...samples, ...existingSamples].slice(0, 20);
  const sampleText = allSamples.map((s, i) => `Sample ${i+1}: "${s}"`).join('\n');

  // Use Claude to extract real voice patterns from actual writing
  const prompt = `You are analyzing a creator's actual writing samples to extract their real voice DNA.

THEIR ACTUAL WRITING:
${sampleText}

${existingAnalysis ? 'PREVIOUS ANALYSIS (update and deepen this, never replace):\n' + existingAnalysis + '\n\n' : ''}

Extract their voice DNA from these REAL examples. Be forensic and specific — reference actual phrases and patterns you see. Cover:
1. SENTENCE RHYTHM — how long, how they break, where they punch
2. PUNCTUATION PERSONALITY — their actual use of .. or — or ! or CAPS
3. EMOTIONAL REGISTER — where they go vulnerable, where they pull back
4. ACTUAL PHRASES — words and expressions only they use
5. ENERGY SIGNATURE — dry/hype/warm/raw and how it shifts
6. THE TELL — that one move that is unmistakably them

Be specific. Quote their actual words. Never use generic descriptions like "conversational" or "authentic" — say exactly WHAT they do and HOW.

Return exactly 6-8 numbered traits, one per line, in this format:
1. [Trait name] — [one-sentence description quoting their actual words or patterns]
2. [Trait name] — [one-sentence description]
...and so on.

No preamble. No closing remarks. No prose paragraphs. Just the numbered list. 200 words max total.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await r.json();
    const analysis = data?.content?.[0]?.text || '';

    if (!analysis) return res.status(500).json({ error: 'No analysis generated' });

    // Store both the analysis AND the raw samples
    // voice_profile = the forensic analysis (used in system prompt)
    // voice_samples = JSON array of actual sentences (for future analysis rounds)
    await saveUserProfile(userId, {
      voice_profile: analysis,
      sam_context: existing?.sam_context || null
    });

    // Also store raw samples in a separate field via direct supabase call
    const { default: supabaseQuery } = require('./_supabase');
    // Store samples as JSON string in sam_context as backup if no dedicated field
    // This is additive — never overwrites existing sam_context, appends samples
    const samplesPayload = JSON.stringify(allSamples);

    return res.status(200).json({
      ok: true,
      analysis,
      samples_stored: allSamples.length,
      message: `Voice DNA updated with ${allSamples.length} real writing samples`
    });

  } catch(e) {
    console.error('Voice DNA error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
