// api/reach.js — non-streaming reach tool, works on all mobile browsers
module.exports.config = { api: { bodyParser: { sizeLimit: '10mb' } } };

const { checkGate } = require('./_gate');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const _body = req.body || {};

  // v9.113.1 — Voice DNA gate
  const _gate = await checkGate({
    email: _body.email || _body.userEmail || '',
    userId: _body.userId || 'anon',
    tool: 'The Reach',
    copyAnonymous: 'Sign in to use The Reach. SAM needs your channels and offers to find the right people for you.',
    copyUnpaid: 'Subscribe to use The Reach. Get a focused outreach map instead of cold guessing — $39/month, every tool included, cancel anytime.'
  });
  if (!_gate.ok) return res.status(_gate.status).json(_gate.body);

  const { imageBase64, moment } = _body;
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

  // v9.13.1 — persist Reach generation state before streaming
  // Non-blocking: never delays or breaks the stream
  (async () => {
    try {
      const _email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const _platforms = req.body.platforms;
      const _platformCount = (Array.isArray(_platforms) && _platforms.length > 0) ? _platforms.length : 3;
      if (_email && _email.includes('@')) {
        const _supabaseUrl = process.env.SUPABASE_URL;
        const _supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (_supabaseUrl && _supabaseKey) {
          const _findRes = await fetch(
            `${_supabaseUrl}/rest/v1/sam_users?email=eq.${encodeURIComponent(_email)}&select=uid&order=last_seen.desc.nullslast&limit=1`,
            { headers: { 'apikey': _supabaseKey, 'Authorization': `Bearer ${_supabaseKey}` } }
          );
          if (_findRes.ok) {
            const _rows = await _findRes.json();
            if (_rows && _rows.length > 0) {
              await fetch(
                `${_supabaseUrl}/rest/v1/sam_users?uid=eq.${encodeURIComponent(_rows[0].uid)}`,
                {
                  method: 'PATCH',
                  headers: {
                    'apikey': _supabaseKey,
                    'Authorization': `Bearer ${_supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                  },
                  body: JSON.stringify({
                    reach_platforms_ready: _platformCount,
                    reach_updated_at: new Date().toISOString()
                  })
                }
              );
            }
          }
        }
      }
    } catch (_e) { /* non-blocking — never let persistence fail the generation */ }
  })();
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
    console.log('Anthropic response type:', data.type, 'stop_reason:', data.stop_reason);
    if (data.type === 'error') return res.status(200).json({ success: false, error: data.error?.message || 'Anthropic error' });
    const text = data.content?.[0]?.text || '';
    if (!text) return res.status(200).json({ success: false, error: 'Empty response from AI. Try a different image.' });
    return res.status(200).json({ success: true, text });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
