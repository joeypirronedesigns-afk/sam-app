// api/story-engine-status.js
// Returns Story Engine step progress for the current user by email.
// Reads from sam_users.story_engine_current_step only.
//
// GET /api/story-engine-status?email=user@example.com
// Returns: { started: bool, currentStep: number|null }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const raw = req.query.email;
  const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';

  if (!email || !email.includes('@')) {
    return res.status(200).json({ started: false, currentStep: null });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(200).json({ started: false, currentStep: null });
  }

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/sam_users?email=eq.${encodeURIComponent(email)}&select=story_engine_current_step&order=created_at.desc&limit=1`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    );

    if (!r.ok) throw new Error('Supabase fetch failed: ' + await r.text());

    const rows = await r.json();
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    if (!row) {
      return res.status(200).json({ started: false, currentStep: null });
    }

    const step = row.story_engine_current_step;
    const validStep = (typeof step === 'number' && step >= 1 && step <= 12) ? step : null;

    return res.status(200).json({
      started: validStep !== null,
      currentStep: validStep
    });

  } catch (err) {
    console.error('story-engine-status error:', err.message);
    return res.status(200).json({ started: false, currentStep: null });
  }
};
