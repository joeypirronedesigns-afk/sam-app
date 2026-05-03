#!/usr/bin/env node
// scripts/cleanup-stale-currentstep.js — v9.116.7 one-shot DB cleanup
//
// Strips the legacy top-level `_currentStep` field from a user's
// sam_users.sam_context row so the doRestoreSession hydration path
// (app.html:11353, 13646) doesn't write `localStorage.sam_session_step='12'`
// and trigger the Step 12 jump-back regression.
//
// SAFETY:
//   1. Always snapshots the pre-edit row to scripts/snapshots/<email>-<uid>-<ts>.json
//      BEFORE running the PATCH. The snapshot is committed to disk before the
//      database is touched.
//   2. PATCHes by uid (not email) to avoid affecting any duplicate rows.
//   3. Only modifies the sam_context column.
//   4. Refuses to run if SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL is missing.
//   5. Dry-run by default. Pass --apply to actually PATCH the database.
//
// USAGE:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/cleanup-stale-currentstep.js --email j.pirrone@yahoo.com
//   # ^ dry-run: snapshots row, prints what would change, exits without writing
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/cleanup-stale-currentstep.js --email j.pirrone@yahoo.com --apply
//   # ^ snapshots row, then PATCHes the database
//
// EXIT CODES:
//   0 — success (or dry-run with no change needed)
//   1 — config / argument error
//   2 — row not found
//   3 — fetch / patch error
//   4 — snapshot write error

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const emailIdx = args.indexOf('--email');
const email = (emailIdx !== -1 && args[emailIdx + 1]) ? args[emailIdx + 1].trim().toLowerCase() : null;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(code, msg) {
  console.error('[cleanup] ' + msg);
  process.exit(code);
}

if (!email || !email.includes('@')) fail(1, 'Missing or invalid --email <user@example.com>');
if (!SUPABASE_URL) fail(1, 'Missing SUPABASE_URL env var');
if (!SERVICE_KEY) fail(1, 'Missing SUPABASE_SERVICE_ROLE_KEY env var');

const headers = {
  apikey: SERVICE_KEY,
  Authorization: 'Bearer ' + SERVICE_KEY,
  'Content-Type': 'application/json'
};

(async function main() {
  console.log('[cleanup] mode:', apply ? 'APPLY' : 'DRY-RUN');
  console.log('[cleanup] email:', email);

  // 1. Fetch ALL rows for this email so we can snapshot the full picture.
  const enc = encodeURIComponent(email);
  const fetchUrl = `${SUPABASE_URL}/rest/v1/sam_users?email=eq.${enc}&select=uid,email,sam_context,last_seen,created_at&order=last_seen.desc.nullslast`;
  let rows;
  try {
    const r = await fetch(fetchUrl, { headers });
    if (!r.ok) fail(3, `Fetch failed (${r.status}): ${await r.text()}`);
    rows = await r.json();
  } catch (e) {
    fail(3, 'Fetch error: ' + e.message);
  }

  if (!Array.isArray(rows) || rows.length === 0) fail(2, 'No sam_users row found for that email');
  console.log('[cleanup] rows found:', rows.length);

  // 2. Snapshot the pre-edit state. Always — even on dry-run — so we have a
  //    record before any future apply runs.
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const snapDir = path.join(__dirname, 'snapshots');
  if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
  const snapFile = path.join(snapDir, `${email.replace(/[^a-z0-9_-]/gi, '_')}-${ts}.json`);
  try {
    fs.writeFileSync(snapFile, JSON.stringify({ email, fetchedAt: ts, rows }, null, 2));
    console.log('[cleanup] snapshot written:', snapFile);
  } catch (e) {
    fail(4, 'Snapshot write failed: ' + e.message);
  }

  // 3. Build the cleanup plan. For each row, parse sam_context, strip top-level
  //    `_currentStep`, re-serialize. Skip if no change.
  const plan = [];
  for (const row of rows) {
    const before = row.sam_context;
    if (!before) continue;
    let parsed;
    try { parsed = typeof before === 'string' ? JSON.parse(before) : before; }
    catch (e) { console.warn('[cleanup] row uid=' + row.uid + ' has unparseable sam_context, skipping'); continue; }
    if (!parsed || typeof parsed !== 'object') continue;
    if (!('_currentStep' in parsed)) {
      console.log('[cleanup] row uid=' + row.uid + ' has no top-level _currentStep, skipping');
      continue;
    }
    const beforeStep = parsed._currentStep;
    const cleaned = Object.assign({}, parsed);
    delete cleaned._currentStep;
    plan.push({ uid: row.uid, beforeStep, cleaned });
  }

  if (plan.length === 0) {
    console.log('[cleanup] nothing to clean — all rows are already free of top-level _currentStep');
    process.exit(0);
  }

  console.log('[cleanup] rows to patch:', plan.length);
  plan.forEach(p => console.log('  - uid=' + p.uid + ' (was _currentStep=' + p.beforeStep + ')'));

  if (!apply) {
    console.log('[cleanup] dry-run complete. Re-run with --apply to write.');
    process.exit(0);
  }

  // 4. Apply the patches one by one (by uid).
  for (const p of plan) {
    const patchUrl = `${SUPABASE_URL}/rest/v1/sam_users?uid=eq.${encodeURIComponent(p.uid)}`;
    try {
      const r = await fetch(patchUrl, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ sam_context: p.cleaned })
      });
      if (!r.ok) {
        console.error('[cleanup] PATCH failed for uid=' + p.uid + ': ' + r.status + ' ' + await r.text());
        process.exit(3);
      }
      console.log('[cleanup] patched uid=' + p.uid);
    } catch (e) {
      console.error('[cleanup] PATCH error for uid=' + p.uid + ': ' + e.message);
      process.exit(3);
    }
  }

  console.log('[cleanup] done. Snapshot retained at:', snapFile);
})();
