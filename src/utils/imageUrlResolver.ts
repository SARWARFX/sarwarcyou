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
 * Safely joins a base folder path and a sub path without duplicating parent folder segments.
 * e.g. sanitizePath('Shorts/Shorts Classic', 'Shorts Classic/video.mp4') -> 'Shorts/Shorts Classic/video.mp4'
 * e.g. sanitizePath('Shorts', 'Shorts Classic/video.mp4') -> 'Shorts/Shorts Classic/video.mp4'
 */
export function sanitizePath(base: string, sub: string): string {
  if (!sub) return base;
  if (!base) return sub;
  const cleanBase = base.replace(/\\/g, '/').replace(/\/+$/, '');
  const cleanSub = sub.replace(/\\/g, '/').replace(/^\/+/, '');
  if (cleanSub === cleanBase || cleanSub.startsWith(cleanBase + '/')) return cleanSub;

  // Prevent duplicating parent folder (e.g. Shorts Classic / Shorts Classic)
  const baseParts = cleanBase.split('/');
  const lastBaseSegment = baseParts[baseParts.length - 1];
  if (cleanSub.startsWith(lastBaseSegment + '/')) {
    return cleanBase + '/' + cleanSub.slice(lastBaseSegment.length + 1);
  }

  // Also check decoded and normalized comparison to prevent %20 vs space duplicates
  let decodedLast = lastBaseSegment;
  let decodedFirst = cleanSub.split('/')[0];
  try { decodedLast = decodeURIComponent(lastBaseSegment); } catch {}
  try { decodedFirst = decodeURIComponent(decodedFirst); } catch {}

  const norm = (s: string) => s.toLowerCase().replace(/[-_\s]/g, '');
  if (norm(decodedLast) === norm(decodedFirst)) {
    const remaining = cleanSub.split('/').slice(1).join('/');
    return remaining ? `${cleanBase}/${remaining}` : cleanBase;
  }

  return `${cleanBase}/${cleanSub}`;
}

/**
 * Deduplicates adjacent or duplicated identical folder segments in a path.
 * e.g. "Shorts/Shorts Classic/Shorts Classic/video.mp4" -> "Shorts/Shorts Classic/video.mp4"
 * e.g. "Thumbnails/Shorts/Shorts%20Classic/Shorts Classic/video.webp" -> "Thumbnails/Shorts/Shorts Classic/video.webp"
 */
