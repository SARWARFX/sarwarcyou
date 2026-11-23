import type { StageMediaItem } from '../types';
import { getMediaUrl, getVideoStreamUrl } from './imageUrlResolver';
import { isVideoExtension } from './mediaTypeDetector';

export interface CachedMediaRecord {
  id: string;
  item: StageMediaItem;
  cachedAt: number;
  lastViewedAt: number; // Used for LRU (Least Recently Used) automatic pruning
  fileSizeBytes: number;
  fileSizeFormatted: string;
}

export interface StorageQuotaInfo {
  quotaBytes: number;
  usageBytes: number;
  availableBytes: number;
  safeLimitBytes: number;
  percentUsed: number;
  isConstrainedDevice: boolean;
}

const STORAGE_KEY = 'sarwar_cached_media_vault_v1';
const CLEARED_FLAG_KEY = 'sarwar_cache_cleared';
const CACHE_NAME = 'sarwar-media-cache-v1';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Requests persistent storage from the browser so the operating system
 * will not arbitrarily purge the website's cached media during disk cleanup.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator.storage || !navigator.storage.persist) {
    return false;
  }
  try {
    const isPersisted = await navigator.storage.persisted();
    if (isPersisted) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/**
 * Dynamic Storage Quota Estimator:
 * - Accurately probes device storage limits (e.g. 1GB on iOS Safari vs 60% on PC/Android).
 * - Establishes safe headroom to prevent QuotaExceededError crashes.
 */
export async function getStorageQuotaInfo(): Promise<StorageQuotaInfo> {
  if (typeof window === 'undefined' || !navigator.storage || !navigator.storage.estimate) {
    const fallbackQuota = 1024 * 1024 * 1024; // 1 GB fallback
    return {
      quotaBytes: fallbackQuota,
      usageBytes: 0,
      availableBytes: fallbackQuota,
      safeLimitBytes: 850 * 1024 * 1024,
      percentUsed: 0,
      isConstrainedDevice: true,
    };
  }

  try {
    const { quota = 0, usage = 0 } = await navigator.storage.estimate();
    // Constrained devices: iOS Safari (~1GB origin ceiling) or low-tier Androids (< 1.5GB)
    const isConstrainedDevice = quota < 1.5 * 1024 * 1024 * 1024;
    
    // For constrained devices: up to 85% of quota or 850MB
    // For high-capacity desktop / modern phones: allow up to 60% of free storage or 10GB
    const safeLimitBytes = isConstrainedDevice
      ? Math.min(quota * 0.85, 850 * 1024 * 1024)
      : Math.min(quota * 0.60, 10 * 1024 * 1024 * 1024);

    return {
      quotaBytes: quota,
      usageBytes: usage,
      availableBytes: Math.max(0, quota - usage),
      safeLimitBytes,
      percentUsed: quota > 0 ? (usage / quota) * 100 : 0,
      isConstrainedDevice,
    };
  } catch {
    const fallbackQuota = 1024 * 1024 * 1024;
    return {
      quotaBytes: fallbackQuota,
      usageBytes: 0,
      availableBytes: fallbackQuota,
      safeLimitBytes: 850 * 1024 * 1024,
      percentUsed: 0,
      isConstrainedDevice: true,
    };
  }
}

/**
 * Returns all cached media records from local storage.
 * Records persist indefinitely on the visitor's device,
 * managed purely by device storage quota and LRU eviction.
 */
export function getCachedMediaRecords(): CachedMediaRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: CachedMediaRecord[] = JSON.parse(raw);
    if (!Array.isArray(list)) return [];

    const valid = list.filter(
      (rec) => rec && rec.item && (rec.item.id || rec.item.url || rec.item.path)
    );

    // If any corrupt items were removed, save the cleaned list back
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
 * LRU (Least Recently Used) Eviction Engine:
 * - Purges the oldest-viewed media items when device storage approaches its quota.
 * - Guaranteed to NEVER touch or delete graphs, telemetry, or analytics data.
 */
export async function evictOldestCachedItems(targetBytesToFree: number): Promise<void> {
  if (typeof window === 'undefined' || targetBytesToFree <= 0) return;

  const records = getCachedMediaRecords();
  if (records.length === 0) return;

  // Sort by lastViewedAt ascending (oldest viewed media evicted first)
  const sortedByLru = [...records].sort(
    (a, b) => (a.lastViewedAt || a.cachedAt || 0) - (b.lastViewedAt || b.cachedAt || 0)
  );

  let freedBytes = 0;
  const idsToRemove = new Set<string>();
  const urlsToRemove: string[] = [];

  for (const rec of sortedByLru) {
    if (freedBytes >= targetBytesToFree) break;
    idsToRemove.add(rec.id);
    freedBytes += rec.fileSizeBytes || 2.5 * 1024 * 1024;

    const assetUrl = getMediaUrl(rec.item.url || rec.item.path || rec.item.thumbnail || rec.item.poster || '');
    if (assetUrl) urlsToRemove.push(assetUrl);
    const videoUrl = getVideoStreamUrl(rec.item.url || rec.item.path || '');
    if (videoUrl && videoUrl !== assetUrl) urlsToRemove.push(videoUrl);
  }

  // Purge binary assets from CacheStorage
  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      for (const u of urlsToRemove) {
        await cache.delete(u).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('LRU CacheStorage purge error:', err);
  }

  // Update records in localStorage without touching telemetry or graphs
  const remaining = records.filter((r) => !idsToRemove.has(r.id));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
  } catch (err) {
    console.warn('Failed to update localStorage after LRU eviction:', err);
  }

  window.dispatchEvent(new CustomEvent('cached-media-updated'));
}

