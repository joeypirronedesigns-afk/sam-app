#!/usr/bin/env python3
"""
Commit 3 — Quiet Studio shell authoritative.
- Hide legacy dark nav, chatFab, persistentSAMFab, chatPanel under body.quiet-studio-shell
- Inject QS cream top strip (S.A.M. wordmark + account chip)
- Inject QS Ask SAM chip (bottom-right) wired to existing togglePersistentSAM()
- Wire rail nav items with onclick handlers
- Bump version v2.2 -> v3, v8.32 -> v9.0
"""
import re

PATH = "app.html"

with open(PATH, "r") as f:
    content = f.read()

# --- 1. Update existing CSS rule for legacy nav: hide entirely under QS shell ---
old_nav_rule = """body.quiet-studio-shell > nav {"""
new_nav_rule = """body.quiet-studio-shell > nav { display: none !important; }
body.quiet-studio-shell #chatFab,
body.quiet-studio-shell #chatPanel,
body.quiet-studio-shell #persistentSAMFab { display: none !important; }

/* QS top strip */
body.quiet-studio-shell .qs-topstrip {
  position: fixed;
  top: 0;
  left: 220px;
  right: 0;
  height: 48px;
  background: var(--paper);
  border-bottom: 1px solid var(--rule);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  z-index: 150;
  box-sizing: border-box;
}
body.quiet-studio-shell .qs-topstrip-wordmark {
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.08em;
  color: var(--ink);
  cursor: pointer;
  user-select: none;
}
body.quiet-studio-shell .qs-topstrip-wordmark .nav-logo-dot {
  color: var(--ink-muted);
}
body.quiet-studio-shell .qs-topstrip-account {
  display: flex;
  align-items: center;
  gap: 14px;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 500;
}
body.quiet-studio-shell .qs-topstrip-signin,
body.quiet-studio-shell .qs-topstrip-seeplan {
  background: none;
  border: none;
  color: var(--ink-soft);
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 6px;
  font-family: inherit;
  font-size: inherit;
  font-weight: inherit;
  transition: background 0.15s, color 0.15s;
}
body.quiet-studio-shell .qs-topstrip-signin:hover,
body.quiet-studio-shell .qs-topstrip-seeplan:hover {
  background: var(--surface-2);
  color: var(--ink);
}
body.quiet-studio-shell .qs-topstrip-seeplan {
  border: 1px solid var(--rule-strong);
}
body.quiet-studio-shell > main { padding-top: 48px; }

/* QS Ask SAM chip (bottom-right) */
body.quiet-studio-shell .qs-asksam-chip {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: var(--paper);
  border: 1px solid var(--rule-strong);
  border-radius: 12px;
  padding: 12px 18px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
  z-index: 180;
  transition: background 0.15s, border-color 0.15s, transform 0.15s;
  box-shadow: 0 1px 2px rgba(26,24,21,0.04);
}
body.quiet-studio-shell .qs-asksam-chip:hover {
  background: var(--surface-2);
  border-color: var(--ink-faint);
  transform: translateY(-1px);
}
body.quiet-studio-shell .qs-asksam-chip-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-muted);
}
body.quiet-studio-shell .qs-asksam-chip-sub {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: var(--ink-soft);
}

/* Mobile: top strip flush left, chip smaller */
@media (max-width: 767px) {
  body.quiet-studio-shell .qs-topstrip { left: 0; padding: 0 16px; }
  body.quiet-studio-shell .qs-asksam-chip { bottom: 16px; right: 16px; padding: 10px 14px; }
}

/* Old nav rule preserved below for reference, but hidden by display:none above */
body.quiet-studio-shell > nav.legacy-disabled {"""

if old_nav_rule not in content:
    raise SystemExit("ERROR: Could not find legacy nav CSS hook. Aborting.")
content = content.replace(old_nav_rule, new_nav_rule, 1)

# --- 2. Inject QS top strip + Ask SAM chip after the QS rail closing </div> ---
# Find the closing </div> right after the </aside> for the rail
rail_close_marker = """    <div class="qs-rail-footer">
      <div class="qs-version-stamp">Quiet Studio v2.2</div>
    </div>
  </aside>
</div>"""

rail_close_replacement = """    <div class="qs-rail-footer">
      <div class="qs-version-stamp">Quiet Studio v3</div>
    </div>
  </aside>

  <!-- QS Top Strip -->
  <div class="qs-topstrip" role="banner">
    <div class="qs-topstrip-wordmark" onclick="goHome()">S<span class="nav-logo-dot">.</span>A<span class="nav-logo-dot">.</span>M<span class="nav-logo-dot">.</span></div>
    <div class="qs-topstrip-account">
      <button class="qs-topstrip-signin" onclick="openSignInModal()">Sign in</button>
      <button class="qs-topstrip-seeplan" onclick="openProPage()">See plan</button>
    </div>
  </div>

  <!-- QS Ask SAM Chip -->
  <div class="qs-asksam-chip" role="button" tabindex="0" onclick="togglePersistentSAM()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();togglePersistentSAM();}">
    <span class="qs-asksam-chip-label">Ask SAM</span>
    <span class="qs-asksam-chip-sub">Need a direction?</span>
  </div>
</div>"""

if rail_close_marker not in content:
    raise SystemExit("ERROR: Could not find rail closing marker. Aborting.")
content = content.replace(rail_close_marker, rail_close_replacement, 1)

# --- 3. Wire rail nav items with onclick handlers ---
rail_dashboard_old = """      <div class="qs-rail-item">
        <svg class="qs-rail-item-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Dashboard
      </div>"""

