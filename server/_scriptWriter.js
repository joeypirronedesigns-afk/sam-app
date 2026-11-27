// Patch AY — SAM's script writer. One focused call on the strongest model, separate from the big playbook
// call. Step A: fill a STORY SHEET with the creator's exact words for each slot of the retention formula.
// Step B: write each beat ONLY from its slot. Code then checks every sheet quote against what the creator
// actually wrote; a quote that isn't there is treated as missing (never as fact).
const SCRIPT_MODEL = process.env.SAM_SCRIPT_MODEL || 'claude-opus-5-5';

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
- RISK: the STAKES — the deadline, the promise, or the cost. (Not the underdog. Not backstory.)
- TURN: the honest STRUGGLE — what was harder than expected or a moment of doubt, in their words. If they gave none, use the plain decision or pivot from their story — never invent doubt or feelings.
- PAYOFF: fast PROOF of what is done or visible TODAY — a quick rhythm of short items from their story — then ONE emotional line built from their own words. Never a future scene (no "Christmas Day… their faces"), never something that hasn't happened.
- CTA: the VIEWER TURN — one line that makes it about the person watching, from the creator's own words when they wrote one. Then, if the creator said what's next, "Next up: …". Do NOT write the creator's sign-off; it is added after.

STEP A — fill the STORY SHEET. Every quote must be copied WORD FOR WORD from STORY, ANSWERS or BACKGROUND below (you may trim, never reword). If a slot has nothing, use "".
STEP B — write each beat ONLY from its slot (plus light connective words). You may tighten rhythm and fix grammar. You may NOT add facts, numbers, people, feelings, quotes, promises or events that aren't in the sheet.
${dayN ? `SERIES: this is Day ${dayN} of ${seriesName || 'the creator\'s series'}. If the story does not already state its own day count or timeframe, the Opening may start "Day ${dayN}." Never use a day count that conflicts with the creator's.` : ''}
VOICE: write as the creator, in their rhythm.${voiceProfile ? ` Their Voice DNA:\n${String(voiceProfile).slice(0, 1500)}` : ''}
${examples.length ? `\nTHE CREATOR'S BEST-PERFORMING SCRIPTS — study HOW they build a story (rhythm, length, how they open, how they turn to the viewer). Never copy their facts into this script:\n${examples.map((e, i) => `--- Example ${i + 1} ---\n${e.slice(0, 2500)}`).join('\n')}\n` : ''}
${notebook ? `BACKGROUND ABOUT THE CREATOR (context only — use a fact in the script only if the story itself mentions it, except the underdog background):\n${notebook}\n` : ''}
Return ONLY JSON:
{"sheet":{"anchor":"quote with the number/timeframe","person":"who it's for, quoted","loop":"their own loop phrase or \\"\\"","underdog":"quote","stakes":"quote","struggle":"quote or \\"\\"","proof":["short quote", "..."],"viewer":"their line to the viewer or \\"\\"","next_up":"quote or \\"\\""},
"hook":"the Opening's first line — number/timeframe + who it's for, under 18 words",
"beats":{"opening":"...","setup":"...","risk":"...","turn":"...","payoff":"...","cta":"..."},
"cards":{"setup":"≤12 words","risk":"≤12 words","turn":"≤12 words","payoff":"≤18 words","cta":"≤14 words"},
"shots":["3–5 shots to film, only of things in the story"],
"pacing_note":"one delivery tip"}`;
  const user = `STORY AND ANSWERS (the creator's words):\n${moment}\n\n${creatorContext ? `CREATOR CONTEXT / BACKGROUND:\n${creatorContext}` : ''}`;
  const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), 95000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ac.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: SCRIPT_MODEL, max_tokens: 2000, system, messages: [{ role: 'user', content: user }] })
    });
    if (!r.ok) { console.error('[script-writer] API', r.status, (await r.text().catch(() => '')).slice(0, 200)); return null; }
    const d = await r.json();
    const raw = (d && d.content && d.content.map(c => c.text || '').join('')) || '';
    const m = raw.match(/\{[\s\S]*\}/); if (!m) return null;
    const j = JSON.parse(m[0]);
    if (!j || !j.beats || !j.hook) return null;
    // Validate the sheet against the creator's words.
    const source = [moment, creatorContext, notebook].filter(Boolean).join('\n');
    const sheet = j.sheet || {}, checked = {};
    for (const k of ['anchor', 'person', 'loop', 'underdog', 'stakes', 'struggle', 'viewer', 'next_up']) {
      const q = String(sheet[k] || '').trim();
      checked[k] = q && quoteIsReal(q, source) ? q : '';
    }
    checked.proof = (Array.isArray(sheet.proof) ? sheet.proof : []).map(x => String(x || '').trim()).filter(q => q && quoteIsReal(q, source)).slice(0, 6);
    return { ...j, sheet: checked, model: SCRIPT_MODEL };
  } catch (e) { console.error('[script-writer]', e && e.message); return null; }
  finally { clearTimeout(timer); }
}

// Swap the sheet-built script into the playbook result (before every guard and check runs on it).
function applySheetScript(parsed, sc) {
  if (!parsed || !sc || !sc.beats) return false;
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
  parsed.script_engine = 'sheet-v1 · ' + (sc.model || '');
  return true;
}

module.exports = { writeFormulaScript, applySheetScript, dayNumber, quoteIsReal, SCRIPT_MODEL };
