// api/pdf.js — Puppeteer PDF generator for SAM playbooks
// Vercel config: 3GB RAM, 60s timeout (set in vercel.json)

const TIER_LIMITS = {
  free:    { pdfs: 2 },
  starter: { pdfs: 5 },
  pro:     { pdfs: 20 },
  studio:  { pdfs: 999 },
};

async function checkPdfLimit(userId, tier) {
  if (userId && (userId.startsWith('dev-') || userId === 'dev@sam.com')) return { allowed: true };
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      let kv;
      try { kv = require('@vercel/kv').kv; } catch(e) { return { allowed: true }; }
      const today = new Date().toISOString().split('T')[0];
      const key = `pdfs:${userId}:${today}`;
      const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
      const current = (await kv.get(key)) || 0;
      if (current >= limits.pdfs) return { allowed: false, message: `Daily PDF limit reached (${limits.pdfs}/day). Upgrade for more.` };
      await kv.set(key, current + 1, { ex: 90000 });
      return { allowed: true };
    } catch(e) { return { allowed: true }; }
  }
  return { allowed: true };
}

function buildPlaybookHTML(playbookData, brandData, type) {
  const pb = playbookData || {};
  const b = brandData || {};
  const brandColor = b.brandColor || '#7C3AED';
  const brandName  = b.brandName  || 'Your Brand';
  const brandHandle= b.brandHandle|| '';
  const date       = b.date       || new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  const brandLogoHTML = b.brandLogo
    ? `<img src="${b.brandLogo}" style="max-height:48px;max-width:140px;object-fit:contain;" />`
    : `<div style="width:40px;height:40px;border-radius:8px;background:${brandColor};display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:18px;">${brandName.charAt(0)}</div>`;

  const brandHeader = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:16pt;margin-bottom:20pt;border-bottom:2px solid ${brandColor};">
      <div style="display:flex;align-items:center;gap:12px;">
        ${brandLogoHTML}
        <div>
          <div style="font-family:'Sora',Arial,sans-serif;font-size:16pt;font-weight:700;color:#09080F;">${brandName}</div>
          ${brandHandle ? `<div style="font-size:10pt;color:#666;">${brandHandle}</div>` : ''}
        </div>
      </div>
      <div style="text-align:right;font-size:8pt;color:#999;line-height:1.5;">
        Built with S.A.M.<br/><span style="color:${brandColor};">samforcreators.com</span>
      </div>
    </div>`;

  // ── LEAD MAGNET ONLY ──────────────────────────────────────────────────────
  if (type === 'leadmagnet') {
    const lm = pb.lead_magnet || {};
    const items = (lm.items || []).map((item, i) => `
      <div style="display:flex;gap:14px;align-items:flex-start;padding:14pt 16pt;background:#fafafa;border:1px solid #e8e4f0;border-radius:8pt;margin-bottom:10pt;page-break-inside:avoid;">
        <div style="font-family:'Sora',Arial,sans-serif;font-size:22pt;font-weight:800;color:${brandColor};min-width:28pt;flex-shrink:0;">${i+1}</div>
        <div>
          <div style="font-size:12pt;font-weight:700;color:#09080F;margin-bottom:4pt;">${item.heading || ''}</div>
          <div style="font-size:10.5pt;color:#333;line-height:1.65;">${item.body || item || ''}</div>
        </div>
      </div>`).join('');

    return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; color: #1a1a2e; background: #fff; padding: 20mm 18mm; font-size: 11pt; line-height: 1.6; }
  @media print { body { padding: 0; } }
</style>
</head><body>
  ${brandHeader}
  <div style="display:inline-flex;align-items:center;gap:6px;font-size:9pt;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${brandColor === '#7C3AED' ? '#92400E' : brandColor};background:${brandColor === '#7C3AED' ? '#FEF3C7' : brandColor + '22'};border:1px solid ${brandColor === '#7C3AED' ? '#FCD34D' : brandColor + '55'};padding:4pt 12pt;border-radius:20pt;margin-bottom:14pt;">
    ⭐ Free resource for your audience
  </div>
  <div style="font-family:'Sora',Arial,sans-serif;font-size:28pt;font-weight:800;color:#09080F;line-height:1.1;margin-bottom:16pt;letter-spacing:-0.02em;">
    ${lm.title || 'Your Audience Resource'}
  </div>
  ${lm.why ? `<div style="background:#f7f5ff;border-left:3px solid ${brandColor};border-radius:0 6pt 6pt 0;padding:12pt 16pt;font-size:10pt;color:#333;line-height:1.65;margin-bottom:20pt;">
    <strong>Why this works for your audience:</strong> ${lm.why}
  </div>` : ''}
  ${items}
  ${lm.comment_response ? `
  <div style="background:#FEF3C7;border:1.5px solid #FCD34D;border-radius:8pt;padding:14pt 16pt;margin-top:16pt;page-break-inside:avoid;">
    <div style="font-size:8pt;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#92400E;margin-bottom:6pt;">📣 Post this in your comments:</div>
    <div style="font-size:11pt;color:#1a1a2e;line-height:1.6;font-style:italic;">"${lm.comment_response}"</div>
  </div>` : ''}
  <div style="text-align:center;font-size:8pt;color:#999;margin-top:30pt;padding-top:12pt;border-top:1px solid #eee;">
    Built by S.A.M. — Strategic Assistant for Making · samforcreators.com
  </div>
</body></html>`;
  }

  // ── FULL PLAYBOOK ─────────────────────────────────────────────────────────
  const arch = pb.story_architecture || {};
  const archCards = [
    { key:'opening', label:'Opening (0–3s)', cls:'#38BDF8' },
    { key:'setup',   label:'Setup (3–15s)',  cls:'#A78BFA' },
    { key:'risk',    label:'The Risk (15–30s)', cls:'#F472B6' },
    { key:'turn',    label:'The Turn (30–50s)', cls:'#FBBF24' },
    { key:'payoff',  label:'The Payoff (50–70s)', cls:'#34D399' },
    { key:'cta',     label:'Your CTA (final 5s)', cls:'#F472B6' },
  ].filter(a => arch[a.key]).map(a => `
    <div style="background:#f7f5ff;border:1px solid #e0d9f7;border-top:2.5px solid ${a.cls};border-radius:6pt;padding:10pt 12pt;page-break-inside:avoid;">
      <div style="font-size:7.5pt;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#666;margin-bottom:4pt;">${a.label}</div>
      <div style="font-size:10pt;color:#1a1a2e;line-height:1.5;">${arch[a.key]}</div>
    </div>`).join('');

  const script = pb.narration_script || pb.full_script || '';
  const formattedScript = typeof script === 'string'
    ? script.split('\n').map(line => {
        const t = line.trim();
        if (!t) return '';
        if (t.match(/^\[.*\]$/)) return `<span style="color:#7C3AED;font-weight:700;font-size:8pt;letter-spacing:0.08em;display:block;margin-top:12pt;margin-bottom:4pt;">${t}</span>`;
        if (t.startsWith('(') && t.endsWith(')')) return `<span style="font-size:10pt;color:#666;font-style:italic;display:block;padding:3pt 0 3pt 12pt;border-left:2px solid #e0d9f7;">${t}</span>`;
        return `<span style="display:block;">${t}</span>`;
      }).filter(Boolean).join('')
    : '';

  const ap = pb.audience_profile || {};
  const apRows = [
    ['👤 Who They Are', ap.who],
    ['😤 Pain Points', ap.pain_points],
    ['💭 Secret Want', ap.secret_want],
    ['📍 Where They Are', ap.where],
    ['🎯 What Hooks Them', ap.what_hooks_them],
    ['⚠️ What Loses Them', ap.what_loses_them],
    ['🗣️ How to Talk to Them', ap.voice],
  ].filter(r => r[1]).map(r => `
    <div style="display:flex;gap:12pt;padding:8pt 0;border-bottom:1px solid #e8e4f0;">
      <div style="font-size:8pt;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#7C3AED;min-width:60pt;padding-top:2pt;flex-shrink:0;">${r[0]}</div>
      <div style="font-size:10pt;color:#1a1a2e;line-height:1.55;flex:1;">${r[1]}</div>
    </div>`).join('');

  const platforms = (pb.platform_strategies || []).map(ps => !ps?.platform ? '' : `
    <div style="background:#f7f5ff;border:1px solid #e0d9f7;border-radius:8pt;padding:12pt 14pt;margin-bottom:8pt;page-break-inside:avoid;">
      <div style="font-size:11pt;font-weight:700;color:#09080F;margin-bottom:6pt;">${ps.platform}</div>
      ${ps.strategy ? `<div style="font-size:10pt;color:#666;font-style:italic;margin-bottom:6pt;">${ps.strategy}</div>` : ''}
      ${ps.caption ? `<div style="font-size:10pt;color:#1a1a2e;line-height:1.6;margin-bottom:4pt;">${ps.caption}</div>` : ''}
      ${ps.hashtags ? `<div style="font-size:9pt;color:#7C3AED;">${ps.hashtags}</div>` : ''}
    </div>`).join('');

  const lm = pb.lead_magnet || {};
  const lmItems = (lm.items || []).map((item, i) => `
    <div style="display:flex;gap:12px;align-items:flex-start;padding:12pt 14pt;background:#fafafa;border:1px solid #e8e4f0;border-radius:8pt;margin-bottom:8pt;page-break-inside:avoid;">
      <div style="font-family:'Sora',Arial,sans-serif;font-size:20pt;font-weight:800;color:#7C3AED;min-width:24pt;flex-shrink:0;">${i+1}</div>
      <div>
        <div style="font-size:11pt;font-weight:700;color:#09080F;margin-bottom:4pt;">${item.heading || ''}</div>
        <div style="font-size:10pt;color:#333;line-height:1.65;">${item.body || item || ''}</div>
      </div>
    </div>`).join('');

  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; color: #1a1a2e; background: #fff; font-size: 11pt; line-height: 1.6; }
  .page { padding: 15mm 18mm; }
  .cover { background: linear-gradient(135deg, #09080F 0%, #1a0a2e 50%, #0d0527 100%); color: white; padding: 60px 48px; min-height: 200mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
  .section { margin-bottom: 24pt; padding-bottom: 24pt; border-bottom: 1px solid #e8e4f0; page-break-inside: avoid; }
  .section:last-child { border-bottom: none; }
  .section-num { font-size: 8pt; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #A78BFA; margin-bottom: 4pt; }
  .section-title { font-family: 'Sora', Arial, sans-serif; font-size: 18pt; font-weight: 700; color: #09080F; margin-bottom: 12pt; letter-spacing: -0.01em; }
  .arch-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8pt; }
  .why-block { background: #f7f5ff; border-left: 3px solid #A78BFA; border-radius: 0 6pt 6pt 0; padding: 10pt 14pt; font-size: 9.5pt; color: #333; line-height: 1.65; margin-bottom: 10pt; }
  @media print { .cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head><body>

<!-- COVER -->
<div class="cover">
  <div style="display:inline-flex;align-items:center;gap:6px;font-size:9pt;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#A78BFA;background:rgba(167,139,250,0.2);border:1px solid rgba(167,139,250,0.4);padding:5pt 14pt;border-radius:30pt;margin-bottom:24pt;">✦ SAM Content Playbook</div>
  <div style="font-family:'Sora',Arial,sans-serif;font-size:42pt;font-weight:800;color:#ffffff;line-height:1.05;letter-spacing:-0.02em;margin-bottom:20pt;">Your Complete<br/>Content Strategy</div>
  <div style="font-size:11pt;color:rgba(240,236,255,0.6);margin-top:32pt;padding-top:24pt;border-top:1px solid rgba(255,255,255,0.1);">${date}</div>
</div>

<div class="page">
  ${brandHeader}

  ${pb.diagnosis ? `
  <div class="section">
    <div class="section-num">Section 01</div>
    <div class="section-title">What this story is really about</div>
    <div style="background:#f7f5ff;border:1px solid #e0d9f7;border-radius:8pt;padding:14pt 16pt;">
      <div style="font-size:10.5pt;color:#1a1a2e;line-height:1.75;">${pb.diagnosis}</div>
    </div>
  </div>` : ''}

  ${archCards ? `
  <div class="section">
    <div class="section-num">Section 02</div>
    <div class="section-title">Your story architecture</div>
    <div class="why-block">Every story that holds attention follows a structure. This is yours — mapped out so you know exactly where you're going before you press record.</div>
    <div class="arch-grid">${archCards}</div>
  </div>` : ''}

  ${pb.hook ? `
  <div class="section">
    <div class="section-num">Section 03</div>
    <div class="section-title">Your hook</div>
    <div class="why-block">This is the first thing your audience hears or reads. You have 1–3 seconds.</div>
    <div style="background:linear-gradient(135deg,rgba(109,40,217,0.08),rgba(244,114,182,0.05));border:1px solid rgba(109,40,217,0.2);border-left:4px solid #7C3AED;border-radius:0 8pt 8pt 0;padding:16pt 20pt;font-family:'Sora',Arial,sans-serif;font-size:16pt;font-weight:700;color:#09080F;line-height:1.3;">
      ${pb.hook}
    </div>
    ${pb.hook_why ? `<div class="why-block" style="margin-top:10pt;"><strong>Why this hook:</strong> ${pb.hook_why}</div>` : ''}
  </div>` : ''}

  ${script ? `
  <div class="section">
    <div class="section-num">Section 04</div>
    <div class="section-title">${pb.narration_script ? 'Your narration script' : 'Your full script'}</div>
    <div class="why-block">${pb.narration_script ? "This script is written for narration — your voice over footage or photos. Read it at your natural pace. The pauses are where your visuals do the work." : "This script is written for direct delivery to camera. Internalize the beats, then talk."}</div>
    <div style="background:#fafafa;border:1px solid #e8e4f0;border-radius:8pt;padding:16pt;font-size:10pt;line-height:2;color:#1a1a2e;white-space:pre-wrap;">${formattedScript}</div>
    ${pb.pacing_note ? `<div class="why-block" style="margin-top:10pt;"><strong>Delivery note:</strong> ${pb.pacing_note}</div>` : ''}
  </div>` : ''}

  ${platforms ? `
  <div class="section">
    <div class="section-num">Section 05</div>
    <div class="section-title">Your platform strategy</div>
    <div class="why-block">Every platform is different. Same content posted the same way everywhere performs worse than content adapted to where it lives.</div>
    ${platforms}
  </div>` : ''}

  ${apRows ? `
  <div class="section">
    <div class="section-num">Section 06</div>
    <div class="section-title">Your ideal audience</div>
    <div class="why-block">This isn't a demographic report. This is a real person — the one who needs your story most.</div>
    <div style="background:#f7f5ff;border:1px solid #e0d9f7;border-radius:8pt;padding:12pt 16pt;">${apRows}</div>
  </div>` : ''}

  ${lm.title ? `
  <div class="section" style="page-break-before:always;">
    <div class="section-num">Section 07</div>
    <div class="section-title">Your audience resource</div>
    <div style="display:inline-flex;align-items:center;font-size:8pt;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#92400E;background:#FEF3C7;border:1px solid #FCD34D;padding:3pt 10pt;border-radius:20pt;margin-bottom:14pt;">⭐ Free resource for your audience</div>
    <div style="font-family:'Sora',Arial,sans-serif;font-size:22pt;font-weight:800;color:#09080F;line-height:1.1;margin-bottom:12pt;">${lm.title}</div>
    ${lm.why ? `<div class="why-block"><strong>Why this works:</strong> ${lm.why}</div>` : ''}
    ${lmItems}
    ${lm.comment_response ? `
    <div style="background:#FEF3C7;border:1.5px solid #FCD34D;border-radius:8pt;padding:12pt 16pt;margin-top:14pt;">
      <div style="font-size:8pt;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#92400E;margin-bottom:6pt;">📣 Post this in your comments:</div>
      <div style="font-size:11pt;color:#1a1a2e;line-height:1.6;font-style:italic;">"${lm.comment_response}"</div>
    </div>` : ''}
  </div>` : ''}

  ${pb.focus_directive ? `
  <div style="background:linear-gradient(135deg,rgba(109,40,217,0.08),rgba(244,114,182,0.05));border:1.5px solid rgba(109,40,217,0.2);border-radius:8pt;padding:20pt;">
    <div style="font-size:8pt;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#7C3AED;margin-bottom:8pt;">STOP. FOCUS.</div>
    <div style="font-family:'Sora',Arial,sans-serif;font-size:14pt;font-weight:700;color:#09080F;line-height:1.4;">${pb.focus_directive}</div>
  </div>` : ''}

  <div style="text-align:center;font-size:8pt;color:#999;margin-top:30pt;padding-top:12pt;border-top:1px solid #eee;">
    Built by S.A.M. — Strategic Assistant for Making · samforcreators.com
  </div>
</div>
</body></html>`;
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ ok: true, message: 'SAM PDF API ready' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, userId, tier, brandData, playbookData, leadMagnetData } = req.body;

  if (!type || !['playbook','leadmagnet'].includes(type)) {
    return res.status(400).json({ error: 'type must be playbook or leadmagnet' });
  }

  const check = await checkPdfLimit(userId || 'anon', tier || 'free');
  if (!check.allowed) return res.status(429).json({ error: 'limit_reached', message: check.message });

  try {
    let chromium, puppeteer;
    try {
      chromium  = require('@sparticuz/chromium');
      puppeteer = require('puppeteer-core');
    } catch(e) {
      // Not on Vercel — try local puppeteer for dev
      try {
        puppeteer = require('puppeteer');
        chromium  = null;
      } catch(e2) {
        return res.status(500).json({ error: 'Puppeteer not available. Make sure puppeteer-core and @sparticuz/chromium are installed.' });
      }
    }

    const html = buildPlaybookHTML(playbookData, brandData, type);

    let browser;
    if (chromium) {
      browser = await puppeteer.launch({
        args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    }

    const page = await browser.newPage();

    // Wait for Google Fonts to load
    await page.setContent(html, { waitUntil: 'networkidle2', timeout: 30000 });

    // Give fonts an extra moment
    await page.waitForTimeout(1500).catch(() => {});

    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      printBackground: true,
      preferCSSPageSize: true,
    });

    await browser.close();

    const filename = type === 'leadmagnet' ? 'SAM_Lead_Magnet.pdf' : 'SAM_Content_Playbook.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length);
    res.status(200).send(pdf);

  } catch(err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: 'PDF generation failed: ' + (err.message || 'Unknown error') });
  }
};
