const axios = require('axios');

/**
 * Download TikTok video (HD, no watermark) + audio via tikwm.com public API
 * @param {string} url - link video TikTok
 */
async function tiktokDownload(url) {
  const { data } = await axios.get('https://www.tikwm.com/api/', {
    params: { url, hd: 1 },
    timeout: 25000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  if (!data || data.code !== 0 || !data.data) {
    throw new Error('Link TikTok tidak valid atau video tidak ditemukan');
  }

  const d = data.data;
  const base = 'https://www.tikwm.com';
  const abs = (p) => (p ? (p.startsWith('http') ? p : base + p) : null);

  // hdplay = HD tanpa watermark, fallback ke play biasa (tanpa watermark juga)
  const videoUrl = abs(d.hdplay) || abs(d.play);
  const musicUrl = abs(d.music);

  return {
    title: d.title || 'TikTok Video',
    author: d.author?.nickname || d.author?.unique_id || '-',
    video: videoUrl,
    music: musicUrl,
    cover: abs(d.cover),
    duration: d.duration,
  };
}

module.exports = { tiktokDownload };
