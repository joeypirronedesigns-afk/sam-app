# SAM APP BUILD — SESSION HANDOFF
**App:** SAM (Strategic Assistant for Making) at samforcreators.com
**Single index.html file. Deployed on Vercel. GitHub repo: joeypirronedesigns-afk/sam-app. Mac terminal workflow.**
**Current version: v7.93 (on photo-wizard-dev branch)**
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
8. Always use `python3 << 'PYEOF' ... PYEOF` for inline scripts.
9. Verify with sed -n before deploying.
10. Scripts go to ~/Desktop/ not /tmp/.

---

## APP ARCHITECTURE

### The 8 Capabilities
| Name | What it does |
|------|-------------|
| MEET SAM | Cinematic onboarding, forced first visit, builds Voice DNA |
| Story Engine | Post-MEET SAM handoff — full content package from one moment |
| The Pulse | Short-form video script — hook/setup/turn/payoff + captions |
| The Spark | 5 original content ideas matched to Voice DNA |
| Blueprint | Full weekly content calendar, every platform, every post |
| The Vision | One bold original campaign concept + execution plan |
| The Lens | Photo → thumbnail strategy OR analytics screenshot → action plan |
| The Reach | Upload photo → pick platforms → SAM generates content → schedule → post to socials |

### Site Flow
### Workshop Contains
- The Pulse
- The Spark
- Blueprint
- The Vision
- The Lens
- The Reach (new tool)
- 💜 My Ideas (moved from nav into Workshop)
- 🎬 Video tool — Coming Soon teaser

---

## THE REACH — TOOL SPEC
Self-contained. Lives inside Workshop. Zero interaction with MEET SAM flow.
- Upload photo
- Select/deselect platforms (Facebook, LinkedIn, Instagram, X, etc.)
- Output options: Title/Headline, Captions, Description (platform appropriate, 1-4 sentences), Call to action, Hashtags
- Scheduler: pick day Mon→Sun with date
- Eventually: actually posts to user socials (not built yet)
- z-index: 500 (below wizardPage 800)
- Own open/close functions only

---

## TIER MAPPING
| Code name | Product name | Price | Notes |
|-----------|-------------|-------|-------|
| `free` | Free Trial | 48hrs | Full access then email capture |
| `creator` | Creator | $19/mo | All tools + The Reach |
| `pro` | Broadcaster | $39/mo | Everything + video when ready |
| `studio` | Publisher/Agency | $99/mo | Unlimited, multiple voice profiles |

---

## APP STRUCTURE — KEY IDs
- `#tools` — main container
- `#homeView` — tool grid
- `#tool-pulse`, `#tool-spark`, `#tool-blueprint`, `#tool-vision`, `#tool-lens` — all built, working
- `#ideasPanel` — My Ideas slide-in panel, triggered by `openIdeasPanel()`
- `#wizardPage` (line ~14062) — MEET SAM. NEVER TOUCH.
- `#photo-wizard` (line 5537) — old broken wizard, safe to remove
- `showPhotoWizard()` (line 5674) — old broken function, safe to remove

---

## SESSION CHANGES LOG
| Change | Type | Status |
|--------|------|--------|
| Nav → 3 buttons only | Cosmetic | Pending |
| Add `openWorkshop()` function | Additive | Pending |
| Workshop wrapper + header | Additive | Pending |
| My Ideas entry point in Workshop | Additive | Pending |
| The Reach tool | Additive | Pending |
| Video coming soon teaser | Additive | Pending |
| Remove `#photo-wizard` dead section | Removal | Pending |
| Remove `showPhotoWizard()` dead function | Removal | Pending |

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
3. At the end of each session, update the SESSION CHANGES LOG and version number
4. Commit it with the rest of the code: `git add HANDOFF.md && git commit -m "update handoff"`

---
*Last updated: photo-wizard-dev session — Workshop restructure + The Reach tool*
