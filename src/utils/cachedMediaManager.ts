import type { StageMediaItem } from '../types';
import { getMediaUrl } from './imageUrlResolver';

export interface CachedMediaRecord {
  id: string;
  item: StageMediaItem;
  cachedAt: number;
  expiresAt: number; // 7 days rolling TTL
  fileSizeBytes: number;
  fileSizeFormatted: string;
}

const STORAGE_KEY = 'sarwar_cached_media_vault_v1';
const CLEARED_FLAG_KEY = 'sarwar_cache_cleared';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Returns all non-expired cached media records from local storage.
 * Automatically evicts records older than 7 days.
 */
export function getCachedMediaRecords(): CachedMediaRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: CachedMediaRecord[] = JSON.parse(raw);
    if (!Array.isArray(list)) return [];

    const now = Date.now();
    const valid = list.filter((rec) => rec && rec.expiresAt > now && rec.item && (rec.item.id || rec.item.url));

    // If any items were expired, save the cleaned list back
    if (valid.length !== list.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    }
    return valid;
  } catch (err) {
    console.warn('Failed to parse cached media records:', err);
    return [];
  }
}

/**
 * Add an opened media item to the 7-day cache
 */
export function addCachedMediaItem(item: StageMediaItem, explicitBytes?: number): void {
  if (typeof window === 'undefined' || !item) return;
  const key = item.id || item.url || item.path || item.name;
  if (!key) return;

  try {
    // If cache was previously marked cleared, unflag it now that visitor cached a new item
    localStorage.removeItem(CLEARED_FLAG_KEY);

    const records = getCachedMediaRecords();
    const now = Date.now();
    const expiresAt = now + SEVEN_DAYS_MS;

    // Approximate size if not provided (photos: 2.5MB, shorts: 7.2MB, clips: 48MB)
    const isVid = item.type === 'video' || item.mediaType === 'clip' || (item.path || '').endsWith('.mp4');
    const isShort = item.mediaType === 'short' || (item.path || '').includes('short');
    const estimatedBytes = explicitBytes || (isShort ? 7.5 * 1024 * 1024 : isVid ? 45 * 1024 * 1024 : 2.4 * 1024 * 1024);

    const filtered = records.filter((r) => (r.item.id || r.item.url || r.item.path) !== key);
    const newRecord: CachedMediaRecord = {
      id: key,
      item,
      cachedAt: now,
      expiresAt,
      fileSizeBytes: estimatedBytes,
      fileSizeFormatted: formatBytes(estimatedBytes),
    };

    const nextList = [newRecord, ...filtered].slice(0, 500);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    window.dispatchEvent(new CustomEvent('cached-media-updated'));

    // Cache actual asset bytes in CacheStorage to prevent re-fetching from server
    if (typeof window !== 'undefined' && 'caches' in window) {
      const assetUrl = getMediaUrl(item.url || item.path || item.thumbnail || item.poster || '');
      if (assetUrl && assetUrl.startsWith('http')) {
        caches.open('sarwar-media-cache-v1').then((cache) => {
          fetch(assetUrl, { mode: 'cors', credentials: 'omit' })
            .then((res) => {
              if (res.ok) {
                cache.put(assetUrl, res);
              }
            })
            .catch(() => {});
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('Failed to save item to cached media vault:', err);
  }
}

/**
 * Check if a specific media item is cached locally
 */
export function isMediaCached(idOrUrl: string): boolean {
  if (!idOrUrl) return false;
  const records = getCachedMediaRecords();
  return records.some((r) => r.id === idOrUrl || r.item.id === idOrUrl || r.item.url === idOrUrl);
}

/**
 * Returns formatted total disk telemetry (e.g. "38.4 MB")
 */
export function getTotalCachedStorageSize(): string {
  const records = getCachedMediaRecords();
  const total = records.reduce((sum, r) => sum + (r.fileSizeBytes || 0), 0);
  return formatBytes(total);
}

/**
 * Completely purges all cached media and browser data for the website
 * so the browser has no data about the website unless cached again.
 */
export async function clearAllWebsiteData(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (err) {
    console.warn('Failed to clear CacheStorage:', err);
  }

  try {
    localStorage.clear();
    sessionStorage.clear();
    // Explicitly record that visitor purged cache
    localStorage.setItem(CLEARED_FLAG_KEY, 'true');
  } catch (err) {
    console.warn('Failed to clear storage:', err);
  }

  window.dispatchEvent(new CustomEvent('cached-media-updated'));
}

/**
 * Gets cached items for the featured strip, or seeds from catalog pool if visitor is new.
 */
export function getFeaturedCachedPool(allPool: StageMediaItem[]): StageMediaItem[] {
  if (typeof window !== 'undefined' && localStorage.getItem(CLEARED_FLAG_KEY) === 'true') {
    const records = getCachedMediaRecords();
    return records.map((r) => r.item);
  }

  const records = getCachedMediaRecords();
  if (records.length > 0) {
    return records.map((r) => r.item);
  }

  // Fallback initial batch for first-time visitors who haven't cleared cache
  if (!allPool || allPool.length === 0) return [];
  return allPool.slice(0, 16);
}
