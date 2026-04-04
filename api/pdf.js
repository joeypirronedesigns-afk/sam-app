// api/pdf.js — Puppeteer PDF generation for SAM playbook + lead magnet
// Requires: npm install @sparticuz/chromium puppeteer-core
// Vercel Pro supports up to 250MB functions — chromium adds ~50MB, fits fine

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// ── RATE LIMITING via Vercel KV ────────────────────────────────────────────
// Falls back to soft limits if KV not configured
async function checkRateLimit(userId, tier) {
  const limits = {
    free:    { pdfs: 2  },   // 2 total during trial
    starter: { pdfs: 3  },   // 3/day
    pro:     { pdfs: 20 },   // 20/day
    studio:  { pdfs: 999},   // unlimited
  };

  const limit = limits[tier] || limits.free;

  // If Vercel KV is configured, use server-side limiting
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const { kv } = require('@vercel/kv');
      const today = new Date().toISOString().split('T')[0];
      const key = `pdf:${userId}:${today}`;
      const current = await kv.get(key) || 0;

      if (current >= limit.pdfs) {
        return {
          allowed: false,
          used: current,
          limit: limit.pdfs,
          message: tier === 'free'
            ? 'PDF downloads are limited on the free trial. Upgrade to SAM Starter for 3 PDFs/day.'
            : `You've used your ${limit.pdfs} PDF downloads for today. Resets at midnight.`
        };
      }

      // Increment counter, expires in 25 hours
      await kv.set(key, current + 1, { ex: 90000 });
      return { allowed: true, used: current + 1, limit: limit.pdfs };

    } catch (err) {
      console.error('KV error — allowing request:', err);
      return { allowed: true }; // Fail open if KV is down
    }
  }

  // No KV configured — allow all (add KV later)
  return { allowed: true };
}

