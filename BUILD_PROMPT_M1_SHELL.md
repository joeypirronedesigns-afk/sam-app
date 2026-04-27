claude-code-build-prompt-commits-1-3

Claude Code Build Prompt — Quiet Studio shell commits 1-3
This document defines the build sequence for wiring the Quiet Studio shell into the real SAM codebase with the lowest-risk migration path. It extends the existing kickoff instructions already in force.
The approach is locked:
* Use the real app surface as the integration target, not a standalone mock implementation. 
* Use the feature-flag variant as the default migration path because the existing app file is large and interdependent. 
* Temporarily allow both old and new shell layers to coexist so Claude can compare behavior and roll back quickly during build. 
Title
Quiet Studio shell integration — commits 1-3
Branch workflow
* Stay on quietstudio.
* Do not merge to main.
* Every commit must be a meaningful unit of work.
* Do not include any Co-Authored-By lines in commit messages.
* Every commit must bump a visible version stamp somewhere Joey can see in the UI or shell chrome.
* After each commit, verify the live preview deploy with curl and grep for the expected shell markers on /app, not /.
Protected zones — do not break
These are protected for all three commits:
* Marketing landing at / — DO NOT TOUCH. index.html is now the new Quiet Studio marketing landing and must remain untouched during this shell integration phase.
* Real integration target is app.html — DO NOT CONFUSE THE TWO. All shell work belongs in app.html.
* Meet SAM timing sequence — DO NOT TOUCH: openWizardPage at 300ms after DOMContentLoaded, then showWizardStep('entry'), then meetSamInit after 100ms. 
* Tool internals — DO NOT TOUCH in Milestone 1: Pulse, Blueprint, Vision, Lens internal logic stays intact; only access and shell framing may change. 
* Stripe checkout flow — DO NOT BREAK: paid session handling, including paid:true flow behavior, must continue to work.
* Stripe product migration is OUT OF SCOPE: api/stripe-checkout.js may still reference old Creator/Pro/Studio products. Do not migrate pricing/product references in these commits.
* Supabase reads/writes — DO NOT BREAK: existing reads, writes, auth assumptions, and persistence behavior must remain intact.
* API folder — DO NOT TOUCH unless Joey explicitly expands scope. 
* Email-as-UID convention — DO NOT CHANGE. 
Feature-flag pattern — commit 1 baseline
Use a body class toggle as the migration safety rail inside app.html:

xml
<body class="quiet-studio-shell">
Guidance:
* The new shell CSS and shell DOM behavior must be scoped under body.quiet-studio-shell wherever practical.
* The legacy shell and existing app structure may coexist temporarily during the first phase.
* Claude may temporarily duplicate wrapper DOM where needed to compare old vs new shell behavior.
* The goal is instant rollback: removing or disabling quiet-studio-shell should restore the legacy app experience during integration if needed.
* Do not use this as an excuse for permanent duplication. Temporary coexistence is allowed; long-term duplication is not.
Required shell markers for curl verification
Add stable grep-able markers in app.html so preview verification is deterministic:
* data-qs-shell="true"
* data-qs-version="vX"
* data-qs-dashboard="true"
* data-qs-drawer="true"
Update the version marker each commit.
Example verification pattern after deploy:

bash
curl -s https://sam-app-git-quietstudio-joeypirronedesigns-1029s-projects.vercel.app/app | grep 'data-qs-shell="true"'
curl -s https://sam-app-git-quietstudio-joeypirronedesigns-1029s-projects.vercel.app/app | grep 'data-qs-version="v1"'
Use the live preview URL every time and verify /app, not /.


