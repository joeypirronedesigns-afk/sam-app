module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const result = { type: 'photo', what_sam_sees: 'Test working', thumbnail_headline: 'THIS IS A TEST', thumbnail_subtext: 'IT WORKS', thumbnail_color: '#F472B6', content_angle: 'Test angle', platforms: [{ platform: 'TikTok', title: 'Test title', description: 'Test caption', hashtags: '#test' }] };

  res.write('data: ' + JSON.stringify({ done: true, result }) + '\n\n');
  res.end();
};
