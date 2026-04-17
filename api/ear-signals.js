// api/ear-signals.js
// CRUD for the Signals tab in SAM HQ.
// GET  → list signals with filtering/sorting
// POST → { action, id, value?, note? } → update that row
//
// Env vars: SUPABASE_URL, SUPABASE_ANON_KEY

module.exports.config = { api: { bodyParser: { sizeLimit: '1mb' } } };

const { supabaseQuery } = require('./_supabase');

const SELECT_COLS = 'id,subreddit,post_url,post_title,post_author,post_score,post_comments,post_created,total_score,emotional_honesty,voice_pain,ai_involvement,sam_fit,vulnerability,key_quote,one_line_why,starred,dismissed,notes,times_used,last_used_at,created_at';

async function listSignals(params) {
  const limit    = Math.min(parseInt(params.limit, 10) || 50, 200);
  const view     = params.view || 'all';
  const sort     = params.sort || 'score';
  const minScore = parseInt(params.min_score, 10) || 28;
  const days     = parseInt(params.days, 10);

  const parts = [
    `select=${SELECT_COLS}`,
    `limit=${limit}`,
    `total_score=gte.${minScore}`,
  ];

  if (view === 'starred')        parts.push('starred=eq.true',   'dismissed=eq.false');
  else if (view === 'dismissed') parts.push('dismissed=eq.true');
  else                           parts.push('dismissed=eq.false');

  if (days) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    parts.push(`post_created=gte.${since}`);
  }

  const orderBy =
    sort === 'recent' ? 'created_at.desc' :
    sort === 'voice'  ? 'voice_pain.desc' :
    sort === 'fit'    ? 'sam_fit.desc' :
                        'total_score.desc';
  parts.push(`order=${orderBy}`);

  return supabaseQuery('ear_signals', 'GET', null, parts.join('&'));
}

async function updateSignal(id, patch) {
  return supabaseQuery(
    'ear_signals',
    'PATCH',
    { ...patch, updated_at: new Date().toISOString() },
    `id=eq.${encodeURIComponent(id)}`,
  );
}

module.exports = async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');

  try {
    if (req.method === 'GET') {
      const signals = (await listSignals(req.query || {})) || [];
      return res.status(200).json({ ok: true, count: signals.length, signals });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { action, id, value, note } = body;
      if (!id) return res.status(400).json({ error: 'id required' });

      let patch = {};
      if (action === 'star')         patch.starred   = value !== false;
      else if (action === 'unstar')  patch.starred   = false;
      else if (action === 'dismiss') patch.dismissed = value !== false;
      else if (action === 'restore') patch.dismissed = false;
      else if (action === 'note')    patch.notes     = note || '';
      else return res.status(400).json({ error: 'unknown action' });

      await updateSignal(id, patch);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
