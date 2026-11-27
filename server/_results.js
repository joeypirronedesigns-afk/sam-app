// Patch BE — "How did it do?": SAM keeps every script she writes (beats, timings, hook pattern, formula map),
// reads the creator's real performance screenshots, ties the numbers to the script, and keeps LESSONS that
// her script writer reads on the next story. One post = "watch"; repeated on 2+ posts = "rule".
const MAX_OUTPUTS = 30, MAX_DEBRIEFS = 40, MAX_LESSONS = 40;
async function kv() { try { return require('@vercel/kv').kv; } catch (_) { return null; } }
const key = (kind, email) => kind + ':' + String(email || '').trim().toLowerCase();
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
async function getList(kind, email) {
  const k = await kv(); if (!k || !email) return [];
  let v = await k.get(key(kind, email)).catch(() => null);
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) { v = null; } }
  return Array.isArray(v) ? v : [];
}
async function setList(kind, email, list, max) {
  const k = await kv(); if (!k || !email) return false;
  await k.set(key(kind, email), JSON.stringify(list.slice(-max)));
  return true;
}

// Save a finished Story Engine output (compact). Returns its id.
async function saveOutput(email, parsed, moment) {
  if (!email || !parsed || typeof parsed !== 'object' || !parsed.full_script) return null;
  const id = newId();
  const rec = {
    id, at: new Date().toISOString(),
    hook: String(parsed.hook || '').slice(0, 300),
    pattern: parsed.hook_pattern ? parsed.hook_pattern.name : '',
    beats: (Array.isArray(parsed.script_beats) ? parsed.script_beats : []).map(b => ({ label: b.label, timing: b.timing, content: String(b.content || '').slice(0, 700) })),
    formula: (Array.isArray(parsed.formula_map) ? parsed.formula_map : []).map(m => ({ step: m.step, status: m.status, line: String(m.line || '').slice(0, 200) })),
    alt_hooks: Array.isArray(parsed.alt_hooks) ? parsed.alt_hooks.slice(0, 2) : [],
    captions: (Array.isArray(parsed.platform_strategies) ? parsed.platform_strategies : []).map(p => ({ platform: p.platform, caption: String(p.caption || '').slice(0, 300) })),
    story: String(moment || '').slice(0, 600)
  };
  const list = await getList('outputs', email); list.push(rec);
  await setList('outputs', email, list, MAX_OUTPUTS);
  return id;
}

// Lessons for the script writer (rules first, then things to watch).
function lessonsPrompt(lessons) {
  const live = (lessons || []).filter(l => l && l.text);
  if (!live.length) return '';
  const rules = live.filter(l => l.status === 'rule'), watch = live.filter(l => l.status !== 'rule');
  return `\nWHAT THIS CREATOR'S REAL AUDIENCE HAS TAUGHT SAM (from their posted results — follow the rules, lean toward the watch items):\n` +
    rules.map(l => `- RULE (${l.count} posts): ${l.text}`).join('\n') + (rules.length && watch.length ? '\n' : '') +
    watch.map(l => `- WATCH (${l.count} post${l.count > 1 ? 's' : ''}): ${l.text}`).join('\n') + '\n';
}

const RESULT_MODELS = [process.env.SAM_RESULTS_MODEL || 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-sonnet-4-6'].filter((m, i, a) => a.indexOf(m) === i);

function looseJSON(raw) {
  let t = String(raw || '').replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('no JSON in reply');
  t = t.slice(a, b + 1);
  try { return JSON.parse(t); } catch (_) { return JSON.parse(t.replace(/,\s*([}\]])/g, '$1')); }
}

