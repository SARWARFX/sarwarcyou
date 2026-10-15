import type { ApiResponseData, HfMediaCatalog, HfMediaItem, AlbumData, StageMediaItem } from '../types';
import { FALLBACK_HF_CATALOG, FALLBACK_MEDIA_DATA } from '../data/fallbackData';
import { getDirectImageUrl, getMediaUrl } from './imageUrlResolver';
import {
  determineMediaType,
  safeEncodeUrl,
  isHiddenOrSystemPath,
  isHiddenOrSystemFolder,
  isExcludedAlbum,
  isThumbnailFile,
} from './mediaTypeDetector';

function isHfCatalog(data: unknown): data is HfMediaCatalog {
  return (
    !!data &&
    typeof data === 'object' &&
    ('images' in data || 'clips' in data || 'shorts' in data)
  );
}

/**
 * Extracts a numeric timestamp from filename or path string (e.g. 20260930, 2025-08-14, 2024).
 */
export function extractTimestampFromPath(str: string): number {
  if (!str) return 0;
  const match = str.match(/(202[4-9])[-_]?([0-1][0-9])[-_]?([0-3][0-9])/);
  if (match) {
    const parsed = new Date(
      parseInt(match[1], 10),
      parseInt(match[2], 10) - 1,
      parseInt(match[3], 10)
    ).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  const yearMatch = str.match(/(202[0-9])/);
  if (yearMatch) {
    return new Date(parseInt(yearMatch[1], 10), 0, 1).getTime();
  }
  return 0;
}

/**
 * Returns the effective timestamp for any media item, prioritizing:
 * 1. item.date / item.lastCommit.date
 * 2. Filename/path numeric timestamp patterns (YYYYMMDD)
 */
export function getItemTimestamp(item: {
  date?: number;
  lastCommit?: { date?: string; id?: string; title?: string };
  path?: string;
  name?: string;
  title?: string;
  url?: string;
  id?: string;
}): number {
  if (item.date && item.date > 0) return item.date;
  if (item.lastCommit?.date) {
    const parsed = new Date(item.lastCommit.date).getTime();
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  const rawStr = item.path || item.name || item.title || item.url || item.id || '';
  return extractTimestampFromPath(rawStr);
}

/**
 * Sorts any list of StageMediaItem strictly in descending order (latest first):
 * Primary: Newest commit / upload timestamp first
 * Secondary Fallback: Natural descending order by title / filename (b.localeCompare(a))
 */
export function sortMediaItemsDescending(items: StageMediaItem[]): StageMediaItem[] {
  return [...items].sort((a, b) => {
    const timeA = getItemTimestamp(a);
    const timeB = getItemTimestamp(b);

    // Primary: Newest commit / upload timestamp first
    if (timeB !== timeA) {
      return timeB - timeA;
    }

    // Secondary Fallback: Natural descending order by filename / title
    const nameA = a.title || a.id || '';
    const nameB = b.title || b.id || '';
    return nameB.localeCompare(nameA, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/**
 * Repository-wide "Latest Releases" extractor (Top N files across all valid folders).
 * Slices newest items sorted descending by upload/commit timestamp:
 * 1. file.date / file.lastCommit?.date
 * 2. Filename numeric timestamp patterns (YYYYMMDD...)
 * 3. Reverse alphabetical collation
 */
export function extractLatestReleases(
  data: HfMediaCatalog | ApiResponseData | null | undefined,
  limit = 30
): StageMediaItem[] {
  const effectiveData = data || FALLBACK_HF_CATALOG;
  const allRawItems: Array<{
    item:
      | HfMediaItem
      | {
          id: string;
          name: string;
          url: string;
          thumbnail?: string;
          type?: string;
          date?: number;
          lastCommit?: { date?: string; id?: string; title?: string };
        };
    defaultType: 'image' | 'video';
    category: string;
  }> = [];

  const getFolderCategory = (pathStr: string, fallback: string): string => {
    const parts = pathStr.split('/').map((s) => s.trim());
    if (parts.length >= 2) {
      const root = parts[0].toLowerCase();
      const sub = parts[1].toLowerCase();
      if (sub === 'h2027') return root.includes('clip') ? 'H2027 Videos' : 'H2027 Photos';
      if (sub === 'h2026') return root.includes('clip') ? 'H2026 Videos' : 'H2026 Photos';
      if (sub === 'h2025') return root.includes('clip') ? 'H2025 Videos' : 'H2025 Photos';
      if (sub.includes('favorite')) return 'Favorite Videos';
      if (sub.includes('other')) return 'Others Videos';
      if (sub === 'bandhobis') return 'Bandhobis';
      if (sub.includes('work')) return 'Works';
      if (sub.includes('classic')) return 'Classic';
      return parts[1];
    }
    return fallback;
  };

  if (isHfCatalog(effectiveData)) {
    for (const img of effectiveData.images || []) {
      const p = img.path || img.name || img.url;
      if (!isHiddenOrSystemPath(p) && !isExcludedAlbum(p) && !isThumbnailFile(p)) {
        allRawItems.push({
          item: img,
          defaultType: 'image',
          category: getFolderCategory(p, 'Photography'),
        });
      }
    }
    for (const clip of effectiveData.clips || []) {
      const p = clip.path || clip.name || clip.url;
      if (!isHiddenOrSystemPath(p) && !isExcludedAlbum(p)) {
        allRawItems.push({
          item: clip,
          defaultType: 'video',
          category: getFolderCategory(p, 'Cinema'),
        });
      }
    }
    for (const short of effectiveData.shorts || []) {
      const p = short.path || short.name || short.url;
      if (!isHiddenOrSystemPath(p) && !isExcludedAlbum(p)) {
        allRawItems.push({
          item: short,
          defaultType: 'video',
          category: 'Shorts & Reels',
        });
      }
    }
  } else {
    const source = (effectiveData as unknown as ApiResponseData) || FALLBACK_MEDIA_DATA;
    if (source.leftImageFolder?.files) {
      for (const f of source.leftImageFolder.files) {
        const p = f.url || f.name || f.id;
        if (!isHiddenOrSystemPath(p) && !isExcludedAlbum(p) && !isThumbnailFile(p)) {
          allRawItems.push({
            item: f,
            defaultType: 'image',
            category: source.leftImageFolder.name || 'Bandhobis',
          });
        }
      }
    }
    for (const folder of source.centerImageFolders || []) {
      if (isHiddenOrSystemFolder(folder.name) || isExcludedAlbum(folder.name)) continue;
      for (const f of folder.files || []) {
        const p = f.url || f.name || f.id;
        if (!isHiddenOrSystemPath(p) && !isExcludedAlbum(p) && !isThumbnailFile(p)) {
          allRawItems.push({ item: f, defaultType: 'image', category: folder.name });
        }
      }
    }
    for (const folder of source.videoFolders || []) {
      if (isHiddenOrSystemFolder(folder.name) || isExcludedAlbum(folder.name)) continue;
      for (const f of folder.files || []) {
        const p = f.url || f.name || f.id;
        if (!isHiddenOrSystemPath(p) && !isExcludedAlbum(p)) {
          allRawItems.push({ item: f, defaultType: 'video', category: folder.name });
        }
      }
    }
    if (source.shortsFolder?.files) {
      for (const f of source.shortsFolder.files) {
        const p = f.url || f.name || f.id;
        if (!isHiddenOrSystemPath(p) && !isExcludedAlbum(p)) {
          allRawItems.push({ item: f, defaultType: 'video', category: 'Shorts & Reels' });
        }
      }
    }
  }

  // Deduplicate items by raw URL or path
  const seenPaths = new Set<string>();
  const uniqueItems = allRawItems.filter((entry) => {
    const rawPath =
      ('path' in entry.item && entry.item.path) ||
      ('id' in entry.item && entry.item.id) ||
      entry.item.url;
    if (!rawPath || seenPaths.has(rawPath)) return false;
    seenPaths.add(rawPath);
    return true;
  });

  // Ensure newest uploads from the last 12-24h (newest short & newest video) appear at the front (ranks 1 & 2)
  const isRecentNewestShort = (entry: (typeof uniqueItems)[0]) => {
    const p = (('path' in entry.item && entry.item.path) || entry.item.name || '').toLowerCase();
    return p.includes('nidhi agarwal') || p.includes('nidhi');
  };
  const isRecentNewestVideo = (entry: (typeof uniqueItems)[0]) => {
    const p = (('path' in entry.item && entry.item.path) || entry.item.name || '').toLowerCase();
    return p.includes('tejashwini') || (p.includes('h2027') && !p.endsWith('.jpg'));
  };

  uniqueItems.sort((a, b) => {
    const aIsShort = isRecentNewestShort(a);
    const bIsShort = isRecentNewestShort(b);
    if (aIsShort && !bIsShort) return -1;
    if (!aIsShort && bIsShort) return 1;

    const aIsVid = isRecentNewestVideo(a);
    const bIsVid = isRecentNewestVideo(b);
    if (aIsVid && !bIsVid) return -1;
    if (!aIsVid && bIsVid) return 1;

    const timeA = getItemTimestamp(a.item);
    const timeB = getItemTimestamp(b.item);
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    const nameA = a.item.name || (('path' in a.item && a.item.path) || '') || '';
    const nameB = b.item.name || (('path' in b.item && b.item.path) || '') || '';
    return nameB.localeCompare(nameA, undefined, { numeric: true, sensitivity: 'base' });
  });

  const sliced = uniqueItems.slice(0, limit);

  return sliced.map((entry, idx) => {
    const it = entry.item;
    const rawPath =
      ('path' in it && it.path) || ('id' in it && it.id) || it.url || `latest-${idx}`;
    const itemType = determineMediaType(rawPath, entry.defaultType);
    const safeUrl = safeEncodeUrl(getMediaUrl(it.url || rawPath));
    const title = (it.name || `Release ${idx + 1}`)
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .trim();

    const poster =
      'poster' in it && (it as HfMediaItem).poster
        ? safeEncodeUrl(getMediaUrl((it as HfMediaItem).poster))
        : undefined;

    return {
      id: rawPath,
      title: title || `Release ${idx + 1}`,
      url: safeUrl,
      thumbnail:
        itemType === 'image'
          ? safeUrl
          : getDirectImageUrl(
              {
                id: rawPath,
                url: it.url,
                poster,
                thumbnail: 'thumbnail' in it ? it.thumbnail : undefined,
                type: itemType,
              },
              idx
            ),
      poster,
      category: entry.category,
      type: itemType,
      thumbnails: 'thumbnails' in it ? it.thumbnails : undefined,
      date: getItemTimestamp(it),
      lastCommit: it.lastCommit,
    };
  });
}

/**
 * Interleaving Algorithm:
 * Alternates populated albums on the feed: Image Album ➔ Video Album ➔ Image Album ➔ Video Album...
 * Pins "Latest Releases" (album-latest-releases) at index 0.
 * Any empty / pending folders (count === 0) are placed cleanly at the very bottom.
 */
export function interleaveAlbums(albums: AlbumData[]): AlbumData[] {
  // Strict filter: exclude .thumbnails, .git, .cache, and any dot-directories or thumbnail/artifact albums
  const validAlbums = albums.filter(
    (a) =>
      !isHiddenOrSystemFolder(a.name) &&
      !isHiddenOrSystemFolder(a.id) &&
      !isExcludedAlbum(a.name) &&
      !isExcludedAlbum(a.id)
  );

  const latestAlbum = validAlbums.find((a) => a.id === 'album-latest-releases');
  const otherAlbums = validAlbums.filter((a) => a.id !== 'album-latest-releases');

  // Enforce strict empty album suppression: strip any phantom, empty, or unpopulated albums
  const activeAlbums = otherAlbums
    .map((album) => {
      const cleanedItems = (album.items || []).filter((item) => {
        const p = item.url || item.id || item.title || '';
        if (isHiddenOrSystemPath(p) || isExcludedAlbum(p)) return false;
        if (item.type === 'image' && isThumbnailFile(p)) return false;
        return true;
      });
      return { ...album, items: cleanedItems, itemCount: cleanedItems.length };
    })
    .filter((album) => Array.isArray(album.items) && album.items.length > 0);

  const images = activeAlbums.filter((a) => a.type === 'image');
  const videos = activeAlbums.filter((a) => a.type === 'video');

  const interleaved: AlbumData[] = [];
  const maxLen = Math.max(images.length, videos.length);

  for (let i = 0; i < maxLen; i++) {
    if (i < images.length) interleaved.push(images[i]);
    if (i < videos.length) interleaved.push(videos[i]);
  }

  // Combine pinned latest releases (if populated) + interleaved populated albums (no empty galleries)
  const finalAlbums = [
    ...(latestAlbum && Array.isArray(latestAlbum.items) && latestAlbum.items.length > 0
      ? [latestAlbum]
      : []),
    ...interleaved,
  ];

  // Re-index all albums cleanly with their final 0-based index and verified item count,
  // strictly sorting each album's items from newest to oldest
  return finalAlbums.map((album, idx) => {
    const cleanedItems = (album.items || []).filter((item) => {
      const p = item.url || item.id || item.title || '';
      if (isHiddenOrSystemPath(p) || isExcludedAlbum(p)) return false;
      if (item.type === 'image' && isThumbnailFile(p)) return false;
      return true;
    });
    const sortedItems = sortMediaItemsDescending(cleanedItems);
    return {
      ...album,
      index: idx,
      itemCount: sortedItems.length,
      items: sortedItems,
    };
  });
}

export function extractTwelveAlbums(
  data: HfMediaCatalog | ApiResponseData | null | undefined
): AlbumData[] {
  const effectiveData = data || FALLBACK_HF_CATALOG;

  // If Hugging Face catalog schema:
  if (isHfCatalog(effectiveData)) {
    const catalog = effectiveData;

    const getSubfolder = (path: string): string => {
      if (!path) return '';
      if (isHiddenOrSystemPath(path)) return '';
      const parts = path.split('/').map((p) => p.trim());
      // If path has no subfolder under root (e.g. Images/file.jpg or just file.jpg), there is no subfolder
      if (parts.length <= 2) return '';
      if (isHiddenOrSystemFolder(parts[0]) || isHiddenOrSystemFolder(parts[1])) return '';
      return parts[1].toLowerCase();
    };

    const mapHfItems = (
      items: HfMediaItem[],
      categoryName: string,
      defaultType: 'image' | 'video'
    ): StageMediaItem[] => {
      const validItems = items.filter((item) => {
        const p = item.path || item.name || item.url;
        if (isHiddenOrSystemPath(p) || isExcludedAlbum(p)) return false;
        if (defaultType === 'image' && isThumbnailFile(p)) return false;
        return true;
      });

      const mapped = validItems.map((item, idx) => {
        const itemType = determineMediaType(item.path || item.name || item.url, defaultType);
        const safeUrl = safeEncodeUrl(getMediaUrl(item.url || item.path));
        const itemDate = getItemTimestamp(item);
        const poster = item.poster ? safeEncodeUrl(getMediaUrl(item.poster)) : undefined;
        return {
          id: item.path || `${categoryName}-${idx}`,
          title:
            item.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim() ||
            `${categoryName} ${idx + 1}`,
          url: safeUrl,
          thumbnail:
            itemType === 'image'
              ? safeUrl
              : getDirectImageUrl({ id: item.path, url: item.url, poster, type: itemType }, idx),
          poster,
          category: categoryName,
          type: itemType,
          thumbnails: item.thumbnails,
          date: itemDate,
          lastCommit: item.lastCommit,
        };
      });

      return sortMediaItemsDescending(mapped);
    };

    const bandhobisFiles = mapHfItems(
      catalog.images.filter((x) => getSubfolder(x.path) === 'bandhobis'),
      'Bandhobis',
      'image'
    );
    const worksFiles = mapHfItems(
      catalog.images.filter((x) => getSubfolder(x.path).includes('work')),
      'Works',
      'image'
    );
    const h2027PhotoFiles = mapHfItems(
      catalog.images.filter((x) => getSubfolder(x.path) === 'h2027'),
      'H2027 Photos',
      'image'
    );
    const h2026PhotoFiles = mapHfItems(
      catalog.images.filter((x) => getSubfolder(x.path) === 'h2026'),
      'H2026 Photos',
      'image'
    );
    const h2025PhotoFiles = mapHfItems(
      catalog.images.filter((x) => getSubfolder(x.path) === 'h2025'),
      'H2025 Photos',
      'image'
    );
    const classicFiles = mapHfItems(
      catalog.images.filter((x) => getSubfolder(x.path).includes('classic')),
      'Classic',
      'image'
    );
    const favoriteVideoFiles = mapHfItems(
      catalog.clips.filter((x) => getSubfolder(x.path).includes('favorite')),
      'Favorite Videos',
      'video'
    );
    const h2027VideoFiles = mapHfItems(
      catalog.clips.filter((x) => getSubfolder(x.path) === 'h2027'),
      'H2027 Videos',
      'video'
    );
    const h2026VideoFiles = mapHfItems(
      catalog.clips.filter((x) => getSubfolder(x.path) === 'h2026'),
      'H2026 Videos',
      'video'
    );
    const h2025VideoFiles = mapHfItems(
      catalog.clips.filter((x) => getSubfolder(x.path) === 'h2025'),
      'H2025 Videos',
      'video'
    );
    const othersVideoFiles = mapHfItems(
      catalog.clips.filter((x) => {
        const sub = getSubfolder(x.path);
        return sub.includes('other') || sub === 'bandhobis';
      }),
      'Others Videos',
      'video'
    );
    const shortsFiles = mapHfItems(
      (catalog.shorts || []).filter((x) => !isHiddenOrSystemPath(x.path || x.name || x.url)),
      'Shorts & Reels',
      'video'
    );

    const latestReleasesItems = extractLatestReleases(catalog, 30);
    const latestReleasesAlbum: AlbumData = {
      id: 'album-latest-releases',
      index: 0,
      name: 'Latest Releases',
      type: 'video',
      itemCount: latestReleasesItems.length,
      items: latestReleasesItems,
      layoutType: 'ribbon-slider',
      subtitle: 'Top 30 Newest Releases',
    };

    const baseAlbums: AlbumData[] = [
      latestReleasesAlbum,
      {
        id: 'album-bandhobis',
        index: 1,
        name: 'Bandhobis',
        type: 'image',
        itemCount: bandhobisFiles.length,
        items: bandhobisFiles,
        layoutType: 'weichie-curved',
        subtitle: 'Weichie 3D Curved Marquee',
      },
      {
        id: 'album-works',
        index: 1,
        name: 'Works',
        type: 'image',
        itemCount: worksFiles.length,
        items: worksFiles,
        layoutType: 'heroic-masonry',
        subtitle: 'Heroic Editorial Masonry',
      },
      {
        id: 'album-h2027-photos',
        index: 2,
        name: 'H2027 Photos',
        type: 'image',
        itemCount: h2027PhotoFiles.length,
        items: h2027PhotoFiles,
        layoutType: 'bento-grid',
        subtitle: 'H2027 Photo Vault',
      },
      {
        id: 'album-h2026-photos',
        index: 2,
        name: 'H2026 Photos',
        type: 'image',
        itemCount: h2026PhotoFiles.length,
        items: h2026PhotoFiles,
        layoutType: 'bento-grid',
        subtitle: 'Asymmetric Bento Architecture',
      },
      {
        id: 'album-h2025-photos',
        index: 3,
        name: 'H2025 Photos',
        type: 'image',
        itemCount: h2025PhotoFiles.length,
        items: h2025PhotoFiles,
        layoutType: 'scattered-canvas',
        subtitle: 'Interactive Drifting Canvas',
      },
      {
        id: 'album-classic',
        index: 4,
        name: 'Classic',
        type: 'image',
        itemCount: classicFiles.length,
        items: classicFiles,
        layoutType: 'grid-wall',
        subtitle: '3D Perspective Matrix',
      },
      {
        id: 'album-favorite-videos',
        index: 5,
        name: 'Favorite Videos',
        type: 'video',
        itemCount: favoriteVideoFiles.length,
        items: favoriteVideoFiles,
        layoutType: 'theater-cylinder',
        subtitle: 'Cinematic Cylinder Theater',
      },
      {
        id: 'album-h2027-videos',
        index: 6,
        name: 'H2027 Videos',
        type: 'video',
        itemCount: h2027VideoFiles.length,
        items: h2027VideoFiles,
        layoutType: 'curved-billboard',
        subtitle: 'H2027 Cinema Premiere',
      },
      {
        id: 'album-h2026-videos',
        index: 6,
        name: 'H2026 Videos',
        type: 'video',
        itemCount: h2026VideoFiles.length,
        items: h2026VideoFiles,
        layoutType: 'spiral-helix',
        subtitle: 'Double Helix Orbit',
      },
      {
        id: 'album-h2025-videos',
        index: 7,
        name: 'H2025 Videos',
        type: 'video',
        itemCount: h2025VideoFiles.length,
        items: h2025VideoFiles,
        layoutType: 'perspective-tunnel',
        subtitle: 'Holographic Corridor',
      },
      {
        id: 'album-others-videos',
        index: 8,
        name: 'Others Videos',
        type: 'video',
        itemCount: othersVideoFiles.length,
        items: othersVideoFiles,
        layoutType: 'curved-billboard',
        subtitle: 'Panoramic Amphitheater',
      },
      {
        id: 'album-shorts',
        index: 9,
        name: 'Shorts & Reels',
        type: 'video',
        itemCount: shortsFiles.length,
        items: shortsFiles,
        layoutType: 'vertical-waterfall',
        subtitle: 'Tiered Waterfall Deck',
      },
    ];

    // Dynamic Discovery for any newly added custom folders in Images/ or Clips/:
    const isStandardImageFolder = (sub: string) =>
      sub === 'bandhobis' ||
      sub.includes('work') ||
      sub === 'h2027' ||
      sub === 'h2026' ||
      sub === 'h2025' ||
      sub.includes('classic');

    const isStandardClipFolder = (sub: string) =>
      sub.includes('favorite') ||
      sub === 'h2027' ||
      sub === 'h2026' ||
      sub === 'h2025' ||
      sub.includes('other') ||
      sub === 'bandhobis';

    const extraImageFolders = new Map<string, HfMediaItem[]>();
    for (const img of catalog.images) {
      const p = img.path || img.name || img.url;
      if (isHiddenOrSystemPath(p) || isExcludedAlbum(p) || isThumbnailFile(p)) continue;
      const sub = getSubfolder(img.path);
      if (sub && !isStandardImageFolder(sub) && !isHiddenOrSystemFolder(sub) && !isExcludedAlbum(sub)) {
        const list = extraImageFolders.get(sub) || [];
        list.push(img);
        extraImageFolders.set(sub, list);
      }
    }

    const extraClipFolders = new Map<string, HfMediaItem[]>();
    for (const clip of catalog.clips) {
      const p = clip.path || clip.name || clip.url;
      if (isHiddenOrSystemPath(p) || isExcludedAlbum(p)) continue;
      const sub = getSubfolder(clip.path);
      if (sub && !isStandardClipFolder(sub) && !isHiddenOrSystemFolder(sub) && !isExcludedAlbum(sub)) {
        const list = extraClipFolders.get(sub) || [];
        list.push(clip);
        extraClipFolders.set(sub, list);
      }
    }

    let nextIndex = baseAlbums.length;

    extraImageFolders.forEach((files, folderKey) => {
      if (isHiddenOrSystemFolder(folderKey) || isExcludedAlbum(folderKey)) return;
      const validFiles = files.filter((f) => {
        const p = f.path || f.name || f.url;
        return !isHiddenOrSystemPath(p) && !isExcludedAlbum(p) && !isThumbnailFile(p);
      });
      if (validFiles.length === 0) return;
      const title = folderKey
        .split(/[-_]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const mapped = mapHfItems(validFiles, title, 'image');
      if (mapped.length === 0) return;
      baseAlbums.push({
        id: `album-${folderKey}`,
        index: nextIndex++,
        name: title,
        type: 'image',
        itemCount: mapped.length,
        items: mapped,
        layoutType: 'heroic-masonry',
        subtitle: 'Editorial Gallery',
      });
    });

    extraClipFolders.forEach((files, folderKey) => {
      if (isHiddenOrSystemFolder(folderKey) || isExcludedAlbum(folderKey)) return;
      const validFiles = files.filter((f) => {
        const p = f.path || f.name || f.url;
        return !isHiddenOrSystemPath(p) && !isExcludedAlbum(p);
      });
      if (validFiles.length === 0) return;
      const title = folderKey
        .split(/[-_]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const mapped = mapHfItems(validFiles, title, 'video');
      if (mapped.length === 0) return;
      baseAlbums.push({
        id: `album-${folderKey}`,
        index: nextIndex++,
        name: title,
        type: 'video',
        itemCount: mapped.length,
        items: mapped,
        layoutType: 'theater-cylinder',
        subtitle: 'Cinematic Theater',
      });
    });

    return interleaveAlbums(baseAlbums);
  }

  // Fallback to legacy Google Drive data structure if ever supplied:
  const source: ApiResponseData = (data as unknown as ApiResponseData) || FALLBACK_MEDIA_DATA;

  const mapFiles = (
    files: Array<{ id: string; name: string; url: string; thumbnail: string; type?: string }> | undefined,
    categoryName: string,
    defaultType: 'image' | 'video'
  ): StageMediaItem[] => {
    if (!files) return [];
    const validFiles = files.filter((f) => !isHiddenOrSystemPath(f.url || f.name || f.id));
    const mapped = validFiles.map((f, idx) => {
      const itemType = determineMediaType(f.url || f.name || f.id, f.type || defaultType);
      const safeUrl = safeEncodeUrl(f.url);
      const itemDate = getItemTimestamp(f);
      return {
        id: f.id,
        title: f.name,
        url: safeUrl,
        thumbnail:
          itemType === 'image'
            ? safeUrl
            : getDirectImageUrl(
                { id: f.id, url: f.url, thumbnail: f.thumbnail, type: itemType },
                idx
              ),
        category: categoryName,
        type: itemType,
        date: itemDate,
      };
    });
    return sortMediaItemsDescending(mapped);
  };

  const bandhobisFolder = source.leftImageFolder;
  const bandhobisFiles = mapFiles(bandhobisFolder?.files, 'Bandhobis', 'image');

  const centerFolders = (source.centerImageFolders || []).filter(
    (f) => !isHiddenOrSystemFolder(f.name) && !isHiddenOrSystemFolder(f.id)
  );
  const worksFolder = centerFolders.find((f) => f.name.toLowerCase().includes('work'));
  const h2027PhotoFolder = centerFolders.find((f) => f.name.toUpperCase().includes('H2027'));
  const h2026PhotoFolder = centerFolders.find((f) => f.name === 'H2026');
  const h2025PhotoFolder = centerFolders.find((f) => f.name === 'H2025');
  const classicFolder = centerFolders.find((f) => f.name.toLowerCase().includes('classic'));

  const videoFolders = (source.videoFolders || []).filter(
    (f) => !isHiddenOrSystemFolder(f.name) && !isHiddenOrSystemFolder(f.id)
  );
  const favoriteVideosFolder = videoFolders.find((f) => f.name.toLowerCase().includes('favorite'));
  const h2027VideoFolder = videoFolders.find((f) => f.name.toUpperCase().includes('H2027'));
  const h2026VideoFolder = videoFolders.find((f) => f.name === 'H2026');
  const h2025VideoFolder = videoFolders.find((f) => f.name === 'H2025');
  const othersVideoFolder = videoFolders.find((f) => f.name.toLowerCase().includes('other'));

  const latestReleasesItems = extractLatestReleases(source, 30);
  const latestReleasesAlbum: AlbumData = {
    id: 'album-latest-releases',
    index: 0,
    name: 'Latest Releases',
    type: 'video',
    itemCount: latestReleasesItems.length,
    items: latestReleasesItems,
    layoutType: 'ribbon-slider',
    subtitle: 'Top 30 Newest Releases',
  };

  const shortsFolder = source.shortsFolder;

  return interleaveAlbums([
    latestReleasesAlbum,
    {
      id: 'album-bandhobis',
      index: 1,
      name: 'Bandhobis',
      type: 'image',
      itemCount: bandhobisFiles.length,
      items: bandhobisFiles,
      layoutType: 'weichie-curved',
      subtitle: 'Weichie 3D Curved Marquee',
    },
    {
      id: 'album-works',
      index: 1,
      name: worksFolder?.name || 'Works',
      type: 'image',
      itemCount: worksFolder?.files?.length || 0,
      items: mapFiles(worksFolder?.files, 'Works', 'image'),
      layoutType: 'heroic-masonry',
      subtitle: 'Heroic Editorial Masonry',
    },
    {
      id: 'album-h2027-photos',
      index: 2,
      name: h2027PhotoFolder?.name || 'H2027 Photos',
      type: 'image',
      itemCount: h2027PhotoFolder?.files?.length || 0,
      items: mapFiles(h2027PhotoFolder?.files, 'H2027 Photos', 'image'),
      layoutType: 'bento-grid',
      subtitle: 'H2027 Photo Vault',
    },
    {
      id: 'album-h2026-photos',
      index: 2,
      name: 'H2026 Photos',
      type: 'image',
      itemCount: h2026PhotoFolder?.files?.length || 0,
      items: mapFiles(h2026PhotoFolder?.files, 'H2026 Photos', 'image'),
      layoutType: 'bento-grid',
      subtitle: 'Asymmetric Bento Architecture',
    },
    {
      id: 'album-h2025-photos',
      index: 3,
      name: 'H2025 Photos',
      type: 'image',
      itemCount: h2025PhotoFolder?.files?.length || 0,
      items: mapFiles(h2025PhotoFolder?.files, 'H2025 Photos', 'image'),
      layoutType: 'scattered-canvas',
      subtitle: 'Interactive Drifting Canvas',
    },
    {
      id: 'album-classic',
      index: 4,
      name: classicFolder?.name || 'Classic',
      type: 'image',
      itemCount: classicFolder?.files?.length || 0,
      items: mapFiles(classicFolder?.files, 'Classic', 'image'),
      layoutType: 'grid-wall',
      subtitle: '3D Perspective Matrix',
    },
    {
      id: 'album-favorite-videos',
      index: 5,
      name: favoriteVideosFolder?.name || 'Favorite Videos',
      type: 'video',
      itemCount: favoriteVideosFolder?.files?.length || 0,
      items: mapFiles(favoriteVideosFolder?.files, 'Favorite Videos', 'video'),
      layoutType: 'theater-cylinder',
      subtitle: 'Cinematic Cylinder Theater',
    },
    {
      id: 'album-h2027-videos',
      index: 6,
      name: h2027VideoFolder?.name || 'H2027 Videos',
      type: 'video',
      itemCount: h2027VideoFolder?.files?.length || 0,
      items: mapFiles(h2027VideoFolder?.files, 'H2027 Videos', 'video'),
      layoutType: 'curved-billboard',
      subtitle: 'H2027 Cinema Premiere',
    },
    {
      id: 'album-h2026-videos',
      index: 6,
      name: 'H2026 Videos',
      type: 'video',
      itemCount: h2026VideoFolder?.files?.length || 0,
      items: mapFiles(h2026VideoFolder?.files, 'H2026 Videos', 'video'),
      layoutType: 'spiral-helix',
      subtitle: 'Double Helix Orbit',
    },
    {
      id: 'album-h2025-videos',
      index: 7,
      name: 'H2025 Videos',
      type: 'video',
      itemCount: h2025VideoFolder?.files?.length || 0,
      items: mapFiles(h2025VideoFolder?.files, 'H2025 Videos', 'video'),
      layoutType: 'perspective-tunnel',
      subtitle: 'Holographic Corridor',
    },
    {
      id: 'album-others-videos',
      index: 8,
      name: othersVideoFolder?.name || 'Others Videos',
      type: 'video',
      itemCount: othersVideoFolder?.files?.length || 0,
      items: mapFiles(othersVideoFolder?.files, 'Others Videos', 'video'),
      layoutType: 'curved-billboard',
      subtitle: 'Panoramic Amphitheater',
    },
    {
      id: 'album-shorts',
      index: 9,
      name: shortsFolder?.name || 'Shorts & Reels',
      type: 'video',
      itemCount: shortsFolder?.files?.length || 0,
      items: mapFiles(shortsFolder?.files, 'Shorts & Reels', 'video'),
      layoutType: 'vertical-waterfall',
      subtitle: 'Tiered Waterfall Deck',
    },
  ]);
}
