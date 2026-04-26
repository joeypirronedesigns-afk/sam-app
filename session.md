# SAM App — Saturday Build Session (2026-04-25)

## Context

Joey Pirrone (Detroit-based DIY renovator/creator) building SAM for Creators — AI tool for tradesperson-creators. Stack: Vercel + Supabase (sam_users, sam_conversations) + Stripe + Anthropic API + Vercel KV (magic-link tokens) + Resend (emails). Repo: github.com/joeypirronedesigns-afk/sam-app at /Users/giuseppepirrone/Desktop/sam-app. Domain: samforcreators.com.

Joey is the only paid customer (j.pirrone@yahoo.com, tier=creator). Working via Claude Code CLI.

## Today's Commits (chronological)

| Hash | What |
|---|---|
| 931d780 | Stripe webhook fix — paid users get welcome emails (added bodyParser:false config, switched email sender to verified domain) |
| 17bcaf5 | Homepage chat persistence — wired FAB chat to /api/memory |
| 949d436 | FAB chat → Voice DNA wiring (chat replies use voice profile) |
| 6c128a2 | Identity refactor Commit 1: /api/me endpoint + getCurrentUser/getCurrentUserCached/cache helpers in index.html |
| 491fecc | Commit 2: nav migration to canonical Supabase identity, hide .nav-pro-btn for paid users |
| bb966f5 | Commit 2.1: updateTrialBadge timing self-heal (rAF + DOMContentLoaded guard) |
| ab48066 | Commit 2.2: nav-pro-btn hide via setProperty(...,'important') — beats CSS !important |
| 3254fad | Commit 3: FAB chat identity migration + claimAnonymousChatHistory + /api/memory batch endpoint |
| e573559 | Commit 5a: meet.html identity migration + saveEmail safe merge |
| f64fa03 | Commit 4: removed window._userSignedIn, wizard auto-open uses trialStart recency check, submitTrialEmail uses writeUserCache |
| e123826 | Commit 4.1: fixed hardcoded 'dev-joey' userId in wizard step 9, appended wizard persistence gap to cleanup.md |
| 84fc105 | Commit 7: Voice DNA modal prose fallback, prompt updated to numbered list, getVoiceVersion handles prose |

## Architecture: Strangler Pattern Migration State

### Identity (canonical = Supabase via /api/me)
Helpers in index.html (and mirrored in meet.html):
- `getCurrentUser()` — async, hits /api/me, populates cache
- `getCurrentUserCached()` — sync, returns cached user or null (5-min TTL)
- `writeUserCache(user)` — writes new cache + legacy sam-trial shim
- `readUserCache()`, `clearUserCache()` — cache primitives
- `claimAnonymousChatHistory(email)` — re-tags localStorage chat history with email at sign-in, batch-POSTs to /api/memory

Key facts:
- Supabase `sam_users` is canonical source
- localStorage `sam-current-user` is 5-min read-through cache
- localStorage `sam-trial` still maintained as legacy shim for un-migrated call sites
- Magic-link verify (verify_token) routes through writeUserCache + claim
- submitTrialEmail (free trial signup) routes through writeUserCache + claim
- meet.html saveEmail does safe merge (preserves paid status)

### Migrated surfaces
- Nav (updateTrialBadge reads from canonical, hides "See plans" for paid)
- FAB chat (sendChatMessage + addChatMessage tag userId)
- meet.html (paints nav from canonical, saveEmail safe merge)
- Magic-link verify success
- submitTrialEmail success

### Un-migrated surfaces (still read sam-trial via legacy shim)
- Hero CTA inline onclicks (lines 4569, 5003) — route new vs returning users
- Paywall / feature gates (lines 7264, 7671, 7717, 7742, 8076, 8176, 8220, 8233)
- Wizard reads (lines 8453, 8465)
- Ideas Bank guards (lines 8876, 8897)
- initWizard nav button (line 9564)

### Helpers / fallbacks (intentionally keep getTrialState reads)
- openTrialCapture, closeTrial, skipTrial — UI flags only
- sam_devmode — intentional dev bypass
- updateTrialBadge minute-refresh setTimeout

## Bugs Fixed Today

1. Stripe webhook silent failure (931d780)
2. Chat sessions not persisting in homepage + dev modes (17bcaf5)
3. FAB chat ignoring Voice DNA — generic replies (949d436)
4. "See plans" button visible for paid users (Commit 2 series — final fix ab48066 with setProperty !important)
5. Wizard auto-opening for returning paid users (Commit 4)
6. Anonymous chat lost when user signs in (Commit 3 claimAnonymousChatHistory)
7. "Welcome back" + "Sign in" simultaneous nav render bug in meet.html (Commit 5a)
8. Hardcoded 'dev-joey' userId in wizard step 9 (Commit 4.1)
9. Voice DNA modal renders empty for prose profiles (Commit 7)

## Known Open Issues / Pending Work

### Pre-existing bugs surfaced during testing tonight (not refactor-caused)
- **Reload Session button doesn't work after hard refresh** — investigation needed. User reports it used to work. Could be sam_session_v2 not writing properly, or doRestoreSession not firing on init.
- **Trial banner ("7 days free · No card needed · Cancel anytime") still showing for paid users** — ✓ FIXED 88dac2e — id="heroTrialBanner" added, hidden via updateTrialBadge setProperty pattern.

### Deferred to cleanup.md
- Three stale anon rows in sam_users (harmless, deferred deletion)
- Wizard server persistence gap (saves localStorage only, no cross-device restore — multi-hour design + implement)

