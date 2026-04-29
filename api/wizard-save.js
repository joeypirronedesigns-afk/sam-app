// api/wizard-save.js
// Persists full WS wizard context to sam_context in Supabase.
// Called fire-and-forget from _samSaveSession() on every step advance.
// POST /api/wizard-save
// Body: { email: string, context: object }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, context } = req.body || {};
  if (!email || !email.includes('@')) return res.status(200).json({ ok: false, reason: 'no email' });
  if (!context || typeof context !== 'object') return res.status(200).json({ ok: false, reason: 'no context' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(200).json({ ok: false, reason: 'no config' });

  // Strip voice/binary fields before saving
  const toSave = Object.assign({}, context);
  delete toSave.voiceProfile;
  delete toSave.voiceCalibrated;
  delete toSave.voiceSample;
  delete toSave.brandLogo;
  delete toSave.storyPhoto;
  delete toSave.thumbPhoto;

  try {
    const enc = encodeURIComponent(email.toLowerCase());

    // Find most recent row for this email
    const findR = await fetch(
      `${SUPABASE_URL}/rest/v1/sam_users?email=eq.${enc}&select=uid&order=last_seen.desc.nullslast&limit=1`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    );
    if (!findR.ok) throw new Error('Find failed');
    const rows = await findR.json();
    if (!Array.isArray(rows) || rows.length === 0) return res.status(200).json({ ok: false, reason: 'user not found' });

    const uid = rows[0].uid;

    const updateR = await fetch(
      `${SUPABASE_URL}/rest/v1/sam_users?uid=eq.${encodeURIComponent(uid)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          sam_context: JSON.stringify(toSave),
          last_seen: new Date().toISOString()
        })
      }
    );

    if (!updateR.ok) throw new Error('Update failed: ' + await updateR.text());
    return res.status(200).json({ ok: true });

  } catch(e) {
    console.error('[wizard-save]', e.message);
    return res.status(200).json({ ok: false, reason: e.message });
  }
};
