import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { useState, useEffect } from 'react';
import type { StageMediaItem } from '../types';
import { isPhotoExtension } from '../utils/mediaTypeDetector';
import { getRawMediaUrl } from '../utils/imageUrlResolver';

export const PHOTO_SYNC_STORAGE_KEY = 'vault_photos_synced_v1';
export const PHOTO_SYNC_EVENT_KEY = 'streamvault_photo_sync_update';
const CONCURRENT_DOWNLOADS = 5;

export interface PhotoSyncState {
  isSyncing: boolean;
  progress: number; // 0 - 100%
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
  error?: string | null;
}

// In-memory lookup map: sanitized filename/identifier -> converted local file URL
const cachedPhotosMap = new Map<string, string>();
let isCacheInitialized = false;
let isSyncInProgress = false;

let currentSyncState: PhotoSyncState = {
  isSyncing: false,
  progress: 0,
  completedCount: 0,
  totalCount: 0,
  isComplete: false,
  error: null,
};

function emitSyncState() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<PhotoSyncState>(PHOTO_SYNC_EVENT_KEY, {
        detail: { ...currentSyncState },
      })
    );
  }
}

export function getSyncState(): PhotoSyncState {
  return { ...currentSyncState };
}

export function isPhotoCatalogSynced(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(PHOTO_SYNC_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export type PhotoLookupTarget =
  | StageMediaItem
  | Partial<StageMediaItem>
  | { url?: string; path?: string; id?: string; name?: string; title?: string; category?: string; parentAlbum?: string }
  | string
  | null
  | undefined;

/**
 * Deterministically generates a sanitized filename for a photo item or URL.
 * Matches: photos/{folder}_{filename}
 */
export function getPhotoLocalFilename(itemOrPath: PhotoLookupTarget): string {
  if (!itemOrPath) return '';
  let raw = '';
  if (typeof itemOrPath === 'string') {
    raw = itemOrPath;
  } else {
    const folder = itemOrPath.parentAlbum || itemOrPath.category || '';
    const file =
      itemOrPath.name ||
      itemOrPath.title ||
      (itemOrPath.path ? itemOrPath.path.split('/').pop() : '') ||
      (itemOrPath.url ? itemOrPath.url.split('/').pop() : '') ||
      'photo.jpg';
    raw = folder ? `${folder}_${file}` : file;
  }
  const clean = raw.replace(/^https?:\/\/[^/]+\//i, '').split('?')[0].split('#')[0];
  const sanitized = clean.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  return sanitized;
}

export function registerCachedPhoto(
  itemOrPath: PhotoLookupTarget,
  filename: string,
  convertedUri: string
) {
  cachedPhotosMap.set(filename, convertedUri);
  if (itemOrPath && typeof itemOrPath !== 'string') {
    const key1 = getPhotoLocalFilename(itemOrPath);
    if (key1) cachedPhotosMap.set(key1, convertedUri);
    if (itemOrPath.url) {
      const key2 = getPhotoLocalFilename(itemOrPath.url);
      if (key2) cachedPhotosMap.set(key2, convertedUri);
    }
    if (itemOrPath.path) {
      const key3 = getPhotoLocalFilename(itemOrPath.path);
      if (key3) cachedPhotosMap.set(key3, convertedUri);
    }
  } else if (itemOrPath && typeof itemOrPath === 'string') {
    const key = getPhotoLocalFilename(itemOrPath);
    if (key) cachedPhotosMap.set(key, convertedUri);
  }
}

/**
 * Returns the converted local file URL if cached on disk, otherwise null.
 */
export function getLocalCachedPhotoUrl(itemOrPath?: PhotoLookupTarget): string | null {
  if (!itemOrPath) return null;
  if (!Capacitor.isNativePlatform()) return null;

  const filename = getPhotoLocalFilename(itemOrPath);
  if (filename && cachedPhotosMap.has(filename)) {
    return cachedPhotosMap.get(filename)!;
  }
  return null;
}

/**
 * Populates in-memory cache map from files already existing in Directory.Data/photos/
 */
export async function initializePhotoCache(): Promise<void> {
  if (isCacheInitialized) return;
  isCacheInitialized = true;

  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // Ensure Directory.Data/photos exists
    try {
      await Filesystem.mkdir({
        path: 'photos',
        directory: Directory.Data,
        recursive: true,
      });
    } catch (_) {}

    const dirUriRes = await Filesystem.getUri({
      path: 'photos',
      directory: Directory.Data,
    });
    const baseUri = dirUriRes.uri.replace(/\/+$/, '');

    const readdirRes = await Filesystem.readdir({
      path: 'photos',
      directory: Directory.Data,
    });

    if (readdirRes && Array.isArray(readdirRes.files)) {
      for (const f of readdirRes.files) {
        const name = typeof f === 'string' ? f : (f as any)?.name;
        if (name && typeof name === 'string' && isPhotoExtension(name)) {
          const fileUri = `${baseUri}/${name}`;
          const converted = Capacitor.convertFileSrc(fileUri);
          cachedPhotosMap.set(name, converted);
        }
      }
    }

    if (isPhotoCatalogSynced()) {
      currentSyncState = {
        isSyncing: false,
        progress: 100,
        completedCount: cachedPhotosMap.size,
        totalCount: cachedPhotosMap.size,
        isComplete: true,
        error: null,
      };
      emitSyncState();
    }
  } catch (err) {
    console.warn('[PhotoSync] Cache initialization notice:', err);
  }
}

/**
 * Concurrency worker queue running tasks with a fixed pool size (5 concurrent).
 */
async function runWithPool<T>(tasks: (() => Promise<T>)[], poolSize = CONCURRENT_DOWNLOADS): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(poolSize, tasks.length) }, async () => {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++;
      try {
        await tasks[idx]();
      } catch (err) {
        console.warn(`[PhotoSync] Worker task ${idx} failed:`, err);
      }
    }
  });
  await Promise.all(workers);
}

