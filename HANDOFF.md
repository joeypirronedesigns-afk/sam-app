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
8. Always use `python3 << 'PYEOF' ... PYEOF` for inline scripts — or write to file first with `cat > ~/Desktop/script.py << 'EOF'` for complex scripts.
9. Verify with sed -n before deploying.
10. Scripts go to ~/Desktop/ not /tmp/.

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
| The Reach | Upload photo → pick platforms → SAM generates content → schedule → post to socials (posting not built yet) |

### Site Flow
### Workshop Layout
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
| Ideas Picker — 💜 button on every tool input | ✅ Done |
| My Ideas card in Workshop grid | ✅ Done |
| Video Coming Soon teaser card | ✅ Done |
| "← Back to Workshop" button in MEET SAM | ✅ Done |
| howItWorks hidden in Workshop mode | ✅ Done |
| Remove old broken Photo Wizard nav button | ✅ Done |

## STILL TO DO
| Task | Notes |
|------|-------|
| Remove old `#photo-wizard` section (line ~5537) | Dead code, safe to remove |
| Remove `showPhotoWizard()` function (line ~5674) | Dead code, safe to remove |
| Test The Reach output rendering | JSON issue fixed in prompt — needs verification |
| Merge photo-wizard-dev → main | Only after full incognito test passes |
| Update pricing copy ($19/$39/$99) | Tier names exist, just copy update needed |

---

## KEY FUNCTIONS ADDED THIS SESSION
- `openWorkshop()` — hides hero + howItWorks, shows Workshop
- `openIdeasPicker(targetInputId)` — opens floating ideas picker panel
- `closeIdeasPicker()` — closes picker
- `ideasPickerSelect(id)` — fills target textarea with selected idea
- `reachHandleFile(e)` — photo upload handler for The Reach
- `reachHandleDrop(e)` — drag and drop for The Reach
- `reachRemoveImg(e)` — remove photo from The Reach
- `runReach()` — API call + streaming output for The Reach
- `resetReach()` — reset The Reach tool

## KEY IDs ADDED THIS SESSION
- `#tool-reach` — The Reach tool wrap
- `#reachDropZone` — photo drop zone
- `#reachFile` — file input
- `#reachMoment` — story textarea
- `#reachPlatforms` — platform pills
- `#reachOutputs` — output option pills
- `#reachScheduler` — day/date picker grid
- `#reachLoader` — loading state
- `#reachOutput` — output container
- `#reachBody` — output body
- `#ideasPickerOverlay` — picker backdrop
- `#ideasPickerPanel` — picker panel
- `#ideasPickerList` — picker ideas list

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
# Always on dev branch
cd ~/Desktop/sam-app && git checkout photo-wizard-dev

# Commit and push to dev
git add -A && git commit -m "message" && git push origin photo-wizard-dev

# Only when confirmed working — merge to main
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
1. At the start of every new Claude session, drag this file into the chat
2. Claude reads it and is immediately up to speed
3. At the end of each session, update this file to reflect what was built
4. Commit it: `git add HANDOFF.md && git commit -m "update handoff"`

---
*Last updated: v7.94 — Workshop restructure, The Reach tool, Ideas Picker*