Commit 1
Title
Install Quiet Studio shell scaffold behind feature flag
Scope
* Add Quiet Studio design tokens to app.html: cream #FAFAF7, ink #1A1815, teal #20808D, terra-rust #8B3A2F, plus Inter, JetBrains Mono, and Instrument Serif usage rules. 
* Introduce the new persistent shell scaffold inside app.html, including left rail, canvas wrapper, shell layout regions, and shell-level chrome containers. 
* Scope the new shell under body.quiet-studio-shell so legacy and new shell layers can coexist temporarily.
* Add visible version stamp v1 in the shell.
* Add shell verification markers in app.html: data-qs-shell="true" and data-qs-version="v1".
* Preserve all existing panel DOM and behavior underneath this new shell layer.
Files touched
Expected files, adjust only if the codebase proves otherwise:
* app.html
* shared CSS blocks inside that file, or whichever stylesheet owns the real app shell variables
Can-break list
Allowed risk in this commit:
* spacing
* typography
* surface styling
* overflow
* layout wrappers
* z-index conflicts
* responsive shell layout behavior
Must-not-break list
This commit must not break:
* the marketing landing at /
* panel open/close logic
* existing app navigation behavior
* Meet SAM timing sequence
* Pulse/Blueprint/Vision/Lens internal logic
* Stripe paid session handling
* Supabase reads/writes
* auth assumptions
* existing serverless/API behavior
Acceptance criteria
* app.html renders inside a Quiet Studio shell scaffold on the quietstudio branch. 
* The shell is visibly feature-flagged through body.quiet-studio-shell.
* A visible version stamp shows v1.
* Existing panels still function because internals have not been rewritten.
* The marketing landing at / is unchanged.
* No console errors.
* Mobile remains coherent at 375px with no horizontal scroll. 
* Live deploy verification succeeds:

bash
curl -s https://sam-app-git-quietstudio-joeypirronedesigns-1029s-projects.vercel.app/app | grep 'data-qs-shell="true"'
curl -s https://sam-app-git-quietstudio-joeypirronedesigns-1029s-projects.vercel.app/app | grep 'data-qs-version="v1"'

Commit 2
Title
Replace dashboard entry layer with Quiet Studio dashboard and All Tools drawer
Scope
* Swap the old dashboard entry UI in app.html for the Quiet Studio dashboard layer inside the new shell. 
* Add the six primary dashboard tiles, but distinguish clearly between existing reachable surfaces and Milestone 2 placeholders.
Tiles that route to existing surfaces now
* Spark → route to the existing Spark panel.
* My Ideas → route to the existing My Ideas panel.
* All Tools → open drawer that routes to existing Pulse, Blueprint, Vision, and Lens panels. 
Tiles that are placeholders in Milestone 1
* Voice DNA → coming-soon placeholder only; do not invent a panel.
* Story Engine → may point to the existing 12-step wizard entry if that path is already real and stable; if not, render as a clearly labeled coming-soon placeholder and do not invent a new panel.
* Reach → coming-soon placeholder only; do not invent a panel.
* Reuse the existing SPA-style show/hide section pattern already present in app.html; do not invent a parallel app state model for Milestone 1. 
* Add visible version stamp v2.
* Add dashboard and drawer verification markers in app.html: data-qs-dashboard="true", data-qs-drawer="true", data-qs-version="v2".
Files touched
Expected files:
* app.html
* app shell/dashboard CSS blocks
* shell/dashboard JS event binding blocks
* drawer markup and styles
Can-break list
Allowed risk in this commit:
* dashboard tile click behavior
* drawer open/close behavior
* panel entry-point wiring
* active visual states in dashboard and rail
* shell-level navigation polish
Must-not-break list
This commit must not break:
* the marketing landing at /
* Pulse/Blueprint/Vision/Lens internal logic
* Spark and My Ideas existing panel behavior
* any existing stable Story Engine wizard entry path, if one already exists
* underlying panel functionality
* Supabase reads/writes
* Stripe paid session flow
* auth assumptions
* existing generation endpoints and usage messaging
* Meet SAM timing sequence
Acceptance criteria
* app.html shows the six-tile Quiet Studio dashboard in the real shell. 
* Spark and My Ideas tiles route to their existing panels.
* All Tools drawer opens and exposes Pulse, Blueprint, Vision, and Lens. 
* Those four tools still function with their existing logic untouched. 
* Voice DNA and Reach are clearly labeled placeholders, not fake panels.
* Story Engine is only wired if the current wizard entry path already exists and is stable; otherwise it is clearly labeled as not yet live.
* A visible version stamp shows v2.
* The marketing landing at / is unchanged.
* No console errors.
* Mobile tile stack and drawer behavior remain coherent at 375px. 
* Live deploy verification succeeds:

