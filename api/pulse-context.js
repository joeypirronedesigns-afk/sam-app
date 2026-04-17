// api/pulse-context.js
// Returns the top ear signals as a ready-to-inject prompt block.
// The Pulse fetches this before drafting so its output is grounded in
// real creator language captured from Reddit.
//
// Env vars: SUPABASE_URL, SUPABASE_ANON_KEY
//
// Query params:
//   ?limit=15       max signals (default 15, cap 30)
//   ?min_score=30   threshold (default 30)
//   ?days=30        recency window in days (default 30)
//   ?format=block   'block' (default, string) or 'json' (array)

module.exports.config = { api: { bodyParser: { sizeLimit: '1mb' } } };

const { supabaseQuery } = require('./_supabase');

const SELECT_COLS = 'key_quote,one_line_why,total_score,voice_pain,ai_involvement,sam_fit,starred,post_url,subreddit,post_created';

function weightOf(sig) {
  let w = sig.total_score;
  if (sig.starred) w += 15;
  if (sig.post_created) {
    const ageDays = (Date.now() - new Date(sig.post_created).getTime()) / 86400000;
    w -= Math.min(ageDays * 0.3, 10);
  }
  return w;
}

function formatBlock(signals) {
  if (!signals.length) {
    return `[No real creator signals captured yet. Draft from the base SAM voice.]`;
  }
  const lines = [];
  lines.push(`REAL CREATOR VOICES — captured from Reddit this month.`);
  lines.push(`These are not prospects. These are the people whose pain you are responding to.`);
  lines.push(`Match their register. Don't outrun them. Don't sound like a marketer.`);
  lines.push('');
  signals.forEach((s, i) => {
    lines.push(`${i + 1}. r/${s.subreddit || '?'}${s.starred ? ' ★' : ''}`);
    if (s.key_quote)    lines.push(`   "${s.key_quote}"`);
    if (s.one_line_why) lines.push(`   — why: ${s.one_line_why}`);
  });
  return lines.join('\n');
}

module.exports = async function handler(req, res) {
  const params   = req.query || {};
  const limit    = Math.min(parseInt(params.limit, 10) || 15, 30);
  const minScore = parseInt(params.min_score, 10) || 30;
  const days     = parseInt(params.days, 10) || 30;
  const format   = params.format || 'block';

  const since = new Date(Date.now() - days * 86400000).toISOString();
  const filter =
    `select=${SELECT_COLS}` +
    `&total_score=gte.${minScore}` +
    `&dismissed=eq.false` +
    `&post_created=gte.${since}` +
    `&order=total_score.desc` +
    `&limit=${limit * 3}`;

  const rows = await supabaseQuery('ear_signals', 'GET', null, filter);
  if (!rows) {
    return res.status(200).json({ ok: true, count: 0, block: formatBlock([]) });
  }

  const ranked = rows
    .map(s => ({ ...s, _w: weightOf(s) }))
    .sort((a, b) => b._w - a._w)
    .slice(0, limit);

  if (format === 'json') {
    return res.status(200).json({ ok: true, count: ranked.length, signals: ranked });
  }

  return res.status(200).json({
    ok:    true,
    count: ranked.length,
    block: formatBlock(ranked),
  });
};