/**
 * Asynchronously caches media asset bytes (Photos, Shorts, Videos) into CacheStorage.
 * Handles background streaming and automatic LRU eviction on QuotaExceededError.
 */
async function cacheMediaBytesToStorage(item: StageMediaItem, estimatedBytes: number): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;

  try {
    // 1. Quota check: if usage is near safe limit, free room using LRU
    const quotaInfo = await getStorageQuotaInfo();
    if (quotaInfo.usageBytes + estimatedBytes > quotaInfo.safeLimitBytes) {
      const needToFree =
        quotaInfo.usageBytes + estimatedBytes - quotaInfo.safeLimitBytes + 35 * 1024 * 1024;
      await evictOldestCachedItems(needToFree);
    }

    const isShort =
      item.mediaType === 'short' ||
      (item.path || item.url || '').toLowerCase().includes('/shorts/');
    const isVid =
      !isShort &&
      (item.type === 'video' ||
        item.mediaType === 'clip' ||
        isVideoExtension(item.path || item.url || item.name || ''));

    const cache = await caches.open(CACHE_NAME);
    const urlsToCache: string[] = [];

    // Thumbnail / Poster
    const posterUrl = item.thumbnail || item.poster;
    if (posterUrl && posterUrl.startsWith('http')) {
      urlsToCache.push(posterUrl);
    }

    // Media stream / Full asset
    if (isVid || isShort) {
      const videoUrl = getVideoStreamUrl(item.url || item.path || '');
      if (videoUrl && videoUrl.startsWith('http')) {
        urlsToCache.push(videoUrl);
      }
    } else {
      const photoUrl = getMediaUrl(item.url || item.path || '');
      if (photoUrl && photoUrl.startsWith('http')) {
        urlsToCache.push(photoUrl);
      }
    }

    for (const url of urlsToCache) {
      const alreadyCached = await cache.match(url);
      if (alreadyCached) continue;

      try {
        const response = await fetch(url, {
          mode: 'cors',
          credentials: 'omit',
          headers: { Accept: '*/*' },
        });

        if (response.ok && (response.status === 200 || response.status === 204)) {
          await cache.put(url, response);
        }
      } catch (fetchErr: any) {
        // Handle QuotaExceededError automatically by evicting oldest items and retrying once
        if (
          fetchErr &&
          (fetchErr.name === 'QuotaExceededError' ||
            fetchErr.code === 22 ||
            fetchErr.message?.includes?.('quota'))
        ) {
          await evictOldestCachedItems(50 * 1024 * 1024);
          try {
            const retryRes = await fetch(url, { mode: 'cors', credentials: 'omit' });
            if (retryRes.ok) await cache.put(url, retryRes);
          } catch {
            // graceful fallback
          }
        }
      }
    }
  } catch (err) {
    console.warn('Failed background asset caching:', err);
  }
}

/**
 * Add an opened media item to the permanent client cache:
 * - Operates uniformly across both Wi-Fi and Cellular data (bandwidth is already spent).
 * - Caches images, short videos, and large video clips.
 * - Stored indefinitely on device; managed purely by device storage quota and LRU eviction.
 */
