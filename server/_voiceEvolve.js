// Patch AU — Voice DNA that actually evolves. Every new story the creator gives SAM (their own words,
// plus their answers to SAM's questions — never SAM's scripts) is saved as a voice sample, and the
// Voice DNA profile is refined from the most recent samples. Same tables as the Voice Trainer
// (sam_voice_samples, sam_users.voice_profile / voice_version), so the "Voice synced" footer follows.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

// The creator's own words from a Story Engine "moment": the story, then each answer without SAM's question.
function creatorWords(moment) {
  return String(moment || '')
    .replace(/\(The creator added, when SAM asked "[^"]*": ([\s\S]*?)\)(?=\n\n\(The creator added|$)/g, '$1')
    .replace(/\s+\n/g, '\n').trim().slice(0, 4000);
}

async function findUser(email) {
  const e = encodeURIComponent(email);
  for (const q of [`uid=eq.${e}`, `email=eq.${e}`]) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/sam_users?${q}&select=uid,voice_profile,voice_version,sam_context&order=last_seen.desc.nullslast&limit=1`, { headers: H() });
    if (r.ok) { const rows = await r.json(); if (rows && rows[0]) return rows[0]; }
  }
  return null;
}

async function evolveVoice(apiKey, email, moment) {
  if (!apiKey || !email || !SUPABASE_URL || !SERVICE_KEY) return null;
  const sample = creatorWords(moment);
  if (sample.length < 60) return null;
  const who = String(email).toLowerCase();
  // recent samples (newest first); the same story run twice is not a new sample
  let recent = [];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/sam_voice_samples?user_id=eq.${encodeURIComponent(who)}&select=sample_text&order=created_at.desc&limit=12`, { headers: H() });
    if (r.ok) recent = (await r.json()).map(x => x.sample_text || '');
  } catch (_) {}
  const norm = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (recent.some(t => norm(t) === norm(sample))) return null;

  const ins = await fetch(`${SUPABASE_URL}/rest/v1/sam_voice_samples`, {
    method: 'POST', headers: { ...H(), Prefer: 'return=minimal' },
    body: JSON.stringify([{ user_id: who, sample_text: sample, source: 'story' }])
  }).catch(() => null);
  if (!ins || !ins.ok) console.error('[voice-evolve] sample insert failed', ins && ins.status);

  const user = await findUser(who).catch(() => null);
  if (!user || !user.uid) return null;
  const existing = user.voice_profile || '';
  const samples = [sample, ...recent].slice(0, 12);
  const prompt = `You maintain a creator's Voice DNA: a forensic profile of HOW they talk, used so an AI can write scripts that sound exactly like them.
${existing ? `\nCURRENT VOICE DNA:\n${existing}\n` : ''}
THEIR WRITING (newest first — Sample 1 is the story they just told):
${samples.map((s, i) => `Sample ${i + 1}: "${s.slice(0, 1500)}"`).join('\n')}

${existing ? `Evolve the current profile with what Sample 1 shows. Keep traits that still hold. Sharpen a trait when the new writing shows it more precisely, quoting their actual words. Add a trait only if it is clearly new. Remove one only if recent samples clearly disprove it. Most stories reinforce the profile — if nothing meaningfully changes, return it unchanged.` : `Build the profile from these samples.`}
Cover: sentence rhythm, punctuation personality (their real use of .. — ! CAPS), emotional register, actual phrases only they use, energy signature, and THE TELL. Quote their words. Never write generic descriptions like "conversational" or "authentic".

Return ONLY JSON: {"profile":"6-10 numbered traits, one per line: 1. [Trait] — [description quoting their words]. 220 words max.","changed":"One plain sentence on what changed in this update, for the creator to read — or exactly 'No change'."}`;
  let out = null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 900, messages: [{ role: 'user', content: prompt }] })
    });
    if (!r.ok) return null;
    const d = await r.json();
    const raw = (d && d.content && d.content[0] && d.content[0].text) || '';
    const m = raw.match(/\{[\s\S]*\}/); if (!m) return null;
    out = JSON.parse(m[0]);
  } catch (_) { return null; }
  const profile = String((out && out.profile) || '').trim();
  const changed = String((out && out.changed) || '').trim();
  if (!profile || !/^\s*1\./.test(profile)) return null;
  if (/^no change\.?$/i.test(changed) || profile === existing.trim()) return { changed: 'No change', version: user.voice_version || 0 };
  const version = (user.voice_version || 0) + 1;
  const { saveUserProfile } = require('./_supabase');
  await saveUserProfile(user.uid, { voice_profile: profile, sam_context: user.sam_context || null, voice_version: version }).catch(() => null);
  return { changed: changed || 'Refined from your latest story.', version, profile };
}

module.exports = { evolveVoice, creatorWords };
