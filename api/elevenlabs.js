// api/elevenlabs.js
// Server-side proxy for ElevenLabs text-to-speech.
// Reads ELEVENLABS_API_KEY from Vercel env var — never exposed to the browser.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ELEVENLABS_API_KEY not configured' });

  const { text, voiceId, modelId, voiceSettings } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  if (!voiceId) return res.status(400).json({ error: 'voiceId required' });

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: modelId || 'eleven_turbo_v2_5',
        voice_settings: voiceSettings || { stability: 0.5, similarity_boost: 0.75 }
      })
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('[elevenlabs] api error:', r.status, errText);
      return res.status(r.status).json({ error: 'elevenlabs error', detail: errText });
    }

    // Stream audio back to browser as binary
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buf.length);
    return res.status(200).send(buf);
  } catch (e) {
    console.error('[elevenlabs] fatal:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
