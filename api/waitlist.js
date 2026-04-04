// api/waitlist.js — Fixed version

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { body = {}; }
  }

  const { name, email, notifyEmail } = body || {};
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
  if (!email.includes('@') || !email.includes('.')) return res.status(400).json({ error: 'Invalid email' });

  const owner = notifyEmail || process.env.SAM_NOTIFY_EMAIL || 'samforcreators@gmail.com';
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/Toronto', dateStyle: 'full', timeStyle: 'short' });

  console.log('Waitlist signup received:', { name, email, timestamp });
  console.log('RESEND_API_KEY set:', !!process.env.RESEND_API_KEY);
  console.log('Notify email target:', owner);

  if (process.env.RESEND_API_KEY) {
    try {

      // EMAIL 1: Notify YOU
      const n = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'SAM <onboarding@resend.dev>',
          to: [owner],
          reply_to: email,
          subject: `New SAM signup — ${name}`,
          html: `<div style="font-family:Arial,sans-serif;padding:32px;background:#09080F;color:#F0ECFF;border-radius:12px;max-width:480px;margin:0 auto;">
            <h2 style="color:#A78BFA;margin:0 0 20px;">New waitlist signup!</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Time:</strong> ${timestamp}</p>
            <p style="color:rgba(240,236,255,0.5);font-size:13px;margin-top:20px;">Their 3-day free trial has started. On day 4 they will see the $9 founder offer.</p>
          </div>`
        })
      });
      const nData = await n.json();
      console.log('Owner notify result:', n.status, JSON.stringify(nData));

      // EMAIL 2: Confirm to USER
      const c = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Joey at SAM <onboarding@resend.dev>',
          to: [email],
          subject: `You're in — 3 days of SAM, completely free`,
          html: `<div style="font-family:Arial,sans-serif;padding:40px 32px;background:#09080F;color:#F0ECFF;border-radius:12px;max-width:520px;margin:0 auto;">
            <div style="text-align:center;margin-bottom:24px;">
              <div style="font-size:40px;">🎉</div>
              <h1 style="color:#A78BFA;font-size:24px;margin:12px 0 8px;">You're in, ${name}!</h1>
              <p style="color:rgba(240,236,255,0.7);margin:0;">3 full days. All 5 tools. Zero limits. No card ever.</p>
            </div>
            <div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:12px;padding:16px;text-align:center;margin-bottom:24px;">
              <p style="color:#FBBF24;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 6px;">Your free access includes</p>
              <p style="color:rgba(240,236,255,0.8);margin:0;">3 FULL DAYS &nbsp;·&nbsp; ALL 5 TOOLS &nbsp;·&nbsp; UNLIMITED RUNS &nbsp;·&nbsp; NO CARD EVER</p>
            </div>
            <div style="margin-bottom:24px;">
              <p style="color:#A78BFA;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 12px;">What is waiting for you:</p>
              <p style="color:rgba(240,236,255,0.8);margin:0 0 8px;">🎯 <strong>The Pulse</strong> — Any moment into hook, script and captions.</p>
              <p style="color:rgba(240,236,255,0.8);margin:0 0 8px;">⚡ <strong>The Spark</strong> — 5 ideas built for your niche.</p>
              <p style="color:rgba(240,236,255,0.8);margin:0 0 8px;">📐 <strong>The Blueprint</strong> — Full week planned in 30 seconds.</p>
              <p style="color:rgba(240,236,255,0.8);margin:0 0 8px;">🎬 <strong>The Vision</strong> — Bold video concept + shot list.</p>
              <p style="color:rgba(240,236,255,0.8);margin:0;">🔎 <strong>The Lens</strong> — Thumbnail strategy from your photos.</p>
            </div>
            <div style="text-align:center;margin-bottom:24px;">
              <a href="https://samforcreators.com" style="display:inline-block;padding:14px 32px;background:#7C3AED;color:#fff;text-decoration:none;border-radius:50px;font-weight:700;">Open SAM now</a>
            </div>
            <div style="background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.2);border-radius:10px;padding:14px;margin-bottom:20px;">
              <p style="color:rgba(240,236,255,0.6);font-size:13px;margin:0;">After 3 days you will get first access to <strong style="color:#FBBF24;">SAM Pro at $9/month</strong> — founding rate before we raise to $19. No auto-charge.</p>
            </div>
            <p style="color:rgba(240,236,255,0.3);font-size:12px;text-align:center;margin:0;">samforcreators.com · Reply to unsubscribe</p>
          </div>`
        })
      });
      const cData = await c.json();
      console.log('User confirm result:', c.status, JSON.stringify(cData));

    } catch(err) {
      console.error('Email send failed:', err.message);
    }
  } else {
    console.log('No RESEND_API_KEY — email skipped. Recorded locally:', { name, email });
  }

  return res.status(200).json({ success: true, message: `${name} added`, emailSent: !!process.env.RESEND_API_KEY });
};
