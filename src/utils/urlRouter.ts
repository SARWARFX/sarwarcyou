import type { AlbumData, StageMediaItem } from '../types';

export const STORAGE_LAST_ACTIVE_ALBUM = 'last_active_album';

export interface ParsedRouteState {
  albumQuery: string | null;
  mediaQuery: string | null;
}

/**
 * Derives a clean, URL-safe slug from an album or album name.
 * e.g., "Cinematic Stream" -> "cinematic-stream"
 */
export function getAlbumSlug(nameOrAlbum: AlbumData | string): string {
  const name = typeof nameOrAlbum === 'string' ? nameOrAlbum : nameOrAlbum.name;
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'album';
}

/**
 * Derives a clean, identifiable slug/filename from a media item.
 * Uses exact filename (e.g., "video.mp4") if available, or a clean title slug.
 */
export function getMediaSlug(item: StageMediaItem | string): string {
  if (typeof item === 'string') {
    const rawName = item.split('/').pop()?.split('?')[0] || item;
    return encodeURIComponent(rawName);
  }

  // Check URL / ID for clean filename with extension
  const rawPath = item.id || item.url || '';
  const filename = rawPath.split('/').pop()?.split('?')[0]?.split('#')[0];
  if (filename && filename.includes('.')) {
    return encodeURIComponent(filename);
  }

  // Fallback to title slug
  if (item.title) {
    const titleSlug = item.title
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (titleSlug) return encodeURIComponent(titleSlug);
  }

  return encodeURIComponent(item.id || 'item');
}

/**
 * Parses current URL search parameters and hash to extract deep-linked album and media.
 */
