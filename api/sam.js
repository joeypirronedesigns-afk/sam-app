module.exports.config = { api: { bodyParser: { sizeLimit: "10mb" } } };
const { trackUser, trackEvent, saveUserProfile, getUserProfile, updateUserEmail, supabaseQuery } = require('./_supabase');
const { normalizeSamContext, buildBrainPrompt } = require('./_context');
const { checkGate } = require('./_gate');

// v9.118.16 (Patch C) — derive structured script_beats[] from [BEAT: ...] markers
// emitted per v9.118.15 instructions. Additive: full_script stays unchanged,
// script_beats[] is a parallel structured view consumed by both UI and PDF renderers.
function parseScriptBeats(scriptText, pace) {
  if (!scriptText || typeof scriptText !== 'string') return [];

  const BEAT_DEFS = [
    { key: 'opening', label: 'Opening',     timing: '0–3s',     match: /^\s*\[BEAT:\s*Opening\s*\]\s*$/i },
    { key: 'setup',   label: 'Setup',       timing: '3–15s',    match: /^\s*\[BEAT:\s*Setup\s*\]\s*$/i },
    { key: 'risk',    label: 'The Risk',    timing: '15–30s',   match: /^\s*\[BEAT:\s*Risk\s*\]\s*$/i },
    { key: 'turn',    label: 'The Turn',    timing: '30–50s',   match: /^\s*\[BEAT:\s*Turn\s*\]\s*$/i },
    { key: 'payoff',  label: 'The Payoff',  timing: '50–70s',   match: /^\s*\[BEAT:\s*Payoff\s*\]\s*$/i },
    { key: 'cta',     label: 'Your Call',   timing: 'Final 5s', match: /^\s*\[BEAT:\s*CTA\s*\]\s*$/i },
  ];

  const lines = scriptText.split('\n');
  const beats = [];
  let current = null;

  for (const line of lines) {
    const def = BEAT_DEFS.find(d => d.match.test(line));
    if (def) {
      if (current) beats.push(current);
      current = { key: def.key, label: def.label, timing: def.timing, content: '' };
    } else if (current) {
      current.content += (current.content ? '\n' : '') + line;
    }
    // lines before first marker are discarded
  }
  if (current) beats.push(current);

  const out = beats.map(b => ({ ...b, content: b.content.trim() })).filter(b => b.content);

  // Patch W.3 — timings follow the actual script length instead of a fixed 0–70s template.
  // Words-per-minute by pace; delivery notes in (parentheses) are not spoken.
  const wpm = { fast: 170, natural: 150, slow: 125 }[pace] || 150;
  let t = 0;
  for (const b of out) {
    const words = b.content.replace(/\([^)]*\)/g, ' ').split(/\s+/).filter(Boolean).length;
    const secs = Math.max(2, Math.round(words / wpm * 60));
    const start = Math.round(t), end = Math.round(t + secs);
    b.timing = start + '–' + end + 's';
    t += secs;
  }
  return out;
}

