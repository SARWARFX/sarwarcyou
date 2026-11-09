import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { useState, useEffect } from 'react';
import type { StageMediaItem } from '../types';
import { getRawMediaUrl } from '../utils/imageUrlResolver';

export const VIDEO_OFFLINE_STORAGE_KEY = 'vault_offline_videos_v1';
export const VIDEO_OFFLINE_EVENT_KEY = 'vault_offline_videos_changed';

// In-memory map: lookup key (url/id/filename) -> converted local file URL (Capacitor.convertFileSrc)
const cachedVideosMap = new Map<string, string>();
const activeDownloads = new Set<string>();
let isInitialized = false;

function emitUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VIDEO_OFFLINE_EVENT_KEY));
  }
}

export function sanitizeVideoFilename(itemOrPath: string | StageMediaItem): string {
  const rawPath = typeof itemOrPath === 'string' ? itemOrPath : itemOrPath.url || itemOrPath.path || itemOrPath.id || itemOrPath.name || '';
  const clean = rawPath.split('?')[0].split('#')[0];
  const parts = clean.split('/').filter(Boolean);
  const filename = parts.pop() || `video_${Date.now()}.mp4`;
  const folder = parts.pop() || 'media';
  return `${folder}_${filename}`.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getLookupKeys(itemOrUrl: string | StageMediaItem | null | undefined): string[] {
  if (!itemOrUrl) return [];
  const keys: string[] = [];
  if (typeof itemOrUrl === 'string') {
    keys.push(itemOrUrl);
    keys.push(sanitizeVideoFilename(itemOrUrl));
    const parts = itemOrUrl.split('?')[0].split('/');
    const last = parts[parts.length - 1];
    if (last) keys.push(last);
  } else {
    if (itemOrUrl.url) keys.push(itemOrUrl.url);
    if (itemOrUrl.id) keys.push(itemOrUrl.id);
    if (itemOrUrl.path) keys.push(itemOrUrl.path);
    if (itemOrUrl.name) keys.push(itemOrUrl.name);
    keys.push(sanitizeVideoFilename(itemOrUrl));
  }
  return keys;
}

export async function initializeVideoOfflineCache(): Promise<void> {
  if (!Capacitor.isNativePlatform() || isInitialized) return;
  try {
    // Ensure videos/ folder exists
    try {
      await Filesystem.mkdir({
        path: 'videos',
        directory: Directory.Data,
        recursive: true,
      });
    } catch (_) {}

    const res = await Filesystem.readdir({
      path: 'videos',
      directory: Directory.Data,
    });

    for (const file of res.files) {
      const filename = typeof file === 'string' ? file : file.name;
      try {
        const uriResult = await Filesystem.getUri({
          path: `videos/${filename}`,
          directory: Directory.Data,
        });
        const localSrc = Capacitor.convertFileSrc(uriResult.uri);
        cachedVideosMap.set(filename, localSrc);
        cachedVideosMap.set(`videos/${filename}`, localSrc);
      } catch (_) {}
    }
    isInitialized = true;
    emitUpdate();
  } catch (err) {
    console.warn('[VideoOfflineManager] Cache init error:', err);
  }
}

export function isMediaAvailableOffline(itemOrUrl: string | StageMediaItem | null | undefined): boolean {
  if (!itemOrUrl) return false;
  const keys = getLookupKeys(itemOrUrl);
  return keys.some((k) => cachedVideosMap.has(k));
}

export function getLocalCachedVideoUrl(itemOrUrl: string | StageMediaItem | null | undefined): string | null {
  if (!itemOrUrl) return null;
  const keys = getLookupKeys(itemOrUrl);
  for (const k of keys) {
    const cached = cachedVideosMap.get(k);
    if (cached) return cached;
  }
  return null;
}

export async function cacheVideoForOffline(item: StageMediaItem): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const rawUrl = item.url || item.path;
  if (!rawUrl) return false;

  const downloadUrl = getRawMediaUrl(rawUrl);
  if (!downloadUrl) return false;

  const filename = sanitizeVideoFilename(item);
  const targetPath = `videos/${filename}`;

  if (cachedVideosMap.has(filename) || activeDownloads.has(filename)) {
    return true;
  }

  activeDownloads.add(filename);

  try {
    // Check if already downloaded on disk
    try {
      const stat = await Filesystem.stat({
        path: targetPath,
        directory: Directory.Data,
      });
      if (stat && stat.size > 0) {
        const uriResult = await Filesystem.getUri({
          path: targetPath,
          directory: Directory.Data,
        });
        const localSrc = Capacitor.convertFileSrc(uriResult.uri);
        cachedVideosMap.set(filename, localSrc);
        getLookupKeys(item).forEach((k) => cachedVideosMap.set(k, localSrc));
        activeDownloads.delete(filename);
        emitUpdate();
        return true;
      }
    } catch (_) {
      // File not present, proceed to download
    }

    console.log(`[VideoOfflineManager] Auto-downloading video for offline use: ${filename}`);

    const downloadRes = await Filesystem.downloadFile({
      url: downloadUrl,
      path: targetPath,
      directory: Directory.Data,
      recursive: true,
    });

    if (downloadRes && downloadRes.path) {
      const uriResult = await Filesystem.getUri({
        path: targetPath,
        directory: Directory.Data,
      });
      const localSrc = Capacitor.convertFileSrc(uriResult.uri);
      cachedVideosMap.set(filename, localSrc);
      getLookupKeys(item).forEach((k) => cachedVideosMap.set(k, localSrc));
      emitUpdate();
      console.log(`[VideoOfflineManager] Successfully cached video offline: ${filename}`);
      return true;
    }
  } catch (err) {
    console.warn(`[VideoOfflineManager] Failed to cache video ${filename}:`, err);
  } finally {
    activeDownloads.delete(filename);
  }

  return false;
}

export function useOfflineStatus(itemOrUrl: string | StageMediaItem | null | undefined): boolean {
  const [isOffline, setIsOffline] = useState<boolean>(() => isMediaAvailableOffline(itemOrUrl));

  useEffect(() => {
    setIsOffline(isMediaAvailableOffline(itemOrUrl));
    const handleUpdate = () => {
      setIsOffline(isMediaAvailableOffline(itemOrUrl));
    };
    window.addEventListener(VIDEO_OFFLINE_EVENT_KEY, handleUpdate);
    return () => window.removeEventListener(VIDEO_OFFLINE_EVENT_KEY, handleUpdate);
  }, [itemOrUrl]);

  return isOffline;
}
