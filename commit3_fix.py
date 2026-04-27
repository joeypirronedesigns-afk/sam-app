#!/usr/bin/env python3
"""
Commit 3 fix:
1. Don't hide #persistentSAMFab entirely — it breaks the panel inside it.
   Instead hide only its visible button + label children.
2. Wrap the legacy Workshop section (line 5526 area) in a hide-able container.
"""

PATH = "app.html"

with open(PATH, "r") as f:
    content = f.read()

# --- 1. Replace the hide rule for persistentSAMFab ---
old_hide_rule = """body.quiet-studio-shell #chatFab,
body.quiet-studio-shell #chatPanel,
body.quiet-studio-shell #persistentSAMFab { display: none !important; }"""

new_hide_rule = """body.quiet-studio-shell #chatFab,
body.quiet-studio-shell #chatPanel { display: none !important; }
body.quiet-studio-shell .psam-fab-btn,
body.quiet-studio-shell .psam-fab-label { display: none !important; }
body.quiet-studio-shell #persistentSAMFab { background: transparent !important; gap: 0 !important; }
body.quiet-studio-shell .qs-legacy-workshop-block { display: none !important; }"""

if old_hide_rule not in content:
    raise SystemExit("ERROR: Could not find hide rule block. Aborting.")
content = content.replace(old_hide_rule, new_hide_rule, 1)

# --- 2. Wrap the legacy Workshop block + Story Wizard hero row ---
# Looking at the grep, the structure is:
# </div>  <-- closing dashboard tile grid
# <div style="max-width:860px;margin:0 auto;padding:48px 24px 8px;">
#   <div style="font-size:11px..."Your Studio"...
#   <h2 ...Workshop</h2>
#   <p ...Everything SAM has built for you...</p>
# </div>
# <!-- STORY WIZARD HERO ROW -->
# <div style="max-width:860px;margin:0 auto 32px;padding:0 24px;">
#   ...Story Wizard hero...
# </div>

old_workshop_marker = """      <div style="max-width:860px;margin:0 auto;padding:48px 24px 8px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(167,139,250,0.5);margin-bottom:10px;">Your Studio</div>
        <h2 style="font-family:'Sora',sans-serif;font-size:clamp(24px,3vw,34px);font-weight:800;color:var(--text);margin:0 0 6px;">Workshop</h2>
        <p style="font-size:14px;color:var(--text3);margin:0 0 32px;line-height:1.6;">Everything SAM has built for you. Pick a tool and keep creating.</p>
      </div>
      <!-- STORY WIZARD HERO ROW -->"""

new_workshop_marker = """      <div class="qs-legacy-workshop-block" style="max-width:860px;margin:0 auto;padding:48px 24px 8px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(167,139,250,0.5);margin-bottom:10px;">Your Studio</div>
        <h2 style="font-family:'Sora',sans-serif;font-size:clamp(24px,3vw,34px);font-weight:800;color:var(--text);margin:0 0 6px;">Workshop</h2>
        <p style="font-size:14px;color:var(--text3);margin:0 0 32px;line-height:1.6;">Everything SAM has built for you. Pick a tool and keep creating.</p>
      </div>
      <!-- STORY WIZARD HERO ROW (legacy, hidden under QS shell) -->"""

if old_workshop_marker not in content:
    raise SystemExit("ERROR: Could not find Workshop block marker. Aborting.")
content = content.replace(old_workshop_marker, new_workshop_marker, 1)

# --- 3. Wrap the Story Wizard hero row too ---
# Find the Story Wizard row that follows
old_storywiz_marker = """      <!-- STORY WIZARD HERO ROW (legacy, hidden under QS shell) -->
      <div style="max-width:860px;margin:0 auto 32px;padding:0 24px;">"""

new_storywiz_marker = """      <!-- STORY WIZARD HERO ROW (legacy, hidden under QS shell) -->
      <div class="qs-legacy-workshop-block" style="max-width:860px;margin:0 auto 32px;padding:0 24px;">"""

if old_storywiz_marker not in content:
    raise SystemExit("ERROR: Could not find Story Wizard hero row marker. Aborting.")
content = content.replace(old_storywiz_marker, new_storywiz_marker, 1)

# --- 4. Bump version v9.0 -> v9.1 ---
v_count = content.count('>v9.0<')
content = content.replace('>v9.0<', '>v9.1<')

# --- Write back ---
with open(PATH, "w") as f:
    f.write(content)

print(f"Patched {PATH}")
print(f"  - Fixed Ask SAM chip: panel can now open (removed blanket FAB hide)")
print(f"  - Hid only the legacy avatar button + label children")
print(f"  - Wrapped legacy Workshop + Story Wizard rows in .qs-legacy-workshop-block")
print(f"  - Bumped v9.0 -> v9.1 ({v_count} occurrences)")
