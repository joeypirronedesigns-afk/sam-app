// Patch AY — SAM's script writer. One focused call on the strongest model, separate from the big playbook
// call. Step A: fill a STORY SHEET with the creator's exact words for each slot of the retention formula.
// Step B: write each beat ONLY from its slot. Code then checks every sheet quote against what the creator
// actually wrote; a quote that isn't there is treated as missing (never as fact).
const SCRIPT_MODEL = process.env.SAM_SCRIPT_MODEL || 'claude-opus-5-5';
// Patch BA — if the first model fails, try these in order before giving up.
const FALLBACK_MODELS = [SCRIPT_MODEL, 'claude-sonnet-5-5', 'claude-sonnet-4-6'].filter((m, i, a) => a.indexOf(m) === i);

// Lenient JSON: strip code fences, cut to the outer braces, drop trailing commas.
function parseLooseJSON(raw) {
  let t = String(raw || '').replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('no JSON object in reply');
  t = t.slice(a, b + 1);
  try { return JSON.parse(t); } catch (_) {}
  return JSON.parse(t.replace(/,\s*([}\]])/g, '$1').replace(/[\u201c\u201d]/g, '"'));
}

const { patternPrompt, byId: PATTERN_BY_ID } = require('./_patterns'); // Patch BC

const norm = t => String(t || '').toLowerCase().replace(/[“”"’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Day N of a series (start date = Day 1), in the creator's time zone.
function dayNumber(startDate, tz) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startDate || ''))) return null;
  let todayStr;
  try { todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  catch (_) { todayStr = new Date().toISOString().slice(0, 10); }
  const a = Date.UTC(...startDate.split('-').map((n, i) => (i === 1 ? +n - 1 : +n)));
  const b = Date.UTC(...todayStr.split('-').map((n, i) => (i === 1 ? +n - 1 : +n)));
  const d = Math.floor((b - a) / 86400000) + 1;
  return d >= 1 && d < 20000 ? d : null;
}

// Is this quote really in the creator's words? (allows light trimming, not rewriting)
function quoteIsReal(quote, source) {
  const q = norm(quote); if (!q) return false;
  const src = norm(source);
  if ((' ' + src + ' ').includes(' ' + q + ' ')) return true;   // whole words only
  const w = q.split(' ').filter(x => x.length > 2);
  if (w.length < 3) return false;
  const set = new Set(src.split(' '));
  return w.filter(x => set.has(x)).length / w.length >= 0.85;
}

