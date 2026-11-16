/**
 * watermarkImage.ts
 * Single-Source-of-Truth (SSOT) client-side canvas watermarking pipeline
 * for SARWARCYOU Media Vault (sarwar.cyou).
 *
 * Implements offscreen HTML5 canvas drawing:
 * - Bottom-Right: Stamp official Option 2 Sweeping Laser wordmark (White & Pure Electric Cyan)
 * - Semi-translucent at 85% opacity (ctx.globalAlpha = 0.85)
 * - No bottom-left text; no domain URL text
 * - Exports blob directly with sarwarcyou_sarwar.cyou_photo_[OriginalName] filename convention.
 */

import { getMediaUrl } from './imageUrlResolver';
import { safeEncodeUrl } from './mediaTypeDetector';

const WATERMARK_SVG_STRING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 740 90" width="740" height="90">
  <defs>
    <filter id="wmShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.95"/>
    </filter>
    <linearGradient id="wmLaserGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00f0ff" stop-opacity="0"/>
      <stop offset="20%" stop-color="#00f0ff" stop-opacity="0.3"/>
      <stop offset="50%" stop-color="#00f0ff" stop-opacity="0.95"/>
      <stop offset="80%" stop-color="#00f0ff" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#00f0ff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="wmSparkFlare" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="35%" stop-color="#00f0ff" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#00f0ff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Baseline Optical Laser Horizon -->
  <line x1="44" y1="88" x2="696" y2="88" stroke="url(#wmLaserGrad)" stroke-width="2.5"/>
  <!-- Laser Spark Node & Flare on Horizon -->
  <ellipse cx="370" cy="88" rx="55" ry="6" fill="url(#wmSparkFlare)"/>
  <circle cx="370" cy="88" r="4" fill="#ffffff"/>

  <!-- Scattered Monoline Glyphs -->
  <g transform="translate(10, 15)" filter="url(#wmShadow)">
    <!-- S -->
    <line x1="16" y1="6" x2="48" y2="6" stroke="#ffffff" stroke-width="3" stroke-linecap="square"/>
    <path d="M 48 14 L 16 14 C 8 14, 8 26, 16 26 L 38 26 C 46 26, 46 38, 38 38 L 8 38" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="square"/>
    <line x1="8" y1="46" x2="40" y2="46" stroke="#ffffff" stroke-width="3" stroke-linecap="square"/>

    <!-- A -->
    <path d="M 68 46 L 90 6 L 112 46" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="square"/>
    <line x1="74" y1="30" x2="106" y2="30" stroke="#00f0ff" stroke-width="2.2" stroke-linecap="round"/>

    <!-- R -->
    <path d="M 132 46 L 132 6 L 158 6 C 170 6, 170 24, 158 24 L 132 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="square"/>
    <line x1="152" y1="24" x2="168" y2="46" stroke="#ffffff" stroke-width="3" stroke-linecap="square"/>

    <!-- W -->
    <path d="M 188 6 L 198 46 L 212 20 L 226 46 L 236 6" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter"/>

    <!-- A -->
    <path d="M 256 46 L 278 6 L 300 46" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="square"/>
    <line x1="262" y1="30" x2="294" y2="30" stroke="#00f0ff" stroke-width="2.2" stroke-linecap="round"/>

    <!-- R -->
    <path d="M 320 46 L 320 6 L 346 6 C 358 6, 358 24, 346 24 L 320 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="square"/>
    <line x1="340" y1="24" x2="356" y2="46" stroke="#ffffff" stroke-width="3" stroke-linecap="square"/>

    <!-- Dot Separator -->
    <polygon points="380,44 386,34 394,34 388,44" fill="#00f0ff"/>

    <!-- C -->
    <path d="M 444 14 L 420 14 C 408 14, 408 38, 420 38 L 444 38" fill="none" stroke="#00f0ff" stroke-width="3" stroke-linecap="square"/>

    <!-- Y -->
    <path d="M 462 6 L 476 24 L 490 6" fill="none" stroke="#00f0ff" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter"/>
    <line x1="476" y1="28" x2="476" y2="46" stroke="#00f0ff" stroke-width="3" stroke-linecap="square"/>

    <!-- O -->
    <path d="M 520 8 C 508 16, 508 36, 520 44" fill="none" stroke="#00f0ff" stroke-width="3" stroke-linecap="round"/>
    <path d="M 528 8 C 540 16, 540 36, 528 44" fill="none" stroke="#00f0ff" stroke-width="3" stroke-linecap="round"/>

    <!-- U -->
    <line x1="560" y1="6" x2="560" y2="20" stroke="#00f0ff" stroke-width="3" stroke-linecap="square"/>
    <path d="M 560 26 L 560 36 C 560 46, 588 46, 588 36 L 588 6" fill="none" stroke="#00f0ff" stroke-width="3" stroke-linecap="square"/>
  </g>
</svg>`;

let cachedWatermarkImg: HTMLImageElement | null = null;

async function getWatermarkSvgImage(): Promise<HTMLImageElement> {
  if (cachedWatermarkImg && cachedWatermarkImg.complete) {
    return cachedWatermarkImg;
  }
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(WATERMARK_SVG_STRING)}`;
  await new Promise<void>((resolve, reject) => {
    if (img.complete) {
      resolve();
    } else {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load SVG watermark logo'));
    }
  });
  cachedWatermarkImg = img;
  return img;
}

