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

// Patch BK — the formula's hard rules, checked in code on the writer's draft. Each problem is one plain sentence
// the writer can act on. Used for one automatic fix pass, and shown to the creator in the formula map.
const UNDONE_RE = /\b(still needs?|still (has|have) to|not (started|done|finished|there)|hasn'?t (started|been)|haven'?t (started|done|finished)|isn'?t (done|finished)|yet to)\b|\bnot\b[^.!?…]{0,25}\byet\b/i;
function _sents(t) { return (String(t || '').match(/[^.!?…]+(?:[.!?…]+|$)/g) || []).map(x => x.trim()).filter(Boolean); }
// the opening stretch of a beat: sentences that start within its first 40% of words (at least the first 15 words)
function earlySents(sents) {
  const total = sents.join(' ').split(/\s+/).length, lim = Math.max(15, Math.round(total * 0.4)); let w = 0; const out = [];
  for (const x of sents) { if (w >= lim) break; out.push(x); w += x.split(/\s+/).length; }
  return out;
}
function selfCheck(j, moment) {
  const out = [], b = (j && j.beats) || {}, story = norm(moment);
  const pay = _sents(String(b.payoff || '').replace(/\(show:[^)]*\)/gi, ''));
  const early = earlySents(pay), undone = early.find(x => UNDONE_RE.test(x));
  if (undone) out.push('The Payoff opens on what is NOT done yet ("' + undone + '"). Open the Payoff on what the viewer can see or feel right now; move the unfinished part into the Turn or drop it ("Next up" covers it).');
  const fut = String(b.payoff || '').match(/[^.!?…]*\b(will|i'll|we'll|going to|gonna|christmas day|when (they|she|he) (see|walk))\b[^.!?…]*[.!?…]?/i);
  if (fut && !story.includes(norm(fut[0]))) out.push('The Payoff describes a future scene ("' + fut[0].trim() + '"). The Payoff is proof of what is done today.');
  const cd = String(moment || '').match(/\b(\d+)\s+(days?|weeks?|hours?)\s+(left|to go|away|until|till|before)\b/i);
  const spoken = ['opening', 'setup', 'risk', 'turn', 'payoff', 'cta'].map(k => b[k] || '').join(' ');
  if (cd && !new RegExp('\\b' + cd[1] + '\\b').test(spoken + ' ' + (j.hook || ''))) out.push('The countdown "' + cd[0] + '" is never said. Say the number in the Risk beat.');
  const hw = new Set(norm(j.hook).split(' ').filter(w => w.length > 3)), rw = norm(b.risk).split(' ').filter(w => w.length > 3);
  if (hw.size >= 4 && rw.length && rw.filter(w => hw.has(w)).length / hw.size >= 0.6) out.push('The Risk beat repeats the hook. Say each thing once.');
  const unclear = spoken.match(/\b(before|when|after|until|till) we (leave|go|move|head out)\b(?!\s+(to|back|for|home|south|north))[^.!?…]*/i);
  if (unclear) out.push('"' + unclear[0].trim() + '" — a new viewer won\'t know where or why. Add a few plain words of context from the story or background, or cut that clause.');
  // Patch BL — say each thing once: a sentence that mostly repeats one from an earlier beat
  const KEYS = ['setup', 'risk', 'turn', 'payoff', 'cta'], cw = x => norm(x).split(' ').filter(w => w.length > 3);
  const seen = _sents(b.opening).map(cw);
  for (const k of KEYS) {
    const ss = _sents(String(b[k] || '').replace(/\(show:[^)]*\)/gi, ''));
    const rep = ss.find(x => { const w = cw(x); return w.length >= 3 && seen.some(p => p.length >= 3 && w.filter(t => p.includes(t)).length / w.length >= 0.7); });
    if (rep && !/^next up\b/i.test(rep)) { out.push('"' + rep + '" repeats an earlier beat. Say each thing once — replace it with something new from the story, or cut it.'); break; }
    ss.forEach(x => seen.push(cw(x)));
  }
  if (!/\b(you|your|you're|you've|you'll)\b/i.test(String(b.cta || ''))) out.push('The CTA never speaks to the viewer. Use the creator\'s own line to the viewer.');
  return out;
}

