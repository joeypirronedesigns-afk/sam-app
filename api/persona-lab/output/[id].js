// api/persona-lab/output/[id].js
// Persona Lab v0 — single output detail.
// Per PERSONA_LAB_v0_HANDOFF.md §4.4.
//
//   GET /api/persona-lab/output/{id}?email=...
//
// Owner-scoped: if the row's user_email does not match the requesting
// (and lab-flagged) email, returns 404 — never confirms the row exists
// for someone else.

const { assertLabAccess } = require('../../_lab_access');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const email = (req.query && req.query.email ? req.query.email : '').toString().trim().toLowerCase();
  const gate = await assertLabAccess(req, res, { email });
  if (!gate.ok) return;

  const id = (req.query && req.query.id ? req.query.id : '').toString();
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'not_found' });

  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'not_configured' });

  try {
    const enc = encodeURIComponent(gate.email);
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/sam_persona_lab_outputs?id=eq.${encodeURIComponent(id)}&user_email=eq.${enc}&limit=1`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    );
    if (!r.ok) return res.status(500).json({ error: 'db_error' });
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) return res.status(404).json({ error: 'not_found' });
    return res.status(200).json({ output: rows[0] });
  } catch (e) {
    console.error('[persona-lab/output/:id] error:', e.message);
    return res.status(500).json({ error: 'db_error' });
  }
};
