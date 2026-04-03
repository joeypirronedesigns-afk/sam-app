module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mode, moment, platforms, contentType, creatorContext, tone, audienceDemographics, outputLanguage, emojiPreference } = req.body;
  if (!moment || !mode) return res.status(400).json({ error: 'Missing mode or moment' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const PLATFORM_SPECS = {
    'TikTok': {
      caption_limit: 2200, title: false,
      hashtag_rule: '3-5 hashtags, included in caption limit',
      caption_note: 'Hook must be in first line — algorithm judges first 1-2 seconds. Caption up to 2,200 chars.',
      video_note: 'Vertical 9:16, 15s–10min. Under 60s performs best for new accounts.'
    },
    'YouTube Shorts': {
      caption_limit: 100, title_limit: 100, title: true,
      hashtag_rule: 'First 3 hashtags appear above the video title in the Shorts feed',
      caption_note: 'Description only shows ~100 chars in Shorts feed. Title up to 100 chars is critical.',
      video_note: 'Vertical 9:16, under 60 seconds. Title is the primary discovery hook.'
    },
    'YouTube': {
      caption_limit: 5000, title_limit: 100, title: true,
      hashtag_rule: 'Up to 15 hashtags; first 3 appear above the video title. Put key ones in description.',
      caption_note: 'Title up to 100 chars. Description up to 5,000 chars — first 2-3 lines show before "Show more". Front-load keywords.',
      video_note: 'Horizontal 16:9 standard. Search-optimised title is critical for discovery.'
    },
    'Instagram Reels': {
      caption_limit: 2200, title: false,
      hashtag_rule: 'Up to 30 hashtags allowed; 3-5 focused niche hashtags perform better than 30 generic ones',
      caption_note: 'Caption up to 2,200 chars but only ~125 chars show before "more". First line is critical. Hashtags go at the end or in first comment.',
      video_note: 'Vertical 9:16, 3s–90s. Reels get pushed to non-followers more than any other IG format.'
    },
    'Facebook Reels': {
      caption_limit: 477, title: false,
      hashtag_rule: '2-3 hashtags max — Facebook algorithm does not boost posts with many hashtags',
      caption_note: 'Only ~477 chars show before truncation. Keep captions punchy. 2-3 hashtags maximum.',
      video_note: 'Vertical 9:16, under 60s optimal. Facebook Reels reach non-followers — hook in first 3 seconds critical.'
    },
    'LinkedIn': {
      caption_limit: 3000, title: false,
      hashtag_rule: '3-5 hashtags placed at the end of the post',
      caption_note: 'Up to 3,000 chars. First ~210 chars show before "see more" — make them count. Professional but personal tone works best.',
      video_note: 'Square 1:1 or vertical 4:5 performs best. Native video gets 5x more reach than links. Add captions — 85% watch without sound.'
    },
    'X (Twitter)': {
      caption_limit: 280, title: false,
      hashtag_rule: '1-2 hashtags max — they count toward 280 character limit',
      caption_note: 'Hard 280 character limit including hashtags and links (links count as 23 chars). Every word counts.',
      video_note: 'Landscape 16:9 or square 1:1. Under 2:20 length. Captions auto-generated but check them.'
    }
  };

  const getPlatformContext = (platList) => {
    if (!platList || platList.length === 0) return '';
    return platList.map(p => {
      const spec = PLATFORM_SPECS[p];
      if (!spec) return p + ': standard short-form video platform.';
      return p + ': ' + spec.caption_note + ' ' + spec.hashtag_rule + '. ' + spec.video_note;
    }).join(' | ');
  };

  const platformContext = platforms && platforms.length > 0
    ? 'PLATFORM SPECS — follow these exactly: ' + getPlatformContext(platforms) : '';
  const formatContext = contentType ? 'Content format: ' + contentType + '.' : '';
  const creatorLine = creatorContext ? 'About this creator: ' + creatorContext + '.' : '';
  const languageLine = outputLanguage
    ? 'IMPORTANT: Write the ENTIRE output in ' + outputLanguage + '. Do not use English except inside JSON field names.' : '';
  const emojiLine = emojiPreference === 'no' ? 'IMPORTANT: Do NOT use any emojis. Zero.'
    : emojiPreference === 'lots' ? 'Use emojis freely and expressively throughout.'
    : 'Use emojis sparingly — maximum 1-2 per section.';

  const dialectMap = {
    'Australia': 'Write in authentic Australian vernacular.',
    'UK': 'Write in authentic British English.',
    'Canada': 'Write in Canadian English.',
    'USA': 'Write in natural American English.',
    'North America': 'Write in natural North American English.',
    'English-speaking countries': 'Write in clear, accessible English.',
    'worldwide': 'Write in simple, clear, universally accessible English.'
  };
  let dialectNote = '';
  if (audienceDemographics && !outputLanguage) {
    for (const [location, dialect] of Object.entries(dialectMap)) {
      if (audienceDemographics.includes(location)) { dialectNote = dialect; break; }
    }
  }
  const audienceLine = audienceDemographics ? 'Target audience: ' + audienceDemographics + '. ' + dialectNote : '';
  const toneDescriptions = {
    'Authentic/Natural': 'Tone: Authentic and natural. Real, grounded, conversational.',
    'Viral/Hype': 'Tone: Viral and high energy. Bold, punchy, scroll-stopping.',
    'Wise/Mentor': 'Tone: Wise and mentor-like. Thoughtful, insight-driven, builds trust.',
    'Bubbly/Energetic': 'Tone: Bubbly and energetic. Warm, fun, uplifting.'
  };
  const toneContext = toneDescriptions[tone] || toneDescriptions['Authentic/Natural'];
  const base = 'You are S.A.M. — Strategic Assistant for Making. ' + toneContext + ' ' + emojiLine + ' ' + creatorLine + ' ' + audienceLine + ' ' + languageLine + ' ' + platformContext + ' ' + formatContext + ' CRITICAL: Respond ONLY with valid JSON. No markdown. No backticks. No preamble.';

  // ── STREAM helper — sends SSE chunks, ends with { done, result } ──────────
  const streamCall = async (system, userContent, maxTokens) => {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: maxTokens, stream: true, system, messages: [{ role: 'user', content: userContent }] })
    });
    if (!r.ok) {
      const e = await r.text().catch(() => '');
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
    const clean = full.replace(/```json[\s\S]*?```/g, m => m.slice(7, -3)).replace(/```/g, '').replace(/^json\s*/i, '').trim();
    let parsed;
    try { parsed = JSON.parse(clean); }
    catch (e) { throw new Error('JSON parse failed: ' + e.message); }
    res.write('data: ' + JSON.stringify({ done: true, result: parsed }) + '\n\n');
    res.end();
  };

  const errOut = (msg) => {
    if (res.headersSent) { res.write('data: ' + JSON.stringify({ error: msg }) + '\n\n'); res.end(); }
    else res.status(500).json({ error: msg });
  };

  try {

    // ── CALENDAR ────────────────────────────────────────────────────────────
    if (mode === 'calendar') {
      const platList = platforms && platforms.length > 0 ? platforms : ['TikTok','YouTube Shorts','YouTube','Instagram Reels','Facebook Reels','LinkedIn','X (Twitter)'];
      const prompt = base + ' Build a concise 7-day posting plan. Keep each day short and punchy. Rotate across: ' + platList.join(', ') + '. Return exactly: {"days":[{"platform":"platform name","post_type":"format","content":"ready-to-post caption respecting that platforms character limit","tip":"one tactical tip","ideal_time":"specific time + brief reason"}]}';
      return await streamCall(prompt, moment, 1400);
    }

    // ── IDEAS ───────────────────────────────────────────────────────────────
    if (mode === 'ideas') {
      const platList = platforms && platforms.length > 0 ? platforms : ['TikTok','YouTube Shorts','YouTube','Instagram Reels','Facebook Reels','LinkedIn','X (Twitter)'];
      const prompt = base + ' Generate exactly 10 specific, actionable content ideas for this week across: ' + platList.join(', ') + '. Return: {"ideas":[{"title":"specific idea title","why":"one sentence why this performs","best_platform":"single best platform name"}]}';
      return await streamCall(prompt, moment, 1400);
    }

    // ── UPLOAD ──────────────────────────────────────────────────────────────
    if (mode === 'upload') {
      const imageBase64 = req.body.imageBase64 || null;
      const imageType = req.body.imageType || 'image/jpeg';
      const uploadPlatforms = req.body.platforms && req.body.platforms.length > 0 ? req.body.platforms : ['TikTok','YouTube Shorts','YouTube','Instagram Reels','Facebook Reels','LinkedIn','X (Twitter)'];
      const platStr = 'Target platforms: ' + uploadPlatforms.join(', ') + '. Platform specs: ' + getPlatformContext(uploadPlatforms);
      const uploadSystem = [
        'You are S.A.M. — Strategic Assistant for Making.', platStr,
        'STEP 1: Classify based on whether an IMAGE is present. If an image exists, classify as analytics or photo — NEVER text_only. text_only is ONLY for when no image was provided at all. Any accompanying text is just context.',
        'STEP 2: Return matching JSON. No markdown. No backticks.',
        'IF analytics: {"type":"analytics","headline":"biggest insight","whats_working":["obs 1","obs 2","obs 3"],"whats_not":["improve 1","improve 2"],"post_next":["idea 1","idea 2","idea 3"],"best_time":"optimal posting time","growth_move":"one bold strategic move"}',
        'IF photo: {"type":"photo","what_sam_sees":"one sentence","content_angle":"scroll-stopping angle","thumbnail_strategy":"crop advice","thumbnail_headline":"ALL CAPS 3-6 words","thumbnail_subtext":"optional 2-4 words","thumbnail_emotion":"one word","thumbnail_color":"hex e.g. #FF4500","platforms":[{"platform":"TikTok","title":"hook title under 100 chars","description":"caption under 2200 chars","hashtags":"3-5 hashtags"},{"platform":"YouTube Shorts","title":"SEO title under 100 chars","description":"under 100 chars","hashtags":"3 hashtags"},{"platform":"YouTube","title":"SEO title under 100 chars","description":"150-300 chars","hashtags":"5-8 hashtags"},{"platform":"Instagram Reels","title":"","description":"caption under 2200 chars","hashtags":"3-5 hashtags"},{"platform":"Facebook Reels","title":"","description":"under 477 chars","hashtags":"2-3 hashtags"},{"platform":"LinkedIn","title":"","description":"under 3000 chars","hashtags":"3-5 hashtags"},{"platform":"X (Twitter)","title":"","description":"under 240 chars","hashtags":"1-2 hashtags"}]}',
        'IF text_only: {"type":"text_only","diagnosis":"what this idea is about","hook_ideas":["hook 1","hook 2","hook 3"],"best_platform":"single best platform","platform_reason":"why","content_angle":"strongest angle","next_action":"most important next step"}',
        'CRITICAL: Return ONLY valid JSON.'
      ].join(' ');
      const userContent = imageBase64
        ? [{ type: 'image', source: { type: 'base64', media_type: imageType, data: imageBase64 } }, { type: 'text', text: moment || 'Analyse this.' }]
        : moment;
      return await streamCall(uploadSystem, userContent, 1800);
    }

    // ── CONCEPT ─────────────────────────────────────────────────────────────
    if (mode === 'concept') {
      const conceptStyle = req.body.contentType || '';
      const conceptPlatforms = req.body.platforms && req.body.platforms.length > 0 ? req.body.platforms : ['TikTok','YouTube Shorts','YouTube','Instagram Reels','Facebook Reels','LinkedIn','X (Twitter)'];
      const platStr = 'Target platform(s): ' + conceptPlatforms.join(', ') + '. ' + getPlatformContext(conceptPlatforms);
      const styleStr = conceptStyle ? 'Concept style: ' + conceptStyle + '.' : '';
      const prompt = base + ' ' + platStr + ' ' + styleStr + ' Generate ONE bold scroll-stopping video concept. Return: {"title":"6-10 word title","format":"format type","premise":"2-3 sentences","why_it_works":"2 sentences","production_notes":["note 1","note 2","note 3","note 4"],"hook_line":"exact first sentence","best_platform":"single platform","platform_reason":"one sentence why","twist":"unexpected angle","virality_score":100,"video_title":"SEO title","video_description":"description with CTA","video_hashtags":["tag1","tag2","tag3","tag4","tag5"]}';
      return await streamCall(prompt, moment, 1800);
    }

    // ── FOCUS ────────────────────────────────────────────────────────────────
    if (mode === 'focus') {
      const focusSummary = req.body.focusSummary || '';
      const prompt = base + ' Give ONE specific action for the next 30 minutes. Start with a verb. Return: {"action":"one specific action","sub":"one sentence why now"}';
      return await streamCall(prompt, moment + ' ' + focusSummary, 300);
    }

    // ── THE PULSE (moment → content) ─────────────────────────────────────────
    const textPostInstruction = 'Write a complete text post. No [BRACKETS] or (pacing notes). Clean paragraphs only. Hook first line, short punchy paragraphs, ends with question or CTA.';
    const scriptInstructions = {
      'Short-form video': 'Write a complete word-for-word spoken script for 60-90 seconds. Beats in [BRACKETS]: [HOOK],[SETUP],[TENSION],[PAYOFF],[CTA]. Pacing notes in (parentheses).',
      'Long-form YouTube video': 'Write a complete word-for-word script for 8-12 minutes. Label: [INTRO HOOK],[CONTEXT],[MAIN STORY],[KEY LESSONS],[OUTRO CTA].',
      'LinkedIn text post': 'Write the complete LinkedIn post. No [BRACKETS]. Strong opening line, short paragraphs, ends with question. Include 3 hashtags at end.',
      'Instagram caption': 'Write the complete Instagram caption. No [BRACKETS]. Hook first line (125 chars max), body with line breaks, CTA, then 5 focused hashtags.',
      'Podcast intro': 'Write a complete 60-90 second spoken intro.',
      'Email newsletter': 'Write complete email: SUBJECT LINE first, PREVIEW TEXT second, then full BODY.',
      'Blog post': 'Write: SEO HEADLINE, META DESCRIPTION under 160 chars, INTRO, 3-4 SECTION HEADERS with summaries, CONCLUSION with CTA.',
      'Text post': textPostInstruction
    };
    const scriptInstruction = scriptInstructions[contentType] || scriptInstructions['Short-form video'];
    const allPlatList = platforms && platforms.length > 0 ? platforms : ['TikTok','YouTube Shorts','YouTube','Instagram Reels','Facebook Reels','LinkedIn','X (Twitter)'];
    const platStrategyInstruction = 'Write a tailored caption + hashtags for EACH of these platforms, respecting their character limits: ' + allPlatList.join(', ') + '.';

    const pulsePrompt = base + ' ' + scriptInstruction + ' ' + platStrategyInstruction +
      ' Return ONE JSON object: {"diagnosis":"2-3 sentences on the emotional core","hook":"single best opening line","hook_1":"emotion-first hook","hook_2":"curiosity-first hook","hook_3":"identity-first hook","winner":"which hook and why","visual_note":"what to show on screen first 3 seconds","story_spine":"Setup / Tension / Payoff","full_script":"COMPLETE script as specified","b_roll":["shot 1","shot 2","shot 3","shot 4"],"pacing_note":"one delivery tip","cta":"identity-based call to action","content_warning":"one honest risk","content_fix":"exact rewritten line that fixes the risk","platform_strategies":[{"platform":"platform name","strategy":"posting strategy","caption":"ready-to-post caption","hashtags":"hashtags"}]}';

    return await streamCall(pulsePrompt, moment, 2400);

  } catch (err) {
    errOut(err.message || 'Something went wrong.');
  }
};
