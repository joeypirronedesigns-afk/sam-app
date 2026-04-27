#!/usr/bin/env python3
"""
Hide legacy #homeGrid tool tile row under QS shell.
"""

PATH = "app.html"

with open(PATH, "r") as f:
    content = f.read()

old_rule = """body.quiet-studio-shell .qs-legacy-workshop-block { display: none !important; }"""
new_rule = """body.quiet-studio-shell .qs-legacy-workshop-block,
body.quiet-studio-shell #homeGrid { display: none !important; }"""

if old_rule not in content:
    raise SystemExit("ERROR: Could not find legacy workshop block rule. Aborting.")
content = content.replace(old_rule, new_rule, 1)

# Bump v9.1 -> v9.2
v_count = content.count('>v9.1<')
content = content.replace('>v9.1<', '>v9.2<')

with open(PATH, "w") as f:
    f.write(content)

print(f"Patched {PATH}")
print(f"  - Hid #homeGrid (legacy tool tile row) under QS shell")
print(f"  - Bumped v9.1 -> v9.2 ({v_count} occurrences)")
