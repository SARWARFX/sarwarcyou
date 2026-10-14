/**
 * watermarkImage.ts
 * Single-Source-of-Truth (SSOT) client-side canvas watermarking pipeline
 * for SARWARCYOU Media Vault (sarwar.cyou).
 *
 * Dynamically stamps BRAND_CONFIG.logoSrc (/SARWARCYOU.svg) onto downloaded images.
 */

import { BRAND_CONFIG } from '../config/brand';

/**
 * Universal client-side image watermarking and download trigger.
 * Accepts an HTMLImageElement, direct image URL string, or Blob.
 */
export async function applyWatermarkAndDownload(
  source: HTMLImageElement | string | Blob,
  originalFilename?: string
): Promise<void> {
  const brand =
    typeof window !== 'undefined' && window.BRAND_CONFIG
      ? window.BRAND_CONFIG
      : BRAND_CONFIG;

  let imageElement: HTMLImageElement;
  let objectUrlToRevoke: string | null = null;

  if (source instanceof HTMLImageElement) {
    imageElement = source;
  } else {
    imageElement = new Image();
    imageElement.crossOrigin = 'anonymous';
    const srcUrl = typeof source === 'string' ? source : URL.createObjectURL(source);
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

    // 1. Draw base photo
    ctx.drawImage(imageElement, 0, 0);

    // 2. Load SSOT Logo Image dynamically
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.src = brand.logoSrc;
    await new Promise((resolve) => {
      logoImg.onload = resolve;
      logoImg.onerror = resolve; // fallback gracefully if blocked
    });

    // 3. Draw Brand Logo at Top-Left
    if (logoImg.width) {
      const logoScale = (canvas.width * 0.16) / logoImg.width; // proportional width
      const logoW = logoImg.width * logoScale;
      const logoH = logoImg.height * logoScale;
      const padX = canvas.width * 0.035;
      const padY = canvas.height * 0.035;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 10;
      ctx.drawImage(logoImg, padX, padY, logoW, logoH);
      ctx.shadowBlur = 0;
    }

    // 4. Draw Plain White Source Text at Bottom-Right
    const fontSize = Math.max(14, Math.round(canvas.width * 0.016));
    ctx.font = `600 ${fontSize}px Rajdhani, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 6;
    ctx.fillText(
      `Source: ${brand.sourceUrl}`,
      canvas.width - canvas.width * 0.035,
      canvas.height - canvas.height * 0.035
    );

    // 5. Trigger download
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
          a.download = originalFilename || 'sarwarcyou-media.jpg';
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
  const brand =
    typeof window !== 'undefined' && window.BRAND_CONFIG
      ? window.BRAND_CONFIG
      : BRAND_CONFIG;

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

    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.src = brand.logoSrc;
    await new Promise((resolve) => {
      logoImg.onload = resolve;
      logoImg.onerror = resolve;
    });

    if (logoImg.width) {
      const logoScale = (canvas.width * 0.16) / logoImg.width;
      const logoW = logoImg.width * logoScale;
      const logoH = logoImg.height * logoScale;
      const padX = canvas.width * 0.035;
      const padY = canvas.height * 0.035;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 10;
      ctx.drawImage(logoImg, padX, padY, logoW, logoH);
      ctx.shadowBlur = 0;
    }

    const fontSize = Math.max(14, Math.round(canvas.width * 0.016));
    ctx.font = `600 ${fontSize}px Rajdhani, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 6;
    ctx.fillText(
      `Source: ${brand.sourceUrl}`,
      canvas.width - canvas.width * 0.035,
      canvas.height - canvas.height * 0.035
    );

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