/**
 * Begins automatic background caching of all photos from the media catalog manifest.
 */
export async function startBackgroundPhotoSync(items: StageMediaItem[]): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (isSyncInProgress) return;

  await initializePhotoCache();

  // Extract all photo items from the catalog
  const photoItems = items.filter((it) => {
    if (!it) return false;
    const isShort =
      it.mediaType === 'short' ||
      it.category?.toLowerCase().includes('short') ||
      it.url?.toLowerCase().includes('/shorts/');
    const isVid =
      !isShort &&
      (it.type === 'video' ||
        it.mediaType === 'clip' ||
        (it.url && !isPhotoExtension(it.url)));
    const isPhoto =
      !isShort &&
      !isVid &&
      (it.type === 'image' ||
        it.mediaType === 'photo' ||
        isPhotoExtension(it.url || it.path || it.name || ''));
    return isPhoto;
  });

  if (photoItems.length === 0) return;

  const totalCount = photoItems.length;

  // If already marked as synced and local cache contains all photos, skip
  if (isPhotoCatalogSynced() && cachedPhotosMap.size >= totalCount) {
    return;
  }

  isSyncInProgress = true;
  let completedCount = 0;

  currentSyncState = {
    isSyncing: true,
    progress: 0,
    completedCount: 0,
    totalCount,
    isComplete: false,
    error: null,
  };
  emitSyncState();

  const tasks = photoItems.map((item) => async () => {
    const filename = getPhotoLocalFilename(item);
    if (!filename) {
      completedCount++;
      return;
    }

    try {
      // 1. Check if already in memory
      if (cachedPhotosMap.has(filename)) {
        completedCount++;
        currentSyncState.completedCount = completedCount;
        currentSyncState.progress = Math.round((completedCount / totalCount) * 100);
        emitSyncState();
        return;
      }

      // 2. Check if already exists on disk (stat) to avoid re-downloading
      try {
        const statRes = await Filesystem.stat({
          path: `photos/${filename}`,
          directory: Directory.Data,
        });
        if (statRes && statRes.uri) {
          const converted = Capacitor.convertFileSrc(statRes.uri);
          registerCachedPhoto(item, filename, converted);
          completedCount++;
          currentSyncState.completedCount = completedCount;
          currentSyncState.progress = Math.round((completedCount / totalCount) * 100);
          emitSyncState();
          return;
        }
      } catch (_) {
        // Not on disk yet, proceed to download
      }

      // 3. Resolve remote CDN URL and download to Directory.Data/photos/
      const remoteUrl = getRawMediaUrl(item.url || item.path) || item.url;
      if (!remoteUrl || !remoteUrl.startsWith('http')) {
        completedCount++;
        return;
      }

      await Filesystem.downloadFile({
        url: remoteUrl,
        path: `photos/${filename}`,
        directory: Directory.Data,
        recursive: true,
      });

      const uriRes = await Filesystem.getUri({
        path: `photos/${filename}`,
        directory: Directory.Data,
      });

      if (uriRes && uriRes.uri) {
        const converted = Capacitor.convertFileSrc(uriRes.uri);
        registerCachedPhoto(item, filename, converted);
      }
    } catch (err) {
      // Fail gracefully on individual file error / network interruption
      console.warn(`[PhotoSync] Resilient skip for ${filename}:`, err);
    } finally {
      completedCount++;
      currentSyncState.completedCount = completedCount;
      currentSyncState.progress = Math.round((completedCount / totalCount) * 100);
      emitSyncState();
    }
  });

  // Run with concurrency pool: 5
  await runWithPool(tasks, CONCURRENT_DOWNLOADS);

  isSyncInProgress = false;

  // If all photos processed, mark complete
  if (completedCount >= totalCount) {
    try {
      localStorage.setItem(PHOTO_SYNC_STORAGE_KEY, 'true');
    } catch (_) {}
  }

  currentSyncState = {
    isSyncing: false,
    progress: 100,
    completedCount: totalCount,
    totalCount,
    isComplete: true,
    error: null,
  };
  emitSyncState();
}

/**
 * Hook to reactively subscribe to background photo sync progress.
 */
export function usePhotoSyncStatus(): PhotoSyncState {
  const [state, setState] = useState<PhotoSyncState>(getSyncState());

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<PhotoSyncState>;
      setState(custom.detail || getSyncState());
    };

    window.addEventListener(PHOTO_SYNC_EVENT_KEY, handler);
    return () => window.removeEventListener(PHOTO_SYNC_EVENT_KEY, handler);
  }, []);

  return state;
}

