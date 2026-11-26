// api/reach-status.js
// Returns Reach generation status for the current user by email.
// Reads from sam_users.reach_platforms_ready only.
//
// GET /api/reach-status?email=user@example.com
// Returns: { ready: bool, platformsReady: number|null }

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
    return res.status(200).json({ ready: false, platformsReady: null });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(200).json({ ready: false, platformsReady: null });
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/sam_users?email=eq.${encodeURIComponent(email)}&select=reach_platforms_ready&order=last_seen.desc.nullslast&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) throw new Error('Supabase error ' + response.status);

    const data = await response.json();
    const row = data && data.length > 0 ? data[0] : null;

    if (!row) {
      return res.status(200).json({ ready: false, platformsReady: null });
    }

    const platforms = row.reach_platforms_ready;
    const validPlatforms = (typeof platforms === 'number' && platforms >= 1) ? platforms : null;

    return res.status(200).json({
      ready: validPlatforms !== null,
      platformsReady: validPlatforms
    });

  } catch (err) {
    console.error('reach-status error:', err);
    return res.status(200).json({ ready: false, platformsReady: null });
  }
};
