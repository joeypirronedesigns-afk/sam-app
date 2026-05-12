# SAM Funnel & Gating Archaeology — v9.112

**Read-only audit. No code modified. Branch: `quietstudio` at v9.111.4 (commit `e026977`).**
**Architecture lock: Position B (Voice DNA pattern everywhere) + Option Y (gate at action).**
**Generated: 2026-05-01**

---

## Executive summary

Anonymous users land on `/app` with no friction — the Quiet Studio shell renders fully, the rail is fully clickable, and most tool surfaces open without complaint. Voice DNA is the only tool that implements the canonical gate: it opens, accepts input, and rejects the unauthenticated action with a clean "Please sign in to use Voice Trainer" message. Every other expensive-compute endpoint either runs full Anthropic compute for anonymous users (no auth check at all in `api/pdf.js`, `api/voice.js`, `api/daily-brief.js`, `api/reach.js`, `api/ear.js`, `api/story-engine-save.js`) or rate-limits by tier on a single mode (`api/sam.js` only gates `mode === 'playbook'`). The 7-day trial system is still wired and active across 50+ sites in `app.html`; the trial-expired overlay still renders Creator $19 / Pro $39 / Studio $99 — pricing that contradicts marketing. Magic-link sign-in TTL is 60 minutes with single-use tokens; this is the most likely cause of forwarded-link "expired" reports. Daily Brief / Today is privacy-safe: anonymous users see hardcoded showcase copy (`"Your reach has collapsed 65% in 28 days..."`); the API call is gated client-side by email presence. Most urgent v9.113 work: extend the Voice DNA gate to every API endpoint, normalize all checkout/pricing surfaces to "$39/month, no trial, cancel anytime", and replace the broken legacy trial system with the Position B pattern. **No kill switch fired in v9.112.**

---

## 0 — LIVE VERIFICATION (ANONYMOUS USER)

> **CRITICAL HONESTY DISCLOSURE:** I cannot run a live browser, navigate to staging, or open an incognito window in this environment. The observations below are **code-derived projections** of what an anonymous visitor would see, with citations to the exact source. This is **not a substitute for actual browser testing.** Joey or Amanda should run through the steps below in a real incognito window and validate or correct each finding before treating PART 0 as authoritative.

### 0.1 — Marketing landing → app handoff (code-derived)

CTA `<a href="/app" class="qs-cta">Start with SAM →</a>` at `index.html:359` and `:521`. `vercel.json:30-32` rewrites `/app` → `/app.html` server-side; the URL stays `/app`. No query params, no fragment. No prompt, no email gate before app loads.

### 0.2 — App boot for anonymous user (code-derived)

The IIFE at `app.html:4-11` redirects `/` and `/app.html` to `/` for first-time visitors, but `/app` (post-rewrite, browser still sees `/app`) does NOT match — visitor lands on the full shell.

DOMContentLoaded init at `app.html:12246-12268`:
1. `initPersistentSAM()` — drawer setup
2. `initTrial()` — for true anonymous (no `sam-trial` localStorage), all branches no-op (returns at line 10325)
3. `initChat()`, `initWizard()`, `initHeroVisibility()`
4. `hydrateUserCacheBootstrap()` — early-returns when no email cached
5. At +400ms: `openWorkshop()` only fires if both `sam_uid` and `samFirstRunDone` set — anonymous: no-op

**Visible to anonymous in first 2 seconds:**
- Quiet Studio shell, rail with SAM lightning mark + "Studio · v0.4"
- Top strip "Sign in" + "See plan" buttons (`app.html:6566-6572`)
- "Today" dashboard with hardcoded showcase content (`app.html:6962-7032`):
  - "Three things SAM thinks matter most." dek
  - "SAM's Read · This Morning" verdict card with hardcoded "Your reach has collapsed 65% in 28 days — something fundamental broke in your posting rhythm."
  - Three Spine cards (Voice DNA "Active · v1.0", Story Engine "Reading from current state", The Reach "Ready · 4 platforms")
  - "Today's Plan · 3 Actions" with hardcoded copy
- No modal opens automatically. No paywall. No Meet SAM cinematic. No trial-capture overlay.

### 0.3 — Walking the rail as anonymous (code-derived)

| Rail item | Entry behavior (code-derived) | Action behavior (code-derived) |
|---|---|---|
| **Today** | `closeWizard()` only — already on dashboard | n/a — placeholder dashboard renders unconditionally (verdict text is hardcoded fallback per §F) |
| **Talk with SAM** | `openTalkWithSAM()` (`app.html:11134`) opens the persistent SAM drawer | Sending a message hits `/api/sam` mode `chat` — chat is **unlimited** per `api/sam.js:170-174` (rate-limit code commented out). For anonymous (`userId === 'anon'`), `api/sam.js:80` skips profile load; the call **runs full Anthropic compute** and streams a response |
| **Voice DNA (1)** | `openVoiceTrainer()` opens the trainer modal/canvas | UI shows "Please sign in to use Voice Trainer" (`app.html:12811`) — **the canonical Voice DNA pattern reference.** API rejects via `api/voice-trainer.js:33` requiring email |
| **Story Engine (2)** | `openWizardPage()` opens the wizard at Step 0; `_samPrefillWizard()` no-ops without cached user; the SAM-brain pre-fill helper retries 3× for a name | Step navigation (Continue/Back) runs client-only; wizard saves to localStorage (`saveWizardState`); on Step 12 `buildPlaybook()` POSTs `/api/sam` with `mode:'playbook'` — `api/sam.js:166-168` rate-limits `playbooks` per tier (free=5/day) but **does not require auth or paid status**. For anonymous: tier defaults to `'free'`, KV counter is keyed to `userId` which is the anon device fingerprint; full Anthropic playbook compute runs. **No clean Voice-DNA-style gate.** |
| **The Reach (3)** | `openTool('reach')` shows the Reach canvas | Generate hits `/api/reach` — no auth check, runs full compute |
| **All Tools** | `openQSDrawer()` opens the drawer (z-index 1000, above wizard) | Selecting a tile calls `closeQSDrawer()` then `openTool('<canvas-tool>')` — see canvas tool rows |
| **My Ideas** | `openIdeasPanel()` (`app.html:11849`) — pure localStorage view (`sam-ideas` key). No API call | None |

