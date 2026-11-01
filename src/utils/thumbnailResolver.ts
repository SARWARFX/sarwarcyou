import type { StageMediaItem, HfMediaItem } from '../types';
import {
  normalizeRepoPath,
  getMediaUrl,
  getThumbnailUrl,
  getImageUrl,
  HF_RESOLVE_BASE,
  sanitizePath,
  deduplicatePathSegments,
} from './imageUrlResolver';
import { isVideoExtension } from './mediaTypeDetector';
import {
  preloadImageFrames,
  useThumbnailScrubber,
  type UseThumbnailScrubberOptions,
  type UseThumbnailScrubberResult,
} from '../hooks/useThumbnailScrubber';

export {
  preloadImageFrames,
  useThumbnailScrubber,
  useThumbnailScrubber as useHoverThumbnailScrub,
  getThumbnailUrl,
  getImageUrl,
  sanitizePath,
  deduplicatePathSegments,
  type UseThumbnailScrubberOptions,
  type UseThumbnailScrubberResult,
};

/**
 * Extract clean relative path within the Hugging Face dataset from any URL or path.
 * e.g., "https://huggingface.co/.../Clips/Favorite/video.mp4" -> "Video Clips/Favorite/video.mp4"
 */
export function extractHfRelativePath(urlOrPath: string): string {
  if (!urlOrPath) return '';
  let clean = urlOrPath.trim();

  // Remove query parameters or hash (#t=0.5)
  clean = clean.split('?')[0].split('#')[0];

  // If full Hugging Face resolve URL or media edge proxy URL:
  if (clean.includes('/resolve/main/')) {
    clean = clean.split('/resolve/main/')[1] || clean;
  } else if (clean.includes('media.sarwar.cyou/')) {
    clean = clean.split('media.sarwar.cyou/')[1] || clean;
  } else if (clean.startsWith('http://') || clean.startsWith('https://')) {
    try {
      const parsed = new URL(clean);
      if (parsed.hostname === 'media.sarwar.cyou') {
        clean = parsed.pathname.replace(/^\/+/, '');
      } else {
        const parts = parsed.pathname.split('/resolve/main/');
        if (parts[1]) {
          clean = parts[1];
        }
      }
    } catch {
      // ignore parse error
    }
  }

  // Decode URI encoding e.g. %20 -> space
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // leave as is
  }

  const rawClean = clean.replace(/^\/+/, '');
  return normalizeRepoPath(rawClean);
}

export interface VideoPathInfo {
  relPath: string;
  parentDir: string;
  fileName: string;
  stem: string;
}

/**
 * Parses video path info with robust handling of decoded/encoded characters.
 */
export function parseVideoPathInfo(urlOrPath: string): VideoPathInfo | null {
  const relPath = extractHfRelativePath(urlOrPath);
  if (!relPath || relPath.startsWith('.thumbnails/') || relPath.startsWith('thumbnails/')) return null;

  const lastSlash = relPath.lastIndexOf('/');
  const parentDir = lastSlash > 0 ? relPath.substring(0, lastSlash) : '';
  const fileName = lastSlash >= 0 ? relPath.substring(lastSlash + 1) : relPath;
  const stem = fileName.replace(/\.[^/.]+$/, '');

  return { relPath, parentDir, fileName, stem };
}

// In-memory manifest cache fetched directly from the Hugging Face dataset storage / CDN
let hfManifestMap: Record<string, string> = {};
let hfNormalizedMap: Record<string, string> = {};
let isManifestFetching = false;

function populateManifestIndex(data: Record<string, string>) {
  hfManifestMap = data;
  hfNormalizedMap = {};
  for (const [key, val] of Object.entries(data)) {
    if (typeof val !== 'string') continue;
    const cleanKey = key.replace(/\\/g, '/');
    const fileName = cleanKey.split('/').pop() || '';
    const stem = fileName.replace(/\.[^/.]+$/, '');
    const normStem = stem.toLowerCase().replace(/[-_\s.]/g, '');

    hfNormalizedMap[cleanKey.toLowerCase()] = val;
    if (fileName) {
      hfNormalizedMap[fileName.toLowerCase()] = val;
      const fileStem = fileName.replace(/\.[^/.]+$/, '');
      hfNormalizedMap[fileStem.toLowerCase()] = val;
    }
    if (normStem) {
      hfNormalizedMap[normStem] = val;
    }
  }
}

/**
 * Loads the unified thumbnails mapping manifest from the Hugging Face dataset.
 */
export function loadHfThumbnailManifest(): Promise<Record<string, string>> {
  if (Object.keys(hfManifestMap).length > 0) {
    return Promise.resolve(hfManifestMap);
  }
  if (typeof window === 'undefined' || !window.fetch) {
    return Promise.resolve({});
  }
  if (isManifestFetching) {
    return Promise.resolve(hfManifestMap);
  }
  isManifestFetching = true;

  // 1. Try Hugging Face CDN edge proxy
  const cdnUrl = getMediaUrl('thumbnails.json');
  return fetch(cdnUrl)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data && typeof data === 'object') {
        populateManifestIndex(data);
      }
      isManifestFetching = false;
      return hfManifestMap;
    })
    .catch(() => {
      // 2. Direct fallback to Hugging Face dataset resolve endpoint
      return fetch(`${HF_RESOLVE_BASE}/thumbnails.json`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data === 'object') {
            populateManifestIndex(data);
          }
          isManifestFetching = false;
          return hfManifestMap;
        })
        .catch(() => {
          isManifestFetching = false;
          return {};
        });
    });
}

// Background sync in browser environments
if (typeof window !== 'undefined') {
  setTimeout(() => {
    loadHfThumbnailManifest();
  }, 100);
}

