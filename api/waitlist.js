// api/waitlist.js
// Receives waitlist signups and sends notification emails via Resend
// Setup: sign up free at resend.com, get API key, add to Vercel env vars:
//   RESEND_API_KEY = re_xxxxxxxxxxxx
//   SAM_NOTIFY_EMAIL = samforcreators@gmail.com

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

  if (!email.includes('@') || !email.includes('.')) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const owner = notifyEmail || process.env.SAM_NOTIFY_EMAIL || 'samforcreators@gmail.com';
  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'America/Toronto',
    dateStyle: 'full',
    timeStyle: 'short'
  });

  if (process.env.RESEND_API_KEY) {
    try {
      // Notification email to YOU (owner)
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'SAM Waitlist <onboarding@resend.dev>',
          to: [owner],
          subject: `🚀 New SAM signup — ${name}`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#09080F;color:#F0ECFF;padding:32px;border-radius:16px;">
              <div style="font-size:32px;margin-bottom:16px;">🚀</div>
              <h2 style="font-size:22px;font-weight:700;margin:0 0 20px;color:#A78BFA;">New waitlist signup!</h2>
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(240,236,255,0.5);font-size:13px;width:80px;">Name</td>
                  <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-weight:600;">${name}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(240,236,255,0.5);font-size:13px;">Email</td>
                  <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-weight:600;">${email}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:rgba(240,236,255,0.5);font-size:13px;">Time</td>
                  <td style="padding:10px 0;font-weight:600;">${timestamp}</td>
                </tr>
              </table>
              <div style="margin-top:24px;padding:16px;background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.2);border-radius:10px;">
                <p style="font-size:13px;color:rgba(240,236,255,0.6);margin:0;">Their 3-day free trial has started. On day 4 they'll see the $9 founder offer.</p>
              </div>
              <p style="font-size:12px;color:rgba(240,236,255,0.3);margin-top:20px;">S.A.M. — Strategic Assistant for Making · samforcreators.com</p>
            </div>
          `
        })
      });

      // Confirmation email to the NEW USER
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Joey at SAM <onboarding@resend.dev>',
          to: [email],
          subject: `You're in — 3 days of SAM, completely free 🎉`,
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#09080F;color:#F0ECFF;padding:40px 32px;border-radius:16px;">

              <div style="text-align:center;margin-bottom:28px;">
                <div style="font-size:42px;margin-bottom:12px;">🎉</div>
                <h1 style="font-size:26px;font-weight:700;margin:0 0 10px;background:linear-gradient(135deg,#F472B6,#A78BFA,#38BDF8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">You're in, ${name}!</h1>
                <p style="font-size:16px;color:rgba(240,236,255,0.7);margin:0;line-height:1.5;">3 full days. All 5 tools. Zero limits. No card ever.</p>
              </div>

              <div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:12px;padding:16px 20px;text-align:center;margin-bottom:28px;">
                <p style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#FBBF24;margin:0 0 6px;">Your free access includes</p>
                <p style="font-size:14px;color:rgba(240,236,255,0.8);margin:0;line-height:1.8;">
                  3 FULL DAYS &nbsp;·&nbsp; ALL 5 TOOLS &nbsp;·&nbsp; UNLIMITED RUNS &nbsp;·&nbsp; NO CARD EVER
                </p>
              </div>

              <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:24px;">
                <p style="font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#A78BFA;margin:0 0 14px;">What's waiting for you:</p>
                <div style="display:flex;flex-direction:column;gap:10px;">
                  <div style="font-size:14px;color:rgba(240,236,255,0.8);">🎯 <strong>The Pulse</strong> — Any moment → hook, script, captions. All platforms.</div>
                  <div style="font-size:14px;color:rgba(240,236,255,0.8);">⚡ <strong>The Spark</strong> — 5 content ideas built for your exact niche.</div>
                  <div style="font-size:14px;color:rgba(240,236,255,0.8);">📐 <strong>The Blueprint</strong> — Your full week planned in 30 seconds.</div>
                  <div style="font-size:14px;color:rgba(240,236,255,0.8);">🎬 <strong>The Vision</strong> — One bold video concept nobody else has made.</div>
                  <div style="font-size:14px;color:rgba(240,236,255,0.8);">🔎 <strong>The Lens</strong> — Thumbnail strategy from your own photos.</div>
                </div>
              </div>

              <div style="text-align:center;margin-bottom:28px;">
                <a href="https://samforcreators.com" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6D28D9,#A78BFA,#F472B6);color:#fff;text-decoration:none;border-radius:50px;font-weight:700;font-size:15px;letter-spacing:0.02em;">Open SAM now →</a>
              </div>

              <div style="background:rgba(167,139,250,0.06);border:1px solid rgba(167,139,250,0.15);border-radius:10px;padding:14px 16px;margin-bottom:24px;">
                <p style="font-size:13px;color:rgba(240,236,255,0.6);margin:0;line-height:1.6;">After your 3 days, you'll get first access to <strong style="color:#FBBF24;">SAM Pro at $9/month</strong> — our founding member rate before we raise to $19. No pressure, no auto-charge.</p>
              </div>

              <p style="font-size:13px;color:rgba(240,236,255,0.3);text-align:center;border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;margin:0;">
                You signed up at samforcreators.com · Reply anytime to reach Joey directly.<br/>
                <span style="font-size:12px;">To unsubscribe, reply with "unsubscribe".</span>
              </p>
            </div>
          `
        })
      });

    } catch(emailErr) {
      console.error('Resend error:', emailErr.message);
      // Don't fail — signup was still valid
    }
  } else {
    console.log('No RESEND_API_KEY set — email not sent. Signup recorded:', { name, email });
  }

  return res.status(200).json({
    success: true,
    message: `${name} added to waitlist`,
    emailSent: !!process.env.RESEND_API_KEY
  });
};
