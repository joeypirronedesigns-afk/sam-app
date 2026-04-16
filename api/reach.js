// api/reach.js — non-streaming reach tool, works on all mobile browsers
module.exports.config = { api: { bodyParser: { sizeLimit: '10mb' } } };

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, moment } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: 'Image required' });

  // Auto-detect image type from base64 header — don't trust client-provided type
  let imageType = 'image/jpeg';
  const sig = imageBase64.slice(0, 16);
  if (sig.startsWith('/9j/')) imageType = 'image/jpeg';
  else if (sig.startsWith('iVBORw0K')) imageType = 'image/png';
  else if (sig.startsWith('R0lGOD')) imageType = 'image/gif';
  else if (sig.startsWith('UklGR')) imageType = 'image/webp';
  else if (sig.startsWith('AAAAF') || sig.startsWith('AAAAI')) imageType = 'image/jpeg'; // HEIC → treat as jpeg

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const system = `You are SAM — a strategic content assistant. Generate platform-ready post content based on the photo and context provided. Write in plain text only. NO JSON, no markdown symbols, no code blocks.

For each platform requested, use this exact format:

PLATFORM: [Platform Name]
HOOK: [attention-grabbing opening line]
CAPTION: [full caption text]
DESCRIPTION: [longer description if needed]
CTA: [call to action]
HASHTAGS: [relevant hashtags]

Make every caption feel personal, story-driven, and native to that platform. Write in the creator's voice — vulnerable, specific, never corporate.`;

  const userContent = imageBase64
    ? [{ type: 'image', source: { type: 'base64', media_type: imageType || 'image/jpeg', data: imageBase64 } }, { type: 'text', text: moment || 'Generate platform-ready post content for this photo.' }]
    : moment || 'Generate platform-ready post content.';

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1800, system, messages: [{ role: 'user', content: userContent }] })
    });

    if (!r.ok) {
      const e = await r.text().catch(() => '');
      return res.status(500).json({ error: 'API error: ' + e.slice(0, 200) });
    }

    const data = await r.json();
    const text = data.content?.[0]?.text || '';
    return res.status(200).json({ success: true, text });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
