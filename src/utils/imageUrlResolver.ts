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

import { isVideoExtension } from './mediaTypeDetector';

/**
 * Global Edge Proxy origin for SARWARCYOU Media Vault (Cloudflare Worker).
 */
export const MEDIA_CDN_BASE = 'https://media.sarwar.cyou';

/**
 * Safely encodes path segments for Hugging Face and Cloudflare Workers,
 * converting raw spaces to %20 and special characters to URL-safe codes
 * while strictly avoiding double-encoding (%2520).
 */
export function encodeMediaPathSegments(path: string): string {
  if (!path) return '';
  return path
    .split('/')
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment))
          .replace(/\(/g, '%28')
          .replace(/\)/g, '%29');
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join('/');
}

/**
 * Safe dark SVG placeholder for media cards when remote thumbnail is unavailable or loading.
 */
export const FALLBACK_THUMBNAIL_PLACEHOLDER =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" fill="none">
      <rect width="640" height="360" fill="#0d0e12"/>
      <circle cx="320" cy="180" r="40" fill="#181a20" stroke="#00E5FF" stroke-width="2" stroke-opacity="0.3"/>
      <polygon points="314,166 332,180 314,194" fill="#00E5FF" fill-opacity="0.8"/>
      <text x="320" y="244" font-family="system-ui, sans-serif" font-size="12" font-weight="600" fill="#71717a" text-anchor="middle" letter-spacing="2">SARWARCYOU MEDIA</text>
    </svg>`
  );

/**
 * Universal media URL builder: routes all repository videos, photos, and generated thumbnails
 * through the Cloudflare Worker edge proxy at https://media.sarwar.cyou.
 *
 * @param relativePath Relative file path or full Hugging Face resolve URL
 */
export function getMediaUrl(relativePath?: string | null): string {
  if (!relativePath) return '';
  let path = relativePath.trim();

  // If blob or data URL, return as-is
  if (path.startsWith('blob:') || path.startsWith('data:')) {
    return path;
  }

  // If local static branding assets
  if (
    path === '/SARWARCYOU.svg' ||
    path === 'SARWARCYOU.svg' ||
    path.startsWith('/brand-logo') ||
    path.startsWith('/favicon')
  ) {
    return path.startsWith('/') ? path : `/${path}`;
  }

  // If external non-Hugging Face host (e.g. Google Drive / lh3.googleusercontent.com)
  if (/^https?:\/\//i.test(path) && !path.includes('huggingface.co') && !path.includes('media.sarwar.cyou')) {
    return path;
  }

  // Strip Hugging Face dataset base URL if present
  path = path.replace(/^https?:\/\/huggingface\.co\/datasets\/[^/]+\/[^/]+\/(?:resolve|raw|tree)\/main\//i, '');
  // Strip media.sarwar.cyou base URL if already prefixed
  path = path.replace(/^https?:\/\/media\.sarwar\.cyou\//i, '');

  let cleanPath = path.replace(/^\/+/, '');
  if (!cleanPath) return '';

  // Transparent case normalization: ensure Thumbnails/ uses uppercase 'T' matching Git repository tree
  if (cleanPath.toLowerCase().startsWith('thumbnails/')) {
    cleanPath = 'Thumbnails/' + cleanPath.slice('thumbnails/'.length);
  }

  const encodedPath = encodeMediaPathSegments(cleanPath);
  return `${MEDIA_CDN_BASE}/${encodedPath}`;
}

export function getDirectImageUrl(
  item: { id?: string; url?: string; thumbnail?: string; type?: string; posterUrl?: string; poster?: string },
  _index = 0
): string {
  if (!item) return '';

  // Google Drive asset check first
  const fileId = extractDriveFileId(item.id, item.url, item.thumbnail);
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  const target = item.thumbnail || item.url || '';
  if (!target) return '';

  // Video items: resolve poster thumbnail through proxy
  if (isVideoExtension(target) || isVideoExtension(item.id) || item.type === 'video') {
    const posterTarget = item.poster || item.posterUrl || item.thumbnail || '';
    if (posterTarget) {
      return getMediaUrl(posterTarget);
    }
    return '';
  }

  // Standard external HTTP/HTTPS images that are NOT on Hugging Face / media CDN
  if (/^https?:\/\//i.test(target) && !target.includes('huggingface.co') && !target.includes('media.sarwar.cyou')) {
    const rawThumb = ensureHttps(target);
    return ensureHttps(rawThumb).replace(/\/u\/\d+\/d\//, '/d/').replace(/=w\d+/, '');
  }

  // Route photo through Cloudflare Worker edge proxy
  return getMediaUrl(target);
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
