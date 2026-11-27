// Patch BE — /api/results: list saved scripts, run a results check from screenshots, manage lessons.
const { getSessionEmail } = require('./_session');
const R = require('./_results');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const email = await getSessionEmail(req).catch(() => null);
  if (!email) return res.status(401).json({ error: 'Not signed in' });
  const b = req.body || {};
  const action = b.action;

  if (action === 'list') {
    const outputs = (await R.getList('outputs', email)).slice().reverse().map(o => ({ id: o.id, at: o.at, hook: o.hook, pattern: o.pattern }));
    const debriefs = (await R.getList('debriefs', email)).slice().reverse();
    const lessons = await R.getList('lessons', email);
    return res.status(200).json({ outputs, debriefs, lessons });
  }
  if (action === 'delete_lesson') {
    const lessons = (await R.getList('lessons', email)).filter(l => l.id !== String(b.id || ''));
    await R.setList('lessons', email, lessons, 40);
    return res.status(200).json({ lessons });
  }
  if (action === 'debrief') {
    const imgs = (Array.isArray(b.images) ? b.images : []).filter(i => i && typeof i.data === 'string' && /^image\/(png|jpe?g|webp|gif)$/.test(i.media_type || 'image/jpeg')).slice(0, 3);
    if (!imgs.length) return res.status(400).json({ error: 'Add at least one screenshot.' });
    if (imgs.reduce((n, i) => n + i.data.length, 0) > 4000000) return res.status(413).json({ error: 'Screenshots are too large — try fewer or smaller ones.' });
    const { checkGate } = require('./_gate');
    const gate = await checkGate({ req, email, userId: email, tool: 'Results check', descriptor: 'See how your video did and why.', ctaAnonymous: 'Sign in to check your results.', ctaUnpaid: 'Subscribe to use results checks.' });
    if (!gate.ok) return res.status(gate.status).json(gate.body);
    const outputs = await R.getList('outputs', email);
    const output = outputs.find(o => o.id === String(b.output_id || '')) || null;
    const lessons = await R.getList('lessons', email);
    const history = (await R.getList('debriefs', email)).map(d => ({ at: d.at, hook: d.hook, headline: d.headline, metrics: d.metrics }));
    let todayLine = '';
    try { todayLine = '\nToday is ' + new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(new Date()) + '.'; } catch (_) {}
    const result = await R.debrief({ apiKey: process.env.ANTHROPIC_API_KEY, output, images: imgs, lessons, history, note: String(b.note || '').slice(0, 500), todayLine });
    let changed = { reinforced: [], added: [] }, allLessons = lessons;
    if (result.read_ok !== false) {
      const a = await R.applyLessons(email, output ? output.id : 'unlinked', result);
      changed = a.changed; allLessons = a.lessons;
      const debriefs = await R.getList('debriefs', email);
      debriefs.push({ at: new Date().toISOString(), output_id: output ? output.id : null, hook: output ? output.hook : '', platform: result.platform, verdict: result.verdict, headline: result.headline, metrics: result.metrics, biggest_drop: result.biggest_drop });
      await R.setList('debriefs', email, debriefs, R.MAX_DEBRIEFS);
    }
    return res.status(200).json({ result, output: output ? { id: output.id, hook: output.hook, pattern: output.pattern } : null, changed, lessons: allLessons });
  }
  return res.status(400).json({ error: 'Unknown action' });
};
