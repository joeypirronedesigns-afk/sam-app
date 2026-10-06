// api/_platforms.js — Patch AB / AB.1
// One source of truth for per-platform post text. Every platform gets the same shape:
//   caption  = one short, intriguing HOOK line written for that platform (not a retelling of the video)
//   hashtags = 3 hashtags that complement the post
// Limits COUNT hashtags.
//
// YouTube Shorts (Joey, Oct 2026): the upload field is ONE 100-character box holding the title AND the
// hashtags together. The long video description is a separate, optional extra -> `description`.
// Other limits (verified Oct 2026): TikTok caption 4,000 (~80 visible before "more"); Instagram 2,200
// (~125 visible) with a hard max of 5 hashtags since Dec 2025; Facebook 2,200 (~125 visible).
// `target` is the length we aim for: what shows before "more", so the whole hook is seen.

const SPECS = {
  youtube:   { label: 'YouTube Shorts', limit: 100,  target: 100, visible: 100, tags: 3, combined: true,
               descriptionLimit: 5000,
               note: 'The upload box is ONE field of max 100 characters holding the hook line AND the 3 hashtags together (the hashtags count). Keep the hook line to about 65 characters and use SHORT hashtags (all 3 together about 30 characters, e.g. #DIY #HomeReno #Cottage). Optionally add a longer "description" (separate, optional field).' },
  tiktok:    { label: 'TikTok',    limit: 4000, target: 80,  visible: 80,  tags: 3,
               note: 'Only ~80 characters show before "more" — the whole hook must fit there.' },
  instagram: { label: 'Instagram', limit: 2200, target: 125, visible: 125, tags: 3,
               note: 'About 125 characters show before "more" — the whole hook must fit there. Instagram allows at most 5 hashtags.' },
  facebook:  { label: 'Facebook',  limit: 2200, target: 125, visible: 125, tags: 3,
               note: 'About 125 characters show before "See more" — most people never tap it, so the hook must stand alone in that space.' },
  linkedin:  { label: 'LinkedIn',  limit: 3000, target: 210, visible: 210, tags: 3,
               note: 'About 210 characters show before "see more".' },
  x:         { label: 'X',         limit: 280,  target: 240, visible: 280, tags: 2,
               note: 'Hard 280-character limit including hashtags and links (links count as 23).' },
  threads:   { label: 'Threads',   limit: 500,  target: 200, visible: 500, tags: 1,
               note: 'Hard 500-character limit; one topic tag.' }
};

function platformKey(name) {
  const n = String(name || '').toLowerCase();
  if (/youtube|\byt\b|shorts/.test(n)) return 'youtube';
  if (/tik\s*tok/.test(n)) return 'tiktok';
  if (/insta|\big\b|reels?$/.test(n) && !/facebook|\bfb\b/.test(n)) return 'instagram';
  if (/facebook|\bfb\b/.test(n)) return 'facebook';
  if (/linked/.test(n)) return 'linkedin';
  if (/threads/.test(n)) return 'threads';
  if (/twitter|^x\b|\bx \(/.test(n)) return 'x';
  return null;
}

function specFor(name) { const k = platformKey(name); return k ? { key: k, ...SPECS[k] } : null; }

// Prompt text for the platforms the creator picked.
function platformPrompt(names) {
  const list = (Array.isArray(names) ? names : []).map(n => ({ n, s: specFor(n) })).filter(x => x.s);
  if (!list.length) return '';
  return `PLATFORM POSTS — for EACH platform write ONE short, intriguing hook line (the "caption") that makes
someone want to watch — a tease or a tension from the story in the creator's words, NOT a summary or
retelling of the video — plus the number of hashtags listed below (usually 3) that complement it, in the
"hashtags" field, never inside the caption. Write it fresh for that platform's audience.
` + list.map(({ n, s }) =>
    `- ${n}: ${s.combined ? `hook line + hashtags together max ${s.limit} characters` : `hook line about ${s.target} characters (max ${s.limit} incl. hashtags)`}; ${s.tags} hashtag${s.tags === 1 ? '' : 's'}. ${s.note}`
  ).join('\n');
}

const TAG_RE = /(^|\s)#[\p{L}\p{N}_]+/gu;
const len = s => [...String(s || '')].length; // characters, not UTF-16 units (emoji = 1)

function trimToSentence(text, max) {
  const t = String(text || '');
  if (len(t) <= max) return t;
  const cut = [...t].slice(0, max).join('');
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '), cut.lastIndexOf('\n'));
  if (lastStop > max * 0.5) return cut.slice(0, lastStop + 1).trim();
  return trimToWord(t, max);
}

function trimToWord(text, max) {
  const t = String(text || '').trim();
  if (len(t) <= max) return t;
  const cut = [...t].slice(0, Math.max(0, max - 1)).join('');
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.5 ? cut.slice(0, sp) : cut).replace(/[,;:—–-]\s*$/, '').trim() + '…';
}