export function addCachedMediaItem(item: StageMediaItem, explicitBytes?: number): void {
  if (typeof window === 'undefined' || !item) return;
  const key = item.id || item.url || item.path || item.name;
  if (!key) return;

  try {
    localStorage.removeItem(CLEARED_FLAG_KEY);

    const records = getCachedMediaRecords();
    const now = Date.now();

    const isVid =
      item.type === 'video' ||
      item.mediaType === 'clip' ||
      (item.path || '').endsWith('.mp4');
    const isShort =
      item.mediaType === 'short' || (item.path || '').includes('short');
    const estimatedBytes =
      explicitBytes ||
      (isShort
        ? 7.5 * 1024 * 1024
        : isVid
        ? 45 * 1024 * 1024
        : 2.4 * 1024 * 1024);

    const filtered = records.filter(
      (r) => (r.item.id || r.item.url || r.item.path) !== key
    );

    const newRecord: CachedMediaRecord = {
      id: key,
      item,
      cachedAt: now,
      lastViewedAt: now,
      fileSizeBytes: estimatedBytes,
      fileSizeFormatted: formatBytes(estimatedBytes),
    };

    const nextList = [newRecord, ...filtered].slice(0, 500);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    window.dispatchEvent(new CustomEvent('cached-media-updated'));

    // Request persistent storage on interaction
    requestPersistentStorage().catch(() => {});

    // Cache actual bytes into CacheStorage with quota protection
    cacheMediaBytesToStorage(item, estimatedBytes);
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
  return records.some(
    (r) => r.id === idOrUrl || r.item.id === idOrUrl || r.item.url === idOrUrl
  );
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
 * Retrieves a locally cached asset blob URL for instant 0ms offline/cached playback.
 */
export async function getCachedAssetBlobUrl(url: string): Promise<string | null> {
  if (typeof window === 'undefined' || !('caches' in window) || !url) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const match = await cache.match(url);
    if (match) {
      const blob = await match.blob();
      return URL.createObjectURL(blob);
    }
  } catch {
    // fallback
  }
  return null;
}

export type CacheCategory = 'Photographs' | 'Shorts' | 'Video Clips' | 'All';

/**
 * Selectively clears cached media records.
 * NEVER deletes or modifies graphs, telemetry, or analytics data.
 */
export async function clearCachedMedia(category: CacheCategory = 'All'): Promise<void> {
  if (typeof window === 'undefined') return;

  const records = getCachedMediaRecords();
  const isMatch = (item: StageMediaItem) => {
    if (category === 'All') return true;
    const isShort =
      item.mediaType === 'short' ||
      (item.path || item.url || '').toLowerCase().includes('/shorts/');
    const isVid =
      !isShort &&
      (item.type === 'video' ||
        item.mediaType === 'clip' ||
        isVideoExtension(item.path || item.url || item.name || ''));

    if (category === 'Shorts') return isShort;
    if (category === 'Video Clips') return isVid;
    if (category === 'Photographs') return !isShort && !isVid;
    return true;
  };

  const toRemove = records.filter((r) => r.item && isMatch(r.item));
  const remaining = records.filter((r) => !r.item || !isMatch(r.item));

  // Purge specific asset bytes from CacheStorage
  try {
    if ('caches' in window) {
      if (category === 'All') {
        const keys = await caches.keys();
        await Promise.all(
          keys.filter((k) => k.includes('media-cache')).map((k) => caches.delete(k))
        );
      } else {
        const cache = await caches.open(CACHE_NAME);
        for (const rec of toRemove) {
          const assetUrl = getMediaUrl(
            rec.item.url || rec.item.path || rec.item.thumbnail || rec.item.poster || ''
          );
          if (assetUrl) {
            await cache.delete(assetUrl).catch(() => {});
          }
          const videoUrl = getVideoStreamUrl(rec.item.url || rec.item.path || '');
          if (videoUrl && videoUrl !== assetUrl) {
            await cache.delete(videoUrl).catch(() => {});
          }
        }
      }
    }
  } catch (err) {
    console.warn('Failed to clear CacheStorage:', err);
  }

  // Update localStorage without touching graphs, telemetry, or analytics!
  try {
    if (remaining.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(CLEARED_FLAG_KEY, 'true');
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
    }
  } catch (err) {
    console.warn('Failed to update localStorage:', err);
  }

  window.dispatchEvent(new CustomEvent('cached-media-updated'));
}

/**
 * Backward compatibility alias: clears all media caches while protecting graph data.
 */
export async function clearAllWebsiteData(): Promise<void> {
  await clearCachedMedia('All');
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
