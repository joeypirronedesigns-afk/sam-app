# SAM APP BUILD — SESSION HANDOFF
**App:** SAM (Strategic Assistant for Making) at samforcreators.com
**Single index.html file. Deployed on Vercel. GitHub repo: joeypirronedesigns-afk/sam-app. Mac terminal workflow.**
**Current version: v7.94**
**Working directory:** ~/Desktop/sam-app/index.html
**Actual file path:** /Users/giuseppepirrone/Desktop/sam-app/index.html
**Dev branch:** photo-wizard-dev (ALL WORK HAPPENS HERE ONLY)

---

## CRITICAL RULES — READ FIRST

1. **ALL WORK ON `photo-wizard-dev` BRANCH ONLY.** Never touch main directly. Merge to main only after confirming stable in incognito.
2. **DO NOT BREAK OR DELETE ANYTHING THAT CURRENTLY WORKS.** Every change is either additive or cosmetic. If it works, it stays working.
3. Never touch `openWizardPage`, `showWizardStep`, `openMeetSAMOverlay`, `wizardPage`, `getTrialState`, `initTrial` — these control the core MEET SAM flow.
4. Always build new features as self-contained overlays/sections.
5. Always test on `photo-wizard-dev` in incognito before merging to main.
6. Version bump with every deploy — visible bottom left.
7. Never put literal \n inside JS strings in Python heredocs.
8. Always write complex scripts to file first: `cat > ~/Desktop/script.py << EOF` then `python3 ~/Desktop/script.py`
9. Verify with sed -n before deploying.
10. Scripts go to ~/Desktop/ not /tmp/.
11. Never use single-quoted font names inside JS strings — use sans-serif instead of Sora in JS-generated HTML.

---

## APP ARCHITECTURE

### The 8 Capabilities
| Name | What it does |
|------|-------------|
| MEET SAM | Cinematic onboarding, forced first visit, builds Voice DNA |
| Story Wizard | Post-MEET SAM handoff — full content package from one moment. Launched via `openWizardPage(true)` |
| The Pulse | Short-form video script — hook/setup/turn/payoff + captions |
| The Spark | 5 original content ideas matched to Voice DNA |
| Blueprint | Full weekly content calendar, every platform, every post |
| The Vision | One bold original campaign concept + execution plan |
| The Lens | Photo → thumbnail strategy OR analytics screenshot → action plan |
| The Reach | Upload photo → SAM auto-fills content from user profile → user reviews/edits → schedule → post to socials |

### Site Flow
---

## THE REACH — FULL VISION (NEXT BUILD PRIORITY)

The Reach is NOT a form-fill tool. It is a smart publishing tool powered by everything SAM knows about the user.

**What it should do:**
1. User uploads a photo
2. SAM analyzes the photo AND pulls from:
   - Voice DNA (tone, style, how they write)
   - MEET SAM profile (niche, audience, platform preferences)
   - Past Story Engine outputs saved in My Ideas
   - Past hooks, captions, angles that worked
3. SAM **auto-fills every field** — headline, caption, description, CTA, hashtags — per platform
4. User reviews SAM's pre-filled content
5. User can edit any field inline
6. User can tap 💜 on any field to swap in a saved idea from My Ideas
7. User schedules and posts

**The user's job is review + approve, not create from scratch.**

**Current state of The Reach (v7.94):**
- ✅ Photo upload works
- ✅ Platform selection works
- ✅ Output selector works (headline/caption/description/CTA/hashtags)
- ✅ Scheduler (Mon-Sun with date) works
- ✅ Per-platform output cards render correctly
- ✅ Copy per field works
- ✅ Edit per field (contenteditable) works
- ✅ Copy all per platform works
- ✅ "Post to [platform] — Connect account →" coming soon button shows
- ⚠️ Hashtags are generic placeholders — need SAM-generated hashtags from profile
- ⚠️ Content is from photo analysis only — not pulling from Voice DNA or My Ideas yet
- ⚠️ 💜 My Ideas picker button not yet on each field in output
- ❌ Actual posting to socials not built (requires OAuth — future build)

**Next session priorities for The Reach:**
1. Add 💜 Ideas picker button to each output field
2. Build unified profile context object
3. Pass unified profile into The Reach API call so SAM auto-fills from user knowledge
4. Wire hashtag generation from profile niche/audience

---

## UNIFIED PROFILE — NEXT SESSION CRITICAL BUILD

Every tool currently reads from different data sources. Need one unified context object:
```javascript
const SAM_PROFILE = {
  name: '',        // from MEET SAM / localStorage
  niche: '',       // from setup / Voice DNA
  audience: '',    // from MEET SAM
  platforms: [],   // from MEET SAM
  tone: '',        // from setup
  voiceDNA: '',    // from Voice DNA tool
  savedIdeas: []   // from IB.load()
}
```
Every tool reads from SAM_PROFILE before generating. This makes all outputs compound and personalized.

