// api/story-engine-save.js
// Persists Story Engine step progress for the current user by email.
// Called fire-and-forget from the wizard on each step advance.
//
// POST /api/story-engine-save
// Body: { email: string, step: number }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const raw = req.body && req.body.email;
  const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  const step = req.body && req.body.step;

  if (!email || !email.includes('@')) {
    return res.status(200).json({ ok: false, reason: 'no email' });
  }
  if (typeof step !== 'number' || step < 1 || step > 12) {
    return res.status(200).json({ ok: false, reason: 'invalid step' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(200).json({ ok: false, reason: 'no config' });
  }

  try {
    // Find the most recently created row for this email to get uid
    const findR = await fetch(
      `${SUPABASE_URL}/rest/v1/sam_users?email=eq.${encodeURIComponent(email)}&select=uid&order=created_at.desc&limit=1`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    );

    if (!findR.ok) throw new Error('Find failed: ' + await findR.text());

    const rows = await findR.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(200).json({ ok: false, reason: 'user not found' });
    }

    const targetUid = rows[0].uid;

    // Update by uid only — never update all rows matching email
    const updateR = await fetch(
      `${SUPABASE_URL}/rest/v1/sam_users?uid=eq.${encodeURIComponent(targetUid)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          story_engine_current_step: step,
          story_engine_updated_at: new Date().toISOString()
        })
      }
    );

    if (!updateR.ok) throw new Error('Update failed: ' + await updateR.text());

    return res.status(200).json({ ok: true, step, uid: targetUid });

  } catch (err) {
    console.error('story-engine-save error:', err.message);
    return res.status(200).json({ ok: false, reason: 'db error' });
  }
};