Inside All Tools drawer (post-v9.111.4 with Spark relocated):

| Drawer tool | Entry | Action | Endpoint | Voice DNA match |
|---|---|---|---|---|
| Pulse | Tool canvas opens | `runPulse()` → `/api/sam` mode `pulse` | `api/sam.js` | No — runs compute |
| Spark | Tool canvas opens | `runSpark()` → `/api/sam` mode `spark` | `api/sam.js` | No — runs compute |
| Blueprint | Tool canvas opens | `runBlueprint()` → `/api/sam` mode `blueprint` | `api/sam.js` | No — runs compute |
| Vision | Tool canvas opens | `runVision()` → `/api/sam` mode `vision` | `api/sam.js` | No — runs compute |
| Lens | Tool canvas opens | `handleFile()` upload → `/api/sam` mode `lens` | `api/sam.js` | No — runs compute |

### 0.4 — Story Engine specific test (code-derived projection)

For an anonymous walkthrough of all 12 steps:
- Steps 0–11 all render and accept input. Wizard state persists to localStorage on each `showWizardStep()` call (line 13201 includes `_samSaveSession()` in the chain) — this is what v9.111.2's close-button save relies on.
- Step 12 calls `buildPlaybook()` which POSTs `/api/sam` with `mode:'playbook'`. The API path:
  - `api/sam.js:75` — `userId` defaults to `req.body.userId || req.headers['x-forwarded-for'] || 'anon'`
  - `api/sam.js:107` — `if (userId && userId !== 'anon')` short-circuits profile load for anon (no Supabase fetch)
  - `api/sam.js:167-168` — `checkLimit(userId, tier, 'playbooks', tourStep)`. For anon, tier='free'; KV daily counter blocks at 5/day. For first request: allowed.
  - The Anthropic compute then runs with no `sam_context`, no `voice_profile`, no name. The model receives the bare `WS` payload from the client.
