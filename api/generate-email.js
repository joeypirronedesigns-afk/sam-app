// api/generate-email.js
// Server-side proxy for Anthropic API — avoids CORS issues from browser

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // v9.113.1 — admin lock (no public Email tool surface yet)
  const _adminSecret = req.headers['x-admin-secret'];
  if (!process.env.ADMIN_SECRET || !_adminSecret || _adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await r.json();
    return res.status(200).json({ text: data.content?.[0]?.text || 'Error generating.' });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
