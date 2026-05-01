// api/all-users.js
// Returns all users from Supabase sam_users + Vercel KV
// RLS policy "Allow public read" must be enabled on sam_users

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // v9.113.1 — admin lock
  const _adminSecret = req.headers['x-admin-secret'];
  if (!process.env.ADMIN_SECRET || !_adminSecret || _adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  try {
    // Read all users from sam_users (RLS now allows public read)
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/sam_users?select=uid,email,name,tier,voice_calibrated,last_seen,created_at&order=last_seen.desc&limit=200`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const rows = r.ok ? await r.json() : [];

    // Map to standard format, filter to only rows with email
    const withEmail = rows.filter(u => u.email);
    const users = withEmail.map(u => ({
      email: u.email,
      name: u.name || '',
      tier: u.tier || 'free',
      source: 'app',
      paid: u.tier === 'pro' || u.tier === 'studio' || u.tier === 'creator',
      signedUpAt: u.created_at,
      lastSeen: u.last_seen,
      voiceCalibrated: u.voice_calibrated || false,
    }));

    // Also pull KV users for any not in Supabase
    let kvUsers = [];
    try {
      const { kv } = require('@vercel/kv');
      let cursor = 0;
      do {
        const [next, keys] = await kv.scan(cursor, { match: 'user:*', count: 100 });
        cursor = next;
        if (keys.length > 0) {
          const vals = await Promise.all(keys.map(k => kv.get(k)));
          vals.forEach(v => { if (v && v.email) kvUsers.push(v); });
        }
      } while (cursor !== 0);
    } catch(e) {}

    // Merge KV users not already in Supabase
    const emailSet = new Set(users.map(u => u.email.toLowerCase()));
    kvUsers.forEach(u => {
      if (u.email && !emailSet.has(u.email.toLowerCase())) {
        users.push({
          email: u.email,
          name: u.name || '',
          tier: u.tier || 'free',
          source: 'auth',
          paid: u.paid || false,
          signedUpAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
          lastSeen: u.updatedAt ? new Date(u.updatedAt).toISOString() : null,
          voiceCalibrated: false,
        });
      }
    });

    users.sort((a, b) => new Date(b.signedUpAt || 0) - new Date(a.signedUpAt || 0));

    return res.status(200).json({
      users,
      total: users.length,
      supabaseTotal: rows.length,
      withEmail: withEmail.length,
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
