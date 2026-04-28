// api/pdf.js — SAM Puppeteer PDF Generator
// Uses @sparticuz/chromium to run bundled Chromium on Vercel
// Chromium binary fetched at runtime from GitHub CDN (fast, free, no bandwidth cost)
//
// package.json needs:
//   "@sparticuz/chromium": "^123.0.1"
//   "puppeteer-core": "^22.15.0"
//
// vercel.json needs:
//   "api/pdf.js": { "memory": 3009, "maxDuration": 60 }
//   (requires Vercel Pro — free plan max is 10s which is too short for Chromium)


const TIER_LIMITS = { free: 5, creator: 999, pro: 999, studio: 999, standard: 999, paid: 999 };

async function checkPdfLimit(userId, tier) {
  if (userId && (userId.startsWith('dev-') || userId === 'dev@sam.com')) return { allowed: true };
  if (tier === 'paid' || tier === 'standard' || tier === 'creator' || tier === 'pro' || tier === 'studio') return { allowed: true };
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const { kv } = require('@vercel/kv');
      const today = new Date().toISOString().split('T')[0];
      const key = `pdfs:${userId}:${today}`;
      const limit = TIER_LIMITS[tier] || TIER_LIMITS.free;
      const current = (await kv.get(key)) || 0;
      if (current >= limit) return { allowed: false, message: `Daily PDF limit reached (${limit}/day). Upgrade for more.` };
      await kv.set(key, current + 1, { ex: 90000 });
      return { allowed: true };
    } catch(e) { return { allowed: true }; }
  }
  return { allowed: true };
}

