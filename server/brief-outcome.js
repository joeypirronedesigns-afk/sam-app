// Records task completion for Today's Plan into sam_context execution layer via _context.js

const { loadUserContext, saveUserContext } = require('./_context');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  try {
    const { email, taskId, taskLabel, status, briefDate } = req.body || {};
    if (!email || !email.includes('@')) {
      return res.status(200).json({ ok: false, reason: 'invalid email' });
    }
    if (!taskId || !status) {
      return res.status(200).json({ ok: false, reason: 'missing fields' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { ctx, uid } = await loadUserContext(normalizedEmail);
    if (!uid || !ctx || !ctx.execution) {
      return res.status(200).json({ ok: false, reason: 'user not found' });
    }

    if (!ctx.execution.briefOutcomes) ctx.execution.briefOutcomes = [];

    const today = briefDate || new Date().toISOString().slice(0, 10);

    let todayOutcome = ctx.execution.briefOutcomes.find(o => o.date === today);
    if (!todayOutcome) {
      todayOutcome = { date: today, tasks: [] };
      ctx.execution.briefOutcomes.unshift(todayOutcome);
      ctx.execution.briefOutcomes = ctx.execution.briefOutcomes.slice(0, 30);
    }

    const existingTask = todayOutcome.tasks.find(t => t.id === taskId);
    if (existingTask) {
      existingTask.status = status;
      existingTask.label = taskLabel || existingTask.label || '';
      existingTask.completedAt = status === 'done' ? new Date().toISOString() : null;
    } else {
      todayOutcome.tasks.push({
        id: taskId,
        label: taskLabel || '',
        status,
        completedAt: status === 'done' ? new Date().toISOString() : null
      });
    }

    if (taskId === 'plan-1') {
      ctx.execution.anchorCompletedToday = (status === 'done');
      ctx.execution.lastAnchorDate = today;
    }

    const ok = await saveUserContext(normalizedEmail, ctx, uid);
    return res.status(200).json({ ok, taskId, status });
  } catch (e) {
    console.error('[brief-outcome]', e && e.message ? e.message : e);
    return res.status(200).json({ ok: false, reason: 'server error' });
  }
};
