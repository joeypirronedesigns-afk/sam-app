# SAM APP BUILD — SESSION HANDOFF

**App:** SAM (Strategic Assistant for Making) at samforcreators.com
**Single index.html file. Deployed on Vercel. GitHub repo: joeypirronedesigns-afk/sam-app. Mac terminal workflow.**
**Current version: v7.94**
**File path:** /Users/giuseppepirrone/Desktop/sam-app/index.html
**Dev branch:** photo-wizard-dev (ALL WORK HAPPENS HERE ONLY)

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

---

## SITE FLOW

NEW VISITOR: lands on homepage -> MEET SAM fires (forced, can't skip) -> Story Engine -> Homepage
RETURNING USER: sam_uid in localStorage -> openWorkshop() fires -> lands directly in Workshop

NAV (3 items only): Talk with SAM | Workshop | See plans

---

## WORKSHOP LAYOUT

Top: Story Wizard hero row with "Launch Story Wizard" button (calls openWizardPage(true))
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

## THE REACH — FULL VISION (TOP PRIORITY NEXT SESSION)

The Reach is a smart publishing tool powered by everything SAM knows about the user.

WHAT IT SHOULD DO:
1. User uploads a photo
2. SAM analyzes photo AND pulls from Voice DNA, MEET SAM profile, My Ideas, past outputs
3. SAM auto-fills every field per platform (headline, caption, description, CTA, hashtags)
4. User reviews SAM pre-filled content
5. User edits any field inline
6. User taps the heart icon on any field to swap in a saved idea from My Ideas
7. User schedules and posts

The user's job is review and approve, not create from scratch.

CURRENT STATE v7.94:
- Photo upload works
- Platform selection works
- Output selector works
- Scheduler Mon-Sun with date works
- Per-platform output cards render correctly
- Copy per field works
- Edit per field contenteditable works
- Copy all per platform works
- Post to platform connect account coming soon button shows
- Hashtags are generic placeholders - need SAM-generated from profile
- Content from photo analysis only - not pulling from Voice DNA or My Ideas yet
- Heart My Ideas picker button not yet on each output field
- Actual posting to socials not built yet - requires OAuth future build

---

## UNIFIED PROFILE — CRITICAL NEXT BUILD

Every tool reads from different data sources. Need one unified context object:

SAM_PROFILE contains: name, niche, audience, platforms, tone, voiceDNA, savedIdeas

Every tool reads SAM_PROFILE before generating. This makes all outputs compound and personalized.

---

## STILL TO DO

High priority:
- Add heart Ideas picker button to each Reach output field
- Build SAM_PROFILE unified context object
- The Reach auto-fills from user profile
- SAM-generated hashtags from profile niche and audience

Medium priority:
- Story Wizard playbook PDF gated for active trial users (pre-existing bug)
- Voice DNA fires too early in MEET SAM (pre-existing bug)
- Switch tools button not firing (pre-existing bug)
- Update pricing copy to $19/$39/$99

Low priority:
- Remove dead photo-wizard section (line 5537)
- Remove showPhotoWizard function (line 5674)
- Merge photo-wizard-dev to main after full test pass

---

## TIER MAPPING

free = Free Trial, 48hrs full access then email capture
creator = Creator, $19/mo, all tools + The Reach
pro = Broadcaster, $39/mo, everything + video when ready
studio = Publisher/Agency, $99/mo, unlimited, multiple voice profiles

Current code limits:
free: 5 playbooks, 15 next-tool uses, 20 chat messages
creator: 10 playbooks, 70 next-tool uses, 50 chat messages
pro: 20 playbooks, 200 next-tool uses, 150 chat messages
studio: 100 playbooks, 999 next-tool uses, 999 chat messages

---

## KEY FUNCTIONS

openWorkshop() - hides hero and howItWorks, shows Workshop grid
openIdeasPicker(targetInputId) - opens floating ideas picker panel
closeIdeasPicker() - closes picker
ideasPickerSelect(id) - fills target textarea with selected idea
runReach() - API call + streaming + JSON renderer for The Reach
resetReach() - resets The Reach tool
reachCopyField(btn) - copies individual field
reachEditField(fieldId) - toggles contenteditable on field
reachCopyAll(platformId) - copies all fields for a platform

---

## SUPABASE TEST

Run in browser console to test as dev:
localStorage.setItem('sam_uid', 'dev-joey');
localStorage.setItem('sam_tier', 'studio');
location.reload();

---

## DEPLOY COMMANDS

cd ~/Desktop/sam-app && git checkout photo-wizard-dev
git add -A && git commit -m "message" && git push origin photo-wizard-dev
Merge to main only when confirmed stable in incognito:
git checkout main && git merge photo-wizard-dev && git push

---

## SAM HQ SEPARATE APP

URL: sam-hq.vercel.app
GitHub: joeypirronedesigns-afk/sam-hq
Working directory: ~/Desktop/sam-hq/index.html
Status: Live, all 6 agents operational
Deploy: cd ~/Desktop/sam-hq && git add -A && git commit -m "message" && git push

---

## HOW TO START NEXT SESSION

1. Drag this HANDOFF.md file into new Claude chat
2. Say: "Read this handoff doc and lets continue building the SAM app"
3. Claude reads it and picks up exactly where we left off

Last updated: v7.94 session - Workshop restructure, The Reach tool, Ideas Picker, Reach vision defined
