module.exports.config = { api: { bodyParser: false } };

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { trackUser, trackEvent, trackSignup } = require('./_supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch(e) {
    console.error('Webhook signature error:', e.message);
    return res.status(400).json({ error: 'Webhook signature failed' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const plan = session.metadata?.plan || 'creator';
    const email = session.customer_email || session.customer_details?.email;
    const name = session.metadata?.name || '';

    console.log('Payment success:', { plan, email, name });

    // Track in Supabase
    try {
      // Use service role key to bypass RLS on payment webhook
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (SUPABASE_URL && SERVICE_KEY) {
        const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/sam_users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            uid: email.toLowerCase(),
            email: email.toLowerCase(),
            name: name || '',
            tier: plan,
            last_seen: new Date().toISOString()
          })
        });
        if (!upsertRes.ok) {
          const errText = await upsertRes.text();
          console.error('[stripe-webhook] Supabase upsert failed:', upsertRes.status, errText);
        } else {
          console.log('[stripe-webhook] Supabase upsert ok for:', email);
        }
      }
      await trackEvent(email.toLowerCase(), 'payment', { plan, amount: plan === 'creator' ? 39 : plan === 'pro' ? 39 : 99 });
    } catch(e) { console.error('Supabase payment tracking error:', e.message); }

    if (email) {
      try {
        // Save to KV
        const { kv } = require('@vercel/kv');
        const existing = await kv.get(`user:${email.toLowerCase()}`).catch(() => null);
        await kv.set(`user:${email.toLowerCase()}`, {
          email: email.toLowerCase(),
          name: name || existing?.name || '',
          tier: plan,
          paid: true,
          paidAt: Date.now(),
          stripeCustomer: session.customer,
          createdAt: existing?.createdAt || Date.now(),
          updatedAt: Date.now()
        });

        // Generate magic link token for welcome email
        const crypto = require('crypto');
        const magicToken = crypto.randomBytes(32).toString('hex');
        await kv.set(`session:${magicToken}`, { email: email.toLowerCase() }, { ex: 86400 }); // 24hr expiry

        // Send emails
        if (process.env.RESEND_API_KEY) {
          // Notify you
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'SAM <joey@samforcreators.com>',
              to: [process.env.SAM_NOTIFY_EMAIL || 'samforcreators@gmail.com'],
              subject: `💰 New SAM ${plan} subscriber — ${name || email}`,
              html: `<div style="font-family:Arial;padding:24px;background:#09080F;color:#F0ECFF;border-radius:12px;">
                <h2 style="color:#A78BFA;">New paying subscriber! 🎉</h2>
                <p><strong>Plan:</strong> ${plan}</p>
                <p><strong>Name:</strong> ${name || 'Not provided'}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Amount:</strong> $${plan === 'creator' ? '39' : plan === 'pro' ? '39' : '99'}/month</p>
              </div>`
            })
          });

          // Welcome email with magic link
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'Joey at SAM <joey@samforcreators.com>',
              to: [email],
              subject: `Welcome to SAM ${plan.charAt(0).toUpperCase() + plan.slice(1)} — you're in.`,
              html: `<div style="font-family:'Inter',Arial,sans-serif;padding:48px 36px;background:#FAFAF7;max-width:520px;margin:0 auto;border-radius:12px;border:1px solid #E5E2DB;">
  <div style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#8B8680;margin-bottom:24px;">SAM for Creators</div>
  <h1 style="font-family:'Georgia',serif;font-style:italic;font-size:28px;font-weight:400;color:#1A1815;margin:0 0 16px;">Welcome${name ? ', ' + name : ''}.</h1>
  <p style="font-size:15px;line-height:1.7;color:#4A4640;margin:0 0 32px;">SAM turns your lived experience into a content strategy that actually sounds like you.</p>
  <div style="border-top:1px solid #E5E2DB;padding-top:24px;margin-bottom:32px;">
    <p style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#8B8680;margin:0 0 20px;">Your first three moves</p>
    <div style="margin-bottom:16px;">
      <p style="margin:0 0 4px;"><span style="font-size:11px;font-weight:700;color:#20808D;">1 &nbsp;</span><span style="font-size:14px;font-weight:600;color:#1A1815;">Calibrate Voice DNA</span></p>
      <p style="font-size:13px;color:#8B8680;margin:0 0 0 20px;line-height:1.6;">So SAM writes in your register, not generic AI copy. (10 min)</p>
    </div>
    <div style="margin-bottom:16px;">
      <p style="margin:0 0 4px;"><span style="font-size:11px;font-weight:700;color:#20808D;">2 &nbsp;</span><span style="font-size:14px;font-weight:600;color:#1A1815;">Run Story Engine</span></p>
      <p style="font-size:13px;color:#8B8680;margin:0 0 0 20px;line-height:1.6;">So one real moment becomes a full 12-step content playbook. (20 min)</p>
    </div>
    <div>
      <p style="margin:0 0 4px;"><span style="font-size:11px;font-weight:700;color:#20808D;">3 &nbsp;</span><span style="font-size:14px;font-weight:600;color:#1A1815;">Check Today every morning</span></p>
      <p style="font-size:13px;color:#8B8680;margin:0 0 0 20px;line-height:1.6;">SAM reads your data and tells you what matters next.</p>
    </div>
  </div>
  <a href="https://samforcreators.com/app?token=${magicToken}" style="display:inline-block;padding:14px 28px;background:#20808D;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;margin-bottom:32px;">Start with Voice DNA →</a>
  <div style="border-top:1px solid #E5E2DB;padding-top:20px;">
    <p style="font-size:12px;color:#8B8680;margin:0 0 4px;">This link logs you in automatically. Bookmark samforcreators.com to return anytime.</p>
    <p style="font-size:12px;color:#B8B4AB;margin:16px 0 0;">samforcreators.com · Reply to cancel anytime</p>
  </div>
</div>`
            })
          });
        }
      } catch(e) {
        console.error('Post-payment error:', e.message);
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    const email = sub.metadata?.email;
    if (email) {
      try {
        const { kv } = require('@vercel/kv');
        const user = await kv.get(`user:${email.toLowerCase()}`).catch(() => null);
        if (user) {
          await kv.set(`user:${email.toLowerCase()}`, { ...user, paid: false, tier: 'free', cancelledAt: Date.now() });
        }
      } catch(e) {
        console.error('Cancellation error:', e.message);
      }
    }
  }

  return res.status(200).json({ received: true });
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
