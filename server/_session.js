// api/_session.js — Patch AA
// Server-issued login sessions. Before this, every API trusted whatever email/userId the
// browser put in the request body, so anyone could claim the founder email (or a 'dev-' id)
// and run SAM on the Anthropic key, or mark themselves paid.
//
// Now: when a magic link is verified, the server creates a random session token, stores
// auth:<token> -> { email } in KV for 30 days, and sets it as an HttpOnly cookie. The browser
// sends the cookie automatically with every same-origin request; page scripts can't read it.
// The gate trusts the cookie's email, never the request body.
//
// Rollout: SAM_GATE_ENFORCE unset = "soft" (cookie wins when present; requests without one
// still use the old body identity, logged as [gate] legacy). SAM_GATE_ENFORCE=1 = cookie required.

const crypto = require('crypto');

const COOKIE = 'sam_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function _kv() { return require('@vercel/kv').kv; }

function readToken(req) {
  const raw = (req && req.headers && req.headers.cookie) || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === COOKIE) {
      const v = part.slice(i + 1).trim();
      return /^[a-f0-9]{64}$/.test(v) ? v : null;
    }
  }
  return null;
}

function cookieHeader(token, maxAge) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function createSession(res, email) {
  const token = crypto.randomBytes(32).toString('hex');
  await _kv().set(`auth:${token}`, { email: String(email).toLowerCase(), createdAt: Date.now() }, { ex: MAX_AGE });
  res.setHeader('Set-Cookie', cookieHeader(token, MAX_AGE));
  return token;
}

async function getSessionEmail(req) {
  const token = readToken(req);
  if (!token) return null;
  try {
    const s = await _kv().get(`auth:${token}`);
    return s && s.email ? String(s.email).toLowerCase() : null;
  } catch (e) {
    console.error('[session] lookup failed:', e && e.message);
    return null;
  }
}

async function destroySession(req, res) {
  const token = readToken(req);
  if (token) { try { await _kv().del(`auth:${token}`); } catch (_) {} }
  res.setHeader('Set-Cookie', cookieHeader('', 0));
}

const enforcing = () => process.env.SAM_GATE_ENFORCE === '1';

// Resolve who is calling. Cookie wins. Without a cookie: in soft mode, fall back to the
// claimed email (logged); in enforce mode, nobody.
async function resolveIdentity(req, claimedEmail) {
  const sessionEmail = await getSessionEmail(req);
  if (sessionEmail) return { email: sessionEmail, verified: true };
  const claimed = (claimedEmail || '').toString().trim().toLowerCase();
  if (enforcing()) return { email: null, verified: false };
  if (claimed) console.warn('[gate] legacy identity (no session cookie):', claimed);
  return { email: claimed || null, verified: false };
}

module.exports = { COOKIE, readToken, createSession, getSessionEmail, destroySession, resolveIdentity, enforcing };
