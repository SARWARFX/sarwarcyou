import useSWR from 'swr';
import type { HfMediaCatalog, HfMediaItem } from './types';
import { FALLBACK_HF_CATALOG } from './data/fallbackData';

export const HF_DATASET_ID = 'SARWARFX/stream-vault';
export const HF_TREE_API_URL =
  'https://huggingface.co/api/datasets/SARWARFX/stream-vault/tree/main?recursive=true';
export const HF_RAW_MEDIA_JSON_URL =
  'https://huggingface.co/datasets/SARWARFX/stream-vault/resolve/main/media.json';
export const HF_RESOLVE_BASE_URL =
  'https://huggingface.co/datasets/SARWARFX/stream-vault/resolve/main/';

// Backwards-compatibility alias
export const HUGGINGFACE_CATALOG_URL = HF_RAW_MEDIA_JSON_URL;

export const CACHE_STORAGE_KEY = 'sarwarcyou_hf_catalog_cache';
export const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

export interface HfTreeItem {
  type: 'file' | 'directory';
  path: string;
  oid?: string;
  size?: number;
  lastCommit?: { date?: string; id?: string; title?: string };
}

interface CachedCatalogEnvelope {
  timestamp: number;
  catalog: HfMediaCatalog;
}

import {
  isVideoExtension,
  isPhotoExtension,
  isHiddenOrSystemPath,
  isExcludedAlbum,
  isThumbnailFile,
} from './utils/mediaTypeDetector';
import { MEDIA_CDN_BASE, getMediaUrl } from './utils/imageUrlResolver';

export { MEDIA_CDN_BASE, getMediaUrl };

export const VIDEO_EXTENSIONS = /\.(mp4|mov|mkv|webm|avi)(\?|#|$)/i;
export const PHOTO_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif|avif|bmp|tiff|heic|svg)(\?|#|$)/i;

/**
 * Builds a safe, encoded CDN streaming URL for any file path on the repository,
 * routing through the Cloudflare Worker edge proxy at https://media.sarwar.cyou.
 */
export function buildHfMediaUrl(filePath: string): string {
  if (!filePath) return '';
  return getMediaUrl(filePath);
}

/**
 * Reads valid catalog data from sessionStorage if not expired (< 60s).
 */
export function getCachedCatalog(): HfMediaCatalog | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return null;
    const envelope: CachedCatalogEnvelope = JSON.parse(raw);
    if (Date.now() - envelope.timestamp < CACHE_TTL_MS) {
      if (
        envelope.catalog &&
        Array.isArray(envelope.catalog.clips) &&
        Array.isArray(envelope.catalog.shorts) &&
        Array.isArray(envelope.catalog.images)
      ) {
        return envelope.catalog;
      }
    }
  } catch {
    // Ignore JSON parse or storage access exceptions
  }
  return null;
}

/**
 * Persists catalog to sessionStorage with current timestamp.
 */
export function setCachedCatalog(catalog: HfMediaCatalog): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const envelope: CachedCatalogEnvelope = {
      timestamp: Date.now(),
      catalog,
    };
    window.sessionStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Ignore storage quota or access errors
  }
}

/**
 * Helper to normalize directory keys for resilient lookup (supports decoded and raw).
 */
function normalizeKey(str: string): string {
  let res = str.replace(/^\/+/, '');
  try {
    res = decodeURIComponent(res);
  } catch {
    // leave as is
  }
  return res.toLowerCase().trim();
}

/**
 * Parses raw items from the Hugging Face Tree API into a structured HfMediaCatalog.
 */
