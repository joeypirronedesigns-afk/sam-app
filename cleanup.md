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

## Voice DNA evolution from chat conversations (deferred)

Documented 2026-04-25. Issue 6 path (a) — building actual chat-to-Voice-DNA
extraction — was deferred in favor of path (b) (prompt honesty fix shipped
in 80cb2c1).

What path (a) would require:
- Background job (Vercel scheduled function or nightly cron) that mines
  sam_conversations for each active user
- Extracts voice signals (style, rhythm, phrasing) — NOT mood/topic/sentiment
- Periodically updates sam_users.voice_profile via /api/voice with
  source='chat_extracted'
- Cost: each user analysis ~1 Anthropic API call. With N active users on
  daily cron, real money. Decide model (Sonnet vs Haiku) based on quality
  needed.
- Drift protection: avoid spam-prompt-induced profile drift if user vents
  at SAM for a session.
- User control: opt-out toggle? Notification when profile auto-updates?

Tradeoff vs path (b) (current state): Path (b) tells users honestly to use
Voice Trainer for explicit refinement. Path (a) makes the "gets sharper
every time you use her" homepage promise actually true. Path (a) is real
product work — multi-hour design + implement + edge cases.

Identified during user testing tonight where SAM told user "new info you
share gets baked in to Voice DNA" — which was false. Path (b) shipped to
stop the false promise. Path (a) remains the long-term win.

## Voice Trainer badge race condition (Issue 7 — deferred)

Documented 2026-04-25 night session. Smoke test after Issue 2 ship surfaced
two related polish bugs. Not brand-promise blocking, deferred to next session.

**Symptom A (race condition):**
On first open of Voice Trainer modal, badge shows "🧬 NO PROFILE YET — LET'S
START" even when user has an active voice profile in sam_users
(voice_version=7, 7 traits). Closing and reopening modal correctly shows
"🧬 V7 · 7 TRAITS." Suggests modal opens and stamps initial state before
async user fetch (getCurrentUser → /api/me POST with email) resolves.

**Likely fix:** Either await getCurrentUser() before rendering modal, or
add a loading state that updates badge once user data arrives. Modal
currently uses getCurrentUserCached() which can return null on first hit
before cache is populated.

**Symptom B (label gap):**
Workshop tile (/app grid) and top nav both show "Voice DNA · Refine how
SAM hears you" without version count. Should optionally show "v7" or
"v7 · 7 traits" when profile exists. Pure UI label addition, no logic
needed beyond reading user data.

**Verification on next session:**
1. Open /app fresh, before clicking anything verify Workshop tile state
2. Click 🧬 entry point, observe badge text on first open
3. If race condition reproduces, fix in openVoiceTrainer() before render
4. Add version count to Workshop tile + top nav using same data source as
   wizard header (which works correctly — shows V1/V7 reliably)

**Architectural note:** /api/me requires email in POST body. Returns 400
"valid email required" if called without email. This is by design — it's
a lookup endpoint, not session-aware. All internal callers pass email
correctly via getCurrentUser() helper.
