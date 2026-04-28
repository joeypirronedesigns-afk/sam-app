# M2 — Tool Internal Re-skin Pass

## Status of M1 (closed out)
- Branch: `quietstudio` (do NOT merge to main)
- Latest commit: af3ad27 (v9.8)
- Shell version: v3
- App version stamp: v9.8
- Quiet Studio shell fully authoritative under `body.quiet-studio-shell`
- All shell-level legacy chrome suppressed
- Icon archive at `~/Desktop/sam-app/icons/`
- Ask SAM chip → SAM brain confirmed working

## What M2 covers
Re-skin the internal UIs of these surfaces to match Quiet Studio register:

1. **Pulse tool** — input, generate button, output panel
2. **Blueprint tool** — same
3. **Vision tool** — same
4. **Lens tool** — same (includes thumbnail upload + analytics decoder, 2-in-1)
5. **Spark tool** — niche input, 5-idea output, save-to-ideas flow
6. **My Ideas panel** — saved ideas list, filter chips, source/stage filters
7. **Story Engine wizard** — 12-step wizard, including Meet SAM cinematic
8. **Talk with SAM panel** — currently dark gradient, needs cream paper register

## Quiet Studio register (locked)
- Paper: #FAFAF7
- Surface-2 (cards): #F4F2EC
- Rule: #E5E2DB
- Rule-strong: #C9C5BC
- Ink: #1A1815
- Ink-soft: #4A4640
- Ink-muted: #8B8680
- Ink-faint: #B8B4AB (override locally to #8A8680 for legibility on cream)
- Accent: #20808D (teal)
- Accent-soft: rgba(32,128,141,0.08)
- Serif accent: #8B3A2F (terra-rust)
- Pos: #437A22
- Neg: #A12C7B
- Inter for UI body
- JetBrains Mono for meta labels (uppercase, tracked)
- Instrument Serif italic ONLY for verdicts/emphasis (e.g., "this one's worth posting")

## Hard rules carried over from M1
- Stage-before-merge always (quietstudio branch only)
- Bump version every commit (v9.8 → v9.9 next)
- NEVER touch:
  - Meet SAM cinematic timing (300ms → entry → 100ms)
  - Tool internal LOGIC (only re-skin visual layer)
  - Stripe checkout flow
  - Supabase reads/writes
  - Email-as-UID convention
  - SAM's brain wiring (autofill from voice DNA, etc.)
  - api/ folder
  - index.html
  - icons/ folder
- Pricing: "See plan" singular — single $29/mo tier
- User wants direct, no fluff. Push back when wrong.
- Never suggest user rest or take a break — hard rule.
- Sonnet 4.6 for execution loops in Claude Code, Opus 4.7 here for strategy.

## Open questions for M2 kickoff
1. Order of re-skin — start with most-used (Pulse?) or simplest (Spark?) to build pattern library?
2. Re-skin one tool fully, ship, then propagate the pattern? Or re-skin all in parallel?
3. Talk with SAM panel — its visual register is the most distinct ask (drawer pattern matching All Tools drawer). Should this be M2 commit 1 since its placement is locked but not styled?
4. Wizard — Meet SAM cinematic stays untouched. The 12 wizard steps below it need re-skin. Single commit or step-by-step?

## Recommended M2 sequence (subject to user signoff)
1. Pattern lockdown commit — establish QS tool-card, button, input, label primitives in CSS as reusable classes
2. Talk with SAM panel re-skin (highest-leverage, most-used surface)
3. Spark re-skin (simplest tool, validates pattern)
4. Pulse re-skin (most-used tool, hero of Workshop)
5. Blueprint re-skin
6. Vision re-skin
7. Lens re-skin
8. My Ideas panel re-skin
9. Story Engine wizard re-skin (largest surface, save for last)

Each gets its own commit + version bump. Sign in / See plan modals are M3.
