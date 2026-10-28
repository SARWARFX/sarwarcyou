import type { AlbumData, StageMediaItem, MediaFolderEntry, SortOrder } from '../types';

export const STORAGE_LAST_ACTIVE_ALBUM = 'last_active_album';

export interface ParsedRouteState {
  albumQuery: string | null;
  mediaQuery: string | null;
  sortQuery: string | null;
  tabQuery: 'all' | 'clips' | 'images' | 'shorts' | null;
}

/**
 * Derives a clean, URL-safe slug from an album or album name.
 * e.g., "Cinematic Stream" -> "cinematic-stream"
 */
export function getAlbumSlug(nameOrAlbum: AlbumData | MediaFolderEntry | string): string {
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
 * Supports:
 * - ?album=:albumId
 * - #/album/:albumId or #album/:albumId
 * - ?media=:mediaId or ?view=:mediaId
 * - #/view/:mediaId or #view/:mediaId
 * - ?album=:albumId&media=:mediaId
 */
export function parseUrlState(): ParsedRouteState {
  if (typeof window === 'undefined') {
    return { albumQuery: null, mediaQuery: null, sortQuery: null, tabQuery: null };
  }

  const searchParams = new URLSearchParams(window.location.search);
  let albumQuery = searchParams.get('album');
  let mediaQuery = searchParams.get('media') || searchParams.get('item') || searchParams.get('view');
  let sortQuery = searchParams.get('sort');
  let rawTab = searchParams.get('tab') || searchParams.get('filter');

  // Check window.location.hash as fallback
  if (window.location.hash) {
    const hash = window.location.hash.replace(/^#\/?/, '').trim();
    if (hash.startsWith('album/')) {
      albumQuery = hash.replace(/^album\//, '');
    } else if (hash.startsWith('view/')) {
      const val = hash.replace(/^view\//, '');
      if (/\.(mp4|mov|mkv|webm|avi|jpg|jpeg|png|webp|gif|avif)$/i.test(val)) {
        mediaQuery = val;
      } else {
        albumQuery = val;
        mediaQuery = val;
      }
    } else if (hash.includes('=')) {
      const hashParams = new URLSearchParams(hash);
      if (!albumQuery) albumQuery = hashParams.get('album');
      if (!mediaQuery) mediaQuery = hashParams.get('media') || hashParams.get('item') || hashParams.get('view');
      if (!sortQuery) sortQuery = hashParams.get('sort');
      if (!rawTab) rawTab = hashParams.get('tab') || hashParams.get('filter');
    } else if (hash) {
      if (/\.(mp4|mov|mkv|webm|jpg|jpeg|png|webp|gif|avif)$/i.test(hash)) {
        if (!mediaQuery) mediaQuery = hash;
      } else if (!albumQuery) {
        albumQuery = hash;
      }
    }
  }

  let tabQuery: 'all' | 'clips' | 'images' | 'shorts' | null = null;
  if (rawTab) {
    const lower = rawTab.toLowerCase().trim();
    if (lower === 'videos' || lower === 'clips' || lower === 'video') {
      tabQuery = 'clips';
    } else if (lower === 'photos' || lower === 'images' || lower === 'image' || lower === 'photographs') {
      tabQuery = 'images';
    } else if (lower === 'shorts' || lower === 'reels' || lower === 'short') {
      tabQuery = 'shorts';
    } else if (lower === 'all' || lower === 'home') {
      tabQuery = 'all';
    }
  }

  return {
    albumQuery: albumQuery ? decodeURIComponent(albumQuery) : null,
    mediaQuery: mediaQuery ? decodeURIComponent(mediaQuery) : null,
    sortQuery: sortQuery ? decodeURIComponent(sortQuery) : null,
    tabQuery,
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
 * Finds a matching folder entry from Video/Photo Vault folders using slug, name, or ID.
 */
export function findMatchingFolder(
  folders: MediaFolderEntry[],
  query: string | null
): { folder: MediaFolderEntry; index: number } | null {
  if (!query || !folders || folders.length === 0) return null;

  const rawQuery = decodeURIComponent(query).trim().toLowerCase();
  const slugQuery = rawQuery.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  let idx = folders.findIndex((f) => {
    const slug = f.slug || getAlbumSlug(f.name);
    const idSlug = getAlbumSlug(f.id);
    const pathSlug = f.folderPath ? getAlbumSlug(f.folderPath) : '';
    const leafSlug = f.folderPath ? getAlbumSlug(f.folderPath.split('/').pop() || '') : '';
    return slug === slugQuery || idSlug === slugQuery || pathSlug === slugQuery || leafSlug === slugQuery;
  });
  if (idx !== -1) return { folder: folders[idx], index: idx };

  idx = folders.findIndex((f) => {
    const nameMatch = f.name.toLowerCase() === rawQuery;
    const idMatch = f.id.toLowerCase() === rawQuery;
    const pathMatch = f.folderPath ? f.folderPath.toLowerCase() === rawQuery : false;
    const leafMatch = f.folderPath ? (f.folderPath.split('/').pop() || '').toLowerCase() === rawQuery : false;
    return nameMatch || idMatch || pathMatch || leafMatch;
  });
  if (idx !== -1) return { folder: folders[idx], index: idx };

  idx = folders.findIndex((f) => {
    const nameSub = f.name.toLowerCase().includes(rawQuery);
    const pathSub = f.folderPath ? f.folderPath.toLowerCase().includes(rawQuery) : false;
    return nameSub || pathSub;
  });
  if (idx !== -1) return { folder: folders[idx], index: idx };

  return null;
}

/**
 * Finds a matching media item inside an album or full media pool using ID, filename, stem, title, or index.
 */
export function findMatchingMediaItem(
  items: StageMediaItem[],
  query: string | null
): { item: StageMediaItem; index: number } | null {
  if (!query || !items || items.length === 0) return null;

  let rawQuery = query.trim().toLowerCase();
  try {
    rawQuery = decodeURIComponent(rawQuery).trim().toLowerCase();
  } catch {
    // keep rawQuery
  }
  const queryStem = rawQuery.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
  const slugQuery = rawQuery.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const getCandidateFilenamesAndStems = (it: StageMediaItem) => {
    const rawNames: string[] = [];
    if (it.name) rawNames.push(it.name);
    if (it.path) rawNames.push(it.path.split('/').pop() || it.path);
    if (it.url) {
      const u = it.url.split('?')[0].split('#')[0].split('/').pop() || '';
      rawNames.push(u);
      try {
        rawNames.push(decodeURIComponent(u));
      } catch {
        // ignore
      }
    }
    if (it.id) {
      rawNames.push(it.id);
      rawNames.push(it.id.split('/').pop() || '');
    }

    const filenames: string[] = [];
    const stems: string[] = [];

    for (const name of rawNames) {
      if (!name) continue;
      const lower = name.toLowerCase().trim();
      filenames.push(lower);
      const stem = lower.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
      if (stem) stems.push(stem);
    }

    return { filenames, stems };
  };

  // 1. Match by exact ID or URL
  let idx = items.findIndex((it) => {
    if (!it) return false;
    const idLower = (it.id || '').toLowerCase().trim();
    const urlLower = (it.url || '').toLowerCase().trim();
    const pathLower = (it.path || '').toLowerCase().trim();
    return idLower === rawQuery || urlLower === rawQuery || pathLower === rawQuery;
  });
  if (idx !== -1) return { item: items[idx], index: idx };

  // 2. Match by exact filename with extension
  idx = items.findIndex((it) => {
    const { filenames } = getCandidateFilenamesAndStems(it);
    return filenames.some((fn) => fn === rawQuery || fn.replace(/\s+/g, '') === rawQuery.replace(/\s+/g, ''));
  });
  if (idx !== -1) return { item: items[idx], index: idx };

  // 3. Match by filename stem without extension
  idx = items.findIndex((it) => {
    const { stems } = getCandidateFilenamesAndStems(it);
    return stems.some((st) => st === queryStem || st.replace(/\s+/g, '') === queryStem.replace(/\s+/g, ''));
  });
  if (idx !== -1) return { item: items[idx], index: idx };

  // 4. Match by title
  idx = items.findIndex((it) => {
    const t = (it.title || '').toLowerCase().replace(/[-_]+/g, ' ').trim();
    return t && (t === queryStem || t === rawQuery || t.replace(/\s+/g, '') === queryStem.replace(/\s+/g, ''));
  });
  if (idx !== -1) return { item: items[idx], index: idx };

  // 5. Match by title/filename slug
  idx = items.findIndex((it) => {
    const s = (it.title || it.name || it.id || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return s && s === slugQuery;
  });
  if (idx !== -1) return { item: items[idx], index: idx };

  // 6. Match by computed media slug
  idx = items.findIndex((it) => {
    let mediaSlug = '';
    try {
      mediaSlug = decodeURIComponent(getMediaSlug(it)).toLowerCase();
    } catch {
      mediaSlug = getMediaSlug(it).toLowerCase();
    }
    const mediaSlugClean = mediaSlug.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return mediaSlug === rawQuery || mediaSlugClean === slugQuery;
  });
  if (idx !== -1) return { item: items[idx], index: idx };

  // 7. Substring / word boundary title match (e.g., queryStem matches word in title)
  idx = items.findIndex((it) => {
    const t = (it.title || '').toLowerCase().trim();
    if (!t || !queryStem || queryStem.length < 3) return false;
    const words = t.split(/\s+/);
    return words.includes(queryStem);
  });
  if (idx !== -1) return { item: items[idx], index: idx };

  // 8. Numeric index fallback (e.g. ?media=0)
  if (/^\d+$/.test(rawQuery)) {
    const num = parseInt(rawQuery, 10);
    if (num >= 0 && num < items.length) {
      return { item: items[num], index: num };
    }
  }

  return null;
}

export interface SyncUrlStateOptions {
  album?: AlbumData | MediaFolderEntry | string | null;
  mediaItem?: StageMediaItem | null;
  sort?: SortOrder;
  replace?: boolean;
}

/**
 * Synchronizes browser URL search parameters without full page reload.
 */
export function syncUrlState({ album, mediaItem, sort, replace = true }: SyncUrlStateOptions): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const searchParams = url.searchParams;

  if (sort && sort !== 'newest') {
    searchParams.set('sort', sort);
  } else {
    searchParams.delete('sort');
  }

  if (album) {
    const albumSlug = typeof album === 'string' ? getAlbumSlug(album) : getAlbumSlug(album.name);
    searchParams.set('album', albumSlug);
    setStoredLastActiveAlbum(albumSlug);

    if (mediaItem) {
      const mediaSlug = getMediaSlug(mediaItem);
      searchParams.set('media', mediaSlug);
    } else {
      searchParams.delete('media');
      searchParams.delete('item');
      searchParams.delete('view');
    }
  } else if (mediaItem) {
    searchParams.delete('album');
    const mediaSlug = getMediaSlug(mediaItem);
    searchParams.set('media', mediaSlug);
  } else {
    // Reset home
    searchParams.delete('album');
    searchParams.delete('media');
    searchParams.delete('item');
    searchParams.delete('view');
    url.hash = '';
    removeStoredLastActiveAlbum();
  }

  const queryPart = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const newUrl = `${url.pathname}${queryPart}${url.hash}`;
  const currentFull = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (newUrl !== currentFull) {
    const stateObj = {
      album: typeof album === 'string' ? album : album?.name,
      media: mediaItem?.id,
    };
    if (replace) {
      window.history.replaceState(stateObj, '', newUrl);
    } else {
      window.history.pushState(stateObj, '', newUrl);
    }
  }
}

/**
 * Creates a clean, shareable deep-link for an album.
 */
export function createShareableAlbumUrl(albumNameOrSlug: string): string {
  if (typeof window === 'undefined') return '';
  const slug = getAlbumSlug(albumNameOrSlug);
  return `${window.location.origin}${window.location.pathname}#/album/${slug}`;
}

/**
 * Creates a clean, shareable deep-link for an individual media item.
 */
export function createShareableMediaUrl(item: StageMediaItem | string, albumName?: string): string {
  if (typeof window === 'undefined') return '';
  const mediaSlug = getMediaSlug(item);
  const url = new URL(window.location.origin + window.location.pathname);
  if (albumName) {
    url.searchParams.set('album', getAlbumSlug(albumName));
  }
  url.searchParams.set('media', mediaSlug);
  return url.toString();
}

/**
 * Copy text to clipboard with modern API and reliable execCommand fallback.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    textArea.remove();
    return successful;
  } catch {
    return false;
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

