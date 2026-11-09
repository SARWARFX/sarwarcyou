import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { useState, useEffect, useCallback } from 'react';
import { PHOTO_SYNC_EVENT_KEY } from './photoSyncManager';
import { VIDEO_OFFLINE_EVENT_KEY } from './videoOfflineManager';
import { isPhotoExtension } from '../utils/mediaTypeDetector';
import type { StageMediaItem } from '../types';

export interface OfflineFileItem {
  id: string;
  name: string;
  title: string;
  type: 'photo' | 'video';
  localUri: string;
  size: number;
  formattedSize: string;
  path: string;
  category: string;
}

export interface OfflineSummary {
  count: number;
  photosCount: number;
  videosCount: number;
  totalSizeBytes: number;
  formattedTotalSize: string;
  files: OfflineFileItem[];
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function cleanFileTitle(filename: string): string {
  return filename
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .replace(/^[a-zA-Z0-9]+_/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}

/**
 * Scan device Directory.Data/photos and Directory.Data/videos for all cached files
 */
export async function getOfflineFilesSummary(): Promise<OfflineSummary> {
  const items: OfflineFileItem[] = [];
  let totalSizeBytes = 0;
  let photosCount = 0;
  let videosCount = 0;

  if (Capacitor.isNativePlatform()) {
    // 1. Scan Photos
    try {
      const dirRes = await Filesystem.readdir({
        path: 'photos',
        directory: Directory.Data,
      });

      const photoFiles = dirRes?.files || [];
      for (const file of photoFiles) {
        const name = typeof file === 'string' ? file : file.name;
        if (!name || !isPhotoExtension(name)) continue;

        try {
          const stat = await Filesystem.stat({
            path: `photos/${name}`,
            directory: Directory.Data,
          });

          const uriRes = await Filesystem.getUri({
            path: `photos/${name}`,
            directory: Directory.Data,
          });

          const localUri = Capacitor.convertFileSrc(uriRes.uri);
          const size = stat.size || 0;
          totalSizeBytes += size;
          photosCount++;

          items.push({
            id: `offline-photo-${name}`,
            name,
            title: cleanFileTitle(name),
            type: 'photo',
            localUri,
            size,
            formattedSize: formatBytes(size),
            path: `photos/${name}`,
            category: 'Offline Photos',
          });
        } catch (_) {}
      }
    } catch (_) {
      // photos/ dir may not exist yet
    }

    // 2. Scan Videos
    try {
      const dirRes = await Filesystem.readdir({
        path: 'videos',
        directory: Directory.Data,
      });

      const videoFiles = dirRes?.files || [];
      for (const file of videoFiles) {
        const name = typeof file === 'string' ? file : file.name;
        if (!name) continue;

        try {
          const stat = await Filesystem.stat({
            path: `videos/${name}`,
            directory: Directory.Data,
          });

          const uriRes = await Filesystem.getUri({
            path: `videos/${name}`,
            directory: Directory.Data,
          });

          const localUri = Capacitor.convertFileSrc(uriRes.uri);
          const size = stat.size || 0;
          totalSizeBytes += size;
          videosCount++;

          items.push({
            id: `offline-video-${name}`,
            name,
            title: cleanFileTitle(name),
            type: 'video',
            localUri,
            size,
            formattedSize: formatBytes(size),
            path: `videos/${name}`,
            category: 'Offline Videos',
          });
        } catch (_) {}
      }
    } catch (_) {
      // videos/ dir may not exist yet
    }
  }

  // Sort: newest or alphabetical by title
  items.sort((a, b) => a.title.localeCompare(b.title));

  return {
    count: items.length,
    photosCount,
    videosCount,
    totalSizeBytes,
    formattedTotalSize: formatBytes(totalSizeBytes),
    files: items,
  };
}

/**
 * Convert an OfflineFileItem to a StageMediaItem so it can be viewed in media players
 */
export function offlineItemToStageMedia(item: OfflineFileItem): StageMediaItem {
  return {
    id: item.id,
    title: item.title,
    name: item.name,
    url: item.localUri,
    path: item.localUri,
    thumbnail: item.localUri,
    type: item.type === 'video' ? 'video' : 'image',
    mediaType: item.type === 'video' ? 'clip' : 'photo',
    category: item.category,
    parentAlbum: 'Available Offline',
  };
}

/**
 * Hook to reactively track offline file counts and summary
 */
export function useOfflineFilesSummary() {
  const [summary, setSummary] = useState<OfflineSummary>({
    count: 0,
    photosCount: 0,
    videosCount: 0,
    totalSizeBytes: 0,
    formattedTotalSize: '0 B',
    files: [],
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOfflineFilesSummary();
      setSummary(data);
    } catch (err) {
      console.warn('[OfflineManager] Error fetching summary:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    const handleUpdate = () => {
      refresh();
    };

    window.addEventListener(PHOTO_SYNC_EVENT_KEY, handleUpdate);
    window.addEventListener(VIDEO_OFFLINE_EVENT_KEY, handleUpdate);

    return () => {
      window.removeEventListener(PHOTO_SYNC_EVENT_KEY, handleUpdate);
      window.removeEventListener(VIDEO_OFFLINE_EVENT_KEY, handleUpdate);
    };
  }, [refresh]);

  return { summary, loading, refresh };
}
