// api/persona-lab/banned_phrases_v1.js
// Persona Lab v0 — banned phrase list, version 1.
// Per PERSONA_LAB_v0_HANDOFF.md §6.
//
// Inherits the v9.95 isDebugOrMeta() engagement-bait list and extends it with
// the therapy-sludge / generic-uplift / soft-hedge categories that Composer
// output is most likely to drift into. Joey's codex-level banned_phrases are
// merged on top per-request inside the compose endpoint.
//
// Bump BANNED_PHRASES_VERSION whenever this list changes — every output row
// stores the version in its provenance metadata so we can debug regressions.

const BANNED_PHRASES_VERSION = 1;

const BANNED_PHRASES = [
  // Engagement bait (from v9.95 isDebugOrMeta)
  'drop a comment',
  'DM me',
  'save this',
  'share this',
  'glad this resonated',
  'still figuring it out',
  'what part are you curious about',

  // Therapy sludge / generic uplift
  'it almost broke me',
  "that's cap",
  'this is your sign',
  'the universe is telling you',
  'trust the process',
  'everything happens for a reason',
  'your journey is your journey',
  'showing up is half the battle',
  'pour into yourself',
  'protect your peace',
  'do the work',
  'the magic happens outside your comfort zone',

  // Soft hedges that flatten conviction
  'I just want to say',
  'I might be wrong but',
  'not gonna lie',
  'to be honest with you',
  'at the end of the day',
  "if I'm being real"
];

module.exports = { BANNED_PHRASES, BANNED_PHRASES_VERSION };
