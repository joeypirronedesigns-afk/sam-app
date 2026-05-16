# SAM for Creators — Claude Code Instructions

## First thing every session
Read SAM_PROJECT.md before doing anything else. It contains the full project context including stack, architecture decisions, open tasks, patches, env vars, DNS, auth flow, and working conventions.

## Working rules
- Anchor verification before every str_replace (search for the exact string first)
- Diff-before-apply on every edit
- Bump data-qs-version on div[data-qs-shell] in app.html on every commit
- Never ask Joey to do anything manually — run all commands yourself
- Show output of every step
- Surgical edits only — no broad rewrites unless explicitly asked

## Branch
Always work on: quietstudio
Deploy to production with: vercel --prod

## End of session
When a session ends with significant work shipped, update SAM_PROJECT.md:
1. Add new patches to Recent Patches section
2. Update current version number
3. Close completed tasks
4. Add new open tasks
5. Note new architecture decisions
Then: git add SAM_PROJECT.md && git commit -m "Update skill file: [date]" && git push origin quietstudio
