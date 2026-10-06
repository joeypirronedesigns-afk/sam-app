#!/usr/bin/env node
// scripts/story-eval.js — Patch X.4
// Runs the fixed story test set (tests/story-eval/cases.json) through the live Story Engine
// and scores each playbook with automatic checks. Run it before and after every Story Engine
// change so "better" is measured, not guessed.
//
// Usage (from the sam-app folder):
//   SAM_EVAL_EMAIL=you@example.com node scripts/story-eval.js
//   SAM_EVAL_EMAIL=... node scripts/story-eval.js --only barn-door,sourdough
//   SAM_EVAL_EMAIL=... node scripts/story-eval.js --base https://<preview>.vercel.app
//
// Needs Node 18+. Each case takes ~30–60s; the full set runs one case at a time (~8 min).
// Results are saved to tests/story-eval/results/<timestamp>.json.

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const argVal = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const BASE = (argVal('--base') || 'https://samforcreators.com').replace(/\/$/, '');
const ONLY = (argVal('--only') || '').split(',').map(s => s.trim()).filter(Boolean);
const EMAIL = process.env.SAM_EVAL_EMAIL || '';
if (!EMAIL) { console.error('Set SAM_EVAL_EMAIL to an account with access (e.g. your founder email).'); process.exit(1); }

const root = path.join(__dirname, '..');
// Patch Z.7 — --cases <file> picks a test set (default cases.json); --show prints each playbook
// (type, moment, hook, beats, script) so the craft can be read and judged, not just the rules.
const CASES_FILE = argVal('--cases') || 'tests/story-eval/cases.json';
const SHOW = args.includes('--show');
const cases = JSON.parse(fs.readFileSync(path.isAbsolute(CASES_FILE) ? CASES_FILE : path.join(root, CASES_FILE), 'utf8'))
  .filter(c => !ONLY.length || ONLY.includes(c.id));

// ── helpers ──────────────────────────────────────────────────────────────────
const NUM_WORDS = { one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,
  thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,
  forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,hundred:100,thousand:1000 };
// Patch Y.3 — ordinals, compound numbers ("four hundred" = 400), and "one" ignored
// (it's mostly a pronoun: "the one thing"). Returns Map(number -> first context snippet).
// 'first'/'second' are skipped: usually adverbs ("I blamed the seeds first", "wait a second").
const ORDINALS = { third:3, fourth:4, fifth:5, sixth:6, seventh:7, eighth:8, ninth:9, tenth:10 };
function numbersIn(text, { allowCountingTwo = false } = {}) {
  const t = String(text || '').toLowerCase().replace(/(\d),(\d)/g, '$1$2');
  const out = new Map();
  const add = (n, idx) => { const k = String(n); if (!out.has(k)) out.set(k, t.slice(Math.max(0, idx - 30), idx + 30).replace(/\s+/g, ' ')); };
  let m;
  const dre = /(\d+(?:\.\d+)?)\s*(k|m|grand)?\b/g;
  while ((m = dre.exec(t))) { const n = Number(m[1]); add(n, m.index); if (m[2] === 'k' || m[2] === 'grand') add(n * 1000, m.index); if (m[2] === 'm') add(n * 1000000, m.index); }
  const toks = [...t.matchAll(/\b[a-z]+\b/g)];
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i][0];
    if (ORDINALS[w] !== undefined) { add(ORDINALS[w], toks[i].index); continue; }
    if (w === 'one' || NUM_WORDS[w] === undefined) continue;
    // "two" as a counting word ("wrote two things") isn't a claim — same rule as the server guard.
    // Patch Z.9 — "two things" is a count, "two weeks" is a claim: durations never get the exception.
    if (allowCountingTwo && w === 'two' && !(toks[i + 1] && /^(hundred|thousand|seconds?|minutes?|hours?|days?|nights?|weeks?|months?|years?|summers?|winters?|seasons?|times)$/.test(toks[i + 1][0]))) continue;
    let val = NUM_WORDS[w], j = i;
    // tens + units ("forty five"), then multipliers ("four hundred", "two thousand")
    if (val >= 20 && val < 100 && toks[j + 1] && NUM_WORDS[toks[j + 1][0]] < 10) { val += NUM_WORDS[toks[j + 1][0]]; j++; }
    while (toks[j + 1] && (toks[j + 1][0] === 'hundred' || toks[j + 1][0] === 'thousand' || toks[j + 1][0] === 'grand')) { val *= (toks[j + 1][0] === 'grand' ? 1000 : NUM_WORDS[toks[j + 1][0]]); j++; }
    if ((w === 'hundred' || w === 'thousand') && i > 0 && NUM_WORDS[toks[i - 1][0]] !== undefined) continue;
    add(val, toks[i].index); i = j;
  }
  return out;
}
const URL_TLDS = 'com|co|io|net|org|app|ai|tv|me|us|shop|store|studio|xyz|ca|uk';
function domainsTyped(text) {
  const out = new Set();
  const re = new RegExp(`((?:[a-z0-9-]+\\s+){0,3}[a-z0-9-]+)\\s*\\.\\s*(${URL_TLDS})\\b`, 'gi');
  let m;
  while ((m = re.exec(String(text || '')))) {
    const words = m[1].toLowerCase().split(/\s+/).filter(Boolean);
    for (let k = 1; k <= words.length; k++) out.add(words.slice(-k).join('') + '.' + m[2].toLowerCase());
  }
  return out;
}
function domainsOut(text) {
  return new Set((String(text || '').toLowerCase().match(new RegExp(`\\b[a-z0-9-]{3,}\\.(?:${URL_TLDS})\\b`, 'g')) || []));
}
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const words = s => String(s || '').split(/\s+/).filter(Boolean).length;
const BANNED = ['journey', 'resonate', 'game-changer', 'game changer', 'delve', 'unlock', 'elevate', 'powerful story', 'authentic self'];

