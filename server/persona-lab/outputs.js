// api/persona-lab/outputs.js
// Persona Lab v0 — paginated output history.
// Per PERSONA_LAB_v0_HANDOFF.md §4.3.
//
//   GET /api/persona-lab/outputs?email=...&limit=20&before=<iso>
//
// Returns the most recent outputs for the requesting user.
// limit clamped to 1..50 (default 20). 'before' is a created_at cursor.

const { assertPersonaLabUser } = require('../_lab_access');

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
  const gate = await assertPersonaLabUser(req, res, { email });
  if (!gate.ok) return;

  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'not_configured' });

  let limit = parseInt(req.query.limit, 10);
  if (Number.isNaN(limit)) limit = 20;
  limit = Math.max(1, Math.min(50, limit));

  const before = (req.query.before || '').toString();

  try {
    const enc = encodeURIComponent(gate.email);
    let url = `${SUPABASE_URL}/rest/v1/sam_persona_lab_outputs?user_email=eq.${enc}` +
      `&select=id,moment,channel,fidelity,loop_type,intent,title,used_fragments,selection_mode,metadata,created_at` +
      `&order=created_at.desc&limit=${limit}`;
    if (before) {
      url += `&created_at=lt.${encodeURIComponent(before)}`;
    }
    const r = await fetch(url, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
    if (!r.ok) return res.status(500).json({ error: 'db_error' });
    const rows = await r.json();
    const items = Array.isArray(rows) ? rows : [];
    const nextCursor = items.length === limit ? items[items.length - 1].created_at : null;
    return res.status(200).json({ items, next: nextCursor });
  } catch (e) {
    console.error('[persona-lab/outputs] error:', e.message);
    return res.status(500).json({ error: 'db_error' });
  }
};
