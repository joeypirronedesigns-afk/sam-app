// api/telemetry.js
// v9.118 T1 — server sink for [<surface>:telemetry] events.
// Fire-and-forget endpoint. Never throws back to the client.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Service-role headers bypass RLS. Telemetry table has RLS enabled with no
// policies, so this is the only path data can land. We use raw fetch against
// the Supabase REST API to match the convention in api/memory.js (the repo
// does not depend on @supabase/supabase-js).
const serviceHeaders = SUPABASE_SERVICE_ROLE_KEY
  ? {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    }
  : null;

// Cap payload sizes defensively. A misbehaving client should never blow up
// our telemetry table.
const MAX_EVENT_LEN = 200;
const MAX_FIELDS_BYTES = 8 * 1024; // 8 KB
const MAX_CLIENT_VERSION_LEN = 64;
const MAX_EMAIL_LEN = 320;
const MAX_USER_AGENT_LEN = 512;

function truncate(value, max) {
  if (typeof value !== 'string') return null;
  return value.length > max ? value.slice(0, max) : value;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  // Always 200, even on bad input. Telemetry must never cause client errors.
  try {
    if (!SUPABASE_URL || !serviceHeaders) {
      console.error('[telemetry:not_configured]');
      return res.status(200).json({ ok: true, recorded: false });
    }

    const body = req.body || {};
    const event = truncate(body.event, MAX_EVENT_LEN);

    if (!event) {
      return res.status(200).json({ ok: true, recorded: false });
    }

    let fieldsJson = {};
    if (body.fields && typeof body.fields === 'object') {
      try {
        const serialized = JSON.stringify(body.fields);
        if (serialized.length <= MAX_FIELDS_BYTES) {
          fieldsJson = body.fields;
        } else {
          fieldsJson = { _truncated: true, _bytes: serialized.length };
        }
      } catch (_e) {
        fieldsJson = { _serialize_error: true };
      }
    }

    const email = truncate(body.email, MAX_EMAIL_LEN);
    const clientVersion = truncate(body.clientVersion, MAX_CLIENT_VERSION_LEN);
    const userAgent = truncate(req.headers['user-agent'], MAX_USER_AGENT_LEN);

    const r = await fetch(`${SUPABASE_URL}/rest/v1/sam_telemetry`, {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify({
        email: email ? email.toLowerCase() : null,
        event,
        fields: fieldsJson,
        client_version: clientVersion,
        user_agent: userAgent
      })
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      console.error('[telemetry:insert_error]', r.status, errText);
      return res.status(200).json({ ok: true, recorded: false });
    }

    return res.status(200).json({ ok: true, recorded: true });
  } catch (e) {
    console.error('[telemetry:handler_error]', (e && e.message) || e);
    return res.status(200).json({ ok: true, recorded: false });
  }
};