async function runCase(c) {
  const payload = {
    mode: 'playbook', userId: EMAIL, email: EMAIL, userEmail: EMAIL, tier: 'studio',
    moment: c.input, creatorContext: c.creator,
    platforms: ['TikTok', 'Instagram Reels', 'YouTube Shorts'], contentType: 'short-form video',
    tone: 'Authentic/Natural', emojiPreference: 'few', outputLanguage: '',
    wizardContext: `CREATOR TYPE: ${c.creator}\nDELIVERY STYLE: on camera\nSPEAKING PACE: natural\nCONTENT TYPE: moment\nSELECTED PLATFORMS: TikTok, Instagram Reels, YouTube Shorts\nFORMAT: short-form video\nLANGUAGE: English`,
    delivery: 'camera', pace: 'natural', storyType: 'moment'
  };
  const t0 = Date.now();
  const res = await fetch(BASE + '/api/sam', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok || !res.body) throw new Error('HTTP ' + res.status + ' ' + (await res.text().catch(() => '')).slice(0, 200));
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', result = null, err = null;
  const handle = (line) => {
    if (!line.startsWith('data: ')) return;
    try { const e = JSON.parse(line.slice(6)); if (e.done && e.result) result = e.result; if (e.error) err = e.error; } catch (_) {}
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop(); lines.forEach(handle);
  }
  buf += dec.decode(); if (buf) handle(buf);
  if (!result) throw new Error(err || 'no result');
  return { result, secs: Math.round((Date.now() - t0) / 1000) };
}

function score(c, r) {
  const arch = r.story_architecture || {};
  const beats = Array.isArray(r.script_beats) ? r.script_beats : [];
  const beat = k => (beats.find(b => b.key === k) || {}).content || '';
  const captions = (r.platform_strategies || []).map(p => (p && p.caption) || '').join('\n');
  const spoken = [r.full_script || r.narration_script || '', captions, Object.values(arch).join('\n'), r.hook || ''].join('\n');
  const inNums = numbersIn(c.input + ' ' + c.creator);
  // Patch Z.6 — 'two' as a counting word is only excused in SAM's output, never in the story itself.
  const outNums = numbersIn(spoken.replace(/\[BEAT:[^\]]*\]/g, ''), { allowCountingTwo: true });
  // Patch Z.10 — same tolerance as the server guard: "250k" / "22 grand" / "22,000" are one number.
  const numOk = n => { const x = Number(n); return [x, x * 1000, x / 1000, x * 1e6, x / 1e6].some(v => inNums.has(String(v))); };
  const badNums = [...outNums.keys()].filter(n => !numOk(n)).map(n => `${n} ("…${outNums.get(n)}…")`);
  const allowed = domainsTyped(c.input + ' ' + c.creator);
  const badDomains = [...domainsOut(spoken)].filter(d => !allowed.has(d));
  const setupText = (arch.setup || '') + ' ' + beat('setup');
  const leaked = (c.reveal || []).filter(w => norm(setupText).includes(norm(w)));
  const tags = (r.platform_strategies || []).map(p => ((p && p.hashtags) || '').split(/\s+/).filter(t => t.startsWith('#')).length);
  const bannedHits = BANNED.filter(b => spoken.toLowerCase().includes(b));
  const hookN = norm(r.hook);
  const checks = {
    hook_is_opening:   (c.thin && r.needs_more) ? true : (!!r.hook && norm(arch.opening) === hookN),
    script_opens_with_hook: (c.thin && r.needs_more) ? true : (!!hookN && norm(beat('opening')).startsWith(hookN.split(' ').slice(0, 6).join(' '))),
    six_beats:         c.thin ? true : ['opening', 'setup', 'risk', 'turn', 'payoff', 'cta'].every(k => beat(k)),
    numbers_traceable: badNums.length === 0,
    urls_traceable:    badDomains.length === 0,
    setup_hides_cause: leaked.length === 0,
    hashtags_max_4:    tags.every(n => n <= 4),
    cta_short:         words(beat('cta')) <= 35,
    no_ai_cliches:     bannedHits.length === 0,
    respects_must_not_say: !(c.must_not_say || []).some(p => spoken.toLowerCase().includes(String(p).toLowerCase())),
    keeps_must_keep:   (c.must_keep || []).every(p => norm(spoken).includes(norm(p))),
    hook_said_once:    !r.hook || (norm(r.full_script || r.narration_script || '').split(norm(r.hook)).length - 1) <= 1,
    moment_found:      c.thin ? true : !!r.five_second_moment && !/^not found/i.test(r.five_second_moment),
    thin_asks_for_more: c.thin ? (!!r.needs_more || (r.gaps || []).length > 0) : (!r.needs_more),
    no_placeholders:   !/\b(not found|tbd|placeholder|needs a real moment|real moment needed|needed before|can be written)\b|\[(insert|add|your)[^\]]*\]/i.test(spoken.replace(/\[BEAT:[^\]]*\]/g, '')),
    type_matches:      c.expect_type === 'any' || String(c.expect_type).split('|').includes(r.story_type)
  };
  const notes = [];
  if (badNums.length) notes.push('numbers not in story: ' + badNums.join('; '));
  if (badDomains.length) notes.push('domains not in story: ' + badDomains.join(', '));
  if (leaked.length) notes.push('setup reveals: ' + leaked.join(', '));
  if (bannedHits.length) notes.push('clichés: ' + bannedHits.join(', '));
  const dropped = (c.must_keep || []).filter(p => !norm(spoken).includes(norm(p)));
  if (dropped.length) notes.push('dropped what it must keep: ' + dropped.join(', '));
  const saidForbidden = (c.must_not_say || []).filter(p => spoken.toLowerCase().includes(String(p).toLowerCase()));
  if (saidForbidden.length) notes.push('said what it must not: ' + saidForbidden.join(', '));
  if (!checks.type_matches) notes.push(`type ${r.story_type} (expected ${c.expect_type})`);
  const removed = (r.fact_check && r.fact_check.removed) || [];
  if (removed.length) notes.push(`fact-check removed ${removed.length}: ` + removed.map(s => '"' + s.slice(0, 60) + '"').join(' | '));
  const passed = Object.values(checks).filter(Boolean).length;
  return { checks, passed, total: Object.keys(checks).length, notes };
}

