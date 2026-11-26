const { kv } = require('@vercel/kv');
const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, userId } = req.body;
  const e = (email || '').toLowerCase().trim();

  // Auth check
  if (!e || !e.includes('@') || !userId || userId === 'anon') {
    return res.status(401).json({ error: 'auth_required' });
  }

  // KV lookup
  const user = await kv.get(`user:${e}`);
  if (!user || !user.paid) {
    return res.status(402).json({ error: 'subscription_required' });
  }

  // Stripe customer check
  if (!user.stripeCustomer) {
    return res.status(400).json({ error: 'no_customer', message: 'No billing record found. Please contact support at support@samforcreators.com.' });
  }

  // Create portal session
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomer,
      return_url: 'https://samforcreators.com'
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[billing-portal] Stripe error:', err.message);
    return res.status(500).json({ error: 'stripe_error', message: 'Unable to open billing portal. Please try again.' });
  }
};
