# SAM Quiet Studio Integration Spec

This document is the build spec for wiring the Quiet Studio redesign into the existing `sam-app` codebase. It assumes the current production architecture remains intact: vanilla HTML files served by Vercel, inline JavaScript, serverless API functions in `/api`, custom magic-link auth via Vercel KV, and Supabase as the persistent data layer.

## Scope

V1 includes four customer-facing surfaces: a new marketing landing at `/`, the rebuilt `/meet` cinematic onboarding, the rebuilt `/app`, and the `/app` panel suite consisting of Voice DNA, Story Engine, Reach, Spark, My Ideas, plus an All Tools drawer containing Pulse, Blueprint, Vision, and Lens.

V1 explicitly removes `/welcome` from the funnel and from `vercel.json`, deletes `welcome.html`, leaves `voice-dna/index.html` untouched for V1.1, preserves all existing backend infrastructure, and fixes the three known issues: Voice DNA badge race condition, Voice DNA drift, and Spark save-on-regenerate binding.

## Architecture Assumptions

The rebuild is UI-first, not a framework migration. Claude Code should implement the Quiet Studio surfaces inside the existing stack rather than introducing Next.js, React, Tailwind, or Supabase Auth. The repo remains a static-HTML-plus-serverless-functions Vercel project.

### Must preserve

- Existing `api/` structure and Vercel function routing.
- Existing custom magic-link auth flow in `api/auth.js` using Vercel KV.
- Existing Supabase tables and current email-as-UID convention.
- Existing cron schedules in `vercel.json` for `outreach-daily` and `ear`.
- Existing Stripe checkout and webhook paths.
- Existing `Meet SAM` cinematic sequence timing inside the Story Engine entry flow.
- Existing functional tool logic for Pulse, Blueprint, Vision, and Lens; their demotion is UI reorganization only.

### Must change

- `landing.html` becomes the real public marketing landing.
- `vercel.json` root routing continues to point `/` at `landing.html`, but that file is now a Quiet Studio marketing surface instead of a redirect stub.
- `/landing` should 301 redirect to `/` as the canonical landing URL.
- `/welcome` rewrite is removed from `vercel.json`, and `welcome.html` is deleted.
- `/app` is reorganized around the new primary panel suite and the All Tools drawer.
- New persistence is added for My Ideas, Voice DNA fingerprints, and Spark generation history.

## Route Plan

| Route | File | V1 action | Notes |
|---|---|---|---|
| `/` | `landing.html` | Replace completely with Quiet Studio landing | Primary public front door. |
| `/landing` | `landing.html` | Redirect to `/` | One canonical front door. |
| `/meet` | `meet.html` | Rebuild in Quiet Studio register | Cinematic onboarding stays. |
| `/app` and `/app/*` | `index.html` | Rebuild main UI in Quiet Studio | Keep SPA-style show/hide sections. |
| `/users` | `users.html` | Leave untouched | Internal/admin only. |
| `/welcome` | `welcome.html` | Remove route and delete file | Deprecated from V1. |
| `/voice-dna` | `voice-dna/index.html` | No route in V1 | Leave untouched in repo. |

## Mockup-to-Codebase Map

### Landing

**Target file:** `landing.html`

**Purpose:** Explain SAM before the user enters `/meet`. The landing must speak to serious builder-creators, not a universal creator bucket. The core promise is continuity: SAM understands the creator's voice, current project, and publishing context, then turns that into finished work that sounds like them.

**Required sections**

- Hero with one-line value proposition and primary CTA to `/meet`
- Product framing around Voice DNA, Story Engine, Reach, Spark, and My Ideas
- Short explanation of “why SAM instead of generic AI wrappers”
- Evidence of platform adaptation as a downstream verb, not the organizing principle
- Pricing preview that matches live Stripe tiers or defers to current pricing surface
- Footer with standard legal/contact links if already present elsewhere

**CTA flow**

- Primary CTA: `Meet SAM`
- Secondary CTA if included: `See how Voice DNA works`
- Both should flow into `/meet` or an explanatory subsection, not `/welcome`