// Enforced in code: hashtags pulled out of the caption into the field, deduped, exactly `tags` kept;
// caption trimmed so caption + hashtags fit the hard limit (YouTube Shorts: 100 combined). Adds a
// `limits` object the app and PDF use to show "92 / 100 · 3 hashtags".
function enforcePlatforms(parsed) {
  if (!parsed || !Array.isArray(parsed.platform_strategies)) return parsed;
  for (const p of parsed.platform_strategies) {
    if (!p || typeof p !== 'object') continue;
    const s = specFor(p.platform);
    if (!s) continue;
    // AB.1 — older outputs may put the Shorts hook in `title`; it is the post line.
    let caption = String(p.caption || '');
    if (s.key === 'youtube') {
      if (p.title && (!caption || len(caption) > s.limit)) {
        if (caption && !p.description) p.description = caption;
        caption = String(p.title);
      }
      delete p.title;
    }
    const tags = [];
    const add = t => { const k = t.toLowerCase(); if (!tags.some(x => x.toLowerCase() === k)) tags.push(t); };
    (caption.match(TAG_RE) || []).forEach(m => add(m.trim()));
    // Patch AD — a run of hashtags at the END of a line (after the hook text) is the hashtag list, not words:
    // remove it. Only a tag in the middle of a sentence ("my #DIY cottage") becomes a plain word.
    caption = caption.replace(/((?:[ \t]*#[\p{L}\p{N}_]+)+)[ \t]*(?=\n|$)/gu, '').replace(TAG_RE, (m, sp) => sp + m.trim().slice(1));
    caption = caption.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    String(p.hashtags || '').split(/[\s,]+/).filter(t => /^#[\p{L}\p{N}_]+$/u.test(t)).forEach(add);
    let kept = tags.slice(0, s.tags);
    const sep = s.combined ? 1 : 2;              // Shorts: "hook #a #b #c" on one line
    if (s.combined) {
      caption = caption.replace(/\s*\n+\s*/g, ' ').trim();
      // A cut-off hook is worse than one fewer hashtag: drop the longest tag (down to 2) before trimming.
      while (kept.length > 2 && len(caption) + len(kept.join(' ')) + sep > s.limit) {
        const longest = kept.reduce((a, b) => (len(b) > len(a) ? b : a));
        kept = kept.filter(t => t !== longest);
      }
    }
    p.hashtags = kept.join(' ');
    const tagLen = kept.length ? len(p.hashtags) + sep : 0;
    caption = s.combined ? trimToWord(caption.replace(/\.{2,}$/, ''), s.limit - tagLen) : trimToSentence(caption, s.limit - tagLen);
    p.caption = caption;
    if (s.key === 'youtube' && p.description) p.description = trimToSentence(String(p.description).replace(TAG_RE, ' ').replace(/\s{2,}/g, ' ').trim(), s.descriptionLimit);
    p.limits = { platform: s.label, max: s.limit, target: s.target, visible: s.visible, tags: kept.length, wantTags: s.tags,
                 combined: !!s.combined, used: len(caption) + tagLen };
  }
  return parsed;
}

// Text to paste for this platform (Shorts: one line).
function postText(p) {
  const s = specFor(p && p.platform);
  if (!p) return '';
  if (s && s.combined) return [p.caption, p.hashtags].filter(Boolean).join(' ');
  return [p.caption, p.hashtags].filter(Boolean).join('\n\n');
}

module.exports = { SPECS, platformKey, specFor, platformPrompt, enforcePlatforms, postText };
