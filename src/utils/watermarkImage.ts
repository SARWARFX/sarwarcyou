/**
 * watermarkImage.ts
 * Client-side canvas watermarking pipeline for SARWARCYOU Media Vault (sarwar.cyou).
 *
 * Requirements:
 * 1. Process source image on offscreen HTML5 <canvas> preserving full original
 *    resolution (naturalWidth x naturalHeight) and aspect ratio.
 * 2. Top-Left Brand Watermark:
 *    - Dynamic padding relative to image scale (padX = width * 0.035, padY = height * 0.035)
 *    - Exact 3-piece interlocking delta emblem scaled proportionally (emblemSize = max(28, width * 0.045))
 *    - Filled with active/synchronized white-to-spectral gradient
 *    - Adjacent "SARWARCYOU" wordmark in Orbitron 900 bold, vertically centered, drop shadow
 * 3. Bottom-Right Source Watermark:
 *    - Text: "Source: https://www.sarwar.cyou/"
 *    - Font: Rajdhani 600, clamped font size (12px to 28px), drop shadow
 * 4. Export composite canvas to JPEG (quality 0.95) or PNG preserving lossless fidelity.
 */

export interface WatermarkOptions {
  /** Optional custom website URL in watermark text (default: 'Source: https://www.sarwar.cyou/') */
  sourceText?: string;
  /** Optional custom brand text (default: 'SARWARCYOU') */
  brandText?: string;
}

/**
 * Draw the exact 3-piece interlocking delta logo on the canvas context.
 * Coordinates are mapped to a 100x100 viewBox and scaled/translated to (x, y) with size `size`.
 */
function drawInterlockingDelta(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);

  // Spectral Linear Gradient from top-left (0,0) to bottom-right (100,100)
  const grad = ctx.createLinearGradient(0, 0, 100, 100);
  grad.addColorStop(0, '#ffffff');

  // Sync with active CSS root dynamic hue / color if available
  let dynamicColor = 'hsl(205, 100%, 65%)';
  if (typeof window !== 'undefined') {
    try {
      const rootStyle = getComputedStyle(document.documentElement);
      const brandColor = rootStyle.getPropertyValue('--brand-dynamic-color').trim();
      if (brandColor) {
        dynamicColor = brandColor;
      } else {
        const hue = rootStyle.getPropertyValue('--current-hue').trim();
        if (hue) dynamicColor = `hsl(${hue}, 100%, 65%)`;
      }
    } catch {
      /* fallback to default */
    }
  }
  grad.addColorStop(0.5, dynamicColor);
  grad.addColorStop(1, '#ffffff');

  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = Math.max(4, Math.round(size * 0.12));
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.max(1, Math.round(size * 0.03));

  // Segment 1: Top-Left Apex Bar (d="M 50,6 L 62,28 L 47,56 L 31,56 Z")
  ctx.beginPath();
  ctx.moveTo(50, 6);
  ctx.lineTo(62, 28);
  ctx.lineTo(47, 56);
  ctx.lineTo(31, 56);
  ctx.closePath();
  ctx.fill();

  // Segment 2: Bottom-Left Foot & Center Fold (d="M 24,67 L 41,67 L 54,92 L 11,92 L 24,67 Z M 44,67 L 58,41 L 69,61 L 55,61 Z")
  ctx.beginPath();
  ctx.moveTo(24, 67);
  ctx.lineTo(41, 67);
  ctx.lineTo(54, 92);
  ctx.lineTo(11, 92);
  ctx.closePath();
  ctx.moveTo(44, 67);
  ctx.lineTo(58, 41);
  ctx.lineTo(69, 61);
  ctx.lineTo(55, 61);
  ctx.closePath();
  ctx.fill();

  // Segment 3: Right Slanted Leg (d="M 64,19 L 50,46 L 63,69 L 89,92 L 100,92 Z")
  ctx.beginPath();
  ctx.moveTo(64, 19);
  ctx.lineTo(50, 46);
  ctx.lineTo(63, 69);
  ctx.lineTo(89, 92);
  ctx.lineTo(100, 92);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Prepares fonts so canvas renders with exact typography without fallback delays.
 */
async function ensureFontsReady(): Promise<void> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
      await Promise.allSettled([
        document.fonts.load('900 32px Orbitron'),
        document.fonts.load('600 18px Rajdhani'),
      ]);
    } catch {
      /* continue */
    }
  }
}

/**
 * Loads an image from a URL or Blob into an HTMLImageElement safely.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Failed to load image for watermarking: ${err}`));
    img.src = src;
  });
}

/**
 * Watermarks an image Blob or source URL and returns the composite Blob.
 * Preserves 100% of original image dimensions and aspect ratio.
 *
 * @param source     A Blob or direct image URL
 * @param mimeType   MIME type of the source (e.g. 'image/jpeg', 'image/png')
 * @param options    Custom watermark text options
 */
export async function applyImageWatermark(
  source: Blob | string,
  mimeType = 'image/jpeg',
  options?: WatermarkOptions
): Promise<Blob> {
  let objectUrlToRevoke: string | null = null;
  let imageSrc: string;

  if (typeof source === 'string') {
    imageSrc = source;
  } else {
    imageSrc = URL.createObjectURL(source);
    objectUrlToRevoke = imageSrc;
  }

  try {
    // Wait for fonts and load image in parallel
    const [, img] = await Promise.all([
      ensureFontsReady(),
      loadImage(imageSrc),
    ]);

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    if (!width || !height) {
      throw new Error(`Invalid image dimensions: ${width}x${height}`);
    }

    // 1. Create Offscreen Canvas matching exact source dimensions
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to create 2D canvas context');
    }

    // Draw base source image at full native resolution
    ctx.drawImage(img, 0, 0, width, height);

    // Dynamic padding relative to image scale
    const padX = Math.round(width * 0.035);
    const padY = Math.round(height * 0.035);

    // 2. TOP-LEFT BRAND WATERMARK (Emblem + "SARWARCYOU")
    const emblemSize = Math.max(28, Math.round(width * 0.045));
    drawInterlockingDelta(ctx, padX, padY, emblemSize);

    // Brand Wordmark
    const brandText = options?.brandText || 'SARWARCYOU';
    const brandFontSize = Math.round(emblemSize * 0.65);
    const brandTextX = padX + emblemSize + Math.round(emblemSize * 0.25);
    const brandTextY = padY + emblemSize / 2;

    ctx.save();
    ctx.font = `900 ${brandFontSize}px Orbitron, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = Math.max(4, Math.round(brandFontSize * 0.25));
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.max(1, Math.round(brandFontSize * 0.06));
    ctx.fillText(brandText, brandTextX, brandTextY);
    ctx.restore();

    // 3. BOTTOM-RIGHT SOURCE WATERMARK ("Source: https://www.sarwar.cyou/")
    const sourceText = options?.sourceText || 'Source: https://www.sarwar.cyou/';
    const sourceFontSize = Math.round(Math.min(28, Math.max(12, width * 0.018)));

    ctx.save();
    ctx.font = `600 ${sourceFontSize}px Rajdhani, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    ctx.fillText(sourceText, width - padX, height - padY);
    ctx.restore();

    // 4. Export composite canvas to Blob
    const isPng = mimeType === 'image/png';
    const exportMime = isPng ? 'image/png' : 'image/jpeg';
    const exportQuality = isPng ? undefined : 0.95;

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas export produced a null Blob'));
          }
        },
        exportMime,
        exportQuality
      );
    });
  } finally {
    if (objectUrlToRevoke) {
      URL.revokeObjectURL(objectUrlToRevoke);
    }
  }
}
