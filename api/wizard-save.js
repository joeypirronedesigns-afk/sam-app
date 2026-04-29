// api/wizard-save.js
// Persists full WS wizard context to sam_context in Supabase.
// Uses email-based lookup matching api/voice.js pattern.
// POST /api/wizard-save
// Body: { email: string, context: object }

const { mapWizardToSchemaV2, loadUserContext, saveUserContext } = require('./_context');

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

  // Strip binary fields
  const stripped = Object.assign({}, context);
  delete stripped.voiceProfile; delete stripped.voiceCalibrated;
  delete stripped.voiceSample; delete stripped.brandLogo;
  delete stripped.storyPhoto; delete stripped.thumbPhoto;

  try {
    const { ctx: existingCtx, uid } = await loadUserContext(email);
    if (!uid) return res.status(200).json({ ok: false, reason: 'user not found' });

    const newCtx = mapWizardToSchemaV2(stripped, existingCtx);
    const ok = await saveUserContext(email, newCtx, uid);
    console.log('[wizard-save] v2 save:', ok, 'uid:', uid);
    return res.status(200).json({ ok, uid });

  } catch(e) {
    console.error('[wizard-save]', e.message);
    return res.status(200).json({ ok: false, reason: e.message });
  }
};