(async () => {
  console.log(`Story eval — ${cases.length} case(s) against ${BASE}\n`);
  const results = [];
  for (const c of cases) {
    process.stdout.write(`▶ ${c.id.padEnd(14)} `);
    try {
      const { result, secs } = await runCase(c);
      const s = score(c, result);
      results.push({ id: c.id, secs, ...s, hook: result.hook, story_type: result.story_type,
        five_second_moment: result.five_second_moment, gaps: result.gaps || [], output: result });
      console.log(`${s.passed}/${s.total}  (${secs}s)`);
      const failed = Object.entries(s.checks).filter(([, v]) => !v).map(([k]) => k);
      if (failed.length) console.log('   ✗ ' + failed.join(', '));
      s.notes.forEach(n => console.log('   · ' + n));
      if (SHOW) {
        const a = result.story_architecture || {};
        const line = '   ' + '─'.repeat(60);
        console.log(line);
        if (c.craft_note) console.log('   TESTING: ' + c.craft_note);
        console.log(`   TYPE: ${result.story_type || '—'}   ·   MOMENT: ${result.five_second_moment || '—'}`);
        if (result.needs_more) console.log('   NEEDS MORE: ' + (result.gaps || []).join(' | '));
        console.log('   HOOK: ' + (result.hook || '—'));
        ['setup', 'risk', 'turn', 'payoff', 'cta'].forEach(k => console.log(`   ${k.toUpperCase().padEnd(7)}${a[k] || '—'}`));
        console.log('   SCRIPT:');
        (result.script_beats || []).forEach(b => console.log(`     [${b.label} ${b.timing}] ${String(b.content).replace(/\s+/g, ' ')}`));
        const fc = result.fact_check || {};
        if ((fc.removed || []).length) console.log('   REMOVED: ' + fc.removed.join(' | '));
        if ((fc.rewritten || []).length) console.log('   REWRITTEN: ' + fc.rewritten.join(' | '));
        console.log(line + '\n');
      }
    } catch (e) {
      console.log('ERROR ' + e.message);
      results.push({ id: c.id, error: e.message });
    }
  }
  const ok = results.filter(r => !r.error);
  const passed = ok.reduce((a, r) => a + r.passed, 0), total = ok.reduce((a, r) => a + r.total, 0);
  console.log(`\nOverall: ${passed}/${total} checks passed (${total ? Math.round(100 * passed / total) : 0}%) across ${ok.length} case(s)` +
    (results.length - ok.length ? `, ${results.length - ok.length} error(s)` : ''));
  const dir = path.join(root, 'tests/story-eval/results');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, new Date().toISOString().replace(/[:.]/g, '-') + '.json');
  fs.writeFileSync(file, JSON.stringify({ base: BASE, at: new Date().toISOString(), passed, total, results }, null, 2));
  console.log('Saved ' + path.relative(root, file));
})();