export function parseTreeToCatalog(tree: HfTreeItem[]): HfMediaCatalog {
  const clips: HfMediaItem[] = [];
  const shorts: HfMediaItem[] = [];
  const images: HfMediaItem[] = [];

  // Index all pre-rendered thumbnails and posters
  const thumbnailsByFolder = new Map<string, string[]>();
  const directPosterByVideoKey = new Map<string, string>();

  for (const item of tree) {
    if (item.type !== 'file' || !item.path) continue;
    const lowerPath = item.path.toLowerCase();
    const isImageFile =
      lowerPath.endsWith('.jpg') ||
      lowerPath.endsWith('.jpeg') ||
      lowerPath.endsWith('.webp') ||
      lowerPath.endsWith('.png') ||
      lowerPath.endsWith('.avif');

    if (isImageFile && (isThumbnailFile(item.path) || item.path.startsWith('thumbnails/') || item.path.startsWith('.thumbnails/'))) {
      const url = buildHfMediaUrl(item.path);

      // 1. Directory-level mapping (thumbnails/{videoName}/thumb_{1..5}.jpg)
      const lastSlash = item.path.lastIndexOf('/');
      if (lastSlash > 0) {
        const folder = item.path.substring(0, lastSlash);
        const keysToRegister = new Set<string>([folder, normalizeKey(folder)]);
        for (const k of keysToRegister) {
          const list = thumbnailsByFolder.get(k) || [];
          list.push(url);
          thumbnailsByFolder.set(k, list);
        }
      }

      // 2. Direct video poster mapping (e.g. Clips/Favorite/video_thumb.jpg or temp_thumbnails/.../video_thumb.jpg)
      const cleanStem = item.path
        .replace(/^temp_thumbnails\//i, '')
        .replace(/^thumbnails\//i, '')
        .replace(/^\.thumbnails\//i, '')
        .replace(/[-_]thumb(?:nail)?\.[^/.]+$/i, '')
        .replace(/[-_]preview\.[^/.]+$/i, '');
      const stemKey = normalizeKey(cleanStem);
      if (stemKey && !directPosterByVideoKey.has(stemKey)) {
        directPosterByVideoKey.set(stemKey, url);
      }
      const filenameOnly = normalizeKey(cleanStem.split('/').pop() || cleanStem);
      if (filenameOnly && !directPosterByVideoKey.has(filenameOnly)) {
        directPosterByVideoKey.set(filenameOnly, url);
      }
    }
  }

  // Sort thumbnails within each folder to ensure thumb_1, thumb_2, thumb_3... order
  for (const [folder, list] of thumbnailsByFolder.entries()) {
    list.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    thumbnailsByFolder.set(folder, list);
  }

  // Helper to match thumbnail folder for a video path
  const getThumbnailsForVideo = (videoPath: string): string[] | undefined => {
    const lastSlash = videoPath.lastIndexOf('/');
    const parentDir = lastSlash > 0 ? videoPath.substring(0, lastSlash) : '';
    const fileName = lastSlash >= 0 ? videoPath.substring(lastSlash + 1) : videoPath;
    const stem = fileName.replace(/\.[^/.]+$/, '');

    // 1. Primary standard: thumbnails/{videoName} (thumbnails/<videoName>/<videoName>_thumb_<1..5>.jpg)
    const primaryFolder = `thumbnails/${stem}`;
    const primaryMatch =
      thumbnailsByFolder.get(primaryFolder) ||
      thumbnailsByFolder.get(normalizeKey(primaryFolder));
    if (primaryMatch && primaryMatch.length > 0) return primaryMatch;

    // 2. Nested subfolder standard: thumbnails/{parentDir}/{stem}
    if (parentDir) {
      const nestedFolder = `thumbnails/${parentDir}/${stem}`;
      const nestedMatch =
        thumbnailsByFolder.get(nestedFolder) ||
        thumbnailsByFolder.get(normalizeKey(nestedFolder));
      if (nestedMatch && nestedMatch.length > 0) return nestedMatch;
    }

    // 3. Fallbacks (.thumbnails/Clips/.../video)
    const stemFolder = parentDir ? `.thumbnails/${parentDir}/${stem}` : `.thumbnails/${stem}`;
    const stemMatch =
      thumbnailsByFolder.get(stemFolder) ||
      thumbnailsByFolder.get(normalizeKey(stemFolder));
    if (stemMatch && stemMatch.length > 0) return stemMatch;

    // 4. Extension-inclusive variant (.thumbnails/Clips/.../video.mp4)
    const extFolder = parentDir ? `.thumbnails/${parentDir}/${fileName}` : `.thumbnails/${fileName}`;
    const extMatch =
      thumbnailsByFolder.get(extFolder) ||
      thumbnailsByFolder.get(normalizeKey(extFolder));
    if (extMatch && extMatch.length > 0) return extMatch;

    return undefined;
  };

  // Helper to match direct poster for a video path
  const getDirectPosterForVideo = (videoPath: string): string | undefined => {
    const lastSlash = videoPath.lastIndexOf('/');
    const parentDir = lastSlash > 0 ? videoPath.substring(0, lastSlash) : '';
    const fileName = lastSlash >= 0 ? videoPath.substring(lastSlash + 1) : videoPath;
    const stem = fileName.replace(/\.[^/.]+$/, '');

    const fullKey = normalizeKey(parentDir ? `${parentDir}/${stem}` : stem);
    const stemKey = normalizeKey(stem);
    return directPosterByVideoKey.get(fullKey) || directPosterByVideoKey.get(stemKey);
  };

  for (const item of tree) {
    if (item.type !== 'file' || !item.path) continue;
    const path = item.path;

    // Strict exclusion: completely ignore any file inside excluded album patterns or thumbnail directories
    if (isHiddenOrSystemPath(path) || isExcludedAlbum(path) || isThumbnailFile(path)) continue;

    const name = path.split('/').pop() || path;
    const url = buildHfMediaUrl(path);
    const lastCommit = item.lastCommit;
    let itemDate: number | undefined;
    if (lastCommit?.date) {
      const parsed = new Date(lastCommit.date).getTime();
      if (!isNaN(parsed) && parsed > 0) itemDate = parsed;
    }
    if (!itemDate) {
      const match = path.match(/(202[4-9])[-_]?([0-1][0-9])[-_]?([0-3][0-9])/);
      if (match) {
        const parsed = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10)).getTime();
        if (!isNaN(parsed)) itemDate = parsed;
      }
    }

    if (isVideoExtension(path)) {
      const thumbnails = getThumbnailsForVideo(path);
      const directPoster = getDirectPosterForVideo(path);
      const allThumbnails = thumbnails && thumbnails.length > 0
        ? thumbnails
        : directPoster ? [directPoster] : undefined;
      const poster = directPoster || allThumbnails?.[0];

      if (path.startsWith('Shorts/')) {
        shorts.push({ name, path, url, poster, thumbnails: allThumbnails, lastCommit, date: itemDate });
      } else {
        clips.push({ name, path, url, poster, thumbnails: allThumbnails, lastCommit, date: itemDate });
      }
    } else if (isPhotoExtension(path)) {
      // NEVER include thumbnail files in images
      if (!isThumbnailFile(path) && !isExcludedAlbum(path)) {
        images.push({ name, path, url, lastCommit, date: itemDate });
      }
    }
  }

  return { clips, shorts, images };
}

/**
 * Timeout-wrapped fetch helper to prevent network hangs with strict 3-second timeout.
 */
export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 3000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Parses the RFC 5988 Link header for rel="next" pagination URL.
 */
function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/i);
  return match ? match[1] : null;
}

