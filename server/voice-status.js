// api/voice-status.js
// Returns Voice DNA calibration status for the current user by email.
// Reads from sam_voice_samples only. sam_users.email is null in production — not queried.
//
// GET /api/voice-status?email=user@example.com
// Returns: { calibrated: bool, lastSampleAt: string|null, displayAge: string|null }

function formatAge(dateStr) {
  if (!dateStr) return null;
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 2) return 'just now';
  if (diffMins < 60) return diffMins + 'm ago';
  if (diffHours < 24) return diffHours + 'h ago';
  if (diffDays === 1) return '1d ago';
  return diffDays + 'd ago';
}

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
    return res.status(200).json({ calibrated: false, lastSampleAt: null, displayAge: null });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(200).json({ calibrated: false, lastSampleAt: null, displayAge: null });
  }

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/sam_voice_samples?user_id=eq.${encodeURIComponent(email)}&select=created_at&order=created_at.desc&limit=1`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    );

    if (!r.ok) throw new Error('Supabase fetch failed: ' + await r.text());

    const samples = await r.json();
    const hasSamples = Array.isArray(samples) && samples.length > 0;
    const lastSampleAt = hasSamples ? samples[0].created_at : null;

    return res.status(200).json({
      calibrated: hasSamples,
      lastSampleAt,
      displayAge: hasSamples ? formatAge(lastSampleAt) : null
    });

  } catch (err) {
    console.error('voice-status error:', err.message);
    return res.status(200).json({ calibrated: false, lastSampleAt: null, displayAge: null });
  }
};