rail_dashboard_new = """      <div class="qs-rail-item" onclick="goHome()" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();goHome();}" style="cursor:pointer;">
        <svg class="qs-rail-item-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Dashboard
      </div>"""

if rail_dashboard_old not in content:
    raise SystemExit("ERROR: Could not find Dashboard rail item. Aborting.")
content = content.replace(rail_dashboard_old, rail_dashboard_new, 1)

rail_spark_old = """      <div class="qs-rail-item">
        <svg class="qs-rail-item-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4L13.7 8.3L18 10L13.7 11.7L12 16L10.3 11.7L6 10L10.3 8.3L12 4Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Spark
      </div>"""

rail_spark_new = """      <div class="qs-rail-item" onclick="openTool('spark')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openTool('spark');}" style="cursor:pointer;">
        <svg class="qs-rail-item-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4L13.7 8.3L18 10L13.7 11.7L12 16L10.3 11.7L6 10L10.3 8.3L12 4Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Spark
      </div>"""

if rail_spark_old not in content:
    raise SystemExit("ERROR: Could not find Spark rail item. Aborting.")
content = content.replace(rail_spark_old, rail_spark_new, 1)

rail_myideas_old = """      <div class="qs-rail-item">
        <svg class="qs-rail-item-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="7" width="11" height="10" rx="2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 7V6.5C9 5.7 9.7 5 10.5 5H17.5C18.3 5 19 5.7 19 6.5V13.5C19 14.3 18.3 15 17.5 15H16" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
        My Ideas
      </div>"""

rail_myideas_new = """      <div class="qs-rail-item" onclick="openIdeasPanel()" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openIdeasPanel();}" style="cursor:pointer;">
        <svg class="qs-rail-item-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="7" width="11" height="10" rx="2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 7V6.5C9 5.7 9.7 5 10.5 5H17.5C18.3 5 19 5.7 19 6.5V13.5C19 14.3 18.3 15 17.5 15H16" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
        My Ideas
      </div>"""

if rail_myideas_old not in content:
    raise SystemExit("ERROR: Could not find My Ideas rail item. Aborting.")
content = content.replace(rail_myideas_old, rail_myideas_new, 1)

rail_storyengine_old = """      <div class="qs-rail-item">
        <svg class="qs-rail-item-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6.5C6 5.7 6.7 5 7.5 5H11.5C12.9 5 14 6.1 14 7.5V18.5C14 17.1 12.9 16 11.5 16H7.5C6.7 16 6 16.7 6 17.5V6.5Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 6.5C18 5.7 17.3 5 16.5 5H12.5C11.1 5 10 6.1 10 7.5V18.5C10 17.1 11.1 16 12.5 16H16.5C17.3 16 18 16.7 18 17.5V6.5Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 8.5H10.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 11H11" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.5 8L14.6 9.1L16.5 7.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.5 11L14.6 12.1L16.5 10.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Story Engine
      </div>"""

rail_storyengine_new = """      <div class="qs-rail-item" onclick="openWizardPage()" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openWizardPage();}" style="cursor:pointer;">
        <svg class="qs-rail-item-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6.5C6 5.7 6.7 5 7.5 5H11.5C12.9 5 14 6.1 14 7.5V18.5C14 17.1 12.9 16 11.5 16H7.5C6.7 16 6 16.7 6 17.5V6.5Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 6.5C18 5.7 17.3 5 16.5 5H12.5C11.1 5 10 6.1 10 7.5V18.5C10 17.1 11.1 16 12.5 16H16.5C17.3 16 18 16.7 18 17.5V6.5Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 8.5H10.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 11H11" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.5 8L14.6 9.1L16.5 7.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.5 11L14.6 12.1L16.5 10.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Story Engine
      </div>"""

if rail_storyengine_old not in content:
    raise SystemExit("ERROR: Could not find Story Engine rail item. Aborting.")
content = content.replace(rail_storyengine_old, rail_storyengine_new, 1)

rail_alltools_old = """      <div class="qs-rail-item">
        <svg class="qs-rail-item-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 12H16M12 8V16" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
        All Tools
      </div>"""

rail_alltools_new = """      <div class="qs-rail-item" onclick="openQSDrawer()" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openQSDrawer();}" style="cursor:pointer;">
        <svg class="qs-rail-item-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 12H16M12 8V16" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
        All Tools
      </div>"""

if rail_alltools_old not in content:
    raise SystemExit("ERROR: Could not find All Tools rail item. Aborting.")
content = content.replace(rail_alltools_old, rail_alltools_new, 1)

# --- 4. Bump shell version data attribute ---
content = content.replace(
    'data-qs-shell="true" data-qs-version="v2.2"',
    'data-qs-shell="true" data-qs-version="v3"',
    1
)

# --- 5. Bump v8.32 -> v9.0 in both locations ---
v832_count = content.count('>v8.32<')
content = content.replace('>v8.32<', '>v9.0<')

# --- Write back ---
with open(PATH, "w") as f:
    f.write(content)

print(f"Patched {PATH}")
print(f"  - Hid legacy nav, chatFab, persistentSAMFab, chatPanel under QS shell")
print(f"  - Injected QS top strip (S.A.M. + Sign in / See plan)")
print(f"  - Injected QS Ask SAM chip (bottom-right, opens existing chat brain)")
print(f"  - Wired all 5 rail nav items")
print(f"  - Bumped Quiet Studio v2.2 -> v3")
print(f"  - Bumped v8.32 -> v9.0 ({v832_count} occurrences)")
