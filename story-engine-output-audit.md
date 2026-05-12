# Story Engine Output Audit

**Scope:** locate where the Full Script / narration softens late-stage beats (Risk → Turn → Payoff) relative to the Story Architecture cards. Read-only trace, no edits, no patches, no framework recommendations.

**Repo:** `/Users/giuseppepirrone/Desktop/sam-app/` · branch `quietstudio` · audit performed 2026-05-10.

---

## 1. Story Architecture generation

**Where:** server-side. There is no separate architecture endpoint — architecture is one field inside a single composite playbook generation.

**File:line:** `api/sam.js:533–619` (the `mode === 'playbook'` branch).
**Handler/function:** anonymous handler in `module.exports = async function handler(req, res)` (top of `api/sam.js`). Inside that handler, the `playbookPrompt` template literal is built at `api/sam.js:553–612` and passed to `streamCall(playbookPrompt, playbookUserContent, 12000)` at `api/sam.js:618`.

**Model:** `claude-sonnet-4-6` (hardcoded inside `streamCall` at `api/sam.js:481`).
**max_tokens:** `12000` (passed as third arg at `api/sam.js:618`).
**Other inference params:** `stream: true`, no `temperature` set (defaults to Anthropic's 1.0). Single user message.

**System prompt fragments — sources (api/sam.js):**

- `samIdentity` (L473): `"You are S.A.M. — Strategic Assistant for Making. You are an AI content strategist that helps creators write better scripts, hooks, captions, strategies and content plans."`
- `toneContext` (L442) → looked up from `toneMap` based on `tone` body param. For default `'Authentic/Natural'`: `"Write in an authentic, real, conversational tone — like a real person talking, not a marketer."`
- `emojiLine` (L445) → looked up from `emojiMap`. For default `'few'`: `"Use 1-2 emojis maximum, only where they add genuine meaning."`
- `creatorLine` (L446–448) → if `creatorContext` present: `"CREATOR CONTEXT: ${creatorContext} — Use this to make every output specific to this creator's story, niche, audience and voice. Never write generic content when you have this context."` Otherwise the no-context fallback.
- `demographicsLine` (L449–451) → if `audienceDemographics` present: `"AUDIENCE DEMOGRAPHICS: ${audienceDemographics}. Tailor vocabulary, cultural references, humour, hook style, caption length and platform recommendations specifically for this demographic."`
- `languageLine` (L452) → if `outputLanguage` present: `"Write the ENTIRE output in ${outputLanguage}. JSON field names stay in English."`
- `scriptStyle` (L540–545) → keyed by `delivery`. For `camera` (default): `"Write a punchy, conversational on-camera script. Direct, personal, natural rhythm."` Other values: `narration`, `text`, `mix` — each a one-line instruction string.
- `paceNote` (L547–551) → keyed by `pace`. For `natural` (default): `"Speaker pace: natural. Script should breathe. 75-90 seconds."`

**Final assembled system prompt (exactly as sent to the model — `api/sam.js:553–612`):**

```
${samIdentity} ${toneContext} ${emojiLine} ${creatorLine} ${demographicsLine} ${languageLine}

WIZARD CONTEXT:
${wizContext}

SCRIPT STYLE: ${scriptStyle}
${paceNote}

Return ONLY this JSON — be CONCISE in every field to fit within token limits:

{
  "diagnosis": "2 sentences max.",
  "story_architecture": {
    "opening": "8 words max",
    "setup": "8 words max",
    "risk": "8 words max",
    "turn": "8 words max",
    "payoff": "8 words max",
    "cta": "8 words max"
  },
  "hook": "Under 15 words. Creates an open loop.",
  "hook_why": "One sentence.",
  "full_script": "Complete script — 200 words max. Use [BEAT] labels.",
  "narration_script": "If narration delivery — 200 word version. Otherwise null.",
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
  "audience_profile": { ...8 fields, each ≤2 sentences... },
  "lead_magnet": { "title", "why", "items": [5 items], "comment_response" },
  "focus_directive": "One sentence. The single most important thing to do today."
}

CRITICAL: Return ONLY valid JSON. Keep ALL fields concise — the JSON must be complete and valid.
```

**User-message content (`api/sam.js:615–617`):** the value of `moment` (the user's story text, taken from `req.body.moment`). If a wizard photo is attached (`imageBase64`), it's prepended as an `{ type: 'image', source: {...} }` block followed by a `{ type: 'text', text: moment }` block.

**Output JSON shape:** the entire `story_architecture` object with six fields — `opening`, `setup`, `risk`, `turn`, `payoff`, `cta` — each constrained in-prompt to "8 words max." This is one of ~10 sibling top-level fields (diagnosis, story_architecture, hook, hook_why, full_script, narration_script, pacing_note, b_roll, platform_strategies, audience_profile, lead_magnet, focus_directive).

---

## 2. Full Script / narration generation

**Where:** **same call as architecture.** No separate endpoint, no separate prompt, no separate model invocation. `full_script` and `narration_script` are sibling JSON fields in the single playbook envelope generated at `api/sam.js:618`.

**File:line:** `api/sam.js:575–576` (the schema fragment that defines the script's instruction):

```
"full_script": "Complete script — 200 words max. Use [BEAT] labels.",
"narration_script": "If narration delivery — 200 word version. Otherwise null.",
```

**Model:** `claude-sonnet-4-6`.
**max_tokens:** `12000` (shared budget for the whole playbook envelope — script, architecture, hook, audience profile, lead magnet, etc., all share this).
**Other params:** identical to §1 (it's the same Claude call).

**System prompt:** identical to the assembled prompt in §1. The script's only dedicated instruction is the single line `"full_script": "Complete script — 200 words max. Use [BEAT] labels."` inside the JSON schema. There is no separate "script generation system prompt" — the model is told to produce the whole envelope in one shot with each field constrained by its own short string description.

**Note on alternate path — script regen.** When the user clicks "↺ Redo" on the script section of the rendered playbook, a separate `mode === 'regen_section'` request fires with `section: 'script'`. That handler (api/sam.js:643–647) uses a different, fresh prompt:

```
Rewrite ONLY the full script for this creator's story.
Delivery style: ${delivery}. Pace: ${pace}.
${steer ? 'CREATOR DIRECTION: ' + steer : ''}
Format script lines as plain text. Use [BEAT] for pause markers. Use (note) for delivery notes.
Return ONLY: {"full_script":"the complete script","pacing_note":"one delivery tip"}
```

That's the entire regen-script prompt. Critically, it does **not** receive the architecture beats as context. See §3.

**Is this a separate API call from architecture generation, or part of one combined generation step?** **Combined.** Initial generation is one call producing both. Regen path is decoupled (architecture regen and script regen are separate calls that do not reference each other).

---

## 3. Handoff between architecture and script

**Initial generation:** there is no handoff. Architecture and script are co-generated as siblings in a single JSON object from one model call. The model receives the full playbookPrompt + the user's moment, and emits all fields together. The script is not "given" the architecture — they emerge from the same generation, in whatever order the model writes them. Nothing in the prompt instructs the model to write architecture first and then derive the script from it, nor to keep the script's beats parallel to the architecture's beats.

**Regen path:** when the user regenerates the architecture or the script independently:

- **Architecture regen** (`section: 'architecture'`, prompt at api/sam.js:636–637) emits a fresh 6-beat object. The new architecture replaces the old; **the script is not regenerated and is not informed**.
- **Script regen** (`section: 'script'`, prompt at api/sam.js:643–647) emits a fresh script. **The architecture beats are not passed forward** — the script regen request body (built on the frontend) carries `wizardContext`, `delivery`, `pace`, `steer`, `platforms` but **not** `story_architecture`. The model regenerating the script has no view of the six beats currently on screen above the script.

**Exact fields passed forward in the regen body** (frontend, app.html — `regenSection` builds the request): `mode: 'regen_section'`, `section`, `sectionLabel`, `wizardContext: context` (the same context blob built in §1's caller), `steer` (optional user-typed direction), `delivery`, `pace`, `platforms`. **No `story_architecture` field, no `full_script` field**. So neither regen path closes the loop with the other side of the playbook.

The initial generation handoff question is moot because there's no handoff — but the regen handoff is a structural gap.

---

## 4. Transformation / normalization layer

**Between architecture and script in initial generation:** none. They are co-generated in one model call. No code inspects, paraphrases, or remaps the architecture before the script is written.

**Between server response and frontend display:** none. The frontend's `renderPlaybook(data)` at `app.html:16577` reads `data.story_architecture.{opening, setup, risk, turn, payoff, cta}` and emits each beat into a `<div class="playbook-arch-card">` verbatim (app.html:16622–16627). The script is read as `data.full_script` (and as `data.narration_script` in some paths) and rendered as plain text. No reformatting, no paraphrasing, no summarization in the renderer.

**Between server response and PDF render:** none. `api/pdf.js:597–605` reads `pb.story_architecture.{opening,setup,risk,turn,payoff,cta}` directly into a `beats` array and emits each into a `<div class="arch-card">` (api/pdf.js:608–612). The script is read as `pb.full_script || pb.narration_script` (api/pdf.js:638) and emitted as a `<p class="body-copy">${e(script)}</p>` (HTML-escaped). No transformation.

**Between regen response and frontend display:** the regen handler swaps the new fields into the existing `data` object and re-renders the affected section only. No transformation; the new architecture / new script replaces the old verbatim.

**Conclusion:** there is no transformation layer anywhere on the path from model output → screen → PDF. The output the user sees is exactly what the model emitted (modulo HTML escape). Any softening of late-stage beats happened during model generation, not during rendering.

---

## 5. Voice DNA injection point

**Critical finding: the playbook prompt does NOT inject Voice DNA.**

The Voice DNA injection is built as a top-level fragment `voiceLine` at `api/sam.js:455–471` (full block below for verbatim reference). It is included in the **`base`** prompt at `api/sam.js:475`:

```js
const base = `${samIdentity} ${toneContext} ${emojiLine} ${hashtagRule} ${creatorLine} ${voiceLine} ${demographicsLine} ${languageLine} ${platformContext} ${formatContext} CRITICAL: Respond ONLY with valid JSON. ...`;
```

This `base` is the prompt used by The Pulse (api/sam.js:836), The Vision (api/sam.js:818-via-prompt), and other tools.

The **playbook prompt** at `api/sam.js:553` is constructed independently:

```js
const playbookPrompt = `${samIdentity} ${toneContext} ${emojiLine} ${creatorLine} ${demographicsLine} ${languageLine}

WIZARD CONTEXT: ...
```

`${voiceLine}` is **not in the list**. Neither is `${hashtagRule}`, `${platformContext}`, or `${formatContext}` — but the absence of `voiceLine` is the load-bearing one for this audit. The playbook generation runs without the forensic voice fingerprint that other tools receive.

**Verbatim `voiceLine` content (the block that's missing from playbook):**

```
VOICE PROFILE — THIS IS THE MOST IMPORTANT INSTRUCTION: You have a forensic voice fingerprint built from this creator's ACTUAL writing samples. Real analysis: ${voiceProfile}

You must ghost-write AS this person — not inspired by them, not in their general direction, but AS them. Apply their voice at the sentence level on every single line of output.

To do this correctly:
- Match their sentence rhythm exactly — if they punch short, you punch short. If they breathe long, you breathe long.
- Use their punctuation personality — their dashes, their ellipses, their caps, their lack of caps
- Use their actual words and phrases — not synonyms, not upgrades, their words
- Mirror their energy signature — if they're dry, stay dry. If they're hype, stay hype. Never drift toward generic AI polish.
- Apply their dialect and filler patterns naturally — don't force it, but don't sanitize it either
- Honor their "tell" — that one unmistakable move that is only them

The test: if you showed this output to the creator and they read it out loud, it should feel like reading their own journal — not a press release about them.

NEVER write in generic AI voice when you have this profile. Generic AI voice is: smooth, balanced, professionally warm, slightly motivational, uses words like "journey", "authentic", "powerful story", "resonate". That is the enemy. Write like the human, not the algorithm.
```

**Where Voice DNA does enter the request body:** the frontend `payload` at `app.html:16354–16376` includes most playbook params but does **not** include `voiceProfile`. The server's `voiceProfile` variable (referenced at L455) reads from `req.body.voiceProfile`. So the value the playbook handler sees is whatever the client sent. Reading the frontend payload, **`voiceProfile` is not sent for playbook generation either** — making the absence two-layer: the prompt doesn't ask for it and the request body doesn't carry it.

**Other tools' voice injection paths for comparison** (so the diff is concrete):

- **The Pulse** (`runToolInline` at `app.html:13386`): the payload at L13409 explicitly includes `voiceProfile: voiceProfile` (read from `getSamVoiceProfile()` at L13391). The server's pulse path uses `base` which contains `voiceLine`. Voice DNA flows end-to-end.
- **Persistent chat** (`sendPersistentMessage` at `app.html:13037`): voice profile is double-injected — once in the frontend persistent prompt (`getSAMPersistentPrompt` at app.html:12714, sliced to 800 chars) and once on the server append (`api/sam.js:292`).

The playbook (Story Engine) is the only major content-generation tool that runs without Voice DNA in either the request body or the system prompt.

**Position relative to structural instructions:** moot for playbook (not present). For tools that do receive it (Pulse, Vision, etc.), `voiceLine` is positioned **before** the JSON schema and structural directives in the `base` prompt — i.e., voice instruction precedes structure instruction.

---

## 6. PDF / export rendering

**Where:** `api/pdf.js`. The `module.exports = async function handler(req, res)` at the top of the file reads `playbookData` from the POST body, hands it to `buildPlaybookHTML(pb, brand)` (the playbook HTML composer, `api/pdf.js:553+`), then renders that HTML to PDF via Puppeteer + `@sparticuz/chromium`.

**Architecture render** (api/pdf.js:597–622):

```js
const arch = pb.story_architecture || {};
const beats = [
  { label: 'Opening',  timing: '0–3s',    content: arch.opening },
  { label: 'Setup',    timing: '3–15s',   content: arch.setup   },
  { label: 'Risk',     timing: '15–30s',  content: arch.risk    },
  { label: 'Turn',     timing: '30–50s',  content: arch.turn    },
  { label: 'Payoff',   timing: '50–70s',  content: arch.payoff  },
  { label: 'CTA',      timing: 'Final 5s',content: arch.cta     },
].filter(b => b.content);

if (beats.length) {
  const beatCards = beats.map(b => `<div class="arch-card">
    <div class="arch-beat">${e(b.label)}</div>
    <div class="arch-timing">${e(b.timing)}</div>
    <div class="arch-content">${e(b.content)}</div>
  </div>`).join('');
  // ...wrapped in a section page
}
```

The PDF labels and timings are **hardcoded in pdf.js** (Opening/0–3s, Setup/3–15s, Risk/15–30s, Turn/30–50s, Payoff/50–70s, CTA/Final 5s). The model only emits the beat *contents* — not the labels or timings. Same labels and timings appear in the UI render (`app.html:16622–16627`) and in the regen-architecture prompt instructions (`api/sam.js:637`).

**Script render** (api/pdf.js:638–649):

```js
const script = pb.full_script || pb.narration_script;
if (script) {
  pages.push(`<div class="pdf-page pdf-page--interior">
    ${hdr(brandName, docType, '05')}
    <div class="section-body">
      ${sLabel('Full Script')}
      <p class="body-copy">${e(script)}</p>
      ${pb.pacing_note ? callout('Pacing: ' + pb.pacing_note) : ''}
    </div>
    ${ftr(brandName)}
  </div>`);
}
```

`e(script)` is HTML-escape only. No paraphrasing, no reformatting, no second derivation. The PDF prints what `pb.full_script` (or `pb.narration_script`) literally contains.

**Does export print the exact same fields the UI displays?** **Yes for architecture and script.** UI reads `data.story_architecture.{opening,...}` verbatim; PDF reads `pb.story_architecture.{opening,...}` verbatim. UI reads `data.full_script` (or `narration_script`); PDF reads the same. No second derivation.

The audience profile and lead magnet sections (api/pdf.js:669+) similarly read straight from the same fields. The PDF is a faithful render of the model output — no opportunity for softening to occur in the export step.

---

## 7. Per-beat fidelity in the script prompt

**The full script's only instruction in the playbook prompt is:**

```
"full_script": "Complete script — 200 words max. Use [BEAT] labels."
```

That's the entirety of the per-beat fidelity guidance. There is **no instruction** that:

- The script must include all six architecture beats — Opening, Setup, Risk, Turn, Payoff, CTA — in order.
- Each beat must be visibly distinct (e.g., the `[BEAT]` label is mentioned but the prompt does not enumerate which beats the model should label, nor that every beat must appear).
- The script's beats must mirror the contents of the architecture cards (no instruction tying script content to `story_architecture` content).
- Late-stage beats (Risk/Turn/Payoff) must carry the same causal weight in the script that they do in the architecture.
- The model should preserve the architecture's narrative tension structure across the script.

**The narration variant's only instruction is:**

```
"narration_script": "If narration delivery — 200 word version. Otherwise null."
```

Even looser. No mention of beats at all in the narration field's instruction.

**The wizard context (api/sam.js:556 / app.html:16325–16342)** carries this top-level structural ask:

```
IMPORTANT — Write the FULL narration/script based on delivery style.
Write the COMPLETE audience resource document (lead magnet) in full —
not an outline, a real finished document the creator can give their audience.
Include complete reasoning (WHY) for every recommendation.
```

This pushes for completeness in the lead magnet but does not address script-to-architecture beat fidelity.

**The script regen prompt** (api/sam.js:643–647):

```
Rewrite ONLY the full script for this creator's story.
Delivery style: ${delivery}. Pace: ${pace}.
${steer ? 'CREATOR DIRECTION: ' + steer : ''}
Format script lines as plain text. Use [BEAT] for pause markers. Use (note) for delivery notes.
Return ONLY: {"full_script":"the complete script","pacing_note":"one delivery tip"}
```

`[BEAT]` here is described as a "pause marker" — not a structural beat label. This is loose language. There is no instruction to preserve the six architecture beats. The architecture itself is not even passed forward to this regen call (see §3), so even if the prompt asked for beat fidelity, the model would have no reference.

**Conclusion:** the script's instruction language is loose ("Complete script — 200 words max. Use [BEAT] labels.") rather than per-beat structured. The architecture's instruction language is rigid ("opening: 8 words max", "risk: 8 words max", "turn: 8 words max", etc., as named JSON keys with hard caps). The asymmetry between rigid architecture and loose script is a likely contributor to the symptom Joey reported — the architecture stays sharp because it's structurally enforced, the script paraphrases because it isn't.

---

## Diagnosis

The beat-fidelity gap most likely lives at the **intersection of three structural conditions in the script prompt**, not in any single layer downstream:

1. **The script prompt is loose.** The only per-beat instruction in initial generation is `"full_script": "Complete script — 200 words max. Use [BEAT] labels."` This does not require all six architecture beats to appear, in order, with each visibly distinct and tied to the corresponding architecture card. The architecture, by contrast, is structurally enforced via named JSON keys with explicit timing brackets in the prompt schema — which is why Joey sees the architecture cards stay sharp while the script softens.
2. **Voice DNA is not injected into the playbook prompt.** Of all major content-generation tools (Pulse, Vision, persistent chat), Story Engine is the only one whose prompt omits `voiceLine` and whose request body does not send `voiceProfile`. Without the forensic-fingerprint anchor, the model defaults toward smoother, more generic narrative prose — the exact "AI polish" the voiceLine block exists to prevent. Late-stage beats (Risk → Turn → Payoff) carry the most emotional load and are therefore the first to drift into generic patterns when the voice anchor is absent.
3. **The architecture and script are co-generated in one shot with no enforced cross-reference.** Nothing in the prompt tells the model to write architecture first and derive the script from it, nor to keep the script's six beats parallel to the architecture's six beats. They emerge as siblings in one JSON envelope, and the model is free to compress or paraphrase the script's late-stage beats while keeping the architecture's beats labeled and intact. The regen path widens this gap further: architecture regen and script regen are independent calls that do not exchange context, so a user-driven regen of the script has no view of the architecture above it.

The PDF and UI render layers are eliminated as causes — both are faithful, transformation-free passes from `pb.story_architecture.*` and `pb.full_script` to display. The softening happens during model generation, primarily inside the script field of the single playbook generation call, driven by (1) loose script instructions, (2) absent voice anchor, and (3) no enforced beat-to-beat consistency between architecture and script.

---

*End of audit.*