async function writeFormulaScript(o) {
  const { apiKey, moment, creatorContext, notebook, voiceProfile, seriesName, dayN, bestScripts, todayLine, lessons, format } = o;
  // Patch BG — long-form YouTube (8–12 min) gets a long script, not a short one.
  const LONG = /long/i.test(String(format || ''));
  if (!apiKey || !moment || String(moment).trim().length < 40) return null;
  const examples = (bestScripts || []).filter(Boolean);
  const system = `You are SAM's script writer for ${LONG ? 'LONG-FORM YouTube video (8–12 minutes)' : 'short-form video'}. You write ONE script that follows a proven retention formula, using ONLY what the creator said.${todayLine || ''}
${LONG ? `
LONG-FORM (Patch BG): target 1,200–1,700 spoken words (about 8–12 minutes at a natural pace). Same six beats, but each beat is a full section:
- OPENING (first 30–45s): the anchor + open loop, then a quick preview of what this video covers.
- SETUP: the series, the people, the underdog — use BACKGROUND facts the creator gave about themselves (they are the creator's own words).
- RISK: the stakes and everything still left to do, in detail.
- TURN: walk through the work step by step as the creator described it — what they did, what went wrong, how they handled it. Mark on-screen moments with (show: …).
- PAYOFF: a slower reveal of what is done, then the meaning, in their words.
- CTA: the viewer turn, "Next up", and a subscribe line suited to YouTube.
Add 3–6 chapter titles with rough timestamps in "chapters". If the creator's material can honestly fill only part of that length, write what is TRUE (shorter is fine) and list exactly what you need in "need_more" (e.g. "Walk me through the microcrete coats step by step") — never pad with invented events or feelings.` : ''}

THE FORMULA (six beats):
- OPENING (0–5s): the ANCHOR — a number or timeframe AND who it's for, in one line — then an OPEN LOOP (the creator's own phrase if they wrote one, e.g. "Let me explain."; otherwise "Let me explain.").
- SETUP: who the creator is and why this is hard for THEM (the UNDERDOG) — from their story or BACKGROUND only.
- RISK: the STAKES — the deadline, the promise, or the cost. (Not the underdog. Not backstory.) If the creator gave a countdown or number ("29 days left"), SAY THE NUMBER here — it is the urgency.
- TURN: the honest STRUGGLE — what was harder than expected or a moment of doubt, in their words. If they gave none, use the plain decision or pivot from their story — never invent doubt or feelings.
- PAYOFF: fast PROOF of what is done or visible TODAY — a quick rhythm of short items from their story — then ONE emotional line built from their own words. Never a future scene (no "Christmas Day… their faces"), never something that hasn't happened.
  Patch BK: the Payoff OPENS on the reveal — what the viewer can see or feel right now. What is NOT done yet ("still needs a final coat", "not started yet") never opens the Payoff: put it in the Turn as part of the struggle, or leave it to the "Next up" tease.
- CTA: the VIEWER TURN — one line that makes it about the person watching, from the creator's own words when they wrote one, kept whole and in their order (e.g. "…you can do yours. Keep showing up."). Then, if the creator said what's next, ONE short tease of 15 words max — "Next up: …" naming the 2–3 most visual or dramatic items, never the whole to-do list. Do NOT write the creator's sign-off; it is added after.

CLEAR TO A STRANGER (Patch BK): a new viewer knows nothing about the creator. Any line that leans on something unexplained ("before we leave", "Jason", "the old one") either gets a few plain words of context from STORY or BACKGROUND ("before we move back to Florida", "Jason, our plumber", "my wife Amanda and our dog Penny") or the unclear clause is cut. Never invent the context.

SAY EACH THING ONCE (Patch BB): never repeat a clause from an earlier beat. The hook's promise line is not said again in the Risk beat; the big number (e.g. "450 days") appears at most twice in the whole script. Your best-performing scripts said each thing once and kept moving.

HOOK PATTERNS (Patch BC) — proven structures. Pick the ONE that best fits THIS story's real material and shape the hook (and the arc around it) with it. The anchor still has to land in the Opening: the number/timeframe and who it's for appear in the hook or the line right after it.
${patternPrompt()}

STEP A — fill the STORY SHEET. Every quote must be copied WORD FOR WORD from STORY, ANSWERS or BACKGROUND below (you may trim, never reword). If a slot has nothing, use "".
STEP B — write each beat ONLY from its slot (plus light connective words). You may tighten rhythm and fix grammar. You may NOT add facts, numbers, people, feelings, quotes, promises or events that aren't in the sheet.
${dayN ? `SERIES: this is Day ${dayN} of ${seriesName || 'the creator\'s series'}. If the story does not already state its own day count or timeframe, the Opening may start "Day ${dayN}." Never use a day count that conflicts with the creator's.` : ''}
VOICE: write as the creator, in their rhythm.${voiceProfile ? ` Their Voice DNA:\n${String(voiceProfile).slice(0, 1500)}` : ''}
${examples.length ? `\nTHE CREATOR'S BEST-PERFORMING SCRIPTS — study HOW they build a story (rhythm, length, how they open, how they turn to the viewer). Never copy their facts into this script:\n${examples.map((e, i) => `--- Example ${i + 1} ---\n${e.slice(0, 3000)}`).join('\n')}\n` : ''}
${lessons || ''}${notebook ? `BACKGROUND ABOUT THE CREATOR (context only — use a fact in the script only if the story itself mentions it, except the underdog background):\n${notebook}\n` : ''}
Return ONLY JSON:
{"sheet":{"anchor":"quote with the number/timeframe","person":"who it's for, quoted","loop":"their own loop phrase or \\"\\"","underdog":"quote","stakes":"quote","struggle":"quote or \\"\\"","proof":["short quote", "..."],"viewer":"their line to the viewer or \\"\\"","next_up":"quote or \\"\\""},
"hook":"the Opening's first line — number/timeframe + who it's for, under 18 words",
"beats":{"opening":"...","setup":"...","risk":"...","turn":"...","payoff":"...","cta":"..."},
"cards":{"setup":"≤12 words","risk":"≤12 words","turn":"≤12 words","payoff":"≤18 words","cta":"≤14 words"},
"shots":["3–5 shots to film, only of things in the story"],
"pattern":"the id of the pattern you used for the hook",
"pattern_why":"one plain sentence to the creator: why this pattern fits THIS story",
"alt_hooks":[{"pattern":"a different pattern id","hook":"an alternate opening line built only from the story"},{"pattern":"another different id","hook":"..."}],
"pacing_note":"one delivery tip"${lessons ? ',\n"lessons_applied":["for each audience lesson you followed: the lesson in 3–6 words → where/how this script follows it"]' : ''}${LONG ? ',\n"chapters":["0:00 Title", "..."],\n"need_more":["what the creator should add for a full 8–12 minute video, or empty"]' : ',\n"need_more":["Patch BL: at most ONE short question to the creator, only if the Payoff or Turn is thin because the story never says how it looks or feels now, or what went wrong (e.g. \"Now that the first coat is on, how does it look and feel to you?\"). Otherwise empty."]'}}`;
  const user = `STORY AND ANSWERS (the creator's words):\n${moment}\n\n${creatorContext ? `CREATOR CONTEXT / BACKGROUND:\n${creatorContext}` : ''}`;
  const errors = [];
  const source = [moment, creatorContext, notebook].filter(Boolean).join('\n');
  const t0 = Date.now();
  async function call(model, messages, ms) {
    const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), ms);
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ac.signal,
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: LONG ? 9000 : 3500, system, messages })
      });
      if (!r.ok) return { err: `${model}: API ${r.status} ${(await r.text().catch(() => '')).slice(0, 160)}` };
      const d = await r.json();
      const raw = (d && d.content && d.content.map(c => c.text || '').join('')) || '';
      let j;
      try { j = parseLooseJSON(raw); } catch (pe) { return { err: `${model}: unreadable reply (${pe.message}; stop=${d && d.stop_reason})` }; }
      if (!j || !j.beats || !j.hook) return { err: `${model}: reply missing beats/hook` };
      return { j, raw };
    } catch (e) { return { err: `${model}: ${e && e.name === 'AbortError' ? 'timed out' : (e && e.message)}` }; }
    finally { clearTimeout(timer); }
  }
  // Validate the sheet against the creator's words.
  const validate = j => {
    const sheet = j.sheet || {}, checked = {};
    for (const k of ['anchor', 'person', 'loop', 'underdog', 'stakes', 'struggle', 'viewer', 'next_up']) {
      const q = String(sheet[k] || '').trim();
      checked[k] = q && quoteIsReal(q, source) ? q : '';
    }
    checked.proof = (Array.isArray(sheet.proof) ? sheet.proof : []).map(x => String(x || '').trim()).filter(q => q && quoteIsReal(q, source)).slice(0, 6);
    return checked;
  };
  for (const model of FALLBACK_MODELS) {
    const first = await call(model, [{ role: 'user', content: user }], LONG ? 200000 : 110000);
    if (first.err) { console.error('[script-writer]', first.err); errors.push(first.err); continue; }
    let j = first.j;
    // Patch BK — SAM checks her own draft against the formula and fixes what fails, once, before you see it.
    const issues = selfCheck(j, moment);
    const self_check = { issues: issues.slice(), fixed: [], remaining: issues.slice() };
    const elapsed = Date.now() - t0, budget = (LONG ? 225000 : 200000) - elapsed;
    if (issues.length && budget > 45000) {
      const fix = await call(model, [
        { role: 'user', content: user },
        { role: 'assistant', content: first.raw },
        { role: 'user', content: `SAM's self-check found these problems in your draft:\n${issues.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\nFix ONLY these. Keep everything else the same (same hook, same sheet, same voice, same rules — only the creator's words, nothing invented). Return the COMPLETE JSON again.` }
      ], Math.min(LONG ? 150000 : 80000, budget - 15000));
      if (fix.j) {
        const left = selfCheck(fix.j, moment);
        if (left.length < issues.length) { j = fix.j; self_check.remaining = left; self_check.fixed = issues.filter(x => !left.includes(x)); }
      } else if (fix.err) console.error('[script-writer] revise', fix.err);
    }
    return { ...j, sheet: validate(j), model, errors, self_check };
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
  // Patch BG — long-form extras
  if (Array.isArray(sc.chapters) && sc.chapters.length) parsed.chapters = sc.chapters.slice(0, 8).map(String);
  if (Array.isArray(sc.need_more) && sc.need_more.length) parsed.gaps = (Array.isArray(parsed.gaps) ? parsed.gaps : []).concat(sc.need_more.slice(0, 3).map(String));
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
  // Patch BK — show the creator what SAM learned from their results and what she fixed on her own draft.
  parsed.lessons_applied = (Array.isArray(sc.lessons_applied) ? sc.lessons_applied : []).map(x => String(x || '').trim()).filter(Boolean).slice(0, 5);
  if (sc.self_check) parsed.self_check = sc.self_check;
  // Patch BC — the hook pattern SAM chose, and two alternates from other patterns.
  const P = PATTERN_BY_ID[String(sc.pattern || '').trim()];
  if (P) parsed.hook_pattern = { id: P.id, name: P.name, why: String(sc.pattern_why || '').trim() || P.why, general: P.why };
  parsed.alt_hooks = (Array.isArray(sc.alt_hooks) ? sc.alt_hooks : [])
    .map(a => ({ pattern: (PATTERN_BY_ID[String(a && a.pattern || '').trim()] || {}).name || '', hook: String(a && a.hook || '').trim() }))
    .filter(a => a.pattern && a.hook && a.hook.length < 200 && norm(a.hook) !== norm(parsed.hook)).slice(0, 2);
  parsed.script_engine = 'sheet-v1 · ' + (sc.model || '');
  return true;
}

module.exports = { selfCheck, earlySents, UNDONE_RE, orderCTA, writeFormulaScript, applySheetScript, dayNumber, quoteIsReal, SCRIPT_MODEL };
