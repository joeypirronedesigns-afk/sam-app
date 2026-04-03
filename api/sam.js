module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mode, moment, platforms, contentType, creatorContext, tone, audienceDemographics, outputLanguage, emojiPreference } = req.body;
  if (!moment || !mode) return res.status(400).json({ error: 'Missing mode or moment' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const PLATFORM_SPECS = {
    'TikTok': { caption_limit: 2200, hashtag_rule: '3-5 hashtags', caption_note: 'Hook in first line. Up to 2200 chars.', video_note: 'Vertical 9:16, under 60s.' },
    'YouTube Shorts': { caption_limit: 100, title: true, hashtag_rule: 'First 3 hashtags above title', caption_note: 'Title up to 100 chars is critical.', video_note: 'Vertical 9:16, under 60s.' },
    'YouTube': { caption_limit: 5000, title: true, hashtag_rule: 'Up to 15 hashtags; first 3 above title', caption_note: 'Title up to 100 chars. Front-load keywords.', video_note: 'Horizontal 16:9.' },
    'Instagram Reels': { caption_limit: 2200, hashtag_rule: '3-5 focused hashtags', caption_note: 'First 125 chars critical. Hashtags at end.', video_note: 'Vertical 9:16, 3s-90s.' },
    'Facebook Reels': { caption_limit: 477, hashtag_rule: '2-3 hashtags max', caption_note: 'Under 477 chars. 2-3 hashtags max.', video_note: 'Vertical 9:16, under 60s.' },
    'LinkedIn': { caption_limit: 3000, hashtag_rule: '3-5 hashtags at end', caption_note: 'Up to 3000 chars. First 210 chars critical.', video_note: 'Square 1:1 or vertical 4:5.' },
    'X (Twitter)': { caption_limit: 280, hashtag_rule: '1-2 hashtags max', caption_note: 'Hard 280 char limit.', video_note: 'Under 2:20 length.' }
  };

  const getPlatformContext = (platList) => {
    if (!platList || platList.length === 0) return '';
    return platList.map(p => {
      const spec = PLATFORM_SPECS[p];
      if (!spec) return p;
      return `${p}: ${spec.caption_note} ${spec.hashtag_rule}.`;
    }).join(' | ');
  };

  const platformContext = platforms && platforms.length > 0 ? 'PLATFORM SPECS: ' + getPlatformContext(platforms) : '';
  const formatContext = contentType ? 'Content format: ' + contentType + '.' : '';
  const creatorLine = creatorContext ? 'About this creator: ' + creatorContext + '.' : '';
  const languageLine = outputLanguage ? 'Write ENTIRE output in ' + outputLanguage + '.' : '';
  const emojiLine = emojiPreference === 'no' ? 'NO emojis.' : emojiPreference === 'lots' ? 'Use emojis freely.' : 'Max 1-2 emojis per section.';
  const toneMap = {
    'Authentic/Natural': 'Tone: Authentic, real, conversational.',
    'Viral/Hype': 'Tone: Viral, bold, punchy.',
    'Wise/Mentor': 'Tone: Wise, thoughtful, mentor-like.',
    'Bubbly/Energetic': 'Tone: Bubbly, warm, energetic.'
  };
  const toneContext = toneMap[tone] || toneMap['Authentic/Natural'];
  const base = `You are S.A.M. — Strategic Assistant for Making. ${toneContext} ${emojiLine} ${creatorLine} ${languageLine} ${platformContext} ${formatContext} CRITICAL: Respond ONLY with valid JSON. No markdown. No backticks. No explanation.`;

  const streamCall = async (system, userContent, maxTokens) => {
    console.log('streamCall - maxTokens:', maxTokens, '- model: claude-sonnet-4-6');
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, stream: true, system, messages: [{ role: 'user', content: userContent }] })
    });
    console.log('Anthropic response status:', r.status);
    if (!r.ok) {
      const e = await r.text().catch(() => '');
      console.error('Anthropic error:', r.status, e.slice(0, 300));
      throw new Error('Anthropic error ' + r.status + (e ? ': ' + e.slice(0, 200) : ''));
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        try {
          const evt = JSON.parse(raw);
          if (evt.type === 'content_block_delta' && evt.delta?.text) {
            full += evt.delta.text;
            res.write('data: ' + JSON.stringify({ t: evt.delta.text }) + '\n\n');
          }
        } catch (_) {}
      }
    }
    // Clean and parse
    let clean = full.trim();
    // Strip markdown code fences
    clean = clean.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    // Extract first complete JSON object
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      clean = clean.slice(firstBrace, lastBrace + 1);
    }
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch(e) {
      // Send error through stream so frontend shows it properly
      res.write('data: ' + JSON.stringify({ error: 'SAM had trouble formatting the response. Please try again.' }) + '\n\n');
      res.end();
      return;
    }
    res.write('data: ' + JSON.stringify({ done: true, result: parsed }) + '\n\n');
    res.end();
  };

  const errOut = (msg) => {
    if (res.headersSent) { res.write('data: ' + JSON.stringify({ error: msg }) + '\n\n'); res.end(); }
    else res.status(500).json({ error: msg });
  };

  try {

    // ── CALENDAR ─────────────────────────────────────────────────────────────
    if (mode === 'calendar') {
      const platList = platforms && platforms.length > 0 ? platforms : ['TikTok','YouTube Shorts','Instagram Reels','Facebook Reels'];
      const prompt = base + ' Build a 7-day posting plan. Rotate across: ' + platList.join(', ') + '. Return ONLY: {"days":[{"platform":"name","post_type":"format","content":"ready-to-post caption"}]}';
      return await streamCall(prompt, moment, 1600);
    }

    // ── IDEAS ─────────────────────────────────────────────────────────────────
    if (mode === 'ideas') {
      const platList = platforms && platforms.length > 0 ? platforms : ['TikTok','YouTube Shorts','Instagram Reels'];
      const prompt = base + ' Generate exactly 5 specific content ideas. Return ONLY: {"ideas":[{"title":"idea title","why":"one sentence why this performs","best_platform":"single platform name"}]}';
      return await streamCall(prompt, moment, 900);
    }

    // ── UPLOAD (image analysis) ───────────────────────────────────────────────
    if (mode === 'upload') {
      const imageBase64 = req.body.imageBase64 || null;
      const imageType = req.body.imageType || 'image/jpeg';
      const forceType = req.body.forceType || null;

      // PHOTO mode — focused output, lean JSON
      console.log('UPLOAD MODE - forceType:', forceType, '- hasImage:', !!imageBase64, '- imageSize:', imageBase64 ? Math.round(imageBase64.length/1024) + 'KB' : '0');
      if (forceType === 'photo' || (!forceType && imageBase64)) {
        const photoSystem = `You are S.A.M. ${toneContext} ${emojiLine} ${creatorLine}
The user uploaded this image. Your job is to build a thumbnail strategy that sounds EXACTLY like this creator — use their niche, their tone, their voice. Do NOT write generic headlines. Write headlines this specific creator would actually say.

Generate TWO headline options:
- headline_safe: relatable, story-driven, true to their voice
- headline_bold: provocative, curiosity-gap, scroll-stopping — but still authentic to them

Both headlines must be 3-7 words MAX, ALL CAPS, specific to what's in the image AND their niche.
The subtext (2-4 words) should contrast or amplify the headline emotionally.

Return ONLY this exact JSON:
{"type":"photo","what_sam_sees":"one sentence describing the image","content_angle":"the scroll-stopping story angle","content_type":"one of: transformation, emotional, achievement, tutorial, shock, personal, renovation, numbers, story, documentary","headline_safe":"3-7 WORD SAFE HEADLINE IN THEIR VOICE","headline_bold":"3-7 WORD BOLD HEADLINE IN THEIR VOICE","subtext_safe":"2-4 word contrast line","subtext_bold":"2-4 word contrast line","thumbnail_color":"#FF4500","platforms":[{"platform":"TikTok","title":"hook title under 60 chars","description":"caption under 150 chars","hashtags":"#tag1 #tag2 #tag3"},{"platform":"YouTube","title":"SEO title under 70 chars","description":"description under 150 chars","hashtags":"#tag1 #tag2 #tag3"},{"platform":"Instagram Reels","title":"","description":"caption under 125 chars","hashtags":"#tag1 #tag2 #tag3"}]}
CRITICAL: Return ONLY valid JSON. Nothing else.`;

        const userContent = imageBase64
          ? [{ type: 'image', source: { type: 'base64', media_type: imageType, data: imageBase64 } }, { type: 'text', text: moment || 'Analyse this image and build my thumbnail strategy.' }]
          : moment;
        return await streamCall(photoSystem, userContent, 1200);
      }

      // ANALYTICS mode
      if (forceType === 'analytics') {
        const analyticsSystem = `You are S.A.M. ${toneContext} ${emojiLine} ${creatorLine} Analyse this analytics screenshot. Use what you know about the creator's niche to make recommendations specific to their content type — not generic advice. Return ONLY this exact JSON:
{"type":"analytics","headline":"biggest insight in one punchy sentence","whats_working":["observation 1","observation 2","observation 3"],"whats_not":["area to improve 1","area to improve 2"],"post_next":["specific content idea 1","specific content idea 2","specific content idea 3"],"growth_move":"one bold strategic move to make right now"}
CRITICAL: Return ONLY valid JSON. Nothing else.`;

        const userContent = imageBase64
          ? [{ type: 'image', source: { type: 'base64', media_type: imageType, data: imageBase64 } }, { type: 'text', text: moment || 'Analyse my analytics.' }]
          : moment;
        return await streamCall(analyticsSystem, userContent, 900);
      }

      // TEXT ONLY fallback
      const textSystem = base + ' Analyse this content idea. Return ONLY: {"type":"text_only","diagnosis":"what this idea is really about — 2 sentences","hook_ideas":["hook 1","hook 2","hook 3"],"content_angle":"strongest angle to take","best_platform":"single best platform","next_action":"the one thing to do right now"}';
      return await streamCall(textSystem, moment, 700);
    }

    // ── CONCEPT ───────────────────────────────────────────────────────────────
    if (mode === 'concept') {
      const conceptStyle = req.body.contentType || '';
      const conceptPlatforms = req.body.platforms && req.body.platforms.length > 0 ? req.body.platforms : ['TikTok','YouTube Shorts'];
      const styleStr = conceptStyle ? 'Concept style: ' + conceptStyle + '.' : '';
      const prompt = base + ' Target platforms: ' + conceptPlatforms.join(', ') + '. ' + styleStr + ' Generate ONE bold scroll-stopping video concept. Assign a real virality_score 60-100 based on actual concept strength. Return ONLY: {"title":"6-10 word title","format":"format type","premise":"2-3 sentences","why_it_works":"2 sentences","production_notes":["note 1","note 2","note 3"],"hook_line":"exact opening sentence","twist":"unexpected angle","virality_score":85}';
      return await streamCall(prompt, moment, 1000);
    }

    // ── THE PULSE ─────────────────────────────────────────────────────────────
    const textPostInstruction = 'Write a complete text post. No brackets. Hook first, short paragraphs, ends with CTA.';
    const scriptInstructions = {
      'Short-form video': 'Write word-for-word spoken script 60-90 seconds. Use [HOOK],[SETUP],[TENSION],[PAYOFF],[CTA] beats. Pacing notes in (parentheses).',
      'Long-form YouTube video': 'Write complete script 8-12 minutes. Label: [INTRO HOOK],[CONTEXT],[MAIN STORY],[LESSONS],[OUTRO CTA].',
      'LinkedIn text post': 'Write complete LinkedIn post. Strong opener, short paragraphs, question at end. 3 hashtags.',
      'Instagram caption': 'Write complete caption. Hook first line under 125 chars, body, CTA, 5 hashtags.',
      'Email newsletter': 'Write complete email: SUBJECT LINE, PREVIEW TEXT, then full BODY.',
      'Text post': textPostInstruction
    };
    const scriptInstruction = scriptInstructions[contentType] || scriptInstructions['Short-form video'];
    const allPlatList = platforms && platforms.length > 0 ? platforms : ['TikTok','Instagram Reels'];
    const platStratInstruction = 'Write caption + hashtags for EACH platform, respecting character limits: ' + allPlatList.join(', ') + '.';

    const pulsePrompt = base + ' ' + scriptInstruction + ' ' + platStratInstruction +
      ' Return ONLY: {"diagnosis":"2-3 sentences on emotional core","hook":"single best opening line — SAMs top pick","visual_note":"what to show on screen first 3 seconds","full_script":"COMPLETE script","b_roll":["shot 1","shot 2","shot 3","shot 4"],"pacing_note":"one delivery tip","cta":"call to action","platform_strategies":[{"platform":"name","strategy":"one tip","caption":"ready-to-post caption","hashtags":"hashtags"}]}';

    return await streamCall(pulsePrompt, moment, 2400);

  } catch (err) {
    errOut(err.message || 'Something went wrong.');
  }
};