### Meet SAM

**Target file:** `meet.html`

**Purpose:** Preserve the cinematic onboarding tone while updating the visual register to Quiet Studio. The cinematic remains sacred and should not be structurally rewritten into a generic SaaS onboarding flow.

**Implementation notes**

- Keep it as a distinct surface from `/`
- Keep its emotional tone and sequencing intact
- Update styling, typography, spacing, and component chrome to the new token system
- Maintain the handoff path into `/app`

### Main app

**Target file:** `index.html`

**Primary nav/dashboard tiles in V1**

1. Voice DNA
2. Story Engine
3. Reach
4. Spark
5. My Ideas
6. All Tools

**All Tools drawer contents**

- Pulse
- Blueprint
- Vision
- Lens

These four tools remain fully functional and should open their existing tool experiences; they are not “coming soon,” hidden, or deprecated.

## App Information Architecture

### Dashboard logic

The dashboard should reflect the working loop SAM now supports:

1. Understand the creator's voice with Voice DNA
2. Turn an idea into a structured story with Story Engine
3. Adapt the story for each platform through Reach
4. Get unstuck with Spark when the user does not yet have an idea
5. Save and manage outputs through My Ideas
6. Access secondary but functional utilities through All Tools

This structure is intentional product framing, not feature removal. Pulse, Blueprint, Vision, and Lens remain accessible but no longer compete visually with the core daily loop.

### Panels to build in `/app`

- Today / dashboard overview
- Voice DNA panel
- Story Engine panel
- Reach panel
- Spark panel
- My Ideas panel
- All Tools drawer or overlay
- Existing individual tool surfaces for Pulse, Blueprint, Vision, Lens
- Existing FAB chat if retained by current `index.html`, restyled into Quiet Studio

## Design System Migration

Replace the current dark neon gradient palette with the Quiet Studio token system approved earlier.

### New tokens

```css
:root {
  --bg: #FAFAF7;
  --paper: #FAFAF7;
  --surface: #FFFFFF;
  --surface-2: #F4F2EC;
  --rule: #E5E2DB;
  --rule-strong: #C9C5BC;
  --ink: #1A1815;
  --ink-soft: #4A4640;
  --ink-muted: #8B8680;
  --ink-faint: #B8B4AB;
  --accent: #20808D;
  --accent-hover: #1A6A75;
  --accent-soft: rgba(32, 128, 141, 0.08);
  --serif-accent: #8B3A2F;
  --pos: #437A22;
  --neg: #A12C7B;
}
```

### Typography

- UI/body: Inter
- Meta/labels: JetBrains Mono
- SAM verdicts only: Instrument Serif italic

### Replace/remove

- Remove per-tool neon color coding as the primary hierarchy system.
- Remove decorative tool-specific gradient `::before` accents.
- Remove the “AI aesthetic” purple/blue glow look from cards and panels.
- Use layout, typography, labels, and surface contrast to create hierarchy instead.

## Supabase Schema Extensions

Create three new tables in Supabase Table Editor. These extend the existing data model and do not replace `sam_context`, which remains the relationship-memory layer.

### 1. `sam_ideas`

Purpose: server-side persistence for Quiet Studio My Ideas.

