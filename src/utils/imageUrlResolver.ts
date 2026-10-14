/**
 * imageUrlResolver.ts
 * Resolves media URLs for Hugging Face CDN and Google Drive streams.
 * Strict zero-mock-photo policy: NO Unsplash or external stock placeholder URLs.
 */

export function ensureHttps(url?: string): string {
  if (!url) return '';
  return url.replace(/^http:\/\//i, 'https://');
}

export function extractDriveFileId(id?: string, url?: string, thumbnail?: string): string | null {
  if (id && id.length >= 15 && !id.includes('/') && !id.includes('.')) {
    return id;
  }
  const target = thumbnail || url || '';
  const match =
    target.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
    target.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
    target.match(/googleusercontent\.com\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

import { isVideoExtension, safeEncodeUrl } from './mediaTypeDetector';

export function getDirectImageUrl(
  item: { id?: string; url?: string; thumbnail?: string; type?: string; posterUrl?: string },
  _index = 0
): string {
  if (!item) return '';
  const target = item.thumbnail || item.url || '';

  if (target.includes('huggingface.co')) {
    if (isVideoExtension(target) || isVideoExtension(item.id) || item.type === 'video') {
      return item.posterUrl || item.thumbnail || '';
    }
    return safeEncodeUrl(target);
  }

  const fileId = extractDriveFileId(item.id, item.url, item.thumbnail);
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  const rawThumb = ensureHttps(item.thumbnail || item.url || '');
  if (rawThumb.startsWith('https://') || rawThumb.startsWith('http://')) {
    return ensureHttps(rawThumb).replace(/\/u\/\d+\/d\//, '/d/').replace(/=w\d+/, '');
  }

  return '';
}

export function getBackupDriveUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

/**
 * Deprecated fallback returning empty string.
 * Strictly guarantees zero external stock/dummy photo leakage.
 */
export function getUnsplashFallback(_index = 0): string {
  return '';
}
