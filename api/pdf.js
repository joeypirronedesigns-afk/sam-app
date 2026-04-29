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

    const title =
      type === 'playbook'
        ? (playbookData?.hook || playbookData?.lead_magnet?.title || 'Playbook')
        : (leadMagnetData?.title || 'Lead Magnet');

    const content =
      type === 'playbook'
        ? `
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(playbookData?.diagnosis || '')}</p>
          <h2>Hook</h2>
          <p>${escapeHtml(playbookData?.hook || '')}</p>
          <h2>Script</h2>
          <pre style="white-space: pre-wrap; font: inherit;">${escapeHtml(playbookData?.full_script || '')}</pre>
        `
        : `
          <h1>${escapeHtml(leadMagnetData?.title || 'Lead Magnet')}</h1>
          <p>${escapeHtml(leadMagnetData?.why || '')}</p>
          ${(leadMagnetData?.items || [])
            .map(
              (item) => `
                <h2>${escapeHtml(item.heading || '')}</h2>
                <p>${escapeHtml(item.body || '')}</p>
              `
            )
            .join('')}
        `;

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(title)}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              color: #111;
              line-height: 1.5;
            }
            h1, h2 {
              margin-bottom: 12px;
            }
            p, pre {
              margin-bottom: 16px;
            }
            .meta {
              color: #666;
              font-size: 14px;
              margin-bottom: 24px;
            }
          </style>
        </head>
        <body>
          <div class="meta">
            ${escapeHtml(brandData?.brandName || 'SAM')} · ${escapeHtml(type)}
          </div>
          ${content}
        </body>
      </html>
    `;

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
      waitUntil: 'domcontentloaded',
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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
