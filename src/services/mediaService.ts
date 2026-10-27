/**
 * mediaService.ts
 * Unified catalog loader and organizer.
 * Fetches tree items via RFC 5988 Link pagination, matches verified thumbnails,
 * and groups items into dynamic Album collections.
 */

import type { MediaItem, Album, CatalogState } from '../models/media';
import { getMediaUrl } from './urlResolver';
import { buildThumbnailIndex } from './thumbnailMatcher';

const HF_DATASET_ID = 'SARWARFX/stream-vault';
const HF_TREE_URL = `https://huggingface.co/api/datasets/${HF_DATASET_ID}/tree/main?recursive=true`;
const HF_COMMITS_URL = `https://huggingface.co/api/datasets/${HF_DATASET_ID}/commits/main?limit=150`;
const CACHE_KEY = 'sarwarcyou_catalog_v2';
const CACHE_TTL_MS = 60 * 1000; // 60s

const VIDEO_EXT_REGEX = /\.(mp4|mov|webm|mkv|m4v|avi)$/i;
const PHOTO_EXT_REGEX = /\.(jpg|jpeg|png|webp|avif|gif)$/i;

function cleanTitle(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}

function createAlbumSlug(folderPath: string): string {
  return folderPath
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'featured';
}

function formatAlbumTitle(folderPath: string): string {
  if (!folderPath || folderPath.toLowerCase() === 'featured' || folderPath === '') {
    return 'Featured Vault';
  }
  const clean = folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const segments = clean.split('/');
  const leaf = segments[segments.length - 1];

  // Title-case leaf directory
  return leaf
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function extractTimestamp(str: string): number {
  if (!str) return 0;
  // 1. Millisecond Unix timestamp (13 digits)
  const ms = str.match(/(?:^|[^0-9])(1[6-8][0-9]{11})(?:[^0-9]|$)/);
  if (ms) return parseInt(ms[1], 10);

  // 2. Second Unix timestamp (10 digits)
  const sec = str.match(/(?:^|[^0-9])(1[6-8][0-9]{8})(?:[^0-9]|$)/);
  if (sec) return parseInt(sec[1], 10) * 1000;

  // 3. Date pattern: YYYYMMDD
  const dt = str.match(/(202[0-9])[-_]?([0-1][0-9])[-_]?([0-3][0-9])/);
  if (dt) {
    const y = parseInt(dt[1], 10);
    const m = parseInt(dt[2], 10) - 1;
    const d = parseInt(dt[3], 10);
    return new Date(y, m, d, 12, 0, 0).getTime();
  }

  // 4. Year pattern (H2027 -> 2027)
  const yr = str.match(/(?:H|Year)?(202[0-9])/i);
  if (yr) {
    return new Date(parseInt(yr[1], 10), 0, 1).getTime();
  }

  return 0;
}

/**
 * Fetches all tree items through RFC 5988 Link pagination.
 */
async function fetchTreeItems(): Promise<Array<{ path: string; type: string; size?: number }>> {
  const allItems: Array<{ path: string; type: string; size?: number }> = [];
  let nextUrl: string | null = HF_TREE_URL;
  let page = 0;
  const maxPages = 5;

  while (nextUrl && page < maxPages) {
    page++;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(nextUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) break;
      const data = await res.json();
      if (Array.isArray(data)) {
        allItems.push(...data);
      }

      const link = res.headers.get('Link') || res.headers.get('link');
      const match = link ? link.match(/<([^>]+)>;\s*rel="next"/i) : null;
      nextUrl = match ? match[1] : null;
    } catch {
      break;
    }
  }

  return allItems;
}

/**
 * Fetches recent commit history to obtain upload timestamps.
 */
async function fetchCommitDates(): Promise<Map<string, number>> {
  const dates = new Map<string, number>();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(HF_COMMITS_URL, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const commits = await res.json();
      if (Array.isArray(commits)) {
        for (const c of commits) {
          if (!c.date) continue;
          const time = new Date(c.date).getTime();
          const text = `${c.title || ''}\n${c.message || ''}`.toLowerCase();
          const matches = text.matchAll(/[a-z0-9_\-\s./]+\.(?:mp4|mov|jpg|jpeg|png|webp)/gi);
          for (const m of matches) {
            const fname = m[0].split('/').pop() || m[0];
            if (!dates.has(fname)) {
              dates.set(fname.trim(), time);
            }
          }
        }
      }
    }
  } catch {
    // Ignore commit fetch error
  }
  return dates;
}

/**
 * Main catalog loader with caching and exact thumbnail matching.
 */