function buildHTML(playbookData, brandData, type) {
  const pb = playbookData || {};
  const b  = brandData    || {};
  const brandColor  = b.brandColor  || '#7C3AED';
  const brandName   = b.brandName   || 'Your Brand';
  const brandHandle = b.brandHandle || '';
  const date = b.date || new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  const logoHTML = b.brandLogo
    ? `<img src="${b.brandLogo}" style="max-height:48px;max-width:140px;object-fit:contain;border-radius:6px;" />`
    : `<div style="width:40px;height:40px;border-radius:8px;background:${brandColor};display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:18px;font-family:Arial,sans-serif;">${brandName.charAt(0)}</div>`;

  const brandHeader = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:14pt;margin-bottom:18pt;border-bottom:2.5px solid ${brandColor};">
      <div style="display:flex;align-items:center;gap:12px;">${logoHTML}
        <div>
          <div style="font-size:15pt;font-weight:700;color:#09080F;font-family:Georgia,serif;">${brandName}</div>
          ${brandHandle ? `<div style="font-size:9pt;color:#666;">${brandHandle}</div>` : ''}
        </div>
      </div>
      <div style="text-align:right;font-size:7.5pt;color:#999;line-height:1.5;">Built with S.A.M.<br/><span style="color:${brandColor};">samforcreators.com</span></div>
    </div>`;

  const footer = `<div style="text-align:center;font-size:7.5pt;color:#aaa;margin-top:28pt;padding-top:10pt;border-top:1px solid #eee;">Built by S.A.M. — Strategic Assistant for Making · samforcreators.com</div>`;

  const why = (text) => `<div style="background:#f7f5ff;border-left:3px solid #A78BFA;border-radius:0 5pt 5pt 0;padding:9pt 13pt;font-size:9.5pt;color:#333;line-height:1.65;margin-bottom:9pt;">${text}</div>`;

  // ── LEAD MAGNET PDF ──────────────────────────────────────────────────────
  if (type === 'leadmagnet') {
    const lm = pb.lead_magnet || {};
    const items = (lm.items || []).map((item, i) => `
      <div style="display:flex;gap:14px;align-items:flex-start;padding:12pt 14pt;background:#fafafa;border:1px solid #e8e4f0;border-radius:8pt;margin-bottom:8pt;page-break-inside:avoid;">
        <div style="font-size:22pt;font-weight:800;color:${brandColor};min-width:28pt;flex-shrink:0;font-family:Georgia,serif;">${i+1}</div>
        <div>
          <div style="font-size:12pt;font-weight:700;color:#09080F;margin-bottom:4pt;">${item.heading || ''}</div>
          <div style="font-size:10.5pt;color:#333;line-height:1.65;">${item.body || item || ''}</div>
        </div>
      </div>`).join('');

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Inter,-apple-system,Arial,sans-serif; color:#1a1a2e; background:#fff; padding:18mm 16mm; font-size:11pt; line-height:1.6; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
</style>
</head><body>
  ${brandHeader}
  <div style="display:inline-flex;align-items:center;font-size:8.5pt;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#92400E;background:#FEF3C7;border:1px solid #FCD34D;padding:4pt 12pt;border-radius:20pt;margin-bottom:14pt;">⭐ Free resource for your audience</div>
  <div style="font-size:26pt;font-weight:800;color:#09080F;line-height:1.1;margin-bottom:14pt;letter-spacing:-0.02em;font-family:Georgia,serif;">${lm.title || 'Your Audience Resource'}</div>
  ${lm.why ? why(`<strong>Why this works for your audience:</strong> ${lm.why}`) : ''}
  ${items}
  ${lm.comment_response ? `<div style="background:#FEF3C7;border:1.5px solid #FCD34D;border-radius:8pt;padding:12pt 15pt;margin-top:14pt;page-break-inside:avoid;">
    <div style="font-size:7.5pt;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#92400E;margin-bottom:5pt;">📣 Post this in your comments:</div>
    <div style="font-size:11pt;color:#1a1a2e;line-height:1.6;font-style:italic;">"${lm.comment_response}"</div>
  </div>` : ''}
  ${footer}
</body></html>`;
  }

  // ── FULL PLAYBOOK PDF ──────────────────────────────────────────────────────
  const arch = pb.story_architecture || {};
  const archColors = { opening:'#38BDF8', setup:'#A78BFA', risk:'#F472B6', turn:'#FBBF24', payoff:'#34D399', cta:'#F472B6' };
  const archLabels = { opening:'Opening (0–3s)', setup:'Setup (3–15s)', risk:'The Risk (15–30s)', turn:'The Turn (30–50s)', payoff:'The Payoff (50–70s)', cta:'Your CTA (final 5s)' };
  const archCards = Object.entries(archColors).filter(([k]) => arch[k]).map(([k, c]) =>
    `<div style="background:#f7f5ff;border:1px solid #e0d9f7;border-top:2.5px solid ${c};border-radius:5pt;padding:9pt 11pt;page-break-inside:avoid;">
      <div style="font-size:7pt;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#666;margin-bottom:3pt;">${archLabels[k]}</div>
      <div style="font-size:9.5pt;color:#1a1a2e;line-height:1.5;">${arch[k]}</div>
    </div>`).join('');

  const script = pb.narration_script || pb.full_script || '';
  const scriptHTML = typeof script === 'string'
    ? script.split('\n').map(l => {
        const t = l.trim();
        if (!t) return '<br/>';
        if (t.match(/^\[.*\]$/)) return `<span style="color:#7C3AED;font-weight:700;font-size:8pt;letter-spacing:0.08em;display:block;margin:10pt 0 3pt;">${t}</span>`;
        if (t.startsWith('(') && t.endsWith(')')) return `<span style="font-size:9.5pt;color:#666;font-style:italic;display:block;padding:2pt 0 2pt 10pt;border-left:2px solid #e0d9f7;">${t}</span>`;
        return `<span style="display:block;font-size:10pt;line-height:1.9;">${t}</span>`;
      }).join('') : '';

  const ap = pb.audience_profile || {};
  const apRows = [
    ['👤 Who They Are', ap.who], ['😤 Pain Points', ap.pain_points],
    ['💭 Secret Want', ap.secret_want], ['📍 Where They Are', ap.where],
    ['🎯 What Hooks Them', ap.what_hooks_them], ['⚠️ What Loses Them', ap.what_loses_them],
    ['🗣️ How to Talk to Them', ap.voice],
  ].filter(r => r[1]).map(r =>
    `<div style="display:flex;gap:10pt;padding:7pt 0;border-bottom:1px solid #e8e4f0;">
      <div style="font-size:7.5pt;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#7C3AED;min-width:55pt;padding-top:2pt;flex-shrink:0;">${r[0]}</div>
      <div style="font-size:9.5pt;color:#1a1a2e;line-height:1.55;flex:1;">${r[1]}</div>
    </div>`).join('');

  const platforms = (pb.platform_strategies || []).map(ps => !ps?.platform ? '' :
    `<div style="background:#f7f5ff;border:1px solid #e0d9f7;border-radius:7pt;padding:11pt 13pt;margin-bottom:7pt;page-break-inside:avoid;">
      <div style="font-size:11pt;font-weight:700;color:#09080F;margin-bottom:5pt;">${ps.platform}</div>
      ${ps.strategy ? `<div style="font-size:9.5pt;color:#555;font-style:italic;margin-bottom:5pt;">${ps.strategy}</div>` : ''}
      ${ps.caption  ? `<div style="font-size:10pt;color:#1a1a2e;line-height:1.6;margin-bottom:4pt;">${ps.caption}</div>` : ''}
      ${ps.hashtags ? `<div style="font-size:9pt;color:#7C3AED;">${ps.hashtags}</div>` : ''}
    </div>`).join('');

  const lm = pb.lead_magnet || {};
  const lmItems = (lm.items || []).map((item, i) =>
    `<div style="display:flex;gap:12px;align-items:flex-start;padding:11pt 13pt;background:#fafafa;border:1px solid #e8e4f0;border-radius:7pt;margin-bottom:7pt;page-break-inside:avoid;">
      <div style="font-size:18pt;font-weight:800;color:#7C3AED;min-width:22pt;flex-shrink:0;font-family:Georgia,serif;">${i+1}</div>
      <div>
        <div style="font-size:11pt;font-weight:700;color:#09080F;margin-bottom:3pt;">${item.heading || ''}</div>
        <div style="font-size:10pt;color:#333;line-height:1.65;">${item.body || item || ''}</div>
      </div>
    </div>`).join('');

  const sec = (num, title, content) =>
    `<div style="margin-bottom:22pt;padding-bottom:22pt;border-bottom:1px solid #e8e4f0;">
      <div style="font-size:7.5pt;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#A78BFA;margin-bottom:3pt;">${num}</div>
      <div style="font-size:17pt;font-weight:700;color:#09080F;margin-bottom:10pt;letter-spacing:-0.01em;font-family:Georgia,serif;">${title}</div>
      ${content}
    </div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Inter,-apple-system,Arial,sans-serif; color:#1a1a2e; background:#fff; font-size:11pt; line-height:1.6; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .cover { background:#09080F; color:white; padding:55px 45px; min-height:200mm; display:flex; flex-direction:column; justify-content:center; page-break-after:always; }
  .body { padding:14mm 16mm; }
</style>
</head><body>

<div class="cover">
  <div style="display:inline-flex;font-size:8.5pt;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#A78BFA;background:rgba(167,139,250,0.15);border:1px solid rgba(167,139,250,0.35);padding:5pt 14pt;border-radius:30pt;margin-bottom:22pt;">✦ SAM Content Playbook</div>
  <div style="font-size:40pt;font-weight:800;color:#fff;line-height:1.05;letter-spacing:-0.02em;margin-bottom:18pt;font-family:Georgia,serif;">Your Complete<br/>Content Strategy</div>
  <div style="font-size:10pt;color:rgba(240,236,255,0.5);margin-top:30pt;padding-top:22pt;border-top:1px solid rgba(255,255,255,0.1);">${date}</div>
</div>

<div class="body">
  ${brandHeader}

  ${pb.diagnosis ? sec('Section 01', 'What this story is really about',
    `<div style="background:#f7f5ff;border:1px solid #e0d9f7;border-radius:7pt;padding:13pt 15pt;font-size:10.5pt;color:#1a1a2e;line-height:1.75;">${pb.diagnosis}</div>`
  ) : ''}

  ${archCards ? sec('Section 02', 'Your story architecture',
    why('Every story that holds attention follows a structure. This is yours.') +
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:7pt;">${archCards}</div>`
  ) : ''}

  ${pb.hook ? sec('Section 03', 'Your hook',
    why('The first thing your audience hears. You have 1–3 seconds.') +
    `<div style="background:#f7f5ff;border:1px solid rgba(109,40,217,0.2);border-left:4px solid #7C3AED;border-radius:0 7pt 7pt 0;padding:15pt 18pt;font-size:15pt;font-weight:700;color:#09080F;line-height:1.3;font-family:Georgia,serif;">${pb.hook}</div>` +
    (pb.hook_why ? `<div style="margin-top:8pt;">${why(`<strong>Why this hook:</strong> ${pb.hook_why}`)}</div>` : '')
  ) : ''}

  ${scriptHTML ? sec('Section 04', pb.narration_script ? 'Your narration script' : 'Your full script',
    why(pb.narration_script ? 'Written for narration — voice over footage. Read at your natural pace.' : 'Written for direct delivery to camera. Internalize the beats, then talk.') +
    `<div style="background:#fafafa;border:1px solid #e8e4f0;border-radius:7pt;padding:15pt;font-size:10pt;line-height:1.9;color:#1a1a2e;">${scriptHTML}</div>` +
    (pb.pacing_note ? `<div style="margin-top:8pt;">${why(`<strong>Delivery note:</strong> ${pb.pacing_note}`)}</div>` : '')
  ) : ''}

  ${platforms ? sec('Section 05', 'Your platform strategy',
    why('Same content posted the same way everywhere performs worse than content adapted to each platform.') +
    platforms
  ) : ''}

  ${apRows ? sec('Section 06', 'Your ideal audience',
    why('This isn\'t a demographic report. This is a real person — the one who needs your story most.') +
    `<div style="background:#f7f5ff;border:1px solid #e0d9f7;border-radius:7pt;padding:11pt 15pt;">${apRows}</div>`
  ) : ''}

  ${lm.title ? `<div style="margin-bottom:22pt;padding-bottom:22pt;border-bottom:1px solid #e8e4f0;page-break-before:always;">
    <div style="font-size:7.5pt;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#A78BFA;margin-bottom:3pt;">Section 07</div>
    <div style="font-size:17pt;font-weight:700;color:#09080F;margin-bottom:10pt;font-family:Georgia,serif;">Your audience resource</div>
    <div style="display:inline-flex;font-size:8pt;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#92400E;background:#FEF3C7;border:1px solid #FCD34D;padding:3pt 10pt;border-radius:20pt;margin-bottom:12pt;">⭐ Free resource for your audience</div>
    <div style="font-size:20pt;font-weight:800;color:#09080F;line-height:1.1;margin-bottom:10pt;font-family:Georgia,serif;">${lm.title}</div>
    ${lm.why ? why(`<strong>Why this works:</strong> ${lm.why}`) : ''}
    ${lmItems}
    ${lm.comment_response ? `<div style="background:#FEF3C7;border:1.5px solid #FCD34D;border-radius:7pt;padding:11pt 14pt;margin-top:12pt;page-break-inside:avoid;">
      <div style="font-size:7.5pt;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#92400E;margin-bottom:5pt;">📣 Post this in your comments:</div>
      <div style="font-size:11pt;color:#1a1a2e;line-height:1.6;font-style:italic;">"${lm.comment_response}"</div>
    </div>` : ''}
  </div>` : ''}

  ${pb.focus_directive ? `<div style="background:#f7f5ff;border:1.5px solid rgba(109,40,217,0.2);border-radius:7pt;padding:18pt;">
    <div style="font-size:8pt;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#7C3AED;margin-bottom:7pt;">STOP. FOCUS.</div>
    <div style="font-size:13pt;font-weight:700;color:#09080F;line-height:1.4;font-family:Georgia,serif;">${pb.focus_directive}</div>
  </div>` : ''}

  ${footer}
