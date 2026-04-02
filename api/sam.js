module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mode, moment, platforms, contentType, creatorContext, tone, audienceDemographics, outputLanguage, emojiPreference } = req.body;
  if (!moment || !mode) return res.status(400).json({ error: 'Missing mode or moment' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const platformContext = platforms && platforms.length > 0
    ? 'The creator posts on: ' + platforms.join(', ') + '. Tailor ALL output specifically for these platforms.' : '';
  const formatContext = contentType ? 'Content format: ' + contentType + '.' : '';
  const creatorLine = creatorContext ? 'About this creator: ' + creatorContext + '.' : '';
  const languageLine = outputLanguage
    ? 'IMPORTANT: Write the ENTIRE output in ' + outputLanguage + '. Do not use English except inside JSON field names.' : '';

  const emojiLine = emojiPreference === 'no'
    ? 'IMPORTANT: Do NOT use any emojis anywhere in your output. Zero emojis.'
    : emojiPreference === 'lots'
    ? 'Use emojis freely and expressively throughout.'
    : 'Use emojis sparingly — maximum 1-2 per output section.';

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
      const prompt = base + ' Build a strategic 7-day posting plan from one piece of content. Rotate across: ' + platList.join(', ') + '. Return exactly: {"days":[{"platform":"platform name","post_type":"format","content":"specific ready-to-use post content","tip":"one tactical tip","ideal_time":"specific time + brief reason"}]}';
      const parsed = await callAnthropic(prompt, moment, 2000);
      return res.status(200).json(parsed);
    }

    // ── IDEAS ─────────────────────────────────────────────────────────────
    if (mode === 'ideas') {
      const prompt = base + ' Generate exactly 10 specific, actionable content ideas for this week. Return: {"ideas":[{"title":"specific idea title","why":"one sentence why this performs","best_platform":"single best platform"}]}';
      const parsed = await callAnthropic(prompt, moment, 2000);
      return res.status(200).json(parsed);
    }

    // ── UPLOAD & STRATEGIZE ───────────────────────────────────────────────
    if (mode === 'upload') {
      const imageBase64 = req.body.imageBase64 || null;
      const imageType = req.body.imageType || 'image/jpeg';
      const uploadPlatforms = req.body.platforms || [];
      const platStr = uploadPlatforms.length > 0 ? 'Platforms: ' + uploadPlatforms.join(', ') + '.' : '';

      const uploadSystem = [
        'You are S.A.M. — Strategic Assistant for Making.',
        'A creator has shared content — text, an image, or both.',
        platStr,
        'STEP 1: Classify what was shared as one of: analytics, photo, or text_only.',
        'analytics = platform stats, graphs, dashboards, metrics.',
        'photo = any image, scene, person, renovation, thumbnail.',
        'text_only = no image provided, just text.',
        'STEP 2: Return the matching JSON only. No markdown. No backticks.',
        '',
        'IF analytics: {"type":"analytics","headline":"biggest insight in one sentence","whats_working":["obs 1","obs 2","obs 3"],"whats_not":["improve 1","improve 2"],"post_next":["idea 1","idea 2","idea 3"],"best_time":"optimal posting time","growth_move":"one bold strategic move"}',
        '',
        'IF photo: {"type":"photo","what_sam_sees":"one sentence on what is in the image","thumbnail_strategy":"text overlay, emotion, crop direction","hook_ideas":["hook 1","hook 2","hook 3"],"best_platform":"single best platform","platform_reason":"one sentence why","content_angle":"the scroll-stopping angle","caption_starter":"first line of a caption"}',
        '',
        'IF text_only: {"type":"text_only","diagnosis":"what this idea is really about and why it has potential","hook_ideas":["hook 1","hook 2","hook 3"],"best_platform":"single best platform","platform_reason":"one sentence why","content_angle":"strongest angle to take","next_action":"single most important thing to do now"}',
        '',
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
      const platStr = conceptPlatforms.length > 0 ? 'Target platform(s): ' + conceptPlatforms.join(', ') + '.' : '';
      const styleStr = conceptStyle ? 'Concept style: ' + conceptStyle + '.' : '';
      const prompt = base + ' ' + platStr + ' ' + styleStr + ' Generate ONE bold, unique, never-seen-before video concept. Think like a top creative director at a viral studio. Return: {"title":"Short punchy concept title 6-10 words","format":"format type e.g. Reverse Reveal, Split-Screen Challenge","premise":"2-3 sentences on exactly what the video IS","why_it_works":"2 sentences on the psychology of why it stops scrolls","production_notes":["filming note 1","filming note 2","filming note 3","filming note 4"],"hook_line":"exact first sentence to say on camera","best_platform":"single best platform","platform_reason":"one sentence why","twist":"the unexpected angle that makes this truly memorable","virality_score":85,"video_title":"SEO-optimised title under 70 chars","video_description":"2-3 sentence description with keywords and CTA ready to paste","video_hashtags":["hashtag1","hashtag2","hashtag3","hashtag4","hashtag5","hashtag6","hashtag7","hashtag8"]}';
      const parsed = await callAnthropic(prompt, moment, 1800);
      return res.status(200).json(parsed);
    }

    // ── FOCUS ─────────────────────────────────────────────────────────────
    if (mode === 'focus') {
      const focusSummary = req.body.focusSummary || '';
      const prompt = base + ' Give ONE specific action for the next 30 minutes. Start with a verb. Be direct and commanding. Return: {"action":"one specific action starting with a verb","sub":"one sentence on why right now not tomorrow"}';
      const parsed = await callAnthropic(prompt, moment + ' ' + focusSummary, 300);
      return res.status(200).json(parsed);
    }

    // ── STORY + HOOK (moment mode) ────────────────────────────────────────
    const textPostInstruction = 'Write a complete text post ready to copy. No [BRACKETS] or (pacing notes). Clean paragraphs only. Hook first line, story in short punchy paragraphs, ends with question or CTA.';

    const scriptInstructions = {
      'Short-form video': 'Write a complete word-for-word spoken script for 60-90 seconds. Beats in [BRACKETS]: [HOOK],[SETUP],[TENSION],[PAYOFF],[CTA]. Pacing notes in (parentheses).',
      'Long-form YouTube video': 'Write a complete word-for-word script for 8-12 minutes. Label: [INTRO HOOK],[CONTEXT],[MAIN STORY],[KEY LESSONS],[OUTRO CTA].',
      'LinkedIn text post': 'Write the complete LinkedIn post. No [BRACKETS]. Strong opening, short paragraphs, ends with question. Include 3 hashtags.',
      'Instagram caption': 'Write the complete Instagram caption. No [BRACKETS]. Hook first, body with line breaks, CTA, then 5 hashtags.',
      'Podcast intro': 'Write a complete 60-90 second spoken intro.',
      'Email newsletter': 'Write complete email: SUBJECT LINE first, PREVIEW TEXT second, then full BODY. No [BRACKETS] in body.',
      'Blog post': 'Write: SEO HEADLINE, META DESCRIPTION under 160 chars, INTRO paragraph, 3-4 SECTION HEADERS with summaries, CONCLUSION with CTA.',
      'Text post': textPostInstruction
    };

    const scriptInstruction = scriptInstructions[contentType] || scriptInstructions['Short-form video'];

    const storyPrompt = base + ' ' + scriptInstruction + ' Return: {"diagnosis":"2-3 sentences on what this moment is really about emotionally","hook":"single best opening line","story_spine":"Setup / Tension / Payoff separated by /","full_script":"COMPLETE OUTPUT as specified","b_roll":"4 specific b-roll shots each on own line","pacing_note":"one specific delivery tip","cta":"identity-based call to action","content_warning":"one honest risk"}';

    const hookPrompt = base + ' Return: {"diagnosis":"what makes this hook-worthy","hook_1":"emotion-first hook","hook_2":"curiosity-first hook","hook_3":"identity-first hook","winner":"which hook and why","visual_note":"what to show on screen first 3 seconds","platform_strategies":' + (platforms && platforms.length > 0 ? '[{"platform":"platform name","strategy":"specific posting strategy for this platform"}]' : '[]') + '}';

    const systemPrompt = mode === 'story' ? storyPrompt : hookPrompt;
    if (!systemPrompt) return res.status(400).json({ error: 'Invalid mode' });

    const parsed = await callAnthropic(systemPrompt, moment, 2000);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Something went wrong.' });
  }
};