export async function loadCatalog(bypassCache = false): Promise<CatalogState> {
  if (!bypassCache && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const cached = window.sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed: CatalogState = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_TTL_MS && parsed.items.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignore cache read error
    }
  }

  const [treeItems, commitDates] = await Promise.all([
    fetchTreeItems(),
    fetchCommitDates(),
  ]);

  const thumbIndex = buildThumbnailIndex(treeItems);
  const mediaItems: MediaItem[] = [];
  const folderMap = new Map<string, MediaItem[]>();

  for (const item of treeItems) {
    if (item.type !== 'file' || !item.path) continue;
    const cleanPath = item.path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const filename = cleanPath.split('/').pop() || cleanPath;

    // Strict system exclusions
    if (filename.startsWith('.') || filename.endsWith('.keep')) continue;
    if (/^(?:Thumbnails|thumbnails|\.thumbnails|temp_thumbnails)\//i.test(cleanPath)) continue;

    const isVideo = VIDEO_EXT_REGEX.test(filename);
    const isPhoto = PHOTO_EXT_REGEX.test(filename);
    if (!isVideo && !isPhoto) continue;

    const segments = cleanPath.split('/');
    const parentFolder = segments.length > 1 ? segments.slice(0, -1).join('/') : 'Featured';
    const albumId = createAlbumSlug(parentFolder);
    const albumTitle = formatAlbumTitle(parentFolder);

    const isShort =
      isVideo &&
      (segments.some((s) => /^shorts?$/i.test(s.trim())) ||
        cleanPath.toLowerCase().includes('/shorts/') ||
        parentFolder.toLowerCase().includes('short'));

    const variant = isShort ? 'short' : isVideo ? 'standard' : 'photo';
    const mediaUrl = getMediaUrl(cleanPath);

    let thumbs: string[] = [];
    let poster: string | null = null;
    if (isVideo) {
      thumbs = thumbIndex.getThumbnails(cleanPath);
      poster = thumbIndex.getPoster(cleanPath) || (thumbs.length > 0 ? thumbs[0] : null);
    }

    const defaultThumbnail = isVideo
      ? (poster || (thumbs.length > 0 ? thumbs[0] : ''))
      : mediaUrl;

    const date =
      commitDates.get(filename.toLowerCase()) ||
      extractTimestamp(cleanPath) ||
      Date.now();

    const mediaObj: MediaItem = {
      id: cleanPath,
      path: cleanPath,
      title: cleanTitle(filename),
      type: isVideo ? 'video' : 'image',
      variant,
      mediaUrl,
      thumbnailUrl: defaultThumbnail,
      thumbnails: thumbs,
      albumId,
      albumTitle,
      parentFolder,
      date,
      fileSize: item.size,
    };

    mediaItems.push(mediaObj);

    const albumList = folderMap.get(parentFolder) || [];
    albumList.push(mediaObj);
    folderMap.set(parentFolder, albumList);
  }

  // Sort global media newest first
  mediaItems.sort((a, b) => b.date - a.date);

  // Build Albums
  const albums: Album[] = [];
  for (const [folderPath, items] of folderMap.entries()) {
    items.sort((a, b) => b.date - a.date);

    let photos = 0;
    let clips = 0;
    let shorts = 0;
    for (const it of items) {
      if (it.variant === 'short') shorts++;
      else if (it.variant === 'standard') clips++;
      else photos++;
    }

    const albumType =
      photos > 0 && (clips > 0 || shorts > 0)
        ? 'composite'
        : photos > 0
        ? 'image'
        : 'video';

    const dominantVariant =
      shorts > clips && shorts > photos
        ? 'short'
        : photos > clips
        ? 'photo'
        : 'standard';

    const coverThumbnailUrl =
      items.find((it) => it.thumbnailUrl)?.thumbnailUrl || '';

    albums.push({
      id: createAlbumSlug(folderPath),
      folderPath,
      title: formatAlbumTitle(folderPath),
      type: albumType,
      variant: dominantVariant,
      items,
      coverThumbnailUrl,
      itemCount: items.length,
      typeCounts: { photos, clips, shorts },
    });
  }

  // Sort albums by most recent item upload
  albums.sort((a, b) => {
    const timeA = a.items[0]?.date || 0;
    const timeB = b.items[0]?.date || 0;
    return timeB - timeA;
  });

  const latestReleases = mediaItems.slice(0, 30);
  const shorts = mediaItems.filter((it) => it.variant === 'short');

  const state: CatalogState = {
    items: mediaItems,
    albums,
    latestReleases,
    shorts,
    timestamp: Date.now(),
  };

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(state));
    } catch {
      // Storage quota exceeded
    }
  }

  return state;
}
