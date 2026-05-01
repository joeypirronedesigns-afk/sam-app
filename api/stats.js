export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function query(table, filters) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${filters}`;
  const r = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    }
  });
  if (!r.ok) return [];
  return r.json();
}

export default async function handler(req) {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

  // v9.113.1 — admin lock
  const _adminSecret = req.headers.get && req.headers.get('x-admin-secret');
  if (!process.env.ADMIN_SECRET || !_adminSecret || _adminSecret !== process.env.ADMIN_SECRET) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return new Response(JSON.stringify({ error: 'Supabase not configured' }), { status: 500, headers });

  try {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [users, signupsToday, signupsWeek] = await Promise.all([
      query('sam_users', 'select=tier,created_at'),
      query('sam_signups', `select=tier,created_at&created_at=gte.${today}T00:00:00`),
      query('sam_signups', `select=tier,created_at&created_at=gte.${weekAgo}T00:00:00`),
    ]);

    const tiers = { free: 0, creator: 0, pro: 0, studio: 0 };
    users.forEach(u => { const t = u.tier || 'free'; tiers[t] = (tiers[t] || 0) + 1; });

    const paid = (tiers.creator || 0) + (tiers.pro || 0) + (tiers.studio || 0);
    const mrr = (tiers.creator || 0) * 19 + (tiers.pro || 0) * 39 + (tiers.studio || 0) * 99;

    const stats = {
      total_users: users.length,
      free_trial: tiers.free || 0,
      paid_total: paid,
      creator_plan: tiers.creator || 0,
      pro_plan: tiers.pro || 0,
      studio_plan: tiers.studio || 0,
      signups_today: signupsToday.length,
      signups_this_week: signupsWeek.length,
      mrr_estimate: mrr,
      as_of: new Date().toISOString(),
      summary: `${users.length} total users · ${paid} paid · ${signupsToday.length} new today · $${mrr}/mo MRR`,
    };

    return new Response(JSON.stringify(stats), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
