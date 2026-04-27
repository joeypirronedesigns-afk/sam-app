#!/usr/bin/env python3
"""
Hide ecosystem overlay (and similar legacy overlays) under QS shell.
This is what's rendering the 'Keep building my story' purple bar.
"""

PATH = "app.html"

with open(PATH, "r") as f:
    content = f.read()

old_rule = """body.quiet-studio-shell .qs-legacy-workshop-block,
body.quiet-studio-shell #homeGrid { display: none !important; }"""

new_rule = """body.quiet-studio-shell .qs-legacy-workshop-block,
body.quiet-studio-shell #homeGrid,
body.quiet-studio-shell #ecosystemOverlay,
body.quiet-studio-shell #trialBadge,
body.quiet-studio-shell #ideasPickerPanel { display: none !important; }"""

if old_rule not in content:
    raise SystemExit("ERROR: Could not find legacy hide rule. Aborting.")
content = content.replace(old_rule, new_rule, 1)

# Bump v9.2 -> v9.3
v_count = content.count('>v9.2<')
content = content.replace('>v9.2<', '>v9.3<')

with open(PATH, "w") as f:
    f.write(content)

print(f"Patched {PATH}")
print(f"  - Killed #ecosystemOverlay under QS shell (the purple 'Keep building my story' bar)")
print(f"  - Also killed #trialBadge and #ideasPickerPanel for safety")
print(f"  - Bumped v9.2 -> v9.3 ({v_count} occurrences)")
