const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAX_MESSAGES = 40;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(500).json({ error: 'Not configured' });

  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' };
  // sam_ideas has RLS enabled; anon-key writes return 401 silently. v9.113.1
  // shipped migrate_anon_ideas with anon credentials, which is why historical
  // migrations all dropped on the floor (see v9.117.6 commit). Service-role
  // is required for any sam_ideas read/write from this handler.
  const serviceHeaders = SUPABASE_SERVICE_ROLE_KEY
    ? { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
    : null;

  // GET — load last N messages for a user, or list ideas (kind=ideas).
  if (req.method === 'GET') {
    const userId = (req.query.userId || '').toLowerCase();
    if (!userId) return res.status(400).json({ error: 'userId required' });

    // v9.117.6 — list ideas for the authenticated user.
    if ((req.query.kind || '').toLowerCase() === 'ideas') {
      if (!serviceHeaders) return res.status(500).json({ error: 'service_key_not_configured' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userId)) return res.status(400).json({ error: 'invalid_email' });
      try {
        const r = await fetch(
          `${SUPABASE_URL}/rest/v1/sam_ideas?user_id=eq.${encodeURIComponent(userId)}&select=idea_id,text,type,subtype,platform,status,created_at&order=created_at.desc&limit=500`,
          { headers: serviceHeaders }
        );
        if (!r.ok) {
          console.error('[memory:get_ideas] db error', r.status);
          return res.status(500).json({ error: 'db_error' });
        }
        const rows = await r.json();
        const ideas = (Array.isArray(rows) ? rows : []).map(row => ({
          id: row.idea_id,
          text: row.text || '',
          type: row.type || 'pulse',
          subtype: row.subtype || '',
          platform: row.platform || '',
          status: row.status || 'saved',
          date: row.created_at || new Date().toISOString()
        }));
        return res.status(200).json({ ideas });
      } catch (err) {
        console.error('[memory:get_ideas]', err && err.message);
        return res.status(500).json({ error: 'db_error' });
      }
    }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/sam_conversations?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=${MAX_MESSAGES}`, { headers });
    const rows = await r.json();
    const messages = (rows || []).reverse().map(r => ({ role: r.role, content: r.content }));
    return res.status(200).json({ messages });
  }

  // POST — save a single message (or batch) for a user
  if (req.method === 'POST') {
    const { role, content, userId: rawUserId, messages: batchMessages, action, ideas } = req.body;
    const userId = (rawUserId || '').toLowerCase();
    if (!userId) return res.status(400).json({ error: 'userId required' });

    // v9.113.1 — server-side migration of user-authored anonymous ideas.
    // v9.117.6 — switched from anon-key to service-role headers because
    // sam_ideas has RLS that blocks anon writes (the silent failure that
    // wiped historical migrations).
    if (action === 'migrate_anon_ideas') {
      if (!serviceHeaders) return res.status(500).json({ error: 'service_key_not_configured' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userId)) {
        return res.status(400).json({ error: 'invalid_email' });
      }
      if (!Array.isArray(ideas) || ideas.length === 0) {
        return res.status(200).json({ success: true, migrated: 0 });
      }
      try {
        // Load existing idea ids + texts for idempotency check
        const existingResp = await fetch(
          `${SUPABASE_URL}/rest/v1/sam_ideas?user_id=eq.${encodeURIComponent(userId)}&select=idea_id,text`,
          { headers: serviceHeaders }
        );
        const existing = existingResp.ok ? (await existingResp.json()) : [];
        const seenIds = new Set((existing || []).map(r => r.idea_id).filter(Boolean));
        const seenTexts = new Set((existing || []).map(r => (r.text || '').trim()).filter(Boolean));

        const rows = [];
        for (const idea of ideas) {
          if (!idea || typeof idea !== 'object') continue;
          const text = (idea.text || '').trim();
          if (!text) continue;
          const ideaId = idea.id || (Date.now() + '_' + Math.random().toString(36).slice(2, 7));
          if (seenIds.has(ideaId) || seenTexts.has(text)) continue;
          seenIds.add(ideaId);
          seenTexts.add(text);
          rows.push({
            user_id: userId,
            idea_id: ideaId,
            text,
            type: idea.type || 'pulse',
            subtype: idea.subtype || '',
            platform: idea.platform || '',
            status: idea.status || 'saved',
            created_at: idea.date || new Date().toISOString()
          });
        }

        if (rows.length > 0) {
          const writeResp = await fetch(`${SUPABASE_URL}/rest/v1/sam_ideas`, {
            method: 'POST',
            headers: { ...serviceHeaders, Prefer: 'return=minimal' },
            body: JSON.stringify(rows)
          });
          if (!writeResp.ok) {
            console.error('[memory:migrate_anon_ideas] insert failed', writeResp.status);
            return res.status(500).json({ error: 'migration_failed' });
          }
        }
        return res.status(200).json({ success: true, migrated: rows.length });
      } catch (err) {
        console.error('[memory:migrate_anon_ideas]', err && err.message);
        return res.status(500).json({ error: 'migration_failed' });
      }
    }

    // Batch mode — {userId, messages: [{role, content}, ...]}
    if (Array.isArray(batchMessages) && batchMessages.length > 0) {
      const rows = batchMessages
        .filter(m => m.role && m.content)
        .map(m => ({ user_id: userId, role: m.role, content: m.content }));
      if (rows.length > 0) {
        await fetch(`${SUPABASE_URL}/rest/v1/sam_conversations`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify(rows)
        });
      }
      return res.status(200).json({ ok: true, saved: rows.length });
    }

    // Single message — {userId, role, content}
    if (!role || !content) return res.status(400).json({ error: 'role and content required' });
    await fetch(`${SUPABASE_URL}/rest/v1/sam_conversations`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: userId, role, content })
    });
    // Keep only last 100 messages per user — trim old ones
    await fetch(`${SUPABASE_URL}/rest/v1/sam_conversations?user_id=eq.${encodeURIComponent(userId)}&id=lt.(SELECT id FROM sam_conversations WHERE user_id='${userId}' ORDER BY created_at DESC LIMIT 1 OFFSET 100)`, { method: 'DELETE', headers });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
