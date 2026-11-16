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

const WATERMARK_SVG_STRING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 70" width="820" height="70">
  <defs>
    <filter id="wmShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.95"/>
    </filter>
    <linearGradient id="wmGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="50%" stop-color="#ccff00"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
  </defs>

  <!-- Variation 2: Hierarchical Cyber-Block (Pure Floating - No Baseline Graphic) -->
  <g stroke="url(#wmGradient)" stroke-width="8.5" stroke-linecap="butt" stroke-linejoin="round" fill="none" filter="url(#wmShadow)">
    <!-- S -->
    <path d="M 84 12 L 30 12 A 10.5 10.5 0 0 0 30 33 L 64 33 A 10.5 10.5 0 0 1 64 54 L 10 54"/>
    <!-- A1 -->
    <path d="M 104 54 L 139 12 L 174 54 M 118 40 L 160 40"/>
    <!-- R1 -->
    <path d="M 216 12 L 240 12 A 10.5 10.5 0 0 1 240 33 L 204 33 A 10.5 10.5 0 0 0 192 43.5 L 192 54"/>
    <path d="M 228 33 L 260 54"/>
    <!-- W -->
    <path d="M 278 12 L 296 54 L 320 20 L 344 54 L 362 12"/>
    <!-- A2 -->
    <path d="M 380 54 L 415 12 L 450 54 M 394 40 L 436 40"/>
    <!-- R2 -->
    <path d="M 492 12 L 516 12 A 10.5 10.5 0 0 1 516 33 L 480 33 A 10.5 10.5 0 0 0 468 43.5 L 468 54"/>
    <path d="M 504 33 L 536 54"/>

    <!-- .CYOU Cyber Tag Pill -->
    <rect x="560" y="16" width="210" height="34" rx="8" stroke="rgba(204, 255, 0, 0.6)" stroke-width="1.8" fill="rgba(204, 255, 0, 0.08)"/>
    <!-- Dot -->
    <circle cx="582" cy="33" r="3.5" fill="#ccff00" stroke="none"/>
    <!-- C -->
    <path d="M 622 23 L 604 23 A 5 5 0 0 0 598 28 L 598 38 A 5 5 0 0 0 604 43 L 622 43" stroke-width="3"/>
    <!-- Y -->
    <path d="M 632 23 L 646 33 L 646 43 M 660 23 L 646 33" stroke-width="3"/>
    <!-- O -->
    <path d="M 680 23 L 690 23 A 5 5 0 0 1 690 43 L 680 43 A 5 5 0 0 1 680 23 Z" stroke-width="3"/>
    <!-- U -->
    <path d="M 710 23 L 710 38 A 5 5 0 0 0 715 43 L 729 43 A 5 5 0 0 0 734 38 L 734 23" stroke-width="3"/>
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
