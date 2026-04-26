# Data Cleanup — Deferred

## Orphan anon-* rows in sam_users

Discovered 2026-04-25 during V4 verification. Three rows in sam_users with uid starting with 'anon-' and email='j.pirrone@yahoo.com'. These are from pre-Strangler-migration anonymous sessions that wrote voice_profile data before identity consolidation. They're not interfering with anything — getUserProfile by email-uid returns only the canonical row.

Safe cleanup query (verify with SELECT first, then DELETE):
```sql
SELECT uid, email FROM sam_users WHERE uid LIKE 'anon-%' AND email = 'j.pirrone@yahoo.com';
DELETE FROM sam_users WHERE uid LIKE 'anon-%' AND email = 'j.pirrone@yahoo.com';
```

Apply the same pattern to clean up similar orphans for other users if any exist.

## Stale anon rows in sam_users (non-blocking)

Three rows in sam_users have `uid = anon-xxx` but `email = j.pirrone@yahoo.com` and `tier = free`.
These were created by trackUser() in api/sam.js during anonymous sessions where the email was
later captured but the uid was not yet the canonical email.

The canonical paid row is: uid = j.pirrone@yahoo.com, tier = creator.
The three stale rows are harmless — /api/me filters by uid = email so they are never returned.

When convenient (not urgent), delete them:

```sql
DELETE FROM sam_users
WHERE email = 'j.pirrone@yahoo.com'
AND uid != 'j.pirrone@yahoo.com';
```

Audit before deleting to confirm none have voice_profile or sam_context worth keeping:

```sql
SELECT uid, name, voice_profile, sam_context FROM sam_users
WHERE email = 'j.pirrone@yahoo.com' AND uid != 'j.pirrone@yahoo.com';
```

## Wizard server persistence gap (deferred)

The Story Wizard saves only to localStorage (keys: `sam_session_v2`, `sam_session_step`, `sam_session_ts`). No server-side persistence exists.

Implications:
- Wizard sessions cannot be restored on a different device
- If a user clears browser data mid-wizard, the session is lost permanently
- Cross-device parity isn't possible without redesign

What's needed (deferred — multi-hour design + implement):
- Decide schema: extend sam_users with a wizard_session JSONB column, OR new sam_wizard_sessions table
- Add server save endpoint (or extend /api/memory with wizard-specific path)
- Wire saveWizardState() to also POST to server (debounced, so we don't hammer Supabase on every keystroke)
- On wizard init, fetch server-side session if localStorage is empty (cross-device restore)
- Anon-to-signed-in claim flow (similar to claimAnonymousChatHistory but for wizard data)
- Handle save failures gracefully (retry + queued sync)

Existing functions to migrate when this is built:
- saveWizardState() at index.html line ~9327 — called ~19 times across 12 steps
- doRestoreSession() at index.html line ~9406 — currently localStorage-only
- closeWizard() at index.html lines 9682-9686 — should flush server state on close
- Step 12 playbook generation — currently saves to localStorage only as 'sam-playbook-html'

Identified: 2026-04-25 during Commit 5a verification. Not introduced by identity refactor — predates 949d436.
