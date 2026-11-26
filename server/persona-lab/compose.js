// api/persona-lab/compose.js
// Persona Lab v0 — Composer endpoint.
// Per PERSONA_LAB_v0_HANDOFF.md §4.1 and §11 critical rules.
//
//   POST /api/persona-lab/compose
//
// Auth: requires authenticated email AND sam_users.lab_access = true.
//   - Anonymous requests → 404 (Lab existence not advertised).
//   - Authed but not flagged → 403.
//
// Hard guarantees enforced here (never relax without bumping system prompt
// version and updating the brief):
//   - N1: samContext is read via getSamContextSnapshot — read-only deep clone.
//   - N2: every output row is saved with full provenance (model, version,
//         codex_version, banned_phrases_version, system_prompt_version,
//         temperature, selection_mode).
//   - N3: fidelity grounding rule lives in the system prompt template
//         (prompts/persona_compose_v0_1.md). Categorical, not soft.

const fs = require('fs');
const path = require('path');
const { getSamContextSnapshot } = require('../_context');
const { assertPersonaLabUser } = require('../_lab_access');
const { BANNED_PHRASES, BANNED_PHRASES_VERSION } = require('./banned_phrases_v1');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT_VERSION = 'v0.1';
const SYSTEM_PROMPT_PATH = path.join(__dirname, '..', '..', 'prompts', 'persona_compose_v0_1.md');

const DEFAULT_MODEL = 'claude-opus-4-7';
const DEFAULT_TEMPERATURE = 0.85;
const DEFAULT_MAX_TOKENS = 600;
const MONOLOGUE_MAX_TOKENS = 1200;

const VALID_CHANNELS = ['caption', 'post', 'thread', 'monologue', 'script', 'other'];
const VALID_LOOPS = ['simple', 'nested', 'unclosed'];
const VALID_INTENTS = ['announce', 'reflect', 'provoke', 'process', 'mythologize'];

let _systemPromptTemplate = null;
function loadSystemPromptTemplate() {
  if (_systemPromptTemplate) return _systemPromptTemplate;
  _systemPromptTemplate = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf8');
  return _systemPromptTemplate;
}

async function loadCodexRow(email) {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  const enc = encodeURIComponent(email);
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/sam_persona_lab?user_email=eq.${enc}&select=persona_codex,voice_profile_override,codex_version&limit=1`,
    { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
  );
  if (!r.ok) return null;
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows[0];
}

async function loadUserVoiceProfile(email) {
  if (!SUPABASE_URL || !SERVICE_KEY) return { profile: null, version: 0 };
  const enc = encodeURIComponent(email);
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/sam_users?email=eq.${enc}&select=voice_profile,voice_version&order=last_seen.desc.nullslast&limit=1`,
    { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
  );
  if (!r.ok) return { profile: null, version: 0 };
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) return { profile: null, version: 0 };
  return { profile: rows[0].voice_profile || null, version: rows[0].voice_version || 0 };
}

