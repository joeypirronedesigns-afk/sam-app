const puppeteerCore = require('puppeteer-core');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let browser;

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { type, playbookData, leadMagnetData, brandData } = body;

    if (!type || (type !== 'playbook' && type !== 'leadmagnet')) {
      return res.status(400).json({ error: 'type must be playbook or leadmagnet' });
    }

    // ── CHANGED: inline title/content/html replaced by builder calls ──────────
    const html =
      type === 'playbook'
        ? buildPlaybookHTML(playbookData || {}, brandData || {})
        : buildLeadMagnetHTML(leadMagnetData || {}, brandData || {});
    // ─────────────────────────────────────────────────────────────────────────

    let puppeteer = puppeteerCore;
    let launchOptions = {};

    if (process.env.VERCEL) {
      const chromium = require('@sparticuz/chromium');

      launchOptions = {
        args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      };
    } else {
      puppeteer = require('puppeteer');

      launchOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      };
    }

    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type}.pdf"`);
    return res.status(200).send(Buffer.from(pdf));
  } catch (error) {
    console.error('[api/pdf] error', {
      message: error?.message,
      stack: error?.stack,
    });

    return res.status(500).json({
      error: 'PDF generation failed',
      detail: error?.message || 'Unknown error',
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
  }
};

// ─── CSS ──────────────────────────────────────────────────────────────────────

function sharedCSS(brandColor) {
  const bc = escapeHtml(brandColor || '#20808D');
  return `
    :root {
      --pdf-paper:        #FAFAF7;
      --pdf-surface:      #F4F2EC;
      --pdf-rule:         #E5E2DB;
      --pdf-rule-strong:  #C9C5BC;
      --pdf-ink:          #1A1815;
      --pdf-ink-soft:     #4A4640;
      --pdf-ink-muted:    #8B8680;
      --pdf-accent:       #20808D;
      --pdf-accent-soft:  rgba(32,128,141,0.08);
      --pdf-serif-accent: #8B3A2F;
      --pdf-brand:        ${bc};
    }

    @page { size: A4; margin: 0; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 10.5pt;
      line-height: 1.65;
      color: var(--pdf-ink);
      background: var(--pdf-paper);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Page ───────────────────────────────────────────────────────── */
    .pdf-page {
      width: 794px;
      min-height: 1123px;
      background: var(--pdf-paper);
      page-break-after: always;
      page-break-inside: avoid;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .pdf-page:last-child { page-break-after: auto; }

    .pdf-page--cover    { padding: 48pt 72pt 36pt; }
    .pdf-page--interior { padding: 28pt 64pt 24pt; }

    /* ── Header ─────────────────────────────────────────────────────── */
    .pdf-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding-bottom: 8pt;
      border-bottom: 0.5pt solid var(--pdf-rule);
      margin-bottom: 24pt;
      flex-shrink: 0;
    }
    .pdf-header-left {
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      font-weight: 600;
      color: var(--pdf-ink-muted);
    }
    .pdf-header-right {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8pt;
      color: var(--pdf-ink-muted);
    }

    /* ── Footer ─────────────────────────────────────────────────────── */
    .pdf-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 8pt;
      border-top: 0.5pt solid var(--pdf-rule);
      margin-top: auto;
      flex-shrink: 0;
    }
    .pdf-footer span {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5pt;
      color: var(--pdf-ink-muted);
    }

    /* ── Section content wrapper ─────────────────────────────────────── */
    .section-body { flex: 1; }

    /* ── Cover ───────────────────────────────────────────────────────── */
    .cover-brand {
      display: flex;
      align-items: center;
      gap: 12pt;
      margin-bottom: 12pt;
    }
    .brand-initial {
      width: 40pt;
      height: 40pt;
      border-radius: 4pt;
      background: var(--pdf-brand);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Inter', sans-serif;
      font-size: 18pt;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
    }
    .brand-name {
      font-family: 'Inter', sans-serif;
      font-size: 13pt;
      font-weight: 600;
      color: var(--pdf-ink);
      display: block;
    }
    .brand-handle {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9pt;
      color: var(--pdf-ink-muted);
      display: block;
      margin-top: 2pt;
    }
    .cover-rule {
      height: 2pt;
      background: var(--pdf-brand);
      margin-bottom: 36pt;
    }
    .cover-doc-label {
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--pdf-ink-muted);
      margin-bottom: 12pt;
    }
    .cover-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-style: italic;
      font-size: 32pt;
      line-height: 1.2;
      color: var(--pdf-ink);
      margin-bottom: 16pt;
    }
    .cover-subtitle {
      font-family: 'Inter', sans-serif;
      font-size: 13pt;
      line-height: 1.55;
      color: var(--pdf-ink-soft);
      margin-bottom: 48pt;
    }
    .cover-dateline {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8pt;
      color: var(--pdf-ink-muted);
      margin-bottom: 8pt;
    }
    .cover-dateline-rule {
      height: 0.5pt;
      background: var(--pdf-rule);
      margin-bottom: 36pt;
    }

    /* ── Section label ───────────────────────────────────────────────── */
    .section-label {
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--pdf-ink-muted);
      margin-bottom: 6pt;
    }
    .section-label-rule {
      height: 0.5pt;
      background: var(--pdf-rule);
      margin-bottom: 16pt;
    }
    .section-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-style: italic;
      font-size: 20pt;
      line-height: 1.3;
      color: var(--pdf-ink);
      margin-bottom: 12pt;
    }

    /* ── Body copy ───────────────────────────────────────────────────── */
    .body-copy {
      font-family: 'Inter', sans-serif;
      font-size: 10.5pt;
      line-height: 1.65;
      color: var(--pdf-ink-soft);
      margin-bottom: 16pt;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    /* ── Callout block ───────────────────────────────────────────────── */
    .callout-block {
      background: var(--pdf-surface);
      border-left: 3pt solid var(--pdf-accent);
      border-radius: 0 4pt 4pt 0;
      padding: 10pt 14pt;
      margin-bottom: 16pt;
      page-break-inside: avoid;
    }
    .callout-block p {
      font-family: 'Inter', sans-serif;
      font-size: 10pt;
      font-style: italic;
      line-height: 1.6;
      color: var(--pdf-ink-soft);
    }

    /* ── Module card ─────────────────────────────────────────────────── */
    .module-card {
      background: var(--pdf-surface);
      border: 1pt solid var(--pdf-rule);
      border-radius: 6pt;
      padding: 14pt 16pt;
      margin-bottom: 12pt;
      page-break-inside: avoid;
    }
    .module-card:last-child { margin-bottom: 0; }
    .module-card-label {
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--pdf-accent);
      margin-bottom: 6pt;
    }
    .module-card-divider {
      height: 0.5pt;
      background: var(--pdf-rule);
      margin-bottom: 10pt;
    }
    .module-card-body {
      font-family: 'Inter', sans-serif;
      font-size: 10.5pt;
      line-height: 1.65;
      color: var(--pdf-ink-soft);
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .module-card-meta {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8pt;
      color: var(--pdf-ink-muted);
      margin-top: 10pt;
    }

    /* ── Hero hook ───────────────────────────────────────────────────── */
    .hero-hook {
      font-family: 'Instrument Serif', Georgia, serif;
      font-style: italic;
      font-size: 22pt;
      line-height: 1.35;
      color: var(--pdf-ink);
      margin-bottom: 20pt;
    }

    /* ── Story architecture grid ─────────────────────────────────────── */
    .arch-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8pt;
    }
    .arch-card {
      background: var(--pdf-surface);
      border: 1pt solid var(--pdf-rule);
      border-radius: 6pt;
      padding: 10pt 12pt;
      page-break-inside: avoid;
    }
    .arch-beat {
      font-family: 'Inter', sans-serif;
      font-size: 7.5pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.10em;
      color: var(--pdf-accent);
      margin-bottom: 3pt;
    }
    .arch-timing {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5pt;
      color: var(--pdf-ink-muted);
      margin-bottom: 6pt;
    }
    .arch-content {
      font-family: 'Inter', sans-serif;
      font-size: 9.5pt;
      line-height: 1.55;
      color: var(--pdf-ink-soft);
    }

    /* ── Audience rows ───────────────────────────────────────────────── */
    .audience-row {
      display: flex;
      gap: 16pt;
      padding: 10pt 0;
      border-bottom: 0.5pt solid var(--pdf-rule);
    }
    .audience-row:last-child { border-bottom: none; }
    .audience-label {
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--pdf-ink-muted);
      min-width: 80pt;
      padding-top: 1pt;
      flex-shrink: 0;
    }
    .audience-value {
      font-family: 'Inter', sans-serif;
      font-size: 10pt;
      line-height: 1.6;
      color: var(--pdf-ink-soft);
    }

    /* ── Two-column grid (thumbnails) ────────────────────────────────── */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12pt; }

    /* ── Checklist ───────────────────────────────────────────────────── */
    .checklist-item {
      display: flex;
      gap: 12pt;
      padding: 6pt 0;
      border-bottom: 0.5pt solid var(--pdf-rule);
      page-break-inside: avoid;
    }
    .checklist-item:last-child { border-bottom: none; }
    .checklist-box {
      font-size: 11pt;
      color: var(--pdf-ink-muted);
      margin-left: 20pt;
      flex-shrink: 0;
      line-height: 1.55;
    }
    .checklist-text {
      font-family: 'Inter', sans-serif;
      font-size: 10.5pt;
      line-height: 1.65;
      color: var(--pdf-ink);
    }

    /* ── Notes box ───────────────────────────────────────────────────── */
    .notes-box {
      border: 1pt dashed var(--pdf-rule-strong);
      border-radius: 6pt;
      padding: 12pt 16pt;
      min-height: 64pt;
      margin-top: 16pt;
    }
    .notes-label {
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.10em;
      color: var(--pdf-ink-muted);
    }

    /* ── Lead magnet items ───────────────────────────────────────────── */
    .lm-item {
      display: flex;
      gap: 14pt;
      padding: 12pt 0;
      border-bottom: 0.5pt solid var(--pdf-rule);
      page-break-inside: avoid;
    }
    .lm-item:last-child { border-bottom: none; }
    .lm-num {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11pt;
      color: var(--pdf-accent);
      min-width: 22pt;
      flex-shrink: 0;
      line-height: 1.4;
    }
    .lm-heading {
      font-family: 'Inter', sans-serif;
      font-size: 10.5pt;
      font-weight: 600;
      color: var(--pdf-ink);
      margin-bottom: 4pt;
    }
    .lm-body {
      font-family: 'Inter', sans-serif;
      font-size: 10pt;
      line-height: 1.65;
      color: var(--pdf-ink-soft);
    }

    /* ── Spacers ─────────────────────────────────────────────────────── */
    .sp-8  { height: 8pt;  flex-shrink: 0; }
    .sp-12 { height: 12pt; flex-shrink: 0; }
    .sp-16 { height: 16pt; flex-shrink: 0; }
    .sp-24 { height: 24pt; flex-shrink: 0; }
  `;
}

// ─── SHARED COMPONENT HELPERS ─────────────────────────────────────────────────

function hdr(brandName, docType, pageNum) {
  return `<div class="pdf-header">
    <div class="pdf-header-left">${e(brandName)}${docType ? ' · ' + e(docType) : ''}</div>
    <div class="pdf-header-right">${e(String(pageNum))}</div>
  </div>`;
}

function ftr(brandName) {
  return `<div class="pdf-footer">
    <span>Built with SAM · samforcreators.com</span>
    ${brandName ? `<span>${e(brandName)}</span>` : '<span></span>'}
  </div>`;
}

function sLabel(text) {
  return `<div class="section-label">${e(text)}</div><div class="section-label-rule"></div>`;
}

function card(label, body, meta) {
  if (!body && !label) return '';
  return `<div class="module-card">
    ${label ? `<div class="module-card-label">${e(label)}</div><div class="module-card-divider"></div>` : ''}
    ${body  ? `<div class="module-card-body">${e(body)}</div>` : ''}
    ${meta  ? `<div class="module-card-meta">${e(meta)}</div>` : ''}
  </div>`;
}

function callout(text) {
  if (!text) return '';
  return `<div class="callout-block"><p>${e(text)}</p></div>`;
}

// ─── PLAYBOOK BUILDER ─────────────────────────────────────────────────────────

function buildPlaybookHTML(pb, brand) {
  const brandName   = brand.brandName   || 'Your Brand';
  const brandColor  = brand.brandColor  || '#20808D';
  const brandHandle = brand.brandHandle || '';
  const date        = brand.date        || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const docType     = 'Story Engine Playbook';
  const initial     = brandName.charAt(0).toUpperCase();

  const pages = [];

  // ── 01 Cover ───────────────────────────────────────────────────────────────
  const coverTitle = pb.hook || pb.lead_magnet?.title || 'Your Story, Engineered.';
  const coverSub   = pb.diagnosis ? pb.diagnosis.split('.')[0] + '.' : '';

  pages.push(`<div class="pdf-page pdf-page--cover">
    <div class="cover-brand">
      <div class="brand-initial" style="background:${e(brandColor)}">${e(initial)}</div>
      <div>
        <span class="brand-name">${e(brandName)}</span>
        ${brandHandle ? `<span class="brand-handle">${e(brandHandle)}</span>` : ''}
      </div>
    </div>
    <div class="cover-rule"></div>
    <div class="cover-doc-label">${e(docType)}</div>
    <h1 class="cover-title">${e(coverTitle)}</h1>
    ${coverSub ? `<p class="cover-subtitle">${e(coverSub)}</p>` : ''}
    <div class="cover-dateline">${e(date)} · BUILT BY SAM</div>
    <div class="cover-dateline-rule"></div>
    <div style="flex:1"></div>
    ${ftr(brandName)}
  </div>`);

  // ── 02 Story Diagnosis ─────────────────────────────────────────────────────
  if (pb.diagnosis) {
    pages.push(`<div class="pdf-page pdf-page--interior">
      ${hdr(brandName, docType, '02')}
      <div class="section-body">
        ${sLabel('Story Diagnosis')}
        <h2 class="section-title">${e(pb.diagnosis)}</h2>
        ${pb.diagnosis_why ? `<p class="body-copy">${e(pb.diagnosis_why)}</p>` : ''}
      </div>
      ${ftr(brandName)}
    </div>`);
  }

  // ── 03 Story Architecture ──────────────────────────────────────────────────
  const arch = pb.story_architecture || {};
  const beats = [
    { label: 'Opening',  timing: '0–3s',    content: arch.opening },
    { label: 'Setup',    timing: '3–15s',   content: arch.setup   },
    { label: 'Risk',     timing: '15–30s',  content: arch.risk    },
    { label: 'Turn',     timing: '30–50s',  content: arch.turn    },
    { label: 'Payoff',   timing: '50–70s',  content: arch.payoff  },
    { label: 'CTA',      timing: 'Final 5s',content: arch.cta     },
  ].filter(b => b.content);

  if (beats.length) {
    const beatCards = beats.map(b => `<div class="arch-card">
      <div class="arch-beat">${e(b.label)}</div>
      <div class="arch-timing">${e(b.timing)}</div>
      <div class="arch-content">${e(b.content)}</div>
    </div>`).join('');

    pages.push(`<div class="pdf-page pdf-page--interior">
      ${hdr(brandName, docType, '03')}
      <div class="section-body">
        ${sLabel('Story Architecture')}
        <div class="arch-grid">${beatCards}</div>
      </div>
      ${ftr(brandName)}
    </div>`);
  }

  // ── 04 Hook ────────────────────────────────────────────────────────────────
  if (pb.hook) {
    pages.push(`<div class="pdf-page pdf-page--interior">
      ${hdr(brandName, docType, '04')}
      <div class="section-body">
        ${sLabel('Your Hook')}
        <div class="hero-hook">${e(pb.hook)}</div>
        ${pb.hook_why ? callout(pb.hook_why) : ''}
      </div>
      ${ftr(brandName)}
    </div>`);
  }

  // ── 05 Full Script ─────────────────────────────────────────────────────────
  const script = pb.full_script || pb.narration_script;
  if (script) {
    pages.push(`<div class="pdf-page pdf-page--interior">
      ${hdr(brandName, docType, '05')}
      <div class="section-body">
        ${sLabel('Full Script')}
        <p class="body-copy">${e(script)}</p>
        ${pb.pacing_note ? callout('Pacing: ' + pb.pacing_note) : ''}
      </div>
      ${ftr(brandName)}
    </div>`);
  }

  // ── 06 Platform Strategy ───────────────────────────────────────────────────
  const platforms = (pb.platform_strategies || []).filter(p => p && (p.strategy || p.caption));
  if (platforms.length) {
    const platformCards = platforms.map(p => {
      const body = [p.strategy, p.caption].filter(Boolean).join('\n\n');
      return card(p.platform, body, p.hashtags || null);
    }).join('');

    pages.push(`<div class="pdf-page pdf-page--interior">
      ${hdr(brandName, docType, '06')}
      <div class="section-body">
        ${sLabel('Platform Strategy')}
        ${platformCards}
      </div>
      ${ftr(brandName)}
    </div>`);
  }

  // ── 07 Audience Profile ────────────────────────────────────────────────────
  const aud = pb.audience_profile || {};
  const audFields = [
    { label: 'Who',          value: aud.who            },
    { label: 'Pain Points',  value: aud.pain_points    },
    { label: 'Secret Want',  value: aud.secret_want    },
    { label: 'Where',        value: aud.where          },
    { label: 'Hooks Them',   value: aud.what_hooks_them},
    { label: 'Loses Them',   value: aud.what_loses_them},
    { label: 'Voice',        value: aud.voice          },
  ].filter(f => f.value);

  if (audFields.length) {
    const rows = audFields.map(f => `<div class="audience-row">
      <div class="audience-label">${e(f.label)}</div>
      <div class="audience-value">${e(f.value)}</div>
    </div>`).join('');

    pages.push(`<div class="pdf-page pdf-page--interior">
      ${hdr(brandName, docType, '07')}
      <div class="section-body">
        ${sLabel('Audience Profile')}
        ${rows}
        ${aud.why ? `<div class="sp-16"></div>${callout(aud.why)}` : ''}
      </div>
      ${ftr(brandName)}
    </div>`);
  }

  // ── 08 Thumbnail Strategy ──────────────────────────────────────────────────
  const thumb = pb.thumbnail_strategy || {};
  if (thumb.headline_safe || thumb.headline_bold) {
    const safeBody = [thumb.headline_safe, thumb.subtext_safe].filter(Boolean).join('\n');
    const boldBody = [thumb.headline_bold, thumb.subtext_bold].filter(Boolean).join('\n');

    pages.push(`<div class="pdf-page pdf-page--interior">
      ${hdr(brandName, docType, '08')}
      <div class="section-body">
        ${sLabel('Thumbnail Strategy')}
        <div class="two-col">
          ${safeBody ? card('Conservative', safeBody, null) : ''}
          ${boldBody ? card('Bold', boldBody, null) : ''}
        </div>
        ${thumb.layout_direction ? `<div class="sp-12"></div>${callout('Layout: ' + thumb.layout_direction)}` : ''}
      </div>
      ${ftr(brandName)}
    </div>`);
  }

  // ── 09 Lead Magnet ─────────────────────────────────────────────────────────
  const lm = pb.lead_magnet || {};
  const lmItems = (lm.items || []).filter(i => i && (i.heading || i.body));
  if (lm.title || lmItems.length) {
    const itemsHTML = lmItems.map((item, idx) => `<div class="lm-item">
      <div class="lm-num">${String(idx + 1).padStart(2, '0')}</div>
      <div>
        ${item.heading ? `<div class="lm-heading">${e(item.heading)}</div>` : ''}
        ${item.body    ? `<div class="lm-body">${e(item.body)}</div>` : ''}
      </div>
    </div>`).join('');

    pages.push(`<div class="pdf-page pdf-page--interior">
      ${hdr(brandName, docType, '09')}
      <div class="section-body">
        ${sLabel('Free Resource')}
        ${lm.title ? `<h2 class="section-title">${e(lm.title)}</h2>` : ''}
        ${lm.why   ? callout(lm.why) : ''}
        ${itemsHTML}
        ${lm.comment_response ? `<div class="sp-16"></div>${card('Comment to Post', lm.comment_response, null)}` : ''}
      </div>
      ${ftr(brandName)}
    </div>`);
  }

  // ── 10 Focus Directive ─────────────────────────────────────────────────────
  if (pb.focus_directive) {
    pages.push(`<div class="pdf-page pdf-page--interior">
      ${hdr(brandName, docType, '10')}
      <div class="section-body">
        ${sLabel('Focus Directive')}
        <h2 class="section-title">Your next move.</h2>
        <p class="body-copy">${e(pb.focus_directive)}</p>
        <div class="sp-24"></div>
        <div class="notes-box"><div class="notes-label">Your notes</div></div>
      </div>
      ${ftr(brandName)}
    </div>`);
  }

  return wrap(`SAM · ${e(brandName)} · ${e(docType)}`, brandColor, pages.join('\n'));
}

// ─── LEAD MAGNET BUILDER ──────────────────────────────────────────────────────

function buildLeadMagnetHTML(lm, brand) {
  const brandName   = brand.brandName   || 'Your Brand';
  const brandColor  = brand.brandColor  || '#20808D';
  const brandHandle = brand.brandHandle || '';
  const date        = brand.date        || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const initial     = brandName.charAt(0).toUpperCase();
  const docType     = 'Lead Magnet';

  const pages = [];

  // ── Cover ──────────────────────────────────────────────────────────────────
  pages.push(`<div class="pdf-page pdf-page--cover">
    <div class="cover-brand">
      <div class="brand-initial" style="background:${e(brandColor)}">${e(initial)}</div>
      <div>
        <span class="brand-name">${e(brandName)}</span>
        ${brandHandle ? `<span class="brand-handle">${e(brandHandle)}</span>` : ''}
      </div>
    </div>
    <div class="cover-rule"></div>
    <div class="cover-doc-label">Free Resource</div>
    <h1 class="cover-title">${e(lm.title || 'Your Free Resource')}</h1>
    ${lm.why ? `<p class="cover-subtitle">${e(lm.why)}</p>` : ''}
    <div class="cover-dateline">${e(date)} · BUILT BY SAM</div>
    <div class="cover-dateline-rule"></div>
    <div style="flex:1"></div>
    ${ftr(brandName)}
  </div>`);

  // ── Content items ──────────────────────────────────────────────────────────
  const items = (lm.items || []).filter(i => i && (i.heading || i.body));
  if (items.length) {
    const itemsHTML = items.map((item, idx) => `<div class="lm-item">
      <div class="lm-num">${String(idx + 1).padStart(2, '0')}</div>
      <div>
        ${item.heading ? `<div class="lm-heading">${e(item.heading)}</div>` : ''}
        ${item.body    ? `<div class="lm-body">${e(item.body)}</div>` : ''}
      </div>
    </div>`).join('');

    pages.push(`<div class="pdf-page pdf-page--interior">
      ${hdr(brandName, docType, '02')}
      <div class="section-body">
        ${sLabel("What's Inside")}
        ${itemsHTML}
        ${lm.comment_response ? `<div class="sp-16"></div>${card('Comment to Post', lm.comment_response, null)}` : ''}
      </div>
      ${ftr(brandName)}
    </div>`);
  }

  return wrap(`SAM · ${e(brandName)} · Lead Magnet`, brandColor, pages.join('\n'));
}

// ─── HTML WRAPPER ─────────────────────────────────────────────────────────────

function wrap(title, brandColor, pagesHTML) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${e(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
  <style>${sharedCSS(brandColor)}</style>
</head>
<body>
${pagesHTML}
</body>
</html>`;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function e(value) { return escapeHtml(value); }

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
