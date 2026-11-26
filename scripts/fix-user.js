// scripts/fix-user.js — one-time fix: upsert info@bornthird.com into sam_users
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const EMAIL = 'info@bornthird.com';
const TIER  = 'creator';

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  // 1 — Upsert sam_users row with service role key (bypasses RLS)
  console.log(`Upserting ${EMAIL} into sam_users (tier: ${TIER})...`);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sam_users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
      uid:   EMAIL,
      email: EMAIL,
      tier:  TIER,
      last_seen: new Date().toISOString()
    })
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Supabase upsert FAILED (${res.status}):`, body);
    process.exit(1);
  }
  console.log('Supabase upsert OK.');

  // 2 — Verify the row was written
  const check = await fetch(
    `${SUPABASE_URL}/rest/v1/sam_users?email=eq.${encodeURIComponent(EMAIL)}&select=uid,email,tier,last_seen&limit=1`,
    {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      }
    }
  );
  const rows = await check.json();
  if (rows && rows.length) {
    console.log('Verified row in sam_users:', rows[0]);
  } else {
    console.warn('Row not found after upsert — check Supabase table/RLS config.');
  }
}

main().catch(e => { console.error('Unexpected error:', e.message); process.exit(1); });
