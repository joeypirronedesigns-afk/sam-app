const { loadUserToolContext } = require('./_context');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = body.email && String(body.email).trim().toLowerCase();

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'email required' });
    }

    const toolContext = await loadUserToolContext(email);
    return res.status(200).json({ toolContext });
  } catch (e) {
    console.error('[tool-context]', e);
    return res.status(500).json({ error: 'tool-context failed' });
  }
};
