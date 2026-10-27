import type { HfMediaCatalog, StageMediaItem, MediaFolderEntry, SortOrder } from '../types';
import { getMediaUrl } from './imageUrlResolver';
import {
  isHiddenOrSystemPath,
  isHiddenOrSystemFolder,
  isExcludedAlbum,
  isThumbnailFile,
  parseMediaPath,
  isVideoExtension,
} from './mediaTypeDetector';
import { getItemTimestamp, sortMediaItems } from './albumExtractor';
import { getVideoThumbnails } from './thumbnailResolver';
import { sanitizeMediaTitle } from './titleSanitizer';

export interface VaultFeedData {
  latestReleases: StageMediaItem[];
  allMediaPool: StageMediaItem[];
  shorts: StageMediaItem[];
  videoVaultFolders: MediaFolderEntry[];
  photoVaultFolders: MediaFolderEntry[];
}

function cleanTitleFromPath(path: string, category?: string): string {
  return sanitizeMediaTitle(path, category);
}

function formatFolderName(raw: string, mediaTypeHint?: 'video' | 'image' | 'composite'): string {
  const decoded = decodeURIComponent(raw).trim();
  // Standard formatted names
  if (/^h2027\s*videos?$/i.test(decoded)) return 'H2027 Videos';
  if (/^h2026\s*videos?$/i.test(decoded)) return 'H2026 Videos';
  if (/^h2025\s*videos?$/i.test(decoded)) return 'H2025 Videos';
  if (/^favorite\s*videos?$/i.test(decoded)) return 'Favorite Videos';
  if (/^others?\s*videos?$/i.test(decoded)) return 'Others Videos';
  if (/^h2027\s*photos?$/i.test(decoded)) return 'H2027 Photos';
  if (/^h2026\s*photos?$/i.test(decoded)) return 'H2026 Photos';
  if (/^h2025\s*photos?$/i.test(decoded)) return 'H2025 Photos';
  if (/^works?$/i.test(decoded)) return 'Works';
  if (/^bandhobis?$/i.test(decoded)) return 'Bandhobis';
  if (/^classic$/i.test(decoded)) return 'Classic';

  if (/^h2027$/i.test(decoded)) {
    return mediaTypeHint === 'video' ? 'H2027 Videos' : 'H2027 Photos';
  }
  if (/^h2026$/i.test(decoded)) {
    return mediaTypeHint === 'video' ? 'H2026 Videos' : 'H2026 Photos';
  }
  if (/^h2025$/i.test(decoded)) {
    return mediaTypeHint === 'video' ? 'H2025 Videos' : 'H2025 Photos';
  }
  if (/^favorite$/i.test(decoded)) return 'Favorite Videos';
  if (/^others?$/i.test(decoded)) return 'Others Videos';

  // Capitalize words
  return decoded
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function organizeVaultFeed(
  catalog: HfMediaCatalog | null | undefined,
  sortOrder: SortOrder = 'newest'
): VaultFeedData {
  if (!catalog) {
    return {
      latestReleases: [],
      allMediaPool: [],
      shorts: [],
      videoVaultFolders: [],
      photoVaultFolders: [],
    };
  }

  const clipsRaw = catalog.clips || [];
  const shortsRaw = catalog.shorts || [];
  const imagesRaw = catalog.images || [];

  // Map to hold extra nested items (clips, shorts) grouped by parent album
  const extraItemsByAlbum = new Map<string, StageMediaItem[]>();

  // 1. Process Shorts
  const rawShortsItems: StageMediaItem[] = shortsRaw
    .filter((it) => {
      const p = it.path || it.name || it.url;
      return !isHiddenOrSystemPath(p) && !isExcludedAlbum(p);
    })
    .map((it) => {
      const p = it.path || it.name || it.url;
      const mediaUrl = getMediaUrl(it.url || p);
      const title = cleanTitleFromPath(p);
      const parsed = parseMediaPath(p);
      const thumbs = getVideoThumbnails({ url: mediaUrl, path: p, thumbnails: it.thumbnails });
      const defaultThumb = thumbs[0] || (it.poster ? getMediaUrl(it.poster) : mediaUrl);
      const item: StageMediaItem = {
        id: `short-${p.replace(/[/\\.]+/g, '-')}`,
        title,
        name: title,
        url: mediaUrl,
        thumbnail: defaultThumb,
        poster: thumbs[0] || (it.poster ? getMediaUrl(it.poster) : undefined),
        thumbnails: thumbs,
        category: parsed.isNested ? formatFolderName(parsed.parentAlbum) : 'Shorts & Reels',
        type: 'video' as const,
        mediaType: 'short',
        parentAlbum: parsed.parentAlbum,
        innerFolder: parsed.innerFolder,
        date: getItemTimestamp(it),
        lastCommit: it.lastCommit,
      };

      if (parsed.isNested && parsed.parentAlbum) {
        const normAlbum = parsed.parentAlbum.trim().toLowerCase();
        const list = extraItemsByAlbum.get(normAlbum) || [];
        list.push(item);
        extraItemsByAlbum.set(normAlbum, list);
      }

      return item;
    });

  const shortsItems = sortMediaItems(rawShortsItems, sortOrder);

  // 2. Process Clips into Dynamic Folders
  const clipFolderMap = new Map<string, StageMediaItem[]>();
  for (const it of clipsRaw) {
    const p = it.path || it.name || it.url;
    if (isHiddenOrSystemPath(p) || isExcludedAlbum(p)) continue;
    const parsed = parseMediaPath(p);
    const subfolder = parsed.parentAlbum || 'Featured Videos';
    if (isHiddenOrSystemFolder(subfolder) || isExcludedAlbum(subfolder)) continue;

    const mediaUrl = getMediaUrl(it.url || p);
    const title = cleanTitleFromPath(p);
    const thumbs = getVideoThumbnails({ url: mediaUrl, path: p, thumbnails: it.thumbnails });
    const defaultThumb = thumbs[0] || (it.poster ? getMediaUrl(it.poster) : mediaUrl);
    const item: StageMediaItem = {
      id: `clip-${p.replace(/[/\\.]+/g, '-')}`,
      title,
      name: title,
      url: mediaUrl,
      thumbnail: defaultThumb,
      poster: thumbs[0] || (it.poster ? getMediaUrl(it.poster) : undefined),
      thumbnails: thumbs,
      category: formatFolderName(subfolder, 'video'),
      type: 'video',
      mediaType: 'clip',
      parentAlbum: parsed.parentAlbum,
      innerFolder: parsed.innerFolder,
      date: getItemTimestamp(it),
      lastCommit: it.lastCommit,
    };

    if (parsed.isNested && parsed.parentAlbum) {
      const normAlbum = parsed.parentAlbum.trim().toLowerCase();
      const list = extraItemsByAlbum.get(normAlbum) || [];
      list.push(item);
      extraItemsByAlbum.set(normAlbum, list);
    }

    const list = clipFolderMap.get(subfolder) || [];
    list.push(item);
    clipFolderMap.set(subfolder, list);
  }

  // Desired order for Video Vault folders
  const videoOrder = ['h2027', 'h2026', 'h2025', 'favorite', 'bandhobis', 'others'];
  const videoVaultFolders: MediaFolderEntry[] = Array.from(clipFolderMap.entries())
    .map(([rawSubfolder, items]) => ({
      id: `folder-video-${rawSubfolder.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: formatFolderName(rawSubfolder, 'video'),
      type: 'video' as const,
      count: items.length,
      items: sortMediaItems(items, sortOrder),
    }))
    .sort((a, b) => {
      const idxA = videoOrder.findIndex((k) => a.name.toLowerCase().includes(k));
      const idxB = videoOrder.findIndex((k) => b.name.toLowerCase().includes(k));
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

  // 3. Process Images into Dynamic Folders
  const imageFolderMap = new Map<string, StageMediaItem[]>();
  for (const it of imagesRaw) {
    const p = it.path || it.name || it.url;
    if (isHiddenOrSystemPath(p) || isExcludedAlbum(p) || isThumbnailFile(p)) continue;
    const parsed = parseMediaPath(p);
    const subfolder = parsed.parentAlbum || 'Featured Photography';
    if (isHiddenOrSystemFolder(subfolder) || isExcludedAlbum(subfolder)) continue;

    const mediaUrl = getMediaUrl(it.url || p);
    const title = cleanTitleFromPath(p);
    const isVid = isVideoExtension(p);
    const thumbs = isVid ? getVideoThumbnails({ url: mediaUrl, path: p, thumbnails: it.thumbnails }) : undefined;
    const defaultThumb = thumbs ? (thumbs[0] || mediaUrl) : mediaUrl;
    const item: StageMediaItem = {
      id: `${isVid ? 'clip' : 'photo'}-${p.replace(/[/\\.]+/g, '-')}`,
      title,
      name: title,
      url: mediaUrl,
      thumbnail: defaultThumb,
      poster: thumbs ? (thumbs[0] || undefined) : mediaUrl,
      thumbnails: thumbs,
      category: formatFolderName(subfolder, isVid ? 'video' : 'image'),
      type: isVid ? 'video' : 'image',
      mediaType: isVid ? 'clip' : 'photo',
      parentAlbum: parsed.parentAlbum,
      innerFolder: parsed.innerFolder,
      date: getItemTimestamp(it),
      lastCommit: it.lastCommit,
    };

    const list = imageFolderMap.get(subfolder) || [];
    list.push(item);
    imageFolderMap.set(subfolder, list);
  }

  // Desired order for Photo Vault / Composite folders
  const photoOrder = ['works', 'bandhobis', 'h2027', 'h2026', 'h2025', 'classic'];
  const photoVaultFolders: MediaFolderEntry[] = Array.from(imageFolderMap.entries())
    .map(([rawSubfolder, items]) => {
      const normAlbum = rawSubfolder.trim().toLowerCase();
      const extraItems = extraItemsByAlbum.get(normAlbum) || [];
      const combinedItems = [...items, ...extraItems];

      // Calculate media type breakdown
      let photosCount = 0;
      let clipsCount = 0;
      let shortsCount = 0;

      for (const it of combinedItems) {
        if (it.mediaType === 'short') shortsCount++;
        else if (it.mediaType === 'clip' || it.type === 'video') clipsCount++;
        else photosCount++;
      }

      const hasMultipleTypes =
        (photosCount > 0 && clipsCount > 0) ||
        (photosCount > 0 && shortsCount > 0) ||
        (clipsCount > 0 && shortsCount > 0);

      return {
        id: `folder-photo-${rawSubfolder.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: formatFolderName(rawSubfolder, hasMultipleTypes ? 'composite' : 'image'),
        type: hasMultipleTypes ? ('composite' as const) : ('image' as const),
        count: combinedItems.length,
        hasMultipleTypes,
        typeCounts: {
          photos: photosCount,
          clips: clipsCount,
          shorts: shortsCount,
        },
        items: sortMediaItems(combinedItems, sortOrder),
      };
    })
    .sort((a, b) => {
      const idxA = photoOrder.findIndex((k) => a.name.toLowerCase().includes(k));
      const idxB = photoOrder.findIndex((k) => b.name.toLowerCase().includes(k));
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

  // 4. Unified Latest Releases: Top 30 items aggregated from ALL folders and depths
  const rawMediaPool: StageMediaItem[] = [];
  const seenUrls = new Set<string>();

  const addToPool = (it: StageMediaItem) => {
    if (!it.url || seenUrls.has(it.url)) return;
    seenUrls.add(it.url);
    rawMediaPool.push(it);
  };

  shortsItems.forEach(addToPool);
  videoVaultFolders.forEach((f) => f.items.forEach(addToPool));
  photoVaultFolders.forEach((f) => f.items.forEach(addToPool));

  const allMediaPool = sortMediaItems(rawMediaPool, sortOrder);

  // Latest Releases is strictly sorted by newest date first
  const latestReleases = sortMediaItems(rawMediaPool, 'newest').slice(0, 30);

  return {
    latestReleases,
    allMediaPool,
    shorts: shortsItems,
    videoVaultFolders,
    photoVaultFolders,
  };
}

