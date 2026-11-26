module.exports.config = { api: { bodyParser: { sizeLimit: '1mb' } } };

async function supabaseGet(table, filters) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return [];
  try {
    const url = `${SUPABASE_URL}/rest/v1/${table}${filters ? '?' + filters : ''}`;
    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!r.ok) {
      console.error('Supabase GET failed:', table, r.status, await r.text());
      return [];
    }
    return await r.json();
  } catch (e) {
    console.error('Supabase GET error:', e.message);
    return [];
  }
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Pull the full outreach queue (last 500 entries) and attributed signups
  const [queueRows, signups] = await Promise.all([
    supabaseGet('outreach_queue', 'select=*&order=created_at.desc&limit=500'),
    supabaseGet('sam_signups', 'select=email,name,created_at,attribution_source,attribution_token&attribution_token=not.is.null&order=created_at.desc&limit=200'),
  ]);

  // Per-platform stats
  const platformStats = {};
  for (const row of queueRows) {
    const p = row.platform || 'unknown';
    if (!platformStats[p]) platformStats[p] = { total: 0, pending: 0, posted: 0, converted: 0 };
    platformStats[p].total += 1;
    const status = row.status || 'pending';
    if (platformStats[p][status] !== undefined) platformStats[p][status] += 1;
  }

  // Top converting queries / subreddits
  const queryStats = {};
  const convertedTokens = new Set(
    queueRows.filter(r => r.status === 'converted').map(r => r.token)
  );
  for (const row of queueRows) {
    const key = row.found_via || '(unknown)';
    if (!queryStats[key]) queryStats[key] = { platform: row.platform, total: 0, converted: 0 };
    queryStats[key].total += 1;
    if (convertedTokens.has(row.token)) queryStats[key].converted += 1;
  }
  const topQueries = Object.entries(queryStats)
    .map(([query, stats]) => ({ query, ...stats, rate: stats.total ? (stats.converted / stats.total) : 0 }))
    .sort((a, b) => b.converted - a.converted || b.rate - a.rate)
    .slice(0, 15);

  // Build signup rows enriched with the outreach queue row they came from
  const queueByToken = {};
  for (const row of queueRows) queueByToken[row.token] = row;

  const attributedSignups = signups.map(s => {
    const src = queueByToken[s.attribution_token] || null;
    return {
      email: s.email,
      name: s.name,
      signedUpAt: s.created_at,
      platform: s.attribution_source,
      token: s.attribution_token,
      targetUrl: src ? src.target_url : null,
      targetCreator: src ? src.creator : null,
      targetTitle: src ? src.title : null,
      foundVia: src ? src.found_via : null,
    };
  });

  // Top-level totals
  const totals = {
    queueTotal: queueRows.length,
    queuePending: queueRows.filter(r => r.status === 'pending').length,
    queuePosted: queueRows.filter(r => r.status === 'posted').length,
    queueConverted: queueRows.filter(r => r.status === 'converted').length,
    signupsAttributed: attributedSignups.length,
  };

  return res.status(200).json({
    success: true,
    totals,
    platformStats,
    topQueries,
    recentAttributedSignups: attributedSignups.slice(0, 50),
    fetchedAt: new Date().toISOString(),
  });
};
