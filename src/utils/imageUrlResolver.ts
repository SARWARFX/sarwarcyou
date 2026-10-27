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
 * Normalizes legacy, relocated, or mismatched dataset paths to their canonical locations
 * in the SARWARFX/stream-vault Hugging Face repository.
 */
export function normalizeRepoPath(path: string): string {
  if (!path) return '';
  let clean = path.replace(/\\/g, '/').replace(/^\/+/, '').split('?')[0].split('#')[0];
  clean = clean.replace(/^(?:\.thumbnails\/|Thumbnails\/|thumbnails\/)/i, '');
  if (/_thumb_[1-5]\.[a-zA-Z0-9]+$/i.test(clean)) {
    clean = clean.replace(/_thumb_[1-5]\.[a-zA-Z0-9]+$/i, '.mp4');
  }

  // 1. Specific legacy remappings (e.g., stale media.json or manifest references)
  if (/^Images\/Bandhobis\/asha8\.mp4$/i.test(clean)) {
    return 'REALTube/REALTube Video Clips/asha8.mp4';
  }
  if (/^Thumbnails\/Images\/Bandhobis\/asha8_thumb_/i.test(clean)) {
    return clean.replace(/^Thumbnails\/Images\/Bandhobis\//i, 'Thumbnails/REALTube/REALTube Video Clips/');
  }
  if (/^Images\/Bandhobis\/Asha/i.test(clean)) {
    return clean.replace(/^Images\/Bandhobis\//i, 'REALTube/REALTube Images/');
  }
  if (/^Images\/Bandhobis\/Anamika/i.test(clean)) {
    return clean.replace(/^Images\/Bandhobis\//i, 'REALTube/REALTube Images/');
  }
  if (/^Images\/Bandhobis\//i.test(clean)) {
    return clean.replace(/^Images\/Bandhobis\//i, 'Photographs/Classic Images/');
  }
  if (/^Thumbnails\/Images\/Bandhobis\//i.test(clean)) {
    return clean.replace(/^Thumbnails\/Images\/Bandhobis\//i, 'Thumbnails/Photographs/Classic Images/');
  }

  // 2. Folder namespace renames (Images -> Photographs, Clips -> Video Clips)
  if (/^Images\//i.test(clean)) {
    return isVideoExtension(clean) ? clean.replace(/^Images\//i, '') : clean.replace(/^Images\//i, 'Photographs/');
  }
  if (/^Thumbnails\/Images\//i.test(clean)) {
    return clean.replace(/^Thumbnails\/Images\//i, 'Thumbnails/Photographs/');
  }
  if (/^Clips\//i.test(clean)) {
    return clean.replace(/^Clips\//i, 'Video Clips/');
  }
  if (/^Thumbnails\/Clips\//i.test(clean)) {
    return clean.replace(/^Thumbnails\/Clips\//i, 'Thumbnails/Video Clips/');
  }

  return clean;
}

/**
 * Safely encodes individual path segments for URLs.
 * Idempotent: calls decodeURIComponent first to prevent double-encoding (%20 -> %2520).
 */
export function encodeMediaPathSegments(path: string): string {
  if (!path) return '';
  return path
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      const decoded = decodeURIComponent(seg);
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

/**
 * Universal media URL builder: routes all repository videos, photos, and generated thumbnails
 * through the Cloudflare Worker edge proxy at https://media.sarwar.cyou with safe URL encoding.
 *
 * @param relativePath Relative file path or full Hugging Face resolve URL
 */
export function getMediaUrl(relativePath?: string | null): string {
  if (!relativePath) return '';
  let path = relativePath.trim().split('#')[0].split('?')[0];

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

  return `${MEDIA_CDN_BASE}/${encodeMediaPathSegments(cleanPath)}`;
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
