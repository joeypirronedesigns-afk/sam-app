// api/wizard-save.js
// Persists full WS wizard context to sam_context in Supabase.
// Uses email-based lookup matching api/voice.js pattern.
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

    // Find the row with tier != null (real paid/trial row) for this email
    // Order by last_seen desc to get most recently active row
    const findR = await fetch(
      `${SUPABASE_URL}/rest/v1/sam_users?email=eq.${enc}&select=uid,tier&order=last_seen.desc.nullslast&limit=10`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    );
    if (!findR.ok) throw new Error('Find failed');
    const rows = await findR.json();
    if (!Array.isArray(rows) || rows.length === 0) return res.status(200).json({ ok: false, reason: 'user not found' });

    // Prefer row with a real tier (not null/free anon rows)
    const targetRow = rows.find(r => r.tier && r.tier !== 'free') || rows[0];
    const uid = targetRow.uid;

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
    console.log('[wizard-save] saved to uid:', uid, 'tier:', targetRow.tier);
    return res.status(200).json({ ok: true, uid });

  } catch(e) {
    console.error('[wizard-save]', e.message);
    return res.status(200).json({ ok: false, reason: e.message });
  }
};