export function parseUrlState(): ParsedRouteState {
  if (typeof window === 'undefined') {
    return { albumQuery: null, mediaQuery: null };
  }

  const searchParams = new URLSearchParams(window.location.search);
  let albumQuery = searchParams.get('album');
  const mediaQuery = searchParams.get('media') || searchParams.get('item');

  // If no album in search params, check window.location.hash as fallback (e.g. #shorts, #works)
  if (!albumQuery && window.location.hash) {
    const hashClean = window.location.hash.replace(/^#/, '').trim();
    if (hashClean) {
      albumQuery = hashClean;
    }
  }

  return {
    albumQuery: albumQuery ? decodeURIComponent(albumQuery) : null,
    mediaQuery: mediaQuery ? decodeURIComponent(mediaQuery) : null,
  };
}

/**
 * Finds a matching album in the catalog using slug, name, ID, or numeric index.
 */
export function findMatchingAlbum(
  albums: AlbumData[],
  query: string | null
): { album: AlbumData; index: number } | null {
  if (!query || !albums || albums.length === 0) return null;

  const rawQuery = decodeURIComponent(query).trim().toLowerCase();
  const slugQuery = rawQuery.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  // 1. Match by slug
  let idx = albums.findIndex((a) => {
    const slug = getAlbumSlug(a.name);
    return slug === slugQuery;
  });
  if (idx !== -1) return { album: albums[idx], index: idx };

  // 2. Match by exact or lowercased name
  idx = albums.findIndex((a) => a.name.toLowerCase() === rawQuery);
  if (idx !== -1) return { album: albums[idx], index: idx };

  // 3. Match by ID
  idx = albums.findIndex((a) => a.id.toLowerCase() === rawQuery || a.id.toLowerCase() === slugQuery);
  if (idx !== -1) return { album: albums[idx], index: idx };

  // 4. Numeric index fallback (e.g. ?album=0)
  if (/^\d+$/.test(rawQuery)) {
    const num = parseInt(rawQuery, 10);
    if (num >= 0 && num < albums.length) {
      return { album: albums[num], index: num };
    }
  }

  return null;
}

/**
 * Finds a matching media item inside an album using ID, filename, stem, title, or index.
 */
export function findMatchingMediaItem(
  items: StageMediaItem[],
  query: string | null
): { item: StageMediaItem; index: number } | null {
  if (!query || !items || items.length === 0) return null;

  const rawQuery = decodeURIComponent(query).trim().toLowerCase();
  const queryStem = rawQuery.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
  const slugQuery = rawQuery.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  // 1. Match by exact ID or URL
  let idx = items.findIndex((it) => it.id && it.id.toLowerCase() === rawQuery);
  if (idx !== -1) return { item: items[idx], index: idx };

  // 2. Match by filename in ID or URL
  idx = items.findIndex((it) => {
    const fn = (it.id || it.url || '').split('/').pop()?.split('?')[0]?.toLowerCase();
    return fn === rawQuery;
  });
  if (idx !== -1) return { item: items[idx], index: idx };

  // 3. Match by filename stem without extension
  idx = items.findIndex((it) => {
    const fn = (it.id || it.url || '').split('/').pop()?.split('?')[0]?.toLowerCase() || '';
    const stem = fn.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
    return stem && stem === queryStem;
  });
  if (idx !== -1) return { item: items[idx], index: idx };

  // 4. Match by title
  idx = items.findIndex((it) => {
    const t = (it.title || '').toLowerCase().replace(/[-_]+/g, ' ').trim();
    return t && (t === queryStem || t === rawQuery);
  });
  if (idx !== -1) return { item: items[idx], index: idx };

  // 5. Match by title/filename slug
  idx = items.findIndex((it) => {
    const s = (it.title || it.id || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return s && s === slugQuery;
  });
  if (idx !== -1) return { item: items[idx], index: idx };

  // 6. Numeric index fallback (e.g. ?media=0)
  if (/^\d+$/.test(rawQuery)) {
    const num = parseInt(rawQuery, 10);
    if (num >= 0 && num < items.length) {
      return { item: items[num], index: num };
    }
  }

  return null;
}

export interface SyncUrlStateOptions {
  album?: AlbumData | null;
  mediaItem?: StageMediaItem | null;
  replace?: boolean;
}

/**
 * Synchronizes browser URL search parameters and hash without full page reload.
 */
export function syncUrlState({ album, mediaItem, replace = true }: SyncUrlStateOptions): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const searchParams = url.searchParams;

  if (album) {
    const albumSlug = getAlbumSlug(album.name);
    searchParams.set('album', albumSlug);
    url.hash = `#${albumSlug}`;
    setStoredLastActiveAlbum(albumSlug);

    if (mediaItem) {
      const mediaSlug = getMediaSlug(mediaItem);
      searchParams.set('media', mediaSlug);
    } else {
      searchParams.delete('media');
      searchParams.delete('item');
    }
  } else {
    // Reset home
    searchParams.delete('album');
    searchParams.delete('media');
    searchParams.delete('item');
    url.hash = '';
    removeStoredLastActiveAlbum();
  }

  const queryPart = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const newUrl = `${url.pathname}${queryPart}${url.hash}`;
  const currentFull = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (newUrl !== currentFull) {
    if (replace) {
      window.history.replaceState({ album: album?.name, media: mediaItem?.id }, '', newUrl);
    } else {
      window.history.pushState({ album: album?.name, media: mediaItem?.id }, '', newUrl);
    }
  }
}

/**
 * Session storage persistence helpers.
 */
export function getStoredLastActiveAlbum(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(STORAGE_LAST_ACTIVE_ALBUM);
  } catch {
    return null;
  }
}

export function setStoredLastActiveAlbum(albumKey: string): void {
  if (typeof window === 'undefined' || !albumKey) return;
  try {
    sessionStorage.setItem(STORAGE_LAST_ACTIVE_ALBUM, albumKey);
  } catch {
    // ignore quota/private browsing issues
  }
}

export function removeStoredLastActiveAlbum(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_LAST_ACTIVE_ALBUM);
  } catch {
    // ignore
  }
}

/**
 * Anchors the viewport to the target album section to preserve scroll stability.
 */
export function anchorToAlbumSection(albumIndex: number): void {
  if (typeof document === 'undefined') return;
  requestAnimationFrame(() => {
    const el = document.getElementById(`album-section-${albumIndex}`);
    if (el) {
      el.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  });
}
