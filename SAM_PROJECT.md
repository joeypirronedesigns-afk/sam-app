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
- Current version: v9.118.77+

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
- Patch AI (v9.118.75) — Retention arc (STORY_RULES rule 11), modeled on the 410-day video (168K 3-sec views, 36% to 1 min, flat curve after 0:10). Hook carries number + who it's for; open loop by second 5; underdog in setup from creator context only (else gap); CTA turns the story to the viewer (22 words max); peak line said once; no added commitment words ('promise'); grief/loss never in hook, caption first line or title; captions echo the hook; series hashtag first. Spec: docs/SAM_STORY_FORMULA.md. Validator + profile fields (Sections 7-8 of the spec) are still open tasks.
- Patch AJ (v9.118.76) — Vercel Hobby plan (Pro dropped Nov 2026): Hobby allows 12 functions per deployment, 2048 MB memory, 300s max. All API code moved unchanged from api/ to server/. api/ now holds 5 functions: sam.js, pdf.js, stripe-webhook.js (thin wrappers requiring server/), stats.js (edge), and router.js, which serves every other /api route via the vercel.json rewrite /api/:path -> /api/router?__path=:path. NEW ENDPOINTS: add the handler to server/ AND a line to ROUTES in api/router.js — a new file in api/ counts toward the 12. pdf.js memory 3009 -> 2048.
- Patch AK (v9.118.77) — Old story bleeding into a new one: after 'Start a fresh story' cleared WS, the /api/me hydration refilled WS.storyText from the account's samContext (the previous story), and generateStoryReflection preferred the localStorage copy over the story box. Fix: startWizard('new') sets WS._freshStart, hydration skips storyText when it's set; reflection reads the on-screen textarea first.
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

