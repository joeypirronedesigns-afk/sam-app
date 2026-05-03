// api/_gate.js — v9.113.3
// Voice DNA gate helper: auth + paid check, with founder/dev bypasses preserved.
// All compute-firing endpoints call checkGate() before any expensive work.
//
// Response body shape (v9.113.3):
//   { error, tool, descriptor, cta }
// Frontend reads tool + descriptor + cta and renders the locked-state component.

async function checkGate({
  email,
  userId,
  tool,
  descriptor,
  ctaAnonymous,
  ctaUnpaid,
  // legacy aliases — old call sites still passing these will continue to work
  copyAnonymous,
  copyUnpaid
}) {
  let e = (email || '').toString().trim().toLowerCase();
  const uid = (userId || '').toString();
  const _ctaAnon = ctaAnonymous || copyAnonymous || '';
  const _ctaUnpaid = ctaUnpaid || copyUnpaid || '';

  // v9.116.4 — legacy callers (callAPI/getBase, wizard reflections, regen paths)
  // pass identity as userId rather than email. If we have a clearly-email-shaped
  // userId and no explicit email, treat the userId as the email so the gate can
  // run founder/paid checks instead of failing closed at the auth step.
  if (!e && uid && uid.includes('@')) {
    e = uid.toLowerCase();
  }

  // Founder bypass — preserved from api/sam.js:37
  if (e === 'j.pirrone@yahoo.com') return { ok: true };
  // Dev bypass — preserved from api/sam.js:33
  if (uid && uid.startsWith('dev-')) return { ok: true };

  // Auth check
  if (!e || !e.includes('@') || uid === 'anon') {
    return {
      ok: false,
      status: 401,
      body: {
        error: 'auth_required',
        tool,
        descriptor: descriptor || '',
        cta: _ctaAnon
      }
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
        body: {
          error: 'paid_required',
          tool,
          descriptor: descriptor || '',
          cta: _ctaUnpaid
        }
      };
    }
  } catch (err) {
    // KV unavailable — fail closed (auth required)
    console.error('[gate] KV lookup failed:', err && err.message);
    return {
      ok: false,
      status: 401,
      body: {
        error: 'auth_required',
        tool,
        descriptor: descriptor || '',
        cta: _ctaAnon
      }
    };
  }

  return { ok: true };
}

module.exports = { checkGate };
