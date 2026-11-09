const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const RES_DIR = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

const PLAY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="cyanBluePlay" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f0ff" />
      <stop offset="100%" stop-color="#0080ff" />
    </linearGradient>
  </defs>
  <path d="M18 10.5C18 7.8 21 6.1 23.3 7.5L53.7 29C55.8 30.2 55.8 33.8 53.7 35L23.3 56.5C21 57.9 18 56.2 18 53.5V10.5Z" fill="url(#cyanBluePlay)"/>
</svg>`;

async function renderGlyph(width, height) {
  return await sharp(Buffer.from(PLAY_SVG))
    .resize(width, height, { fit: 'contain' })
    .png()
    .toBuffer();
}

async function generateSquareIcon(size, outputPath) {
  const cornerRadius = Math.round(size * 0.22);
  const glyphSize = Math.round(size * 0.62);
  const glyphBuf = await renderGlyph(glyphSize, glyphSize);

  // Squircle / rounded rectangle SVG mask
  const bgSvg = Buffer.from(`
    <svg width="${size}" height="${size}">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${cornerRadius}" ry="${cornerRadius}" fill="#020408" />
    </svg>
  `);

  const left = Math.round((size - glyphSize) / 2);
  const top = Math.round((size - glyphSize) / 2);

  await sharp(bgSvg)
    .composite([{ input: glyphBuf, left, top }])
    .png()
    .toFile(outputPath);
}

async function generateRoundIcon(size, outputPath) {
  const glyphSize = Math.round(size * 0.58);
  const glyphBuf = await renderGlyph(glyphSize, glyphSize);
  const radius = size / 2;

  // Circle SVG background
  const bgSvg = Buffer.from(`
    <svg width="${size}" height="${size}">
      <circle cx="${radius}" cy="${radius}" r="${radius}" fill="#020408" />
    </svg>
  `);

  const left = Math.round((size - glyphSize) / 2);
  const top = Math.round((size - glyphSize) / 2);

  await sharp(bgSvg)
    .composite([{ input: glyphBuf, left, top }])
    .png()
    .toFile(outputPath);
}

async function generateForegroundIcon(size, outputPath) {
  // Adaptive foreground: glyph centered inside 108dp canvas, safe zone is inner 66-72dp (approx 52-56% of canvas)
  const glyphSize = Math.round(size * 0.54);
  const glyphBuf = await renderGlyph(glyphSize, glyphSize);

  const transparentBg = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  }).png().toBuffer();

  const left = Math.round((size - glyphSize) / 2);
  const top = Math.round((size - glyphSize) / 2);

  await sharp(transparentBg)
    .composite([{ input: glyphBuf, left, top }])
    .png()
    .toFile(outputPath);
}

async function generateSplash(width, height, outputPath) {
  // Splash screen: #020408 background, centered play button glyph
  const minDim = Math.min(width, height);
  const glyphSize = Math.max(96, Math.round(minDim * 0.32));
  const glyphBuf = await renderGlyph(glyphSize, glyphSize);

  const darkBg = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 2, g: 4, b: 8, alpha: 1 }
    }
  }).png().toBuffer();

  const left = Math.round((width - glyphSize) / 2);
  const top = Math.round((height - glyphSize) / 2);

  await sharp(darkBg)
    .composite([{ input: glyphBuf, left, top }])
    .png()
    .toFile(outputPath);
}

async function main() {
  console.log('Generating Android launcher and splash assets...');

  const densities = [
    { name: 'mipmap-mdpi', size: 48, fgSize: 108 },
    { name: 'mipmap-hdpi', size: 72, fgSize: 162 },
    { name: 'mipmap-xhdpi', size: 96, fgSize: 216 },
    { name: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
    { name: 'mipmap-xxxhdpi', size: 192, fgSize: 432 },
  ];

  for (const d of densities) {
    const dir = path.join(RES_DIR, d.name);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await generateSquareIcon(d.size, path.join(dir, 'ic_launcher.png'));
    await generateRoundIcon(d.size, path.join(dir, 'ic_launcher_round.png'));
    await generateForegroundIcon(d.fgSize, path.join(dir, 'ic_launcher_foreground.png'));
    console.log(`Rendered launcher icons for ${d.name} (${d.size}x${d.size}, fg: ${d.fgSize}x${d.fgSize})`);
  }

  const splashes = [
    { dir: 'drawable', w: 480, h: 320 },
    { dir: 'drawable-land-mdpi', w: 480, h: 320 },
    { dir: 'drawable-land-hdpi', w: 800, h: 480 },
    { dir: 'drawable-land-xhdpi', w: 1280, h: 720 },
    { dir: 'drawable-land-xxhdpi', w: 1600, h: 960 },
    { dir: 'drawable-land-xxxhdpi', w: 1920, h: 1280 },
    { dir: 'drawable-port-mdpi', w: 320, h: 480 },
    { dir: 'drawable-port-hdpi', w: 480, h: 800 },
    { dir: 'drawable-port-xhdpi', w: 720, h: 1280 },
    { dir: 'drawable-port-xxhdpi', w: 960, h: 1600 },
    { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
  ];

  for (const s of splashes) {
    const dir = path.join(RES_DIR, s.dir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await generateSplash(s.w, s.h, path.join(dir, 'splash.png'));
    console.log(`Rendered splash for ${s.dir} (${s.w}x${s.h})`);
  }

  console.log('All launcher icons and splash screens successfully generated!');
}

main().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
