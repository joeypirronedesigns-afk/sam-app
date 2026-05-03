// api/_lab_access.js
// Persona Lab gates.
//
// v0 (legacy) used `lab_access` as the only gate. v9.117.0 (C2) opens
// Persona Lab to any authenticated SAM user — eligibility for Composer
// is re-checked downstream against canon-event count (>= 3). lab_access
// stays in the database but is no longer the primary route gate.
//
// Anonymous users still see 404. Lab existence is not advertised to
// non-authenticated visitors.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function _lookupUser(email) {
  if (!email || !email.includes('@')) return null;
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  try {
    const enc = encodeURIComponent(email.toLowerCase());
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/sam_users?email=eq.${enc}&select=email,lab_access&limit=1`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) return null;
    return rows[0];
  } catch (e) {
    console.error('[lab_access] lookup error:', e.message);
    return null;
  }
}

// assertLabAccess (legacy, lab_access required)
//   - If email is missing/anonymous: 404, do not reveal Lab existence.
//   - If email is authed but lab_access = false: 403.
//   - If lab_access = true: returns { ok: true, email: lower }.
async function assertLabAccess(req, res, { email } = {}) {
  const e = (email || '').toString().trim().toLowerCase();
  if (!e || !e.includes('@')) {
    res.status(404).json({ error: 'not_found' });
    return { ok: false };
  }
  const row = await _lookupUser(e);
  if (!row || row.lab_access !== true) {
    res.status(403).json({ error: 'lab_access_required' });
    return { ok: false };
  }
  return { ok: true, email: e };
}

// assertPersonaLabUser (v9.117.0 / C2)
//   Authenticated SAM users only. lab_access not required.
//   - Missing/invalid email or email not in sam_users: 404 (concealment).
//   - Otherwise: { ok: true, email: lower, hasLabAccess: bool }.
async function assertPersonaLabUser(req, res, { email } = {}) {
  const e = (email || '').toString().trim().toLowerCase();
  if (!e || !e.includes('@')) {
    res.status(404).json({ error: 'not_found' });
    return { ok: false };
  }
  const row = await _lookupUser(e);
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return { ok: false };
  }
  return { ok: true, email: e, hasLabAccess: row.lab_access === true };
}

module.exports = { assertLabAccess, assertPersonaLabUser };
