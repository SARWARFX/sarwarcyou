import type { StageMediaItem, HfMediaItem } from '../types';
import { normalizeRepoPath } from './imageUrlResolver';
import {
  preloadImageFrames,
  useThumbnailScrubber,
  type UseThumbnailScrubberOptions,
  type UseThumbnailScrubberResult,
} from '../hooks/useThumbnailScrubber';

export {
  preloadImageFrames,
  useThumbnailScrubber,
  useThumbnailScrubber as useHoverThumbnailScrub,
  type UseThumbnailScrubberOptions,
  type UseThumbnailScrubberResult,
};

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
 * Parses video path info with robust handling of decoded/encoded characters.
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
 * Returns empty array: static thumbnail dependencies removed in favor of native video posters (#t=1.0).
 */
export function getAnticipatedThumbnailUrls(_urlOrPath?: string): string[] {
  return [];
}

/**
 * Returns empty array: static thumbnail dependencies removed in favor of native video posters (#t=1.0).
 */
export function getVideoThumbnails(
  _itemOrPath?: string | StageMediaItem | HfMediaItem | { url?: string; path?: string; thumbnails?: string[]; type?: string }
): string[] {
  return [];
}

export function getAnticipatedThumbnailUrlsWithExt(_urlOrPath?: string): string[] {
  return [];
}

export function resolveMultiFrameThumbnails(
  _item?: StageMediaItem | HfMediaItem | { url?: string; path?: string; thumbnails?: string[]; type?: string }
): string[] {
  return [];
}

export function resolveMultiFrameThumbnailsExt(
  _item?: StageMediaItem | HfMediaItem | { url?: string; path?: string; thumbnails?: string[]; type?: string }
): string[] {
  return [];
}
