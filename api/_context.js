// api/_context.js
// SAM Brain v2 — single source of truth for all context operations
// Functions: normalizeSamContext, mapWizardToSchemaV2, buildBrainPrompt, loadUserContext, saveUserContext

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function emptySchema() {
  return {
    schemaVersion: 2,
    lastUpdatedAt: new Date().toISOString(),
    identity: { name: null, handle: null, location: null, selfStory: null, worldview: null, values: null, creatorType: null },
    brand: { niche: null, offer: null, audience: null, transformation: null, platforms: [], differentiator: null },
    voice: { profile: null, version: 0, diction: null, syntax: null, tone: null, persona: null, punctuation: null, platformAdaptations: {} },
    behavioral: { workflowStyle: null, completionRate: null, decisionStyle: null, frictionPoints: [], momentumTriggers: [] },
    emotional: { confidenceLevel: null, fearPoints: [], burnoutMarkers: [], excitementCues: [], currentState: null },
    creative: { taste: null, signatureIdeas: [], contentWins: [], obsessions: [], avoidances: [] },
    execution: { currentStep: 0, activeProjects: [], unfinishedLoops: [], nextAction: null, weeklyGoal: null },
    analytics: { insights: [], latestAt: null },
    platforms: {}
  };
}

const PLATFORM_DEFAULTS = {
  'TikTok':    { style: 'short-form video', tone: 'casual, fast, hook-first', maxLength: 150 },
  'YouTube':   { style: 'long-form video', tone: 'story-driven, educational', maxLength: 500 },
  'Instagram': { style: 'visual + caption', tone: 'personal, visual, community', maxLength: 300 },
  'Facebook':  { style: 'community post', tone: 'conversational, longer-form', maxLength: 400 },
  'LinkedIn':  { style: 'professional post', tone: 'insight-driven, credibility', maxLength: 600 },
  'Pinterest': { style: 'visual discovery', tone: 'aspirational, searchable', maxLength: 200 },
  'X':         { style: 'short take', tone: 'punchy, direct, opinionated', maxLength: 280 }
};

function normalizeSamContext(raw) {
  if (!raw) return emptySchema();
  let parsed;
  try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch(e) { return emptySchema(); }

  if (parsed.schemaVersion === 2) {
    parsed.lastUpdatedAt = parsed.lastUpdatedAt || new Date().toISOString();
    if (!parsed.analytics) parsed.analytics = { insights: [], latestAt: null };
    return parsed;
  }

  const schema = emptySchema();
  schema.migratedFrom = 'legacy-wizard';

  if (parsed.analytics && Array.isArray(parsed.analytics.insights)) {
    schema.analytics = {
      insights: parsed.analytics.insights,
      latestAt: parsed.analytics.latestAt || new Date().toISOString()
    };
  }

  schema.identity.name = parsed.brandName || null;
  schema.identity.handle = parsed.brandHandle || null;
  schema.identity.creatorType = parsed.creatorType || null;
  schema.identity.selfStory = parsed.storyText || null;

  schema.brand.niche = parsed.diagnosedAudience || null;
  schema.brand.audience = parsed.audienceCustom || parsed.audienceConfirm || null;
  schema.brand.platforms = Array.isArray(parsed.platforms) ? parsed.platforms : [];
  schema.brand.differentiator = parsed.diagnosedStory || null;

  schema.voice.profile = parsed.voiceProfile || null;
  schema.execution.currentStep = parseInt(parsed._currentStep || '0');

  if (schema.brand.platforms.length) {
    schema.brand.platforms.forEach(p => {
      schema.platforms[p] = PLATFORM_DEFAULTS[p] || { style: 'social post', tone: 'creator voice', maxLength: 300 };
    });
  }

  return schema;
}

function mapWizardToSchemaV2(wizardContext, existingCtx) {
  const schema = existingCtx && existingCtx.schemaVersion === 2
    ? JSON.parse(JSON.stringify(existingCtx))
    : normalizeSamContext(existingCtx);

  schema.lastUpdatedAt = new Date().toISOString();

  if (wizardContext.brandName) schema.identity.name = wizardContext.brandName;
  if (wizardContext.brandHandle) schema.identity.handle = wizardContext.brandHandle;
  if (wizardContext.creatorType) schema.identity.creatorType = wizardContext.creatorType;
  if (wizardContext.storyText) schema.identity.selfStory = wizardContext.storyText;

  if (wizardContext.diagnosedAudience) schema.brand.niche = wizardContext.diagnosedAudience;
  if (wizardContext.audienceCustom || wizardContext.audienceConfirm) {
    schema.brand.audience = wizardContext.audienceCustom || wizardContext.audienceConfirm;
  }
  if (Array.isArray(wizardContext.platforms) && wizardContext.platforms.length) {
    schema.brand.platforms = wizardContext.platforms;
    schema.brand.platforms.forEach(p => {
      if (!schema.platforms[p]) {
        schema.platforms[p] = PLATFORM_DEFAULTS[p] || { style: 'social post', tone: 'creator voice', maxLength: 300 };
      }
    });
  }
  if (wizardContext.diagnosedStory) schema.brand.differentiator = wizardContext.diagnosedStory;
  if (wizardContext._currentStep) schema.execution.currentStep = parseInt(wizardContext._currentStep);
  if (wizardContext.pace) schema.behavioral.workflowStyle = wizardContext.pace === 'fast' ? 'fast iteration' : 'steady builder';

  return schema;
}

