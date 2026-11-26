// api/keepalive.js — Patch V
// Daily cron (vercel.json) that touches both free-tier databases so neither is
// treated as inactive. Background: on 2026-10-05 production was down because
// Upstash deletes free Redis databases after 14 days without activity (sam-kv,
// archived ~2026-07-20) and Supabase pauses free projects after a quiet stretch.
// This writes one tiny key to KV and runs one small read against Supabase.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

module.exports = async function handler(req, res) {
  // Vercel cron sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const result = { at: new Date().toISOString(), kv: 'skipped', supabase: 'skipped' };

  // Upstash / Vercel KV — write then read back a timestamp.
  try {
    const { kv } = require('@vercel/kv');
    const now = Date.now();
    await kv.set('keepalive:last', now);
    const back = await kv.get('keepalive:last');
    result.kv = Number(back) === now ? 'ok' : 'mismatch';
  } catch (e) {
    result.kv = 'error: ' + e.message;
  }

  // Supabase — one small read so the project registers activity.
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/sam_users?select=email&limit=1`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
      });
      result.supabase = r.ok ? 'ok' : 'http ' + r.status;
    } catch (e) {
      result.supabase = 'error: ' + e.message;
    }
  }

  const healthy = result.kv === 'ok' && result.supabase === 'ok';
  if (!healthy) console.error('[keepalive] unhealthy', JSON.stringify(result));
  return res.status(healthy ? 200 : 500).json(result);
};
