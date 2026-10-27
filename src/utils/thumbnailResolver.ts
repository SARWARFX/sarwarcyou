import { buildHfMediaUrl } from '../useMediaData';
import type { StageMediaItem, HfMediaItem } from '../types';
import { normalizeRepoPath } from './imageUrlResolver';

/**
 * Extract clean relative path within the Hugging Face dataset from any URL or path.
 * e.g., "https://huggingface.co/.../Clips/Favorite/video.mp4" -> "Clips/Favorite/video.mp4"
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
 * Parses video path info with robust handling of decoded/encoded characters,
 * query parameters, hashes (#t=0.5), sub-albums, and filename stems.
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

/**
 * Derives the 5-frame pre-rendered thumbnail URLs from dedicated mirror directory:
 * Path format: Thumbnails/${basePathWithoutExtension}_thumb_${1..5}.jpg
 */
export function getAnticipatedThumbnailUrls(urlOrPath: string): string[] {
  if (!urlOrPath) return [];

  const relPath = extractHfRelativePath(urlOrPath);
  if (!relPath) return [];

  // If already pointing inside Thumbnails/ mirror directory
  const thumbMatch = relPath.match(/^Thumbnails\/(.+?)_thumb_\d+\.jpg$/i);
  if (thumbMatch) {
    const base = thumbMatch[1];
    return [1, 2, 3, 4, 5].map((idx) => buildHfMediaUrl(`Thumbnails/${base}_thumb_${idx}.jpg`));
  }

  // Strip video extension (.mp4, .mov, etc.) preserving exact character stem (including any trailing spaces)
  const basePathWithoutExtension = relPath.replace(/\.(mp4|mov|webm|mkv|m4v|avi|flv)$/i, '');
  if (!basePathWithoutExtension) return [];

  return [1, 2, 3, 4, 5].map((idx) => {
    return buildHfMediaUrl(`Thumbnails/${basePathWithoutExtension}_thumb_${idx}.jpg`);
  });
}

/**
 * Derives 5-frame thumbnail URLs for any video media item or path.
 * Format: Thumbnails/${basePathWithoutExtension}_thumb_${1..5}.jpg
 */
export function getVideoThumbnails(
  itemOrPath: string | StageMediaItem | HfMediaItem | { url?: string; path?: string; thumbnails?: string[]; type?: string }
): string[] {
  if (!itemOrPath) return [];

  if (typeof itemOrPath === 'object' && itemOrPath.thumbnails && itemOrPath.thumbnails.length >= 5) {
    return itemOrPath.thumbnails.map((t) => buildHfMediaUrl(t));
  }

  const raw = typeof itemOrPath === 'string'
    ? itemOrPath
    : (('path' in itemOrPath && typeof itemOrPath.path === 'string') ? itemOrPath.path : (itemOrPath.url || ''));

  if (!raw) return [];
  return getAnticipatedThumbnailUrls(raw);
}

/**
 * Backwards compatibility alias for fallback multi-frame thumbnail URLs
 */
export function getAnticipatedThumbnailUrlsWithExt(urlOrPath: string): string[] {
  return getAnticipatedThumbnailUrls(urlOrPath);
}

import { isVideoExtension } from './mediaTypeDetector';
import {
  preloadImageFrames,
  useThumbnailScrubber,
  type UseThumbnailScrubberOptions,
  type UseThumbnailScrubberResult,
} from '../hooks/useThumbnailScrubber';

export { preloadImageFrames, useThumbnailScrubber, type UseThumbnailScrubberOptions, type UseThumbnailScrubberResult };

/**
 * Resolves verified or anticipated multi-frame thumbnail URLs for a given media item.
 */
export function resolveMultiFrameThumbnails(
  item: StageMediaItem | HfMediaItem | { url: string; path?: string; thumbnails?: string[]; type?: string }
): string[] {
  if (item.thumbnails && item.thumbnails.length > 0) {
    return item.thumbnails.map((t) => buildHfMediaUrl(t));
  }

  const raw = ('path' in item && typeof item.path === 'string') ? item.path : (item.url || '');
  if (!raw) return [];

  // Only resolve multi-frame video thumbnails for video assets strictly determined by extension or type
  const isVideo =
    ('type' in item && item.type === 'video') ||
    isVideoExtension(raw);

  if (isVideo) {
    return getAnticipatedThumbnailUrls(raw);
  }

  return [];
}

/**
 * Resolves fallback anticipated multi-frame thumbnails formatted with the full filename.
 */
export function resolveMultiFrameThumbnailsExt(
  item: StageMediaItem | HfMediaItem | { url: string; path?: string; thumbnails?: string[]; type?: string }
): string[] {
  return resolveMultiFrameThumbnails(item);
}

/**
 * In-memory image preload cache to eliminate frame flickers during hover scrubbing.
 */
export function preloadThumbnailImages(urls: string[]): void {
  preloadImageFrames(urls);
}

export interface UseHoverThumbnailScrubOptions {
  thumbnails?: string[];
  defaultThumbnail?: string | null;
  isHovered: boolean;
  manualIndex?: number | null;
  intervalMs?: number;
  enabled?: boolean;
}

export interface UseHoverThumbnailScrubResult {
  activeThumbnail: string | null;
  activeFrameIndex: number;
  isScrubbing: boolean;
  totalFrames: number;
  handleFrameError?: (failedUrl?: string | null) => void;
}

/**
 * React hook that manages YouTube-style hover frame scrubbing.
 * Delegates to useThumbnailScrubber with double-buffered zero-blanking and 404 resilience.
 */
export function useHoverThumbnailScrub({
  thumbnails = [],
  defaultThumbnail = null,
  isHovered,
  manualIndex = null,
  intervalMs = 380,
  enabled = true,
}: UseHoverThumbnailScrubOptions): UseHoverThumbnailScrubResult {
  const result = useThumbnailScrubber({
    thumbnails,
    defaultThumbnail,
    isHovered,
    manualIndex,
    intervalMs,
    enabled,
  });

  return {
    activeThumbnail: result.activeThumbnail,
    activeFrameIndex: result.activeFrameIndex,
    isScrubbing: result.isScrubbing,
    totalFrames: result.totalFrames,
    handleFrameError: result.handleFrameError,
  };
}
