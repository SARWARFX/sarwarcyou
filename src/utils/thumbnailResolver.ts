import { useState, useEffect } from 'react';
import { buildHfMediaUrl } from '../useMediaData';
import { ensureHttps } from './imageUrlResolver';
import type { StageMediaItem, HfMediaItem } from '../types';

/**
 * Extract clean relative path within the Hugging Face dataset from any URL or path.
 * e.g., "https://huggingface.co/.../Clips/Favorite/video.mp4" -> "Clips/Favorite/video.mp4"
 */
export function extractHfRelativePath(urlOrPath: string): string {
  if (!urlOrPath) return '';
  let clean = urlOrPath.trim();
  
  // Remove query parameters or hash (#t=0.5)
  clean = clean.split('?')[0].split('#')[0];

  // If full Hugging Face resolve URL:
  if (clean.includes('/resolve/main/')) {
    clean = clean.split('/resolve/main/')[1] || clean;
  } else if (clean.startsWith('http://') || clean.startsWith('https://')) {
    try {
      const parsed = new URL(clean);
      const parts = parsed.pathname.split('/resolve/main/');
      if (parts[1]) {
        clean = parts[1];
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

  return clean.replace(/^\/+/, '');
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
  if (!relPath || relPath.startsWith('.thumbnails/')) return null;

  const lastSlash = relPath.lastIndexOf('/');
  const parentDir = lastSlash > 0 ? relPath.substring(0, lastSlash) : '';
  const fileName = lastSlash >= 0 ? relPath.substring(lastSlash + 1) : relPath;
  const stem = fileName.replace(/\.[^/.]+$/, '');

  return { relPath, parentDir, fileName, stem };
}

/**
 * Derives the anticipated 5-frame pre-rendered WebP thumbnail URLs
 * following the stem standard: .thumbnails/{parent_dir}/{video_stem}/thumb_{0..4}.webp
 */
export function getAnticipatedThumbnailUrls(urlOrPath: string): string[] {
  const info = parseVideoPathInfo(urlOrPath);
  if (!info) return [];

  const baseDir = info.parentDir
    ? `.thumbnails/${info.parentDir}/${info.stem}`
    : `.thumbnails/${info.stem}`;

  return [0, 1, 2, 3, 4].map((idx) => {
    return buildHfMediaUrl(`${baseDir}/thumb_${idx}.webp`);
  });
}

/**
 * Derives the anticipated 5-frame pre-rendered WebP thumbnail URLs
 * following the extension-inclusive standard: .thumbnails/{parent_dir}/{filename.mp4}/thumb_{0..4}.webp
 */
export function getAnticipatedThumbnailUrlsWithExt(urlOrPath: string): string[] {
  const info = parseVideoPathInfo(urlOrPath);
  if (!info) return [];

  const baseDir = info.parentDir
    ? `.thumbnails/${info.parentDir}/${info.fileName}`
    : `.thumbnails/${info.fileName}`;

  return [0, 1, 2, 3, 4].map((idx) => {
    return buildHfMediaUrl(`${baseDir}/thumb_${idx}.webp`);
  });
}

import { isVideoExtension } from './mediaTypeDetector';

/**
 * Resolves verified or anticipated multi-frame thumbnail URLs for a given media item.
 */
export function resolveMultiFrameThumbnails(
  item: StageMediaItem | HfMediaItem | { url: string; path?: string; thumbnails?: string[]; type?: string }
): string[] {
  if (item.thumbnails && item.thumbnails.length > 0) {
    return item.thumbnails;
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
  const raw = ('path' in item && typeof item.path === 'string') ? item.path : (item.url || '');
  if (!raw) return [];

  const isVideo =
    ('type' in item && item.type === 'video') ||
    isVideoExtension(raw);

  if (isVideo) {
    return getAnticipatedThumbnailUrlsWithExt(raw);
  }

  return [];
}

/**
 * In-memory image preload cache to eliminate frame flickers during hover scrubbing.
 */
const preloadedImages = new Set<string>();

export function preloadThumbnailImages(urls: string[]): void {
  if (typeof window === 'undefined') return;
  for (const url of urls) {
    if (!url || preloadedImages.has(url)) continue;
    preloadedImages.add(url);
    const img = new Image();
    img.src = ensureHttps(url);
  }
}

export interface UseHoverThumbnailScrubOptions {
  thumbnails?: string[];
  defaultThumbnail?: string | null;
  isHovered: boolean;
  intervalMs?: number;
  enabled?: boolean;
}

export interface UseHoverThumbnailScrubResult {
  activeThumbnail: string | null;
  activeFrameIndex: number;
  isScrubbing: boolean;
  totalFrames: number;
}

/**
 * React hook that manages YouTube-style hover frame scrubbing.
 * When hovered on desktop, rotates smoothly through thumb_0 -> thumb_1 -> ... -> thumb_4.webp.
 * When unhovered, returns cleanly to thumb_0.webp (or default).
 */
export function useHoverThumbnailScrub({
  thumbnails = [],
  defaultThumbnail = null,
  isHovered,
  intervalMs = 400,
  enabled = true,
}: UseHoverThumbnailScrubOptions): UseHoverThumbnailScrubResult {
  const validThumbnails = thumbnails.filter(Boolean);
  const totalFrames = validThumbnails.length;
  const initialFrame = validThumbnails[0] || defaultThumbnail || null;

  const [activeFrameIndex, setActiveFrameIndex] = useState(0);

  // Preload other frames when hovered
  useEffect(() => {
    if (isHovered && totalFrames > 1 && enabled) {
      preloadThumbnailImages(validThumbnails);
    }
  }, [isHovered, totalFrames, validThumbnails, enabled]);

  // Scrub rotation loop
  useEffect(() => {
    if (!isHovered || totalFrames <= 1 || !enabled) {
      return;
    }

    const timer = setInterval(() => {
      setActiveFrameIndex((prev) => (prev + 1) % totalFrames);
    }, intervalMs);

    return () => {
      clearInterval(timer);
      setActiveFrameIndex(0);
    };
  }, [isHovered, totalFrames, intervalMs, enabled]);

  const isScrubbing = isHovered && totalFrames > 1 && enabled;
  const activeThumbnail = isScrubbing
    ? validThumbnails[activeFrameIndex] || initialFrame
    : initialFrame;

  return {
    activeThumbnail,
    activeFrameIndex: isScrubbing ? activeFrameIndex : 0,
    isScrubbing,
    totalFrames,
  };
}
