// Regression set: every script problem found in outputs 63–66, plus the clean versions that must pass.
// Run: node tests/selfcheck.test.js   (no API calls, no credits)
const { selfCheck, capI } = require('../server/_scriptWriter.js');
const story = "there's only 29 days left till Christmas for me to complete everything and deliver the sanctuary I promised to my parents 450 days ago";
const base = {
  opening: '29 days left till Christmas to deliver the sanctuary I promised my parents 450 days ago. Let me explain.',
  setup: "This is From Studs to Sanctuary, where I'm turning a busted cottage into a sanctuary for my parents. I'm self-taught.",
  risk: "Christmas is my personal goal. I told them that. That's the promise I'm trying to keep before Amanda, Penny and I move back to Florida. 29 days.",
  turn: "Today it's the custom microcrete shower walls. The microcrete is messier to work with than expected. I'm glad I protected the new shower tiles before I started.",
  payoff: "So here's today. The walls I envisioned 450 days ago. And they're pretty spot on! It's crazy to think how many trades I've completed over the last year.",
  cta: "If you're tackling something similar.. I can do mine, you can do yours. Keep showing up. Next up: all three bathrooms."
};
const hook = '29 days left till Christmas to deliver the sanctuary I promised my parents 450 days ago.';
const cases = [
  ['clean script (65-style) passes', {}, null],
  ['63: payoff opens on unfinished work', { payoff: 'Master shower. One coat on. Still needs a final coat. Upstairs shower.. not started yet. But feel it.. smooth. Modern.' }, /NOT done yet/],
  ['63: "before we leave" unexplained', { risk: "Christmas is my goal. That's the promise I'm trying to keep before we leave. 29 days." }, /new viewer/],
  ['64: payoff repeats the Turn', { payoff: 'New shower tiles, laid and protected. The walls I envisioned 450 days ago.. happening today.' }, /repeats an earlier beat/],
  ['66: payoff drifts into goals', { payoff: "Custom microcrete shower walls, done. The goal has always been fully furnished bedrooms. That's what I'm building toward." }, /drifts into the goal/],
  ['future scene in payoff', { payoff: "Walls done today. On Christmas Day they'll walk in and cry." }, /future scene/],
  ['countdown never said', { risk: "Christmas is my goal. That's the promise.", opening: 'I promised my parents a sanctuary 450 days ago. Let me explain.' }, /countdown/],
  ['CTA never speaks to the viewer', { cta: 'Keep showing up. Next up: bathrooms.' }, /CTA never speaks/],
];
let fail = 0;
for (const [name, over, expect] of cases) {
  const beats = { ...base, ...over }, h = over.opening ? over.opening.split('.')[0] : hook;
  const issues = selfCheck({ hook: h, beats }, story);
  const ok = expect ? issues.some(x => expect.test(x)) : issues.length === 0;
  if (!ok) fail++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  → ' + JSON.stringify(issues)));
}
// 67: lowercase "i" from the creator's typing must come out as "I" (and nothing else changes)
for (const [inp, out] of [
  ["450 days ago, i promised my parents i'd turn a busted cottage.", "450 days ago, I promised my parents I'd turn a busted cottage."],
  ["Messier than i expected.. i'm glad i protected the tiles", "Messier than I expected.. I'm glad I protected the tiles"],
  ["i.e. my iPhone, #diy, @joey", "i.e. my iPhone, #diy, @joey"],
]) { const got = capI(inp), ok = got === out; if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + 'capital I: ' + inp + (ok ? '' : '  → ' + got)); }
console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
