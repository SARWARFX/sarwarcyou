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

const WATERMARK_SVG_STRING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 68" width="820" height="68">
  <defs>
    <filter id="wmShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.95"/>
    </filter>
    <linearGradient id="wmGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="45%" stop-color="#00d2ff"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
    <linearGradient id="wmLaserGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00d2ff" stop-opacity="0"/>
      <stop offset="25%" stop-color="#00d2ff" stop-opacity="0.3"/>
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0.95"/>
      <stop offset="75%" stop-color="#a855f7" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#a855f7" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="wmSparkFlare" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="35%" stop-color="#00d2ff" stop-opacity="0.9"/>
      <stop offset="70%" stop-color="#a855f7" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#a855f7" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Baseline Optical Laser Horizon -->
  <line x1="30" y1="65" x2="790" y2="65" stroke="url(#wmLaserGrad)" stroke-width="2"/>
  <ellipse cx="410" cy="65" rx="65" ry="5" fill="url(#wmSparkFlare)"/>
  <circle cx="410" cy="65" r="3.5" fill="#ffffff"/>

  <!-- Variation 1: Aerodynamic Horizon Brand Glyphs -->
  <g stroke="url(#wmGradient)" stroke-width="8" stroke-linecap="butt" stroke-linejoin="round" fill="none" filter="url(#wmShadow)">
    <!-- S -->
    <path d="M 74 12 L 28 12 A 10 10 0 0 0 28 32 L 56 32 A 10 10 0 0 1 56 52 L 10 52"/>
    <!-- A1 -->
    <path d="M 90 52 L 121 12 L 152 52 M 104 38 L 138 38"/>
    <!-- R1 -->
    <path d="M 188 12 L 208 12 A 10 10 0 0 1 208 32 L 178 32 A 10 10 0 0 0 166 42 L 166 52"/>
    <path d="M 198 32 L 226 52"/>
    <!-- W -->
    <path d="M 240 12 L 256 52 L 278 20 L 300 52 L 316 12"/>
    <!-- A2 -->
    <path d="M 330 52 L 361 12 L 392 52 M 344 38 L 378 38"/>
    <!-- R2 -->
    <path d="M 428 12 L 448 12 A 10 10 0 0 1 448 32 L 418 32 A 10 10 0 0 0 406 42 L 406 52"/>
    <path d="M 438 32 L 466 52"/>
    <!-- Dot -->
    <rect x="478" y="44" width="8" height="8" fill="#00d2ff" stroke="none"/>
    <!-- C -->
    <path d="M 560 12 L 524 12 A 10 10 0 0 0 514 22 L 514 42 A 10 10 0 0 0 524 52 L 560 52"/>
    <!-- Y -->
    <path d="M 574 12 L 602 32 L 602 52 M 630 12 L 602 32"/>
    <!-- O -->
    <path d="M 664 12 L 684 12 A 10 10 0 0 1 684 52 L 664 52 A 10 10 0 0 1 664 12 Z"/>
    <!-- U -->
    <path d="M 718 12 L 718 42 A 10 10 0 0 0 728 52 L 764 52 A 10 10 0 0 0 774 42 L 774 12"/>
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
