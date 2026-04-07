const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PRICE_IDS = {
  creator: 'price_1TIgdXPxFeJSVKwnRl61mdwZ',
  pro:     'price_1TIgeCPxFeJSVKwnUCOfzsm1',
  studio:  'price_1TJa2VPxFeJSVKwn9aDPPENS',
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { plan, email, name } = req.body || {};
  const priceId = PRICE_IDS[plan];
  if (!priceId) return res.status(400).json({ error: 'Invalid plan' });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email || undefined,
      success_url: 'https://samforcreators.com?payment=success&plan=' + plan,
      cancel_url: 'https://samforcreators.com?payment=cancelled',
      metadata: { plan, name: name || '' },
      subscription_data: {
        metadata: { plan, name: name || '' }
      }
    });
    return res.status(200).json({ url: session.url });
  } catch(e) {
    console.error('Stripe checkout error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
