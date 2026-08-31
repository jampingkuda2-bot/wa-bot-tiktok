const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { v4: uuid } = require('uuid');
const webp = require('node-webpmux');

/**
 * Convert image buffer -> WA sticker (webp) buffer
 */
async function toStickerFromImage(buffer) {
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `${uuid()}.jpg`);
  const outputPath = path.join(tmpDir, `${uuid()}.webp`);
  await fs.writeFile(inputPath, buffer);

  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-vcodec', 'libwebp',
        '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:-1:-1:color=white@0.0',
        '-quality', '80',
      ])
      .toFormat('webp')
      .save(outputPath)
      .on('end', resolve)
      .on('error', reject);
  });

  const webpBuffer = await fs.readFile(outputPath);
  await fs.remove(inputPath).catch(() => {});
  await fs.remove(outputPath).catch(() => {});
  return addExif(webpBuffer);
}

/**
 * Convert video buffer -> animated WA sticker (webp) buffer, max 10 detik
 */
async function toStickerFromVideo(buffer) {
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `${uuid()}.mp4`);
  const outputPath = path.join(tmpDir, `${uuid()}.webp`);
  await fs.writeFile(inputPath, buffer);

  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-vcodec', 'libwebp',
        '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:-1:-1:color=white@0.0',
        '-loop', '0',
        '-preset', 'default',
        '-an',
        '-vsync', '0',
        '-t', '10',
      ])
      .toFormat('webp')
      .save(outputPath)
      .on('end', resolve)
      .on('error', reject);
  });

  const webpBuffer = await fs.readFile(outputPath);
  await fs.remove(inputPath).catch(() => {});
  await fs.remove(outputPath).catch(() => {});
  return addExif(webpBuffer);
}

/**
 * Nempelin metadata sticker pack (nama, publisher) ke file webp
 */
async function addExif(webpBuffer) {
  const img = new webp.Image();
  await img.load(webpBuffer);

  const json = {
    'sticker-pack-id': 'wabot-' + Date.now(),
    'sticker-pack-name': 'WA Bot Sticker',
    'sticker-pack-publisher': 'Termux Bot',
    emojis: ['😄'],
  };

  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00,
    0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
  ]);
  const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
  const exif = Buffer.concat([exifAttr, jsonBuffer]);
  exif.writeUIntLE(jsonBuffer.length, 14, 4);

  img.exif = exif;
  return img.save(null);
}

module.exports = { toStickerFromImage, toStickerFromVideo };
