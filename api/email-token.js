// api/email-token.js
// Generates a one-time token for email deep-links (auto-login)

const crypto = require('crypto');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const { kv } = require('@vercel/kv');
    const token = crypto.randomBytes(32).toString('hex');
    // Store token with 7-day expiry (email links last longer than magic links)
    await kv.set(`session:${token}`, { email: email.toLowerCase() }, { ex: 604800 });
    return res.status(200).json({ success: true, token });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