```sql
create table if not exists public.sam_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text,
  body text not null,
  source text not null,
  stage text not null default 'spark',
  platform text,
  tags text[] default '{}',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

**Allowed `source` values**
- `spark`
- `story_engine`
- `reach`
- `manual`
- `pulse`
- `blueprint`
- `vision`
- `lens`

**Allowed `stage` values**
- `spark`
- `draft`
- `ready`
- `published`
- `archived`

**Indexes**

```sql
create index if not exists sam_ideas_user_id_idx on public.sam_ideas(user_id);
create index if not exists sam_ideas_stage_idx on public.sam_ideas(stage);
create index if not exists sam_ideas_created_at_idx on public.sam_ideas(created_at desc);
```

### 2. `sam_voice_dna_profiles`

Purpose: persist extracted writing fingerprints separately from broader relationship context.

```sql
create table if not exists public.sam_voice_dna_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  version integer not null default 1,
  profile jsonb not null,
  source text not null default 'voice_trainer',
  drift_score numeric,
  created_at timestamptz not null default now()
);
```

**Indexes**

```sql
create index if not exists sam_voice_dna_profiles_user_id_idx on public.sam_voice_dna_profiles(user_id);
create index if not exists sam_voice_dna_profiles_user_version_idx on public.sam_voice_dna_profiles(user_id, version desc);
```

### 3. `sam_spark_generations`

Purpose: persist Spark prompts and outputs for reuse, analytics, and recovery.

```sql
create table if not exists public.sam_spark_generations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  niche text not null,
  output jsonb not null,
  created_at timestamptz not null default now()
);
```

**Indexes**

```sql
create index if not exists sam_spark_generations_user_id_idx on public.sam_spark_generations(user_id);
create index if not exists sam_spark_generations_created_at_idx on public.sam_spark_generations(created_at desc);
```

### RLS guidance

Follow the existing pattern: owner-scoped read/write access by `user_id` mapped to the authenticated lowercased email. Because auth is custom and not Supabase Auth, the practical path is to continue using server-side endpoints as the gatekeeper for writes and reads, rather than relying on direct client-side Supabase access for these new tables.

## Endpoint Recommendation Lock

Build **separate endpoints** for Spark and Voice DNA refinement rather than folding more logic into `api/sam.js`.

### Recommendation

- Add `POST /api/spark/generate`
- Add `POST /api/voice-dna/refine`

### Why this is the right call

- `api/sam.js` is already large and handling too many concerns.
- Separate endpoints produce cleaner Vercel logs, cleaner error isolation, and simpler debugging per product surface.
- The product model now treats Spark and Voice DNA as first-class surfaces, so their API boundaries should match that reality.
- This does not create meaningful architectural overhead inside the current Vercel setup.

### Implementation rule

Use `api/sam.js` for chat-specific orchestration only. Use dedicated endpoints for surface-specific generation and refinement actions.

## Motion and Responsive Spec

These are the default interaction and layout rules Claude Code should follow in V1.

### Motion

Use CSS transitions only. No Framer Motion, GSAP, or animation library is required.

**Timing rules**

- Hover and active transitions: `120ms` to `180ms` ease
- Panel, drawer, modal, and overlay transitions: `180ms` to `240ms` ease
- Regenerate/loading micro-feedback: `600ms` for visible “thinking” swap states
- AI loading states: `1500ms` to `1800ms` skeleton or pulse timing when applicable

**Easing**

```css
cubic-bezier(0.16, 1, 0.3, 1)
```

**Motion principles**

- Nothing should snap in unless it is truly instantaneous utility feedback.
- Hover is quiet, not theatrical.
- Panels and drawers should fade/translate subtly, not slide dramatically.
- Loading states should feel calm and confident, not hyperactive.
- Respect `prefers-reduced-motion`.

### Responsive behavior

Desktop is the primary design target in V1, but mobile must remain coherent and usable.

**Breakpoints**

- Mobile: up to `767px`
- Tablet: `768px` to `1023px`
- Desktop: `1024px` and above

**App shell behavior**

- Desktop: left rail and main content can remain side by side if that matches the rebuilt shell.
- Tablet: preserve desktop structure where possible, but reduce panel density.
- Mobile: stack vertically; the dashboard becomes a single-column card flow.

**Specific mobile rules**

- Dashboard tiles stack into one column.
- All Tools becomes a full-width drawer or overlay sheet.
- Panel interiors collapse into a single readable column.
- Dense side-by-side controls become stacked controls.
- Editable output cards in Reach stack vertically.
- My Ideas filters can become a horizontal chip row or simple dropdown.
- Story Engine keeps one question per view with full-width controls.

**Touch and spacing**

- Minimum tap target: `44px`
- Keep body text at `16px` or above on mobile.
- Preserve generous vertical spacing rather than shrinking everything to fit.

## API Route Inventory

### Existing routes to keep and use

- `POST /api/auth`
- `POST /api/sam`
- `POST /api/voice`
- `POST /api/reach`
- `POST /api/pdf`
- `POST /api/me`
- `POST /api/memory`

### New routes to add

#### `GET /api/ideas`
Returns the current user's ideas, optionally filtered by `stage` and `source`.

**Query params**
- `userId` required
- `stage` optional
- `source` optional

**Response**

```json
{
  "ok": true,
  "ideas": [
    {
      "id": "uuid",
      "title": "How I turned demo day into a content engine",
      "body": "...",
      "source": "spark",
      "stage": "draft",
      "platform": "youtube",
      "tags": ["build-in-public", "story"],
      "metadata": {},
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

#### `POST /api/ideas`
Creates a new idea record.

**Body**

```json
{
  "userId": "user@example.com",
  "title": "Idea title",
  "body": "Idea body",
  "source": "spark",
  "stage": "spark",
  "platform": "instagram",
  "tags": ["hook", "renovation"],
  "metadata": {"sparkGenerationId": "uuid"}
}
```

#### `PATCH /api/ideas/:id`
Updates title, body, stage, tags, platform, or metadata.

#### `DELETE /api/ideas/:id`
Deletes an idea owned by the current user.

#### `POST /api/spark/generate`
Generate five ideas from a niche prompt and store a generation row in `sam_spark_generations`.

**Body**

```json
{
  "userId": "user@example.com",
  "niche": "DIY bathroom renovation creator helping first-time homeowners"
}
```

**Response shape**

```json
{
  "ok": true,
  "generationId": "uuid",
  "ideas": [
    {
      "hook": "I thought the tile would be the hard part. It wasn't.",
      "angle": "Expectation vs reality",
      "platforms": ["instagram", "youtube", "tiktok"],
      "description": "Short description of the story opportunity"
    }
  ]
}
```

#### `POST /api/voice-dna/refine`
Extraction wrapper that calls existing `api/voice.js` logic but also persists the fingerprint into `sam_voice_dna_profiles`.

**Body**

```json
{
  "userId": "user@example.com",
  "samples": ["sample 1", "sample 2", "sample 3"],
  "existingProfile": {},
  "source": "voice_trainer"
}
```

**Response**

```json
{
  "ok": true,
  "version": 4,
  "profile": {},
  "driftScore": 0.18
}
```

## Data Model Separation

### `sam_context`

Remains the relationship-memory layer: user goals, project context, audience understanding, and the “where we left off” continuity that SAM references across sessions.

### `sam_users.voice_profile`

Can remain as the fast-access current profile for backwards compatibility during migration.

### `sam_voice_dna_profiles`

Stores versioned writing fingerprints over time for the Quiet Studio Voice DNA panel, including drift comparisons and version history.

## Voice DNA Panel Spec

### Purpose

Help the user understand whether SAM has a reliable fingerprint of how they write, while making the calibration process feel concrete instead of mystical.

### Inputs

- Three writing samples pasted into textareas
- Existing profile and version from `sam_users`
- Relationship context from `sam_context`

### Outputs shown in UI

- Current match confidence
- Version number
- Drift indicator
- Signature tags or traits
- Last refined date
- Primary CTA: `Refine Voice DNA`

### Storage behavior

1. Save raw samples into `sam_voice_samples`
2. Save updated current profile into `sam_users.voice_profile`
3. Increment `sam_users.voice_version`
4. Insert version snapshot into `sam_voice_dna_profiles`

### Issue fixes

#### Issue 7: badge race condition

Current problem: the trainer renders before async user/profile fetch completes, producing a false “NO PROFILE YET” badge.

**Fix**
- Gate initial render behind `await getCurrentUser()` or equivalent
- Show a loading/skeleton state before profile resolution
- Render badge only from resolved profile state

#### Issue 8: drift on submission

Current problem: later profile versions over-index on emotional/meta interpretation and lose mechanical/stylistic traits.

**Fix**
- Update the extraction/evolution prompt so mechanical traits are sticky unless explicitly contradicted across multiple new samples
- Limit trait removals per revision cycle
- Preserve sentence-level behaviors, punctuation patterns, cadence markers, and structural tendencies as first-class traits

### Voice DNA prompt guidance

**System prompt goals**
- Extract writing mechanics, not personality mythology
- Distinguish style from subject matter
- Preserve existing mechanical traits unless new evidence strongly contradicts them
- Return structured JSON only

**Expected JSON shape**

```json
{
  "signature_phrases": [],
  "cadence": [],
  "structure": [],
  "tone_markers": [],
  "mechanical_traits": [],
  "avoid": [],
  "summary": ""
}
```

## Spark Panel Spec

### Purpose

Spark is the unstuck-me generator. It is for the user who knows their niche but does not yet know what to make next.

### Inputs

- Niche or creator context text input
- Optional platform preference
- Optional current project context pulled from `sam_context`

### Outputs

Five ideas, each with:
- Hook
- Angle
- Description
- Suggested platforms
- Save to My Ideas action
- Try another hook action

### Persistence

- Save each generation into `sam_spark_generations`
- Allow individual ideas to be saved into `sam_ideas`

### Issue 9 fix

Current problem: regenerated hook updates visible text but the save handler still points at stale data.

**Fix**
- Make Save read current card state from the DOM or a central JS object at click time
- Do not bind permanent inline `onclick` handlers to initial hook strings

### Spark prompt guidance

**System prompt**

```text
You are SAM, an AI creative director for serious builder-creators. Generate five content ideas from the user's niche. Each idea must feel native to a creator with a real project and a real audience, not generic creator advice. Return structured JSON only.
```

**Output schema**

```json
{
  "ideas": [
    {
      "hook": "",
      "angle": "",
      "description": "",
      "platforms": ["instagram", "youtube"]
    }
  ]
}
```

## My Ideas Panel Spec

### Purpose

Provide a persistent, server-backed library of saved concepts and outputs so users stop losing work across localStorage, docs apps, and one-off generations.

### Views

- All
- Spark
- Draft
- Ready
- Published
- Archived

### Card anatomy

- Title
- Body preview
- Source label
- Stage badge
- Date updated
- Quick actions: Edit, Move Stage, Delete, Use in Story Engine, Send to Reach

### Migration from existing Ideas Bank

On first authenticated load after the rebuild:

1. Check localStorage for legacy Ideas Bank entries
2. If present and no migration marker exists, prompt user to import them
3. Convert each legacy entry into `sam_ideas`
4. Set a migration-complete flag in localStorage to avoid duplicate imports

## Story Engine Spec

Story Engine is the renamed and visually rebuilt version of the current Story Builder. It remains a 12-step guided flow ending in a downloadable PDF playbook.

### Non-negotiable

Do not alter the sacred wizard entry sequencing currently attached to the Meet SAM cinematic in a way that breaks the emotional handoff. The flow can be visually reskinned, but its entry choreography should remain intact.

**Timing to preserve exactly**

- `openWizardPage()` fires `300ms` after `DOMContentLoaded`
- then `showWizardStep('entry')`
- then `meetSamInit()` after `100ms`

Claude Code should treat that sequence as locked unless Joey explicitly changes it.

### Persistence

V1 can keep localStorage persistence for wizard progress, because server-side wizard persistence is explicitly deferred in the current codebase.

**Keys to keep or migrate**
- `sam_session_v2`
- `sam_session_step`
- `sam_session_ts`

### 12-step structure

Below is the content spec Claude Code should wire into the rebuilt wizard. Exact copy can be tuned slightly in implementation, but the logic and sequencing should remain.

#### Step 1 — The moment
- **SAM asks:** What happened that made this story worth telling?
- **Goal:** Capture the triggering event, not the whole backstory.
- **Input:** Freeform textarea.
- **Save as:** `story.moment`

#### Step 2 — The before
- **SAM asks:** What was true before this moment?
- **Goal:** Establish the old normal so the shift has contrast.
- **Input:** Freeform textarea.
- **Save as:** `story.before_state`

#### Step 3 — The problem
- **SAM asks:** What was actually hard, unclear, or at stake?
- **Goal:** Define the real tension.
- **Input:** Freeform textarea.
- **Save as:** `story.problem`

#### Step 4 — The insight
- **SAM asks:** What did you realize that changed how you saw it?
- **Goal:** Surface the lesson or reframing.
- **Input:** Freeform textarea.
- **Save as:** `story.insight`

#### Step 5 — The change
- **SAM asks:** What changed in your behavior, process, or belief after that?
- **Goal:** Translate realization into action.
- **Input:** Freeform textarea.
- **Save as:** `story.change`

#### Step 6 — The evidence
- **SAM asks:** What proof do you have that this change mattered?
- **Goal:** Add concrete support, result, or artifact.
- **Input:** Freeform textarea.
- **Save as:** `story.evidence`

#### Step 7 — The audience
- **SAM asks:** Who needs this story most, and why now?
- **Goal:** Anchor relevance.
- **Input:** Freeform textarea.
- **Save as:** `story.audience`

#### Step 8 — The feeling
- **SAM asks:** What should the audience feel by the end?
- **Goal:** Define emotional destination.
- **Input:** Freeform textarea.
- **Save as:** `story.feeling`

#### Step 9 — The format
- **SAM asks:** What form should this story take first?
- **Goal:** Choose primary expression: video, caption, thread, post, newsletter, etc.
- **Input:** Select + optional note.
- **Save as:** `story.primary_format`

#### Step 10 — The angle
- **SAM asks:** What is the sharpest angle on this story?
- **Goal:** Decide what makes this version distinct.
- **Input:** Freeform textarea.
- **Save as:** `story.angle`

#### Step 11 — The draft
- **SAM asks:** Here is the draft. What needs to be stronger, clearer, or more you?
- **Goal:** Review and refine SAM's assembled draft.
- **Input:** Editable text block.
- **Save as:** `story.draft`
- **AI action:** Anthropic assembles a first-pass draft from steps 1–10 plus Voice DNA.

#### Step 12 — The playbook
- **SAM asks:** Ready to turn this into a working playbook?
- **Goal:** Finalize outputs and generate PDF.
- **Input:** Confirmation + title.
- **Save as:** `story.playbook_title`
- **AI action:** Generate final playbook package and call `POST /api/pdf`

### Story assembly prompt

**System prompt**

```text
You are SAM, an AI creative director for serious builder-creators. Use the user's Voice DNA, current story inputs, and relationship context to assemble a clear, emotionally honest draft in the user's voice. Be specific, grounded, and structurally clean. Do not sound like a generic AI writing assistant.
```

**Inputs to include**
- Voice DNA profile
- Relationship context from `sam_context`
- All completed story step fields
- Requested primary format

**Output shape**

```json
{
  "title": "",
  "draft": "",
  "key_takeaway": "",
  "cta": ""
}
```

## Reach Panel Spec

### Purpose

Reach turns one finished story into platform-native variations. It is not the organizing principle of SAM; it is a downstream transformer applied after the story is clear.

### Input sources

- A completed Story Engine draft
- Or a manually pasted piece of content
- Voice DNA profile
- Relationship context from `sam_context`

### Supported outputs in V1

- Instagram caption
- LinkedIn post
- YouTube description
- TikTok script
- Facebook post
- X thread
- Newsletter intro
- Blog excerpt

### Backend

Use existing `POST /api/reach`. No new reach endpoint is required.

### UI flow

1. User chooses or pastes source content
2. User picks one or multiple platforms
3. App sends platform-specific system/user prompt payload to `/api/reach`
4. Results render as separate editable cards
5. Each card supports Copy, Save to My Ideas, and Regenerate

### Reach prompt pattern

Each platform call should wrap the same source content in platform-native instructions. Example:

```text
System: You are SAM. Adapt the user's source content into a platform-native [PLATFORM] output that preserves their Voice DNA while respecting how that platform is read.

User: Here is the original content:
[CONTENT]

Voice DNA:
[PROFILE]

Audience/context:
[CONTEXT]

Return only the adapted output.
```

## All Tools Drawer Spec

### Purpose

A quiet secondary access surface for tools that still matter but are not part of the primary daily loop.

### Contents

- Pulse
- Blueprint
- Vision
- Lens

### Behavior

- Opens as a drawer, modal grid, or secondary panel from the dashboard
- Each card opens the existing functional tool
- No “coming soon” language
- No dead links
- No feature removal

## API/Data Flow Diagrams in Plain English

### Voice DNA refine

User opens Voice DNA → pastes three samples → frontend sends `POST /api/voice-dna/refine` → extraction logic runs through existing Voice DNA behavior → raw samples saved to `sam_voice_samples` → current profile updated in `sam_users` → version snapshot inserted into `sam_voice_dna_profiles` → UI refreshes version, drift, and signature tags.

### Spark generation

User enters niche → frontend sends `POST /api/spark/generate` → Anthropic returns five ideas → generation persisted in `sam_spark_generations` → UI renders idea cards → user saves one into `sam_ideas`.

### Story Engine

User moves through 12 steps → state saved locally per step → at draft step, frontend assembles story payload and sends to Anthropic-backed route → SAM returns structured draft → user edits → final step calls `POST /api/pdf` to generate the playbook PDF.

### Reach

User selects a completed story → frontend creates platform instruction payloads → `POST /api/reach` per platform or in sequence → API returns adapted content → UI renders editable cards → user copies or saves outputs into `sam_ideas`.

### My Ideas

User saves output from Spark, Story Engine, Reach, or other tools → frontend sends `POST /api/ideas` → Supabase stores the record → My Ideas panel fetches with `GET /api/ideas` → user moves it through stages via `PATCH /api/ideas/:id`.

## Build Order

### Milestone 1

- Replace `landing.html` with Quiet Studio landing
- Rebuild `/meet` chrome and motion styling
- Install shared Quiet Studio token system in app surfaces
- Rebuild `/app` shell and dashboard with six primary tiles
- Implement All Tools drawer with working links into existing tool panels
- Remove `/welcome` route from `vercel.json`

### Milestone 2

- Rebuild Voice DNA panel
- Fix Issues 7 and 8
- Rebuild Story Engine shell and 12-step UI
- Preserve localStorage persistence
- Wire draft assembly and playbook generation

### Milestone 3

- Rebuild Spark panel and fix Issue 9
- Add `sam_spark_generations`
- Rebuild Reach panel using existing `/api/reach`
- Add `sam_ideas` and full My Ideas panel
- Add migration import from legacy localStorage Ideas Bank

## Implementation Notes for Claude Code

- Do not rewrite the repo into React or Next.js unless Joey explicitly changes direction.
- Prefer extracting new CSS into organized blocks, but within the current architecture.
- Remove inline `onclick` patterns where practical and centralize event binding for rebuilt panels.
- Respect the current lowercased email identity model everywhere.
- Keep tier limits enforced by API as source of truth; UI can display usage messaging but must not invent its own limit logic.
- Keep all secrets server-side; mirror the `api/elevenlabs.js` pattern for any new external integrations.

## Final Questions Before Build Starts

Claude Code should confirm these two remaining items with Joey before implementation begins:

1. Exact Supabase column types and RLS policies for `sam_users`, `sam_conversations`, `sam_voice_samples`, and `sam_context`
2. Confirmation from Joey once he exports the schema, so any type mismatches in the new tables can be aligned before migration

## Success Criteria

The rebuild is successful if:

- Public visitors land on a real marketing page at `/`
- `/meet` still feels cinematic and intentional
- `/app` feels focused around the actual creator loop
- All existing tools still work, including the four in All Tools
- Voice DNA feels more concrete and less mystical
- Story Engine remains a 12-step guided path ending in a PDF
- Reach turns one story into platform-native outputs without becoming the app's organizing principle
- My Ideas persists work server-side instead of trapping it in localStorage
- No backend infrastructure, cron jobs, billing, or auth flows are broken