---

## WHAT WAS BUILT THIS SESSION (v7.94)
| Change | Status |
|--------|--------|
| Nav → Talk with SAM · Workshop · See plans → | ✅ Done |
| `openWorkshop()` function | ✅ Done |
| Returning user routing (sam_uid → Workshop) | ✅ Done |
| Workshop header (Your Studio / Workshop) | ✅ Done |
| Story Wizard hero row in Workshop | ✅ Done |
| The Reach tool — HTML + JS + TOOLS object | ✅ Done |
| The Reach — copy/edit/copy-all buttons | ✅ Done |
| Ideas Picker — 💜 button on every tool input | ✅ Done |
| My Ideas card in Workshop grid | ✅ Done |
| Video Coming Soon teaser card | ✅ Done |
| Back to Workshop button in MEET SAM | ✅ Done |
| howItWorks hidden in Workshop mode | ✅ Done |
| SAM Voice button removed | ✅ Done |
| Hero pills updated (48hrs free, no card needed) | ✅ Done |
| Multiple syntax fixes | ✅ Done |

## STILL TO DO
| Task | Priority |
|------|----------|
| 💜 Ideas picker on each Reach output field | High |
| Unified profile context object | High |
| The Reach auto-fill from user profile | High |
| SAM-generated hashtags | Medium |
| Remove dead `#photo-wizard` section (line ~5537) | Low |
| Remove `showPhotoWizard()` function (line ~5674) | Low |
| Story Wizard playbook PDF gated for new users | Medium |
| Voice DNA fires too early in MEET SAM | Medium |
| Switch tools button not firing | Medium |
| Merge photo-wizard-dev → main | After testing |
| Update pricing copy ($19/$39/$99) | Medium |

---

## PRE-EXISTING BUGS (NOT INTRODUCED THIS SESSION)
- Voice DNA fires too early in MEET SAM flow
- Story Wizard playbook PDF hits paywall for active trial users
- Switch tools button not firing tool cards
- `[SAVE:platforms:TBD]` tag leaking in SAM responses mid-conversation

---

## KEY FUNCTIONS ADDED THIS SESSION
- `openWorkshop()` — hides hero + howItWorks, shows Workshop
- `openIdeasPicker(targetInputId)` — floating ideas picker panel
- `closeIdeasPicker()` — closes picker
- `ideasPickerSelect(id)` — fills target textarea with selected idea
- `reachHandleFile(e)` — photo upload for The Reach
- `reachHandleDrop(e)` — drag and drop for The Reach
- `reachRemoveImg(e)` — remove photo
- `runReach()` — API call + streaming + JSON renderer
- `resetReach()` — reset tool
- `reachCopyField(btn)` — copy individual field
- `reachEditField(fieldId)` — toggle contenteditable on field
- `reachCopyAll(platformId)` — copy all fields for a platform

---

## TIER MAPPING
| Code name | Product name | Price | Notes |
|-----------|-------------|-------|-------|
| `free` | Free Trial | 48hrs | Full access then email capture |
| `creator` | Creator | $19/mo | All tools + The Reach |
| `pro` | Broadcaster | $39/mo | Everything + video when ready |
| `studio` | Publisher/Agency | $99/mo | Unlimited, multiple voice profiles |

---

## SUPABASE
- `sam_users` table — `dev-joey` uid with `studio` tier
- Test as dev in browser console:
```javascript
localStorage.setItem('sam_uid', 'dev-joey');
localStorage.setItem('sam_tier', 'studio');
location.reload();
```

---

## DEPLOY COMMANDS
```bash
cd ~/Desktop/sam-app && git checkout photo-wizard-dev
git add -A && git commit -m "message" && git push origin photo-wizard-dev
# Merge to main only when confirmed stable:
git checkout main && git merge photo-wizard-dev && git push
```

---

## SAM HQ (separate app)
**URL:** sam-hq.vercel.app
**GitHub:** joeypirronedesigns-afk/sam-hq
**Working directory:** ~/Desktop/sam-hq/index.html
**Status:** Live, all 6 agents operational
**Deploy:** `cd ~/Desktop/sam-hq && git add -A && git commit -m "message" && git push`

---

## HOW TO USE THIS FILE
1. Drag this file into new Claude chat at session start
2. Claude reads it and is immediately up to speed
3. Update at end of each session
4. Commit: `git add HANDOFF.md && git commit -m "update handoff"`

---
*Last updated: v7.94 — Workshop restructure, The Reach tool, Ideas Picker, Reach vision defined*
