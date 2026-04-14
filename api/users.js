const { getUserProfile } = require('./_supabase');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(500).json({ error: 'Not configured' });

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/sam_users?select=uid,email,name,tier,voice_calibrated,last_seen&order=last_seen.desc&limit=50`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const users = await r.json();
    return res.status(200).json({ users: users || [], count: users?.length || 0 });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
