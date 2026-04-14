const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const USER_ID = '8734019866';
const MAX_MESSAGES = 20;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(500).json({ error: 'Not configured' });

  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' };

  // GET — load last N messages
  if (req.method === 'GET') {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/sam_conversations?user_id=eq.${USER_ID}&order=created_at.desc&limit=${MAX_MESSAGES}`, { headers });
    const rows = await r.json();
    const messages = (rows || []).reverse().map(r => ({ role: r.role, content: r.content }));
    return res.status(200).json({ messages });
  }

  // POST — save a message
  if (req.method === 'POST') {
    const { role, content } = req.body;
    if (!role || !content) return res.status(400).json({ error: 'role and content required' });
    await fetch(`${SUPABASE_URL}/rest/v1/sam_conversations`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: USER_ID, role, content })
    });
    // Keep only last 100 messages — clean up old ones
    await fetch(`${SUPABASE_URL}/rest/v1/sam_conversations?user_id=eq.${USER_ID}&id=lt.(SELECT id FROM sam_conversations WHERE user_id='${USER_ID}' ORDER BY created_at DESC LIMIT 1 OFFSET 100)`, { method: 'DELETE', headers });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