async function writeFormulaScript(o) {
  const { apiKey, moment, creatorContext, notebook, voiceProfile, seriesName, dayN, bestScripts, todayLine } = o;
  if (!apiKey || !moment || String(moment).trim().length < 40) return null;
  const examples = (bestScripts || []).filter(Boolean);
  const system = `You are SAM's script writer for short-form video. You write ONE script that follows a proven retention formula, using ONLY what the creator said.${todayLine || ''}

THE FORMULA (six beats):
- OPENING (0–5s): the ANCHOR — a number or timeframe AND who it's for, in one line — then an OPEN LOOP (the creator's own phrase if they wrote one, e.g. "Let me explain."; otherwise "Let me explain.").
- SETUP: who the creator is and why this is hard for THEM (the UNDERDOG) — from their story or BACKGROUND only.
- RISK: the STAKES — the deadline, the promise, or the cost. (Not the underdog. Not backstory.) If the creator gave a countdown or number ("29 days left"), SAY THE NUMBER here — it is the urgency.
- TURN: the honest STRUGGLE — what was harder than expected or a moment of doubt, in their words. If they gave none, use the plain decision or pivot from their story — never invent doubt or feelings.
- PAYOFF: fast PROOF of what is done or visible TODAY — a quick rhythm of short items from their story — then ONE emotional line built from their own words. Never a future scene (no "Christmas Day… their faces"), never something that hasn't happened.
- CTA: the VIEWER TURN — one line that makes it about the person watching, from the creator's own words when they wrote one, kept whole and in their order (e.g. "…you can do yours. Keep showing up."). Then, if the creator said what's next, ONE short tease of 15 words max — "Next up: …" naming the 2–3 most visual or dramatic items, never the whole to-do list. Do NOT write the creator's sign-off; it is added after.

SAY EACH THING ONCE (Patch BB): never repeat a clause from an earlier beat. The hook's promise line is not said again in the Risk beat; the big number (e.g. "450 days") appears at most twice in the whole script. Your best-performing scripts said each thing once and kept moving.

HOOK PATTERNS (Patch BC) — proven structures. Pick the ONE that best fits THIS story's real material and shape the hook (and the arc around it) with it. The anchor still has to land in the Opening: the number/timeframe and who it's for appear in the hook or the line right after it.
${patternPrompt()}

STEP A — fill the STORY SHEET. Every quote must be copied WORD FOR WORD from STORY, ANSWERS or BACKGROUND below (you may trim, never reword). If a slot has nothing, use "".
STEP B — write each beat ONLY from its slot (plus light connective words). You may tighten rhythm and fix grammar. You may NOT add facts, numbers, people, feelings, quotes, promises or events that aren't in the sheet.
${dayN ? `SERIES: this is Day ${dayN} of ${seriesName || 'the creator\'s series'}. If the story does not already state its own day count or timeframe, the Opening may start "Day ${dayN}." Never use a day count that conflicts with the creator's.` : ''}
VOICE: write as the creator, in their rhythm.${voiceProfile ? ` Their Voice DNA:\n${String(voiceProfile).slice(0, 1500)}` : ''}
${examples.length ? `\nTHE CREATOR'S BEST-PERFORMING SCRIPTS — study HOW they build a story (rhythm, length, how they open, how they turn to the viewer). Never copy their facts into this script:\n${examples.map((e, i) => `--- Example ${i + 1} ---\n${e.slice(0, 3000)}`).join('\n')}\n` : ''}
${notebook ? `BACKGROUND ABOUT THE CREATOR (context only — use a fact in the script only if the story itself mentions it, except the underdog background):\n${notebook}\n` : ''}
Return ONLY JSON:
{"sheet":{"anchor":"quote with the number/timeframe","person":"who it's for, quoted","loop":"their own loop phrase or \\"\\"","underdog":"quote","stakes":"quote","struggle":"quote or \\"\\"","proof":["short quote", "..."],"viewer":"their line to the viewer or \\"\\"","next_up":"quote or \\"\\""},
"hook":"the Opening's first line — number/timeframe + who it's for, under 18 words",
"beats":{"opening":"...","setup":"...","risk":"...","turn":"...","payoff":"...","cta":"..."},
"cards":{"setup":"≤12 words","risk":"≤12 words","turn":"≤12 words","payoff":"≤18 words","cta":"≤14 words"},
"shots":["3–5 shots to film, only of things in the story"],
"pattern":"the id of the pattern you used for the hook",
"pattern_why":"one plain sentence to the creator: why this pattern fits THIS story",
"alt_hooks":[{"pattern":"a different pattern id","hook":"an alternate opening line built only from the story"},{"pattern":"another different id","hook":"..."}],
"pacing_note":"one delivery tip"}`;
  const user = `STORY AND ANSWERS (the creator's words):\n${moment}\n\n${creatorContext ? `CREATOR CONTEXT / BACKGROUND:\n${creatorContext}` : ''}`;
  const errors = [];
  for (const model of FALLBACK_MODELS) {
  const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), 110000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ac.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 3500, system, messages: [{ role: 'user', content: user }] })
    });
    if (!r.ok) { const e = `${model}: API ${r.status} ${(await r.text().catch(() => '')).slice(0, 160)}`; console.error('[script-writer]', e); errors.push(e); continue; }
    const d = await r.json();
    const raw = (d && d.content && d.content.map(c => c.text || '').join('')) || '';
    let j;
    try { j = parseLooseJSON(raw); } catch (pe) { const e = `${model}: unreadable reply (${pe.message}; stop=${d && d.stop_reason})`; console.error('[script-writer]', e); errors.push(e); continue; }
    if (!j || !j.beats || !j.hook) { errors.push(`${model}: reply missing beats/hook`); continue; }
    // Validate the sheet against the creator's words.
    const source = [moment, creatorContext, notebook].filter(Boolean).join('\n');
    const sheet = j.sheet || {}, checked = {};
    for (const k of ['anchor', 'person', 'loop', 'underdog', 'stakes', 'struggle', 'viewer', 'next_up']) {
      const q = String(sheet[k] || '').trim();
      checked[k] = q && quoteIsReal(q, source) ? q : '';
    }
    checked.proof = (Array.isArray(sheet.proof) ? sheet.proof : []).map(x => String(x || '').trim()).filter(q => q && quoteIsReal(q, source)).slice(0, 6);
    return { ...j, sheet: checked, model, errors };
  } catch (e) { const m = `${model}: ${e && e.name === 'AbortError' ? 'timed out' : (e && e.message)}`; console.error('[script-writer]', m); errors.push(m); }
  finally { clearTimeout(timer); }
  }
  return { failed: true, errors };
}

