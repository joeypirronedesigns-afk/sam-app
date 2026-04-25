const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'valid email required' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(500).json({ error: 'not configured' });

  try {
    const enc = encodeURIComponent(email.toLowerCase());
    // uid = email is the canonical row — written by stripe-webhook, not anon device fingerprints
    const url = `${SUPABASE_URL}/rest/v1/sam_users?email=eq.${enc}&uid=eq.${enc}&select=uid,email,name,tier,voice_profile,sam_context,created_at&limit=1`;
    const r = await fetch(url, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (!r.ok) return res.status(200).json({ user: null });
    const rows = await r.json();
    if (!rows || !rows.length) return res.status(200).json({ user: null });
    const row = rows[0];
    return res.status(200).json({
      user: {
        email: row.email,
        name: row.name || '',
        tier: row.tier || 'free',
        paid: !!(row.tier && row.tier !== 'free'),
        trialStart: row.created_at ? new Date(row.created_at).getTime() : null,
        voiceProfile: row.voice_profile || null,
        samContext: row.sam_context || null
      }
    });
  } catch (e) {
    console.error('api/me error:', e.message);
    return res.status(200).json({ user: null }); // fail open — never break the page
  }
};
