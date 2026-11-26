// Patch AR — SAM's notebook: short facts the creator told SAM (people, pets, places, plans,
// preferences). Stored per account in KV (`notebook:<email>`), visible and deletable in the app.
// Filled two ways: the creator types a note, or SAM notes a fact they stated in chat.
const MAX_NOTES = 80, MAX_LEN = 200;

async function getKV() {
  try { const { kv } = require('@vercel/kv'); return kv; } catch (_) { return null; }
}
const keyFor = email => 'notebook:' + String(email || '').trim().toLowerCase();
const cleanText = t => String(t || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function getNotes(email) {
  if (!email) return [];
  const kv = await getKV(); if (!kv) return [];
  let v = await kv.get(keyFor(email)).catch(() => null);
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) { v = null; } }
  return Array.isArray(v) ? v.filter(n => n && n.id && n.text) : [];
}
async function saveNotes(email, notes) {
  const kv = await getKV(); if (!kv || !email) return false;
  await kv.set(keyFor(email), JSON.stringify(notes.slice(-MAX_NOTES)));
  return true;
}
async function addNote(email, text, src) {
  const t = cleanText(text); if (!t) return null;
  const notes = await getNotes(email);
  const norm = x => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (notes.some(n => norm(n.text) === norm(t))) return null;
  const note = { id: newId(), text: t, src: src === 'chat' ? 'chat' : 'you', at: new Date().toISOString() };
  notes.push(note); await saveNotes(email, notes);
  return note;
}
async function deleteNote(email, id) {
  const notes = await getNotes(email);
  const kept = notes.filter(n => n.id !== id);
  if (kept.length !== notes.length) await saveNotes(email, kept);
  return notes.length - kept.length;
}

// What SAM reads. For the Story Engine it is background only.
function notebookPrompt(notes, forScripts) {
  if (!notes || !notes.length) return '';
  const list = notes.map(n => '- ' + n.text).join('\n');
  return forScripts
    ? `\n\nCREATOR NOTEBOOK (background only — so you understand who this creator is. Never put these facts in the script, hook, captions or guide unless the story itself mentions them):\n${list}`
    : `\n\nSAM'S NOTEBOOK — facts this creator told you (they can see and edit this list in the app):\n${list}`;
}

// One cheap pass over the creator's latest chat message: what did they state that's worth keeping,
// and did they ask SAM to forget something already in the notebook?
async function extractNotes(apiKey, userText, notes) {
  const text = String(userText || '').trim();
  if (!apiKey || text.length < 8 || text.length > 4000) return { add: [], forget: [] };
  const existing = (notes || []).map(n => `${n.id}: ${n.text}`).join('\n') || '(empty)';
  const system = `You keep a notebook of durable facts a content creator states about themselves and their life, so their AI content strategist knows them over time.
Return ONLY JSON: {"add":["fact", ...],"forget":["id", ...]}
ADD only facts the creator plainly STATED in this message that will still be true in a month: people and their names/relationships, pets, where they live or are moving, their projects, background, goals, preferences for how they want help. Write each as one short third-person line ("Wife's name is Amanda."). Skip anything already in the notebook, questions, guesses, opinions about the AI, one-off tasks, and anything sensitive (health, money amounts, passwords, account numbers). If they say "remember X", add X.
FORGET: ids of notebook lines the creator says are wrong, outdated, or asks to forget.
Most messages have nothing to add: return {"add":[],"forget":[]}.
NOTEBOOK:
${existing}`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, system, messages: [{ role: 'user', content: text }] })
    });
    if (!r.ok) return { add: [], forget: [] };
    const d = await r.json();
    const raw = (d && d.content && d.content[0] && d.content[0].text) || '';
    const m = raw.match(/\{[\s\S]*\}/); if (!m) return { add: [], forget: [] };
    const j = JSON.parse(m[0]);
    const ids = new Set((notes || []).map(n => n.id));
    return {
      add: (Array.isArray(j.add) ? j.add : []).map(cleanText).filter(Boolean).slice(0, 5),
      forget: (Array.isArray(j.forget) ? j.forget : []).map(String).filter(id => ids.has(id))
    };
  } catch (_) { return { add: [], forget: [] }; }
}

// Apply an extraction; returns what changed so the chat can say "Noted: …".
async function applyExtraction(email, ex) {
  const out = { noted: [], forgot: [] };
  if (!email || !ex) return out;
  let notes = await getNotes(email);
  if (ex.forget.length) {
    out.forgot = notes.filter(n => ex.forget.includes(n.id)).map(n => n.text);
    notes = notes.filter(n => !ex.forget.includes(n.id));
  }
  const norm = x => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  for (const t of ex.add) {
    if (notes.some(n => norm(n.text) === norm(t))) continue;
    notes.push({ id: newId(), text: t, src: 'chat', at: new Date().toISOString() });
    out.noted.push(t);
  }
  if (out.noted.length || out.forgot.length) await saveNotes(email, notes);
  return out;
}

module.exports = { getNotes, addNote, deleteNote, notebookPrompt, extractNotes, applyExtraction };
