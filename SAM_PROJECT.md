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
- Current version: v9.118.52+

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

## Current Version: v9.118.52

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

### Open Task List (v9.118.x)
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
