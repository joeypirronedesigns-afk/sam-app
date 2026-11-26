// api/_gate.js — v9.113.3
// Voice DNA gate helper: auth + paid check, with founder/dev bypasses preserved.
// All compute-firing endpoints call checkGate() before any expensive work.
//
// Response body shape (v9.113.3):
//   { error, tool, descriptor, cta }
// Frontend reads tool + descriptor + cta and renders the locked-state component.

const { getSessionEmail, enforcing } = require('./_session');

async function checkGate({
  req,
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

  // Patch AA — identity comes from the server-issued session cookie, not the request body.
  // Soft mode (SAM_GATE_ENFORCE unset): cookie wins when present; otherwise the old body
  // identity is used and logged. Enforce mode: no cookie = signed out.
  const _sessionEmail = req ? await getSessionEmail(req) : null;
  const _enforce = enforcing();
  if (_sessionEmail) {
    e = _sessionEmail;
  } else if (_enforce) {
    e = '';
  } else if (e || uid) {
    console.warn('[gate] legacy identity (no session cookie):', e || uid, '-', tool);
  }

  // Founder bypass — in enforce mode this only applies to a verified founder session.
  if (e === 'j.pirrone@yahoo.com') return { ok: true, email: e, verified: !!_sessionEmail };
  // Dev bypass — never in production once enforcing.
  if (uid && uid.startsWith('dev-') && !(_enforce && process.env.VERCEL_ENV === 'production')) return { ok: true, email: e || uid, verified: false };

  // Auth check
  if (!e || !e.includes('@') || (!_sessionEmail && uid === 'anon')) {
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

  return { ok: true, email: e, verified: !!_sessionEmail };
}

module.exports = { checkGate };