- **The "hang" Joey reported:** likely the Anthropic call is succeeding but the response is generic (no brain context → bland output) and slow (60s `maxDuration`, no streaming for `playbook` mode based on grep). Frontend probably waits the full 60s before either rendering a poor result or timing out client-side. Confirm by adding a temporary `console.time` around the Step 12 fetch call — flagged as v9.113 instrumentation candidate.
- After hang/close: `window._trialExpired` is set on `initTrial()` ONLY if `state.trialStart` is older than 7 days. Anonymous fresh visitor has no trialStart, so `_trialExpired` stays false — the trial-expired overlay does NOT fire for fresh anonymous. (Joey's prior report of seeing the trial card likely came from a user with a stale `sam-trial` localStorage from earlier testing.)

### 0.5 — Magic link flow (code-derived)

- Sign-in entry: top-strip "Sign in" → `openSignInModal()` (`app.html:16997`) builds a modal with email field
- Submit calls `sendMagicLink(email)` → POST `/api/auth` action `send_magic_link`
- `api/auth.js:18-72`:
  - Auto-creates user in KV with `paid:false, trialStart:Date.now()` if not found (`:27-39`) — silent trial creation
  - Generates 32-byte hex token, stores `session:<token>` in KV with `ex: 3600` (60 min TTL) (`:43`)
  - Resend POSTs an email with link `${SITE_URL}/app?token=${magicToken}`
  - Returns `{success:true, message:'Magic link sent'}`
- User clicks link in email → `/app?token=...` → `checkMagicLinkToken()` (`app.html:16925`)
- POST `/api/auth` action `verify_token` (`api/auth.js:75-98`):
  - Reads `session:<token>` from KV — if missing, returns 401 `{error:'expired', message:'This link has expired. Request a new one.'}`
  - **Single-use:** `kv.del('session:<token>')` after success (`:91`). Any subsequent click on the same link gets "expired".
- Successful verify writes user cache, claims anon chat history, sets `samFirstRunDone:true`, redirects to `/app`.

**Most likely "expired" causes** (deeper analysis in §D):
1. Email link previewers (Outlook Safe Links, Gmail link checkers, anti-phishing scanners) consume the single-use token before the user clicks
2. Forwarded emails — recipient clicks after the original (and the link checker) already consumed the token
3. 60-minute TTL exceeded for users who don't check email immediately

### 0.6 — Trial card surfaces inventory (code-derived)

| Surface | Code location | Trigger | Status |
|---|---|---|---|
| `#trialOverlay` capture modal | `app.html:10391` (`openTrialCapture`), markup further down | Called from `guardedRunFn` when no email; from "Tell SAM your story" CTA at `:6626`; from "Try SAM free" CTA at `:7573`; from `closeProPage()` "Try it free" buttons (`:15511`, `:15678`) | Active |
| `#paywallOverlay` post-trial paywall | `app.html:10511` (`showPaywall`) | Called by `guardedRunFn` for expired trial; PDF download attempts; tool run after expiry | Active |
| `showTrialExpiredCard()` overlay | `app.html:10462-10493` | Fires when `window._trialExpired` set (set in `initTrial` if elapsed > 7d); also fires after wizard open if flag set (`:8423`, `:12699`) | Active. Renders Creator $19, Pro $39, Studio $99 buttons + "7-day guarantee · Cancel anytime · No surprises" — **contradicts $39 marketing** |
| Hero CTA copy "Tell SAM your story — it's free →" | `app.html:6626` | Always visible on hero | Active legacy copy |
| "Try SAM free — no card, no catch →" | `app.html:7573` | Visible on a tools landing card | Active legacy copy |
| Trial badge `"7 days free" / "2 days left" / "Trial ending"` | `app.html:10382-10383` | Rendered next to nav identity when state has `trialStart` | Active for anyone with stale `sam-trial` localStorage |
| Pricing cards "Founding member rate · 7-day guarantee" | `app.html:15516-15580` | Visible inside `openProPage` modal | Active legacy copy |

---

## A — API GATING INVENTORY

| API file | Auth check | Paid check | Anon error behavior | Notes |
|---|---|---|---|---|
| `api/sam.js` | No | No (only tier-based daily counter on `mode==='playbook'`) | Runs full Anthropic compute for `userId='anon'`. Profile-load block skipped (`:107`). 429 only on playbook overage | Founder bypass `j.pirrone@yahoo.com` (`:37`); dev bypass `dev-*` (`:33`); tour bypass `tourStep 0–5` (`:41`); KV failure → fail open (`:60`) |
| `api/voice-trainer.js` | **Yes** — requires email | **Yes (implicit)** — only writes to existing `sam_users` row | 400 `{error:'email required'}` for missing email; 400 for missing profile; 500 on Supabase failure | **Reference Voice DNA pattern.** Email required for `clear` and `save` actions |
| `api/voice.js` | No | No | Runs full compute, returns voice profile | No gating |
| `api/voice-status.js` | Soft (email optional) | No | Returns `{calibrated:false}` for missing email | Read-only status |
| `api/pdf.js` | No | No | Runs Puppeteer + Anthropic compute regardless | No gating; 60s `maxDuration` |
| `api/daily-brief.js` | Soft (email required for personalized brief) | No | Returns `FALLBACK_BRIEF` JSON for missing/invalid email (`:241`, `:250`) | Email-keyed Supabase brief fetch + Anthropic synthesis |
| `api/reach.js` | No | No | Runs Anthropic compute regardless | No gating |
| `api/reach-status.js` | Email required | No | Returns 400 for missing email | Read-only |
| `api/ear.js` | No | No (cron-driven endpoint) | Runs full external scrape + Anthropic compute | Cron-only intended use; HTTP open |
| `api/ear-signals.js` | No | No | Returns Supabase signals | Read-only |
| `api/auth.js` | n/a | n/a | 400 invalid email; auto-creates user on `send_magic_link` | Silent trial-account creation on first sign-in attempt |
| `api/me.js` | Email required | No | Returns 400 for missing email; null user for not-found | Fail-open on Supabase error (`:40-41`) |
| `api/memory.js` | Soft (userId required) | No | Returns 400 for missing userId | Persistent chat history |
| `api/wizard-save.js` | Email required | No | Returns 400 for missing email | Used by Story Engine save |
| `api/story-engine-save.js` | Email required | No | Returns 400 for missing email | Step progress save |
| `api/story-engine-status.js` | Email required | No | Returns 400 for missing email | Read-only status |
| `api/trial-status.js` | Email or uid required | n/a (this IS the trial gate) | Fail-open: returns `{allowed:true}` on error (`:50-51`) | Server-side 7-day trial gate; calls from `guardedRunFn` |
| `api/stripe-checkout.js` | No | n/a | Plan whitelist only | No `trial_period_days` set |
| `api/stripe-webhook.js` | Stripe-signed | n/a | 400 on invalid signature | Handles `checkout.session.completed`, broken `customer.subscription.deleted` (no email in metadata) |
| `api/elevenlabs.js` | No | No | Runs paid TTS compute regardless | Used by "Hear SAM" button |
| `api/analytics-insight.js` | No | No | Runs Anthropic compute regardless | No gating |
| `api/attribution.js` | No | No | Logs telemetry | No gating |
| `api/brief-outcome.js` | Email required | No | 400 missing email | Telemetry |
| `api/email-token.js` | Token required | No | 400 missing token | Email signup verification |
| `api/generate-email.js` | No | No | Runs compute regardless | No gating |
| `api/outreach-daily.js` / `outreach-reddit.js` / `outreach-youtube.js` | Cron-secret check (need to verify) | n/a | n/a | Cron-driven; should not be HTTP-callable |
| `api/pulse-context.js` | Email required | No | 400 missing email | Read-only |
| `api/stats.js` | No | No | Returns aggregate stats | Read-only |
| `api/tool-context.js` | Email required | No | Null context for missing | Read-only |
| `api/users.js` / `all-users.js` | No (admin endpoints) | n/a | Lists users — **should be admin-gated** | Flag for v9.113: protect or remove from public deployment |
| `api/waitlist.js` | No | n/a | Records waitlist email | Open by design |

**Net effect:** the only true Voice DNA-pattern gate is `api/voice-trainer.js`. Every other expensive-compute endpoint either runs unconditionally for anonymous users or has a soft "email required" check that returns a fallback rather than rejecting.

---

## B — TOOL-LEVEL GATING (UI)

| Tool | Entry behavior | Action behavior | API endpoint | Voice DNA match | Code reference |
|---|---|---|---|---|---|
| Today / Daily Brief | Hardcoded showcase verdict renders unconditionally | `fetchDailyBrief()` early-returns when no email; otherwise GETs `/api/daily-brief` | `api/daily-brief.js` | **Partial** — anon doesn't trigger the call (early return), but the API itself is open | `app.html:7419-7444` |
| Voice DNA | `openVoiceTrainer()` opens trainer modal | "Please sign in to use Voice Trainer" toast; API rejects unauthenticated | `api/voice-trainer.js` | **Yes** — reference pattern | `app.html:12811`, `api/voice-trainer.js:33` |
| Story Engine | `openWizardPage()` opens wizard at Step 0 | All 12 steps run client-side; Step 12 POSTs `/api/sam` mode `playbook` (rate-limited per tier but no auth check) | `api/sam.js` | **No** — runs full compute for anon | `app.html:8398-8420`, `api/sam.js:166-168` |
| The Reach | `openTool('reach')` opens canvas | `runReach()` POSTs `/api/reach` | `api/reach.js` | **No** | `api/reach.js` (no gates) |
| The Spark | `openTool('spark')` opens canvas | `runSpark()` POSTs `/api/sam` mode `spark` | `api/sam.js` | **No** | `api/sam.js` (only playbook gated) |
| The Lens | `openTool('lens')` opens canvas | `handleFile()` POSTs `/api/sam` mode `lens` | `api/sam.js` | **No** | same |
| The Blueprint | `openTool('blueprint')` opens canvas | `runBlueprint()` POSTs `/api/sam` mode `blueprint` | `api/sam.js` | **No** | same |
| The Vision | `openTool('vision')` opens canvas | `runVision()` POSTs `/api/sam` mode `vision` | `api/sam.js` | **No** | same |
| The Pulse | `openTool('pulse')` opens canvas | `runPulse()` POSTs `/api/sam` mode `pulse` | `api/sam.js` | **No** | same |
| Talk with SAM | `openTalkWithSAM()` opens persistent drawer | `sendPersistentMessage()` POSTs `/api/sam` mode `chat`; chat is unmetered | `api/sam.js` | **No** — chat runs full compute for anon | `app.html:11134`, `api/sam.js:170-174` |
| My Ideas | `openIdeasPanel()` reads `sam-ideas` localStorage | None — pure local | n/a | n/a (no compute) | `app.html:11849` |
| PDF download | Triggered from playbook bottom bar | POSTs `/api/pdf` with full document HTML | `api/pdf.js` | **No** — runs Puppeteer regardless | `api/pdf.js` (no gates) |
| Hear SAM (TTS) | `hearSAMBrief()` button on Today | POSTs `/api/elevenlabs` | `api/elevenlabs.js` | **No** — runs paid TTS for anon | `app.html:7128-7137` |

---

## C — LEGACY 7-DAY TRIAL CARD (ACTION DECISION)

### C1 — Inventory of 7-day trial references

**JS state + logic (active code paths):**
- `TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000` — `app.html:10090`
- `getTrialState()` / `saveTrialState()` — `app.html:10094-10099`
- `initTrial()` — `app.html:10313-10336`
- `openTrialCapture()` — `app.html:10391-10398`
- `submitTrialEmail()` — `app.html:10418-10460`
- `showTrialExpiredCard()` — `app.html:10462-10502` (renders the deprecated $19/$39/$99 modal)
- `showPaywall(context, force)` — `app.html:10504-10548`
- `checkTrialBeforeRun()` — `app.html:10551-10562`
- `checkWizardLimit()` — `app.html:10576-10584`
- `guardedRunFn()` — `app.html:10656-10704` (active wrapper for tool runs; calls `/api/trial-status`)
- `updateTrialBadge()` — `app.html:10338-10389` (renders countdown badge in nav)
- `hydrate` shim writing legacy `sam-trial` from `sam-current-user` — `app.html:10162-10165`

**API logic:**
- `api/auth.js:34, 102, 116` — write `trialStart` on save_user/send_magic_link
- `api/stripe-webhook.js:46` — preserves `trialStart` on paid users (vestigial)
- `api/me.js:32` — derives `trialStart` from `created_at`
- `api/trial-status.js` — entire file is the server-side trial gate

**UI strings (visible to users):**
- `"Tell SAM your story — it's free →"` — `app.html:6626`
- `"Try SAM free — no card, no catch →"` — `app.html:7573`
- `"Already paid? Sign in →"` — `app.html:10495`
- `"Your free trial is up."` — `app.html:10474`
- `"7-day guarantee · Cancel anytime · No surprises"` — `app.html:10492`
- Pricing card system prompt referencing $29/$39/$99 — `app.html:10720-10727`
- `"7 days free"`, `"2 days left"`, `"1 day left"`, `"Trial ending"` badges — `app.html:10382-10383`
- `"Upgrade for unlimited runs — from $29/month, cancel anytime"` — `app.html:14060`
- Pricing cards "Founding member rate" — `app.html:15516-15580`
- `"Pay once a year and get 2 months free. Creator $190/yr · Pro $390/yr · Studio $990/yr. Coming soon."` — `app.html:15591`
- `"Creator plan from $29/month — cancel anytime"` — `app.html:15697`
- `"Start 24hr free trial →"` — `app.html:16860`, `:16910`
- `"Your 48-hour free trial is now active. All 5 tools, no card needed."` — `app.html:17113`

### C2 — Kill decision

**No kill switch fired in v9.112.**

The trial-expired overlay (`showTrialExpiredCard()` at `app.html:10462`) and the trial-capture overlay (`#trialOverlay` opened by `openTrialCapture()`) appear superficially safe to disable (pure UI, contradict marketing), but **fail criterion 3** (no real existing trial customers depend on this UI rendering):

- Server-side trial gate at `api/trial-status.js` is independent and still active. It will block tool runs for any user with `created_at` older than 7 days regardless of UI.
- If the trial-expired overlay is killed but the server gate stays, an existing trial user past 7 days would experience: tool clicks → server returns `allowed:false` → `guardedRunFn` calls `showPaywall('tool')` → paywall renders. That paywall (`#paywallOverlay`) is a separate surface from `showTrialExpiredCard()`, so this isn't the catastrophic case I initially feared. But killing one trial-related modal in isolation creates inconsistent UX (some legacy trial users see one modal, others see another).
- The clean path is to retire the entire trial system in v9.113 in one coordinated pass — server gate, all UI overlays, all copy, all state. Position B replaces it.

**Action: documented; no code change in v9.112.** All trial UI surfaces and call sites listed above become input to the v9.113 plan §G3.

---

## D — MAGIC LINK "EXPIRED" BEHAVIOR

### Implementation

- **File:** `api/auth.js` (the only magic-link surface)
- **Functions:** `send_magic_link` action (`:18-72`) issues; `verify_token` action (`:75-98`) consumes
- **TTL:** 3600 seconds = **60 minutes** (`api/auth.js:43`)
- **Token format:** 32-byte hex via `crypto.randomBytes(32).toString('hex')`
- **Single-use:** Yes — `kv.del('session:' + token)` after successful verify (`:91`)
- **Storage:** `@vercel/kv` keyed at `session:<token>`
- **Email path:** Resend → `${SITE_URL}/app?token=<token>` where `SITE_URL` defaults to `https://samforcreators.com` (`:57`)
- **Welcome-email magic link** (post-payment): generated in `stripe-webhook.js:54-56` with **24-hour TTL**, points at `https://samforcreators.com?token=...` — note this lands on the **marketing landing**, not `/app`, and `index.html` has no token handler. **Welcome-email magic links are silently broken.**

### Likely root causes (ranked)

1. **Email link previewers consume single-use tokens before the human clicks.** Outlook Safe Links, Microsoft Defender for Office 365, Gmail link previewer, Slack/Discord unfurlers, anti-phishing scanners — any of these GETs the link will trip `verify_token` (which is currently a POST, mitigating this somewhat). **However:** review `api/auth.js:75-98` — `verify_token` is wired to a POST action via `req.body.action`. The magic link in the email is a GET URL (`/app?token=...`) handled by `checkMagicLinkToken()` in `app.html:16925-16967` which makes the actual POST. So preview bots that only follow the GET URL would NOT consume the token; they'd hit the static `/app` page. **This means cause #1 is unlikely** — but only if the static `/app` HTML doesn't auto-fire `verify_token` on load. Check `app.html:16935`: it does fire `verify_token` automatically on DOMContentLoaded if `?token=` is present. **Therefore: any bot that loads `/app?token=...` (including a preview crawler that fetches HTML) will execute the JS and consume the token.** This is a real likely cause.
2. **60-minute TTL too short.** Users who triage email later in the day, or forward to themselves to click on a different device, often blow past 60 minutes. Compare with Slack (30 days), Notion (30 days), Linear (1 hour but with re-request flow). For a quiet-studio creator who doesn't live in their inbox, 60 minutes is aggressive.
3. **Forwarded emails** — recipient clicks after the original recipient (or their inbox's link checker) has already consumed the token.
4. **Welcome-email magic links** point to `/` (marketing landing), which has no token handler, so the token is silently dropped. User may then re-request from `/app` and get a "no account found" or expired flow.

### Fix scope estimate

- **Small (config change):** bump TTL to 24 hours (change `ex: 3600` → `ex: 86400`); change welcome-email URL to `/app?token=...`; add a `?token=` handler to `index.html` that redirects to `/app?token=...`.
- **Medium:** make tokens multi-use within their TTL (remove the `kv.del` at `auth.js:91`, add a use-counter or rely on TTL expiry).
- **Large:** switch to a Supabase Auth or third-party (Clerk, Descope, Auth0) flow — replaces the entire magic-link mechanism.

**Recommended for v9.113:** Small fixes first (TTL bump + welcome-link URL fix + landing token redirect). If "expired" reports persist, consider Medium (multi-use tokens within TTL). Large is overkill for now.

---

## E — STORY ENGINE STEP 12 BEHAVIOR (ANON VS AUTH)

### Final synthesis path

- **Front-end function:** `buildPlaybook()` — search-confirmed in `app.html` (the function that fires on Step 12 "Build playbook" CTA)
- **API route:** POST `/api/sam` with `mode: 'playbook'` and the wizard's `WS` state
- **Auth/paid checks:**
  - `api/sam.js:33` — dev bypass for `userId.startsWith('dev-')`
  - `api/sam.js:37` — founder bypass for `j.pirrone@yahoo.com`
  - `api/sam.js:41` — tour bypass for `tourStep 0–5`
  - `api/sam.js:107` — `if (userId && userId !== 'anon')` short-circuits Supabase profile load (anon gets no brain context)
  - `api/sam.js:167-168` — `checkLimit(userId, tier, 'playbooks', tourStep)` rate-limits at 5/day/free, 10/day/creator, 20/day/pro, 100/day/studio. Anon counter keyed on the random `anon-<random>` userId (different per visitor)
  - **No auth check.** No paid check. **A bare `userId='anon'` request runs full Anthropic compute.**

### Anonymous hang explanation

Anonymous flow at Step 12:
1. `buildPlaybook()` POSTs `/api/sam` with `userId='anon'` (or an `anon-*` fingerprint), `tier='free'`, `mode='playbook'`, full `WS` payload
2. `api/sam.js:107` — anon skips profile load → `userProfile = null`
3. `api/sam.js:111-160` — `trackUser` / `trackEvent` skipped for anon (`:107` guard)
4. `api/sam.js:167` — `checkLimit('anon-xxx', 'free', 'playbooks', null)` returns `allowed:true` for first request (KV counter increments to 1)
5. Anthropic call fires with the bare WS payload, no `sam_context`, no `voice_profile`, no name. Per `vercel.json:43-44`, function `maxDuration` is 60s; Anthropic `claude-sonnet` synthesis on a sparse prompt typically returns in 25-45s.
6. Front-end has no streaming for `mode:'playbook'` (no SSE handler in `buildPlaybook` based on grep). It awaits the JSON response.
7. **Why "trying again" UI:** there's likely a client-side retry wrapper that catches network errors or non-200 responses and re-fires. With a slow successful response, the retry logic might kick in mid-flight if the client uses a short timeout. Without instrumenting, this is the strongest hypothesis.
8. If Anthropic returns a generic-looking playbook (because no brain context), the user sees a bland output. If retry timeout is shorter than synthesis duration, the user sees "SAM is trying again..." indefinitely while requests pile up against the 5/day rate limit.

### v9.113 recommendation

**Gate at Step 1, not Step 12.** Reasoning:
- Walking 12 steps then hitting a wall is the worst possible UX. The user has invested 5–10 minutes of effort.
- The brain-context-less playbook output is bad regardless — even if it returns, it doesn't represent SAM's real value.
- Voice DNA pattern: open the wizard, accept input, but reject the Step 12 synthesis call with "Subscribe to use Story Engine — $39/month" and preserve their 12-step input via existing `_samSaveSession()` so they can resume after subscribing.
- Alternative compromise: gate at Step 1 entry but show the visual structure of Story Engine (what it is, what it does), then "Subscribe" CTA. Less invested, less commitment.

Either approach requires `api/sam.js` to add an auth+paid check on `mode==='playbook'` (and probably all modes — see §G1).

---

## F — TODAY / DAILY BRIEF DATA SOURCE & PRIVACY

### Data source

- **Hardcoded fallback verdict** — `app.html:6973-6974`:
  - `<div class="qs-dash-sams-read-verdict">Your reach has collapsed 65% in 28 days — <span class="qs-dash-sams-read-verdict-emphasis">something fundamental broke</span> in your posting rhythm.</div>`
- **Hardcoded fallback body** — `app.html:6975-6981`: hardcoded showcase paragraph about "post 4 times a week with a strong hook…"
- **Client-side replacer** — `fetchDailyBrief()` at `app.html:7419-7444`:
  - Reads email from `getTrialState()` (`:7427-7430`)
  - **Early-return on missing email** (`:7433`) — anonymous users never trigger the API call
  - Otherwise GETs `/api/daily-brief?email=<email>&timezone=<tz>&date=<today>`
  - On success, calls `updateSamsRead(data)` to replace the verdict/body text
  - On failure: `catch` block has comment `/* leave hardcoded fallback */` — keeps the showcase
- **Server `api/daily-brief.js`:**
  - Email-keyed Supabase fetch at `:36-44` — pulls `sam_users` row by `email=eq.<email>`
  - Cached-brief fetch at `:46-51` — pulls `sam_daily_briefs` filtered by email AND date
  - `:241, :250, :272, :281` — returns `FALLBACK_BRIEF` for missing/invalid email or missing profile

### Privacy assessment

| User state | What renders | Source | Verdict |
|---|---|---|---|
| Anonymous (no localStorage) | Hardcoded showcase ("65% reach collapse" / "fix the rhythm") | Static HTML at `app.html:6973-6981` | **Safe — intentional demo content** |
| Logged-in unpaid | Hardcoded fallback initially; then `/api/daily-brief` is called with their email; for users without a brief in `sam_daily_briefs`, `getCachedBrief` returns null → API returns `FALLBACK_BRIEF` (server-side fallback at `:272`) → `updateSamsRead` replaces with that fallback text | API-driven, scoped to user's email | **Safe — no cross-user contamination** |
| Logged-in paid (with brief) | Personalized brief from `sam_daily_briefs` (synthesized by Anthropic + Supabase data) | API-driven, scoped to user's email | **Safe — only their own brief** |

**Stop-gate verdict: SAFE.** The hardcoded "65% reach collapsed" verdict is intentional showcase content shown to anonymous viewers. No cross-user data crossing. No accidental personal-data leakage observed in code paths. The `fetchDailyBrief()` early-return on missing email is the key guarantee — the API never fires for true anonymous, so even if the API had a leak, it wouldn't manifest for anon.

**Caveat / minor concern:** if a user signs out (clears `sam-trial` and `sam-current-user`) but a previous fetch already replaced the DOM verdict via `updateSamsRead()`, the personalized verdict might persist visually until page reload. This is a transient risk on shared devices. Worth flagging for v9.113 to add a "clear DOM on sign-out" step. Not urgent.

---

## CHECKOUT COPY STOP-GATE — PRICING/TRIAL DRIFT INVENTORY

Per the brief: surfacing every active reference to legacy tiers, founding pricing, or trial language in the purchase/checkout path. **No silent normalization in v9.112.**

### Legacy tier references (Creator / Pro / Studio with $19, $29, $39, $99)

| Location | Code |
|---|---|
| `app.html:10482` | Trial-expired overlay — Creator $19/mo button |
| `app.html:10485` | Trial-expired overlay — Pro $39/mo button |
| `app.html:10488` | Trial-expired overlay — Studio $99/mo button |
| `app.html:10523, 10528` | Paywall sub copy: "Starting at $29/month" |
| `app.html:10722-10724` | SAM chatbot system prompt — full Creator $29 / Pro $39 / Studio $99 tier list |
| `app.html:14060` | Tooltip copy "Upgrade for unlimited runs — from $29/month" |
| `app.html:15333, 15354, 15375, 15396, 15414` | Pricing card line-through "standalone" prices ($29, $19, $39) |
| `app.html:15533` | Pricing card button "Get Creator — $29/month →" |
| `app.html:15556` | Pricing card button "Get Pro — $39/month →" |
| `app.html:15579` | Pricing card button "Get Studio — $99/month →" |
| `app.html:15591` | Annual rates: "Creator $190/yr · Pro $390/yr · Studio $990/yr" |
| `app.html:15697` | Waitlist perk "Creator plan from $29/month — cancel anytime" |
| `api/stripe-checkout.js:3-7` | `PRICE_IDS = { creator: price_1TIgdXPxFeJSVKwnRl61mdwZ, pro: price_1TIgeCPxFeJSVKwnUCOfzsm1, studio: price_1TJa2VPxFeJSVKwn9aDPPENS }` |
| `api/stripe-checkout.js:33` | `metadata: { plan, name }` — no fixed plan |
| `api/stripe-webhook.js:33` | `amount: plan === 'creator' ? 19 : plan === 'pro' ? 39 : 99` (note Creator=$19 here, contradicts $29 in app.html) |
| `api/stripe-webhook.js:73` | Notification email amount: `$${plan === 'creator' ? '19' : plan === 'pro' ? '39' : '99'}/month` |
| `api/stripe-webhook.js:88` | Welcome email subject `Welcome to SAM ${plan.charAt(0).toUpperCase() + plan.slice(1)}` |

### "Founding member" language

| Location | Code |
|---|---|
| `app.html:15516` | "✦ Founding member rate" badge |
| `app.html:15522` | "Founding rate — locked in for life" |
| `app.html:15534, 15557, 15580` | "🔒 Founding rate · 7-day guarantee · Cancel anytime" |
| `app.html:15539` | "⚡ Most popular · Founding rate" |
| `app.html:15562` | "✦ Founding rate · Power creators" |
| `api/stripe-webhook.js:88` | Welcome email body: "Your founding member rate is locked in forever." |

### Trial language in checkout/purchase path

| Location | Code |
|---|---|
| `app.html:10492` | Trial-expired overlay: "7-day guarantee · Cancel anytime · No surprises" |
| `app.html:15534, 15557, 15580` | All three pricing cards: "7-day guarantee" |
| `app.html:16860, 16910` | "✦ Start 24hr free trial →" |
| `app.html:17113` | "Your 48-hour free trial is now active. All 5 tools, no card needed." |

### Inconsistencies

- **Creator pricing is internally inconsistent across three surfaces:** trial-expired overlay says $19; pricing card says $29; webhook tracking writes $19. None match the marketing-stated single $39 price.
- **Trial duration varies:** 7-day (most surfaces), 24-hour, 48-hour (Ideas export flow).
- **Welcome-email magic link** at `api/stripe-webhook.js:90` points at `https://samforcreators.com?token=...` — marketing landing, no token handler.

**Action: surfaced. No edits in v9.112. All become inputs to v9.113 §G3.**

---

# Proposed v9.113 Paywall Plan

## G1 — API CHANGES

Extend the Voice DNA pattern (auth + paid check + clean error) to every endpoint that currently runs expensive compute for anonymous or unpaid users.

| Endpoint | Current behavior | Target | Complexity |
|---|---|---|---|
| `api/sam.js` | No auth check; tier rate-limits only on `mode==='playbook'`; chat/spark/blueprint/vision/lens/pulse all run for anon | Add 401 if no email; add 402 if `paid:false`; clean JSON `{error:'auth_required'\|'paid_required', message:'...'}` | **Medium** — touches 7 modes + branding inside _context |
| `api/pdf.js` | No checks | Add 401/402 gate; PDF only for paid | **Small** |
| `api/daily-brief.js` | Email required (soft); fallback for missing | Add 401 for missing email; gate brief synthesis behind `paid:true`; return showcase fallback for unpaid | **Small** |
| `api/reach.js` | No checks | Add 401/402 gate | **Small** |
| `api/voice.js` | No checks | Add 401/402 gate (mirror `voice-trainer.js` pattern) | **Small** |
| `api/elevenlabs.js` | No checks | Add 401/402 gate (TTS is paid compute) | **Small** |
| `api/analytics-insight.js` | No checks | Add 401/402 gate | **Small** |
| `api/generate-email.js` | No checks | Add 401/402 gate | **Small** |
| `api/users.js` / `api/all-users.js` | Public | **Restrict to admin** (server-secret header check) or remove from production deployment | **Small** |
| `api/outreach-*.js` | Need to verify cron-secret check | Confirm cron-secret guarded; if not, add | **Small** |
| `api/auth.js send_magic_link` | Auto-creates user with paid:false on unknown email | Decision: keep auto-create OR require pre-existing user. If keep: clearly mark these as "interest signups" not "trial accounts" | **Small** |
| `api/trial-status.js` | Active 7-day server gate | **Remove entirely** as part of trial system retirement | **Small** |
| `api/stripe-checkout.js` | 3 plans (creator/pro/studio); no `trial_period_days` | Single `pro` plan with one canonical $39 price ID; rename to "standard"; success_url → `/app?payment=success` (not marketing landing); add email to `subscription_data.metadata` (fixes broken cancellation handler) | **Small** |
| `api/stripe-webhook.js` | Handles checkout.session.completed; `customer.subscription.deleted` broken (no email in metadata) | Reduce to single $39 plan; fix cancellation by reading email from Stripe customer object instead of metadata; welcome-email link → `/app?token=...` (not `/`) | **Small** |

## G2 — UI GATING CHANGES

Voice DNA pattern: tool surface opens, primary action attempts, API rejects with clean message.

| Tool | Missing pattern step | Where the gate should live |
|---|---|---|
| Story Engine | API rejection on Step 12 (currently runs full compute) — **and** entry-time soft prompt at Step 0 ("Sign in to save your story across devices") | Action-level: API rejection caught by `buildPlaybook` → `Subscribe to use Story Engine` modal; preserve WS via existing `_samSaveSession` |
| The Reach | Action rejection | Action-level on `runReach()` |
| The Spark | Action rejection | Action-level on `runSpark()` |
| The Lens | Action rejection | Action-level on `handleFile` upload |
| The Blueprint | Action rejection | Action-level on `runBlueprint()` |
| The Vision | Action rejection | Action-level on `runVision()` |
| The Pulse | Action rejection | Action-level on `runPulse()` |
| Talk with SAM | Action rejection on send | Action-level on `sendPersistentMessage`; allow viewing history but reject new messages |
| Today / Daily Brief | None — already safe (hardcoded fallback for anon) | Confirm cleanup of any DOM-persistence on sign-out |
| PDF download | Action rejection | Action-level on `printToolOutput` |
| Hear SAM (TTS) | Action rejection | Action-level on `hearSAMBrief` |

**Required modal — auth/upsell:**
- Two-state modal: (A) "Welcome back — sign in" with email field (existing `openSignInModal`); (B) "Subscribe to use SAM — $39/month" with Stripe checkout button.
- API rejection messages should signal which state to show: `error: 'auth_required'` → State A; `error: 'paid_required'` → State B.
- Brand-consistent: SAM lightning mark, Instrument Serif heading, teal CTA, cream surface.
- Modal heading "Start with SAM" must match landing CTA exactly (verbal+visual continuity).

## G3 — TRIAL LANGUAGE REMOVAL

After v9.113 server-side gate is in place, retire the entire trial system.

**Code paths to remove:**
- `TRIAL_DURATION_MS`, `TRIAL_EMAIL_MS`, `TRIGGER_DELAY_MS` constants — `app.html:10090-10092`
- `getTrialState()`, `saveTrialState()` — `:10094-10099`
- `initTrial()`, `updateTrialBadge()`, `openTrialCapture()`, `submitTrialEmail()`, `showTrialExpiredCard()`, `checkTrialBeforeRun()`, `checkWizardLimit()` — `:10313-10584`
- `guardedRunFn()` legacy paywall paths — replace with simple "fetch and handle 401/402" wrapper
- 50+ `getTrialState()` call sites across `app.html`
- Legacy `sam-trial` localStorage shim in `writeUserCache` — `:10162-10165`
- `api/trial-status.js` — delete file
- `api/auth.js` — remove `trialStart` field writes
- `api/stripe-webhook.js:46` — remove vestigial `trialStart` preservation
- `api/me.js:32` — remove `trialStart` derivation

**UI strings to update — replace with "$39/month, no trial, cancel anytime" or remove:**
- `app.html:6626` "Tell SAM your story — it's free →" → "Start with SAM →"
- `app.html:7573` "Try SAM free — no card, no catch →" → "Start with SAM →"
- `app.html:10474` "Your free trial is up." → delete (overlay deleted)
- `app.html:10495` "Already paid? Sign in →" → keep, move to auth modal
- `app.html:10720-10727` SAM chatbot system prompt — rewrite pricing block to "$39/month one price"
- `app.html:14060` "Upgrade for unlimited runs — from $29/month, cancel anytime." → "Subscribe to use this tool — $39/month, cancel anytime."
- All "Founding member rate" / "Founding rate" badges (8 instances in `app.html:15516-15580`) → remove
- `app.html:15591` annual rates → defer or remove
- `app.html:15697` "Creator plan from $29/month" → "$39/month"
- `app.html:16860, 16910` "Start 24hr free trial →" → delete
- `app.html:17113` "Your 48-hour free trial is now active." → delete

**Pricing card markup (`app.html:15410-15585`):** reduce three-card layout to single $39 card. "One price. Every tool. No caps. Cancel anytime."

## G4 — STORY ENGINE BEHAVIOR DECISION

**Recommendation: gate at Step 1 entry, not at Step 12 synthesis.**

Reasoning:
- Walking 12 steps then hitting a wall is the worst possible UX (5–10 min of wasted user effort).
- Anonymous Step 12 already runs Anthropic compute (per §E) but produces a brain-context-less generic playbook — bad even when it succeeds.
- Position B says "gate at the action, not the door" — but Story Engine's "action" is structurally the entire 12-step interaction. The "primary action" is starting the wizard at all.

**Implementation:**
- `openWizardPage()` checks `getCurrentUserCached()`. If unauthenticated → show auth modal (Voice DNA pattern). If authenticated but `paid:false` → show "Subscribe to use Story Engine — $39/month". Otherwise → open as normal.
- Existing `_samSaveSession()` preserves wizard state across sign-in (already wired). After successful sign-in/payment, user lands back at `/app` and can resume from saved step.

## G5 — DAILY BRIEF / TODAY BEHAVIOR DECISION

**Recommendation:**
- **Anonymous:** keep hardcoded showcase verdict (already privacy-safe per §F). No change.
- **Logged-in unpaid:** show showcase verdict (same as anon) — do NOT call `/api/daily-brief`. Personalized briefs are paid-only. Add an inline "Subscribe to get your real daily brief" CTA below the showcase.
- **Logged-in paid:** existing `fetchDailyBrief()` flow — call `/api/daily-brief`, render personalized brief.
- **Sign-out cleanup:** add a `clearDailyBriefDOM()` call in the sign-out flow that resets the verdict element back to the hardcoded fallback text. Prevents stale personal data persisting in DOM after sign-out on shared devices.

## G6 — MAGIC LINK FIX

**Recommended scope: Small (config + URL fixes).**

Changes:
1. `api/auth.js:43` — bump TTL from 3600 to 86400 (24 hours)
2. `api/auth.js:56-57` — update email copy from "60 minutes" to "24 hours"
3. `api/stripe-webhook.js:90` — change welcome-email link from `https://samforcreators.com?token=...` to `https://samforcreators.com/app?token=...`
4. `index.html` — add a small inline script that detects `?token=` in URL and redirects to `/app?token=...` (covers any legacy email links still floating around)
5. **Defer Medium/Large fixes** until forwarded-link reports persist after the Small fix lands.

Optional follow-up if v9.114 still sees expired reports:
- Make tokens multi-use within TTL (remove `kv.del` at `auth.js:91`, expire via TTL only).
- Add a "Resend link" button on the expired-link error page.

## G7 — RISKS & UNKNOWNS

1. **`api/stats.js`, `api/users.js`, `api/all-users.js`** — these may be admin endpoints exposed publicly. Need confirmation before exposing in production. Flag for v9.113 sweep.
2. **`api/outreach-*.js` cron endpoints** — declared with `maxDuration: 60-180s` and registered as crons in `vercel.json`. Need to confirm they reject non-cron HTTP callers (Vercel cron secret header check).
3. **Stripe dashboard cleanup is parallel work, not in v9.113 code.** Joey must archive the legacy $19/$29/$99 prices in Stripe dashboard, confirm the canonical $39 price has no `trial_period_days`, and update `api/stripe-checkout.js` to point at the canonical price ID. v9.113 code lands assuming this dashboard work is already done.
4. **Existing trial users in KV/Supabase.** Any users with `paid:false, trialStart:<old>` rows will be stranded by the trial system retirement. v9.113 needs a migration plan: either (a) treat them as "interest signups" with no compute access until they pay, or (b) honor their remaining trial days during a transition window.
5. **Talk with SAM gating breakage.** Currently Talk with SAM is the only "always works" surface and acts as the friendly entry point. Gating it behind paid:true will close that door — risk of users feeling a sudden chill. Consider keeping read-only history visible but blocking new sends.
6. **Voice DNA's "Please sign in to use Voice Trainer" is a string-by-string pattern.** Standardizing across 11 tool surfaces requires either a shared component or a copy-paste pass. Choose deliberately for v9.113 — the shared component costs more upfront but pays back in v9.114+.
7. **Position B presumes the rail is freely browsable.** If marketing later wants to capture email at the door, that's a different architecture (Position A or hybrid) and would require revisiting this audit.
8. **Magic-link single-use vs. preview-bot scenario.** Cause #1 in §D depends on `app.html:16935` auto-firing `verify_token` from `?token=` GET — needs a quick browser test (preview a sample email link with Outlook Safe Links proxy in front and observe whether the token gets consumed). If confirmed, change the auto-fire to require a button click ("Continue signing in") rather than firing on page load.

---

## APPENDIX

### Files generated/touched in v9.112

- `sam-audit-v9.112.md` — this file (created)
- No `app.html`, `index.html`, or `/api/*` modifications in v9.112

### Open follow-ups not covered by §G

- `index-legacy.html` (46.7KB), `index.html.bak` (847KB), `meet.html` (42.8KB) — legacy files in repo root. Confirm whether they are intentionally retained or should be moved to an `/archive` folder.
- `api/stats.js`, `api/users.js`, `api/all-users.js` admin-style endpoints (see §G7.1).
- `app.html:8403` `openProPage()` redirects to a Vercel preview URL `sam-app-git-quietstudio-joeypirronedesigns-1029s-projects.vercel.app` — broken/stray reference.
- `app.html:4-11` early-redirect IIFE — dead defensive code now that routing is via `vercel.json` rewrites.

### Reference: where the Voice DNA gate lives

`api/voice-trainer.js` — full file (50 lines). The reference implementation:
```js
// for action 'clear' or 'save':
const uid = body.email && String(body.email).trim().toLowerCase();
if (!uid || !uid.includes('@')) return res.status(400).json({ error: 'email required' });
```
Plus the corresponding UI pattern in `app.html:12811`:
```js
document.getElementById('vtError').textContent = 'Please sign in to use Voice Trainer.';
```

This pattern — server returns 400/401 with a clear error key, client renders a clean "Please sign in to use [Tool]" message — is what v9.113 generalizes across every endpoint and every tool surface.