### Identity refactor — remaining commits
- Commit 5b: paywall + feature gates + dev chat migration (pure cleanup, low priority)
- Commit 6: remove dead getTrialState/saveTrialState/sam-trial legacy code (deferred 1+ week to confirm shim safe to remove)

### Issue 5 — SAM system prompt contradicts persistent memory (HIGH PRIORITY)
SAM told user she's "a creative sparring partner in a single session" and "can't carry forward to next visit." This directly contradicts:
- The homepage promise: "SAM remembers every word"
- The actual implementation: Commit 3 wired chat persistence to Supabase via /api/memory; sam_conversations table exists and is being written to

**Root cause:** api/sam.js system prompt doesn't acknowledge SAM's own memory architecture. SAM has no idea she has a persistent chat history or a Voice DNA profile she's built over time.

**Fix:** Small prompt update in api/sam.js (or wherever the chat system prompt is assembled). Tell SAM: she has persistent memory of past conversations via Supabase, she has a Voice DNA profile she's been building, and she should acknowledge this honestly when users ask. Data already exists — prompt is just unaware of it.

### Issue 6 — SAM over-promises Voice DNA evolution from chat (MEDIUM PRIORITY)
In same conversation, SAM told user that new info shared in chat "gets baked in" to Voice DNA. Currently false — only explicit Voice Trainer submissions and initial onboarding samples write to sam_voice_samples + voice_profile. Chat content does not.

**Two resolution paths:**
- **(a) Build chat-to-Voice-DNA extraction** — background job that periodically mines sam_conversations for voice signals and feeds them into voice_profile evolution. Bigger build. The right long-term answer.
- **(b) Prompt correction only** — update SAM's system prompt to be honest: "your voice profile updates when you use Voice Trainer, not automatically from chat." Softens the false promise without new infrastructure. Ship fast.

Recommended: do (b) now alongside Issue 5 fix (both are prompt changes in api/sam.js), then revisit (a) as a future feature.

## Voice Trainer Feature (Pattern B) — In Progress

### User vision
Standalone widget for ongoing voice capture. Users chat freely with SAM normally; when ready, they paste 1-3 new writing samples into the Voice Trainer modal. Profile evolves over time, badge increments version (🧬 v2 · N traits, etc.).

### Three entry points (per Joey's request: all of the above)
1. Top nav button — next to Workshop / Story Engine / Joe
2. Workshop tile — alongside The Pulse, The Spark, Blueprint, etc.
3. FAB chat tray — small icon in chat header

### Architecture decision: Pattern B (Joey decided)
Store individual voice samples in new table, not just analyses.

**Why Pattern B over Pattern A:**
- Source of truth preserved (samples never discarded)
- Future re-analysis with better prompts possible
- Audit trail of voice evolution
- Multi-device coherent

**Schema change required:**
New table `sam_voice_samples`:
- `id` (uuid, primary key)
- `user_id` (text, indexed — matches sam_users.uid)
- `sample_text` (text)
- `source` (text — 'onboarding', 'voice_trainer', 'chat_extracted', etc.)
- `created_at` (timestamp with time zone)

### Endpoint changes
/api/voice changes:
- On submit, append rows to sam_voice_samples (one per sample)
- Then call Claude with: existingProfile + concatenated text of ALL user's samples (or just the most recent N if context window concern)
- Update sam_users.voice_profile with new analysis
- Return new analysis to frontend

### Frontend changes
- New `openVoiceTrainer()` function in index.html
- Modal UI: title, current profile display, 3 sample textareas, submit button
- On submit: POST to /api/voice with new samples + existingProfile, await response, update cache, increment recal count, show new profile, toast, allow close
- Three entry points wired to openVoiceTrainer()

### Build plan (current session)
Commit V1: Supabase migration — create sam_voice_samples table ✓ (done manually in Supabase dashboard)
Commit V2: Backend — /api/voice modified to read/write samples table ✓ 7b6a649
Commit V3: Backend — evolution prompt for Claude when existingProfile present ✓ 939b550
Commit V3.5: voice_version increment on save + getUserProfile select fix ✓ 37537b0
Commit V4: Frontend — openVoiceTrainer modal ✓ c2b7a19
Commit V5: Frontend — three entry points wired ✓ 74fa509

## Voice Trainer — COMPLETE ✓
All commits shipped: V1 (schema) → V2 (backend Pattern B) → V3 (evolution prompt) → V3.5 (voice_version) → V4 (modal UI) → V4.1 (identity fix) → V5 (entry points)

## Current Session Vibe
Joey is direct, blunt, action-oriented. Pushed back on excessive caution earlier. Wants to ship Pattern B tonight despite hour. Heard the risk note, accepted it. Use the full context window if the task requires it. Test between commits, but don't over-explain.

## Important Files
- index.html — main app (~13800 lines)
- meet.html — onboarding flow with voice capture
- landing.html — marketing landing page (redirects returning users to /app)
- api/voice.js — voice profile extraction endpoint
- api/me.js — canonical user fetch (added Commit 1)
- api/memory.js — chat persistence (Commit 3 added batch endpoint)
- api/sam.js — main chat endpoint
- api/stripe-webhook.js — Stripe events (Commit 931d780 fixed bodyParser)
- api/auth.js — magic link auth flows
- cleanup.md — deferred work tracker
- vercel.json — routing (/ → landing.html, /app → index.html)
