// api/_gate.js — v9.113.1
// Voice DNA gate helper: auth + paid check, with founder/dev bypasses preserved.
// All compute-firing endpoints call checkGate() before any expensive work.

async function checkGate({ email, userId, tool, copyAnonymous, copyUnpaid }) {
  const e = (email || '').toString().trim().toLowerCase();
  const uid = (userId || '').toString();

  // Founder bypass — preserved from api/sam.js:37
  if (e === 'j.pirrone@yahoo.com') return { ok: true };
  // Dev bypass — preserved from api/sam.js:33
  if (uid && uid.startsWith('dev-')) return { ok: true };

  // Auth check
  if (!e || !e.includes('@') || uid === 'anon') {
    return {
      ok: false,
      status: 401,
      body: { error: 'auth_required', tool, message: copyAnonymous }
    };
  }

  // Paid check via @vercel/kv (same source stripe-webhook.js writes to)
  try {
    const { kv } = require('@vercel/kv');
    const user = await kv.get(`user:${e}`);
    if (!user || !user.paid) {
      return {
        ok: false,
        status: 402,
        body: { error: 'paid_required', tool, message: copyUnpaid }
      };
    }
  } catch (err) {
    // KV unavailable — fail closed (auth required)
    console.error('[gate] KV lookup failed:', err && err.message);
    return {
      ok: false,
      status: 401,
      body: { error: 'auth_required', tool, message: copyAnonymous }
    };
  }

  return { ok: true };
}

module.exports = { checkGate };
