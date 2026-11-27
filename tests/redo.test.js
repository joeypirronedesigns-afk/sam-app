// End-to-end (mocked, no API calls): a script Redo must use the story-sheet writer, keep capital I,
// keep "Next up", and return the sheet formula map + self-check. Run: node tests/redo.test.js
const Module = require('module'); const ol = Module._load;
Module._load = function (r, ...a) { try { return ol.call(this, r, ...a); } catch (e) { return new Proxy(function () {}, { get: (t, k) => (k === 'then' ? undefined : (() => Promise.resolve(null))), apply: () => Promise.resolve(null) }); } };
process.env.ANTHROPIC_API_KEY = 'test';
const SHEET = JSON.stringify({
  sheet: { anchor: '29 days left till Christmas', person: 'my parents', loop: '', underdog: 'Self-taught', stakes: 'that\'s the promise I\'m trying to keep', struggle: 'the microcrete is messier to work with than expected', proof: ['they look and feel modern'], viewer: 'I can do mine you can do yours keep showing up', next_up: 'all three bathrooms' },
  hook: '29 days left till Christmas to deliver the sanctuary i promised my parents 450 days ago.',
  beats: { opening: '29 days left till Christmas to deliver the sanctuary i promised my parents 450 days ago. Let me explain.', setup: "This is From Studs to Sanctuary. i'm self-taught.", risk: "Christmas is my goal. That's the promise i'm trying to keep before we move back to Florida. 29 days.", turn: 'The microcrete is messier to work with than expected.', payoff: 'They look and feel modern. Mediterranean almost.', cta: 'If you\'re tackling something similar.. i can do mine, you can do yours. Keep showing up. Next up: all three bathrooms.' },
  cards: {}, shots: ['wall'], pattern: 'countdown', pattern_why: 'a clock', alt_hooks: [], pacing_note: 'slow'
});
const OLD = JSON.stringify({ full_script: '[BEAT: Opening]\nold writer i promised\n[BEAT: CTA]\nkeep showing up', formula_map: [{ step: 'Anchor', line: 'old', from: "Your story: 'old'" }] });
global.fetch = async (url, opt) => {
  const body = JSON.parse(opt.body || '{}');
  if (body.stream) { // the old regen call (streamed)
    const enc = new TextEncoder(), ev = 'data: ' + JSON.stringify({ type: 'content_block_delta', delta: { text: OLD } }) + '\n\n';
    return { ok: true, body: { getReader: () => { let d = false; return { read: async () => (d ? { done: true } : (d = true, { done: false, value: enc.encode(ev) })) }; } } };
  }
  return { ok: true, json: async () => ({ content: [{ text: /script writer/.test(body.system || '') ? SHEET : '{}' }] }), text: async () => '' };
};
const handler = require('../server/sam.js');
const out = []; const res = { statusCode: 200, headers: {}, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(j) { out.push(JSON.stringify({ result: j })); return this; }, write(s) { out.push(s); }, end() { this.ended = true; }, flushHeaders() {} };
const req = { method: 'POST', headers: { cookie: '' }, body: { userId: 'dev-test', mode: 'regen_section', section: 'script', moment: "there's only 29 days left till Christmas for me to complete everything and deliver the sanctuary I promised to my parents 450 days ago... the microcrete is messier to work with than expected... they look and feel modern, Mediterranean almost... if you're tackling something similar I can do mine you can do yours keep showing up. Next: all three bathrooms", contentType: 'Short-form video', storyProfile: { seriesTag: '#FromStudsToSanctuary' }, signOff: 'Proof that ordinary people can accomplish extraordinary things.' } };
(async () => {
  await handler(req, res).catch(e => { console.log('handler threw:', e.message); });
  const last = out.map(s => { try { return JSON.parse(String(s).replace(/^data: /, '')); } catch (_) { return null; } }).filter(x => x && (x.result || x.error)).pop() || {};
  const r = last.result || {}; let fail = 0;
  const check = (name, ok) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name); };
  check('Redo used the story-sheet writer', /^sheet-v1/.test(r.script_engine || ''));
  check('no lowercase "i" in the script', r.full_script && !/(^|\s)i(\s|')/.test(r.full_script));
  check('"Next up" kept', /Next up/.test(r.full_script || ''));
  check('formula map from the sheet (no old "Your story:" rows)', Array.isArray(r.formula_map) && !r.formula_map.some(m => /^Your story: '/.test(m.from || '')));
  check('self-check row present', Array.isArray(r.formula_map) && r.formula_map.some(m => m.step === 'Self-check'));
  check('series hashtag not marked missing on a Redo', Array.isArray(r.formula_map) && r.formula_map.some(m => m.step === 'Series hashtag' && m.status === 'used'));
  console.log(fail ? `\n${fail} FAILED` : '\nall passed'); process.exit(fail ? 1 : 0);
})();
