// api/trial-status.js
// Returns trial status for a user based on Supabase created_at + trial_days

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { email, uid } = req.body || {};
  if (!email && !uid) return res.status(400).json({ error: 'email or uid required' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  try {
    const filter = email
      ? `email=eq.${encodeURIComponent(email.toLowerCase())}&order=created_at.asc&limit=1`
      : `uid=eq.${encodeURIComponent(uid)}&limit=1`;

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/sam_users?select=email,tier,created_at,trial_days&${filter}`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const rows = await r.json();
    const user = rows?.[0];

    if (!user) return res.status(200).json({ allowed: true, reason: 'no_account', daysLeft: 7 });

    // Paid tier — always allowed
    if (user.tier && user.tier !== 'free') {
      return res.status(200).json({ allowed: true, reason: 'paid', tier: user.tier });
    }

    // Check trial window
    const trialDays = user.trial_days || 7;
    const trialMs = trialDays * 24 * 60 * 60 * 1000;
    const created = new Date(user.created_at).getTime();
    const elapsed = Date.now() - created;
    const daysLeft = Math.max(0, Math.ceil((trialMs - elapsed) / (1000 * 60 * 60 * 24)));
    const allowed = elapsed < trialMs;

    return res.status(200).json({
      allowed,
      reason: allowed ? 'trial_active' : 'trial_expired',
      daysLeft,
      tier: user.tier || 'free'
    });
  } catch(e) {
    // On error, allow access (fail open)
    return res.status(200).json({ allowed: true, reason: 'error', error: e.message });
  }
};
