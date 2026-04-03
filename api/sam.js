module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mode, moment, platforms, contentType, creatorContext, tone, audienceDemographics, outputLanguage, emojiPreference } = req.body;
  if (!moment || !mode) return res.status(400).json({ error: 'Missing mode or moment' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  // ── ACCURATE PLATFORM SPECS ──────────────────────────────────────────────
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

  const emojiLine = emojiPreference === 'no'
    ? 'IMPORTANT: Do NOT use any emojis. Zero.'
    : emojiPreference === 'lots'
    ? 'Use emojis freely and expressively throughout.'
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

  const callAnthropic = async (system, userContent, maxTokens) => {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: maxTokens, system, messages: [{ role: 'user', content: userContent }] })
    });
    if (!r.ok) throw new Error('Anthropic API error ' + r.status);
    const d = await r.json();
    const text = d.content && d.content[0] && d.content[0].text;
    if (!text) throw new Error('Empty response from API');
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  };

  try {

    // ── CALENDAR ──────────────────────────────────────────────────────────
    if (mode === 'calendar') {
      const platList = platforms && platforms.length > 0 ? platforms : ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'LinkedIn'];
      const prompt = base + ' Build a strategic 7-day posting plan. Rotate across: ' + platList.join(', ') + '. For each day, write caption/content that respects that platform exact character limits and hashtag rules as specified above. Return exactly: {"days":[{"platform":"platform name","post_type":"format","content":"ready-to-post caption respecting that platforms character limit","tip":"one tactical tip specific to that platform","ideal_time":"specific time + brief reason"}]}';
      const parsed = await callAnthropic(prompt, moment, 2200);
      return res.status(200).json(parsed);
    }

    // ── IDEAS ─────────────────────────────────────────────────────────────
    if (mode === 'ideas') {
      const prompt = base + ' Generate exactly 10 specific, actionable content ideas for this week. Return: {"ideas":[{"title":"specific idea title","why":"one sentence why this performs","best_platform":"single best platform name e.g. TikTok, YouTube Shorts, Instagram Reels, LinkedIn, Facebook Reels, YouTube"}]}';
      const parsed = await callAnthropic(prompt, moment, 2000);
      return res.status(200).json(parsed);
    }

    // ── UPLOAD & STRATEGIZE ───────────────────────────────────────────────
    if (mode === 'upload') {
      const imageBase64 = req.body.imageBase64 || null;
      const imageType = req.body.imageType || 'image/jpeg';
      const uploadPlatforms = req.body.platforms || [];
      const platStr = uploadPlatforms.length > 0
        ? 'Target platforms: ' + uploadPlatforms.join(', ') + '. Platform specs: ' + getPlatformContext(uploadPlatforms)
        : '';

      const uploadSystem = [
        'You are S.A.M. — Strategic Assistant for Making.',
        'A creator has shared content — text, an image, or both.',
        platStr,
        'STEP 1: Classify what was shared: analytics (platform stats/graphs/dashboards), photo (any image or visual), or text_only (no image).',
        'STEP 2: Return the matching JSON. No markdown. No backticks.',
        'IF analytics: {"type":"analytics","headline":"biggest insight in one sentence","whats_working":["obs 1","obs 2","obs 3"],"whats_not":["improve 1","improve 2"],"post_next":["specific content idea 1","idea 2","idea 3"],"best_time":"optimal posting time","growth_move":"one bold strategic move"}',
        'IF photo: {"type":"photo","what_sam_sees":"one sentence on what is in the image","thumbnail_strategy":"text overlay, emotion, crop direction","hook_ideas":["hook 1","hook 2","hook 3"],"best_platform":"single best platform","platform_reason":"one sentence why","content_angle":"the scroll-stopping angle","caption_starter":"first line of a caption"}',
        'IF text_only: {"type":"text_only","diagnosis":"what this idea is really about and why it has potential","hook_ideas":["hook 1","hook 2","hook 3"],"best_platform":"single best platform","platform_reason":"one sentence why","content_angle":"strongest angle to take","next_action":"single most important thing to do now"}',
        'CRITICAL: Return ONLY valid JSON. Nothing else.'
      ].join(' ');

      const userContent = imageBase64
        ? [
            { type: 'image', source: { type: 'base64', media_type: imageType, data: imageBase64 } },
            { type: 'text', text: moment || 'Analyse this and provide a strategy.' }
          ]
        : moment;

      const parsed = await callAnthropic(uploadSystem, userContent, 1800);
      return res.status(200).json(parsed);
    }

    // ── CONCEPT ───────────────────────────────────────────────────────────
    if (mode === 'concept') {
      const conceptStyle = req.body.contentType || '';
      const conceptPlatforms = req.body.platforms || [];
      const platStr = conceptPlatforms.length > 0
        ? 'Target platform(s): ' + conceptPlatforms.join(', ') + '. Platform specs: ' + getPlatformContext(conceptPlatforms)
        : '';
      const styleStr = conceptStyle ? 'Concept style: ' + conceptStyle + '.' : '';
      const prompt = base + ' ' + platStr + ' ' + styleStr + ' Generate ONE bold, unique video concept. Think like a top creative director at a viral studio. The video_title, video_description, and video_hashtags MUST strictly follow the target platform character limits and hashtag rules. If multiple platforms, use the most restrictive limits. Return: {"title":"Short punchy concept title 6-10 words","format":"format type e.g. Reverse Reveal","premise":"2-3 sentences on exactly what the video IS","why_it_works":"2 sentences on the psychology of why it stops scrolls","production_notes":["filming note 1","filming note 2","filming note 3","filming note 4"],"hook_line":"exact first sentence to say on camera","best_platform":"single best platform","platform_reason":"one sentence why","twist":"the unexpected angle that makes this truly memorable","virality_score":85,"video_title":"SEO-optimised title respecting platform char limit","video_description":"description respecting platform char limit with keywords and CTA","video_hashtags":["hashtag1","hashtag2","hashtag3","hashtag4","hashtag5","hashtag6","hashtag7","hashtag8"]}';
      const parsed = await callAnthropic(prompt, moment, 1800);
      return res.status(200).json(parsed);
    }

    // ── FOCUS ─────────────────────────────────────────────────────────────
    if (mode === 'focus') {
      const focusSummary = req.body.focusSummary || '';
      const prompt = base + ' Give ONE specific action for the next 30 minutes. Start with a verb. Be direct. Return: {"action":"one specific action starting with a verb","sub":"one sentence on why right now not tomorrow"}';
      const parsed = await callAnthropic(prompt, moment + ' ' + focusSummary, 300);
      return res.status(200).json(parsed);
    }

    // ── STORY + HOOK (moment → content mode) ─────────────────────────────
    const textPostInstruction = 'Write a complete text post. No [BRACKETS] or (pacing notes). Clean paragraphs only. Hook first line, story in short punchy paragraphs, ends with question or CTA.';

    const scriptInstructions = {
      'Short-form video': 'Write a complete word-for-word spoken script for 60-90 seconds. Beats in [BRACKETS]: [HOOK],[SETUP],[TENSION],[PAYOFF],[CTA]. Pacing notes in (parentheses).',
      'Long-form YouTube video': 'Write a complete word-for-word script for 8-12 minutes. Label: [INTRO HOOK],[CONTEXT],[MAIN STORY],[KEY LESSONS],[OUTRO CTA].',
      'LinkedIn text post': 'Write the complete LinkedIn post. No [BRACKETS]. Strong opening line, short paragraphs, ends with question. Include 3 hashtags at end.',
      'Instagram caption': 'Write the complete Instagram caption. No [BRACKETS]. Hook first line (125 chars max before truncation), body with line breaks, CTA, then 5 focused hashtags.',
      'Podcast intro': 'Write a complete 60-90 second spoken intro.',
      'Email newsletter': 'Write complete email: SUBJECT LINE first, PREVIEW TEXT second, then full BODY. No [BRACKETS] in body.',
      'Blog post': 'Write: SEO HEADLINE, META DESCRIPTION under 160 chars, INTRO, 3-4 SECTION HEADERS with summaries, CONCLUSION with CTA.',
      'Text post': textPostInstruction
    };

    const scriptInstruction = scriptInstructions[contentType] || scriptInstructions['Short-form video'];

    // Build per-platform strategy instruction
    const platStrategyInstruction = platforms && platforms.length > 0
      ? 'For platform_strategies, write a tailored caption + hashtags for EACH selected platform, strictly following that platforms character limits and hashtag rules as specified above.'
      : '';

    const storyPrompt = base + ' ' + scriptInstruction + ' Return: {"diagnosis":"2-3 sentences on what this moment is really about emotionally","hook":"single best opening line","story_spine":"Setup / Tension / Payoff separated by /","full_script":"COMPLETE OUTPUT as specified","b_roll":"4 specific b-roll shots each on own line","pacing_note":"one specific delivery tip","cta":"identity-based call to action","content_warning":"one honest risk — one sentence describing what could go wrong or feel off","content_fix":"the exact rewritten line or section that fixes the risk — ready to use, not advice"}';

    const hookPrompt = base + ' ' + platStrategyInstruction + ' Return: {"diagnosis":"what makes this hook-worthy","hook_1":"emotion-first hook","hook_2":"curiosity-first hook","hook_3":"identity-first hook","winner":"which hook and why","visual_note":"what to show on screen first 3 seconds","platform_strategies":' + (platforms && platforms.length > 0 ? '[{"platform":"exact platform name","strategy":"specific posting strategy","caption":"ready-to-post caption respecting that platforms exact character limit","hashtags":"hashtags following that platforms rules"}]' : '[]') + '}';

    const systemPrompt = mode === 'story' ? storyPrompt : hookPrompt;
    if (!systemPrompt) return res.status(400).json({ error: 'Invalid mode' });

    const parsed = await callAnthropic(systemPrompt, moment, 2200);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Something went wrong.' });
  }
};
