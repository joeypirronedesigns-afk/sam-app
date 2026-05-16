module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { from, to, subject, html, text } = req.body || {};

  const forwardTo = process.env.GMAIL_FORWARD_ADDRESS || 'sammforcreators@gmail.com';
  const resendKey = process.env.RESEND_API_KEY;
  const domain = process.env.RESEND_DOMAIN || 'samforcreators.com';

  if (!resendKey) return res.status(500).json({ error: 'Missing RESEND_API_KEY' });

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
      console.error('Resend forward error:', data);
      return res.status(502).json({ error: 'Failed to forward email', detail: data });
    }

    return res.status(200).json({ ok: true, id: data.id });
  } catch (err) {
    console.error('Email forward exception:', err);
    return res.status(500).json({ error: err.message });
  }
};
