// api/_supabase.js
// Supabase helper — used by all API routes

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function supabaseQuery(table, method, data = null, filters = null) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    if (filters) url += `?${filters}`;
    const opts = {
      method,
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'resolution=merge-duplicates' : 'return=minimal'
      }
    };
    if (data) opts.body = JSON.stringify(data);
    const r = await fetch(url, opts);
    if (!r.ok) {
      const err = await r.text();
      console.error(`Supabase ${method} ${table} error:`, err);
      return null;
    }
    try { return await r.json(); } catch { return true; }
  } catch(e) {
    console.error('Supabase error:', e.message);
    return null;
  }
}

// Upsert a user record
async function trackUser({ uid, email, name, tier, niche, platforms, voice_calibrated }) {
  return supabaseQuery('sam_users', 'POST', {
    uid, email, name, tier: tier || 'free',
    niche: niche || null,
    platforms: platforms || null,
    voice_calibrated: voice_calibrated || false,
    last_seen: new Date().toISOString()
  });
}

// Log an event
async function trackEvent(uid, event, data = {}) {
  return supabaseQuery('sam_events', 'POST', {
    uid, event, data,
    created_at: new Date().toISOString()
  });
}

// Record a signup
async function trackSignup({ email, name, tier, source }) {
  return supabaseQuery('sam_signups', 'POST', {
    email: email.toLowerCase(), name, tier: tier || 'free', source: source || 'waitlist',
    created_at: new Date().toISOString()
  });
}

// Get stats for HQ dashboard
async function getStats() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const [users, signups] = await Promise.all([
      supabaseQuery('sam_users', 'GET', null, 'select=tier'),
      supabaseQuery('sam_signups', 'GET', null, 'select=tier,created_at&order=created_at.desc&limit=100')
    ]);
    if (!users) return null;
    const counts = { total: users.length, free: 0, creator: 0, pro: 0, studio: 0 };
    users.forEach(u => { counts[u.tier] = (counts[u.tier] || 0) + 1; });
    const today = new Date().toISOString().split('T')[0];
    counts.today = (signups || []).filter(s => s.created_at.startsWith(today)).length;
    return counts;
  } catch(e) {
    console.error('Stats error:', e.message);
    return null;
  }
}

module.exports = { trackUser, trackEvent, trackSignup, getStats };

// Save voice profile and SAM context for a user
async function saveUserProfile(uid, { voice_profile, sam_context }) {
  if (!uid || uid === 'anon') return null;
  // PATCH updates existing row by uid
  return supabaseQuery('sam_users', 'PATCH', {
    voice_profile: voice_profile || null,
    sam_context: sam_context || null,
    voice_calibrated: voice_profile ? true : false,
    last_seen: new Date().toISOString()
  }, `uid=eq.${encodeURIComponent(uid)}`);
}

// Update email for an existing user by uid
async function updateUserEmail(uid, email, name) {
  if (!uid || uid === 'anon' || !email) return null;
  return supabaseQuery('sam_users', 'PATCH', {
    email: email.toLowerCase(),
    name: name || null,
    last_seen: new Date().toISOString()
  }, `uid=eq.${encodeURIComponent(uid)}`);
}

// Get voice profile and SAM context for a user
async function getUserProfile(uid) {
  if (!uid || uid === 'anon') return null;
  const result = await supabaseQuery('sam_users', 'GET', null, `uid=eq.${uid}&select=voice_profile,sam_context,name,niche,platforms,tier`);
  if (!result || !result.length) return null;
  return result[0];
}

module.exports = { trackUser, trackEvent, trackSignup, getStats, saveUserProfile, getUserProfile, updateUserEmail };
