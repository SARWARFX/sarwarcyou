import type { HfMediaCatalog, StageMediaItem, MediaFolderEntry, SortOrder } from '../types';
import { getMediaUrl } from './imageUrlResolver';
import {
  isHiddenOrSystemPath,
  isHiddenOrSystemFolder,
  isExcludedAlbum,
  isThumbnailFile,
  isVideoExtension,
  isPhotoExtension,
} from './mediaTypeDetector';
import { getItemTimestamp, sortMediaItems } from './albumExtractor';
import { getVideoThumbnails } from './thumbnailResolver';
import { sanitizeMediaTitle } from './titleSanitizer';
import { getAlbumSlug } from './urlRouter';

export interface VaultFeedData {
  latestReleases: StageMediaItem[];
  allMediaPool: StageMediaItem[];
  shorts: StageMediaItem[];
  albums: MediaFolderEntry[];
  videoVaultFolders: MediaFolderEntry[];
  photoVaultFolders: MediaFolderEntry[];
}

function cleanTitleFromPath(path: string, category?: string): string {
  return sanitizeMediaTitle(path, category);
}

export function formatFolderName(raw: string, mediaTypeHint?: 'video' | 'image' | 'composite'): string {
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

export function formatAlbumDisplayName(folderPath: string, mediaTypeHint?: 'video' | 'image' | 'composite'): string {
  if (!folderPath || folderPath.toLowerCase() === 'featured' || folderPath.toLowerCase() === 'root') {
    return 'Featured Vault';
  }
  const clean = folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const segments = clean.split('/');

  if (segments.length === 1) {
    return formatFolderName(segments[0], mediaTypeHint);
  }

  const last = segments[segments.length - 1];
  const root = segments[0].toLowerCase();

  // If root is a generic namespace folder like Photographs, Video Clips, REALTube, Images, Clips
  if (['photographs', 'video clips', 'realtube', 'images', 'clips'].includes(root)) {
    if (root === 'clips') {
      return formatFolderName(last, 'video');
    }
    if (root === 'images') {
      return formatFolderName(last, 'image');
    }
    return formatFolderName(last, mediaTypeHint);
  }

  // If leaf is just a year (e.g. Travel/2026) -> Travel 2026
  if (/^\d{4}$/.test(last.trim())) {
    return `${formatFolderName(segments[0], mediaTypeHint)} ${last}`;
  }

  return formatFolderName(last, mediaTypeHint);
}

/**
 * Dynamic Folder-to-Album Engine:
 * Refactors media categorization so EVERY folder in the dataset
 * (except thumbnails/Thumbnails) dynamically becomes its own separate Album.
 */
export function organizeVaultFeed(
  catalog: HfMediaCatalog | null | undefined,
  sortOrder: SortOrder = 'newest'
): VaultFeedData {
  if (!catalog) {
    return {
      latestReleases: [],
      allMediaPool: [],
      shorts: [],
      albums: [],
      videoVaultFolders: [],
      photoVaultFolders: [],
    };
  }

  // 1. Gather all raw items across catalog (prefer allMedia if present)
  const pool = catalog.allMedia && catalog.allMedia.length > 0
    ? catalog.allMedia
    : [...(catalog.clips || []), ...(catalog.shorts || []), ...(catalog.images || [])];

  // 2. Group all valid media items strictly by relative folder hierarchy
  const folderMap = new Map<string, StageMediaItem[]>();
  const seenPaths = new Set<string>();

  for (const it of pool) {
    const rawPath = it.path || it.name || it.url || '';
    if (!rawPath) continue;

    const clean = rawPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const filename = clean.split('/').pop() || clean;

    // Strict exclusions: skip dotfiles, thumbnail directories, internal caches
    if (filename.startsWith('.')) continue;
    if (isThumbnailFile(clean)) continue;
    if (/^(?:\.?thumbnails?|temp_thumbnails?)\//i.test(clean)) continue;
    if (isHiddenOrSystemPath(clean) || isExcludedAlbum(clean)) continue;

    const dedupeKey = clean.toLowerCase();
    if (seenPaths.has(dedupeKey)) continue;
    seenPaths.add(dedupeKey);

    const segments = clean.split('/');
    const folderPath = segments.length > 1 ? segments.slice(0, -1).join('/') : 'Featured';

    if (isHiddenOrSystemFolder(folderPath) || isExcludedAlbum(folderPath)) continue;

    const isVid = isVideoExtension(filename);
    const isPhoto = isPhotoExtension(filename);
    if (!isVid && !isPhoto) continue;

    const hasShortsIndicator =
      segments.some((s) => /^shorts?$/i.test(s.trim())) ||
      clean.toLowerCase().includes('/shorts/') ||
      folderPath.toLowerCase().includes('short');
    const isShort = isVid && hasShortsIndicator;

    const mediaUrl = getMediaUrl(it.url || clean);
    const title = cleanTitleFromPath(clean);
    const thumbs = isVid
      ? (it.thumbnails && it.thumbnails.length > 0
          ? it.thumbnails.map((t) => getMediaUrl(t))
          : getVideoThumbnails({ url: mediaUrl, path: clean, thumbnails: it.thumbnails, poster: it.poster }))
      : undefined;
    const posterUrl = thumbs?.[0] || (it.poster ? getMediaUrl(it.poster) : undefined);
    const defaultThumb = isVid ? (posterUrl || '') : mediaUrl;

    const item: StageMediaItem = {
      id: clean,
      path: clean,
      title,
      name: title,
      url: mediaUrl,
      thumbnail: defaultThumb,
      poster: posterUrl,
      thumbnails: thumbs,
      category: formatAlbumDisplayName(folderPath),
      type: isVid ? 'video' : 'image',
      mediaType: isShort ? 'short' : isVid ? 'clip' : 'photo',
      parentAlbum: folderPath,
      innerFolder: segments.length > 2 ? segments.slice(1, -1).join(' / ') : undefined,
      date: getItemTimestamp(it),
      lastCommit: it.lastCommit,
    };

    const list = folderMap.get(folderPath) || [];
    list.push(item);
    folderMap.set(folderPath, list);
  }

  // 3. Transform grouped folders into dynamic Album collections
  const albums: MediaFolderEntry[] = Array.from(folderMap.entries())
    .map(([folderPath, items]) => {
      const sortedItems = sortMediaItems(items, sortOrder);

      // Compute media type distribution within album
      let photos = 0;
      let clips = 0;
      let shorts = 0;

      for (const it of sortedItems) {
        if (it.mediaType === 'short') shorts++;
        else if (it.mediaType === 'clip' || it.type === 'video') clips++;
        else photos++;
      }

      const hasMultipleTypes =
        (photos > 0 && clips > 0) ||
        (photos > 0 && shorts > 0) ||
        (clips > 0 && shorts > 0);

      const type: 'image' | 'video' | 'composite' = hasMultipleTypes
        ? 'composite'
        : photos > 0
        ? 'image'
        : 'video';

      const variant: 'standard' | 'shorts' | 'photo' =
        shorts > 0 && clips === 0 && photos === 0
          ? 'shorts'
          : photos > 0 && clips === 0 && shorts === 0
          ? 'photo'
          : 'standard';

      const name = formatAlbumDisplayName(folderPath, type);
      const slug = getAlbumSlug(folderPath);
      const id = `album-${slug}`;
      const coverUrl = sortedItems[0]?.thumbnail || sortedItems[0]?.poster || sortedItems[0]?.url;

      const segments = folderPath.split('/');
      const subtitle = segments.length > 1 ? segments.slice(0, -1).join(' / ') : undefined;

      return {
        id,
        name,
        slug,
        folderPath,
        type,
        variant,
        count: sortedItems.length,
        coverUrl,
        hasMultipleTypes,
        typeCounts: { photos, clips, shorts },
        subtitle,
        items: sortedItems,
      };
    })
    .filter((a) => a.count > 0);

  // 4. Sort Albums dynamically by latest upload timestamp so active folders surface first
  albums.sort((a, b) => {
    const timeA = a.items[0]?.date || 0;
    const timeB = b.items[0]?.date || 0;
    if (timeB !== timeA) return timeB - timeA;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });

  // 5. Aggregate global pools
  const allMediaItems: StageMediaItem[] = [];
  const seenMediaUrls = new Set<string>();

  for (const album of albums) {
    for (const it of album.items) {
      if (!it.url || seenMediaUrls.has(it.url)) continue;
      seenMediaUrls.add(it.url);
      allMediaItems.push(it);
    }
  }

  const allMediaPool = sortMediaItems(allMediaItems, sortOrder);

  // Latest Releases: Top 30 newest items across all albums
  const latestReleases = sortMediaItems(allMediaItems, 'newest').slice(0, 30);

  // Global Shorts collection
  const shorts = sortMediaItems(
    allMediaItems.filter((it) => it.mediaType === 'short'),
    sortOrder
  );

  // Backwards-compatible folder aliases for any legacy consumers
  const videoVaultFolders = albums.filter((a) => a.type === 'video');
  const photoVaultFolders = albums.filter((a) => a.type === 'image' || a.type === 'composite');

  return {
    latestReleases,
    allMediaPool,
    shorts,
    albums,
    videoVaultFolders,
    photoVaultFolders,
  };
}
