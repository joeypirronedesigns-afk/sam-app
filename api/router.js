// Hobby plan (12-function limit): one function serves every /api route except
// sam, pdf, stripe-webhook and stats. vercel.json rewrites /api/<path> to /api/router?__path=<path>.
// Each handler still lives unchanged in server/. Static requires so Vercel bundles every route.
const ROUTES = {
  'all-users': () => require('../server/all-users.js'),
  'analytics-insight': () => require('../server/analytics-insight.js'),
  'attribution': () => require('../server/attribution.js'),
  'auth': () => require('../server/auth.js'),
  'billing-portal': () => require('../server/billing-portal.js'),
  'brief-outcome': () => require('../server/brief-outcome.js'),
  'daily-brief': () => require('../server/daily-brief.js'),
  'ear': () => require('../server/ear.js'),
  'ear-signals': () => require('../server/ear-signals.js'),
  'elevenlabs': () => require('../server/elevenlabs.js'),
  'email-token': () => require('../server/email-token.js'),
  'email/forward': () => require('../server/email/forward.js'),
  'generate-email': () => require('../server/generate-email.js'),
  'keepalive': () => require('../server/keepalive.js'),
  'me': () => require('../server/me.js'),
  'memory': () => require('../server/memory.js'),
  'outreach-daily': () => require('../server/outreach-daily.js'),
  'outreach-reddit': () => require('../server/outreach-reddit.js'),
  'outreach-youtube': () => require('../server/outreach-youtube.js'),
  'persona-lab/codex': () => require('../server/persona-lab/codex.js'),
  'persona-lab/compose': () => require('../server/persona-lab/compose.js'),
  'persona-lab/output': () => require('../server/persona-lab/output/[id].js'),
  'persona-lab/outputs': () => require('../server/persona-lab/outputs.js'),
  'pulse-context': () => require('../server/pulse-context.js'),
  'reach': () => require('../server/reach.js'),
  'reach-status': () => require('../server/reach-status.js'),
  'story-engine-save': () => require('../server/story-engine-save.js'),
  'story-engine-status': () => require('../server/story-engine-status.js'),
  'stripe-checkout': () => require('../server/stripe-checkout.js'),
  'telemetry': () => require('../server/telemetry.js'),
  'tool-context': () => require('../server/tool-context.js'),
  'trial-status': () => require('../server/trial-status.js'),
  'users': () => require('../server/users.js'),
  'voice': () => require('../server/voice.js'),
  'voice-status': () => require('../server/voice-status.js'),
  'voice-trainer': () => require('../server/voice-trainer.js'),
  'waitlist': () => require('../server/waitlist.js'),
  'wizard-save': () => require('../server/wizard-save.js')
};

module.exports = async function router(req, res) {
  const q = req.query || (req.query = {});
  let p = String(Array.isArray(q.__path) ? q.__path.join('/') : (q.__path || '')).replace(/^\/+|\/+$/g, '');
  delete q.__path;
  let key = p;
  const m = p.match(/^persona-lab\/output\/([^/]+)$/);
  if (m) { key = 'persona-lab/output'; if (!q.id) q.id = decodeURIComponent(m[1]); }
  const load = ROUTES[key];
  if (!load) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not found' }));
  }
  return load()(req, res);
};
