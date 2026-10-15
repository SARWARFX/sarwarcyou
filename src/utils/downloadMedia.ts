/**
 * downloadMedia.ts
 * Robust client-side download helper for Hugging Face CDN media and local assets.
 * Implements 1-Click direct downloads with automated vault filename prefix conventions:
 *   - Videos: `sarwarcyou_sarwar.cyou_clip_[OriginalName]`
 *   - Shorts: `sarwarcyou_sarwar.cyou_short_[OriginalName]`
 *   - Photos: `sarwarcyou_sarwar.cyou_photo_[OriginalName]`
 */

import { safeEncodeUrl, isVideoExtension } from './mediaTypeDetector';
import { applyWatermarkAndDownload, applyImageWatermark, formatPhotoDownloadFilename } from './watermarkImage';
import { getMediaUrl } from './imageUrlResolver';

export { applyWatermarkAndDownload, getMediaUrl };

/**
 * Sanitise a raw filename or URL path into a clean, filesystem-safe name.
 */
export function sanitiseFilename(raw: string): string {
  let name = raw.split('/').pop() || raw;
  name = name.split('?')[0].split('#')[0];
  try {
    name = decodeURIComponent(name);
  } catch {
    /* leave as-is */
  }
  name = name.replace(/%20/g, ' ');
  name = name.replace(/[/\\:*?"<>|]+/g, '_');
  name = name.replace(/\s+/g, '_').trim();
  return name || 'media_file';
}

/**
 * Formats media titles into the Style 3 Cyber Vault filename convention:
 * - Videos: `sarwarcyou_sarwar.cyou_clip_[OriginalName]`
 * - Shorts: `sarwarcyou_sarwar.cyou_short_[OriginalName]`
 * - Photos: `sarwarcyou_sarwar.cyou_photo_[OriginalName]`
 */
export function formatVaultFilename(
  rawTitle?: string,
  mediaType: 'clip' | 'short' | 'photo' = 'clip',
  ext = 'mp4'
): string {
  let base = (rawTitle || mediaType).trim();
  base = base.split('?')[0].split('#')[0];
  base = base.split('/').pop() || base;

  // Strip known extensions
  base = base.replace(/\.(mp4|webm|mov|mkv|avi|m4v|3gp|flv|jpg|jpeg|png|webp|avif|gif)$/i, '');

  try {
    base = decodeURIComponent(base);
  } catch {
    /* leave as-is */
  }

  // Replace invalid filesystem characters and whitespace
  base = base.replace(/[/\\:*?"<>|]+/g, '_');
  base = base.replace(/\s+/g, '_');
  base = base.replace(/_+/g, '_').replace(/^_|_$/g, '') || mediaType;

  const cleanExt = (ext.replace(/^\./, '') || (mediaType === 'photo' ? 'jpg' : 'mp4')).toLowerCase();
  return `sarwarcyou_sarwar.cyou_${mediaType}_${base}.${cleanExt}`;
}

// Backwards-compatible alias for existing callers
export function formatBrandedVideoFilename(rawTitle?: string, ext = 'mp4'): string {
  return formatVaultFilename(rawTitle, 'clip', ext);
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
 * Intercepts video/shorts download actions and fetches the asset as a Blob to enforce
 * the target filename (sarwarcyou_sarwar.cyou_clip_... or sarwarcyou_sarwar.cyou_short_...)
 * across modern browsers, bypassing native cross-origin <a download> restrictions.
 */
export async function downloadBrandedVideo(
  videoUrl: string,
  videoTitle?: string,
  mediaType: 'clip' | 'short' = 'clip'
): Promise<void> {
  const proxyUrl = getMediaUrl(videoUrl);
  const safeUrl = safeEncodeUrl(proxyUrl.replace(/^http:\/\//i, 'https://'));
  const { ext } = inferMime(safeUrl);
  const videoExt = ext || 'mp4';
  const filename = formatVaultFilename(videoTitle || safeUrl, mediaType, videoExt);

  try {
    const response = await fetch(safeUrl, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) throw new Error(`Network response was not ok (${response.status})`);
    const blob = await response.blob();

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

    setTimeout(() => {
      if (tempLink.parentNode) {
        document.body.removeChild(tempLink);
      }
      window.URL.revokeObjectURL(blobUrl);
    }, 30_000);
  } catch (err) {
    console.error('Download error, falling back to direct URL:', err);
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
 * - Videos/Clips: routed through downloadBrandedVideo(..., 'clip')
 * - Shorts: routed through downloadBrandedVideo(..., 'short')
 * - Photos: routed through applyWatermarkAndDownload with sarwarcyou_sarwar.cyou_photo_ prefix
 */
export async function downloadMedia(
  url: string,
  rawName?: string,
  forcedType?: 'clip' | 'short' | 'photo'
): Promise<void> {
  const proxyUrl = getMediaUrl(url);
  const safeUrl = safeEncodeUrl(proxyUrl.replace(/^http:\/\//i, 'https://'));
  const { mime, ext } = inferMime(safeUrl);
  const isVideo = forcedType === 'clip' || forcedType === 'short' || mime.startsWith('video/') || isVideoExtension(safeUrl);
  const isShort = forcedType === 'short' || safeUrl.includes('/Shorts/');

  if (isVideo) {
    return downloadBrandedVideo(safeUrl, rawName, isShort ? 'short' : 'clip');
  }

  const isImage = mime.startsWith('image/') && mime !== 'image/svg+xml' && mime !== 'image/gif';
  const targetPhotoFilename = formatPhotoDownloadFilename(rawName || safeUrl, ext || 'jpg');

  if (isImage) {
    try {
      await applyWatermarkAndDownload(safeUrl, targetPhotoFilename);
      return;
    } catch (wmError) {
      console.warn('Canvas watermarking failed, falling back to direct download:', wmError);
    }
  }

  try {
    const res = await fetch(safeUrl, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const originalBlob = await res.blob();

    const objUrl = URL.createObjectURL(
      new Blob([originalBlob], { type: mime || originalBlob.type || 'application/octet-stream' })
    );
    triggerDownload(objUrl, targetPhotoFilename);
    setTimeout(() => URL.revokeObjectURL(objUrl), 30_000);
  } catch {
    if (isImage) {
      try {
        const watermarkedBlob = await applyImageWatermark(safeUrl, mime);
        const objUrl = URL.createObjectURL(watermarkedBlob);
        triggerDownload(objUrl, targetPhotoFilename);
        setTimeout(() => URL.revokeObjectURL(objUrl), 30_000);
        return;
      } catch (imgError) {
        console.warn('Image direct URL watermarking fallback failed:', imgError);
      }
    }

    triggerDownload(safeUrl, targetPhotoFilename);
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
