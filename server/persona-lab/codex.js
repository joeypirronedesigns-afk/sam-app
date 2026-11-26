// api/persona-lab/codex.js
// Persona Lab — codex read/write.
//
//   GET  /api/persona-lab/codex?email=...
//   POST /api/persona-lab/codex
//        body: { email, codex }
//
// v9.117.0 (C2) — Archivist persists user-built codex through this endpoint.
// Auth gate is "authenticated SAM user" (not lab_access). Anonymous → 404.
//
// On GET: returns { codex, codex_version, created_at, updated_at } or 404
//   if the row does not exist. Front-end treats 404 as "no codex yet" and
//   sends the user into Archivist build flow.
//
// On POST: upserts the codex row for the authenticated user. The full
//   persona_codex JSON is replaced with the body — Archivist is responsible
//   for preserving any fields it does not understand (round-trip safety).
//   codex_version is incremented on every successful POST.

const { assertPersonaLabUser } = require('../_lab_access');
const { BANNED_PHRASES, BANNED_PHRASES_VERSION } = require('./banned_phrases_v1');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function loadRow(email) {
  const enc = encodeURIComponent(email);
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/sam_persona_lab?user_email=eq.${enc}&select=persona_codex,codex_version,created_at,updated_at&limit=1`,
    { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
  );
  if (!r.ok) return { error: 'db_error' };
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) return { row: null };
  return { row: rows[0] };
}

async function upsertRow(email, codex, currentVersion) {
  const nextVersion = (currentVersion || 0) + 1;
  const enc = encodeURIComponent(email);

  // Try update first.
  const updateR = await fetch(
    `${SUPABASE_URL}/rest/v1/sam_persona_lab?user_email=eq.${enc}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        persona_codex: codex,
        codex_version: nextVersion,
        updated_at: new Date().toISOString()
      })
    }
  );
  if (!updateR.ok) {
    const body = await updateR.text();
    return { error: 'db_error', detail: body.slice(0, 300) };
  }
  const arr = await updateR.json();
  if (Array.isArray(arr) && arr.length) {
    return { row: arr[0] };
  }

  // No row — insert one.
  const insertR = await fetch(
    `${SUPABASE_URL}/rest/v1/sam_persona_lab`,
    {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        user_email: email,
        persona_codex: codex,
        codex_version: 1
      })
    }
  );
  if (!insertR.ok) {
    const body = await insertR.text();
    return { error: 'db_error', detail: body.slice(0, 300) };
  }
  const ins = await insertR.json();
  return { row: Array.isArray(ins) ? ins[0] : ins };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'not_configured' });

  if (req.method === 'GET') {
    const email = (req.query && req.query.email ? req.query.email : '').toString().trim().toLowerCase();
    const gate = await assertPersonaLabUser(req, res, { email });
    if (!gate.ok) return;

    const result = await loadRow(gate.email);
    if (result.error) return res.status(500).json({ error: result.error });
    if (!result.row) {
      // Authed user, no codex yet — Archivist needs the defaults to seed
      // the Banned Phrases starter list. Returning 404 with defaults is a
      // small contract bend, but it saves a second round-trip on first
      // load and the body keys are unambiguous.
      return res.status(404).json({
        error: 'codex_not_seeded',
        defaults: {
          banned_phrases: BANNED_PHRASES,
          banned_phrases_version: BANNED_PHRASES_VERSION
        }
      });
    }
    const row = result.row;
    return res.status(200).json({
      codex: row.persona_codex,
      codex_version: row.codex_version,
      created_at: row.created_at,
      updated_at: row.updated_at,
      defaults: {
        banned_phrases: BANNED_PHRASES,
        banned_phrases_version: BANNED_PHRASES_VERSION
      }
    });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const email = (body.email || '').toString().trim().toLowerCase();
    const gate = await assertPersonaLabUser(req, res, { email });
    if (!gate.ok) return;

    const codex = body.codex;
    if (!codex || typeof codex !== 'object' || Array.isArray(codex)) {
      return res.status(400).json({ error: 'codex_required' });
    }

    // Soft size guard — keep payloads sane.
    let serialized;
    try {
      serialized = JSON.stringify(codex);
    } catch (e) {
      return res.status(400).json({ error: 'codex_not_serializable' });
    }
    if (serialized.length > 1_000_000) {
      return res.status(413).json({ error: 'codex_too_large' });
    }

    const existing = await loadRow(gate.email);
    const currentVersion = existing.row ? existing.row.codex_version || 0 : 0;
    const result = await upsertRow(gate.email, codex, currentVersion);
    if (result.error) return res.status(500).json({ error: result.error, detail: result.detail });

    const row = result.row || {};
    return res.status(200).json({
      codex: row.persona_codex || codex,
      codex_version: row.codex_version || (currentVersion + 1),
      created_at: row.created_at,
      updated_at: row.updated_at
    });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};