async function saveOutputRow(payload) {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/sam_persona_lab_outputs`,
    {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    }
  );
  if (!r.ok) {
    console.error('[persona-lab/compose] save row failed:', await r.text());
    return null;
  }
  const arr = await r.json();
  return Array.isArray(arr) ? arr[0] : arr;
}

function clampInt(n, min, max, fallback) {
  const v = parseInt(n, 10);
  if (Number.isNaN(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

function buildBannedPhrasesList(codex) {
  const fromV1 = (codex && Array.isArray(codex.banned_phrases)) ? codex.banned_phrases : null;
  const fromV0 = (codex && codex.voice_profile_seeds && Array.isArray(codex.voice_profile_seeds.banned_phrases))
    ? codex.voice_profile_seeds.banned_phrases : null;
  const fromCodex = fromV1 || fromV0 || [];
  const set = new Set();
  BANNED_PHRASES.forEach(p => set.add(p));
  fromCodex.forEach(p => { if (typeof p === 'string' && p.trim()) set.add(p.trim()); });
  return Array.from(set);
}

function getCanonEvents(codex) {
  const t = codex && codex.tiers;
  if (!t) return [];
  if (t.canonevents && Array.isArray(t.canonevents.events)) return t.canonevents.events;
  if (t.canon_events && Array.isArray(t.canon_events.events)) return t.canon_events.events;
  return [];
}

function summarizeSelectedFragments(selected, codex) {
  if (!Array.isArray(selected) || !selected.length) return 'model_select';
  const events = getCanonEvents(codex);
  const byId = {};
  events.forEach(e => { if (e && e.id) byId[e.id] = e; });
  const lines = selected.map(s => {
    const ev = byId[s.id];
    const role = (s.role || 'direct').toLowerCase();
    if (!ev) return '- ' + s.id + ' (' + role + '): [unknown id — not in codex]';
    return '- ' + s.id + ' (' + role + '): ' + (ev.title || '');
  });
  return lines.join('\n');
}

function fillTemplate(tpl, vars) {
  let out = tpl;
  Object.keys(vars).forEach(k => {
    const re = new RegExp('\\{\\{' + k + '\\}\\}', 'g');
    out = out.replace(re, vars[k]);
  });
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const body = req.body || {};
  const userEmail = (body.userEmail || body.email || '').toString().trim().toLowerCase();

  // v9.117.0 gate — any authenticated SAM user may compose, provided
  // their codex has the minimum canon-event count (re-checked below).
  const gate = await assertPersonaLabUser(req, res, { email: userEmail });
  if (!gate.ok) return;

  // Validate request body.
  const moment = typeof body.moment === 'string' ? body.moment.trim() : '';
  if (!moment) return res.status(400).json({ error: 'moment_required' });
  if (moment.length > 2000) return res.status(400).json({ error: 'moment_too_long', max: 2000 });

  const channel = VALID_CHANNELS.includes(body.channel) ? body.channel : 'post';
  const fidelity = clampInt(body.fidelity, 1, 7, 3);
  const loop_type = VALID_LOOPS.includes(body.loop_type) ? body.loop_type : 'simple';
  const intent = VALID_INTENTS.includes(body.intent) ? body.intent : null;
  const title = (body.title && typeof body.title === 'string') ? body.title.trim().slice(0, 200) : null;

  const selectionMode = (Array.isArray(body.selected_fragments) && body.selected_fragments.length)
    ? 'preselected' : 'model_selected';
  const preselected = selectionMode === 'preselected' ? body.selected_fragments : null;

  const requestedMaxTokens = clampInt(
    body.max_tokens,
    50,
    channel === 'monologue' ? MONOLOGUE_MAX_TOKENS : DEFAULT_MAX_TOKENS,
    channel === 'monologue' ? MONOLOGUE_MAX_TOKENS : DEFAULT_MAX_TOKENS
  );

  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'api_key_not_configured' });

  // Load codex (required to compose).
  const codexRow = await loadCodexRow(gate.email);
  if (!codexRow || !codexRow.persona_codex) {
    return res.status(409).json({ error: 'codex_not_seeded' });
  }
  const codex = codexRow.persona_codex;
  const codexVersion = codexRow.codex_version || 1;

  // C2 eligibility — Composer requires at least 3 canon events.
  const canonCount = getCanonEvents(codex).length;
  if (canonCount < 3) {
    return res.status(409).json({ error: 'composer_not_eligible', canon_events: canonCount, minimum: 3 });
  }

  // N1 — read-only snapshot adapter.
  const samSnapshot = await getSamContextSnapshot(gate.email);

  // Voice profile per v9.90 single source of truth (sam_users.voice_profile).
  // Codex-level voice_profile_override wins when present.
  const { profile: dbVoice } = await loadUserVoiceProfile(gate.email);
  const voiceProfile = (codexRow.voice_profile_override && typeof codexRow.voice_profile_override === 'object')
    ? JSON.stringify(codexRow.voice_profile_override, null, 2)
    : (dbVoice || '(none on file)');

  // Build banned phrases list (constant + codex-specific).
  const banned = buildBannedPhrasesList(codex);

  // Naming convention + do-not-use list.
  const dnu = (codex.do_not_use_list || {});
  const topicsOff = Array.isArray(dnu.topics_off_limits) ? dnu.topics_off_limits.join(', ') : '(none)';
  const peopleNever = Array.isArray(dnu.people_to_never_name) ? dnu.people_to_never_name.join(', ') : '(none)';
  const namingConvention = dnu.naming_convention || '(none)';
  const factsNever = Array.isArray(dnu.facts_to_never_invent) ? dnu.facts_to_never_invent.join('; ') : '(none)';

  const displayName = (codex.overview && codex.overview.display_name) || codex.display_name || '(unknown)';

  const tpl = loadSystemPromptTemplate();
  const systemPrompt = fillTemplate(tpl, {
    display_name: displayName,
    persona_codex_summary: JSON.stringify(codex, null, 2),
    voice_profile: typeof voiceProfile === 'string' ? voiceProfile : '(none)',
    samcontext_snapshot: JSON.stringify(samSnapshot, null, 2),
    selected_fragments: summarizeSelectedFragments(preselected, codex),
    moment,
    channel,
    fidelity: String(fidelity),
    loop_type,
    intent: intent || 'unspecified',
    banned_phrases: banned.map(p => '- ' + p).join('\n'),
    topics_off_limits: topicsOff,
    people_to_never_name: peopleNever,
    naming_convention: namingConvention,
    facts_to_never_invent: factsNever
  });

  // Anthropic call.
  const userMessage = 'Compose now. Output only the finished piece.';
  const t0 = Date.now();
  let modelVersionFromResponse = DEFAULT_MODEL;
  let draft = '';

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: requestedMaxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('[persona-lab/compose] anthropic error:', JSON.stringify(data).slice(0, 500));
      return res.status(502).json({ error: 'model_error', detail: data && data.error });
    }
    if (data.model) modelVersionFromResponse = data.model;
    if (Array.isArray(data.content)) {
      draft = data.content
        .filter(b => b && b.type === 'text' && typeof b.text === 'string')
        .map(b => b.text)
        .join('')
        .trim();
    }
  } catch (e) {
    console.error('[persona-lab/compose] fetch error:', e.message);
    return res.status(502).json({ error: 'model_error', detail: e.message });
  }

  if (!draft) return res.status(502).json({ error: 'empty_draft' });

  // Used fragments — only known with certainty when preselected.
  const usedFragments = preselected ? preselected.map(s => ({
    id: s.id,
    role: (s.role || 'direct').toLowerCase(),
    reason: s.reason || null
  })) : [];

  const metadata = {
    model: DEFAULT_MODEL,
    model_version: modelVersionFromResponse,
    codex_version: codexVersion,
    banned_phrases_version: BANNED_PHRASES_VERSION,
    temperature: null,
    system_prompt_version: SYSTEM_PROMPT_VERSION,
    selection_mode: selectionMode,
    snapshot_at: samSnapshot.lastSnapshotAt,
    request_ms: Date.now() - t0,
    max_tokens: requestedMaxTokens
  };

  const saved = await saveOutputRow({
    user_email: gate.email,
    moment,
    channel,
    fidelity,
    loop_type,
    intent,
    title,
    draft,
    used_fragments: usedFragments,
    used_persona_traits: [],
    selection_mode: selectionMode,
    metadata
  });

  return res.status(200).json({
    output_id: saved && saved.id ? saved.id : null,
    draft,
    used_fragments: usedFragments,
    used_persona_traits: [],
    fidelity,
    loop_type,
    intent,
    metadata
  });
};
