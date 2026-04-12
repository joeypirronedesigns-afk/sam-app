# SAM APP BUILD — SESSION HANDOFF

**App:** SAM (Strategic Assistant for Making) at samforcreators.com
**Single index.html file. Deployed on Vercel. GitHub repo: joeypirronedesigns-afk/sam-app. Mac terminal workflow.**
**Current version: v7.95**
**File path:** /Users/giuseppepirrone/Desktop/sam-app/index.html
**Dev branch:** photo-wizard-dev (ALL WORK HAPPENS HERE ONLY)

---

## GIT STATE — READ THIS FIRST

**main (live site):** 8d6d2fb — ROLLBACK: revert to pre-photo-wizard v7.93
**photo-wizard-dev (our work):** v7.95 — multiple fixes this session, NOT yet merged to main

Do NOT merge to main until MEET SAM first-visit flow is fully working.

---

## CRITICAL RULES

1. ALL WORK ON photo-wizard-dev BRANCH ONLY. Never touch main directly.
2. DO NOT BREAK OR DELETE ANYTHING THAT CURRENTLY WORKS.
3. Never touch openWizardPage, showWizardStep, openMeetSAMOverlay, wizardPage, getTrialState, initTrial
4. Always build new features as self-contained overlays/sections.
5. Always test on photo-wizard-dev in incognito before merging to main.
6. Version bump with every deploy.
7. Never use single-quoted font names inside JS strings.
8. Write complex scripts to file first: cat > ~/Desktop/script.py then python3 ~/Desktop/script.py
9. Scripts go to ~/Desktop/ not /tmp/
10. Never put literal \n inside JS strings in Python heredocs.
11. Verify with sed -n before deploying.
12. Use python3 - << 'PYEOF' ... PYEOF for inline Python (avoids zsh ! expansion issues)

---

## SITE FLOW

NEW VISITOR: lands on homepage -> MEET SAM fires (forced, can't skip) -> Story Engine -> Homepage
RETURNING USER: sam_uid in localStorage -> openWorkshop() fires -> lands directly in Workshop

NAV (3 items only): Talk with SAM | Workshop | See plans

---

## MEET SAM — INTENDED FIRST VISIT FLOW (PARTIALLY BROKEN — TOP PRIORITY)

1. SAM greeting bubble: "Everything amazing in life comes from stories. What's yours? Start anywhere — I'll find the content in it."
2. User types their story in input → clicks send
3. SAM reflects powerfully — ONE response, specific, emotional, on-brand
4. "✦ Let's build your story →" CTA button appears AFTER SAM finishes
5. User clicks button → Voice DNA card slides in ("I want to sound like you — not like AI")
6. User submits voice sample → button reappears: "✦ Let's build your story — in your voice →"
7. User clicks → handoff card → Story Wizard launches

RETURNING USER "Talk with SAM":
- Goes to msOpenThread() — context-aware greeting, NOT first-visit flow
- Nav pills (← Home, Story Engine, Voice DNA) visible for returning users only
- Every interaction deepens Voice DNA profile

---

## WHAT WAS FIXED THIS SESSION (v7.95)

| Fix | Status |
|-----|--------|
| Switch Tools button — ecosystemOverlay DOM order fix | DONE |
| Stray });} syntax error breaking openEcosystemOverlay | DONE |
| msChatNav pills hidden for new visitors | DONE |
| Returning users routed to msOpenThread via sam_uid check | DONE |
| Returning card shows simpler message when no session data | DONE |
| SAM prompt updated — no longer mentions Voice DNA | DONE |
| Voice DNA auto-trigger removed from persistent chat handler | DONE |
| meetSamSendStoryFirstVisit renamed + exposed as window global | DONE |
| _msFirstVisitActive flag routes send button correctly | DONE |
| null guard for msThinkingText crash | DONE |
| meetSamInit clears leftover Voice DNA cards on init | DONE |
| Version bumped to v7.95 | DONE |

---

## CURRENT BUG — MEET SAM FIRST VISIT (TOP PRIORITY)

**Symptom:** Voice DNA card appears immediately after SAM greeting, before user sends story or clicks any button. SAM never responds to user's story. No button appears.

**Root cause investigation so far:**
- meetSamSendStoryFirstVisit is defined and globally accessible (confirmed)
- _msFirstVisitActive flag is true (confirmed)
- Only ONE call to showVoiceCalibration() exists at line 11116 inside meetSamHandoff()
- meetSamHandoff() is only called from button click at line 14622
- BUT Voice DNA card appears without button click — source unknown

