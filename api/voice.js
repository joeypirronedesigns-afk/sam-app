const { checkGate } = require('./_gate');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, samples, existingProfile, source } = req.body;

  // v9.113.1 — Voice DNA gate (mirrors api/voice-trainer.js reference pattern + Position B paid check)
  const _gate = await checkGate({
    email: req.body.email || (userId && userId.includes('@') ? userId : ''),
    userId: userId || 'anon',
    tool: 'Voice Trainer',
    copyAnonymous: 'Please sign in to use Voice Trainer.',
    copyUnpaid: 'Subscribe to use Voice Trainer — $39/month, every tool included, cancel anytime.'
  });
  if (!_gate.ok) return res.status(_gate.status).json(_gate.body);

  const uid = userId ? userId.toLowerCase() : null;
  if (!uid || uid === 'anon') return res.status(400).json({ error: 'No user ID' });
  if (!samples || !samples.length) return res.status(400).json({ error: 'No samples provided' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const { saveUserProfile, getUserProfile } = require('./_supabase');

  // Pattern B: fetch full historical sample set BEFORE inserting (clean baseline)
  let historicalSamples = [];
  if (existingProfile && SUPABASE_URL && SERVICE_KEY) {
    try {
      const _hr = await fetch(
        `${SUPABASE_URL}/rest/v1/sam_voice_samples?user_id=eq.${encodeURIComponent(uid)}&select=sample_text&order=created_at.asc`,
        { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
      );
      if (_hr.ok) {
        historicalSamples = (await _hr.json()).map(r => r.sample_text);
      } else {
        console.error('[voice] historical fetch failed:', await _hr.text());
      }
    } catch (e) { console.error('[voice] historical fetch error:', e.message); }
  }

  // Persist new samples (graceful degradation — Claude runs even if insert fails)
  const sampleSource = source || (existingProfile ? 'voice_trainer' : 'onboarding');
  if (SUPABASE_URL && SERVICE_KEY) {
    try {
      const _rows = samples.map(s => ({ user_id: uid, sample_text: s, source: sampleSource }));
      const _ir = await fetch(`${SUPABASE_URL}/rest/v1/sam_voice_samples`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json', 'Prefer': 'return=minimal'
        },
        body: JSON.stringify(_rows)
      });
      if (!_ir.ok) console.error('[voice] sample insert failed:', await _ir.text());
      else console.log('[voice] inserted', samples.length, 'samples for', uid, 'source=', sampleSource);
    } catch (e) { console.error('[voice] sample insert error:', e.message); }
  }

  // New samples first (most recent), then full historical — cap at 30
  const allSamples = [...samples, ...historicalSamples].slice(0, 30);
  const sampleText = allSamples.map((s, i) => `Sample ${i+1}: "${s}"`).join('\n');

  // Fetch user row for sam_context preservation; resolve existingAnalysis from either form
  const existing = await getUserProfile(uid).catch(() => null);
  const existingAnalysis = typeof existingProfile === 'string'
    ? existingProfile
    : (existingProfile?.voice_profile || existing?.voice_profile || '');

  const evolutionBlock = existingAnalysis
    ? `EXISTING VOICE PROFILE (refine and extend, do not replace):
${existingAnalysis}

The writer has provided NEW writing samples below. Your job is to EVOLVE the existing profile:
- PRESERVE traits from the existing profile that still hold true in the new samples
- REFINE traits where the new samples reveal more nuance or contradict the old read
- ADD new traits that only emerge from the new samples
- REMOVE traits that the new samples clearly disprove (rare — be conservative)

Keep the same numbered list format. Aim for 10-20 numbered traits total. If the existing profile had 14 traits and the new samples reveal 3 genuinely new patterns, the output should be ~17 traits, not a fresh 10.

`
    : '\n';

  const prompt = `You are analyzing a creator's actual writing samples to extract their real voice DNA.

THEIR ACTUAL WRITING:
${sampleText}

${evolutionBlock}Extract their voice DNA from these REAL examples. Be forensic and specific — reference actual phrases and patterns you see. Cover:
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

    const nextVersion = (existing?.voice_version || 0) + 1;

    await saveUserProfile(uid, {
      voice_profile: analysis,
      sam_context: existing?.sam_context || null,
      voice_version: nextVersion
    });

    return res.status(200).json({
      ok: true,
      analysis,
      samples_stored: samples.length,
      voice_version: nextVersion,
      message: `Voice DNA updated with ${allSamples.length} real writing samples`
    });

  } catch(e) {
    console.error('Voice DNA error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
