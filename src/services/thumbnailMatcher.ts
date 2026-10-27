/**
 * thumbnailMatcher.ts
 * Verified pre-rendered thumbnail matching engine.
 * Maps video repository paths directly to verified Thumbnails/${folder}/${stem}_thumb_${1..5}.jpg.
 */

import { getMediaUrl } from './urlResolver';

export interface ThumbnailIndex {
  getThumbnails(videoPath: string): string[];
  getPoster(videoPath: string): string | null;
}

function normalizeKey(str: string): string {
  let clean = str.replace(/^\/+/, '');
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // leave as is
  }
  return clean.toLowerCase().trim();
}

/**
 * Builds an exact, in-memory index from raw Hugging Face tree items.
 */
export function buildThumbnailIndex(treeItems: Array<{ path?: string; type?: string }>): ThumbnailIndex {
  const multiFrameMap = new Map<string, string[]>();
  const directPosterMap = new Map<string, string>();

  for (const item of treeItems) {
    if (item.type !== 'file' || !item.path) continue;
    const lowerPath = item.path.toLowerCase();
    const isImage =
      lowerPath.endsWith('.jpg') ||
      lowerPath.endsWith('.jpeg') ||
      lowerPath.endsWith('.webp') ||
      lowerPath.endsWith('.png');

    if (
      isImage &&
      (lowerPath.startsWith('thumbnails/') ||
        lowerPath.startsWith('.thumbnails/') ||
        lowerPath.includes('/thumbnails/') ||
        /[-_]thumb(?:nail)?[-_]?\d*\.[^/.]+$/i.test(item.path))
    ) {
      const cdnUrl = getMediaUrl(item.path);

      // Strip Thumbnails/ or thumbnails/ prefix
      const cleanThumb = item.path.replace(/^(?:Thumbnails|thumbnails|\.thumbnails|temp_thumbnails)\//i, '');
      const cleanStem = cleanThumb
        .replace(/[-_]thumb(?:nail)?[-_]?\d*\.[^/.]+$/i, '')
        .replace(/[-_]preview\.[^/.]+$/i, '');

      const fullKey = normalizeKey(cleanStem);
      const filenameOnly = normalizeKey(cleanStem.split('/').pop() || cleanStem);

      if (fullKey) {
        const list = multiFrameMap.get(fullKey) || [];
        list.push(cdnUrl);
        multiFrameMap.set(fullKey, list);

        if (!directPosterMap.has(fullKey)) {
          directPosterMap.set(fullKey, cdnUrl);
        }
      }

      if (filenameOnly && filenameOnly !== fullKey) {
        const list = multiFrameMap.get(filenameOnly) || [];
        list.push(cdnUrl);
        multiFrameMap.set(filenameOnly, list);

        if (!directPosterMap.has(filenameOnly)) {
          directPosterMap.set(filenameOnly, cdnUrl);
        }
      }
    }
  }

  // Sort multi-frame thumbnails numerically (thumb_1, thumb_2, thumb_3...)
  for (const [key, list] of multiFrameMap.entries()) {
    list.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    multiFrameMap.set(key, list);
  }

  return {
    getThumbnails(videoPath: string): string[] {
      const clean = videoPath.replace(/\\/g, '/').replace(/^\/+/, '');
      const stemPath = clean.replace(/\.[^/.]+$/, '');
      const fileName = clean.split('/').pop() || clean;
      const stemOnly = fileName.replace(/\.[^/.]+$/, '');

      const fullMatch = multiFrameMap.get(normalizeKey(stemPath));
      if (fullMatch && fullMatch.length > 0) return fullMatch;

      const stemMatch = multiFrameMap.get(normalizeKey(stemOnly));
      if (stemMatch && stemMatch.length > 0) return stemMatch;

      return [];
    },

    getPoster(videoPath: string): string | null {
      const clean = videoPath.replace(/\\/g, '/').replace(/^\/+/, '');
      const stemPath = clean.replace(/\.[^/.]+$/, '');
      const fileName = clean.split('/').pop() || clean;
      const stemOnly = fileName.replace(/\.[^/.]+$/, '');

      return (
        directPosterMap.get(normalizeKey(stemPath)) ||
        directPosterMap.get(normalizeKey(stemOnly)) ||
        null
      );
    },
  };
}
