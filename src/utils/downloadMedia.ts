/**
 * downloadMedia.ts
 * Robust client-side download helper for Hugging Face CDN media and local assets.
 * Implements smart branded file renaming for all video downloads:
 *   Template: SARWARCYOU_[Sanitized_Video_Title]_Source-sarwar-cyou.mp4
 *   Example:  SARWARCYOU_Cyber_Pulse_Ep1_Source-sarwar-cyou.mp4
 *
 * Intercepts video downloads via async Blob streaming to enforce custom branded
 * filenames across modern browsers (bypassing CDN cross-origin anchor restrictions),
 * and routes image downloads through client-side canvas watermarking.
 */

import { safeEncodeUrl, isVideoExtension } from './mediaTypeDetector';
import { applyImageWatermark } from './watermarkImage';

/**
 * Sanitise a raw filename or URL path into a clean, filesystem-safe name.
 * Decodes URI-encoded characters, strips query strings, and replaces
 * sequences of unsafe characters with underscores.
 */
export function sanitiseFilename(raw: string): string {
  // Take only the last path segment
  let name = raw.split('/').pop() || raw;
  // Remove query string and hash
  name = name.split('?')[0].split('#')[0];
  // Decode percent-encoded chars (e.g. %20 -> space, %5B -> [)
  try {
    name = decodeURIComponent(name);
  } catch {
    /* leave as-is */
  }
  // Replace any residual %20 with spaces
  name = name.replace(/%20/g, ' ');
  // Strip characters forbidden in Windows/Unix filenames: / \ : * ? " < > |
  name = name.replace(/[/\\:*?"<>|]+/g, ' ');
  // Collapse multiple spaces and trim
  name = name.replace(/\s+/g, ' ').trim();
  return name || 'media_file';
}

/**
 * Formats a video title into the standardized SARWARCYOU branded filename convention:
 * Template: SARWARCYOU_[Sanitized_Video_Title]_Source-sarwar-cyou.mp4
 * Example:  SARWARCYOU_Cyber_Pulse_Ep1_Source-sarwar-cyou.mp4
 *
 * Sanitization rules:
 * - Removes illegal/reserved filesystem characters (/ \ : * ? " < > | . ,).
 * - Replaces whitespace and non-alphanumeric chars with clean underscores.
 * - Collapses repeated underscores and strips leading/trailing punctuation.
 * - Enforces the canonical .mp4 extension (or matching video extension).
 */
export function formatBrandedVideoFilename(rawTitle?: string, ext = 'mp4'): string {
  let base = (rawTitle || 'clip').trim();

  // Strip query strings and hash anchors
  base = base.split('?')[0].split('#')[0];

  // If a URL or full path was provided, use only the final segment
  base = base.split('/').pop() || base;

  // Remove existing file extension (e.g. .mp4, .webm, .mov, .mkv)
  base = base.replace(/\.(mp4|webm|mov|mkv|avi|m4v|3gp|flv)$/i, '');

  try {
    base = decodeURIComponent(base);
  } catch {
    /* leave as-is */
  }

  // Replace spaces, dots, commas, slashes, and reserved characters with underscores
  base = base.replace(/[/\\:*?"<>|.,\s]+/g, '_');

  // Strip any remaining characters outside alphanumeric, hyphens, and underscores
  base = base.replace(/[^a-zA-Z0-9_-]/g, '_');

  // Collapse consecutive underscores and strip leading/trailing underscores
  base = base.replace(/_+/g, '_').replace(/^_|_$/g, '');

  const sanitizedTitle = base || 'clip';
  const cleanExt = (ext.replace(/^\./, '') || 'mp4').toLowerCase();

  return `SARWARCYOU_${sanitizedTitle}_Source-sarwar-cyou.${cleanExt}`;
}

/**
 * Infer MIME type and file extension from a URL path.
 */
export function inferMime(url: string): { mime: string; ext: string } {
  const lower = url.split('?')[0].toLowerCase();
  if (lower.endsWith('.mp4'))  return { mime: 'video/mp4',  ext: 'mp4' };
  if (lower.endsWith('.webm')) return { mime: 'video/webm', ext: 'webm' };
  if (lower.endsWith('.mov'))  return { mime: 'video/quicktime', ext: 'mov' };
  if (lower.endsWith('.mkv'))  return { mime: 'video/x-matroska', ext: 'mkv' };
  if (lower.endsWith('.avi'))  return { mime: 'video/x-msvideo', ext: 'avi' };
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return { mime: 'image/jpeg', ext: 'jpg' };
  if (lower.endsWith('.png'))  return { mime: 'image/png', ext: 'png' };
  if (lower.endsWith('.webp')) return { mime: 'image/webp', ext: 'webp' };
  if (lower.endsWith('.gif'))  return { mime: 'image/gif', ext: 'gif' };
  if (lower.endsWith('.svg'))  return { mime: 'image/svg+xml', ext: 'svg' };
  if (lower.endsWith('.heic')) return { mime: 'image/heic', ext: 'heic' };
  if (lower.endsWith('.avif')) return { mime: 'image/avif', ext: 'avif' };
  if (lower.endsWith('.bmp'))  return { mime: 'image/bmp', ext: 'bmp' };
  if (lower.endsWith('.tiff') || lower.endsWith('.tif')) return { mime: 'image/tiff', ext: 'tiff' };
  return { mime: 'application/octet-stream', ext: '' };
}

/**
 * Ensure a filename has the correct extension based on MIME type.
 */
function ensureExtension(name: string, ext: string): string {
  if (!ext) return name;
  const lower = name.toLowerCase();
  if (lower.endsWith(`.${ext}`)) return name;
  // Remove any existing extension if different
  const lastDot = name.lastIndexOf('.');
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  return `${base}.${ext}`;
}

/**
 * Intercepts video download actions and fetches the asset as a Blob to enforce
 * the branded filename (SARWARCYOU_[Sanitized_Video_Title]_Source-sarwar-cyou.mp4)
 * across all modern browsers, bypassing native cross-origin <a download> restrictions.
 *
 * @param videoUrl    The stream or direct CDN URL of the video
 * @param videoTitle  The original title, id, or filename of the video
 */
export async function downloadBrandedVideo(videoUrl: string, videoTitle?: string): Promise<void> {
  const safeUrl = safeEncodeUrl(videoUrl.replace(/^http:\/\//i, 'https://'));
  const { ext } = inferMime(safeUrl);
  const videoExt = ext || 'mp4';
  const filename = formatBrandedVideoFilename(videoTitle || safeUrl, videoExt);

  try {
    // 2. Fetch video binary as Blob
    const response = await fetch(safeUrl, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) throw new Error(`Network response was not ok (${response.status})`);
    const blob = await response.blob();

    // 3. Trigger programmatic download with branded filename
    const blobUrl = window.URL.createObjectURL(
      new Blob([blob], { type: blob.type || 'video/mp4' })
    );
    const tempLink = document.createElement('a');
    tempLink.style.display = 'none';
    tempLink.href = blobUrl;
    tempLink.setAttribute('download', filename);
    tempLink.rel = 'noopener noreferrer';
    document.body.appendChild(tempLink);
    tempLink.click();

    // 4. Cleanup
    setTimeout(() => {
      if (tempLink.parentNode) {
        document.body.removeChild(tempLink);
      }
      window.URL.revokeObjectURL(blobUrl);
    }, 30_000);
  } catch (err) {
    console.error('Download error, falling back to direct URL:', err);
    // Fallback: direct download link
    const fallbackLink = document.createElement('a');
    fallbackLink.href = safeUrl;
    fallbackLink.target = '_blank';
    fallbackLink.download = filename;
    fallbackLink.rel = 'noopener noreferrer';
    document.body.appendChild(fallbackLink);
    fallbackLink.click();
    setTimeout(() => {
      if (fallbackLink.parentNode) {
        document.body.removeChild(fallbackLink);
      }
    }, 1000);
  }
}

/**
 * Primary universal download dispatcher:
 * - Videos: routed through downloadBrandedVideo() for SARWARCYOU branded renaming.
 * - Images: routed through applyImageWatermark() for canvas brand + source watermarking.
 * - Other files: streamed via Blob with fallback to anchor link.
 *
 * @param url      The direct CDN URL of the media file (must be https://)
 * @param rawName  Optional custom base name; derived from URL if omitted.
 */
export async function downloadMedia(url: string, rawName?: string): Promise<void> {
  const safeUrl = safeEncodeUrl(url.replace(/^http:\/\//i, 'https://'));
  const { mime, ext } = inferMime(safeUrl);
  const isVideo = mime.startsWith('video/') || isVideoExtension(safeUrl);

  // Delegate video downloads to branded video downloader
  if (isVideo) {
    return downloadBrandedVideo(safeUrl, rawName);
  }

  const isImage = mime.startsWith('image/') && mime !== 'image/svg+xml' && mime !== 'image/gif';
  const baseName = rawName ? sanitiseFilename(rawName) : sanitiseFilename(safeUrl);
  let filename = ensureExtension(baseName, ext);

  try {
    // Attempt Blob-based download (works same-origin or CORS-enabled CDN)
    const res = await fetch(safeUrl, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const originalBlob = await res.blob();

    let finalBlob = originalBlob;

    // Apply watermarking if media is an image
    if (isImage) {
      try {
        finalBlob = await applyImageWatermark(originalBlob, mime);
        const outExt = finalBlob.type === 'image/png' ? 'png' : 'jpg';
        filename = ensureExtension(baseName, outExt);
      } catch (wmError) {
        console.warn('Canvas watermarking failed, proceeding with original image:', wmError);
        finalBlob = originalBlob;
      }
    }

    const objUrl = URL.createObjectURL(
      new Blob([finalBlob], { type: finalBlob.type || mime || 'application/octet-stream' })
    );
    triggerDownload(objUrl, filename);
    // Revoke after a short delay to allow the browser to complete writing
    setTimeout(() => URL.revokeObjectURL(objUrl), 30_000);
  } catch (fetchError) {
    // Fallback: If blob fetch failed, try direct URL watermarking if image
    if (isImage) {
      try {
        const watermarkedBlob = await applyImageWatermark(safeUrl, mime);
        const outExt = watermarkedBlob.type === 'image/png' ? 'png' : 'jpg';
        const watermarkedName = ensureExtension(baseName, outExt);
        const objUrl = URL.createObjectURL(watermarkedBlob);
        triggerDownload(objUrl, watermarkedName);
        setTimeout(() => URL.revokeObjectURL(objUrl), 30_000);
        return;
      } catch (imgError) {
        console.warn('Image direct URL watermarking fallback failed:', imgError);
      }
    }

    // Ultimate fallback: trigger browser direct download streaming via <a> tag
    console.warn('Direct blob fetch failed, falling back to streaming anchor link:', fetchError);
    triggerDownload(safeUrl, filename);
  }
}

function triggerDownload(href: string, filename: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