/**
 * Fetches tree items from Hugging Face Tree API with 3s timeout per page.
 */
export async function fetchAllTreeItems(): Promise<HfTreeItem[]> {
  const allItems: HfTreeItem[] = [];
  let currentUrl: string | null = HF_TREE_API_URL;
  let pages = 0;
  const MAX_PAGES = 3;

  while (currentUrl && pages < MAX_PAGES) {
    pages++;
    try {
      const res = await fetchWithTimeout(currentUrl, {}, 3000);
      if (!res.ok) break;

      const data = await res.json();
      if (Array.isArray(data)) {
        allItems.push(...data);
      }

      const linkHeader = res.headers.get('Link') || res.headers.get('link');
      currentUrl = parseNextLink(linkHeader);
    } catch {
      break;
    }
  }

  return allItems;
}

/**
 * Multi-tier non-blocking catalog resolver:
 * 1. sessionStorage cache (< 60s)
 * 2. Parallel fetch via Promise.allSettled() with strict 3s timeout (Tree API + raw media.json)
 * 3. Instant bundled fallback data (guaranteed zero hang)
 */
export async function fetchDynamicCatalog(forceBypassCache = false): Promise<HfMediaCatalog> {
  // 1. Session Cache
  if (!forceBypassCache) {
    const cached = getCachedCatalog();
    if (cached) {
      return cached;
    }
  }

  // 2. Parallel non-blocking discovery via Promise.allSettled() with strict 3000ms timeout
  try {
    const [treeResult, mediaJsonResult] = await Promise.allSettled([
      fetchWithTimeout(HF_TREE_API_URL, {}, 3000).then(async (res) => {
        if (!res.ok) throw new Error(`HF tree HTTP ${res.status}`);
        return (await res.json()) as HfTreeItem[];
      }),
      fetchWithTimeout(HF_RAW_MEDIA_JSON_URL, {}, 3000).then(async (res) => {
        if (!res.ok) throw new Error(`HF media.json HTTP ${res.status}`);
        return await res.json();
      }),
    ]);

    // Tier A: Tree API items if fulfilled
    if (treeResult.status === 'fulfilled' && Array.isArray(treeResult.value) && treeResult.value.length > 0) {
      const parsed = parseTreeToCatalog(treeResult.value);
      if (parsed.images.length > 0 || parsed.clips.length > 0) {
        setCachedCatalog(parsed);
        return parsed;
      }
    }

    // Tier B: Raw media.json if fulfilled
    if (mediaJsonResult.status === 'fulfilled' && mediaJsonResult.value) {
      const rawData = mediaJsonResult.value;
      if (Array.isArray(rawData.images) || Array.isArray(rawData.clips)) {
        const catalog: HfMediaCatalog = {
          clips: (rawData.clips || [])
            .filter((x: HfMediaItem) => !isHiddenOrSystemPath(x.path || x.name || x.url))
            .map((x: HfMediaItem) => ({
              ...x,
              url: buildHfMediaUrl(x.path || x.name),
            })),
          shorts: (rawData.shorts || [])
            .filter((x: HfMediaItem) => !isHiddenOrSystemPath(x.path || x.name || x.url))
            .map((x: HfMediaItem) => ({
              ...x,
              url: buildHfMediaUrl(x.path || x.name),
            })),
          images: (rawData.images || [])
            .filter(
              (x: HfMediaItem) =>
                !isHiddenOrSystemPath(x.path || x.name || x.url) &&
                !isThumbnailFile(x.path || x.name || x.url)
            )
            .map((x: HfMediaItem) => ({
              ...x,
              url: buildHfMediaUrl(x.path || x.name),
            })),
        };
        setCachedCatalog(catalog);
        return catalog;
      }
    }
  } catch (err) {
    console.warn('Parallel dynamic catalog fetch failed, using fallback data:', err);
  }

  // 3. Bundled Fallback (instant zero-delay)
  return getNormalizedFallbackCatalog();
}