## Patch AL — v9.118.78 — Formula map + code-enforced retention arc
- Brand settings: new "Your background" (underdog, creator's words) and "Series hashtag" fields. Stored like the sign-off (localStorage `sam_story_profile` + KV `storyprofile:<email>` via /api/auth save_storyprofile/get_storyprofile). Sent as `storyProfile` on playbook + regen.
- server/sam.js: background is appended to creatorContext (so prompt, fact-check and number guards treat it as creator-stated); series hashtag added to platform context.
- Rule 12 + `formula_map` in the playbook and script-regen schemas: step → exact line → where it came from.
- Code checks after generation: open loop ("Let me explain." inserted after the hook if the opening opens no question), anchor (number/timeframe in hook), viewer turn (CTA speaks to "you"), sign-off (from brand settings), series hashtag (pinned first on every platform in enforcePlatforms, never trimmed). Lines not found in the final script are marked "edited". Missing steps add the spec's reflection question to gaps (max 2).
- New "How SAM used the formula" section in the app (after architecture; refreshed on script Redo) and in the PDF.

## Patch AM — v9.118.79 — Creator's opening wins + honest formula map
- Output 52: SAM replaced the creator's anchor line with an invented "this is day 421" hook (number guard cut it from the script but the hook kept it), so the Opening was truncated and the open-loop check never fired.
- applyCreatorOpening: if the story's first sentence has a number (≤30 words), it becomes the hook unless SAM's hook keeps the same numbers and ≥60% of the words. Opening sentences restating the old hook are removed.
- creatorOpening: the creator's own loop phrase ("Let me explain.") is used for the Open loop; "Let me explain." default otherwise. Loop is inserted after the first sentence when the hook isn't found.
- Formula map: when SAM's quoted line isn't verbatim, the closest sentence in that beat is shown; lines claiming to be from the story are checked against the story — <50% overlap shows "SAM's words — not in your story".
- Prompt rule 12 (creator's own opening); old rule 12 is now 13.

## Patch AN — v9.118.80 — Reflection answers survive navigation
- Revisiting step 3 re-ran the reflection; reworded questions dropped the answers (matched by exact text). Now the reflection + answers are cached per story (WS._reflectKey/_reflectReply) and re-shown without a new API call while the story is unchanged.

## Patch AO — v9.118.81 — Loop said once + wider map matching
- Output 53: "Let me explain." appeared at the end of the Opening and the start of the Setup. dedupeLoop removes the loop phrase from every beat after the Opening.
- Formula map: when a quoted line is not in its own beat, the whole script is searched before marking it "Edited".

## Patch AP — Formula map never quotes across beats
- Output 54: Struggle/Payoff rows showed runs spanning the Turn and Payoff beats. The fallback now searches one beat at a time (own beat first).

## Patch AQ — v9.118.83 — Questions never trigger tools
- "can you tell me about my wife" matched the Pulse "my (wife|dog...)" trigger. detectSAMIntent now returns null for questions (trailing "?" or question opener).

## Patch AR — v9.118.84 — SAM's notebook (real memory)
- Problem: nothing stored personal facts; the chat prompt claimed persistent memory ("tell me once, I've got it") that didn't exist. Chat only sees the last 10–20 messages; brain selfStory is overwritten per story.
- server/_notebook.js (helper, not a function): KV `notebook:<email>` list of {id,text,src,at}, max 80 × 200 chars. extractNotes = one Haiku pass on the creator's latest chat message (adds stated durable facts, forgets ids on request; skips health/money/passwords). applyExtraction dedupes.
- server/sam.js chat: when `notebook: true` and signed in (session cookie), notebook is in the system prompt; extraction runs in parallel with the reply; result carries `noted`/`forgot`. MEMORY & CONTINUITY prompt rewritten to claim only what exists.
- Playbook: notebook appended to wizardContext as BACKGROUND ONLY (never script facts; not in number/fact-check sources).
- server/auth.js: get_notebook / add_note / delete_note.
- app.html: both chat panels send notebook:true and show "📓 Noted: … View notebook"; "What SAM knows about you" modal (add/delete) opened from the brand step or the chat notice. Pulse trigger "my wife/dog/…" now needs a story verb ("my wife just…").

## Patch AS — v9.118.85 — Notebook button in the SAM chat header (📓, next to ↺)

## Patch AT — v9.118.86 — Notebook fills from every story + first-class notebook UI
- Any tool call with a `moment` (Story Engine, Pulse, Blueprint, Vision…; not chat/regen) from a signed-in creator runs one Haiku pass (kind 'story': only lasting life facts, never the story's events; no forgets). Runs in parallel; res.end is held until it finishes. Result carries `notebook_noted`.
- Notebook is background in the shared `base` prompt for every tool (and chat). Notes carry a kind (people, pets, home, work, background, goals, preferences, other); old notes get one from guessCat.
- UI: "4 · SAM's Notebook" in the Build SAM's Brain rail with a count; notebook modal redesigned (how-it-works 3 steps, grouped by kind, source badge: From chat / From a story / Added by you, add with kind, privacy line); "📓 SAM added to your notebook" card on Story Engine output; Noted line after inline tool runs.

## Patch AU — v9.118.87 — Voice DNA evolves with every story
- Voice DNA was frozen (only the Voice Trainer changed it; Joey's was 182 days old). server/_voiceEvolve.js: every new story given to any tool (same hook as the notebook: signed in, has `moment`, not chat/regen) → the creator's own words (story + answers, SAM's questions stripped) saved to sam_voice_samples (source 'story'; exact repeats skipped) → one Haiku pass evolves sam_users.voice_profile from the 12 newest samples (conservative; "No change" allowed) → voice_version + 1.
- Result carries `voice_updated` {changed, version, profile}. App writes the new profile to the user cache immediately (next chat/script uses it), footer shows "Voice synced · just now", Story Engine output shows a "🧬 Voice DNA updated · vN" card with what changed (or "checked — no change"); inline tools show a one-line notice.

## Patch AV — v9.118.88 — SAM knows today's date + notebook sorts itself
- nowLine(req): real date/time in the creator's time zone (cookie sam_tz set by the app; default America/New_York) added to the chat system prompt and the shared tool base prompt.
- Notebook: "✨ Sort for me" default when adding; General notes are re-sorted by guessCat (birthday/heritage/grew up → Background, entrepreneur → Work, sibling → People).

## Patch AW — v9.118.89 — Cleanup from the launch check
- Removed the unreachable v7.94 Photo Wizard (showPhotoWizard never called; it posted to /api/agent, which never existed, and read a client-side FAL key). 282 lines.
- Signed-out Today page: sample SAM's Read and plan are labeled "Example · …" (also restored on sign-out); real briefs replace the label with "SAM'S READ · TODAY".

## Patch AX — v9.118.90 — Chat tells the truth + writes on request
- Date bug: chat built profileContext = nowLine() then overwrote it with "= buildBrainPrompt(...)"; now "+=".
- Server "HOW YOU LEARN": notebook from chat/stories; Voice DNA from new stories + Voice Trainer; chat never changes Voice DNA.
- Persistent chat prompt: removed "every conversation makes you better / always building a sharper picture"; with Voice DNA she never claims to need samples; "make it up / give me an example" → write it immediately and say the details are invented; written pieces exempt from the 2–4 sentence cap.

---
# ▶ HANDOFF — where we left off (2026-11-26, Thanksgiving) — live at v9.118.90

## Working style (keep)
- Joey = hands, Claude = brains. No Claude Code. Claude edits files through the desktop-app bridge; Joey runs git + `vercel --prod` in Terminal, one command at a time.
- Commit only the app files (`git add server app.html SAM_PROJECT.md ...`), never `git add -A` (it swept in 14 .wav files once).
- Vercel HOBBY plan only (12-function limit, daily cron only). New endpoints = a file in server/ + one line in api/router.js ROUTES. Never a new file in api/.
- Explain findings + strategy before shipping anything big. When reviewing SAM outputs: fix SAM, don't hand-polish scripts.

## Still to verify (Joey)
1. After AX deploy: ↺ new chat, ask SAM (a) today's date/time, (b) "make up a Facebook post that sounds like me", (c) "do you learn my voice from chat?" → must answer no (stories + Voice Trainer only).
2. Run one new story through the Story Engine → expect "📓 SAM added to your notebook" + "🧬 Voice DNA updated · vN" cards; sidebar shows "Voice synced · just now".
3. Stripe → Developers → Webhooks: endpoint is https://samforcreators.com/api/stripe-webhook and recent deliveries are 200. (Built-in browser was not signed in to Stripe; Joey to sign in, Claude reads only.)
4. Welcome email: confirm in Resend → Emails, or do a test purchase with a second email and refund it.
5. Add notebook fact: "The cottage renovation started on September 3, 2025." (lets SAM compute the Day count)
6. Brand settings: confirm sign-off text is what Joey wants ("I'm self-taught, documenting everything, and taking you with me." — output 54 showed it trimmed to "Documenting everything & taking you with me.").

## Known small issues (not urgent)
- stripe-webhook's `module.exports.config = { bodyParser:false }` is overwritten by the later `module.exports =` (pre-existing; signature check still works because the handler reads the raw stream).
- Webhook owner-notify email lists Pro as $39 (label only; Stripe price IDs decide the charge).
- Formula map "Struggle" step: SAM sometimes fills it with a commitment line instead of asking — consider a code check.
- CTA "Subscribe…" isn't right for Facebook-first posts — consider platform-aware CTA wording.

## NEXT BUILD — the Performance Loop (SAM's moat)
Story → script → posted video → real results → back into the formula, per creator. Honest comparisons only (n ≥ 5 per side, always show n, "a pattern in your posts", never "proof"; compare to the creator's own median so one viral post can't skew it).

### Phase 1 — loop without Facebook (start here; ~2 sessions; works for every user, no Meta review)
- Supabase tables (Joey runs the SQL in the Supabase SQL editor):
  - `sam_outputs` (id, email, created_at, story, hook, script, captions jsonb, formula_map jsonb, beat timings jsonb, project_day)
  - `sam_posts` (id, email, output_id, platform, post_url, post_id, published_at, length_sec, caption)
  - `sam_post_metrics` (post_id, age_days 1|3|7|28, plays, reach, avg_watch_sec, total_watch_min, reactions, comments, shares, source 'api'|'screenshot', captured_at)
- Save every Story Engine output (end of the playbook finish path in server/sam.js).
- "I posted this" on each output → paste post link (later: pick from Page videos).
- Metrics from a Business Suite screenshot: one Haiku vision call → 3-s views, 1-min views, drop point, comments, shares.
- Insights: hold rate = avg_watch ÷ length; share & comment rate per 1k plays; reach vs creator median. Compare posts with/without each formula step, hook type, viewer-turn, SAM's-words lines, posting hour, length.
- Show it: evidence badges on the formula map ("your posts with an open loop held 41% vs 27%, n=9/6").

### Phase 2 — Facebook connect (Joey's Page first, Meta app in development mode)
- "Connect Facebook Page" (OAuth) → long-lived Page token in Supabase. Fold the daily metrics pull into the existing daily keepalive cron (Hobby = daily only; no new function).
- Reels API gives lifetime plays, reach, avg time watched, minutes viewed, reactions/comments/shares; no documented retention curve for Reels → keep the screenshot path.
- Auto-match new videos to outputs by caption similarity + date; Joey confirms with one tap (never link silently).

### Phase 3 — use it everywhere
- Story Engine prompt block "WHAT WORKS FOR THIS CREATOR (from their own posts)".
- Today page "SAM's Read" from real numbers (replaces the Example card).
- Durable findings into the notebook (e.g. "Audience most active at 7am").

### Phase 4 — public
- Meta App Review + business verification so other creators can connect (weeks).
- YouTube Analytics next (has a real audience-retention curve), then TikTok (views/likes/comments/shares only).
- Later: anonymized cross-creator priors for new users with < 5 posts.

## Review of the 11/26 night story (graded 7/10) — fixes to make BEFORE Performance Loop Phase 1
1. Anchor must include WHO it's for when the story names them ("my parents"). creatorOpening only fires when the story's first sentence is ≤30 words — add: build the anchor from the story's sentence that has the number + person; or regenerate the hook when it lacks the person.
2. Beat-role check: stakes (deadline / promise / cost) must be in the Risk beat; underdog (self-taught, background) in Setup. Formula map flags "misplaced" when swapped.
3. Payoff = what is shown/done today (fast visual proof). Future scenes ("Christmas Day… the look on their faces") are invented → label "SAM's words" / regenerate.
4. New formula step "Series thread": "Day N" (from notebook/start date 9/3/2025) + "Next up: …" from the creator's stated next task; if none stated, ask "What's next in the build?" — never invent it.
5. Invented lines slipped through: "(That's not a flex. That's just the truth.)", "built specifically around my parents' needs. Their comfort." → check the fact-check + "SAM's words" detection catches parentheticals and needs/feelings not in the story.

## Patch AY — v9.118.91 — The 10/10 engine, part 1 (2026-11-27)
- Interview first: "SAM reflects" now asks only for the formula pieces the story lacks — who it's for, stakes, struggle, proof on camera today, what's next (max 3; never asks about a saved background).
- server/_scriptWriter.js: the script is written by a dedicated call on claude-opus-5-5 (env SAM_SCRIPT_MODEL overrides), in parallel with the main playbook call. Step A fills a STORY SHEET of exact creator quotes per slot (anchor+person, loop, underdog, stakes, struggle, proof[], viewer, next_up); Step B writes each beat only from its slot. Code validates every quote against story + answers + background (whole words, ≥85% word match); unverified = missing. The sheet script is swapped in at the start of finish, so every existing guard (fact-check, number guards, open loop, sign-off, platform rules) still runs on it. Falls back to the main call's script if Opus fails.
- Formula map built from the sheet ("Your words: …"); new step "Series thread" (Day N / Next up); beat-role checks: stakes outside Risk or underdog outside Setup → "⚠ Wrong beat"; hook that omits the person the story names → missing; future-scene payoff → "SAM's words".
- Brand settings: Project start date (Day N, computed in the creator's time zone) and "Your best scripts" (up to 3, examples for structure only). Saved in the story profile (KV + local).
- vercel.json: api/sam.js maxDuration 120 → 300 (Hobby max) since the playbook now waits on two model calls.
- Not yet: Redo on the script section still uses the old single-call path; grader + auto-revise and the test set are part 2.

## Patch AZ — v9.118.92 — 4 best-script boxes (was 3); examples passed up to 3000 chars each

## Patch BA — v9.118.93 — Script writer reports on itself + retries
- Output 56: the Opus story-sheet writer silently failed (map showed the old writer: AI-map quotes, open loop "Fixed by SAM", answered "next up" never used).
- _scriptWriter: tries claude-opus-5-5 → claude-sonnet-5-5 → claude-sonnet-4-6; lenient JSON parse (code fences, trailing commas); max_tokens 3500; 110 s timeout; collects every error.
- Output carries script_engine ("sheet-v1 · <model>" or "fallback") + script_engine_note (the reasons); shown at the top of the formula map in the app and PDF. Fallback keeps the old-writer checks (creator opening, anchor check).

## Patch BB — v9.118.94 — Output 57 (first Opus run) graded 8.5
- Writer: say the creator's countdown number in the Risk beat; say each thing once (no hook repeat in Risk; big number ≤2×); "Next up" = one ≤15-word tease of the 2–3 most visual items.
- Map: Stakes → missing if the story's "N days left" is never spoken; → "Wrong beat" if the Risk beat repeats ≥60% of the hook.
- PDF: formula map rows tighter + long sources truncated (output 57 overflowed to a blank page).

## Patch BC — v9.118.95 — Built-in hook pattern library (auto-picked)
- server/_patterns.js: 12 proven short-form patterns (countdown, milestone, promise, contrarian, before→after, mistake & fix, one small thing, first time, you asked, the untold part, start in motion, what it cost) — name, when, shape, why, invented example. No creator setup.
- Script writer gets the list, picks ONE pattern for the hook/arc (anchor still lands in the Opening), returns pattern + one-line why + 2 alternate hooks from other patterns (same truth rules; alternates with numbers not in the story are dropped).
- Output: "Hook pattern" row leads the formula map; hook section shows "Pattern: X. why" and a collapsed "Other hooks" with copy buttons (app + PDF). Anchor person check now reads the whole Opening.

## Patch BD — v9.118.96 — Close in the right order
- orderCTA(): viewer line first (kept whole across ".." pauses, with its own short tag like "Keep showing up." after it), then "Next up", then the sign-off. Output 59 had "Keep showing up. Next up: … If you're tackling…".
- Map: Series thread no longer shows the "fact-check changed this line" note when it's used.

## Patch BE — v9.118.97 — "How did it do?" (Performance Loop, phase 1 — screenshots, no Meta API)
- Every Story Engine output is saved per creator (KV `outputs:<email>`, last 30: hook, pattern, beats+timings, formula map, alt hooks, captions, story) → `output_id` on the result.
- /api/results (server/results.js via the router — no new function): list | debrief | delete_lesson. Debrief = one vision call (opus-5-5 → sonnet-5-5 → sonnet-4-6) that reads only visible numbers from 1–3 Insights screenshots, ties drops/holds to the script's beat timings, gives a verdict + why + beat-by-beat, a repost plan (A) and lessons (B). Compared with the creator's own earlier checks (KV `debriefs:<email>`).
- Lessons (KV `lessons:<email>`): new = "watch" (1 video); reinforced by a later check = "rule" (2+). The script writer reads them on every new story (RULE / WATCH block). Deletable.
- UI: "5 · How did it do?" in Build SAM's Brain; "📈 After you post" card on each Story Engine output; modal with video picker, screenshot upload (downscaled to 1400px JPEG in the browser), report, and "What SAM has learned" tab. Gate: signed in + checkGate.

## Patch BF — v9.118.98 — Cleaner lessons (first real check: the 410-day video)
- Lessons were cut at 220 chars mid-word → one sentence, ≤30 words asked; trimmed at a word boundary (300) with "…".
- Lessons must be about content or audience; platform-counting caveats (e.g. "Follows showed 0") go in "why", and are filtered if they slip through.

## Patch BG — v9.118.99 — Close order (for real), long-form scripts, SAM's read refreshes from real results
- Close order: an old Patch AC rule in tidySpoken moved any CTA sentence found in the creator's story to the end — so "If you're tackling something similar…" landed after "Next up". It now runs only for creators without a saved sign-off and only for the old writer.
- Long-form: the script writer ignored the chosen format. Now `format` (WS.format → contentType) is passed; "long" = 1,200–1,700 spoken words, six beats as full sections, (show: …) cues, YouTube chapters, and `need_more` questions instead of padding (max_tokens 9000, 200 s timeout). Caption/LinkedIn formats skip the sheet writer. Beat timings switch to m:ss when the script runs past 90 s. Chapters shown in app + PDF.
- SAM's read (Today): KV `brief_dirty:<email>` is set by every results check and every new Story Engine script; daily-brief rebuilds instead of serving the morning cache, then clears it. The brief prompt gets the newest results checks (numbers, biggest drop, audience), lessons and the newest script, with a rule to lead with them. The app reloads the brief after a check and after a new playbook.
- Audience diagnosis (wizard step 6): uses the latest results check's real age/gender/non-follower split (debriefs now store `audience`) and lessons, instead of the fixed "people 35–54" paragraph; sets the age/gender chips from real data unless the creator picked them by hand.

## Patch BH — v9.119.00 — Step 6 always re-checks for real audience data
- Step 6 showed the diagnosis saved in the wizard session forever; now it shows the saved text instantly, then re-runs generateAudienceDiagnosis (real results first) and re-syncs the age/gender chips.

## Patch BI — v9.119.01 — Long-form polish (output 62)
- YouTube chapters re-timed from the real beat starts (the writer guessed 0:40/1:20/2:30/3:30 vs actual 0:29/0:56/1:40/2:08).
- "Need more" length claim replaced with the computed runtime (said 4–5 min; script ran 2:49).
- Formula map lines drop "(show: …)" cues and start at a sentence start.

### Patch BJ — v9.119.02 — Answer "Make it stronger" in place
- Each "Make it stronger" question on the output now has its own answer box, plus a **Rebuild with my answers** button.
- Answers go into WS.gapQA (replacing an older answer to the same question). getStoryForPlaybook already feeds them to SAM as "(The creator added, when SAM asked …)". Then retryPlaybook() re-runs the Story Engine with the same story and settings, so there's no need to start over.
- If no box is filled, it shows "Answer at least one question first." and spends no run.

### Patch BK — v9.119.03 — SAM checks her own work + learning made visible (from output 63, graded 9/10)
- Output 63 problems: the Payoff opened on what isn't done ("Still needs a final coat. Upstairs shower.. not started yet."); "before we leave" was never explained; the map's Payoff row showed a Turn line marked Used.
- Writer prompt: (1) the Payoff opens on the reveal, and unfinished items go to the Turn or "Next up"; (2) CLEAR TO A STRANGER: unexplained references get a few words of context from the story or background, or get cut; (3) returns `lessons_applied` (which "How did it do?" lessons it followed and where).
- Self-check + one auto-fix (_scriptWriter.selfCheck): checks the draft in code for the payoff opening on undone items (first 40% of the beat), a future-scene payoff, the countdown not spoken, Risk repeating the hook, unexplained "before we leave", and a CTA that doesn't speak to the viewer. If any fail, the same model gets one revise turn ("fix ONLY these"), kept only if it reduces the problems. Time budget: short 200s, long 225s total.
- Formula map: every story step has a home beat (Underdog→Setup, Stakes→Risk, Struggle→Turn, Payoff→Payoff, Viewer turn→Your Call), so a line in the wrong beat shows "Wrong beat". The Payoff row shows the proof the Payoff beat actually says. New rows: "Your results" (lessons applied, sent on to later results checks via saved outputs) and "Self-check" (passed / fixed / ⚠ still open). Rows with `plain:true` render without quote marks (UI + PDF).
