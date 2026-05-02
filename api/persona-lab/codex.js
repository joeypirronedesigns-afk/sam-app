// api/persona-lab/codex.js
// Persona Lab v0 — read-only codex fetch.
// Per PERSONA_LAB_v0_HANDOFF.md §4.2.
//
//   GET /api/persona-lab/codex?email=...
//
// Returns the current user's persona_codex JSON. lab_access gate.
// 404 anon, 403 unflagged, 200 otherwise. 404 again if codex not seeded
// (so non-flagged users and seedless flagged users look identical from
// outside — they don't, but there's no info to leak either way).

const { assertLabAccess } = require('../_lab_access');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'not_configured' });

  try {
    const enc = encodeURIComponent(gate.email);
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/sam_persona_lab?user_email=eq.${enc}&select=persona_codex,codex_version,created_at,updated_at&limit=1`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    );
    if (!r.ok) return res.status(500).json({ error: 'db_error' });
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) return res.status(404).json({ error: 'codex_not_seeded' });
    const row = rows[0];
    return res.status(200).json({
      codex: row.persona_codex,
      codex_version: row.codex_version,
      created_at: row.created_at,
      updated_at: row.updated_at
    });
  } catch (e) {
    console.error('[persona-lab/codex] error:', e.message);
    return res.status(500).json({ error: 'db_error' });
  }
};