const getNormalizedFallbackCatalog = (): HfMediaCatalog => ({
  clips: (FALLBACK_HF_CATALOG.clips || []).map((x) => ({
    ...x,
    url: getMediaUrl(x.url || x.path || x.name),
  })),
  shorts: (FALLBACK_HF_CATALOG.shorts || []).map((x) => ({
    ...x,
    url: getMediaUrl(x.url || x.path || x.name),
  })),
  images: (FALLBACK_HF_CATALOG.images || []).map((x) => ({
    ...x,
    url: getMediaUrl(x.url || x.path || x.name),
  })),
});

export const useMediaData = () => {
  const initialData =
    typeof window !== 'undefined'
      ? getCachedCatalog() || getNormalizedFallbackCatalog()
      : getNormalizedFallbackCatalog();

  const { data, error, isLoading, mutate } = useSWR<HfMediaCatalog>(
    'hf-dynamic-catalog',
    () => fetchDynamicCatalog(false),
    {
      fallbackData: initialData,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: CACHE_TTL_MS,
    }
  );

  const syncMedia = async (bypassCache = true) => {
    try {
      const refreshed = await fetchDynamicCatalog(bypassCache);
      await mutate(refreshed, false);
      return refreshed;
    } catch (err) {
      console.error('Error refreshing dynamic media catalog from Hugging Face CDN:', err);
    }
  };

  return {
    data: data || initialData,
    isLoading: isLoading && !data,
    isError: error,
    syncMedia,
  };
};