/**
 * Resolves the single pre-generated high-quality 30% WebP static thumbnail URL
 * from the Hugging Face Dataset storage (via CDN or raw resolve endpoint).
 */
export function resolveStaticVideoThumbnail(
  itemOrPath?: string | StageMediaItem | HfMediaItem | { url?: string; path?: string; poster?: string; posterUrl?: string; thumbnail?: string; thumbnails?: string[]; type?: string; category?: string; parentAlbum?: string } | null
): string {
  if (!itemOrPath) return '';

  let folderHint = '';

  // 1. Check if item object already has an explicit non-video poster or thumbnail
  if (typeof itemOrPath === 'object' && itemOrPath !== null) {
    const itemObj = itemOrPath as { posterUrl?: string; poster?: string; thumbnail?: string; thumbnails?: string[]; category?: string; parentAlbum?: string };
    folderHint = itemObj.parentAlbum || itemObj.category || '';
    const poster = itemObj.posterUrl || itemObj.poster || itemObj.thumbnails?.[0];
    if (poster && !isVideoExtension(poster)) {
      if (/^https?:\/\//i.test(poster) && !poster.includes('media.sarwar.cyou') && !poster.includes('huggingface.co')) {
        return poster;
      }
      if (/^(?:Thumbnails|Photographs|Images)\//i.test(poster)) {
        return getMediaUrl(poster);
      }
    }
  }

  // 2. Extract clean relative path within Hugging Face dataset
  const raw = typeof itemOrPath === 'string'
    ? itemOrPath
    : (('path' in itemOrPath && typeof itemOrPath.path === 'string') ? itemOrPath.path : (itemOrPath.url || ''));

  if (!raw) return '';

  // 3. If raw path is already pointing directly to a thumbnail file in the dataset under Thumbnails/
  if (/^Thumbnails\//i.test(raw)) {
    return getMediaUrl(deduplicatePathSegments(raw));
  }

  const relPath = extractHfRelativePath(raw);
  const fileName = (relPath || raw).split('/').pop() || '';
  const stem = fileName.replace(/\.[^/.]+$/, '');
  const normStem = stem.toLowerCase().replace(/[-_\s.]/g, '');

  // 4. Hugging Face dataset manifest lookup (exact path, raw, filename, or normalized slug)
  if (relPath && hfManifestMap[relPath]) return getMediaUrl(hfManifestMap[relPath]);
  if (hfManifestMap[raw]) return getMediaUrl(hfManifestMap[raw]);
  if (fileName && hfManifestMap[fileName]) return getMediaUrl(hfManifestMap[fileName]);
  if (hfNormalizedMap[stem.toLowerCase()]) return getMediaUrl(hfNormalizedMap[stem.toLowerCase()]);
  if (hfNormalizedMap[normStem]) return getMediaUrl(hfNormalizedMap[normStem]);

  // 5. Predictable canonical single-frame 30% WebP thumbnail in Hugging Face dataset:
  // Mirrors exact media folder hierarchy inside `Thumbnails/`:
  // e.g. "Video Clips/Favorite/webmedia-serial-1.mp4" -> "Thumbnails/Video Clips/Favorite/webmedia-serial-1.webp"
  // e.g. "Shorts/Shorts Classic/sample.mp4" -> "Thumbnails/Shorts/Shorts Classic/sample.webp"
  let basePath = relPath || raw;
  if (!basePath.includes('/') && !/^Thumbnails\//i.test(basePath)) {
    if (folderHint) {
      let folder = folderHint;
      if (folder.toLowerCase().includes('shorts') && !folder.toLowerCase().startsWith('shorts/')) {
        folder = `Shorts/${folder}`;
      }
      basePath = sanitizePath(folder, basePath);
    } else if (/webmedia[-_\s]serial/i.test(basePath)) {
      basePath = `Shorts/Shorts Classic/${basePath}`;
    }
  }

  basePath = normalizeRepoPath(basePath);
  basePath = deduplicatePathSegments(basePath);
  const basePathWithoutExtension = basePath.replace(/\.(mp4|mov|webm|mkv|m4v|avi|flv|webp|jpg|jpeg|png)$/i, '');
  if (!basePathWithoutExtension) return '';

  return getMediaUrl(`Thumbnails/${basePathWithoutExtension}.webp`);
}

/**
 * Returns single pre-generated 30% WebP thumbnail URL as an array.
 */
export function getAnticipatedThumbnailUrls(urlOrPath?: string): string[] {
  if (!urlOrPath) return [];
  const thumb = resolveStaticVideoThumbnail(urlOrPath);
  return thumb ? [thumb] : [];
}

/**
 * Returns single pre-generated 30% WebP thumbnail URL as an array.
 */
export function getVideoThumbnails(
  itemOrPath?: string | StageMediaItem | HfMediaItem | { url?: string; path?: string; thumbnails?: string[]; type?: string }
): string[] {
  if (!itemOrPath) return [];
  const thumb = resolveStaticVideoThumbnail(itemOrPath);
  return thumb ? [thumb] : [];
}

export function getAnticipatedThumbnailUrlsWithExt(urlOrPath?: string): string[] {
  return getAnticipatedThumbnailUrls(urlOrPath);
}

export function resolveMultiFrameThumbnails(
  item?: StageMediaItem | HfMediaItem | { url?: string; path?: string; thumbnails?: string[]; type?: string }
): string[] {
  if (!item) return [];
  const thumb = resolveStaticVideoThumbnail(item);
  return thumb ? [thumb] : [];
}

export function resolveMultiFrameThumbnailsExt(
  item?: StageMediaItem | HfMediaItem | { url?: string; path?: string; thumbnails?: string[]; type?: string }
): string[] {
  return resolveMultiFrameThumbnails(item);
}