// Swap the sheet-built script into the playbook result (before every guard and check runs on it).
// Patch BD — the close always runs: the creator's viewer line (with its own tag, e.g. "Keep showing up.")
// first, then the "Next up" tease last (the sign-off is added after it).
function orderCTA(text) {
  const parts = (String(text || '').match(/[^.!?…]+(?:[.!?…]+|$)/g) || []).map(x => x.trim()).filter(Boolean);
  if (parts.length < 2) return String(text || '').trim();
  const next = parts.filter(x => /^next up\b/i.test(x));
  let rest = parts.filter(x => !/^next up\b/i.test(x));
  const isYou = x => /\b(you|your|you're|you've)\b/i.test(x);
  const vi = rest.findIndex(isYou);
  if (vi > 0) {
    let ve = vi; while (ve + 1 < rest.length && isYou(rest[ve + 1])) ve++;   // the viewer line can span a ".." pause
    const before = rest.slice(0, vi), tags = before.filter(x => x.split(/\s+/).length <= 5), keep = before.filter(x => x.split(/\s+/).length > 5);
    rest = keep.concat(rest.slice(vi, ve + 1), tags, rest.slice(ve + 1));
  }
  return rest.concat(next).join(' ').replace(/\s{2,}/g, ' ').trim();
}

function applySheetScript(parsed, sc) {
  if (!parsed || !sc || sc.failed || !sc.beats) return false;
  if (sc.beats.cta) sc.beats.cta = orderCTA(sc.beats.cta);
  const b = sc.beats, order = [['Opening', 'opening'], ['Setup', 'setup'], ['Risk', 'risk'], ['Turn', 'turn'], ['Payoff', 'payoff'], ['CTA', 'cta']];
  if (order.some(([, k]) => !String(b[k] || '').trim())) return false;
  parsed.hook = String(sc.hook).trim();
  parsed.full_script = order.map(([L, k]) => `[BEAT: ${L}]\n${String(b[k]).trim()}`).join('\n');
  parsed.narration_script = null;
  const c = sc.cards || {};
  parsed.story_architecture = { opening: parsed.hook, setup: c.setup || '', risk: c.risk || '', turn: c.turn || '', payoff: c.payoff || '', cta: c.cta || '' };
  if (Array.isArray(sc.shots) && sc.shots.length) parsed.b_roll = sc.shots.slice(0, 5);
  if (sc.pacing_note) parsed.pacing_note = sc.pacing_note;
  // The formula map comes from the sheet: each step's source is the creator's own quote.
  const s = sc.sheet || {}, q = t => (t ? 'Your words: "' + t + '"' : '');
  parsed.formula_map = [
    { step: 'Anchor', line: s.anchor ? parsed.hook : 'missing', from: q(s.anchor) },
    { step: 'Underdog', line: s.underdog || 'missing', from: q(s.underdog) },
    { step: 'Stakes', line: s.stakes || 'missing', from: q(s.stakes) },
    { step: 'Struggle', line: s.struggle || 'missing', from: q(s.struggle) },
    { step: 'Payoff', line: (s.proof && s.proof[0]) || 'missing', from: s.proof && s.proof.length ? 'Your words: ' + s.proof.map(x => '"' + x + '"').join(', ') : '' },
    { step: 'Viewer turn', line: s.viewer || 'missing', from: q(s.viewer) },
    { step: 'Series thread', line: s.next_up || 'missing', from: q(s.next_up) }
  ];
  parsed.story_sheet = s;
  // Patch BC — the hook pattern SAM chose, and two alternates from other patterns.
  const P = PATTERN_BY_ID[String(sc.pattern || '').trim()];
  if (P) parsed.hook_pattern = { id: P.id, name: P.name, why: String(sc.pattern_why || '').trim() || P.why, general: P.why };
  parsed.alt_hooks = (Array.isArray(sc.alt_hooks) ? sc.alt_hooks : [])
    .map(a => ({ pattern: (PATTERN_BY_ID[String(a && a.pattern || '').trim()] || {}).name || '', hook: String(a && a.hook || '').trim() }))
    .filter(a => a.pattern && a.hook && a.hook.length < 200 && norm(a.hook) !== norm(parsed.hook)).slice(0, 2);
  parsed.script_engine = 'sheet-v1 · ' + (sc.model || '');
  return true;
}

module.exports = { orderCTA, writeFormulaScript, applySheetScript, dayNumber, quoteIsReal, SCRIPT_MODEL };