bash
curl -s https://sam-app-git-quietstudio-joeypirronedesigns-1029s-projects.vercel.app/app | grep 'data-qs-dashboard="true"'
curl -s https://sam-app-git-quietstudio-joeypirronedesigns-1029s-projects.vercel.app/app | grep 'data-qs-drawer="true"'
curl -s https://sam-app-git-quietstudio-joeypirronedesigns-1029s-projects.vercel.app/app | grep 'data-qs-version="v2"'

Commit 3
Title
Make Quiet Studio shell authoritative and remove conflicting legacy chrome
Scope
* Tie active rail and dashboard highlight states in app.html to actual visible app state instead of hardcoded placeholders.
* Tighten shell spacing and remove the extra canvas-left offset discovered in the mock review.
* Remove, hide, or neutralize obsolete legacy dashboard chrome in app.html that conflicts with the new shell.
* Normalize shell-level transitions, selected states, and mobile behavior.
* Keep existing tool internals intact; this is an integration/polish commit, not a deep tool rewrite.
* Add visible version stamp v3.
* Keep data-qs-shell="true" in app.html and update data-qs-version="v3".
Files touched
Expected files:
* app.html
* shell CSS
* shell navigation state JS
* old dashboard access points that need to be hidden or deprecated
Can-break list
Allowed risk in this commit:
* active-state styling
* selected-state logic
* deprecated old dashboard chrome
* shell spacing cleanup
* mobile layout polish
* drawer/panel transition polish
Must-not-break list
This commit must not break:
* the marketing landing at /
* core panel functionality
* existing event handlers that panels depend on
* Stripe paid session handling
* Supabase reads/writes
* Meet SAM timing sequence
* Pulse/Blueprint/Vision/Lens internal logic
* auth and tier-limit behavior
Acceptance criteria
* The Quiet Studio shell now reads as the authoritative app frame inside app.html on the quietstudio branch.
* Active-state highlight matches the actual current state; no hardcoded false active markers remain.
* Canvas spacing is tightened and no unnecessary left-padding gap remains.
* Obsolete legacy chrome that conflicts with the shell is removed or hidden.
* A visible version stamp shows v3.
* The marketing landing at / is unchanged.
* No console errors.
* Mobile remains coherent and tappable at 375px. 
* Live deploy verification succeeds:

bash
curl -s https://sam-app-git-quietstudio-joeypirronedesigns-1029s-projects.vercel.app/app | grep 'data-qs-shell="true"'
curl -s https://sam-app-git-quietstudio-joeypirronedesigns-1029s-projects.vercel.app/app | grep 'data-qs-version="v3"'

Implementation notes for Claude Code
* Use centralized event binding for new shell/dashboard work where practical, but do not refactor unrelated old panels just for cleanliness. 
* Respect Joey's established motion rules: CSS transitions only, cubic-bezier(0.16, 1, 0.3, 1), no animation library, and honor prefers-reduced-motion. 
* Desktop is primary, but mobile must remain coherent at 375px with 44px minimum tap targets. 
* The goal of these three commits is safe shell migration in app.html, not full tool redesign, not backend changes, not schema work, and not Stripe product migration.
Commit message pattern
Use short factual messages, for example:
* app shell scaffold behind quiet studio flag
* dashboard and all tools drawer in app shell
* app shell state polish and legacy chrome cleanup
Again: no Co-Authored-By lines.
Claude Code Build Prompt — Quiet Studio shell commits 1-3
This document defines the build sequence for wiring the Quiet Studio shell into the real SAM codebase with the lowest-risk migration path. It extends the existing kickoff instructions already in force.
The approach is locked:
* Use the real app surface as the integration target, not a standalone mock implementation. 
* Use the feature-flag variant as the default migration path because the existing app file is large and interdependent. 
* Temporarily allow both old and new shell layers to coexist so Claude can compare behavior and roll back quickly during build.