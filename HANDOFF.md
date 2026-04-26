# SAM App — Session Handoff

**Last session:** 2026-04-25 (Sat) night shift
**Repo:** `~/Desktop/sam-app/` · github.com/joeypirronedesigns-afk/sam-app
**Status:** Clean. Working tree clean. Branch up to date with origin/main.
**Live:** samforcreators.com (production) · sam-app-sigma.vercel.app (staging)

---

## Read this first

You are Claude Code, picking up a project mid-build. The user is **Joey Pirrone**, solo founder, building SAM — an AI creative director for content creators. He's also a self-taught DIY renovator documenting a cottage gut-renovation for his parents in Maryland. He moves fast, expects direct opinions, and prefers Python/bash patches over raw sed for multiline replacements.

**Workflow pattern:**
- You write Python/bash patches → Joey runs in terminal → pastes results → you fix → git push
- Joey tests live in incognito, reports back with screenshots
- Joey prefers clear step-by-step instructions; doesn't want you to assume he knows what he's doing
- Joey wants you to flag issues proactively rather than wait to be asked

**Critical operational rules (don't skip):**
1. **Always bump version number on every push; tell Joey what version to look for**
2. **Never touch the Meet SAM cinematic auto-load sequence** (openWizardPage → showWizardStep('entry') → meetSamInit). It's sacred.
3. **Use `\\n` in Python strings that become JS** — never literal newlines inside JS regex (recurring source of syntax errors)
4. **Read file first; use Python scripts for complex multiline replacements; verify with grep before pushing**
5. **After EVERY commit, run `git log --oneline -3` to confirm it actually shipped.** Compaction has caused false-success reports twice in past sessions. Never trust a commit happened until git log shows it.
6. **Strangler discipline:** one commit at a time, test between, verify before continuing.
7. **Scripts go to `~/Desktop/` not `/tmp/`**
8. **Never use single-quoted font names inside JS strings.**
9. **Use `python3 - << 'PYEOF' ... PYEOF` for inline Python** (avoids zsh `!` expansion issues)

---

## Tech stack

- **Frontend:** Single `index.html` (~14000 lines) + `meet.html` (onboarding) + `landing.html`
- **Backend:** Vercel serverless functions in `api/` folder
- **Database:** Supabase (sam_users, sam_conversations, sam_voice_samples, sam_context tables)
- **AI:** Anthropic Claude API
- **Email:** Resend API → joey@samforcreators.com
- **Payments:** Stripe (Creator $19, Pro $39, Studio $99 monthly; Founding $9 first 100 users)
- **PDF:** Puppeteer + @sparticuz/chromium
- **Rate limiting:** Vercel KV
- **Hosting:** Vercel Pro (60s function timeouts)

**Key API endpoints (`api/` folder):**
- `sam.js` — main chat endpoint (system prompt, voice profile injection, history fetch)
- `voice.js` — voice profile extraction/evolution
- `me.js` — canonical user fetch (POST with email body, returns user record)
- `memory.js` — chat persistence to sam_conversations
- `auth.js` — magic link
- `stripe-webhook.js` — Stripe events
- `stripe-checkout.js` — checkout session creation
- `pdf.js` — PDF generation
- `waitlist.js` — waitlist signup
- `_supabase.js` — Supabase helpers (supabaseQuery, trackUser, saveUserProfile, etc.)

**Key client files:**
- `index.html` — main app at /app route
- `meet.html` — onboarding flow at /meet route
- `landing.html` — marketing page at / root
- `vercel.json` — routing (/ → landing.html, /app → index.html, /meet → meet.html)

---

## Architecture: Strangler-pattern identity migration (mostly complete)

**Canonical identity = Supabase sam_users via /api/me.** Email IS uid (lowercased).

**Helpers (mirrored in index.html and meet.html):**
- `getCurrentUser()` async — hits /api/me POST with email, populates cache (5-min TTL)
- `getCurrentUserCached()` sync — returns cached user or null
- `writeUserCache(user)` — writes new + legacy sam-trial shim
- `claimAnonymousChatHistory(email)` — re-tags localStorage chat at sign-in
- `getCanonicalUid()` (meet.html) — email-from-cache OR STATE.uid fallback

**Migration state:**
- ✅ Migrated: nav (updateTrialBadge), FAB chat, meet.html (saveEmail safe merge, callSAM canonical email), magic-link verify, submitTrialEmail, hero trial banner, wizard reload session
- ⏳ Legacy still alive (intentionally — shim works): hero CTA inline onclicks (lines 4569, 5003), paywall/feature gates (~8 sites), wizard reads, Ideas Bank guards, initWizard nav button
- 🔮 Deferred: Commit 5b (paywall + feature gates + dev chat migration) and Commit 6 (remove dead getTrialState/saveTrialState legacy code — wait 1+ week to confirm shim safe)

**Anon gate convention:** any userId starting with `anon-` should be rejected from history fetches and DB writes. Pattern in api/sam.js:
```javascript
if (!userId || userId === 'anon' || userId.startsWith('anon-')) return [];
```

---

## Last session's commits (reverse chronological)

Run `git log --oneline -15` to see live state. Expected to include:

| Hash | Work |
|------|------|
| 9b1737c | cleanup.md: Issue 7 deferred (badge race + label gap) |
| e58960e | session.md: Issue 2 closed, commits table updated |
| 5a9b673 | Issue 2: Voice Trainer in Switch Tools overlay (8th tile) |
| 0a87742 | session.md/cleanup.md: Issue 6 closed + path (a) deferred |
| 80cb2c1 | Issue 6: Honest Voice DNA evolution disclosure in SAM prompt |
| 4f42013 | session.md: Issue 5 fully closed |
| 3fe7cd6 | Issue 5 Part 2: /meet anon fingerprint → canonical email |
| 6af0a58 | Issue 4: Reload Session opens wizard before restore |
| f8cdcd1 | Issue 5 Gap A+B: SAM memory + chat history load |
| 88dac2e | Issue 3: Hero trial banner hidden for paid users |

**Earlier same day (morning shift):**
- Identity refactor C1-C4 (api/me, getCurrentUser helpers, nav migration, FAB chat migration, meet.html migration, hardcode fixes)
- Voice Trainer V2-V5 (Pattern B backend, sam_voice_samples table, modal UI, 5 entry points, modal reparent fixes)
- Stripe webhook fix (bodyParser:false + verified email sender)

---

## What's working (verified end-to-end last session)

✅ **SAM persistent memory** — On signed-in users, fresh chat sessions prepend last 20 messages from sam_conversations. SAM correctly recalls past chats with specific details. MEMORY & CONTINUITY block in api/sam.js system prompt directs SAM to acknowledge memory honestly.

✅ **Voice DNA injection** — voiceProfile passed in /api/sam payload, SAM correctly quotes user's actual writing traits.

✅ **Voice Trainer modal** — Opens cleanly from 5 entry points (top nav 🧬 button, Workshop tile, FAB chat header, wizard voice badge, Switch Tools overlay 🧬 tile). Pattern B architecture: each sample stored in sam_voice_samples, voice_version increments on each save, evolution prompt instructs PRESERVE/REFINE/ADD/REMOVE traits targeting 10-20 cumulative.

✅ **/meet canonical identity** — getCanonicalUid() helper resolves email-from-cache when signed in, falls back to STATE.uid for anon. Used in callSAM + voice profile save + email capture pings.

✅ **Reload Session** — doRestoreSession() opens wizardPage before showWizardStep, sets body overflow, shows navWizardBtn.

✅ **Hero trial banner** — id="heroTrialBanner" hidden via setProperty('display','none','important') for paid users. Same pattern as nav-pro-btn fix.

✅ **Stripe webhook** — bodyParser:false config, verified Resend sender domain, welcome email lands.

---

## Pending work (in priority order)

### Issue 7 — Voice Trainer badge race condition (HIGH priority for next session)

Documented in `cleanup.md`. On first open of Voice Trainer modal, badge shows "🧬 NO PROFILE YET — LET'S START" even when user has active profile (voice_version=7+, traits exist). Closing and reopening fixes it. Suggests modal opens and stamps initial state before async user fetch resolves.

**Likely fix:** Either await getCurrentUser() before rendering modal, or add loading state that updates badge once user data arrives. Modal currently uses getCurrentUserCached() which returns null on first hit before cache populated.

**Also (Symptom B):** Workshop tile (/app grid) and top nav both show "Voice DNA · Refine how SAM hears you" without version count. Should optionally show "v7 · 7 traits" using same source as wizard header (which works correctly).

**Verification steps:**
1. Open /app fresh (hard refresh)
2. Before clicking anything, check Workshop tile state
3. Click 🧬 entry point, observe badge text on first open
4. If race reproduces, fix in openVoiceTrainer() before render
5. Add version count to Workshop tile + top nav

### Issue 8 — Voice DNA drift on submission (NEW, surfaced 10:30pm)

After multiple Voice Trainer submissions, profile traits drifted dramatically (V7 → V10 with completely different content). Lowercase-to-caps / double-dot pause / parenthetical data-dump traits replaced by Anxiety-as-documentation / Self-aware parenthetical confession / Lowercase as default vulnerability. Need to evaluate whether evolution prompt in api/voice.js is too permissive vs. preservation.

**Investigation path:** Read api/voice.js evolution prompt. Currently instructs PRESERVE/REFINE/ADD/REMOVE. May need stronger preservation language, or weight existing traits higher when new samples don't strongly contradict. Related to path (a) drift protection note in cleanup.md.

### Issue 9 — Regenerated hook can't be saved (NEW, surfaced 10:30pm)

In The Pulse output, after clicking "Try a different hook," the new hook displays but the Save to Ideas button either doesn't fire or stays bound to the original hook. DOM inspection shows the regenerated hook button has different onclick handler than original.

**Investigation path:** Find regenHook() handler in index.html. Check how it re-binds save-to-ideas after regeneration. Details in cleanup.md.

### Path (a) — Chat-to-Voice-DNA extraction (DEFERRED, multi-hour build)

Documented in cleanup.md. Background job that mines sam_conversations for each active user, extracts voice signals (style/rhythm/phrasing — NOT mood/topic/sentiment), periodically updates sam_users.voice_profile via /api/voice with source='chat_extracted'. Includes drift protection, cost analysis, opt-out toggle, model decision. Multi-hour design + implement.

### Wizard server persistence gap (DEFERRED)

Currently saves to localStorage only. No cross-device restore. Documented in cleanup.md.

### Strangler refactor cleanup (LOW priority)

- Commit 5b: paywall + feature gates + dev chat migration to canonical helpers
- Commit 6: remove dead getTrialState/saveTrialState/sam-trial legacy code (defer 1+ week minimum)

### Stale data cleanup

3 stale `anon-*` rows in sam_users for j.pirrone@yahoo.com. SQL in cleanup.md.

---

## Branch state (important context)

**`main`** — active branch, clean, all session.md work lives here.

**`photo-wizard-dev`** — exists locally + remotely, currently at v8.51 (`5ddbfe5`). This branch was the previous active development track (photo wizard feature, MEET SAM flow, The Reach v2, etc.) that predates the current main-branch work. It was never merged to main and diverged significantly. The MEET SAM first-visit flow bug (Voice DNA card firing before button click) was the open critical bug on that branch at time of last HANDOFF. **Before resuming photo-wizard-dev work, evaluate whether its changes conflict with session.md identity migration work now on main.** Don't merge blindly — index.html changes will conflict.

**`meet-sam-fix`**, **`meet-sam-page`** — older feature branches, likely superseded.

---

## MEET SAM — intended first-visit flow (for reference)

1. SAM greeting bubble: "Everything amazing in life comes from stories. What's yours? Start anywhere — I'll find the content in it."
2. User types story → clicks send
3. SAM reflects powerfully — ONE response, specific, emotional, on-brand
4. "✦ Let's build your story →" CTA button appears AFTER SAM finishes
5. User clicks → Voice DNA card slides in ("I want to sound like you — not like AI")
6. User submits voice sample → button reappears: "✦ Let's build your story — in your voice →"
7. User clicks → handoff card → Story Wizard launches

**Returning user "Talk with SAM":** goes to msOpenThread() — context-aware greeting, NOT first-visit flow. Nav pills (← Home, Story Engine, Voice DNA) visible for returning users only.

---

## SAM HQ (separate app)

- **URL:** sam-hq.vercel.app
- **GitHub:** joeypirronedesigns-afk/sam-hq
- **Working directory:** `~/Desktop/sam-hq/index.html`
- **Deploy:** `cd ~/Desktop/sam-hq && git add -A && git commit -m "message" && git push`

---

## Joey's voice / communication style (Joey OS)

Joey writes in a specific way SAM has been trained on. When communicating with you (Claude Code), match his energy:

- **Direct, blunt, action-oriented.** "ship it" "send it" "approved" — no preamble
- **Pushes back on overthinking.** If you're being too cautious, he'll say so
- **Wants the why before the what.** Audit before edit, show diffs before applying
- **Treats you as senior consultant** thinking across copywriting + UX + design + engineering
- **Moves fast.** Expects you to flag issues proactively
- **Doesn't tolerate compaction-induced false success.** Always verify commits actually shipped

**SAM's product values (Joey OS):**
- STUDY → CONNECT → BE HONEST → TINY ASK → RELEASE
- Empathy before advice; specificity over generic compliments
- Never pushy, cocky, fake-urgent, or misleading
- Vulnerability as connection, not performance
- Diagnose for the user; explain every recommendation in plain English

---

## Files to read at session start

In this exact order:

1. **`HANDOFF.md`** — this file
2. **`session.md`** — full record of last session's work, commit lineage, architecture state
3. **`cleanup.md`** — deferred work tracker, Issue 7/8/9 details, path (a) design, wizard persistence gap

Then run:
```bash
git log --oneline -15
git status
```

Confirm working tree clean and recent commits match what's expected. If anything's off, surface it before proceeding.

---

## Opening prompt template (Joey will paste this)

```
Read /Users/giuseppepirrone/Desktop/sam-app/HANDOFF.md, then session.md
and cleanup.md. Run git log --oneline -15 and git status. Report:
- What state the repo is in
- What you understand the next priority work to be
- Any inconsistencies between docs and live code

Don't edit anything. After your report, I'll tell you what we're tackling.
```

---

## Hard rules summary

1. Verify every commit with `git log --oneline -3` immediately after pushing
2. Bump version on every change, tell Joey what version to look for
3. Never touch Meet SAM cinematic auto-load sequence
4. Use Python `\\n` for JS regex strings, never literal newlines
5. Audit before edit; show diffs before applying
6. One commit at a time; test between
7. Strangler discipline: don't rip out legacy until shim safe (1+ week)
8. anon-* prefix on userId means anonymous — reject from DB writes/history fetches
9. /api/me requires email in POST body — it's a lookup, not session-aware
10. Joey's blunt; match his energy. No preamble. Ship.

---

## Emergency context

If Joey says "what did we do last night" or "where are we" or "remind me" — read session.md and cleanup.md, then summarize in 5 bullets max. Don't recreate the whole transcript.

If Joey reports a bug that contradicts what's documented as working — DO NOT immediately patch. First verify with him whether it's the same documented bug (Issue 7/8/9) or genuinely new. Tired-Joey-bugs at 10pm are different from fresh-Joey-bugs at 9am.

If you find yourself making 3+ edits without committing — stop. Commit what works, push, verify, then continue. Lost work to compaction is the most common failure mode in this project.

---

**End of handoff. Ship one thing at a time, verify it shipped, then move to the next.**