// Read the screenshots and diagnose. images: [{ media_type, data(base64) }]
async function debrief({ apiKey, output, images, lessons, history, note, todayLine }) {
  const beats = (output && output.beats || []).map(b => `[${b.label} ${b.timing}] ${b.content}`).join('\n') || '(script not saved — diagnose from the numbers only)';
  const past = (history || []).slice(-8).map(h => `- ${String(h.at).slice(0, 10)} "${String(h.hook || '').slice(0, 70)}" → ${h.headline || ''} ${h.metrics ? JSON.stringify(h.metrics) : ''}`).join('\n');
  const existing = (lessons || []).map(l => `${l.id}: ${l.text} (${l.status}, ${l.count} post${l.count > 1 ? 's' : ''})`).join('\n') || '(none yet)';
  const system = `You are SAM, a short-form video coach. A creator posted a video SAM scripted and sent screenshots of its real performance (Facebook / TikTok / YouTube / Instagram analytics).${todayLine || ''}

STEP 1 — READ the screenshots. Copy only numbers that are actually visible; never estimate or invent one. If a number isn't shown, use null. Retention: read the curve at the points you can see (seconds → % still watching) and the biggest drop.
STEP 2 — TIE the numbers to the script. The script's beats and their timings are below. Say which beat was playing at each big drop or hold (e.g. "lost 40% by 0:06 — during the Opening, before 'Let me explain' finished").
STEP 3 — VERDICT in plain words: did it work, and WHY — compared with this creator's own earlier results when given (not with other creators). Strong videos get the same treatment: what made it work.
STEP 4 — LESSONS for the next video: short, specific, actionable ("Keep the Opening under 5 seconds — this audience leaves at 0:06"). Reinforce an existing lesson (by id) when this result supports it instead of writing a duplicate. One post is one data point — say so; never overstate.
STEP 5 — REPOST PLAN (for creators who re-edit): a new first line / first 3 seconds, what to trim, and a new caption — built only from the script's own material.

THE SCRIPT (hook pattern: ${output && output.pattern || 'unknown'}):
Hook: ${output && output.hook || '(unknown)'}
${beats}
${output && output.alt_hooks && output.alt_hooks.length ? 'Alternate hooks SAM wrote: ' + output.alt_hooks.map(a => a.pattern + ': ' + a.hook).join(' | ') : ''}

THIS CREATOR'S EARLIER RESULTS:
${past || '(none yet — this is the first results check)'}

EXISTING LESSONS:
${existing}
${note ? '\nTHE CREATOR SAYS: ' + note : ''}

Return ONLY JSON:
{"platform":"facebook|tiktok|youtube|instagram|unknown",
"read_ok":true,
"metrics":{"views":null,"views_3s":null,"views_1min":null,"avg_watch_sec":null,"length_sec":null,"reactions":null,"comments":null,"shares":null,"follows":null,"reach":null},
"retention":[{"t_sec":0,"pct":100}],
"biggest_drop":{"t_sec":null,"pct_lost":null,"beat":"which beat was playing"},
"verdict":"strong|solid|weak|unclear",
"headline":"one plain sentence a creator understands",
"why":["2–4 plain reasons, each tied to a beat, a line or a number"],
"beat_findings":[{"beat":"Opening|Setup|Risk|Turn|Payoff|Your Call","finding":"what the numbers say about it"}],
"reinforce":["existing lesson ids this result supports"],
"new_lessons":[{"text":"short actionable lesson","type":"keep|fix"}],
"repost":{"first_line":"new opening line","first_3s":"what to show in the first 3 seconds","trim":"what to cut","caption":"new caption"}}
If the screenshots can't be read, set "read_ok": false and explain in "headline".`;
  const content = images.slice(0, 3).map(im => ({ type: 'image', source: { type: 'base64', media_type: im.media_type || 'image/jpeg', data: im.data } }));
  content.push({ type: 'text', text: 'Here are the results screenshots for this video. Read them and debrief.' });
  const errors = [];
  for (const model of RESULT_MODELS) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 2500, system, messages: [{ role: 'user', content }] })
      });
      if (!r.ok) { errors.push(`${model}: API ${r.status}`); continue; }
      const d = await r.json();
      const j = looseJSON((d.content || []).map(c => c.text || '').join(''));
      j.model = model; return j;
    } catch (e) { errors.push(`${model}: ${e.message}`); }
  }
  return { read_ok: false, headline: 'SAM could not read these results right now. Try again in a minute.', errors };
}

// Apply a debrief's lessons: reinforce existing ones (count+1, rule at 2), add new ones as "watch".
async function applyLessons(email, outputId, result) {
  let lessons = await getList('lessons', email);
  const changed = { reinforced: [], added: [] };
  const ids = new Set((result.reinforce || []).map(String));
  lessons = lessons.map(l => {
    if (!ids.has(l.id)) return l;
    const count = (l.count || 1) + 1;
    changed.reinforced.push(l.text);
    return { ...l, count, status: count >= 2 ? 'rule' : 'watch', evidence: [...(l.evidence || []), outputId].slice(-10) };
  });
  const norm = t => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  for (const nl of (Array.isArray(result.new_lessons) ? result.new_lessons : []).slice(0, 4)) {
    const text = String(nl && nl.text || '').trim().slice(0, 220);
    if (!text || lessons.some(l => norm(l.text) === norm(text))) continue;
    lessons.push({ id: newId(), text, type: nl.type === 'keep' ? 'keep' : 'fix', count: 1, status: 'watch', evidence: [outputId], at: new Date().toISOString() });
    changed.added.push(text);
  }
  await setList('lessons', email, lessons, MAX_LESSONS);
  return { lessons, changed };
}

module.exports = { getList, setList, saveOutput, lessonsPrompt, debrief, applyLessons, MAX_DEBRIEFS };
