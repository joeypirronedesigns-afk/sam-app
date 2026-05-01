// api/analytics-insight.js
// Ingests analytics_insight objects from The Lens and saves them into sam_context v2 via _context.js

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const { loadUserContext, saveUserContext } = require('./_context');
const { checkGate } = require('./_gate');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, reason: 'method not allowed' });

  try {
    const { email, insight } = req.body || {};

    // v9.113.1 — Voice DNA gate (mapped to The Vision per brief PART A7)
    const _gate = await checkGate({
      email: email || '',
      userId: (req.body && req.body.userId) || 'anon',
      tool: 'The Vision',
      copyAnonymous: 'Sign in to use The Vision. SAM turns your metrics into "what to do next" — but only once she\'s attached to your account.',
      copyUnpaid: 'Subscribe to use The Vision. Turn noisy analytics into clear narrative and next steps — $39/month, every tool included, cancel anytime.'
    });
    if (!_gate.ok) return res.status(_gate.status).json(_gate.body);

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(200).json({ ok: false, reason: 'invalid email' });
    }
    if (!insight || typeof insight !== 'object' || insight.type !== 'analytics_insight') {
      return res.status(200).json({ ok: false, reason: 'invalid insight' });
    }
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(200).json({ ok: false, reason: 'no config' });
    }

    const emailNorm = email.trim().toLowerCase();
    const { ctx: brain, uid } = await loadUserContext(emailNorm);
    if (!uid) return res.status(200).json({ ok: false, reason: 'user not found' });

    const ctx = brain || {};
    if (!ctx.analytics) ctx.analytics = { insights: [], latestAt: null };

    const insights = Array.isArray(ctx.analytics.insights) ? ctx.analytics.insights.slice() : [];
    insights.unshift(insight);
    ctx.analytics.insights = insights.slice(0, 10);
    ctx.analytics.latestAt = insight.createdAt || new Date().toISOString();

    const ok = await saveUserContext(emailNorm, ctx, uid);
    return res.status(200).json({ ok });
  } catch (e) {
    console.error('[analytics-insight] error:', e && e.message);
    return res.status(200).json({ ok: false, reason: 'server error' });
  }
};
