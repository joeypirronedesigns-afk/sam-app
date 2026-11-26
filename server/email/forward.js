module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  console.log('[forward] raw body:', JSON.stringify(req.body));

  const forwardTo = process.env.GMAIL_FORWARD_ADDRESS || 'samforcreators@gmail.com';
  const resendKey = process.env.RESEND_API_KEY;
  const adminKey = process.env.RESEND_ADMIN_KEY;
  const domain = process.env.RESEND_DOMAIN || 'samforcreators.com';

  if (!resendKey) return res.status(500).json({ error: 'Missing RESEND_API_KEY' });

  // Resend inbound webhook: fields are nested under data, body is not included
  // Must fetch full content from /emails/receiving/{email_id}
  const payload = req.body?.data || req.body || {};
  const emailId = payload.email_id;
  let from = payload.from;
  let to = Array.isArray(payload.to) ? payload.to[0] : payload.to;
  let subject = payload.subject;
  let html = null;
  let text = null;

  // Fetch full email body if this came from a Resend inbound webhook
  if (emailId && adminKey) {
    try {
      const r = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
        headers: { 'Authorization': `Bearer ${adminKey}` },
      });
      if (r.ok) {
        const full = await r.json();
        from = full.from || from;
        to = Array.isArray(full.to) ? full.to[0] : (full.to || to);
        subject = full.subject || subject;
        html = full.html || null;
        text = full.text || null;
      } else {
        console.error('[forward] failed to fetch received email:', await r.text());
      }
    } catch (err) {
      console.error('[forward] fetch received email error:', err.message);
    }
  }

  const senderLine = `<p style="color:#888;font-size:13px;border-bottom:1px solid #eee;padding-bottom:12px;margin-bottom:16px;">
    <strong>From:</strong> ${from || 'unknown'}<br>
    <strong>To:</strong> ${to || `joey@${domain}`}<br>
    <strong>Subject:</strong> ${subject || '(no subject)'}
  </p>`;

  const forwardedHtml = html
    ? `${senderLine}${html}`
    : `${senderLine}<pre style="font-family:inherit;white-space:pre-wrap;">${text || ''}</pre>`;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Forwarded <joey@${domain}>`,
        to: [forwardTo],
        reply_to: from || undefined,
        subject: `[joey@${domain}] ${subject || '(no subject)'}`,
        html: forwardedHtml,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error('[forward] Resend send error:', data);
      return res.status(502).json({ error: 'Failed to forward email', detail: data });
    }

    return res.status(200).json({ ok: true, id: data.id });
  } catch (err) {
    console.error('[forward] exception:', err);
    return res.status(500).json({ error: err.message });
  }
};