**Suspected cause:** meetSamInit() cleanup or the 2000ms setTimeout somewhere is still firing showVoiceCalibration. Need fresh eyes to trace the exact trigger path.

**Next step:** Run a clean audit grep on page load sequence:
grep -n "showVoiceCalibration\|meetSamHandoff\|msVoiceCalib" ~/Desktop/sam-app/index.html

---

## DUPLICATE FUNCTION ISSUE (RELATED)

There are TWO meetSamSendStory functions:
- Line 11354: meetSamSendStoryFirstVisit (renamed) — first-visit onboarding brain, calls meetSamCallAPI
- Line 16211: meetSamSendStory — persistent chat handler, different system prompt

The persistent chat handler (16211) was hijacking first-visit flow, causing:
- Generic SAM responses instead of powerful onboarding reflection
- Double chat bubbles
- Voice DNA firing on every message

Fix applied: _msFirstVisitActive flag routes to correct function. But Voice DNA still fires unexpectedly.

---

## STILL TO DO

Critical:
- Fix Voice DNA appearing before button click in first-visit flow
- Full end-to-end test of MEET SAM flow once fixed
- Merge photo-wizard-dev to main once MEET SAM works

High priority:
- Add heart Ideas picker to each Reach output field
- Build SAM_PROFILE unified context object
- The Reach auto-fills from user profile
- SAM-generated hashtags

Medium priority:
- Story Wizard playbook PDF gated for active trial users
- Update pricing copy to $19/$39/$99
- Mic button missing from MEET SAM input (was removed previously)

Low priority:
- Remove dead photo-wizard section (line ~5537)
- Remove showPhotoWizard function (line ~5674)

---

## WORKSHOP LAYOUT

Top: Story Wizard hero row — "Launch Story Wizard" (calls openWizardPage(true))
Grid: The Pulse, The Spark, Blueprint, The Vision, The Lens, The Reach, My Ideas, Video Coming Soon

---

## THE 8 CAPABILITIES

MEET SAM - Cinematic onboarding, forced first visit, builds Voice DNA
Story Wizard - Full content package from one moment. openWizardPage(true)
The Pulse - Short-form video script, hook/setup/turn/payoff + captions
The Spark - 5 original content ideas matched to Voice DNA
Blueprint - Full weekly content calendar, every platform
The Vision - One bold original campaign concept + execution plan
The Lens - Photo to thumbnail strategy OR analytics screenshot to action plan
The Reach - Upload photo, SAM auto-fills content, user reviews/edits, schedule, post to socials

---

## KEY FUNCTIONS

openWorkshop() - hides hero and howItWorks, shows Workshop grid
meetSamSendStoryFirstVisit() - first-visit story submission (window global)
meetSamSendStory() - persistent chat handler (line 16211)
_msFirstVisitActive - flag: true during first-visit flow, false after handoff
msOpenThread() - returning user chat (context-aware greeting)
meetSamHandoff() - fires when go button clicked, shows Voice DNA if not calibrated
openIdeasPicker(targetInputId) - floating ideas picker
runReach() - The Reach API call + renderer
reachCopyField/reachEditField/reachCopyAll - Reach output controls

---

## TIER MAPPING

free = Free Trial, 48hrs full access then email capture
creator = Creator, $19/mo, all tools + The Reach
pro = Broadcaster, $39/mo, everything + video when ready
studio = Publisher/Agency, $99/mo, unlimited, multiple voice profiles

---

## SUPABASE TEST

Run in browser console to test as dev:
localStorage.setItem('sam_uid', 'dev-joey');
localStorage.setItem('sam_tier', 'studio');
location.reload();

New visitor test:
localStorage.clear(); location.reload();

---

## DEPLOY COMMANDS

cd ~/Desktop/sam-app && git checkout photo-wizard-dev
git add -A && git commit -m "message" && git push origin photo-wizard-dev
Merge to main only when confirmed stable:
git checkout main && git merge photo-wizard-dev && git push

---

## SAM HQ SEPARATE APP

URL: sam-hq.vercel.app
GitHub: joeypirronedesigns-afk/sam-hq
Working directory: ~/Desktop/sam-hq/index.html
Deploy: cd ~/Desktop/sam-hq && git add -A && git commit -m "message" && git push

---

## HOW TO START NEXT SESSION

1. Drag HANDOFF.md into new Claude chat
2. Say: "Read this handoff and let's continue building the SAM app"
3. Claude reads it and picks up exactly where we left off

Last updated: v7.95 session — Switch Tools fixed, MEET SAM flow partially restored, Voice DNA routing bug active
