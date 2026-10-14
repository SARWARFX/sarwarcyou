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
  safeEncodeHfPath,
  safeEncodeUrl,
  isHiddenOrSystemPath,
} from './utils/mediaTypeDetector';

export const VIDEO_EXTENSIONS = /\.(mp4|mov|mkv|webm|avi)(\?|#|$)/i;
export const PHOTO_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif|avif|bmp|tiff|heic|svg)(\?|#|$)/i;

/**
 * Builds a safe, encoded CDN streaming URL for any file path on the Hugging Face dataset.
 * Safely encodes path segments (brackets, parentheses, spaces, hashes) without double-encoding.
 */
export function buildHfMediaUrl(filePath: string): string {
  if (!filePath) return '';
  // If filePath already looks like a complete http/https URL, ensure safe encoding
  if (/^https?:\/\//i.test(filePath)) {
    return safeEncodeUrl(filePath);
  }
  // Standardize leading slash and encode each path segment individually
  const encodedSegments = safeEncodeHfPath(filePath);
  return `${HF_RESOLVE_BASE_URL}${encodedSegments}`;
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

  // Index all pre-rendered WebP thumbnails from .thumbnails/
  // Supports both stem (.thumbnails/folder/video/thumb_0.webp)
  // and extension (.thumbnails/folder/video.mp4/thumb_0.webp) directory formats.
  const thumbnailsByFolder = new Map<string, string[]>();

  for (const item of tree) {
    if (item.type !== 'file' || !item.path) continue;
    if (item.path.startsWith('.thumbnails/') && item.path.endsWith('.webp')) {
      const lastSlash = item.path.lastIndexOf('/');
      if (lastSlash > 0) {
        const folder = item.path.substring(0, lastSlash);
        const url = buildHfMediaUrl(item.path);

        const keysToRegister = new Set<string>([
          folder,
          normalizeKey(folder),
        ]);

        for (const k of keysToRegister) {
          const list = thumbnailsByFolder.get(k) || [];
          list.push(url);
          thumbnailsByFolder.set(k, list);
        }
      }
    }
  }

  // Sort thumbnails within each folder to ensure thumb_0, thumb_1, thumb_2... order
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

    // Try stem variant first (.thumbnails/Clips/.../video)
    const stemFolder = parentDir ? `.thumbnails/${parentDir}/${stem}` : `.thumbnails/${stem}`;
    const stemMatch =
      thumbnailsByFolder.get(stemFolder) ||
      thumbnailsByFolder.get(normalizeKey(stemFolder));
    if (stemMatch && stemMatch.length > 0) return stemMatch;

    // Try extension-inclusive variant (.thumbnails/Clips/.../video.mp4)
    const extFolder = parentDir ? `.thumbnails/${parentDir}/${fileName}` : `.thumbnails/${fileName}`;
    const extMatch =
      thumbnailsByFolder.get(extFolder) ||
      thumbnailsByFolder.get(normalizeKey(extFolder));
    if (extMatch && extMatch.length > 0) return extMatch;

    return undefined;
  };

  for (const item of tree) {
    if (item.type !== 'file' || !item.path) continue;
    const path = item.path;

    // Strict exclusion: completely ignore any file or path inside .thumbnails or dot-directories
    if (isHiddenOrSystemPath(path)) continue;

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
      if (path.startsWith('Shorts/')) {
        shorts.push({ name, path, url, thumbnails, lastCommit, date: itemDate });
      } else {
        clips.push({ name, path, url, thumbnails, lastCommit, date: itemDate });
      }
    } else if (isPhotoExtension(path)) {
      images.push({ name, path, url, lastCommit, date: itemDate });
    }
  }

  return { clips, shorts, images };
}

/**
 * Timeout-wrapped fetch helper to prevent network hangs.
 */
async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
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
 * Fetches all tree items from Hugging Face Tree API, automatically
 * traversing pagination pages via the Link: <...>; rel="next" header.
 */
export async function fetchAllTreeItems(): Promise<HfTreeItem[]> {
  const allItems: HfTreeItem[] = [];
  let currentUrl: string | null = HF_TREE_API_URL;
  let pages = 0;
  const MAX_PAGES = 10;

  while (currentUrl && pages < MAX_PAGES) {
    pages++;
    const res = await fetchWithTimeout(currentUrl, 8000);
    if (!res.ok) break;

    const data = await res.json();
    if (Array.isArray(data)) {
      allItems.push(...data);
    }

    const linkHeader = res.headers.get('Link') || res.headers.get('link');
    currentUrl = parseNextLink(linkHeader);
  }

  return allItems;
}

/**
 * Multi-tier catalog resolver:
 * 1. sessionStorage cache (< 60s)
 * 2. Live Hugging Face Dataset Tree API (paginated, resilient)
 * 3. Raw media.json from Hugging Face resolve endpoint
 * 4. Bundled fallback data
 */
export async function fetchDynamicCatalog(forceBypassCache = false): Promise<HfMediaCatalog> {
  // 1. Session Cache
  if (!forceBypassCache) {
    const cached = getCachedCatalog();
    if (cached) {
      return cached;
    }
  }

  // 2. Live Discovery via HF Tree API with pagination support
  try {
    const items = await fetchAllTreeItems();
    if (Array.isArray(items) && items.length > 0) {
      const parsed = parseTreeToCatalog(items);
      if (parsed.images.length > 0 || parsed.clips.length > 0) {
        setCachedCatalog(parsed);
        return parsed;
      }
    }
  } catch (err) {
    console.warn('HF Tree API live discovery failed, trying raw media.json fallback:', err);
  }

  // 3. Raw media.json Fallback
  try {
    const jsonRes = await fetchWithTimeout(HF_RAW_MEDIA_JSON_URL, 8000);
    if (jsonRes.ok) {
      const rawData = await jsonRes.json();
      if (rawData && Array.isArray(rawData.images) && Array.isArray(rawData.clips)) {
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
            .filter((x: HfMediaItem) => !isHiddenOrSystemPath(x.path || x.name || x.url))
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
    console.warn('HF raw media.json fallback failed, falling back to bundled data:', err);
  }

  // 4. Bundled Fallback
  return FALLBACK_HF_CATALOG;
}

export const useMediaData = () => {
  const initialData =
    typeof window !== 'undefined'
      ? getCachedCatalog() || FALLBACK_HF_CATALOG
      : FALLBACK_HF_CATALOG;

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