// ── PDF TEMPLATES ──────────────────────────────────────────────────────────
function buildPlaybookHTML(data) {
  const {
    brandName = 'Your Brand',
    brandHandle = '',
    brandColor = '#7C3AED',
    date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    diagnosis = '',
    storyArchitecture = [],
    hook = '',
    hookWhy = '',
    script = '',
    pacingNote = '',
    platforms = [],
    audienceProfile = {},
    leadMagnet = {},
    focusDirective = ''
  } = data;

  const sectionStyle = `
    margin-bottom: 36px;
    padding-bottom: 28px;
    border-bottom: 1px solid #2D1B5E;
  `;

  const sectionNumStyle = `
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${brandColor};
    margin-bottom: 6px;
  `;

  const sectionTitleStyle = `
    font-family: 'Sora', sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #F0ECFF;
    margin-bottom: 14px;
    letter-spacing: -0.01em;
  `;

  const cardStyle = `
    background: #1A0D30;
    border: 1px solid #2D1B5E;
    border-radius: 10px;
    padding: 16px 20px;
    margin-bottom: 10px;
  `;

  const whyStyle = `
    ${cardStyle}
    border-left: 3px solid ${brandColor};
    font-size: 13px;
    color: #C4B5FD;
    line-height: 1.65;
  `;

  // Story architecture cards
  const archCards = storyArchitecture.map(beat => `
    <div style="flex:1;min-width:160px;${cardStyle}border-top:3px solid ${beat.color || brandColor};">
      <div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${beat.color || brandColor};margin-bottom:4px;">${beat.label || ''} ${beat.timing || ''}</div>
      <div style="font-size:13px;font-weight:600;color:#F0ECFF;line-height:1.5;">${beat.text || ''}</div>
      <div style="font-size:10px;color:#7C6A9E;margin-top:4px;font-style:italic;">${beat.purpose || ''}</div>
    </div>
  `).join('');

  // Platform sections
  const platformCards = platforms.map(p => `
    <div style="${cardStyle}margin-bottom:14px;">
      <div style="font-size:12px;font-weight:700;color:#F0ECFF;margin-bottom:4px;">${p.platform || ''}</div>
      ${p.strategy ? `<div style="font-size:11px;color:#9D7EC9;margin-bottom:10px;font-style:italic;">${p.strategy}</div>` : ''}
      <div style="font-size:13px;color:#D4C5F9;line-height:1.6;white-space:pre-line;">${p.caption || ''}</div>
      ${p.hashtags ? `<div style="font-size:11px;color:${brandColor};margin-top:8px;">${p.hashtags}</div>` : ''}
    </div>
  `).join('');

  // Audience profile rows
  const apRows = [
    ['👤 Who They Are', audienceProfile.who],
    ['😤 Their Pain Points', audienceProfile.pain_points],
    ['💭 What They Secretly Want', audienceProfile.secret_want],
    ['📍 Where They Spend Time', audienceProfile.where],
    ['🎯 What Stops Their Scroll', audienceProfile.what_hooks_them],
    ['⚠️ What Loses Them Fast', audienceProfile.what_loses_them],
    ['🗣️ How to Talk to Them', audienceProfile.voice],
  ].filter(([, val]) => val).map(([label, val]) => `
    <div style="display:flex;gap:16px;padding:12px 0;border-bottom:1px solid #1E0F35;">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${brandColor};min-width:160px;flex-shrink:0;">${label}</div>
      <div style="font-size:13px;color:#D4C5F9;line-height:1.6;">${val}</div>
    </div>
  `).join('');

  // Lead magnet items
  const lmItems = (leadMagnet.items || []).map((item, i) => `
    <div style="display:flex;gap:14px;${cardStyle}">
      <div style="font-family:'Sora',sans-serif;font-size:20px;font-weight:700;color:${brandColor};flex-shrink:0;min-width:24px;">${i + 1}</div>
      <div style="font-size:13px;color:#D4C5F9;line-height:1.65;">
        ${item.heading ? `<strong style="color:#F0ECFF;">${item.heading}</strong> — ` : ''}${item.body || item}
      </div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Sora', -apple-system, sans-serif;
      background: #09080F;
      color: #D4C5F9;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page { margin: 0; size: letter; }
  </style>
</head>
<body>

<!-- COVER PAGE -->
<div style="
  width:100%; height:100vh;
  background: linear-gradient(135deg, #09080F 0%, #1E0F35 50%, #0D0618 100%);
  display:flex; flex-direction:column; justify-content:space-between;
  padding: 60px 70px;
  page-break-after: always;
">
  <!-- Top bar -->
  <div style="display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#6D4A9E;">
      S.A.M. — Strategic Assistant for Making
    </div>
    <div style="font-size:11px;color:#6D4A9E;letter-spacing:0.08em;">SAMFORCREATORS.COM</div>
  </div>

  <!-- Main headline -->
  <div>
    <div style="font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${brandColor};margin-bottom:20px;">
      ✦ SAM CONTENT PLAYBOOK
    </div>
    <div style="font-family:'Sora',sans-serif;font-size:64px;font-weight:800;color:#FFFFFF;line-height:1.05;letter-spacing:-0.03em;margin-bottom:12px;">
      Your Complete<br/>
      <span style="background:linear-gradient(90deg,${brandColor},#EC4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">Content Strategy</span>
    </div>
    <div style="width:80px;height:3px;background:linear-gradient(90deg,${brandColor},#EC4899);border-radius:2px;margin-bottom:36px;"></div>

    <!-- Creator card -->
    <div style="
      background:rgba(255,255,255,0.04);
      border:1px solid rgba(255,255,255,0.08);
      border-left:4px solid ${brandColor};
      border-radius:10px;
      padding:20px 24px;
      display:inline-block;
      min-width:400px;
    ">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6D4A9E;margin-bottom:8px;">Created for</div>
      <div style="font-size:22px;font-weight:700;color:#FFFFFF;margin-bottom:4px;">${brandName}</div>
      ${brandHandle ? `<div style="font-size:13px;color:#9D7EC9;">${brandHandle}</div>` : ''}
      <div style="font-size:12px;color:#6D4A9E;margin-top:8px;">${date}</div>
    </div>
  </div>

  <!-- Footer -->
  <div style="font-size:10px;color:#3D2B5E;text-align:center;letter-spacing:0.08em;">
    Built with S.A.M. — Strategic Assistant for Making · samforcreators.com
  </div>
</div>

<!-- CONTENT PAGES -->
<div style="padding:50px 60px;background:#09080F;min-height:100vh;">

  ${diagnosis ? `
  <!-- SECTION 01 -->
  <div style="${sectionStyle}">
    <div style="${sectionNumStyle}">Section 01</div>
    <div style="${sectionTitleStyle}">What This Story Is Really About</div>
    <div style="${whyStyle}">${diagnosis}</div>
  </div>` : ''}

  ${storyArchitecture.length ? `
  <!-- SECTION 02 -->
  <div style="${sectionStyle}">
    <div style="${sectionNumStyle}">Section 02</div>
    <div style="${sectionTitleStyle}">Your Story Architecture</div>
    <div style="${whyStyle}margin-bottom:16px;">Every story that holds attention follows a structure. This is yours — mapped out so you know exactly where you're going before you press record.</div>
    <div style="display:flex;flex-wrap:wrap;gap:10px;">${archCards}</div>
  </div>` : ''}

  ${hook ? `
  <!-- SECTION 03 -->
  <div style="${sectionStyle}">
    <div style="${sectionNumStyle}">Section 03</div>
    <div style="${sectionTitleStyle}">Your Hook</div>
    <div style="
      ${cardStyle}
      border-left:4px solid #F59E0B;
      font-family:'Sora',sans-serif;
      font-size:20px;
      font-weight:700;
      color:#FFFFFF;
      line-height:1.4;
    ">"${hook}"</div>
    ${hookWhy ? `<div style="${whyStyle}margin-top:10px;"><strong style="color:#F0ECFF;">Why this hook:</strong> ${hookWhy}</div>` : ''}
  </div>` : ''}

  ${script ? `
  <!-- SECTION 04 -->
  <div style="${sectionStyle}">
    <div style="${sectionNumStyle}">Section 04</div>
    <div style="${sectionTitleStyle}">Your Script</div>
    <div style="${cardStyle}font-size:13px;color:#D4C5F9;line-height:1.9;white-space:pre-line;">${script}</div>
    ${pacingNote ? `<div style="${whyStyle}margin-top:10px;font-style:italic;">${pacingNote}</div>` : ''}
  </div>` : ''}

  ${platforms.length ? `
  <!-- SECTION 05 -->
  <div style="${sectionStyle}">
    <div style="${sectionNumStyle}">Section 05</div>
    <div style="${sectionTitleStyle}">Your Platform Strategy</div>
    <div style="${whyStyle}margin-bottom:16px;">Same content posted the same way everywhere performs worse than content adapted to where it lives.</div>
    ${platformCards}
  </div>` : ''}

  ${Object.keys(audienceProfile).length ? `
  <!-- SECTION 06 -->
  <div style="${sectionStyle}">
    <div style="${sectionNumStyle}">Section 06</div>
    <div style="${sectionTitleStyle}">Your Ideal Audience</div>
    <div style="${whyStyle}margin-bottom:16px;">This isn't a demographic report. This is a real person — the one who needs your story most.</div>
    <div style="border:1px solid #2D1B5E;border-radius:10px;overflow:hidden;">
      ${apRows}
    </div>
    ${audienceProfile.why ? `<div style="${whyStyle}margin-top:12px;"><strong style="color:#F0ECFF;">Why SAM sees this for you:</strong> ${audienceProfile.why}</div>` : ''}
  </div>` : ''}

  ${leadMagnet.title ? `
  <!-- SECTION 08 -->
  <div style="${sectionStyle}">
    <div style="${sectionNumStyle}">Section 08</div>
    <div style="${sectionTitleStyle}">Your Audience Resource</div>
    <div style="
      background:linear-gradient(135deg,rgba(251,191,36,0.08),rgba(251,191,36,0.03));
      border:1px solid rgba(251,191,36,0.2);
      border-radius:12px;
      padding:24px;
    ">
      <div style="display:inline-flex;align-items:center;gap:6px;font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#F59E0B;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.2);padding:4px 12px;border-radius:20px;margin-bottom:14px;">⭐ Free Resource for Your Audience</div>
      <div style="font-family:'Sora',sans-serif;font-size:20px;font-weight:700;color:#FFFFFF;margin-bottom:10px;line-height:1.3;">${leadMagnet.title}</div>
      ${leadMagnet.why ? `<div style="${whyStyle}margin-bottom:16px;"><strong style="color:#F0ECFF;">Why this works:</strong> ${leadMagnet.why}</div>` : ''}
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">${lmItems}</div>
      ${leadMagnet.comment_response ? `
      <div style="${cardStyle}border:1px solid rgba(251,191,36,0.2);">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#F59E0B;margin-bottom:8px;">📣 Post This in Your Comments:</div>
        <div style="font-size:14px;color:#F0ECFF;font-style:italic;line-height:1.6;">"${leadMagnet.comment_response}"</div>
      </div>` : ''}
    </div>
  </div>` : ''}

  ${focusDirective ? `
  <!-- SECTION 09 -->
  <div style="margin-bottom:36px;">
    <div style="${sectionNumStyle}">Section 09</div>
    <div style="${sectionTitleStyle}">Your Next Move</div>
    <div style="
      background:linear-gradient(135deg,rgba(109,40,217,0.2),rgba(244,114,182,0.1));
      border:1px solid rgba(167,139,250,0.3);
      border-radius:12px;
      padding:28px;
    ">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#A78BFA;margin-bottom:10px;">Stop. Focus.</div>
      <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:700;color:#FFFFFF;line-height:1.5;">${focusDirective}</div>
    </div>
  </div>` : ''}

  <!-- Built by SAM footer -->
  <div style="text-align:center;padding-top:20px;border-top:1px solid #1E0F35;">
    <div style="font-size:10px;color:#3D2B5E;letter-spacing:0.08em;">Built with S.A.M. — Strategic Assistant for Making · samforcreators.com</div>
  </div>

</div>
</body>
</html>`;
}

function buildLeadMagnetHTML(data, brandData = {}) {
  const {
    title = 'Your Free Resource',
    why = '',
    items = [],
    comment_response = ''
  } = data;

  const {
    brandName = 'Your Brand',
    brandHandle = '',
    brandColor = '#7C3AED',
    date = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  } = brandData;

  const accentColors = ['#7C3AED', '#DB2777', '#D97706', '#059669', '#0369A1'];

  const itemCards = items.map((item, i) => `
    <div style="
      display:flex;gap:16px;align-items:flex-start;
      background:${accentColors[i] || accentColors[0]}12;
      border:1px solid ${accentColors[i] || accentColors[0]}30;
      border-left:5px solid ${accentColors[i] || accentColors[0]};
      border-radius:10px;
      padding:18px 20px;
      margin-bottom:12px;
    ">
      <div style="
        width:32px;height:32px;border-radius:50%;
        background:${accentColors[i] || accentColors[0]};
        display:flex;align-items:center;justify-content:center;
        color:white;font-weight:800;font-size:14px;
        flex-shrink:0;
      ">${i + 1}</div>
      <div style="font-size:14px;color:#1F2937;line-height:1.7;">
        ${item.heading ? `<strong style="color:#111827;">${item.heading}</strong> — ` : ''}${item.body || item}
      </div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body {
      font-family:'Sora',-apple-system,sans-serif;
      background:#FFFDF7;
      color:#1F2937;
      -webkit-print-color-adjust:exact;
      print-color-adjust:exact;
    }
    @page { margin:0; size:letter; }
  </style>
</head>
<body>

<!-- HEADER BAND -->
<div style="
  background:linear-gradient(135deg,${brandColor},#EC4899);
  padding:36px 60px 32px;
  position:relative;
  overflow:hidden;
">
  <!-- Dot pattern -->
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;opacity:0.07;background-image:radial-gradient(circle,white 1px,transparent 1px);background-size:28px 28px;"></div>

  <!-- Brand row -->
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;position:relative;">
    <div style="display:flex;align-items:center;gap:12px;">
      <div style="width:42px;height:42px;border-radius:8px;background:rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:18px;">
        ${brandName.charAt(0)}
      </div>
      <div>
        <div style="font-size:16px;font-weight:700;color:white;">${brandName}</div>
        ${brandHandle ? `<div style="font-size:11px;color:rgba(255,255,255,0.75);">${brandHandle}</div>` : ''}
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:9px;color:rgba(255,255,255,0.6);line-height:1.6;">Built with S.A.M.<br/>samforcreators.com</div>
    </div>
  </div>

  <!-- Free resource badge -->
  <div style="
    display:inline-flex;align-items:center;gap:6px;
    background:rgba(255,255,255,0.2);
    border:1px solid rgba(255,255,255,0.3);
    border-radius:20px;padding:4px 14px;
    font-size:9px;font-weight:700;letter-spacing:0.14em;
    text-transform:uppercase;color:white;
    margin-bottom:16px;position:relative;
  ">★ Free Resource</div>

  <!-- Title -->
  <div style="font-size:30px;font-weight:800;color:white;line-height:1.15;letter-spacing:-0.02em;position:relative;">
    ${title}
  </div>
</div>

<!-- BODY -->
<div style="padding:36px 60px;background:#FFFDF7;">

  ${why ? `
  <div style="
    background:white;
    border:1px solid #E5E7EB;
    border-left:4px solid ${brandColor};
    border-radius:8px;
    padding:16px 20px;
    margin-bottom:28px;
    font-size:13px;color:#374151;line-height:1.65;
  ">
    <strong style="color:#111827;">Why this works for your audience:</strong> ${why}
  </div>` : ''}

  ${itemCards}

  ${comment_response ? `
  <div style="
    background:#F3F4F6;
    border:1px solid #D1D5DB;
    border-radius:10px;
    padding:20px 24px;
    margin-top:24px;
  ">
    <div style="font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${brandColor};margin-bottom:10px;">📣 Post This in Your Comments:</div>
    <div style="font-size:15px;color:#111827;font-style:italic;line-height:1.65;">"${comment_response}"</div>
  </div>` : ''}

  <!-- Footer -->
  <div style="margin-top:36px;padding-top:20px;border-top:1px solid #E5E7EB;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:12px;font-weight:700;color:#374151;">${brandName} · ${date}</div>
    <div style="font-size:9px;color:${brandColor};">Built with S.A.M. · samforcreators.com</div>
  </div>

</div>
</body>
</html>`;
}

// ── MAIN HANDLER ───────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    type = 'playbook',   // 'playbook' or 'leadmagnet'
    userId = 'anon',
    tier = 'free',
    playbookData = {},
    leadMagnetData = {},
    brandData = {}
  } = req.body;

  // ── Rate limit check ──────────────────────────────────────────────────────
  const rateCheck = await checkRateLimit(userId, tier);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: 'limit_reached',
      message: rateCheck.message,
      used: rateCheck.used,
      limit: rateCheck.limit
    });
  }

  // ── Generate HTML ─────────────────────────────────────────────────────────
  let html;
  let filename;

  try {
    if (type === 'leadmagnet') {
      html = buildLeadMagnetHTML(leadMagnetData, brandData);
      filename = `SAM_Lead_Magnet_${Date.now()}.pdf`;
    } else {
      html = buildPlaybookHTML({ ...playbookData, ...brandData });
      filename = `SAM_Content_Playbook_${Date.now()}.pdf`;
    }
  } catch (err) {
    console.error('HTML build error:', err);
    return res.status(500).json({ error: 'Failed to build PDF template' });
  }

  // ── Launch Puppeteer ──────────────────────────────────────────────────────
  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // Set content and wait for fonts/images to load
    await page.setContent(html, {
      waitUntil: ['networkidle0', 'load'],
      timeout: 30000
    });

    // Generate PDF
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    await browser.close();

    // Return PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length);
    res.status(200).end(pdf);

  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error('Puppeteer error:', err);
    return res.status(500).json({ error: 'PDF generation failed', details: err.message });
  }
};
