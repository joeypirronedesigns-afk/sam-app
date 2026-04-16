// api/all-users.js
// Returns all users from both Vercel KV and Supabase
// Used by SAM HQ users panel

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const results = {};

  // ── SOURCE 1: Vercel KV (auth.js stores users here) ──────────────────────
  try {
    const { kv } = require('@vercel/kv');
    // Scan all user: keys
    let cursor = 0;
    const kvUsers = [];
    do {
      const [nextCursor, keys] = await kv.scan(cursor, { match: 'user:*', count: 100 });
      cursor = nextCursor;
      if (keys.length > 0) {
        const values = await Promise.all(keys.map(k => kv.get(k)));
        values.forEach(v => { if (v && v.email) kvUsers.push(v); });
      }
    } while (cursor !== 0);

    kvUsers.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    results.kv = kvUsers;
  } catch(e) {
    results.kv = [];
    results.kvError = e.message;
  }

  // ── SOURCE 2: Supabase sam_signups ────────────────────────────────────────
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/sam_signups?select=*&order=created_at.desc&limit=200`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      results.supabase = r.ok ? await r.json() : [];
    }
  } catch(e) {
    results.supabase = [];
    results.supabaseError = e.message;
  }

  // ── MERGE: combine both sources, dedupe by email ──────────────────────────
  const emailMap = {};

  // Add Supabase signups first
  (results.supabase || []).forEach(s => {
    const email = (s.email || '').toLowerCase();
    if (!email) return;
    if (!emailMap[email]) {
      emailMap[email] = {
        email,
        name: s.name || '',
        tier: s.tier || 'free',
        source: s.source || 'waitlist',
        signedUpAt: s.created_at || null,
        lastSeen: s.created_at || null,
        paid: false,
        voiceCalibrated: false,
      };
    }
  });

  // Overlay KV data (more complete — has paid, tier, lastSeen)
  (results.kv || []).forEach(u => {
    const email = (u.email || '').toLowerCase();
    if (!email) return;
    if (emailMap[email]) {
      emailMap[email] = {
        ...emailMap[email],
        name: u.name || emailMap[email].name,
        tier: u.tier || emailMap[email].tier,
        paid: u.paid || false,
        lastSeen: u.updatedAt ? new Date(u.updatedAt).toISOString() : emailMap[email].lastSeen,
        signedUpAt: u.createdAt ? new Date(u.createdAt).toISOString() : emailMap[email].signedUpAt,
        trialStart: u.trialStart ? new Date(u.trialStart).toISOString() : null,
      };
    } else {
      emailMap[email] = {
        email,
        name: u.name || '',
        tier: u.tier || 'free',
        source: 'app',
        paid: u.paid || false,
        signedUpAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
        lastSeen: u.updatedAt ? new Date(u.updatedAt).toISOString() : null,
        trialStart: u.trialStart ? new Date(u.trialStart).toISOString() : null,
        voiceCalibrated: false,
      };
    }
  });

  const users = Object.values(emailMap).sort((a, b) => {
    return new Date(b.signedUpAt || 0) - new Date(a.signedUpAt || 0);
  });

  return res.status(200).json({
    users,
    total: users.length,
    kvCount: results.kv.length,
    supabaseCount: (results.supabase || []).length,
  });
};