export function formatPhotoDownloadFilename(rawName?: string, ext = 'jpg'): string {
  let base = (rawName || 'photo').trim();
  base = base.split('?')[0].split('#')[0];
  base = base.split('/').pop() || base;

  // Strip image extensions if already present
  base = base.replace(/\.(jpg|jpeg|png|webp|avif|gif|bmp|tiff|heic)$/i, '');

  try {
    base = decodeURIComponent(base);
  } catch {
    /* leave as is */
  }

  base = base.replace(/[/\\:*?"<>|]+/g, '_').trim();
  base = base.replace(/_+/g, '_').replace(/^_|_$/g, '') || 'photo';

  const cleanExt = (ext.replace(/^\./, '') || 'jpg').toLowerCase();
  return `sarwarcyou_sarwar.cyou_photo_${base}.${cleanExt}`;
}

/**
 * Universal client-side image watermarking and download trigger.
 * Accepts an HTMLImageElement, direct image URL string, or Blob.
 */
export async function applyWatermarkAndDownload(
  source: HTMLImageElement | string | Blob,
  originalFilename?: string
): Promise<void> {
  let imageElement: HTMLImageElement;
  let objectUrlToRevoke: string | null = null;

  if (source instanceof HTMLImageElement) {
    imageElement = source;
  } else {
    imageElement = new Image();
    imageElement.crossOrigin = 'anonymous';
    const rawUrl = typeof source === 'string' ? getMediaUrl(source) : URL.createObjectURL(source);
    const srcUrl = typeof source === 'string' ? safeEncodeUrl(rawUrl) : rawUrl;
    if (typeof source !== 'string') {
      objectUrlToRevoke = srcUrl;
    }
    imageElement.src = srcUrl;
    await new Promise<void>((resolve, reject) => {
      if (imageElement.complete && imageElement.naturalWidth) {
        resolve();
      } else {
        imageElement.onload = () => resolve();
        imageElement.onerror = () => reject(new Error('Failed to load image for watermarking'));
      }
    });
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = imageElement.naturalWidth || imageElement.width;
    canvas.height = imageElement.naturalHeight || imageElement.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to acquire 2D canvas context');

    // 1. Draw base high-res photo
    ctx.drawImage(imageElement, 0, 0);

    // 2. Load and stamp Option 2 Sweeping Laser logo at bottom-right corner at 85% opacity
    const wmImg = await getWatermarkSvgImage();
    const wmWidth = Math.max(180, Math.min(Math.round(canvas.width * 0.22), 650));
    const wmHeight = Math.round(wmWidth * (90 / 740));
    const padX = Math.round(canvas.width * 0.035);
    const padY = Math.round(canvas.height * 0.035);
    const posX = canvas.width - padX - wmWidth;
    const posY = canvas.height - padY - wmHeight;

    ctx.save();
    ctx.globalAlpha = 0.85; // 85% semi-translucent opacity as requested
    ctx.drawImage(wmImg, posX, posY, wmWidth, wmHeight);
    ctx.restore();

    // 3. Export formatted filename
    const targetFilename = formatPhotoDownloadFilename(originalFilename, 'jpg');

    await new Promise<void>((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve();
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = targetFilename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 30_000);
          resolve();
        },
        'image/jpeg',
        0.95
      );
    });
  } finally {
    if (objectUrlToRevoke) {
      URL.revokeObjectURL(objectUrlToRevoke);
    }
  }
}

/**
 * Compatibility helper returning a Blob with watermarked composite.
 */
export async function applyImageWatermark(
  source: string | Blob,
  _mimeType?: string
): Promise<Blob> {
  let imageSrc: string;
  let objectUrlToRevoke: string | null = null;

  if (typeof source === 'string') {
    imageSrc = safeEncodeUrl(getMediaUrl(source));
  } else {
    imageSrc = URL.createObjectURL(source);
    objectUrlToRevoke = imageSrc;
  }

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    await new Promise<void>((resolve, reject) => {
      if (img.complete && img.naturalWidth) {
        resolve();
      } else {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
      }
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to create canvas context');

    // 1. Draw base photo
    ctx.drawImage(img, 0, 0);

    // 2. Load and stamp Option 2 Sweeping Laser logo at bottom-right corner at 85% opacity
    const wmImg = await getWatermarkSvgImage();
    const wmWidth = Math.max(180, Math.min(Math.round(canvas.width * 0.22), 650));
    const wmHeight = Math.round(wmWidth * (90 / 740));
    const padX = Math.round(canvas.width * 0.035);
    const padY = Math.round(canvas.height * 0.035);
    const posX = canvas.width - padX - wmWidth;
    const posY = canvas.height - padY - wmHeight;

    ctx.save();
    ctx.globalAlpha = 0.85; // 85% semi-translucent opacity as requested
    ctx.drawImage(wmImg, posX, posY, wmWidth, wmHeight);
    ctx.restore();

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas export produced null'));
        },
        'image/jpeg',
        0.95
      );
    });
  } finally {
    if (objectUrlToRevoke) {
      URL.revokeObjectURL(objectUrlToRevoke);
    }
  }
}
