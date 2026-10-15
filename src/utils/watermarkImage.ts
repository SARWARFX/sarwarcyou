/**
 * watermarkImage.ts
 * Single-Source-of-Truth (SSOT) client-side canvas watermarking pipeline
 * for SARWARCYOU Media Vault (sarwar.cyou).
 *
 * Implements offscreen HTML5 canvas drawing:
 * - Bottom-Left: Stamp "SARWARCYOU" logo with futuristic styling (Orbitron, White -> Electric Blue -> White gradient, drop shadow)
 * - Bottom-Right: Stamp "sarwar.cyou" with drop-shadow
 * - Exports blob directly with sarwarcyou_sarwar.cyou_photo_[OriginalName] filename convention.
 */

import { getMediaUrl } from './imageUrlResolver';

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
    const srcUrl = typeof source === 'string' ? getMediaUrl(source) : URL.createObjectURL(source);
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

    const padX = Math.round(canvas.width * 0.035);
    const padY = Math.round(canvas.height * 0.035);

    // 2. Bottom-Left: Stamp "SARWARCYOU" futuristic wordmark logo
    ctx.save();
    const logoFontSize = Math.max(16, Math.round(canvas.width * 0.024));
    ctx.font = `900 ${logoFontSize}px Orbitron, Rajdhani, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';

    const sampleWidth = ctx.measureText('SARWARCYOU').width;
    const textGrad = ctx.createLinearGradient(padX, 0, padX + sampleWidth, 0);
    textGrad.addColorStop(0, '#FFFFFF');
    textGrad.addColorStop(0.5, '#00D2FF');
    textGrad.addColorStop(1, '#FFFFFF');

    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = Math.round(logoFontSize * 0.5);
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = textGrad;
    ctx.fillText('SARWARCYOU', padX, canvas.height - padY);
    ctx.restore();

    // 3. Bottom-Right: Stamp "sarwar.cyou" with clean drop shadow
    ctx.save();
    const domainFontSize = Math.max(13, Math.round(canvas.width * 0.016));
    ctx.font = `600 ${domainFontSize}px Rajdhani, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = Math.round(domainFontSize * 0.45);
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fillText('sarwar.cyou', canvas.width - padX, canvas.height - padY);
    ctx.restore();

    // 4. Export formatted filename
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
    imageSrc = source;
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

    ctx.drawImage(img, 0, 0);

    const padX = Math.round(canvas.width * 0.035);
    const padY = Math.round(canvas.height * 0.035);

    // Bottom-Left
    ctx.save();
    const logoFontSize = Math.max(16, Math.round(canvas.width * 0.024));
    ctx.font = `900 ${logoFontSize}px Orbitron, Rajdhani, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';

    const sampleWidth = ctx.measureText('SARWARCYOU').width;
    const textGrad = ctx.createLinearGradient(padX, 0, padX + sampleWidth, 0);
    textGrad.addColorStop(0, '#FFFFFF');
    textGrad.addColorStop(0.5, '#00D2FF');
    textGrad.addColorStop(1, '#FFFFFF');

    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = Math.round(logoFontSize * 0.5);
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = textGrad;
    ctx.fillText('SARWARCYOU', padX, canvas.height - padY);
    ctx.restore();

    // Bottom-Right
    ctx.save();
    const domainFontSize = Math.max(13, Math.round(canvas.width * 0.016));
    ctx.font = `600 ${domainFontSize}px Rajdhani, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = Math.round(domainFontSize * 0.45);
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fillText('sarwar.cyou', canvas.width - padX, canvas.height - padY);
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
