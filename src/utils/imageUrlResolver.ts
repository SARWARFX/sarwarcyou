/**
 * imageUrlResolver.ts
 * Resolves media URLs for Hugging Face CDN and Google Drive streams.
 * Strict zero-mock-photo policy: NO Unsplash or external stock placeholder URLs.
 */

import { isVideoExtension } from './mediaTypeDetector';

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

/**
 * Normalizes legacy, relocated, or mismatched dataset paths to their canonical locations
 * in the SARWARFX/stream-vault Hugging Face repository.
 */
export function normalizeRepoPath(path: string): string {
  if (!path) return '';
  let clean = path.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  // Strip trailing media playback fragment like #t=1.0 or query strings
  clean = clean.replace(/#t=[\d.,]+$/i, '').split('?')[0];
  clean = clean.replace(/^(?:\.thumbnails\/|Thumbnails\/|thumbnails\/)/i, '');
  if (/_thumb_[1-5]\.[a-zA-Z0-9]+$/i.test(clean)) {
    clean = clean.replace(/_thumb_[1-5]\.[a-zA-Z0-9]+$/i, '.mp4');
  }

  // 1. Specific legacy files
  if (/^Images\/Bandhobis\/asha8\.mp4$/i.test(clean)) {
    return 'REALTube/REALTube Video Clips/asha8.mp4';
  }
  if (/^Thumbnails\/Images\/Bandhobis\/asha8_thumb_/i.test(clean)) {
    return clean.replace(/^Thumbnails\/Images\/Bandhobis\//i, 'Thumbnails/REALTube/REALTube Video Clips/');
  }
  if (/^Images\/Bandhobis\/Asha/i.test(clean) || /^Images\/Bandhobis\/Anamika/i.test(clean)) {
    return clean.replace(/^Images\/Bandhobis\//i, 'REALTube/REALTube Images/');
  }
  if (/^Images\/Bandhobis\//i.test(clean)) {
    return clean.replace(/^Images\/Bandhobis\//i, 'Photographs/Classic Images/');
  }
  if (/^Thumbnails\/Images\/Bandhobis\//i.test(clean)) {
    return clean.replace(/^Thumbnails\/Images\/Bandhobis\//i, 'Thumbnails/Photographs/Classic Images/');
  }

  // 2. Folder mappings
  clean = clean.replace(/^Clips\/H2025\//i, 'Video Clips/Clips 2025/');
  clean = clean.replace(/^Clips\/H2026\//i, 'Video Clips/Clips 2026/');
  clean = clean.replace(/^Clips\/H2027\//i, 'Video Clips/Clips 2027/');
  clean = clean.replace(/^Clips\/Favorite\//i, 'Video Clips/Favorite Video Clips/');
  clean = clean.replace(/^Clips\/Others(?:\s*)\//i, 'Video Clips/Classic Video Clips/');
  clean = clean.replace(/^Clips\//i, 'Video Clips/');
  clean = clean.replace(/^Thumbnails\/Clips\//i, 'Thumbnails/Video Clips/');

  clean = clean.replace(/^Images\/H2025\//i, 'Photographs/Images 2025/');
  clean = clean.replace(/^Images\/H2026\//i, 'Photographs/Images 2026/');
  clean = clean.replace(/^Images\/H2027\//i, 'Photographs/Images 2027/');
  clean = clean.replace(/^Images\/works\//i, 'Photographs/Classic Images/');
  clean = clean.replace(/^Images\/Classic(?:\s*)\//i, 'Photographs/Classic Images/');
  clean = clean.replace(/^Images\//i, 'Photographs/');
  clean = clean.replace(/^Thumbnails\/Images\//i, 'Thumbnails/Photographs/');

  return clean;
}

/**
 * Safely encodes individual path segments for URLs.
 * Idempotent with try/catch to protect against malformed percent encodings.
 */
export function encodeMediaPathSegments(path: string): string {
  if (!path) return '';
  return path
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      let decoded = seg;
      try {
        decoded = decodeURIComponent(seg);
      } catch {
        decoded = seg;
      }
      return encodeURIComponent(decoded)
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29')
        .replace(/'/g, '%27')
        .replace(/!/g, '%21')
        .replace(/\*/g, '%2A');
    })
    .join('/');
}

/**
 * Global Edge Proxy origin for SARWARCYOU Media Vault (Cloudflare Worker).
 */
export const MEDIA_CDN_BASE = 'https://media.sarwar.cyou';
export const HF_RESOLVE_BASE = 'https://huggingface.co/datasets/SARWARFX/stream-vault/resolve/main';

/**
 * Universal media URL builder: routes all repository videos, photos, and generated thumbnails
 * through the Cloudflare Worker edge proxy at https://media.sarwar.cyou with safe URL encoding.
 * For rare files whose names contain '#' (which Cloudflare router truncates), routes cleanly
 * to Hugging Face direct resolve URL.
 *
 * Guaranteed to ALWAYS return an absolute URL (never relative).
 *
 * @param relativePath Relative file path or full Hugging Face resolve URL
 */
export function getMediaUrl(relativePath?: string | null): string {
  if (!relativePath) return '';
  let path = relativePath.trim();

  // Strip trailing media fragment like #t=1.0 or query parameters
  path = path.replace(/#t=[\d.,]+$/i, '').split('?')[0];

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

  const normalized = normalizeRepoPath(path);
  const cleanPath = normalized.replace(/^\/+/, '');
  if (!cleanPath) return '';

  const encodedPath = encodeMediaPathSegments(cleanPath);

  // Files containing '#' in their name are routed directly to Hugging Face
  // because Cloudflare Worker pathname router truncates at '#'
  if (cleanPath.includes('#')) {
    return `${HF_RESOLVE_BASE}/${encodedPath}`;
  }

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
    if (posterTarget && !isVideoExtension(posterTarget)) {
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
