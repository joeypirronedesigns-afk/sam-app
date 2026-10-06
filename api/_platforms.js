// api/_platforms.js — Patch AB
// One source of truth for per-platform caption rules. Limits COUNT hashtags (they are part of the
// post). Verified Oct 2026: YouTube Shorts title 100 / description 5,000 (first ~100 visible, up to 3
// description hashtags shown above the title, >60 hashtags = all ignored); TikTok caption 4,000
// (~80 visible); Instagram caption 2,200 (~125 visible) and a hard limit of 5 hashtags since Dec 2025;
// Facebook post/Reels caption 2,200 (~125 visible). Re-check these yearly.

const SPECS = {
  youtube:   { label: 'YouTube',   limit: 5000, visible: 100, titleLimit: 100, minTags: 3, maxTags: 5,
               note: 'Needs a TITLE (max 100 characters including anything in it — use no hashtags in the title; first ~50 show in feeds) and a DESCRIPTION (the caption; first ~100 characters show above the fold). Hashtags go at the end of the description; YouTube shows up to 3 above the title.' },
  tiktok:    { label: 'TikTok',    limit: 4000, visible: 80,  minTags: 3, maxTags: 5,
               note: 'Only the first ~80 characters show before "more" — the hook must land there.' },
  instagram: { label: 'Instagram', limit: 2200, visible: 125, minTags: 3, maxTags: 5,
               note: 'Instagram allows at most 5 hashtags per post. First ~125 characters show before "more".' },
  facebook:  { label: 'Facebook',  limit: 2200, visible: 125, minTags: 2, maxTags: 5,
               note: 'First ~125 characters show before "See more" — most people never tap it, so the opening line must stand alone.' },
  linkedin:  { label: 'LinkedIn',  limit: 3000, visible: 210, minTags: 3, maxTags: 5,
               note: 'First ~210 characters show before "see more". Professional but personal.' },
  x:         { label: 'X',         limit: 280,  visible: 280, minTags: 0, maxTags: 2,
               note: 'Hard 280-character limit including hashtags and links (links count as 23).' },
  threads:   { label: 'Threads',   limit: 500,  visible: 500, minTags: 0, maxTags: 1,
               note: 'Hard 500-character limit; one topic tag at most.' }
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
  return 'PLATFORM SPECS (follow exactly — character limits INCLUDE hashtags):\n' + list.map(({ n, s }) =>
    `- ${n}: max ${s.limit} characters for caption + hashtags; ${s.minTags}-${s.maxTags} hashtags in the "hashtags" field (none inside the caption); ${s.note}`
  ).join('\n');
}

const TAG_RE = /(^|\s)#[\p{L}\p{N}_]+/gu;
const len = s => [...String(s || '')].length; // count characters, not UTF-16 units (emoji = 1)

function trimToSentence(text, max) {
  const t = String(text || '');
  if (len(t) <= max) return t;
  const cut = [...t].slice(0, max).join('');
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '), cut.lastIndexOf('\n'));
  if (lastStop > max * 0.5) return cut.slice(0, lastStop + 1).trim();
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[,;:—–-]\s*$/, '').trim() + '…';
}

function trimToWord(text, max) {
  const t = String(text || '').trim();
  if (len(t) <= max) return t;
  const cut = [...t].slice(0, max).join('');
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[,;:—–-]\s*$/, '').trim();
}

// Enforce limits in code: hashtags moved out of the caption into the hashtags field, capped per
// platform, deduped; caption + hashtags trimmed to the limit at a sentence boundary; YouTube gets a
// hashtag-free title of at most 100 characters (falls back to the hook). Adds a `limits` object
// the app and PDF use to show "412 / 2,200".
function enforcePlatforms(parsed) {
  if (!parsed || !Array.isArray(parsed.platform_strategies)) return parsed;
  for (const p of parsed.platform_strategies) {
    if (!p || typeof p !== 'object') continue;
    const s = specFor(p.platform);
    if (!s) continue;
    let caption = String(p.caption || '');
    const tags = [];
    const add = t => { const k = t.toLowerCase(); if (!tags.some(x => x.toLowerCase() === k)) tags.push(t); };
    (caption.match(TAG_RE) || []).forEach(m => add(m.trim()));
    // keep hashtags that sit mid-sentence as plain words (#FromStudsToSanctuary -> FromStudsToSanctuary)
    caption = caption.replace(/(^|\n)((?:\s*#[\p{L}\p{N}_]+)+)\s*(?=\n|$)/gu, '$1').replace(TAG_RE, (m, sp) => sp + m.trim().slice(1));
    caption = caption.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    String(p.hashtags || '').split(/[\s,]+/).filter(t => /^#[\p{L}\p{N}_]+$/u.test(t)).forEach(add);
    const kept = tags.slice(0, s.maxTags);
    p.hashtags = kept.join(' ');
    const tagLen = kept.length ? len(p.hashtags) + 2 : 0;
    caption = trimToSentence(caption, s.limit - tagLen);
    p.caption = caption;
    if (s.key === 'youtube') {
      const rawTitle = String(p.title || parsed.hook || '').replace(TAG_RE, '').replace(/\s{2,}/g, ' ').trim();
      p.title = trimToWord(rawTitle, s.titleLimit);
    }
    p.limits = {
      platform: s.label, max: s.limit, visible: s.visible, maxTags: s.maxTags,
      used: len(caption) + tagLen, tags: kept.length,
      ...(s.key === 'youtube' ? { titleMax: s.titleLimit, titleUsed: len(p.title) } : {})
    };
  }
  return parsed;
}

module.exports = { SPECS, platformKey, specFor, platformPrompt, enforcePlatforms };
