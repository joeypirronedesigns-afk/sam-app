const { supabaseQuery } = require('./_supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  if (body.action === 'clear') {
    const uid = body.email && String(body.email).trim().toLowerCase();
    if (!uid || !uid.includes('@')) return res.status(400).json({ error: 'email required' });
    try {
      await supabaseQuery(
        'sam_users',
        'PATCH',
        { voice_profile: null, voice_version: 0, voice_calibrated: false },
        `uid=eq.${encodeURIComponent(uid)}`
      );
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('[voice-trainer clear]', e);
      return res.status(500).json({ error: 'clear failed' });
    }
  }

  if (body.action === 'save') {
    const uid = body.email && String(body.email).trim().toLowerCase();
    const profile = body.profile && String(body.profile).trim();
    if (!uid || !uid.includes('@')) return res.status(400).json({ error: 'email required' });
    if (!profile) return res.status(400).json({ error: 'profile required' });
    try {
      await supabaseQuery(
        'sam_users',
        'PATCH',
        { voice_profile: profile },
        `uid=eq.${encodeURIComponent(uid)}`
      );
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('[voice-trainer save]', e);
      return res.status(500).json({ error: 'save failed' });
    }
  }

  return res.status(400).json({ error: 'unknown action' });
};