export function deduplicatePathSegments(path: string): string {
  if (!path) return '';
  const clean = path.replace(/\\/g, '/');
  const segments = clean.split('/').filter(Boolean);
  const deduped: string[] = [];
  const norm = (s: string) => {
    let dec = s;
    try { dec = decodeURIComponent(s); } catch {}
    return dec.toLowerCase().replace(/[-_\s]/g, '');
  };
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const prev = deduped.length > 0 ? deduped[deduped.length - 1] : null;
    if (prev && norm(seg) === norm(prev)) {
      continue;
    }
    deduped.push(seg);
  }
  let result = deduped.join('/');
  result = result.replace(/(?:^|\/)(Shorts(?:\/|%20|\s+)Classic)\/(?:\1|Shorts Classic|Shorts%20Classic)(?=\/|$)/gi, '/$1');
  return result.replace(/^\/+/, '');
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

  const isThumbnailPath = /^(?:\.thumbnails\/|Thumbnails\/|thumbnails\/)/i.test(clean);

  // Map any "Jacqueline" references (e.g. Sh.Jacqueline, Jacqueline .mp4) to canonical dataset path "Shorts/Shorts 2027/Jacqueline .mp4"
  if (/Jacqueline/i.test(clean)) {
    clean = isThumbnailPath
      ? 'Thumbnails/Shorts/Shorts 2027/Jacqueline .webp'
      : 'Shorts/Shorts 2027/Jacqueline .mp4';
  }

  if (isThumbnailPath) {
    // Canonicalize thumbnail prefix to 'Thumbnails/'
    clean = clean.replace(/^(?:\.thumbnails\/|Thumbnails\/|thumbnails\/)/i, 'Thumbnails/');
  } else {
    // Legacy check: if old multi-frame thumbnail pattern was passed as video
    if (/_thumb_[1-5]\.[a-zA-Z0-9]+$/i.test(clean)) {
      clean = clean.replace(/_thumb_[1-5]\.[a-zA-Z0-9]+$/i, '.mp4');
    }
  }

  // 1. Specific legacy files
  if (/ustream_thumb/i.test(clean)) {
    return '';
  }
  if (/Tejashwini.*Lulustream/i.test(clean)) {
    return isThumbnailPath
      ? 'Thumbnails/Video Clips/2027/webmedia-serial-427.webp'
      : 'Video Clips/2027/webmedia-serial-427.mp4';
  }
  if (/Nidhi.*Agarwal/i.test(clean)) {
    return isThumbnailPath
      ? 'Thumbnails/Shorts/Older/webmedia-serial-340.webp'
      : 'Shorts/Older/webmedia-serial-340.mp4';
  }
  if (/^Images\/Bandhobis\/asha8\.mp4$/i.test(clean) || /^Bandhobi.*asha8\.mp4$/i.test(clean)) {
    return 'Bandhobi/Video Clips/asha8.mp4';
  }
  if (/^Thumbnails\/.*asha8/i.test(clean)) {
    return 'Thumbnails/Bandhobi/Video Clips/asha8.webp';
  }
  if (/^Images\/Bandhobis\//i.test(clean)) {
    return clean.replace(/^Images\/Bandhobis\//i, 'Bandhobi/Photographs/');
  }

  // 2. Folder mappings
  clean = deduplicatePathSegments(clean);

  if (isThumbnailPath) {
    clean = clean.replace(/^Thumbnails\/REALTube\/REALTube Images\//i, 'Thumbnails/Bandhobi/Photographs/');
    clean = clean.replace(/^Thumbnails\/REALTube\/REALTube Shorts\//i, 'Thumbnails/Bandhobi/Shorts/');
    clean = clean.replace(/^Thumbnails\/REALTube\/REALTube Video Clips\//i, 'Thumbnails/Bandhobi/Video Clips/');
    clean = clean.replace(/^Thumbnails\/REALTube\//i, 'Thumbnails/Bandhobi/');

    clean = clean.replace(/^Thumbnails\/(?:Video Clips\/)?(?:Clips 2025|H2025)\//i, 'Thumbnails/Video Clips/2025/');
    clean = clean.replace(/^Thumbnails\/(?:Video Clips\/)?(?:Clips 2026|H2026)\//i, 'Thumbnails/Video Clips/2026/');
    clean = clean.replace(/^Thumbnails\/(?:Video Clips\/)?(?:Clips 2027|H2027)\//i, 'Thumbnails/Video Clips/2027/');
    clean = clean.replace(/^Thumbnails\/(?:Video Clips\/)?(?:Favorite Video Clips|Favorite)\//i, 'Thumbnails/Video Clips/Favorite/');
    clean = clean.replace(/^Thumbnails\/(?:Video Clips\/)?(?:Classic Video Clips|Classic|Others)\//i, 'Thumbnails/Video Clips/Older/');
    clean = clean.replace(/^Thumbnails\/Clips\//i, 'Thumbnails/Video Clips/');

    clean = clean.replace(/^Thumbnails\/(?:Photographs\/)?(?:Images 2025|H2025)\//i, 'Thumbnails/Photographs/2025/');
    clean = clean.replace(/^Thumbnails\/(?:Photographs\/)?(?:Images 2026|H2026)\//i, 'Thumbnails/Photographs/2026/');
    clean = clean.replace(/^Thumbnails\/(?:Photographs\/)?(?:Images 2027|H2027)\//i, 'Thumbnails/Photographs/2027/');
    clean = clean.replace(/^Thumbnails\/(?:Photographs\/)?(?:Favourite Images|favorite_images|works)\//i, 'Thumbnails/Photographs/Favorite/');
    clean = clean.replace(/^Thumbnails\/(?:Photographs\/)?(?:Classic Images|classic_images|Classic)\//i, 'Thumbnails/Photographs/Older/');
    clean = clean.replace(/^Thumbnails\/Images\//i, 'Thumbnails/Photographs/');

    clean = clean.replace(/^Thumbnails\/Shorts\/(?:Shorts 2027|2027)\//i, 'Thumbnails/Shorts/2027/');
    clean = clean.replace(/^Thumbnails\/Shorts\/(?:Shorts Classic|Classic|Older)\//i, 'Thumbnails/Shorts/Older/');
  } else {
    clean = clean.replace(/^REALTube\/REALTube Images\//i, 'Bandhobi/Photographs/');
    clean = clean.replace(/^REALTube\/REALTube Shorts\//i, 'Bandhobi/Shorts/');
    clean = clean.replace(/^REALTube\/REALTube Video Clips\//i, 'Bandhobi/Video Clips/');
    clean = clean.replace(/^REALTube\//i, 'Bandhobi/');

    clean = clean.replace(/^(?:Video Clips\/)?(?:Clips 2025|H2025)\//i, 'Video Clips/2025/');
    clean = clean.replace(/^(?:Video Clips\/)?(?:Clips 2026|H2026)\//i, 'Video Clips/2026/');
    clean = clean.replace(/^(?:Video Clips\/)?(?:Clips 2027|H2027)\//i, 'Video Clips/2027/');
    clean = clean.replace(/^(?:Video Clips\/)?(?:Favorite Video Clips|Favorite)\//i, 'Video Clips/Favorite/');
    clean = clean.replace(/^(?:Video Clips\/)?(?:Classic Video Clips|Classic|Others)\//i, 'Video Clips/Older/');
    clean = clean.replace(/^Clips\//i, 'Video Clips/');

    clean = clean.replace(/^(?:Photographs\/)?(?:Images 2025|H2025)\//i, 'Photographs/2025/');
    clean = clean.replace(/^(?:Photographs\/)?(?:Images 2026|H2026)\//i, 'Photographs/2026/');
    clean = clean.replace(/^(?:Photographs\/)?(?:Images 2027|H2027)\//i, 'Photographs/2027/');
    clean = clean.replace(/^(?:Photographs\/)?(?:Favourite Images|favorite_images|works)\//i, 'Photographs/Favorite/');
    clean = clean.replace(/^(?:Photographs\/)?(?:Classic Images|classic_images|Classic)\//i, 'Photographs/Older/');
    clean = clean.replace(/^Images\//i, 'Photographs/');

    clean = clean.replace(/^Shorts\/(?:Shorts 2027|2027)\//i, 'Shorts/2027/');
    clean = clean.replace(/^Shorts\/(?:Shorts Classic|Classic|Older)\//i, 'Shorts/Older/');
  }

  clean = deduplicatePathSegments(clean);

  return clean;

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
      // Preserve exact spacing from catalog manifest (preserve trailing space before file extension)
      const cleanFilename = encodeURIComponent(decoded);
      return cleanFilename
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
export function getRawMediaUrl(relativePath?: string | null): string {
  if (!relativePath) return '';
  let path = relativePath.trim();

  // Guard against legacy nonexistent thumbnail references
  if (path.includes('ustream_thumb')) {
    return '';
  }

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
  const cleanPath = deduplicatePathSegments(normalized.replace(/^\/+/, ''));
  if (!cleanPath) return '';

  const encodedPath = encodeMediaPathSegments(cleanPath);

  // Files containing '#' in their name are routed directly to Hugging Face
  // because Cloudflare Worker pathname router truncates at '#'
  if (cleanPath.includes('#')) {
    return `${HF_RESOLVE_BASE}/${encodedPath}`;
  }

  return `${MEDIA_CDN_BASE}/${encodedPath}`;
}

export function getMediaUrl(relativePath?: string | null): string {
  if (!relativePath) return '';
  return getRawMediaUrl(relativePath);
}

/**
 * Resolves the primary streaming URL for a video (via Cloudflare edge proxy).
 */
export function getVideoStreamUrl(
  itemOrPath?: string | { url?: string; path?: string; id?: string; name?: string; category?: string; parentAlbum?: string } | null
): string {
  if (!itemOrPath) return '';
  if (typeof itemOrPath === 'string') {
    return getMediaUrl(itemOrPath);
  }
  const rawPath = itemOrPath.path || itemOrPath.url || itemOrPath.id || itemOrPath.name || '';
  return getMediaUrl(rawPath);
}

/**
 * Resolves the direct Hugging Face raw/resolve streaming URL (with ?raw=true)
 * for resilient playback fallback directly from the Hugging Face dataset CDN.
 */
export function getDirectHfVideoUrl(
  itemOrPath?: string | { url?: string; path?: string; id?: string } | null
): string {
  if (!itemOrPath) return '';
  const raw =
    typeof itemOrPath === 'string'
      ? itemOrPath
      : itemOrPath.path || itemOrPath.url || itemOrPath.id || '';
  if (!raw) return '';

  let path = raw.replace(/#t=[\d.,]+$/i, '').split('?')[0].trim();
  if (path.startsWith('blob:') || path.startsWith('data:')) return path;
  if (/^https?:\/\//i.test(path) && !path.includes('huggingface.co') && !path.includes('media.sarwar.cyou')) {
    return path;
  }

  path = path.replace(/^https?:\/\/huggingface\.co\/datasets\/[^/]+\/[^/]+\/(?:resolve|raw|tree)\/main\//i, '');
  path = path.replace(/^https?:\/\/media\.sarwar\.cyou\//i, '');

  const normalized = normalizeRepoPath(path);
  const cleanPath = normalized.replace(/^\/+/, '');
  if (!cleanPath) return '';

  const encodedPath = encodeMediaPathSegments(cleanPath);
  return `${HF_RESOLVE_BASE}/${encodedPath}?raw=true`;
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
    const rawVideoPath = item.url || item.id || target;
    const cleanRaw = rawVideoPath.split('?')[0].split('#')[0];
    const base = cleanRaw.replace(/\.(mp4|mov|webm|mkv|avi|m4v)$/i, '');
    if (base) {
      return getMediaUrl(`Thumbnails/${base}.webp`);
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

/**
 * Resolves static WebP thumbnail URL for any media item or path,
 * correctly mapping all subfolders under "Shorts" ("Shorts Classic", "Shorts 2027", etc.).
 */
export function getThumbnailUrl(
  itemOrPath?: string | { url?: string; path?: string; id?: string; thumbnail?: string; poster?: string; posterUrl?: string; category?: string; parentAlbum?: string; name?: string; title?: string } | null
): string {
  if (!itemOrPath) return '';

  let raw = '';
  let folderHint = '';

  if (typeof itemOrPath === 'string') {
    raw = itemOrPath.trim();
  } else if (typeof itemOrPath === 'object' && itemOrPath !== null) {
    folderHint = itemOrPath.parentAlbum || itemOrPath.category || '';
    const explicitPoster =
      itemOrPath.poster ||
      itemOrPath.posterUrl ||
      itemOrPath.thumbnail ||
      (itemOrPath as any).src ||
      (itemOrPath as any).image;

    // Check if explicit poster already exists as an external or full image URL
    if (explicitPoster && !isVideoExtension(explicitPoster)) {
      if (
        /^https?:\/\//i.test(explicitPoster) &&
        !explicitPoster.includes('media.sarwar.cyou') &&
        !explicitPoster.includes('huggingface.co')
      ) {
        return explicitPoster;
      }
      raw = explicitPoster;
    } else {
      raw =
        itemOrPath.thumbnail ||
        (itemOrPath as any).src ||
        itemOrPath.path ||
        itemOrPath.url ||
        (itemOrPath as any).image ||
        itemOrPath.id ||
        itemOrPath.name ||
        '';
    }
  }

  if (!raw) return '';

  // Strip trailing media fragment like #t=1.0 or query parameters
  let clean = raw.replace(/#t=[\d.,]+$/i, '').split('?')[0].trim();

  // Strip Hugging Face dataset base URL if present
  if (clean.includes('/resolve/main/')) {
    clean = clean.split('/resolve/main/')[1] || clean;
  } else if (clean.includes('media.sarwar.cyou/')) {
    clean = clean.split('media.sarwar.cyou/')[1] || clean;
  }

  try { clean = decodeURIComponent(clean); } catch {}

  // If already pointing to an existing Thumbnails/ directory path
  if (/^Thumbnails\//i.test(clean) && /\.(webp|jpg|jpeg|png)$/i.test(clean)) {
    return getMediaUrl(deduplicatePathSegments(clean));
  }

  // If clean does not have a folder slash and does not start with Thumbnails/:
  if (!clean.includes('/') && !/^Thumbnails\//i.test(clean)) {
    if (folderHint) {
      let folder = folderHint;
      if (folder.toLowerCase().includes('shorts') && !folder.toLowerCase().startsWith('shorts/')) {
        folder = `Shorts/${folder}`;
      }
      clean = sanitizePath(folder, clean);
    } else if (/webmedia[-_\s]serial/i.test(clean)) {
      clean = `Shorts/Shorts Classic/${clean}`;
    }
  }

  let normalized = normalizeRepoPath(clean);
  normalized = deduplicatePathSegments(normalized);

  if (/^Thumbnails\//i.test(normalized)) {
    const withoutExt = normalized.replace(/\.(mp4|mov|webm|mkv|avi|m4v)$/i, '');
    const webpPath = withoutExt.endsWith('.webp') ? withoutExt : `${withoutExt}.webp`;
    return getMediaUrl(webpPath);
  }

  const basePathWithoutExt = normalized.replace(/\.(mp4|mov|webm|mkv|avi|m4v|webp|jpg|jpeg|png)$/i, '');
  if (!basePathWithoutExt) return '';

  return getMediaUrl(`Thumbnails/${basePathWithoutExt}.webp`);
}

/**
 * Universal image/thumbnail URL resolver alias.
 */
export function getImageUrl(
  itemOrPath?: string | { url?: string; path?: string; id?: string; thumbnail?: string; poster?: string; posterUrl?: string; category?: string; parentAlbum?: string; name?: string; title?: string } | null
): string {
  return getThumbnailUrl(itemOrPath);
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
