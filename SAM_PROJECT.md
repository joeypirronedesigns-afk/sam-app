---
name: sam-project
description: Full context skill for SAM for Creators (samforcreators.com). Load this for ANY task involving the SAM app — coding, deployment, debugging, marketing, email, product decisions, or feature work. Trigger whenever Joey mentions SAM, the app, the codebase, quietstudio branch, Vercel, Supabase, Resend, Stripe, or any SAM feature by name (Pulse, Story Engine, Voice DNA, Persona Lab, The Reach, Execution Pack, Codex builder, Daily Brief, etc). This is the authoritative project brain — always load before acting.
---

# SAM for Creators — Project Skill

## Who Joey Is
- Solo developer and sole paid customer of SAM for Creators
- Self-taught DIY creator, Detroit-based, monetized on Facebook, active on YouTube/TikTok/Facebook
- Primary content series: From Studs to Sanctuary (gut renovation of a 1950s Maryland cottage)
- Works via two-model workflow: Claude Code (Sonnet, execution) + Claude/Opus (strategy/architecture)
- Also uses Perplexity as design/UX consultant for second opinions
- Hard rules: No suggestions to take breaks, no over-cautioning, no "are you sure" rituals. Diagnose, plan, execute.
- Prefers surgical prompts for Claude Code over broad rewrites
- Runs Supabase migrations via dashboard SQL editor (not scripted)
- Joey is the hands. Claude is the brain. Always output Claude Code prompts to paste — never ask Joey to do manual steps.

---

## The Product: SAM for Creators

URL: samforcreators.com
What it is: An AI tool for content creators that turns lived moments into a full content system — beats, shots, platform remixes.
Pricing: $39/month. One plan. Cancel anytime. No free trial.
Stripe payment link: https://buy.stripe.com/eVqeVfgkOajocUX2Dp8Zq00

### Core Features
- Today — Daily dashboard. SAM reads posting patterns and surfaces what matters most.
- Talk with SAM — Persistent chat interface
- Voice DNA — Captures writing voice. Stores traits. Banned phrases. V21+ with trait versioning. Three entry points: top nav, Workshop tile, FAB chat header.
- Story Engine — 12-step guided wizard. Outputs: full script, shoot plan, B-roll shots.
- The Reach — Platform-specific content adaptation (TikTok, YT Shorts, YouTube, Reels, Facebook, LinkedIn, X)
- Persona Lab — Codex builder (ARCHIVIST). Sections: Overview, Canon Events, Contradictions, Beliefs & Mythologies, Voice Signatures, Banned Phrases.
- Execution Pack — Production command center in left rail. Empty state: CTA to run Story Engine. Active state: hook/next-move preview + Build Execution Pack button + 6 Remix format cards (Top 5, Before vs After, What I Wish I Knew, The Mistake, One Tool One Result, No Crew).
- All Tools — Tool drawer: Pulse, Spark, Blueprint, Vision, Lens
- My Ideas — Saved ideas
- The Pulse — Core tool. Input: platform selector + content format + moment textarea. Output: Full script, shoot plan, B-roll.

