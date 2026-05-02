// api/_lab_access.js
// Persona Lab v0 — allowlist gate.
// Per PERSONA_LAB_v0_HANDOFF.md §11 critical rules:
//   - lab_access = false users get 403, not 401 (they're authed; 401 leaks info).
//   - Anonymous users see 404 (Lab existence is not advertised).
//
// All Persona Lab endpoints MUST call assertLabAccess() before any other work.
// Returns { ok: true, email } on pass; on fail, writes the response and
// returns { ok: false } so the caller can early-return.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function _isLabAllowed(email) {
  if (!email || !email.includes('@')) return false;
  if (!SUPABASE_URL || !SERVICE_KEY) return false;
  try {
    const enc = encodeURIComponent(email.toLowerCase());
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/sam_users?email=eq.${enc}&select=lab_access&limit=1`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    );
    if (!r.ok) return false;
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) return false;
    return rows[0].lab_access === true;
  } catch (e) {
    console.error('[lab_access] lookup error:', e.message);
    return false;
  }
}

// assertLabAccess(req, res, { email })
//   - If email is missing/anonymous: 404, do not reveal Lab existence.
//   - If email is authed but lab_access = false: 403.
//   - If lab_access = true: returns { ok: true, email: lower }.
async function assertLabAccess(req, res, { email } = {}) {
  const e = (email || '').toString().trim().toLowerCase();

  if (!e || !e.includes('@')) {
    res.status(404).json({ error: 'not_found' });
    return { ok: false };
  }

  const allowed = await _isLabAllowed(e);
  if (!allowed) {
    res.status(403).json({ error: 'lab_access_required' });
    return { ok: false };
  }

  return { ok: true, email: e };
}

module.exports = { assertLabAccess };
