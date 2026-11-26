const crypto = require('crypto');
const { createSession, getSessionEmail, destroySession } = require('./_session');

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

  const { action, email, token, name } = req.body || {};

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
          name: (name || '').trim(),
          tier: 'free',
          paid: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await kv.set(`user:${email.toLowerCase()}`, user);
      }

      // Generate magic link token
      const magicToken = crypto.randomBytes(32).toString('hex');
      await kv.set(`session:${magicToken}`, { email: email.toLowerCase() }, { ex: 3600 }); // 60 min expiry

      // Patch W.4 — on preview deployments, link back to the preview that sent the email
      // (SITE_URL for Preview pointed at a stale git-branch alias with old code).
      const _host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
      const linkBase = (process.env.VERCEL_ENV === 'preview' && /\.vercel\.app$/i.test(_host))
        ? `https://${_host}`
        : (process.env.SITE_URL || 'https://samforcreators.com');

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
              <a href="${linkBase}/app?token=${magicToken}" 
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

      // Patch AA — issue the real login session (HttpOnly cookie) the gate trusts.
      await createSession(res, user.email || session.email);

      return res.status(200).json({ success: true, user });
    } catch(e) {
      console.error('Token verify error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // ── WHOAMI (Patch AA) — which account the session cookie belongs to ──────────
  if (action === 'whoami') {
    const sessionEmail = await getSessionEmail(req);
    return res.status(200).json({ signedIn: !!sessionEmail, email: sessionEmail || null, enforcing: process.env.SAM_GATE_ENFORCE === '1' });
  }

  // ── BRAND LOGO (Patch AD) — the small logo lives on the account, so the PDF has it on any device ──
  if (action === 'save_logo' || action === 'get_logo') {
    const who = await getSessionEmail(req);
    if (!who) return res.status(401).json({ error: 'Not signed in' });
    const kv = await getKV();
    const key = 'logo:' + who.toLowerCase();
    if (action === 'get_logo') return res.status(200).json({ logo: (await kv.get(key)) || null });
    const logo = (req.body || {}).logo;
    if (logo === null) { await kv.del(key); return res.status(200).json({ success: true }); }
    if (typeof logo !== 'string' || logo.length > 300000
        || !/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(logo)) {
      return res.status(400).json({ error: 'Logo must be a small PNG/JPEG image' });
    }
    await kv.set(key, logo);
    return res.status(200).json({ success: true });
  }

  // ── SIGN-OFF (Patch AE) — the line the creator ends every video with ─────────
  if (action === 'save_signoff' || action === 'get_signoff') {
    const who = await getSessionEmail(req);
    if (!who) return res.status(401).json({ error: 'Not signed in' });
    const kv = await getKV();
    const key = 'signoff:' + who.toLowerCase();
    if (action === 'get_signoff') return res.status(200).json({ signOff: (await kv.get(key)) || '' });
    const t = String((req.body || {}).signOff || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (t) await kv.set(key, t); else await kv.del(key);
    return res.status(200).json({ success: true });
  }

  // ── LOGOUT (Patch AA) — end the session and clear the cookie ────────────────
  if (action === 'logout') {
    await destroySession(req, res);
    return res.status(200).json({ success: true });
  }

  // ── SAVE USER (trial signup) ──────────────────────────────────────────────
  if (action === 'save_user') {
    // Patch AA — paid status and tier are NEVER accepted from the browser. Only the Stripe
    // webhook (server-to-server, signature-checked) can mark an account paid.
    const { name, trialStart } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    try {
      const kv = await getKV();
      const existing = await kv.get(`user:${email.toLowerCase()}`);
      
      const userData = {
        email: email.toLowerCase(),
        name: name || existing?.name || '',
        tier: existing?.tier || 'free',
        paid: existing?.paid || false,
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