function buildBrainPrompt(ctx) {
  if (!ctx) return '';
  const parts = [];

  const id = ctx.identity || {};
  if (id.name) parts.push('Name: ' + id.name);
  if (id.creatorType) parts.push('Creator type: ' + id.creatorType);
  if (id.selfStory) parts.push('Their story: ' + id.selfStory.slice(0, 300));
  if (id.worldview) parts.push('Worldview: ' + id.worldview);

  const br = ctx.brand || {};
  if (br.niche) parts.push('Niche: ' + br.niche);
  if (br.audience) parts.push('Audience: ' + br.audience);
  if (br.platforms && br.platforms.length) parts.push('Platforms: ' + br.platforms.join(', '));
  if (br.differentiator) parts.push('Differentiator: ' + br.differentiator);

  const beh = ctx.behavioral || {};
  if (beh.workflowStyle) parts.push('Workflow: ' + beh.workflowStyle);
  if (beh.frictionPoints && beh.frictionPoints.length) parts.push('Friction points: ' + beh.frictionPoints.join(', '));
  if (beh.momentumTriggers && beh.momentumTriggers.length) parts.push('Momentum triggers: ' + beh.momentumTriggers.join(', '));

  const em = ctx.emotional || {};
  if (em.currentState) parts.push('Current state: ' + em.currentState);
  if (em.fearPoints && em.fearPoints.length) parts.push('Fear points: ' + em.fearPoints.join(', '));

  const cr = ctx.creative || {};
  if (cr.obsessions && cr.obsessions.length) parts.push('Obsessions: ' + cr.obsessions.join(', '));
  if (cr.contentWins && cr.contentWins.length) parts.push('Content wins: ' + cr.contentWins.slice(0, 3).join(', '));

  const ex = ctx.execution || {};
  if (ex.currentStep) parts.push('Story Engine: step ' + ex.currentStep + ' of 12');
  if (ex.nextAction) parts.push('Next action: ' + ex.nextAction);
  if (ex.weeklyGoal) parts.push('This week: ' + ex.weeklyGoal);

  return parts.length ? '\n\nUSER BRAIN:\n' + parts.join('\n') : '';
}

async function loadUserContext(email) {
  if (!email || !email.includes('@')) return { ctx: emptySchema(), uid: null };
  if (!SUPABASE_URL || !SERVICE_KEY) return { ctx: emptySchema(), uid: null };
  try {
    const enc = encodeURIComponent(email.toLowerCase());
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/sam_users?email=eq.${enc}&select=uid,sam_context,voice_profile,voice_version,name,tier&order=last_seen.desc.nullslast&limit=10`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    );
    if (!r.ok) return { ctx: emptySchema(), uid: null };
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) return { ctx: emptySchema(), uid: null };
    const row = rows.find(r => r.tier && r.tier !== 'free') || rows[0];
    const ctx = normalizeSamContext(row.sam_context);
    if (row.voice_profile) { ctx.voice.profile = row.voice_profile; ctx.voice.version = row.voice_version || 0; }
    if (row.name && !ctx.identity.name) ctx.identity.name = row.name;
    if (ctx.migratedFrom) saveUserContext(email, ctx, row.uid).catch(() => {});
    return { ctx, uid: row.uid };
  } catch(e) {
    console.error('[_context] load error:', e.message);
    return { ctx: emptySchema(), uid: null };
  }
}

async function saveUserContext(email, ctx, knownUid) {
  if (!email || !email.includes('@')) return false;
  if (!SUPABASE_URL || !SERVICE_KEY) return false;
  try {
    let uid = knownUid;
    if (!uid) {
      const enc = encodeURIComponent(email.toLowerCase());
      const findR = await fetch(
        `${SUPABASE_URL}/rest/v1/sam_users?email=eq.${enc}&select=uid,tier&order=last_seen.desc.nullslast&limit=10`,
        { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
      );
      if (!findR.ok) return false;
      const rows = await findR.json();
      if (!Array.isArray(rows) || !rows.length) return false;
      uid = (rows.find(r => r.tier && r.tier !== 'free') || rows[0]).uid;
    }
    ctx.lastUpdatedAt = new Date().toISOString();
    ctx.schemaVersion = 2;
    const updateR = await fetch(
      `${SUPABASE_URL}/rest/v1/sam_users?uid=eq.${encodeURIComponent(uid)}`,
      {
        method: 'PATCH',
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ sam_context: JSON.stringify(ctx), last_seen: new Date().toISOString() })
      }
    );
    return updateR.ok;
  } catch(e) { return false; }
}



// ── TOOL CONTEXT ─────────────────────────────────────────────────
function buildToolContext(ctx) {
  ctx = ctx || {};
  const identity = ctx.identity || {};
  const brand = ctx.brand || {};
  const voice = ctx.voice || {};

  const identityName =
    identity.name ||
    brand.founderName ||
    null;

  const canonicalNiche =
    brand.niche ||
    ctx.diagnosedAudience ||
    null;

  const canonicalStory =
    identity.selfStory ||
    brand.story ||
    ctx.diagnosedStory ||
    null;

  const primaryPlatforms =
    Array.isArray(brand.platforms) && brand.platforms.length
      ? brand.platforms
      : Array.isArray(ctx.platforms) && ctx.platforms.length
      ? ctx.platforms
      : [];

  const voiceDNAShort =
    voice.profile
      ? String(voice.profile).slice(0, 400)
      : null;

  return {
    identityName,
    canonicalNiche,
    canonicalStory,
    primaryPlatforms,
    voiceDNAShort
  };
}

async function loadUserToolContext(email) {
  const loaded = await loadUserContext(email);
  const ctx =
    loaded && loaded.ctx ? loaded.ctx :
    loaded && loaded.context ? loaded.context :
    loaded || {};
  return buildToolContext(ctx);
}

module.exports = { normalizeSamContext, mapWizardToSchemaV2, buildBrainPrompt, loadUserContext, saveUserContext, emptySchema, buildToolContext, loadUserToolContext};
