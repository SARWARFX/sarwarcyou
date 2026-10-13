import useSWR from 'swr';
import type { HfMediaCatalog, HfMediaItem } from './types';
import { FALLBACK_HF_CATALOG } from './data/fallbackData';
import { ensureHttps } from './utils/imageUrlResolver';

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
}

interface CachedCatalogEnvelope {
  timestamp: number;
  catalog: HfMediaCatalog;
}

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|mkv)$/i;
const MEDIA_EXTENSIONS = /\.(mp4|webm|mov|mkv|jpg|jpeg|png|webp|gif|svg|bmp|tiff|heic|avif)$/i;

/**
 * Builds a safe, encoded CDN streaming URL for any file path on the Hugging Face dataset.
 */
export function buildHfMediaUrl(filePath: string): string {
  if (!filePath) return '';
  // If filePath already looks like a complete http/https URL, ensure HTTPS and encode
  if (/^https?:\/\//i.test(filePath)) {
    return encodeURI(ensureHttps(filePath));
  }
  // Standardize leading slash
  const cleanPath = filePath.replace(/^\/+/, '');
  return encodeURI(`${HF_RESOLVE_BASE_URL}${cleanPath}`);
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
 * Parses raw items from the Hugging Face Tree API into a structured HfMediaCatalog.
 */
export function parseTreeToCatalog(tree: HfTreeItem[]): HfMediaCatalog {
  const clips: HfMediaItem[] = [];
  const shorts: HfMediaItem[] = [];
  const images: HfMediaItem[] = [];

  for (const item of tree) {
    if (item.type !== 'file' || !item.path) continue;
    const path = item.path;
    const name = path.split('/').pop() || path;
    const url = buildHfMediaUrl(path);

    if (path.startsWith('Clips/') && VIDEO_EXTENSIONS.test(path)) {
      clips.push({ name, path, url });
    } else if (path.startsWith('Shorts/') && VIDEO_EXTENSIONS.test(path)) {
      shorts.push({ name, path, url });
    } else if (path.startsWith('Images/') && MEDIA_EXTENSIONS.test(path)) {
      images.push({ name, path, url });
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
 * Multi-tier catalog resolver:
 * 1. sessionStorage cache (< 60s)
 * 2. Live Hugging Face Dataset Tree API
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

  // 2. Live Discovery via HF Tree API
  try {
    const treeRes = await fetchWithTimeout(HF_TREE_API_URL, 8000);
    if (treeRes.ok) {
      const items: HfTreeItem[] = await treeRes.json();
      if (Array.isArray(items) && items.length > 0) {
        const parsed = parseTreeToCatalog(items);
        if (parsed.images.length > 0 || parsed.clips.length > 0) {
          setCachedCatalog(parsed);
          return parsed;
        }
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
          clips: (rawData.clips || []).map((x: HfMediaItem) => ({
            ...x,
            url: buildHfMediaUrl(x.path || x.name),
          })),
          shorts: (rawData.shorts || []).map((x: HfMediaItem) => ({
            ...x,
            url: buildHfMediaUrl(x.path || x.name),
          })),
          images: (rawData.images || []).map((x: HfMediaItem) => ({
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
