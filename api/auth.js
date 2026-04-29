const crypto = require('crypto');

async function getKV() {
  const { kv } = require('@vercel/kv');
  return kv;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, email, token } = req.body || {};

  // ── SEND MAGIC LINK ──────────────────────────────────────────────────────
  if (action === 'send_magic_link') {
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    try {
      const kv = await getKV();
      
      // Check if user exists — create account if not found (returning user who lost session)
      let user = await kv.get(`user:${email.toLowerCase()}`);
      if (!user) {
        user = {
          email: email.toLowerCase(),
          name: '',
          tier: 'free',
          paid: false,
          trialStart: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await kv.set(`user:${email.toLowerCase()}`, user);
      }

      // Generate magic link token
      const magicToken = crypto.randomBytes(32).toString('hex');
      await kv.set(`session:${magicToken}`, { email: email.toLowerCase() }, { ex: 3600 }); // 60 min expiry

      // Send magic link email
      if (process.env.RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Joey at SAM <joey@samforcreators.com>',
            to: [email],
            subject: 'Here\'s your link to get back into SAM',
            html: `<div style="font-family:Arial;padding:40px 32px;background:#FAFAF7;color:#1A1815;border-radius:12px;max-width:520px;margin:0 auto;">
              <h2 style="color:#1A1815;">Welcome back.</h2>
              <p style="color:#4A4640;">Click the button below to sign back into SAM. This link expires in 60 minutes.</p>
              <a href="${process.env.SITE_URL || 'https://samforcreators.com'}/app?token=${magicToken}" 
                style="display:inline-block;padding:16px 32px;background: #20808D;color:#fff;text-decoration:none;border-radius:50px;font-weight:700;margin:24px 0;">
                ✦ Sign into SAM →
              </a>
              <p style="color:#8B8680;font-size:12px;">If you didn't request this, ignore this email. Link expires in 60 minutes.</p>
            </div>`
          })
        });
      }

      return res.status(200).json({ success: true, message: 'Magic link sent' });
    } catch(e) {
      console.error('Magic link error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // ── VERIFY TOKEN ─────────────────────────────────────────────────────────
  if (action === 'verify_token') {
    if (!token) return res.status(400).json({ error: 'Token required' });

    try {
      const kv = await getKV();
      const session = await kv.get(`session:${token}`);
      if (!session) {
        return res.status(401).json({ error: 'expired', message: 'This link has expired. Request a new one.' });
      }

      const user = await kv.get(`user:${session.email}`);
      if (!user) {
        return res.status(404).json({ error: 'no_account' });
      }

      // Delete used token
      await kv.del(`session:${token}`);

      return res.status(200).json({ success: true, user });
    } catch(e) {
      console.error('Token verify error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // ── SAVE USER (trial signup) ──────────────────────────────────────────────
  if (action === 'save_user') {
    const { name, tier = 'free', paid = false, trialStart } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    try {
      const kv = await getKV();
      const existing = await kv.get(`user:${email.toLowerCase()}`);
      
      const userData = {
        email: email.toLowerCase(),
        name: name || existing?.name || '',
        tier: paid ? tier : (existing?.tier || 'free'),
        paid: paid || existing?.paid || false,
        trialStart: existing?.trialStart || trialStart || Date.now(),
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      await kv.set(`user:${email.toLowerCase()}`, userData);
      return res.status(200).json({ success: true, user: userData });
    } catch(e) {
      console.error('Save user error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'Unknown action' });
};