</div>
</body></html>`;
}

module.exports = async function handler(req, res) {
  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'SAM PDF API ready. POST to generate.' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, userId, tier, brandData, playbookData } = req.body;
  if (!type || !['playbook','leadmagnet'].includes(type)) {
    return res.status(400).json({ error: 'type must be playbook or leadmagnet' });
  }

  const check = await checkPdfLimit(userId || 'anon', tier || 'free');
  if (!check.allowed) return res.status(429).json({ error: 'limit_reached', message: check.message });

  const html = buildHTML(playbookData, brandData, type);

  let chromium, puppeteer;
  try {
    // Use chromium-min to stay under Vercel's 50MB bundle limit
    // Chromium binary is fetched at runtime from GitHub CDN
    chromium  = require('@sparticuz/chromium');
    puppeteer = require('puppeteer-core');
  } catch(e) {
    console.error('[pdf] puppeteer launch error:', {
      message: e && e.message,
      name: e && e.name,
      stack: e && e.stack
    });
    try {
      // Local dev fallback
      puppeteer = require('puppeteer');
      chromium  = null;
    } catch(e2) {
      return res.status(500).json({
        error: 'Puppeteer not installed',
        detail: 'Run: npm install @sparticuz/chromium puppeteer-core'
      });
    }
  }

  let browser;
  try {
    console.error('[pdf] starting puppeteer launch with chromium:', {
      hasChromium: !!chromium,
      hasPuppeteer: !!puppeteer,
      nodeVersion: process.version,
      env: {
        REGION: process.env.VERCEL_REGION,
        RUNTIME: process.env.VERCEL_ENV
      }
    });
    if (chromium) {
      browser = await puppeteer.launch({
        args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });
    } else {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    const page = await browser.newPage();

    // Use domcontentloaded (not networkidle2) to avoid font load timeouts
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 25000 });

    // Give the page a moment to render (waitForTimeout removed in v22)
    await new Promise(r => setTimeout(r, 1500));

    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      printBackground: true,
      preferCSSPageSize: true,
    });

    await browser.close();

    const filename = type === 'leadmagnet' ? 'SAM_Lead_Magnet.pdf' : 'SAM_Playbook.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length);
    return res.status(200).send(pdf);

  } catch(err) {
    if (browser) await browser.close().catch(() => {});
    console.error('PDF generation error:', err.message);
    return res.status(500).json({
      error: 'PDF generation failed',
      detail: err.message,
      hint: err.message.includes('timeout') ? 'Cold start timeout — try again in a few seconds' :
            err.message.includes('memory') ? 'Out of memory — check vercel.json has memory: 3009' :
            'Check Vercel function logs for details'
    });
  }
};
