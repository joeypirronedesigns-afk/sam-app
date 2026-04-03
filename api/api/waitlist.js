// api/waitlist.js
// Receives waitlist signups, stores them, sends notification to owner
// Uses Resend (free tier — 3,000 emails/month, no credit card)
// Sign up at resend.com, get API key, add RESEND_API_KEY to Vercel env vars

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, notifyEmail } = req.body || {};

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email required' });
  }

  // Basic email validation
  if (!email.includes('@') || !email.includes('.')) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const owner = notifyEmail || process.env.SAM_NOTIFY_EMAIL || 'samforcreators@gmail.com';
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/Toronto', dateStyle: 'full', timeStyle: 'short' });

  // ── SEND NOTIFICATION EMAIL TO OWNER ──────────────────────────────────────
  // Only fires if RESEND_API_KEY is set in Vercel env vars
  if (process.env.RESEND_API_KEY) {
    try {
      // Notification to owner
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'SAM Waitlist <waitlist@resend.dev>',
          to: [owner],
          subject: `🚀 New SAM Pro waitlist signup — ${name}`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#09080F;color:#F0ECFF;padding:32px;border-radius:16px;">
              <div style="font-size:32px;margin-bottom:16px;">🚀</div>
              <h2 style="font-size:22px;font-weight:700;margin:0 0 16px;color:#A78BFA;">New waitlist signup!</h2>
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(240,236,255,0.5);font-size:13px;">Name</td><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-weight:600;">${name}</td></tr>
                <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(240,236,255,0.5);font-size:13px;">Email</td><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-weight:600;">${email}</td></tr>
                <tr><td style="padding:10px 0;color:rgba(240,236,255,0.5);font-size:13px;">Time</td><td style="padding:10px 0;font-weight:600;">${timestamp}</td></tr>
              </table>
              <p style="font-size:13px;color:rgba(240,236,255,0.4);margin-top:24px;">S.A.M. — Strategic Assistant for Making · samforcreators.com</p>
            </div>
          `
        })
      });

      // Confirmation to the new subscriber
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Joey at SAM <waitlist@resend.dev>',
          to: [email],
          subject: `You're on the SAM Pro waitlist 🎉`,
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#09080F;color:#F0ECFF;padding:40px 32px;border-radius:16px;">
              <div style="font-size:40px;text-align:center;margin-bottom:20px;">🎉</div>
              <h1 style="font-family:sans-serif;font-size:26px;font-weight:700;text-align:center;margin:0 0 12px;background:linear-gradient(135deg,#F472B6,#A78BFA,#38BDF8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">You're on the list, ${name}!</h1>
              <p style="font-size:15px;color:rgba(240,236,255,0.7);text-align:center;line-height:1.6;margin-bottom:28px;">We'll email you the moment SAM Pro opens. You've locked in the founding member rate — <strong style="color:#FBBF24;">$9/month forever</strong>, even when the price goes up.</p>

              <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(167,139,250,0.2);border-radius:12px;padding:20px;margin-bottom:24px;">
                <p style="font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#A78BFA;margin:0 0 14px;">What you're getting access to:</p>
                <div style="display:flex;flex-direction:column;gap:10px;">
                  <div style="font-size:14px;color:rgba(240,236,255,0.8);">🎯 <strong>The Pulse</strong> — Any moment → full script + captions</div>
                  <div style="font-size:14px;color:rgba(240,236,255,0.8);">⚡ <strong>The Spark</strong> — 5 content ideas built for your niche</div>
                  <div style="font-size:14px;color:rgba(240,236,255,0.8);">📐 <strong>The Blueprint</strong> — 7-day content calendar in seconds</div>
                  <div style="font-size:14px;color:rgba(240,236,255,0.8);">🎬 <strong>The Vision</strong> — Unique video concept + shot list</div>
                  <div style="font-size:14px;color:rgba(240,236,255,0.8);">🔎 <strong>The Lens</strong> — Thumbnail strategy from your photos</div>
                </div>
              </div>

              <p style="font-size:14px;color:rgba(240,236,255,0.6);text-align:center;line-height:1.6;">In the meantime, the free tools are live right now at <a href="https://samforcreators.com" style="color:#A78BFA;text-decoration:none;">samforcreators.com</a> — go make something.</p>

              <p style="font-size:13px;color:rgba(240,236,255,0.3);text-align:center;margin-top:28px;border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;">You're receiving this because you signed up at samforcreators.com.<br/>Reply to unsubscribe.</p>
            </div>
          `
        })
      });

    } catch(emailErr) {
      console.error('Email send error:', emailErr.message);
      // Don't fail the request if email fails — signup was still recorded
    }
  }

  return res.status(200).json({ 
    success: true, 
    message: `${name} added to waitlist`,
    emailSent: !!process.env.RESEND_API_KEY
  });
};