// Patch W.2 — URL guard. The model sometimes misspells the creator's own domain in
// ready-to-post captions (e.g. "societyforcreators.com" for "samforcreators.com").
// Allowed domains = anything that appears in what the creator typed (spoken forms like
// "Sam for creators.com" are joined). Output domains that are near-misses of an allowed
// domain are corrected; unrelated domains (tiktok.com, etc.) are left alone.
const URL_TLDS = 'com|co|io|net|org|app|ai|tv|me|us|shop|store|studio|xyz|ca|uk';
function collectAllowedDomains(texts) {
  const allowed = new Set();
  const re = new RegExp(`((?:[a-z0-9-]+\\s+){0,3}[a-z0-9-]+)\\s*\\.\\s*(${URL_TLDS})\\b`, 'gi');
  for (const t of texts) {
    if (!t || typeof t !== 'string') continue;
    let m;
    while ((m = re.exec(t))) {
      const words = m[1].toLowerCase().split(/\s+/).filter(Boolean);
      const tld = m[2].toLowerCase();
      for (let k = 1; k <= words.length; k++) allowed.add(words.slice(-k).join('') + '.' + tld);
    }
  }
  return allowed;
}
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return d[a.length][b.length];
}
function guardUrls(obj, allowed) {
  if (!allowed.size) return { obj, fixes: [] };
  const fixes = [];
  const list = [...allowed].filter(d => d.split('.')[0].length >= 6);
  const re = new RegExp(`\\b([a-z0-9-]{4,})\\.(${URL_TLDS})\\b`, 'gi');
  const fix = (str) => str.replace(re, (whole, name, tld) => {
    const dom = (name + '.' + tld).toLowerCase();
    if (allowed.has(dom)) return whole;
    let best = null, bestScore = 1;
    for (const a of list) {
      if (a.split('.').pop() !== tld.toLowerCase()) continue;
      const score = editDistance(dom, a) / Math.max(dom.length, a.length);
      if (score < bestScore) { bestScore = score; best = a; }
    }
    if (best && bestScore <= 0.4) { fixes.push(dom + ' → ' + best); return best; }
    return whole;
  });
  const walk = (v) => {
    if (typeof v === 'string') return fix(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') { for (const k of Object.keys(v)) v[k] = walk(v[k]); return v; }
    return v;
  };
  return { obj: walk(obj), fixes };
}

// Patch X.1 — fact-check pass. After the playbook is written, a fast second model reads
// the script, hook and captions and lists every sentence that states something the creator
// did not say (events, numbers, stakes, consequences, feelings, results). Those sentences are
// removed from the script and captions (never emptying a beat) and reported back so the
// creator can re-add anything that was actually true. Fails open: on any error or timeout
// the playbook is returned unchanged.
const FACT_CHECK_MODEL = 'claude-haiku-4-5-20251001';
const _normSentence = s => String(s || '').toLowerCase().replace(/[“”"’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
function _splitSentences(text) {
  return String(text || '').match(/[^.!?\n]+(?:\.\.+|[.!?]+)?["”’']?|\n/g) || [];
}
function _removeSentences(text, targets) {
  if (!text || !targets.length) return { text, removed: [] };
  const removed = [];
  const lines = String(text).split('\n');
  const out = lines.map(line => {
    if (/^\s*\[BEAT:/i.test(line)) return line;
    const parts = _splitSentences(line).filter(p => p !== '\n');
    const kept = parts.filter(p => {
      const n = _normSentence(p);
      const hit = n && targets.some(t => t && (n === t || (t.length > 25 && n.includes(t)) || (n.length > 25 && t.includes(n))));
      if (hit) removed.push(p.trim());
      return !hit;
    });
    // never blank a line that had content — keep the original if everything would go
    if (parts.length && !kept.length) { removed.splice(removed.length - parts.length, parts.length); return line; }
    return kept.join('').replace(/\s{2,}/g, ' ').trim();
  });
  return { text: out.join('\n'), removed };
}
async function factCheckPlaybook(apiKey, source, parsed) {
  if (!parsed || typeof parsed !== 'object' || !source) return null;
  const captions = (parsed.platform_strategies || []).map((p, i) => `CAPTION ${i + 1} (${(p && p.platform) || ''}): ${(p && p.caption) || ''}`).join('\n');
  const checkText = [
    `HOOK: ${parsed.hook || ''}`,
    `SCRIPT:\n${parsed.full_script || parsed.narration_script || ''}`,
    captions
  ].join('\n\n');
  const system = `You are a strict fact-checker for a creator's video script. SOURCE is everything the creator actually said. For every sentence in DRAFT, decide whether it is supported by SOURCE.
A sentence is UNSUPPORTED if it states an event, number, result, consequence, stake, feeling, audience reaction, or claim about other people that SOURCE does not say or clearly imply. Generic claims about audiences ("nobody stays", "you lose people in the first ten seconds") are UNSUPPORTED unless SOURCE says them.
Rephrasing, shortening, transitions ("Here's the thing", "So"), calls to action, the creator's sign-off, and restating SOURCE in other words are SUPPORTED.
A sentence that states the MEANING or LESSON of events that are in SOURCE ("The start doesn't have to be impressive", "I keep fixing what I can see") is SUPPORTED — interpreting the creator's own events is the writer's job. Only flag it if it adds a new fact.
Return ONLY JSON: {"unsupported":[{"text":"the exact sentence copied from DRAFT","why":"max 8 words"}]}. Empty array if everything is supported.`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: FACT_CHECK_MODEL, max_tokens: 1200, system,
        messages: [{ role: 'user', content: `SOURCE:\n${source}\n\nDRAFT:\n${checkText}` }] })
    });
    if (!r.ok) return null;
    const j = await r.json();
    const raw = (j.content || []).map(c => c.text || '').join('');
    const m = raw.match(/\{[\s\S]*\}/);
    const list = m ? (JSON.parse(m[0]).unsupported || []) : [];
    // Patch Y.1 — never remove a sentence that is mostly the creator's own words. The checker
    // occasionally flags lines copied straight from SOURCE; a word-overlap test overrules it.
    const srcWords = new Set(_normSentence(source).split(' ').filter(Boolean));
    const STOP = new Set('a an the and or but so to of in on at for with it its i im ive id my me you your was were is are be been just that this then like really'.split(' '));
    const mostlyFromSource = (t) => {
      const w = t.split(' ').filter(x => x && !STOP.has(x));
      if (!w.length) return true;
      return w.filter(x => srcWords.has(x)).length / w.length >= 0.8;
    };
    const targets = list.map(u => _normSentence(u && u.text)).filter(t => t.length >= 8 && !mostlyFromSource(t));
    if (!targets.length) return { removed: [], checked: true };
    const removed = [];
    for (const f of ['full_script', 'narration_script']) {
      if (typeof parsed[f] === 'string') { const o = _removeSentences(parsed[f], targets); parsed[f] = o.text; removed.push(...o.removed); }
    }
    for (const p of (parsed.platform_strategies || [])) {
      if (p && typeof p.caption === 'string') { const o = _removeSentences(p.caption, targets); p.caption = o.text; removed.push(...o.removed); }
    }
    const unique = [...new Set(removed.map(s => s.replace(/\s+/g, ' ').trim()))].filter(Boolean);
    return { removed: unique, checked: true };
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Patch Z.4 — number guard. Deterministic backstop for the fact-check: any sentence in the
// script or captions containing a number the creator never said is cut. Same number reading as
// scripts/story-eval.js: digits, number words, compounds ("four hundred"), ordinals from "third",
// "250k" = 250,000. "one"/"first"/"second" are ignored (pronoun/adverb); "two" as a counting word
// ("wrote two things") is allowed.
const NG_WORDS = { one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,
  thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,
  forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,hundred:100,thousand:1000 };
const NG_ORD = { third:3, fourth:4, fifth:5, sixth:6, seventh:7, eighth:8, ninth:9, tenth:10 };
function numbersInText(text, { allowCountingTwo = false } = {}) {
  const t = String(text || '').toLowerCase().replace(/(\d),(\d)/g, '$1$2');
  const out = new Set();
  let m;
  const dre = /(\d+(?:\.\d+)?)\s*(k|m)?\b/g;
  while ((m = dre.exec(t))) {
    const n = Number(m[1]);
    out.add(n);
    if (m[2] === 'k') out.add(n * 1000);
    if (m[2] === 'm') out.add(n * 1000000);
  }
  const toks = [...t.matchAll(/\b[a-z]+\b/g)];
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i][0];
    if (NG_ORD[w] !== undefined) { out.add(NG_ORD[w]); continue; }
    if (w === 'one' || NG_WORDS[w] === undefined) continue;
    if (allowCountingTwo && w === 'two' && !(toks[i + 1] && (toks[i + 1][0] === 'hundred' || toks[i + 1][0] === 'thousand'))) continue;
    let val = NG_WORDS[w], j = i;
    if (val >= 20 && val < 100 && toks[j + 1] && NG_WORDS[toks[j + 1][0]] < 10) { val += NG_WORDS[toks[j + 1][0]]; j++; }
    while (toks[j + 1] && (toks[j + 1][0] === 'hundred' || toks[j + 1][0] === 'thousand')) { val *= NG_WORDS[toks[j + 1][0]]; j++; }
    if ((w === 'hundred' || w === 'thousand') && i > 0 && NG_WORDS[toks[i - 1][0]] !== undefined) continue;
    out.add(val); i = j;
  }
  return out;
}
function _numberOk(n, src) {
  return src.has(n) || src.has(n * 1000) || src.has(n / 1000) || src.has(n * 1000000) || src.has(n / 1000000);
}
// Remove sentences with untraceable numbers. Unlike _removeSentences this may empty a line,
// but never empties a whole beat — if a beat would lose all its words, its original lines stay.
function guardNumbersInScript(text, src) {
  if (!text) return { text, removed: [] };
  const lines = String(text).split('\n');
  const removed = [];
  const out = lines.map(line => {
    if (/^\s*\[BEAT:/i.test(line)) return line;
    const parts = _splitSentences(line).filter(p => p !== '\n');
    const kept = parts.filter(p => {
      const bad = [...numbersInText(p, { allowCountingTwo: true })].some(n => !_numberOk(n, src));
      if (bad) removed.push(p.trim());
      return !bad;
    });
    return kept.join('').replace(/\s{2,}/g, ' ').trim();
  });
  // restore any beat that would be left empty
  let beatStart = 0;
  const isMarker = l => /^\s*\[BEAT:/i.test(l);
  for (let i = 0; i <= out.length; i++) {
    if (i === out.length || (isMarker(out[i]) && i > beatStart)) {
      const from = isMarker(out[beatStart]) ? beatStart + 1 : beatStart;
      const hadWords = lines.slice(from, i).some(l => l.trim());
      const hasWords = out.slice(from, i).some(l => l.trim());
      if (hadWords && !hasWords) {
        for (let k = from; k < i; k++) out[k] = lines[k];
        const restored = lines.slice(from, i).join(' ');
        for (let r = removed.length - 1; r >= 0; r--) if (restored.includes(removed[r])) removed.splice(r, 1);
      }
      beatStart = i;
    }
  }
  return { text: out.filter((l, i) => l.trim() || !lines[i].trim() || isMarker(l)).join('\n'), removed };
}

// Patch Z.6 — the hook and architecture cards can't simply lose a sentence (a hook must exist),
// so lines there with untraceable numbers get a targeted rewrite by a fast model, then are
// re-checked. If a card still has one, the offending sentence is dropped when another remains.
async function rewriteWithoutNumbers(apiKey, source, lines) {
  const keys = Object.keys(lines);
  if (!keys.length) return {};
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const system = `You fix lines in a creator's video plan. Each line contains a number, quantity, percentage or statistic that the creator never said. Rewrite each line so it keeps its meaning, voice and roughly its length, but contains NO number or quantity that is not in SOURCE. Do not add any new facts. Return ONLY JSON mapping each key to its rewritten line.`;
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: FACT_CHECK_MODEL, max_tokens: 600, system,
        messages: [{ role: 'user', content: `SOURCE:\n${source}\n\nLINES:\n${JSON.stringify(lines, null, 2)}` }] })
    });
    if (!r.ok) return {};
    const j = await r.json();
    const raw = (j.content || []).map(c => c.text || '').join('');
    const m = raw.match(/\{[\s\S]*\}/);
    const out = m ? JSON.parse(m[0]) : {};
    const clean = {};
    for (const k of keys) if (typeof out[k] === 'string' && out[k].trim()) clean[k] = out[k].trim();
    return clean;
  } catch (e) {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

// Patch Y.2 — make the spoken first line of the script exactly the hook.
function enforceHookOpening(script, hook) {
  const h = String(hook || '').trim();
  if (!h || !script) return script;
  const lines = String(script).split('\n');
  const at = lines.findIndex(l => /^\s*\[BEAT:\s*Opening\s*\]\s*$/i.test(l));
  // first content line of the Opening beat (or of the script, if there are no markers)
  let i = at >= 0 ? at + 1 : 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (i >= lines.length || /^\s*\[BEAT:/i.test(lines[i])) {
    lines.splice(at >= 0 ? at + 1 : 0, 0, h);
    return lines.join('\n');
  }
  const line = lines[i];
  const nh = _normSentence(h), nl = _normSentence(line);
  if (nl.startsWith(nh)) return script;
  const parts = _splitSentences(line).filter(p => p !== '\n');
  const hw = nh.split(' ').filter(Boolean), hset = new Set(hw);
  // Find the shortest run of leading sentences that covers most of the hook's words
  // (a paraphrase can span a "..." pause), then swap that run for the hook.
  let cut = 0;
  for (let k = 1; k <= parts.length; k++) {
    const cw = _normSentence(parts.slice(0, k).join(' ')).split(' ').filter(Boolean);
    const covered = hw.filter(w => cw.includes(w)).length / hw.length;
    const extra = cw.filter(w => !hset.has(w)).length;
    if (covered >= 0.7 && extra <= Math.max(4, hw.length * 0.6)) { cut = k; break; }
    if (cw.length > hw.length * 2) break;
  }
  const rest = cut ? parts.slice(cut).join('').trim() : line.trim();
  lines[i] = rest ? h + ' ' + rest : h;
  return lines.join('\n');
}

// v9.113.3 — Voice DNA gate copy keyed by ACTUAL sam.js mode strings sent by frontend.
// Structure: { tool, descriptor, ctaAnon, ctaUnpaid } — frontend renders locked-state UI.
const GATE_COPY = {
  chat: {
    tool: 'Talk with SAM',
    descriptor: 'Chat with SAM about your content, offers, and next moves.',
    ctaAnon: 'Sign in to use Talk with SAM.',
    ctaUnpaid: 'Subscribe to use Talk with SAM — $39/month, every tool included, cancel anytime.'
  },
  ideas: {
    tool: 'The Spark',
    descriptor: 'Never run out of things to post.',
    ctaAnon: 'Sign in to use The Spark.',
    ctaUnpaid: 'Subscribe to use The Spark — $39/month, every tool included, cancel anytime.'
  },
  upload: {
    tool: 'The Lens',
    descriptor: 'Make people stop scrolling instantly.',
    ctaAnon: 'Sign in to use The Lens.',
    ctaUnpaid: 'Subscribe to use The Lens — $39/month, every tool included, cancel anytime.'
  },
  calendar: {
    tool: 'Blueprint',
    descriptor: 'Your whole week planned in 30 seconds.',
    ctaAnon: 'Sign in to use Blueprint.',
    ctaUnpaid: 'Subscribe to use Blueprint — $39/month, every tool included, cancel anytime.'
  },
  concept: {
    tool: 'The Vision',
    descriptor: 'One bold concept nobody else has made.',
    ctaAnon: 'Sign in to use The Vision.',
    ctaUnpaid: 'Subscribe to use The Vision — $39/month, every tool included, cancel anytime.'
  },
  pulse: {
    tool: 'The Pulse',
    descriptor: 'Turn a real moment into your best video.',
    ctaAnon: 'Sign in to use The Pulse.',
    ctaUnpaid: 'Subscribe to use The Pulse — $39/month, every tool included, cancel anytime.'
  },
  playbook: {
    tool: 'Story Engine',
    descriptor: 'Build your full content playbook.',
    ctaAnon: 'Sign in to use Story Engine.',
    ctaUnpaid: 'Subscribe to use Story Engine — $39/month, every tool included, cancel anytime.'
  },
  regen_section: {
    tool: 'Story Engine',
    descriptor: 'Build your full content playbook.',
    ctaAnon: 'Sign in to use Story Engine.',
    ctaUnpaid: 'Subscribe to use Story Engine — $39/month, every tool included, cancel anytime.'
  }
};

async function fetchRecentChatHistory(userId, limit = 20) {
  if (!userId || userId === 'anon' || userId.startsWith('anon-')) return [];
  try {
    const rows = await supabaseQuery(
      'sam_conversations', 'GET', null,
      `user_id=eq.${encodeURIComponent(userId.toLowerCase())}&order=created_at.desc&limit=${limit}`
    );
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows
      .filter(r => r.role && r.content)
      .reverse()
      .map(r => ({ role: r.role, content: r.content }));
  } catch (e) {
    console.error('[history] fetch error:', e.message);
    return [];
  }
}

// ── TIER LIMITS ────────────────────────────────────────────────────────────
const TIER_LIMITS = {
  free:    { playbooks: 5,  nextTools: 15,  chatMessages: 20 },
  creator: { playbooks: 10, nextTools: 70,  chatMessages: 200 },
  pro:     { playbooks: 20, nextTools: 200, chatMessages: 150 },
  studio:  { playbooks: 100,nextTools: 999, chatMessages: 999 },
};

async function checkLimit(userId, tier, action, tourStep) {
  // Dev bypass
  if (userId && (userId.startsWith('dev-') || userId === 'dev@sam.com')) {
    return { allowed: true };
  }
  // Founder bypass
  if (userId && userId.toLowerCase() === 'j.pirrone@yahoo.com') {
    return { allowed: true };
  }
  // Tour bypass — users going through guided tour run free
  if (tourStep !== undefined && tourStep !== null && parseInt(tourStep) >= 0 && parseInt(tourStep) <= 5) {
    return { allowed: true, tour: true };
  }
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      let kv;
      try { kv = require('@vercel/kv').kv; }
      catch(pkgErr) { console.log('KV package not available — skipping rate limit'); return { allowed: true }; }
      const today = new Date().toISOString().split('T')[0];
      const key = `${action}:${userId}:${today}`;
      const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
      const limit = limits[action] || 999;
      const current = (await kv.get(key)) || 0;
      if (current >= limit) {
        return { allowed: false, used: current, limit, message: 'Daily limit reached for your plan. Upgrade for more.' };
      }
      await kv.set(key, current + 1, { ex: 90000 });
      return { allowed: true, used: current + 1, limit };
    } catch(e) {
      console.error('KV error — failing open:', e.message);
      return { allowed: true };
    }
  }
  return { allowed: true };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mode, moment, platforms, contentType, creatorContext, tone, audienceDemographics, outputLanguage, emojiPreference, voiceProfile, bannedPhrases } = req.body;
  const userId = req.body.userId || req.headers['x-forwarded-for'] || 'anon';
  const tier = req.body.tier || 'free';

  // v9.113.1.1 — Voice DNA gate. Reject anonymous and unpaid before any expensive compute.
  // Fail-closed on unknown modes so future tool additions force a deliberate gating decision.
  const _gateCopy = GATE_COPY[mode];
  if (!_gateCopy) {
    return res.status(400).json({
      error: 'invalid_mode',
      message: 'Unknown tool mode.'
    });
  }
  {
    const _emailForGate = (req.body.email || req.body.userEmail || '').toString();
    const _gate = await checkGate({
      email: _emailForGate,
      userId,
      tool: _gateCopy.tool,
      descriptor: _gateCopy.descriptor,
      ctaAnonymous: _gateCopy.ctaAnon,
      ctaUnpaid: _gateCopy.ctaUnpaid
    });
    if (!_gate.ok) return res.status(_gate.status).json(_gate.body);
  }

  // Load user profile from Supabase (for persistent memory)
  let userProfile = null;
  if (userId && userId !== 'anon') {
    userProfile = await getUserProfile(userId).catch(() => null);
    // If uid is anon or profile missing, fall back to email lookup
    // Always fetch by email when available — email row has the authoritative brain data
    if (req.body.userEmail) {
      try {
        const _email = req.body.userEmail.trim().toLowerCase();
        const _enc = encodeURIComponent(_email);
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (SUPABASE_URL && SERVICE_KEY) {
          const _r = await fetch(
            `${SUPABASE_URL}/rest/v1/sam_users?email=eq.${_enc}&select=uid,voice_profile,sam_context,name,niche,platforms,tier,voice_version&order=last_seen.desc.nullslast&limit=1`,
            { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
          );
          if (_r.ok) {
            const _rows = await _r.json();
            const _real = Array.isArray(_rows) && _rows[0];
            // Always prefer email-based profile — it has the authoritative sam_context
            if (_real) userProfile = _real;
          }
        }
      } catch(_e) {}
    }
  }

  // Track user + save voice profile (awaited when voice data present)
  if (userId && userId !== 'anon') {
    await trackUser({
      uid: userId,
      email: req.body.email || null,
      name: req.body.name || null,
      tier,
      niche: req.body.niche || null,
      platforms: req.body.platforms || null,
      voice_calibrated: !!req.body.voiceProfile
    }).catch(() => {});
    trackEvent(userId, mode || 'chat', { tier }).catch(() => {});
    if (req.body.email && userId !== 'anon') {
    await updateUserEmail(userId, req.body.email, req.body.name || null).catch(() => {});
    // v9.116.5 — only fire signup notifications for ACTUALLY new users.
    // Pre-v9.116.4 the gate-less path was so leaky that the email/userId combo
    // rarely both arrived, so this block stayed dormant by accident. Now that
    // identity threads correctly, every Joey request was re-firing the toast.
    // Use the email-based userProfile lookup from upstream as the
    // already-exists signal — if userProfile is set, it's a returning user.
    const _isExistingUser = !!userProfile;
    if (!_isExistingUser) {
      // Notify Joey via Zapier Gmail webhook — new user signed up
      const userName = req.body.name || 'Anonymous';
      const userEmail = req.body.email;
      fetch('https://hooks.zapier.com/hooks/catch/27195700/u7evzoc/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: `New SAM user — ${userName}`,
          body: `New signup on samforcreators.com\n\nName: ${userName}\nEmail: ${userEmail}\nTime: ${new Date().toLocaleString()}\n\nGo to SAM HQ: https://sam-hq.vercel.app`,
          to: 'samforcreators@gmail.com'
        })
      }).catch(() => {});
      // Slack notification
      fetch(process.env.SLACK_WEBHOOK_URL || 'https://hooks.slack.com/services/placeholder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `🔔 *New SAM user!*\n\n👤 ${userName}\n📧 ${userEmail}\n🕐 ${new Date().toLocaleString()}\n<https://sam-hq.vercel.app|Open SAM HQ>` })
      }).catch(() => {});
      // Telegram notification via OpenClaw bot
      const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
      const telegramChatId = process.env.TELEGRAM_CHAT_ID || '8734019866';
      if (telegramToken) {
        fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: `🔔 New SAM user!\n\n👤 Name: ${userName}\n📧 Email: ${userEmail}\n🕐 ${new Date().toLocaleString()}\n\n👉 sam-hq.vercel.app`,
            parse_mode: 'Markdown'
          })
        }).catch(() => {});
      }
    }
  }
  if (req.body.voiceProfile || req.body.samContext) {
      await saveUserProfile(userId, {
        voice_profile: req.body.voiceProfile || (userProfile && userProfile.voice_profile) || null,
        sam_context: req.body.samContext || (userProfile && userProfile.sam_context) || null
      }).catch(() => {});
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const tourStep = req.body.tourStep !== undefined ? req.body.tourStep : null;

  if (mode === 'playbook') {
    const check = await checkLimit(userId, tier, 'playbooks', tourStep);
    if (!check.allowed) return res.status(429).json({ error: 'limit_reached', message: check.message });
  }
  // Chat conversation is unlimited — only tool runs (playbooks, nextTools) count against limits
  // if (mode === 'chat' && req.body.messages) {
  //   const check = await checkLimit(userId, tier, 'chatMessages', tourStep);
  //   if (!check.allowed) return res.status(429).json({ error: 'limit_reached', message: check.message });
  // }

  // ── CHAT MODE ─────────────────────────────────────────────────────────────
  // Two sub-modes:
  //   messages present = SAM chatbot (Haiku, 400 tokens, conversational)
  //   no messages = "tools" mode (Sonnet, 3000 tokens, JSON generation)
  if (mode === 'chat') {
    const { messages, systemPrompt } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // ── CHATBOT sub-mode (has messages array) ────────────────────────────────
    if (messages && Array.isArray(messages)) {
      // Check if any message has image content — use Sonnet for vision
      const hasImage = messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image'));
      const chatModel = hasImage ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';
      const chatMaxTokens = hasImage ? 600 : Math.min(parseInt(req.body.maxTokens) || 400, 1500);
      // Prefer client-sent voiceProfile (localStorage) with Supabase as fallback
      const effectiveVoice = voiceProfile || (userProfile && userProfile.voice_profile) || '';
      let profileContext = '';
      if (userProfile || effectiveVoice) {
        const brainCtx = normalizeSamContext(userProfile && userProfile.sam_context);
        if (effectiveVoice) brainCtx.voice.profile = effectiveVoice;
        if (userProfile && userProfile.name && !brainCtx.identity.name) brainCtx.identity.name = userProfile.name;
        if (userProfile && userProfile.voice_version) brainCtx.voice.version = userProfile.voice_version;

        profileContext = buildBrainPrompt(brainCtx);

        const vp = effectiveVoice || brainCtx.voice.profile || '';
        if (vp) {
          profileContext += '\n\nVOICE DNA — CRITICAL INSTRUCTION: Apply forensic voice fingerprint in every response. Match sentence rhythm, punctuation personality, actual phrases, energy signature. Never generic AI polish.\nVoice fingerprint: ' + vp.slice(0, 800);
        }
      }
      if (userId && userId !== 'anon' && !userId.startsWith('anon-')) {
        profileContext += `\n\nMEMORY & CONTINUITY:\nYou have persistent memory of this user across sessions:\n- Their Voice DNA profile (above) — how they actually write\n- Their story context and niche (above, if present)\n- Past conversations stored in your database\nWhen the user asks "do you remember me" or "what do you know about me", be honest and specific. Reference what's actually in the profile. Never disclaim memory you have. If you genuinely don't have something (e.g., a specific event they mention from before that's not in context), say so plainly — don't fall back to generic "I can't remember between sessions" disclaimers, because that's false.\n\nHOW VOICE DNA UPDATES: The user's Voice DNA profile only updates when they explicitly submit new writing samples through the Voice Trainer (the 🧬 button in the nav, Workshop, or chat header). Chat conversations with you do NOT automatically update their voice profile — they're saved to your memory of past chats, but not analyzed into voice traits. If a user asks how to refine their voice profile or says "you'll learn my voice over time," gently point them to Voice Trainer rather than implying chat alone evolves their profile.`;
      }
      const baseSystem = systemPrompt || `You are SAM`;
      const chatSystem = systemPrompt ? systemPrompt + profileContext : `You are SAM — Strategic Assistant for Making — a friendly, sharp creative director built into the SAM app at samforcreators.com. You help creators understand and get the most out of SAM's 5 tools.

THE 5 TOOLS:
1. The Pulse — User describes a real moment in their own words. SAM writes: one powerful hook, a full word-for-word script with b-roll cues, platform captions for all selected platforms. Best for: any real moment, story, setback, win, or emotion worth sharing.
2. The Spark — User describes their niche. SAM generates 5 specific content ideas with a why-it-works breakdown and best platform for each. Each idea can be sent straight to The Pulse.
3. The Blueprint — User describes their niche and selects platforms. SAM builds a complete 7-day posting calendar with content type, caption, and platform for each day.
4. The Vision — User describes their niche or idea. SAM generates one bold unique video concept with premise, hook line, production notes, and a real virality score.
5. The Lens — Two modes: (A) Drop a photo — SAM builds thumbnail strategy. (B) Drop analytics screenshot — SAM reads what's working.

PERSONALITY: Confident, direct, warm. Keep responses to 2-4 sentences max. No jargon.` + profileContext;

      let finalMessages = messages.slice(-10);
      const currentSessionLength = messages.filter(m => m.role === 'user').length;
      if (currentSessionLength <= 2 && userId && userId !== 'anon' && !userId.startsWith('anon-')) {
        const history = await fetchRecentChatHistory(userId, 20);
        if (history.length > 0) finalMessages = [...history, ...finalMessages];
      }

      try {
        const chatRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: chatModel,
            max_tokens: chatMaxTokens,
            system: chatSystem,
            messages: finalMessages
          })
        });
        const data = await chatRes.json();
        const reply = data?.content?.[0]?.text || "I'm here! Try asking again.";
        res.write('data: ' + JSON.stringify({ done: true, result: { reply } }) + '\n\n');
        return res.end();
      } catch(e) {
        res.write('data: ' + JSON.stringify({ error: e.message }) + '\n\n');
        return res.end();
      }
    }

    // ── TOOLS sub-mode (no messages — JSON generation for next tools + regen) ─
    // Uses Sonnet with 3000 tokens so complex JSON (emails, calendars, etc) fits
    const toolPrompt = req.body.toolPrompt || (req.body.messages?.[0]?.content) || moment || '';
    if (!toolPrompt) {
      res.write('data: ' + JSON.stringify({ error: 'No prompt provided' }) + '\n\n');
      return res.end();
    }

    // Trim toolPrompt if too large to prevent Anthropic API errors
    const trimmedPrompt = toolPrompt.length > 6000 ? toolPrompt.slice(0, 6000) + '\n[truncated for length]' : toolPrompt;
    try {
      const toolRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 3000,   // Haiku: fast + cheap for structured JSON tools
          stream: true,
          system: 'You are SAM — Strategic Assistant for Making. Return ONLY valid JSON. No markdown. No backticks. No explanation outside the JSON.',
          messages: [{ role: 'user', content: trimmedPrompt }]
        })
      });

      if (!toolRes.ok) {
        const e = await toolRes.text().catch(() => '');
        res.write('data: ' + JSON.stringify({ error: 'API error ' + toolRes.status }) + '\n\n');
        return res.end();
      }

      const reader = toolRes.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      // Patch U.1 — buffer partial SSE lines across chunks (see streamCall).
      let lineBuf = '';
      const handleLine = (line) => {
        if (!line.startsWith('data: ')) return;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') return;
        try {
          const evt = JSON.parse(raw);
          if (evt.type === 'content_block_delta' && evt.delta?.text) {
            full += evt.delta.text;
            res.write('data: ' + JSON.stringify({ t: evt.delta.text }) + '\n\n');
          }
        } catch(_) {}
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        lineBuf += decoder.decode(value, { stream: true });
        const lines = lineBuf.split('\n');
        lineBuf = lines.pop();
        for (const line of lines) handleLine(line);
      }
      lineBuf += decoder.decode();
      if (lineBuf) handleLine(lineBuf);
      // Parse and return the JSON
      let clean = full.trim().replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```$/i,'').trim();
      const first = clean.indexOf('{'), last = clean.lastIndexOf('}');
      if (first !== -1 && last !== -1) clean = clean.slice(first, last + 1);
      let parsed;
      try { parsed = JSON.parse(clean); }
      catch(e) {
        // Try to recover truncated JSON
        let partial = clean.slice(first !== -1 ? first : 0);
        let opens = 0;
        for (const ch of partial) { if (ch === '{') opens++; else if (ch === '}') opens--; }
        partial = partial + '}'.repeat(Math.max(0, opens));
        try { parsed = JSON.parse(partial); }
        catch(e2) {
          res.write('data: ' + JSON.stringify({ error: 'Could not parse response — try again' }) + '\n\n');
          return res.end();
        }
      }
      // Return as reply field so client-side parsing works consistently
      res.write('data: ' + JSON.stringify({ done: true, result: { reply: JSON.stringify(parsed) } }) + '\n\n');
      return res.end();
    } catch(e) {
      res.write('data: ' + JSON.stringify({ error: e.message }) + '\n\n');
      return res.end();
    }
  }

  if (!mode) return res.status(400).json({ error: 'Missing mode' });
  if (mode !== 'playbook' && mode !== 'chat' && (!moment)) {
    return res.status(400).json({ error: 'Missing moment' });
  }

  const PLATFORM_SPECS = {
    'TikTok':           { limit: 2200, hashtags: '3-5 hashtags', note: 'Hook in first line. First 1-2 seconds decide everything. Under 60s performs best.' },
    'YouTube Shorts':   { limit: 100,  hashtags: '3 hashtags above title', note: 'Title up to 100 chars is the primary discovery hook. Vertical 9:16, under 60s.' },
    'YouTube':          { limit: 5000, hashtags: '5-8 hashtags, first 3 appear above title', note: 'Title up to 100 chars. First 2-3 lines of description show before "more". Front-load keywords.' },
    'Instagram Reels':  { limit: 2200, hashtags: '3-5 focused hashtags', note: 'First 125 chars critical. Reels reach non-followers more than any other IG format.' },
    'Facebook Reels':   { limit: 477,  hashtags: '2-3 hashtags max', note: 'Under 477 chars. Hook in first 3 seconds.' },
    'LinkedIn':         { limit: 3000, hashtags: '3-5 hashtags at end', note: 'First 210 chars show before "see more". Professional but personal works best.' },
    'X (Twitter)':      { limit: 280,  hashtags: '1-2 hashtags max', note: 'Hard 280 char limit including hashtags. Links count as 23 chars.' }
  };

  const getPlatformContext = (platList) => {
    if (!platList || !platList.length) return '';
    return platList.map(p => {
      const s = PLATFORM_SPECS[p]; if (!s) return p;
      return `${p}: ${s.note} Character limit: ${s.limit}. Hashtags: ${s.hashtags}.`;
    }).join(' | ');
  };

  const toneMap = {
    'Authentic/Natural': 'Write in an authentic, real, conversational tone — like a real person talking, not a marketer.',
    'Viral/Hype':        'Write in a bold, punchy, high-energy tone — scroll-stopping but not fake.',
    'Wise/Mentor':       'Write in a wise, thoughtful, mentor-like tone — insight-driven, builds trust.',
    'Bubbly/Energetic':  'Write in a warm, bubbly, energetic tone — fun and uplifting.'
  };
  const toneContext = toneMap[tone] || toneMap['Authentic/Natural'];
  const emojiMap = { no: 'Use zero emojis.', few: 'Use 1-2 emojis maximum, only where they add genuine meaning.', lots: 'Use emojis freely and expressively.' };
const hashtagRule = 'HASHTAG RULE — CRITICAL: Use a maximum of 3-4 hashtags total. Choose only the most specific and relevant ones to this exact post and this creator. Never use generic filler hashtags. Never exceed 4 hashtags regardless of platform.';
  const emojiLine = emojiMap[emojiPreference] || emojiMap['few'];
  const creatorLine = creatorContext
    ? `CREATOR CONTEXT: ${creatorContext} — Use this to make every output specific to this creator's story, niche, audience and voice. Never write generic content when you have this context.`
    : 'No creator context provided — write in a clear, relatable creator voice.';
  const demographicsLine = audienceDemographics
    ? `AUDIENCE DEMOGRAPHICS: ${audienceDemographics}. Tailor vocabulary, cultural references, humour, hook style, caption length and platform recommendations specifically for this demographic.`
    : '';
  const languageLine = outputLanguage ? `Write the ENTIRE output in ${outputLanguage}. JSON field names stay in English.` : '';
  const platformContext = platforms && platforms.length > 0 ? `PLATFORM SPECS (follow exactly): ${getPlatformContext(platforms)}` : '';
  const formatContext = contentType ? `Content format requested: ${contentType}.` : '';
  const voiceLine = voiceProfile
    ? `VOICE PROFILE — THIS IS THE MOST IMPORTANT INSTRUCTION: You have a forensic voice fingerprint built from this creator's ACTUAL writing samples. Real analysis: ${voiceProfile}

You must ghost-write AS this person — not inspired by them, not in their general direction, but AS them. Apply their voice at the sentence level on every single line of output.

To do this correctly:
- Match their sentence rhythm exactly — if they punch short, you punch short. If they breathe long, you breathe long.
- Use their punctuation personality — their dashes, their ellipses, their caps, their lack of caps
- Use their actual words and phrases — not synonyms, not upgrades, their words
- Mirror their energy signature — if they're dry, stay dry. If they're hype, stay hype. Never drift toward generic AI polish.
- Apply their dialect and filler patterns naturally — don't force it, but don't sanitize it either
- Honor their "tell" — that one unmistakable move that is only them

The test: if you showed this output to the creator and they read it out loud, it should feel like reading their own journal — not a press release about them.

NEVER write in generic AI voice when you have this profile. Generic AI voice is: smooth, balanced, professionally warm, slightly motivational, uses words like "journey", "authentic", "powerful story", "resonate". That is the enemy. Write like the human, not the algorithm.`
    : '';

  const bannedLine = (bannedPhrases && bannedPhrases.trim())
    ? `BANNED PHRASES — Never use these words or phrases, even loosely paraphrased: ${bannedPhrases.trim()}. This is a hard constraint — treat it like a style rule, not a suggestion.`
    : '';

  const samIdentity = `You are S.A.M. — Strategic Assistant for Making. You are an AI content strategist that helps creators write better scripts, hooks, captions, strategies and content plans.`;

  // Patch U.2 — shared story rules. Used by the playbook and by the architecture + script regens
  // so every path builds structure the same way.
  const STORY_RULES = `STORY ARCHITECTURE — build this before writing anything else.

0. Find the 5-second moment first: the single instant in the creator's story when something changed —
   a realization, a reversal, a decision (the neighbor pointing at the ground; "my stories were never bad").
   Quote or closely paraphrase the creator's words. The whole video is built to deliver that moment;
   everything before it sets it up, everything after it says what it means. If there isn't one yet,
   write "not found" and ask for it in "gaps".

   Then name the story type and use its shape inside the same six beats:
   mistake_lesson   — "man in a hole": confident effort → it fails → the real cause is revealed (turn) →
                      the lesson (payoff). Setup never hints at the real cause.
   transformation   — before → the moment → after. Setup is who/where they were; payoff is who/where they
                      are now and what it means. Contrast must be concrete, not adjectives.
   demo_proof       — "what is / what could be": the frustrating way it is now (setup/risk) → showing the
                      new way working, live or with results the creator gave (turn) → why it matters (payoff).
                      Never a feature list. Results only if the creator stated them.
   origin           — why it started: the problem they lived (setup) → what it cost (risk) → the decision
                      to build/start/change (turn) → what it means now (payoff).
   behind_the_scenes — the process: what they set out to do → the surprise or problem mid-way (risk/turn) →
                      how it turned out and what they learned (payoff).
   moment_reflection — a small everyday moment → the realization it triggered (turn) → the bigger meaning
                      (payoff). Keep it small and specific; do not inflate it.

1. Find the story first. From the creator's moment, identify:
   want (what they were after), obstacle (what was in the way),
   question (what the opening makes the viewer need answered),
   flip (the belief or situation that reverses at the turn).

2. Use only what the creator gave you. Never invent events, people, pets, places, numbers, or quotes.
   Copy every number exactly as the creator said it ("an inch and a half" stays "an inch and a half").
   If a beat needs a concrete detail the moment does not contain, write the beat without it and list
   what is missing in "gaps". If the moment has no real turn yet, say so plainly in the diagnosis.
   Stakes, consequences, outcomes and feelings count as facts too. If the creator did not say what it
   cost them or what would happen ("nobody was watching", "it was killing my content"), do not invent it:
   write the risk beat from what they did say, and add "what this cost you" to "gaps".

3. Each beat has one job:
   opening — the hook. Opens the question. It is the SAME line as "hook", word for word.
   setup   — the want and the obstacle. Must NOT reveal the solution or the real cause.
   risk    — what it costs if nothing changes. A real cost, not doubt or skepticism.
   turn    — the flip. Something reverses. Not a restatement of the setup.
   payoff  — what it means. The realization or lesson the turn earns; it answers the opening's question.
             State the meaning, not the event ("I keep fixing what I can see", not "the door rolled").
   cta     — one short action that follows from the payoff.

4. Every question raised must be answered by the payoff. No solution appears before the turn.

5. Length follows the material. A short moment makes a short video. Never pad to fill time.

6. Signature sign-off: if the creator has a sign-off line they always use, it may close the script
   and the captions, after the CTA. It never replaces the CTA or the payoff.

7. Copy every URL, website, @handle and product name exactly as the creator wrote it. Never respell them.
   Spoken forms count: "Sam for creators.com" is samforcreators.com.

8. Text in the moment that starts "(The creator added, when SAM asked ..." is the creator's own answer.
   Treat it exactly like the rest of their words — it is the fact to use instead of inventing one.

9. Craft checks before you finish:
   - But / Therefore: each beat connects to the one before it by "but" or "therefore", never "and then".
     If two beats are joined by "and then", rewrite the later one.
   - Specific beats general: use the creator's concrete details (numbers, objects, places, their exact
     words) instead of abstractions ("forty bucks and a Saturday", not "time and money").
   - Show, then say: put the concrete moment on screen first, the meaning second.
   - The creator's last word is protected: if their story ends with a qualifier, contradiction or second
     thought ("I still wouldn't underbid again though", "I honestly don't know what I'm going to do"),
     that line belongs in the payoff, in their words. It is often what makes the story true. Never drop it
     and never resolve it into a neater lesson than they gave.
   - Don't explain the punchline: when the creator's own line is the peak (a quote, a comeback, a twist),
     end the payoff on it or one beat after it. Do not add a moral or an explanation of what it meant.
   - Peak-end: the payoff is the strongest line in the video. Nothing after it except the short CTA and
     the sign-off.
   - Open loop: the hook raises a question only the turn or payoff answers. Never answer it in the setup.

10. The hook, script and captions are words the creator will say or post. Never put notes, labels or
    placeholders in them ("not found", "TBD", "[insert moment]", "needs a real moment"). If the story is
    thin, write a short, honest draft using only what the creator gave you — fewer words, not filler —
    and put everything that's missing in "gaps".`;

  const base = `${samIdentity} ${toneContext} ${emojiLine} ${hashtagRule} ${creatorLine} ${voiceLine}
${bannedLine} ${demographicsLine} ${languageLine} ${platformContext} ${formatContext} CRITICAL: Respond ONLY with valid JSON. No markdown. No backticks. No explanation outside the JSON.`;

  const streamCall = async (system, userContent, maxTokens) => {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, stream: true, system, messages: [{ role: 'user', content: userContent }] })
    });
    if (!r.ok) {
      const e = await r.text().catch(() => '');
      throw new Error('Anthropic error ' + r.status + (e ? ': ' + e.slice(0, 200) : ''));
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    // Patch U.1 — buffer partial SSE lines across network chunks. Previously each chunk was
    // split and parsed on its own, so a line cut by a chunk boundary failed JSON.parse and its
    // text delta was silently dropped (missing words in output).
    let lineBuf = '';
    const handleLine = (line) => {
      if (!line.startsWith('data: ')) return;
      const raw = line.slice(6).trim();
      if (!raw || raw === '[DONE]') return;
      try {
        const evt = JSON.parse(raw);
        if (evt.type === 'content_block_delta' && evt.delta?.text) {
          full += evt.delta.text;
          res.write('data: ' + JSON.stringify({ t: evt.delta.text }) + '\n\n');
        }
      } catch (_) {}
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      lineBuf += decoder.decode(value, { stream: true });
      const lines = lineBuf.split('\n');
      lineBuf = lines.pop();
      for (const line of lines) handleLine(line);
    }
    lineBuf += decoder.decode();
    if (lineBuf) handleLine(lineBuf);
    let clean = full.trim().replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```$/i,'').trim();
    const first = clean.indexOf('{');
    const last = clean.lastIndexOf('}');
    if (first !== -1 && last !== -1) clean = clean.slice(first, last + 1);
    let parsed;
    try { parsed = JSON.parse(clean); }
    catch (e) {
      res.write('data: ' + JSON.stringify({ error: 'SAM had trouble formatting the response. Please try again.' }) + '\n\n');
      res.end(); return;
    }
    // Patch W.2 — correct near-miss spellings of the creator's own domains in every output field.
    if (parsed && typeof parsed === 'object') {
      const b = req.body || {};
      const allowed = collectAllowedDomains([b.moment, b.wizardContext, b.creatorContext, b.steer, b.brandHandle, b.brandName]);
      const g = guardUrls(parsed, allowed);
      if (g.fixes.length) console.warn('[url-guard] corrected', g.fixes.join(', '));
    }
    // Patch X.1 — fact-check the playbook (and script regens) against what the creator said.
    if (parsed && typeof parsed === 'object' && (mode === 'playbook' || (mode === 'regen_section' && (req.body || {}).section === 'script'))) {
      const b = req.body || {};
      const source = [b.moment ? 'STORY: ' + b.moment : '', b.creatorContext ? 'ABOUT THE CREATOR: ' + b.creatorContext : ''].filter(Boolean).join('\n\n');
      const fc = await factCheckPlaybook(apiKey, source, parsed);
      if (fc) {
        parsed.fact_check = fc;
        if (fc.removed.length) console.warn('[fact-check] removed', fc.removed.length, 'unsupported sentence(s)');
      }
    }
    // Patch Z.4 — cut sentences containing numbers the creator never said (script + captions).
    if (parsed && typeof parsed === 'object' && (mode === 'playbook' || (mode === 'regen_section' && (req.body || {}).section === 'script'))) {
      const b = req.body || {};
      const srcNums = numbersInText([b.moment, b.creatorContext].filter(Boolean).join(' '));
      const cut = [];
      for (const f of ['full_script', 'narration_script']) {
        if (typeof parsed[f] === 'string') { const o = guardNumbersInScript(parsed[f], srcNums); parsed[f] = o.text; cut.push(...o.removed); }
      }
      for (const p of (parsed.platform_strategies || [])) {
        if (p && typeof p.caption === 'string') {
          const o = _removeSentences(p.caption, _splitSentences(p.caption)
            .filter(x => [...numbersInText(x, { allowCountingTwo: true })].some(n => !_numberOk(n, srcNums)))
            .map(_normSentence).filter(Boolean));
          p.caption = o.text; cut.push(...o.removed);
        }
      }
      if (cut.length) {
        parsed.fact_check = parsed.fact_check || { removed: [], checked: false };
        parsed.fact_check.removed = [...new Set([...(parsed.fact_check.removed || []), ...cut.map(x => x.replace(/\s+/g, ' ').trim())])];
        console.warn('[number-guard] removed', cut.length, 'sentence(s) with untraceable numbers');
      }
    }
    // Patch Z.6 — same number rule for the hook and the architecture cards.
    if (parsed && typeof parsed === 'object' && (mode === 'playbook' || mode === 'regen_section')) {
      const b = req.body || {};
      const srcText = [b.moment, b.creatorContext].filter(Boolean).join(' ');
      const srcNums = numbersInText(srcText);
      const hasBad = t => typeof t === 'string' && [...numbersInText(t, { allowCountingTwo: true })].some(n => !_numberOk(n, srcNums));
      const arch = (parsed.story_architecture && typeof parsed.story_architecture === 'object') ? parsed.story_architecture : {};
      const lines = {};
      if (hasBad(parsed.hook)) lines.hook = parsed.hook;
      for (const k of Object.keys(arch)) if (hasBad(arch[k])) lines['arch_' + k] = arch[k];
      if (Object.keys(lines).length) {
        const fixed = await rewriteWithoutNumbers(apiKey, srcText, lines);
        const fixedLog = [];
        for (const key of Object.keys(lines)) {
          const candidate = fixed[key];
          const target = key === 'hook' ? 'hook' : key.slice(5);
          if (candidate && !hasBad(candidate)) {
            if (key === 'hook') {
              // Patch Z.8 — swap the old hook out of the script too, so it never appears twice.
              for (const f of ['full_script', 'narration_script']) {
                if (typeof parsed[f] === 'string' && parsed[f].includes(lines.hook)) parsed[f] = parsed[f].split(lines.hook).join(candidate);
              }
              parsed.hook = candidate;
            } else arch[target] = candidate;
            fixedLog.push(lines[key]);
          } else if (key !== 'hook') {
            // last resort for cards: drop only the offending sentence(s) if anything else remains
            const parts = _splitSentences(arch[target]).filter(p => p !== '\n' && p.trim());
            const kept = parts.filter(p => !hasBad(p));
            if (kept.length) { arch[target] = kept.join(' ').replace(/\s{2,}/g, ' ').trim(); fixedLog.push(lines[key]); }
          }
        }
        if (fixedLog.length) {
          parsed.fact_check = parsed.fact_check || { removed: [], checked: false };
          parsed.fact_check.rewritten = fixedLog;
          console.warn('[number-guard] rewrote', fixedLog.length, 'hook/card line(s) with untraceable numbers');
        }
      }
    }
    // Patch Z.1 — detect placeholder/meta text that leaked into spoken fields (thin stories).
    if (parsed && typeof parsed === 'object') {
      const PLACEHOLDER = /\b(not found|tbd|to be determined|placeholder|needs a real moment|real moment needed|needed before|can be written|n\/a)\b|\[(insert|add|your)[^\]]*\]/i;
      const spokenFields = [parsed.hook, parsed.full_script, parsed.narration_script,
        ...((parsed.platform_strategies || []).map(p => p && p.caption))];
      parsed.is_draft = /^not found/i.test(String(parsed.five_second_moment || '')) || spokenFields.some(t => typeof t === 'string' && PLACEHOLDER.test(t));
      if (typeof parsed.hook === 'string' && PLACEHOLDER.test(parsed.hook)) parsed.hook = '';
      for (const f of ['full_script', 'narration_script']) {
        if (typeof parsed[f] === 'string') parsed[f] = parsed[f].split('\n').filter(l => !PLACEHOLDER.test(l) || /^\s*\[BEAT:/i.test(l)).join('\n');
      }
      // Patch Z.3 — clear placeholder architecture cards and captions.
      if (parsed.story_architecture && typeof parsed.story_architecture === 'object') {
        for (const k of Object.keys(parsed.story_architecture)) {
          if (typeof parsed.story_architecture[k] === 'string' && PLACEHOLDER.test(parsed.story_architecture[k])) parsed.story_architecture[k] = '';
        }
      }
      for (const p of (parsed.platform_strategies || [])) {
        if (p && typeof p.caption === 'string' && PLACEHOLDER.test(p.caption)) p.caption = '';
      }
      // Patch Z.5 — too thin to write honestly. This is decided by SAM's own judgment (no 5-second
      // moment found), not by matching placeholder wording, which varies run to run. When there is
      // no moment, nothing spoken is kept: SAM asks for the missing pieces instead.
      parsed.needs_more = /^\s*(not found|none|no moment|n\/a)\b/i.test(String(parsed.five_second_moment || ''));
      if (parsed.needs_more) {
        parsed.hook = '';
        parsed.hook_why = '';
        if (parsed.story_architecture && typeof parsed.story_architecture === 'object') {
          for (const k of Object.keys(parsed.story_architecture)) parsed.story_architecture[k] = '';
        }
        parsed.full_script = '';
        if (parsed.narration_script) parsed.narration_script = '';
        for (const p of (parsed.platform_strategies || [])) if (p) p.caption = '';
        if (parsed.fact_check) parsed.fact_check.removed = [];
      }
    }
    // Patch Y.2 — the script's Opening beat must start with the hook, word for word.
    // If its first sentence is a paraphrase of the hook, swap it for the hook; otherwise put the hook first.
    if (parsed && typeof parsed === 'object' && parsed.hook) {
      for (const f of ['full_script', 'narration_script']) {
        if (typeof parsed[f] === 'string') parsed[f] = enforceHookOpening(parsed[f], parsed.hook);
      }
    }
    // Patch Z.8 — second number pass once the hook leads the Opening beat.
    if (parsed && typeof parsed === 'object' && (mode === 'playbook' || (mode === 'regen_section' && (req.body || {}).section === 'script'))) {
      const b = req.body || {};
      const srcNums2 = numbersInText([b.moment, b.creatorContext].filter(Boolean).join(' '));
      const cut2 = [];
      for (const f of ['full_script', 'narration_script']) {
        if (typeof parsed[f] === 'string') { const o = guardNumbersInScript(parsed[f], srcNums2); parsed[f] = o.text; cut2.push(...o.removed); }
      }
      if (cut2.length) {
        parsed.fact_check = parsed.fact_check || { removed: [], checked: false };
        parsed.fact_check.removed = [...new Set([...(parsed.fact_check.removed || []), ...cut2.map(x => x.replace(/\s+/g, ' ').trim())])];
      }
    }
    // Patch U.3 — the hook IS the opening beat. Enforced in code so they can never diverge.
    if (parsed && typeof parsed === 'object' && parsed.hook && parsed.story_architecture && typeof parsed.story_architecture === 'object') {
      parsed.story_architecture.opening = parsed.hook;
    }
    // v9.118.16 (Patch C) — derive structured script_beats[] from [BEAT: ...] markers.
    // Additive only; full_script preserved unchanged. Empty array when no markers found.
    if (parsed && typeof parsed === 'object') {
      parsed.script_beats = parseScriptBeats(parsed.full_script || parsed.narration_script || '', (req.body || {}).pace);
    }
    res.write('data: ' + JSON.stringify({ done: true, result: parsed }) + '\n\n');
    res.end();
  };

  const errOut = (msg) => {
    if (res.headersSent) { res.write('data: ' + JSON.stringify({ error: msg }) + '\n\n'); res.end(); }
    else res.status(500).json({ error: msg });
  };

  try {

    // ── PLAYBOOK MODE ─────────────────────────────────────────────────────────
    if (mode === 'playbook') {
      const wizContext = req.body.wizardContext || '';
      const delivery   = req.body.delivery || 'camera';
      const pace       = req.body.pace || 'natural';
      const imageBase64 = req.body.imageBase64 || null;
      const imageType   = req.body.imageType || 'image/jpeg';

      const scriptStyle = {
        camera:    "Write a punchy, conversational on-camera script. Direct, personal, natural rhythm.",
        narration: "Write a cinematic narration script. More visual, more descriptive. Written to be spoken over footage. Use pauses intentionally.",
        text:      "Write short punchy text blocks for on-screen text. 5-8 words max per line. No speaking required.",
        mix:       "Write a mixed script. Label ON CAMERA and NARRATION sections clearly."
      }[delivery] || '';

      const paceNote = {
        fast:    "Speaker pace: fast. Tight and punchy. Never longer than 60 seconds; shorter if the moment is short.",
        natural: "Speaker pace: natural. Let it breathe. Never longer than 90 seconds; shorter if the moment is short.",
        slow:    "Speaker pace: deliberate. Pauses are intentional. Never longer than 120 seconds; shorter if the moment is short."
      }[pace] || '';

      const playbookPrompt = `${samIdentity} ${toneContext} ${emojiLine} ${hashtagRule} ${creatorLine} ${voiceLine} ${demographicsLine} ${languageLine} ${platformContext}

${STORY_RULES}

WIZARD CONTEXT:
${wizContext}

SCRIPT STYLE: ${scriptStyle}
${paceNote}

For the full_script and narration_script fields:

- Write the script as a realization of the story_architecture beats below, in this exact order: Opening, Setup, Risk, Turn, Payoff, CTA.
- Use [BEAT: Opening], [BEAT: Setup], [BEAT: Risk], [BEAT: Turn], [BEAT: Payoff], [BEAT: CTA] labels so each beat is visibly distinct in the script.
- IMPORTANT: each [BEAT: ...] marker must appear on its own line, immediately preceding the script content for that beat. Do not put markers mid-paragraph or inline with script text.
- The [BEAT: Opening] section must begin with the hook, word for word.
- Setup is the "And", Risk is the "But", Turn is the "Therefore", Payoff is what it means.
- Make Turn happen because the Risk is real, and Payoff happen because of the Turn. Do not soften or skip the stakes in Risk → Turn → Payoff.
- The [BEAT: CTA] section is one short line, plus the creator's sign-off if they have one. Nothing else.
- When voice and structure conflict, obey the creator's voice profile first and express the structure through their voice — never generic AI or screenwriting-textbook language.

Return ONLY this JSON — be CONCISE in every field to fit within token limits:

{
  "story_type": "one of: mistake_lesson, transformation, demo_proof, origin, behind_the_scenes, moment_reflection",
  "five_second_moment": "The instant something changed, in the creator's words. 'not found' if there isn't one.",
  "story_core": {
    "want": "One sentence, from the creator's own words.",
    "obstacle": "One sentence.",
    "question": "The question the opening opens.",
    "flip": "What reverses at the turn. If nothing does, say 'no turn yet'."
  },
  "gaps": ["Concrete details the story needs that the creator did not give. Empty array if none."],
  "diagnosis": "2 sentences max. What the story is really about. If there is no turn yet, say so.",
  "hook": "Under 15 words. Creates an open loop. Must be true to the moment.",
  "hook_why": "One sentence.",
  "story_architecture": {
    "opening": "Copy the hook exactly.",
    "setup": "12 words max.",
    "risk": "12 words max.",
    "turn": "12 words max.",
    "payoff": "18 words max. What it means — the realization the turn earns, not a restatement of the event.",
    "cta": "12 words max."
  },
  "full_script": "Complete script — 200 words max. Realize all six story_architecture beats in order. Use [BEAT: Opening], [BEAT: Setup], [BEAT: Risk], [BEAT: Turn], [BEAT: Payoff], [BEAT: CTA] labels — each marker on its own line, preceding the script content for that beat.",
  "narration_script": "If narration delivery — 200 word version following the same six-beat fidelity rules as full_script: [BEAT: Opening] [BEAT: Setup] [BEAT: Risk] [BEAT: Turn] [BEAT: Payoff] [BEAT: CTA] in order, each marker on its own line, with the Risk → Turn → Payoff causal chain intact. Otherwise null.",
  "pacing_note": "One sentence.",
  "b_roll": ["shot 1", "shot 2", "shot 3"],
  "platform_strategies": [
    {
      "platform": "platform name",
      "strategy": "One sentence.",
      "caption": "Ready-to-post caption at correct character limit.",
      "hashtags": "#tag1 #tag2 #tag3"
    }
  ],
  "audience_profile": {
    "who": "2 sentences.",
    "pain_points": "2 sentences.",
    "secret_want": "1 sentence.",
    "where": "2 sentences.",
    "what_hooks_them": "2 sentences.",
    "what_loses_them": "1 sentence.",
    "voice": "2 sentences.",
    "why": "2 sentences."
  },
  "lead_magnet": {
    "title": "Specific, compelling title. Never promise a number of steps/beats/questions other than the 5 items below.",
    "why": "2 sentences. The guide must come from what the creator showed or learned in this moment, framed as what they learned — not outside expert advice or claims the creator did not make.",
    "items": [
      {"heading": "Point 1 — teach from this creator's moment in plain words; do not restate SAM's internal instructions", "body": "2 sentences max."},
      {"heading": "Point 2", "body": "2 sentences max."},
      {"heading": "Point 3", "body": "2 sentences max."},
      {"heading": "Point 4", "body": "2 sentences max."},
      {"heading": "Point 5", "body": "2 sentences max."}
    ],
    "comment_response": "Under 120 chars. Write ONE specific question the creator would genuinely ask their audience about this exact topic — not about engagement, not about resonating, not about their journey. A real question about the specific subject matter. Example: if the lead magnet is about relocating, ask something like 'where are you thinking about moving?' — not 'what part resonated with you'. Never use: glad this resonated, still figuring it out, what part are you curious about, drop a comment, DM me, save this, share this."
  },
  "focus_directive": "One sentence. The single most important thing to do today."
}

CRITICAL: Return ONLY valid JSON. Keep ALL fields concise — the JSON must be complete and valid.`;

        // ← KEY FIX: increased from 6000 to 8000 to prevent truncation
      const playbookUserContent = imageBase64
        ? [{ type: 'image', source: { type: 'base64', media_type: imageType, data: imageBase64 } }, { type: 'text', text: moment }]
        : moment;
      return await streamCall(playbookPrompt, playbookUserContent, 12000);
    }


    // ── REGEN SECTION MODE ────────────────────────────────────────────────────
    if (mode === 'regen_section') {
      const section = req.body.section || '';
      const sectionLabel = req.body.sectionLabel || section;
      const wizContext = req.body.wizardContext || '';
      const steer = req.body.steer || '';
      const delivery = req.body.delivery || 'camera';
      const pace = req.body.pace || 'natural';
      const platforms = req.body.platforms || [];
      const arch = req.body.story_architecture || {};
      const archLines = [
        arch.opening ? `Opening: ${arch.opening}` : null,
        arch.setup ? `Setup: ${arch.setup}` : null,
        arch.risk ? `Risk: ${arch.risk}` : null,
        arch.turn ? `Turn: ${arch.turn}` : null,
        arch.payoff ? `Payoff: ${arch.payoff}` : null,
        arch.cta ? `CTA: ${arch.cta}` : null,
      ].filter(Boolean).join('\n');

      const sectionPrompts = {
        diagnosis: `Rewrite ONLY the story diagnosis for this creator's moment.
Return ONLY: {"diagnosis":"2-3 sentences — what this story is really about beneath the surface","diagnosis_why":"1 sentence on why this framing will resonate"}`,

        architecture: `Rewrite ONLY the story architecture.

${STORY_RULES}

${steer ? 'CREATOR DIRECTION: ' + steer : ''}
Return ONLY: {"story_type":"mistake_lesson|transformation|demo_proof|origin|behind_the_scenes|moment_reflection","five_second_moment":"the instant something changed, or not found","hook":"under 15 words, open loop, true to the moment","hook_why":"one sentence","story_architecture":{"opening":"same as hook","setup":"12 words max","risk":"12 words max","turn":"12 words max","payoff":"18 words max — what it means, not the event","cta":"12 words max"},"gaps":["missing details, or empty array"]}`,

        hook: `Rewrite ONLY the opening hook — the single line that stops the scroll.
${steer ? 'CREATOR DIRECTION: ' + steer : ''}
Return ONLY: {"hook":"the hook line — punchy, specific, creates an open loop","hook_why":"1 sentence on why this hook works for this story and audience"}`,

        script: `Rewrite ONLY the full script for this creator's story.

You are rewriting the script for this existing six-beat story_architecture:
${archLines}

${voiceLine}

Delivery style: ${delivery}. Pace: ${pace}.
${steer ? 'CREATOR DIRECTION: ' + steer : ''}

${STORY_RULES}

Requirements:
- The Opening section must begin with this line, word for word: ${arch.opening || ''}
- Preserve all six beats and keep them in this exact order.
- The CTA section is one short line, plus the creator's sign-off if they have one. Nothing else.
- Use [BEAT: Opening], [BEAT: Setup], [BEAT: Risk], [BEAT: Turn], [BEAT: Payoff], [BEAT: CTA] labels — each marker on its own line, preceding the script content for that beat.
- Causal flow: Risk is the "But", Turn is the "Therefore", Payoff is what it means. Turn happens because the Risk is real; Payoff happens because of the Turn.
- Make the writing better while keeping the same structure, stakes, and creator's voice.

Format script lines as plain text. Use (note) for delivery notes when helpful.
Return ONLY: {"full_script":"the complete script","pacing_note":"one delivery tip"}`,

        platforms: `Rewrite ONLY the platform strategy — captions and hashtags for each platform.
Platforms: ${platforms.join(', ')}.
${steer ? 'CREATOR DIRECTION: ' + steer : ''}
Return ONLY: {"platform_strategies":[{"platform":"platform name","strategy":"1 sentence approach","caption":"ready-to-post caption","hashtags":"hashtags"}]}`,

        audience: `Rewrite ONLY the audience profile — deep psychographic breakdown of the ideal viewer.
${steer ? 'CREATOR DIRECTION: ' + steer : ''}
Return ONLY: {"audience_profile":{"who":"who they are in 1-2 sentences","pain_points":"their real frustrations","secret_want":"what they actually want","where":"where they spend time online","what_hooks_them":"what stops their scroll","what_loses_them":"what makes them leave","voice":"how to talk to them","why":"why this audience for this creator"}}`,

        focus: `Rewrite ONLY the focus directive — the single next move this creator should take.
${steer ? 'CREATOR DIRECTION: ' + steer : ''}
Return ONLY: {"focus_directive":"2-4 sentences. Direct, specific, actionable. No fluff. Tell them exactly what to do next and why."}`
      };

      const sectionPrompt = sectionPrompts[section];
      if (!sectionPrompt) return res.status(400).json({ error: 'Unknown section: ' + section });

      const fullPrompt = `${base}
WIZARD CONTEXT: ${wizContext}
MOMENT: ${moment || ''}

TASK: ${sectionPrompt}

CRITICAL: Return ONLY valid JSON. No preamble, no explanation, no markdown fences.`;

      const regenMoment = req.body.moment || wizContext || '';
      return await streamCall(fullPrompt, regenMoment, 2000);
    }

    // ── PLAYBOOK ROUTING — non-moment storyTypes branch to correct tool ───────
    const storyTypeRouted = req.body.storyType || 'moment';

    if (storyTypeRouted === 'plan') {
      // "I need a content plan" → Blueprint (calendar)
      const platList = req.body.platforms && req.body.platforms.length > 0
        ? req.body.platforms
        : ['TikTok', 'Instagram Reels', 'YouTube Shorts'];
      const calPrompt = `${base}
WIZARD CONTEXT: ${req.body.wizardContext || ''}
Build a 7-day content posting plan tailored to this creator. Rotate across: ${platList.join(', ')}.
Each caption must respect that platform's exact character limit.
Return ONLY: {"days":[{"platform":"platform name","post_type":"Reel OR Short OR Post OR Video","content":"ready-to-post caption with hashtags"}]}`;
      return await streamCall(calPrompt, moment || req.body.wizardContext || '', 2400);
    }

    if (storyTypeRouted === 'idea') {
      // "I have a content idea" → Spark (ideas)
      const platList = req.body.platforms && req.body.platforms.length > 0
        ? req.body.platforms
        : ['TikTok', 'Instagram Reels', 'YouTube'];
      const ideasPrompt = `${base}
WIZARD CONTEXT: ${req.body.wizardContext || ''}
Generate exactly 5 specific, compelling content ideas this creator could actually make based on their context.
Return ONLY: {"ideas":[{"title":"specific content idea","why":"one sentence on why this resonates with their specific audience","best_platform":"single platform name"}]}`;
      return await streamCall(ideasPrompt, moment || req.body.wizardContext || '', 1200);
    }

    if (storyTypeRouted === 'concept') {
      // "I want a unique video concept" → Vision (concept)
      const conceptPlatforms = req.body.platforms && req.body.platforms.length > 0
        ? req.body.platforms
        : ['TikTok', 'YouTube Shorts'];
      const conceptPrompt = `${base}
WIZARD CONTEXT: ${req.body.wizardContext || ''}
Generate ONE bold, specific video concept for this creator to actually make.
Assign a real virality_score 60-100 based on genuine concept strength.
Return ONLY: {"title":"6-10 word concept title","format":"Reel OR Short OR YouTube video OR etc","premise":"2-3 sentences","why_it_works":"2 sentences","production_notes":["note 1","note 2","note 3"],"hook_line":"exact first sentence the creator speaks on camera","twist":"the unexpected angle that makes this memorable","virality_score":72}`;
      return await streamCall(conceptPrompt, moment || req.body.wizardContext || '', 1200);
    }

    if (storyTypeRouted === 'analyse') {
      // "I want to analyse what's working" → Lens (analytics text mode)
      const analysePrompt = `${base}
WIZARD CONTEXT: ${req.body.wizardContext || ''}
Based on this creator's context, analyse what content strategy is likely working and what to improve.
Return ONLY: {"type":"analytics","headline":"the single biggest strategic insight in one punchy sentence","whats_working":["specific observation 1","specific observation 2","specific observation 3"],"whats_not":["specific area to improve 1","specific area to improve 2"],"post_next":["specific content idea 1","specific content idea 2","specific content idea 3"],"growth_move":"one bold, specific strategic move to make this week"}`;
      return await streamCall(analysePrompt, moment || req.body.wizardContext || '', 1000);
    }

    // ── CALENDAR ─────────────────────────────────────────────────────────────
    if (mode === 'calendar') {
      const platList = platforms && platforms.length > 0 ? platforms : ['TikTok', 'Instagram Reels', 'YouTube Shorts'];
      const prompt = `${base}
Build a 7-day content posting plan. Rotate across: ${platList.join(', ')}.
Each caption must respect that platform's character limit exactly.
Return ONLY: {"days":[{"platform":"platform name","post_type":"Reel OR Short OR Post OR Video","content":"ready-to-post caption respecting character limit with hashtags"}]}`;
      return await streamCall(prompt, moment, 1600, 'claude-haiku-4-5-20251001');
    }

    // ── IDEAS ─────────────────────────────────────────────────────────────────
    if (mode === 'ideas') {
      const platList = platforms && platforms.length > 0 ? platforms : ['TikTok', 'Instagram Reels', 'YouTube'];
      const prompt = `${base}
Generate exactly 5 specific, compelling content ideas this creator could actually make.
Return ONLY: {"ideas":[{"title":"specific content idea","why":"one sentence on why this resonates with their specific audience","best_platform":"single platform name"}]}`;
      return await streamCall(prompt, moment, 900);
    }

    // ── UPLOAD ────────────────────────────────────────────────────────────────
    if (mode === 'upload') {
      const imageBase64 = req.body.imageBase64 || null;
      const imageType = req.body.imageType || 'image/jpeg';
      const forceType = req.body.forceType || null;

      if (forceType === 'photo' || (!forceType && imageBase64)) {
        const contextNote = moment && moment !== 'Analyse this image.'
          ? `The creator described this moment: "${moment}". Write headlines that reflect what THEY said, not what you see in the photo.`
          : `Use the creator context to write headlines that reflect their niche and voice.`;

        const photoSystem = `${samIdentity} ${toneContext} ${emojiLine} ${creatorLine}
${contextNote}
safe_template: pick one of: splitPanel, cinematic, newsFlash
bold_template: pick a DIFFERENT one of: giantWord, cornerBurst, diagonalSlash, stackedBoxes
Return ONLY this JSON:
{"type":"photo","what_sam_sees":"face position and composition only","face_side":"left OR right OR center","face_size":"large OR medium OR small","content_type":"transformation OR emotional OR achievement OR tutorial OR personal OR shock OR renovation","content_angle":"one sentence","safe_template":"splitPanel OR cinematic OR newsFlash","bold_template":"giantWord OR cornerBurst OR diagonalSlash OR stackedBoxes","headline_safe":"5-8 WORD HEADLINE","headline_bold":"3-6 WORD BOLD HEADLINE","subtext_safe":"3-5 word supporting line","subtext_bold":"3-5 word contrast line","thumbnail_color":"#hexcolor","platforms":[{"platform":"TikTok","title":"hook title under 60 chars","description":"caption under 150 chars","hashtags":"#tag1 #tag2 #tag3"},{"platform":"YouTube","title":"SEO title under 70 chars","description":"description under 150 chars","hashtags":"#tag1 #tag2 #tag3"},{"platform":"Instagram Reels","title":"","description":"caption under 125 chars","hashtags":"#tag1 #tag2 #tag3"}]}
CRITICAL: Return ONLY valid JSON.`;

        const userContent = imageBase64
          ? [{ type: 'image', source: { type: 'base64', media_type: imageType, data: imageBase64 } }, { type: 'text', text: moment || 'Analyse this image.' }]
          : moment;
        return await streamCall(photoSystem, userContent, 1400, 'claude-haiku-4-5-20251001');
      }

      if (forceType === 'analytics') {
        const analyticsSystem = `${samIdentity} ${toneContext} ${emojiLine} ${creatorLine}
Analyse this analytics screenshot. Give honest, specific, actionable insights.
Return ONLY this JSON:
{"type":"analytics","headline":"the single biggest insight in one punchy sentence","whats_working":["specific observation 1","specific observation 2","specific observation 3"],"whats_not":["specific area to improve 1","specific area to improve 2"],"post_next":["specific content idea 1","specific content idea 2","specific content idea 3"],"growth_move":"one bold, specific strategic move to make this week"}
CRITICAL: Return ONLY valid JSON.`;

        const userContent = imageBase64
          ? [{ type: 'image', source: { type: 'base64', media_type: imageType, data: imageBase64 } }, { type: 'text', text: moment || 'Analyse my analytics.' }]
          : moment;
        return await streamCall(analyticsSystem, userContent, 900, 'claude-haiku-4-5-20251001');
      }

      if (forceType === 'reach') {
        const reachPrompt = req.body.moment || '';
        const reachContent = imageBase64
          ? [{ type: 'image', source: { type: 'base64', media_type: imageType, data: imageBase64 } }, { type: 'text', text: reachPrompt }]
          : reachPrompt;
        const reachSystem = `You are SAM — a strategic content assistant. Generate platform-ready post content based on the photo and context provided. Write in plain text only. NO JSON, no markdown, no code blocks.

For each platform requested, use this exact format:

PLATFORM: [Platform Name]
HOOK: [attention-grabbing opening line]
CAPTION: [full caption text]
DESCRIPTION: [longer description if needed]
CTA: [call to action]
HASHTAGS: [relevant hashtags]

Make every caption feel personal, story-driven, and native to that platform. Write in the creator's voice.`;
      return await streamCall(reachSystem, reachContent, 1800, 'claude-sonnet-4-6');
      }

      const textSystem = `${base} Analyse this content idea. Return ONLY: {"type":"text_only","diagnosis":"what this idea is really about and why it has potential — 2 sentences","hook_ideas":["hook 1","hook 2","hook 3"],"content_angle":"the strongest angle to take","best_platform":"single best platform","next_action":"the one most important thing to do with this idea right now"}`;
      return await streamCall(textSystem, moment, 700, 'claude-haiku-4-5-20251001');
    }

    // ── CONCEPT ───────────────────────────────────────────────────────────────
    if (mode === 'concept') {
      const conceptStyle = req.body.contentType || '';
      const conceptPlatforms = req.body.platforms && req.body.platforms.length > 0 ? req.body.platforms : ['TikTok', 'YouTube Shorts'];
      const styleStr = conceptStyle ? `Requested style: ${conceptStyle}.` : '';
      const prompt = `${base} Target platforms: ${conceptPlatforms.join(', ')}. ${styleStr}
Generate ONE bold, specific video concept for this creator to actually make.
Assign a real virality_score 60-100 based on genuine concept strength — not always 90+.
Return ONLY: {"title":"6-10 word concept title","format":"Reel OR Short OR YouTube video OR etc","premise":"2-3 sentences","why_it_works":"2 sentences","production_notes":["practical filming note 1","practical filming note 2","practical filming note 3"],"hook_line":"exact first sentence the creator speaks on camera","twist":"the unexpected angle that makes this memorable","virality_score":72}`;
      return await streamCall(prompt, moment, 1000, 'claude-haiku-4-5-20251001');
    }

    // ── THE PULSE ─────────────────────────────────────────────────────────────
    const textPostFormats = ['LinkedIn text post', 'Instagram caption', 'Email newsletter', 'Text post', 'Blog post'];
    const scriptInstructions = {
      'Short-form video':       'Write a complete word-for-word SCRIPT for the creator to deliver on camera. 60-90 seconds spoken. Beats in [BRACKETS]. Pacing notes in (parentheses).',
      'Long-form YouTube video':'Write a complete word-for-word SCRIPT for 8-12 minutes. Label: [INTRO HOOK],[CONTEXT],[MAIN STORY],[KEY LESSONS],[OUTRO CTA].',
      'LinkedIn text post':     'Write the complete LinkedIn post text. No brackets. Strong opening line, short paragraphs, ends with a question. 3 hashtags at end.',
      'Instagram caption':      'Write the complete Instagram caption. Hook in first line under 125 chars, body copy, CTA, then 5 focused hashtags.',
      'Email newsletter':       'Write complete email: SUBJECT LINE on first line, PREVIEW TEXT on second line, then full BODY.',
      'Text post':              'Write a complete text post. No brackets. Hook first, short paragraphs, ends with CTA.',
      'Blog post':              'Write: SEO HEADLINE, META DESCRIPTION under 160 chars, then the full article body with section headers.'
    };
    const scriptInstruction = scriptInstructions[contentType] || scriptInstructions['Short-form video'];
    const allPlatList = platforms && platforms.length > 0 ? platforms : ['TikTok', 'Instagram Reels'];
    const platStratInstruction = `Write a ready-to-post caption and hashtags for EACH of these platforms, respecting their exact character limits: ${allPlatList.join(', ')}.`;

    const pulsePrompt = `${base}
${scriptInstruction}
${platStratInstruction}
Return ONLY this JSON:
{"diagnosis":"2-3 sentences on the emotional core and why it will resonate","hook":"SAM's single best opening line","visual_note":"what to show on screen in the first 3 seconds","full_script":"COMPLETE script or post text","b_roll":["shot 1","shot 2","shot 3","shot 4"],"pacing_note":"one specific delivery tip","cta":"a specific call to action","platform_strategies":[{"platform":"platform name","strategy":"one specific posting tip","caption":"ready-to-post caption respecting character limit","hashtags":"hashtags"}]}`;

    return await streamCall(pulsePrompt, moment, 2400);

  } catch (err) {
    errOut(err.message || 'Something went wrong.');
  }
};