### SAM Visual Identity
- Colors: White bg (#FAFAF7), light gray (#F4F2EC), teal accent (#20808D), dark text (#1A1815), secondary (#4A4640), muted (#8B8680), border (#E5E2DB)
- Typography: Instrument Serif italic for headings, Inter for UI, JetBrains Mono for code
- Sidebar: Left nav, 220px wide. Sections: DAILY, BUILD SAM'S BRAIN, STUDIO, MORE, EXECUTION PACK
- Version stamp: data-qs-version attribute on div[data-qs-shell] — bump on every commit
- Current version: v9.118.74+

---

## Tech Stack

- Hosting: Vercel
- Database: Supabase (with RLS)
- Payments: Stripe
- AI: Anthropic API (Claude)
- Email: Resend
- Cache: Vercel KV
- Auth: Supabase Auth + magic links

Repo: github.com/joeypirronedesigns-afk/sam-app
Local path: /Users/giuseppepirrone/Desktop/sam-app
Deploy branch: quietstudio (auto-deploys to Vercel preview on every push)
Production URL: https://samforcreators.com
Vercel CLI: Installed at /opt/homebrew/bin/vercel, logged in as joeypirronedesigns-1029

---

## Current Version: v9.118.68

### Key Architecture Decisions Made
- No free trial — Patch O removed it. Paid or blocked. trial-status.js returns allowed:false for all unpaid users.
- Single plan — $39/month, one plan, cancel anytime
- KV as auth source of truth — /api/me.js checks KV first (paid status) then merges with Supabase
- Dual-write for ideas — sam_ideas uses service role key + idempotent upserts on (user_id, idea_id)
- All upgrade CTAs point to Stripe — openProPage() opens buy.stripe.com link directly
- Mobile hamburger nav — .qs-rail.rail-open at z-index 9500, overlay at 9499
- Persona Lab gated behind paid check — navigateToPersonaLab() does fresh /api/me check on click

### Recent Patches (v9.118.x)
- Patch K — Stripe billing portal endpoint (api/billing-portal.js) + Manage subscription button for paid users
- Patch M through M.8 — Execution Pack feature: rail section, drawer, 6 remix cards, caching, copy/save buttons, localStorage persistence across refresh
- Patch N/N.1 — Wired Stripe payment link to all upgrade CTAs, replaced old Vercel preview URL
- Patch O — Removed free trial. api/auth.js, api/trial-status.js, app.html all updated.
- Patch P — Fixed paywall silent abort for signed-in unpaid users
- Patch Q through Q.3 — Persona Lab gating: fresh /api/me check, 404 handling, both not_found and codex_not_seeded redirect to /persona-lab/build
- Patch R — Mobile hamburger menu
- Patch S — Name field added to sign-in modal, passed to auth API
- Patch T — Welcome email redesigned with Quiet Studio light theme, correct magic link URL (/app?token=), onboarding copy
- Security — SQL injection fix in memory.js:257, Stripe webhook uses service role key for Supabase upsert
- Patch U (v9.118.53) — Story Engine: shared STORY_RULES (beat jobs, no invention, exact numbers, payoff = meaning, short CTA + sign-off) in playbook + architecture/script regens; story_core + gaps in schema; hook copied into opening in code; hashtag rule + platform specs added to playbook prompt; lead magnet grounded in creator's own learning; SSE line-buffer fix for dropped words (streamCall + tool stream); all section regens sync _lastPlaybookData; architecture Redo re-renders hook and rewrites script; hook Redo updates Opening; 'Make it stronger' gaps card in app + PDF; PDF page numbers computed (no gaps); b_roll printed as Shot List page
- Patch V (v9.118.54) — api/keepalive.js daily cron 09:17 UTC (writes keepalive:last to KV, reads sam_users from Supabase; 500 + log if either fails). STORY_RULES: stakes/outcomes/feelings count as facts → gaps. Payoff card 18 words, meaning not event. Lead magnet title must match 5 items, no restating SAM's internal rules. Step-3 story reflection (generateStoryReflection) rewritten: plain, no praise, names what's missing.
- Patch W (v9.118.55) — Step 3: reflection may end with QUESTION:, shown as 'SAM needs one thing' with an answer box; answer is appended to the moment via getStoryForPlaybook() (playbook + regens). Buffered readSamReply() replaces two unbuffered step-3 stream loops. URL guard in streamCall corrects near-miss spellings of domains the creator typed. parseScriptBeats scales timings by word count (fast 170 / natural 150 / slow 125 wpm); architecture cards in app + PDF use them. Magic links on preview deployments use the preview host.
- Patch X (v9.118.56) — Fact-check pass (factCheckPlaybook, Haiku 4.5, 15s timeout, fails open) after playbook + script regens: removes script/caption sentences not supported by the creator's words + answers; listed in app as "Removed — not in what you told SAM". STORY_RULES: 5-second moment first, six story types (mistake_lesson, transformation, demo_proof, origin, behind_the_scenes, moment_reflection) mapped onto the six beats, craft checks (but/therefore, specificity, show-then-say, peak-end, open loop). Schema: story_type, five_second_moment (shown under diagnosis in app + PDF "Story Shape"). Step 3 interview: up to 3 QUESTION lines (moment, stakes, ending), each with an answer box (WS.gapQA). api/sam.js maxDuration 120s. Eval: tests/story-eval/cases.json (10 cases) + scripts/story-eval.js (12 automatic checks, results in tests/story-eval/results/).
- Patch Y (v9.118.57) — Fact-check: lines ≥80% made of the creator's own words are never removed; lessons/meaning drawn from the creator's events count as supported. enforceHookOpening(): script Opening beat always starts with the hook (paraphrase replaced, else hook prepended). Eval scorer: ordinals, compound numbers, 'one' ignored, number context shown, multi-type expectations, thin case exempt from six_beats. Baseline before Patch Y: 109/120 (91%).
- Patch Z (v9.118.58) — STORY_RULES 10: no notes/placeholders in hook/script/captions; thin stories get a short honest draft. Server strips placeholder lines, blanks placeholder hooks, sets parsed.is_draft. 'Draft' banner on the script (app + PDF) when no 5-second moment. Scorer: 13th check no_placeholders; 'first'/'second' no longer counted as numbers. Eval after Patch Y: 116/120 (97%).
- Patch Z.3 (v9.118.59) — Too-thin stories: server clears placeholder architecture cards/captions and sets needs_more when there is no moment and nothing honest to write; app shows 'SAM needs more before it can write this' with SAM's questions and an 'Add details to my story' button (back to step 2), hides empty architecture/platform sections. Scorer: needs_more counts as correct for the thin case (and as a failure for full stories). Eval after Patch Z: 125/130 (96%).
- Patch Z.4 (v9.118.60) — Number guard (numbersInText / guardNumbersInScript in api/sam.js): after the fact-check, any script/caption sentence with a number not in the creator's words is cut (never empties a beat); '250k' = 250,000; 'one'/'first'/'second' ignored; 'two' as a counting word allowed. Cuts are listed with the fact-check removals. Scorer uses the same rules. Eval after Patch Z.3: 128/130 (98%) — both misses were invented numbers.
- Patch Z.5 (v9.118.61) — needs_more = five_second_moment is 'not found' (SAM's judgment), not placeholder text matching; when set, hook, architecture, script and captions are cleared and the app shows the needs-more section. Eval after Z.4: 126/130 (97%) — thin case wrote unrecognised meta text; tomato 'a fourth' (from 'three summers') left on an architecture card, accepted as arithmetic.
- Patch Z.6 (v9.118.62) — Hook + architecture cards with untraceable numbers get a targeted Haiku rewrite (rewriteWithoutNumbers, 10s, fails open), re-checked; cards fall back to dropping the offending sentence. Logged in fact_check.rewritten. Runs before hook enforcement so the script still opens with the (fixed) hook. Scorer: 'two' counting-word exception applies to SAM's output only, not the story. Eval after Z.5: 127/130 (98%) — 'six words' and '100% my fault' survived on hook/cards; '2 weeks' was a scorer bug.
- Patch Z.8 (v9.118.63) — Craft rules: creator's last word (final qualifier/contradiction) stays in the payoff; don't explain the punchline (end on the creator's line). Bug: rewritten hook now replaces the old hook in the script (was duplicated); second number-guard pass after hook enforcement. Scorer: must_keep + hook_said_once. Hard set before Z.8: 41/42 — deck dropped 'I still wouldn't underbid again', chicken explained the punchline and duplicated the hook; food truck graded A.
- Patch Z.9 (v9.118.64) — 'two' counting exception no longer covers durations (two weeks/days/years…) in server + scorer. Captions use _removeCaptionSentences (a fully unsupported paragraph can be removed). Fact-check returns hook_unsupported; Z.6 rewrite now also fixes unsupported hook claims (e.g. 'the thing that saved me'). Hard set after Z.8: 47/48 — deck A, food truck A− (hook claim 'saved me'), chicken B+ ('two weeks' in hook, '30 seconds' in a caption, one line after the punchline). Watching: one explanatory line after a punchline.
- Patch Z.10 (v9.118.65) — Craft: hooks built from a concrete detail the creator gave (no vague teases, no invented contrasts); a closing aside/callback is the comic button and stays the last spoken line. Fact-check now reads architecture cards and returns arch_unsupported → same targeted rewrite as hook (rewrite prompt told to stay concrete). Scorer: 'grand' = ×1000 and server-equivalent number tolerance. Hard set after Z.9: 47/48 — deck A, food truck A (only miss was scorer reading 'twenty-two grand'), chicken A− (vague hook after rewrites, button moved to setup). NEXT SESSION: paywall/session-token fix (top priority), then hook/button re-check on the hard set.
- Eval after Z.10: hard set 48/48 (100%). Deck A, chicken A (concrete hook 'walked out in her pajamas and got Biscuit into the coop in one try', ends on her line, 'It leans a little' is the last spoken line), food truck A− (see bug below).
- Patch AA (v9.118.66) — SECURITY. api/_session.js: magic-link verify issues a 30-day HttpOnly Secure SameSite=Lax cookie (sam_session) backed by KV auth:<token>. _gate.js trusts the cookie email; founder bypass only for a verified founder session when enforcing; dev- bypass disabled in production when enforcing. Callers pass req (sam, pdf, reach, analytics-insight, voice, daily-brief, elevenlabs); Persona Lab (_lab_access) uses resolveIdentity. auth.js: whoami + logout actions; save_user can no longer set paid/tier (only stripe-webhook can). email-token.js admin-only (it minted a login link for ANY email). ear.js requires CRON_SECRET when set. signOut() calls logout. Rollout: SAM_GATE_ENFORCE unset = soft (cookie wins, legacy logged as [gate] legacy identity); =1 = cookie required. 16/16 unit tests.
- Patch AA also turned OFF the Apify + Anthropic scanners (Joey saw no benefit): /api/ear and /api/outreach-daily removed from vercel.json crons; ear, outreach-daily, outreach-reddit, outreach-youtube return 410 unless SAM_OUTREACH_ENABLED=1. Consider cancelling the Apify plan.
- Patch AB (v9.118.67) — api/_platforms.js: current limits incl. hashtags (YouTube title 100 / description 5,000, TikTok 4,000, Instagram 2,200 + max 5 hashtags since Dec 2025, Facebook 2,200, LinkedIn 3,000, X 280, Threads 500) + visible-preview lengths; platformPrompt() replaces the old PLATFORM_SPECS text; hashtagRule defers to per-platform ranges. enforcePlatforms() runs on every parsed result: hashtags moved out of captions into the field, deduped and capped per platform, caption+hashtags trimmed at a sentence to the limit, YouTube title (no hashtags, ≤100, falls back to hook), `limits` object → app/PDF show "Caption 412 / 2,200 · 4/5 hashtags". Schema + platforms regen ask for a YouTube title. Sign-off rule: always the very last line. Number guard + scorer read "22 thousand". Scorecard: SAM_EVAL_COOKIE (sam_session value) for enforced logins; hashtags_per_platform + captions_within_limit replace hashtags_max_4.
- Patch AB.1 (v9.118.68) — Corrected per Joey: YouTube Shorts upload has ONE 100-character box for hook line AND hashtags together; the long description is a separate optional field (`description`). Every platform now gets one short, intriguing HOOK line (a tease, not a summary) + 3 hashtags (X 2, Threads 1); target length = what shows before "more" (TikTok ~80, IG/FB ~125). Shorts: SAM asked for ~65-char hook + short hashtags (~30 chars for all 3); if it still overflows, the longest hashtag is dropped (min 2) before the hook is trimmed. `title` field removed. App/PDF show "Hook + hashtags 81 / 100 · 3 hashtags" or "112 chars — fits before 'more'", and an "Optional description" block for YouTube. Copy button pastes the Shorts line as one line.
- Patch AC (v9.118.69) — Logo in PDF: app shrinks the uploaded logo on the device (max 240px, JPEG if large) and keeps it across refreshes (localStorage `sam_brand_logo`); pdf.js draws it on both covers (40pt) and every page header (14pt), accepting only a data:image base64 under 300k (no injection). Brand name falls back to the account name, then 'SAM for Creators' — never 'Your Brand'. sam.js: lookalike domains with accents ('sáforcreators.com') are fixed to the real domain; new `tidySpoken()` removes sentences with [link]/[url]/(link) placeholders (never empties a line), drops an unfinished fragment at the end of a beat ('I just..'), and moves the creator's own sign-off (a 5+ word sentence found in their voice profile/context) to the very end of the CTA beat. Prompt: no link placeholders; button goes before the sign-off. Scorer: no_placeholders now catches [link]/(link) and dangling fragments; hashtag check skipped for needs_more results.
- Patch AD (v9.118.70) — From Joey's PDF 36 review. Logo: stored on the account (auth actions save_logo/get_logo, KV `logo:<email>`, session-only, data:image base64 <300k) and restored on page load into WS + the upload preview; uploads before AC were never saved, so the PDF showed the initial. Shorts: a run of hashtags at the end of the hook line is removed (it was turned into plain words: 'Then 250k views hit. DIY CottageRebuild Reno #DIY...'). Opening beat: a shorter restatement of the hook right after it ('I spent months rebuilding a cottage for my parents.') is swapped out like a paraphrase. PDF: hashtags and counts on separate lines; arrows (no glyph in PDF fonts) print as dashes; the free guide splits across pages (~1,500 chars/page) instead of spilling its footer onto a blank page. pacing_note/hook_why/visual_note that quote a line not in the script are dropped.
- Patch AE (v9.118.71, shipped together with AD as one patch) — Sign-off: new optional 'Your sign-off' field in the brand step (WS.signOff + localStorage `sam_sign_off` + account KV `signoff:<email>` via auth save_signoff/get_signoff), sent as `signOff` on playbook, regen and getBase calls; prompt says the script ends with it word for word, and tidySpoken enforces it: said once, always the last spoken line of the CTA beat. Links: a web address appears in script/captions/description/CTA card only if the creator gave it for THIS story (moment, steer, wizard STEERS line) — profile/handle domains alone don't count (PDF 37: 'Find the full community at samforcreators.com' for a Facebook group). Domains are protected from the sentence splitter (it cut 'site.com' at the dot).
- Patch AF (v9.118.72) — Free guides (Joey: the audience shouldn't read 'why this works for your audience'). New `intro` field (1-2 sentences TO the audience, first person, only claims the creator made); `why` is creator-only. Standalone lead-magnet PDF: cover shows intro, no why, no 'Share This' comment. Playbook PDF: intro under the title; why + comment to post go in a dashed 'Notes for you — not part of the guide' box at the end. Worksheet bodies keep line breaks: '|' rows → real tables (blank rows = fill-in rows), [ ]/☐ → printable boxes, underscore lines → write-on lines; guides paginate by estimated printed lines (LM_PAGE 42, 80 chars/line) and continue an oversized item onto the next page. Regenerate prompt (app, 'chat' mode) gets honesty rules + worksheet format. Internal story-type keys (moment_reflection etc.) replaced in diagnosis/hook_why/focus text and in the PDF. Open: guide claims are prompt-guarded only, not fact-checked in code.
- Patch AG (v9.118.73) — Free guides checked in code: factCheckGuide (Haiku, parallel with the script fact-check in playbook mode; also on the Regenerate button via chat mode `guideCheck` + `guideSource`) removes intro/item sentences that state things about the creator not in the story or promise results ('the tracker I wish I'd had', 'will save you thousands'); worksheet lines are never sent or touched; a body is never emptied; fails open. fixGuideTitle: 'The One Thing…' with 5 items → 'The 5 Things…'. Story cards: schema asks for first person (I/my, never he/his). Numbers: an untraceable small number word that had to stay (beat's only sentence, failed hook/card rewrite) is softened to 'a few' ('Six words on a sticky note' → 'A few words…'). Empty script beats are filled from their card. Scorecard misses (marathon empty beat, sticky 'six words') addressed by these two; re-run to confirm.
- Patch AH (v9.118.74) — Scorecard after AG: main set 170/170. Fix: AG's number softening turned 'Thirty-six dollars' into 'Thirty-a few dollars' — a number word after a hyphen, dot or tens word is now left alone.
- Follow-ups from the AA audit: optionally set CRON_SECRET (locks /api/keepalive to Vercel's scheduler); api/me.js and api/memory.js still accept email from the body for reads/writes (privacy, move to resolveIdentity next); CORS '*' on auth endpoints can be tightened.

### Open Task List (v9.118.x)
- NEXT SESSION (in order):
  1. DONE in Patch AA (v9.118.66) — finish rollout: sign in via fresh magic link, confirm whoami, then set SAM_GATE_ENFORCE=1 in Vercel and redeploy.
  2. DONE in Patch AB — Platform-aware captions: per-platform fields (YouTube title + description, TikTok, Reels, Facebook) with character limits that COUNT hashtags (e.g. YouTube title 100 incl. hashtags), per-platform hashtag counts replacing the global 3–4 rule (they currently conflict for YouTube), code-enforced trimming, live "92/100" counts in the UI. Verify current platform limits by web search before hardcoding.
  3. DONE in Patch AC — Brand logo in PDF: app.html (~L17509) sets brandLogo: null ("base64 causes 413") and api/pdf.js never renders a logo. Shrink the logo client-side (~200px) and draw it on the cover + headers. Fall back to the account name, not "Your Brand", when brandName is empty.
  4. DONE in Patch AC — No placeholder links: "[link]" appeared in a YouTube caption when no CCU link was given. Add to placeholder detection; with no link, write the CTA without one.
  5. DONE in Patch AB — Number guard bug: "22 thousand" (digit + multiplier word) parses as 22 and 1000, so the true line "borrowed 22 thousand dollars from my dad" was cut. Combine digit + hundred/thousand/million/grand in numbersInText and the scorer.
  6. Small card embellishments still slip through ("built a coop all summer", "a nail through my foot", food truck payoff "My wife didn't say don't"). Consider a stricter card check.
  7. Note: on the chicken story the model tried an invented "30 seconds vs weeks" hook 4+ times per run; guards block it, but consider prompt reinforcement to save tokens.
  8. Re-run both scorecards after each change.
  9. ADDRESSED in Patch AG (re-run to confirm) — Scorecard misses at 168/170 (AB): marathon case had an empty beat (six_beats); sticky-note case kept 'six words' somewhere. Investigate with --only --show.
  10. Joey's AB.1 Story Engine PDF (YouTube Shorts / Facebook / Instagram) still to review for hook lines and counts.
- Later — 'connection to this' wizard question only if founder/role detection keeps missing
- SECURITY — api/_gate.js trusts email/userId from the request body: anyone sending the founder email, or a userId starting with 'dev-', bypasses the paywall and spends the Anthropic key. Fix: verify a server-issued session token instead of body fields.
- Workflow — run `SAM_EVAL_EMAIL=... node scripts/story-eval.js` before and after every Story Engine change; compare overall %.
- Hard set — `SAM_EVAL_EMAIL=... node scripts/story-eval.js --cases tests/story-eval/cases-hard.json --show` (two turns, no resolution, buried moment). --show prints each playbook for craft review; must_not_say per case. Eval after Patch Z.6: 130/130 (100%) on the main set.
- Ops — Production KV is the Upstash store named 'temp-restore' (restored 2026-10-05 from sam-kv backup 2026-07-20). Do not delete it. Preview magic links now use the preview host (Patch W).
- T1 — Server telemetry sink: POST /api/telemetry + sam_telemetry table
- T2 — Step 0 prefill diagnostic log
- T4 — Fix localOnly undercount (after T1)
- T13 — SAM confused-narrator voice in chat-generated posts
- T14 — Enrich :fail telemetry payloads with error context
- T18 — Composer drafts list / retrieval UI
- Post-launch: Behavior-triggered emails 2 and 3, rate limiting on auth/write endpoints, XSS innerHTML fix

---

## Email Setup (Completed May 16 2026)

joey@samforcreators.com is a permanent public-facing email. Anyone can send to it. It forwards to samforcreators@gmail.com with the original sender in Reply-To.

### Architecture
1. Email sent to joey@samforcreators.com
2. Porkbun DNS MX to inbound-smtp.us-east-1.amazonaws.com (priority 10, TTL 600)
3. Resend domain receiving: enabled and verified
4. Resend fires webhook to https://samforcreators.com/api/email/forward
5. Webhook ID: 6826d0cc-8f9e-4ffd-9533-5dc6db6e83d0
6. Function fetches full email content via GET /emails/receiving/{email_id} using RESEND_ADMIN_KEY
7. Forwards to samforcreators@gmail.com

### File
api/email/forward.js — committed on quietstudio branch (commit bde7a09)

### What Was NOT Affected
- Outbound email (welcome emails, magic links, Stripe receipts) uses RESEND_API_KEY send-only key — untouched
- noreply@samforcreators.com sending still works normally
- Porkbun changes only removed fwd1/fwd2.porkbun.com (Porkbun's own unused forwarding service)

---

## Key Environment Variables (All in Vercel)

- RESEND_API_KEY — Send-only key, outbound emails
- RESEND_ADMIN_KEY — Full access, manages webhooks, fetches inbound email content
- GMAIL_FORWARD_ADDRESS — samforcreators@gmail.com
- RESEND_DOMAIN — samforcreators.com
- SUPABASE_URL — Supabase project URL
- SUPABASE_ANON_KEY — Public/client-facing reads
- SUPABASE_SERVICE_ROLE_KEY — Server-side RLS bypass
- STRIPE_SECRET_KEY — Live key
- STRIPE_WEBHOOK_SECRET — Webhook signature verification
- KV_REST_API_URL + KV_REST_API_TOKEN — Vercel KV (Redis)

---

## Supabase Tables

- sam_users — SELECT/UPDATE/UPSERT, key: email, ANON reads/SERVICE_ROLE writes
- sam_conversations — SELECT/INSERT/DELETE, key: user_id (= email), ANON writes with RLS
- sam_ideas — SELECT/INSERT/UPDATE/DELETE, key: user_id + idea_id, SERVICE_ROLE only, unique constraint on (user_id, idea_id)
- sam_voice_samples — SELECT/INSERT, key: user_id, SERVICE_ROLE only
- sam_telemetry — INSERT only, SERVICE_ROLE, append-only log
- sam_persona_lab — SELECT/INSERT/UPDATE, key: user_email, SERVICE_ROLE + assertPersonaLabUser gate
- sam_daily_briefs — SELECT/UPSERT, key: email + brief_date, SERVICE_ROLE only

---

## Auth Flow

1. User enters email + name in sign-in modal
2. POST /api/auth with action: send_magic_link — creates KV record user:{email} with paid: false, tier: free
3. User clicks magic link -> POST /api/auth with action: verify_token -> returns live KV record
4. onAuthSuccess(data.user) writes to localStorage via writeUserCache()
5. 24h cache TTL — getCurrentUserCached() returns from localStorage within TTL
6. hydrateUserCacheBootstrap() fires on page load — calls /api/me for fresh data
7. /api/me checks KV first (authoritative paid status), merges with Supabase

Founder bypass: j.pirrone@yahoo.com — KV: paid: true, tier: founder
Dev bypass: sam_dev localStorage flag

---

## Stripe Webhook Flow (api/stripe-webhook.js)

1. checkout.session.completed fires
2. Extracts plan, email, name from session
3. Direct service role upsert to sam_users in Supabase (bypasses RLS)
4. Writes KV record: { paid: true, tier: plan, paidAt, stripeCustomer }
5. Creates 24h magic link token
6. Sends welcome email via Resend (Quiet Studio light theme, /app?token= URL)
7. Sends notify email to Joey

---

## DNS (Porkbun)

- A: samforcreators.com -> 216.150.1.1
- CNAME: www.samforcreators.com -> 80356f47d385ee60.vercel-dns-017.com
- MX: samforcreators.com -> inbound-smtp.us-east-1.amazonaws.com (priority 10, TTL 600)
- MX: send.samforcreators.com -> feedback-smtp.us-east-1.amazonses.com (priority 10)
- TXT: resend._domainkey -> (DKIM key for outbound)

Note: fwd1.porkbun.com and fwd2.porkbun.com MX records deleted May 16 2026 — were Porkbun's own forwarding service, not needed.

---

## Claude Code Prompt Template

[CONTEXT: project path, branch, what already exists]

TASK: [specific thing to do]

REQUIREMENTS:
- [list]

Anchor verification before every str_replace.
Diff-before-apply on every edit.
Bump data-qs-version on div[data-qs-shell].
Do not ask Joey to do anything manually.
Run all commands yourself.
Show output of each step.

---

## Marketing Context

### AI Clone Script Structure (6 scenes)
1. AI Joey in ridiculous setting representing the creator problem
2. Chaos escalates — duplicate Joeys, absurdist escalation
3. Time freeze — background desaturates, Joey in full color reframe
4. SAM interface appears — moment transforms into full system
5. Before/After split screen — chaos vs organized SAM calendar
6. CTA — Joey front and center, pointing down. $39/month. One plan. Cancel anytime.

### Target Market
Any content creator building a social media audience. NOT limited to DIY/tradesperson creators.

---

## History Snapshot

- Mar 2026: Creator context migrated from ChatGPT. Core frameworks documented. CCU Creator OS project set up.
- Apr 2026: Voice Trainer feature (7 commits). Identity bug user.uid vs user.email patched. Quiet Studio M1 UI overhaul (15 commits).
- Apr-May 2026: C2 milestone: Persona Lab / Archivist codex builder. My Ideas data-loss bug patched. Dual-write architecture.
- May 2026: v9.118.x sprint: Execution Pack, Stripe wiring, free trial removal, paywall fixes, mobile nav, email forwarding, welcome email redesign. All deployed to production.
