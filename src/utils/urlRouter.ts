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
  const idQuery = searchParams.get('id') || searchParams.get('p');
  let albumQuery = searchParams.get('album');
  let mediaQuery = searchParams.get('media') || searchParams.get('item') || searchParams.get('view') || searchParams.get('v');
  if (idQuery) {
    if (!mediaQuery && (/^[a-zA-Z0-9_-]{11}$/.test(idQuery) || idQuery.includes('.') || idQuery.startsWith('aishwarya-') || idQuery.includes('-'))) {
      mediaQuery = idQuery;
    } else if (!albumQuery) {
      albumQuery = idQuery;
    }
  }
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

  const safeDecode = (val: string | null | undefined): string | null => {
    if (!val) return null;
    try {
      return decodeURIComponent(val);
    } catch {
      return val;
    }
  };

  return {
    albumQuery: safeDecode(albumQuery),
    mediaQuery: safeDecode(mediaQuery),
    sortQuery: safeDecode(sortQuery),
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

  const clean = (s?: string | null) => (s || '').toLowerCase().replace(/[-_\s.]/g, '');

  let rawQuery = query.trim().toLowerCase();
  try {
    rawQuery = decodeURIComponent(rawQuery.replace(/\+/g, ' ')).trim().toLowerCase();
  } catch {
    // keep rawQuery if malformed
  }
  const cleanTarget = clean(rawQuery);
  const slugQuery = rawQuery.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  // 1. Loose normalization: hyphens, underscores, spaces, and case differences match
  // clean(albumParam) === clean(folder.name)
  let idx = albums.findIndex((a) => {
    if (!a) return false;
    return (
      clean(a.name) === cleanTarget ||
      clean(getAlbumSlug(a.name)) === cleanTarget ||
      clean(a.id) === cleanTarget
    );
  });
  if (idx !== -1) return { album: albums[idx], index: idx };

  // 2. Match by exact or lowercased name or slug
  idx = albums.findIndex((a) => a.name.toLowerCase() === rawQuery || getAlbumSlug(a.name) === slugQuery);
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
 * Uses loose normalization so hyphens, underscores, spaces, and case differences match cleanly.
 */
export function findMatchingFolder(
  folders: MediaFolderEntry[],
  query: string | null
): { folder: MediaFolderEntry; index: number } | null {
  if (!query || !folders || folders.length === 0) return null;

  const clean = (s?: string | null) => (s || '').toLowerCase().replace(/[-_\s.]/g, '');

  let rawQuery = query.trim().toLowerCase();
  try {
    rawQuery = decodeURIComponent(rawQuery.replace(/\+/g, ' ')).trim().toLowerCase();
  } catch {
    // keep rawQuery if malformed
  }
  const cleanTarget = clean(rawQuery);
  const slugQuery = rawQuery.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  // 1. Loose normalization matching: hyphens, underscores, spaces, and case
  // e.g. clean(albumParam) === clean(folder.name) ("shorts-classic" -> "Shorts Classic")
  let idx = folders.findIndex((f) => {
    if (!f) return false;
    const cleanName = clean(f.name);
    const cleanLeaf = clean(f.folderPath ? f.folderPath.split('/').pop() : '');
    const cleanSlug = clean(f.slug);
    const cleanId = clean(f.id);
    const cleanPath = clean(f.folderPath);
    return (
      cleanName === cleanTarget ||
      cleanLeaf === cleanTarget ||
      cleanSlug === cleanTarget ||
      cleanId === cleanTarget ||
      cleanPath === cleanTarget ||
      (cleanPath.length > cleanTarget.length && cleanPath.endsWith(cleanTarget))
    );
  });
  if (idx !== -1) return { folder: folders[idx], index: idx };

  // 2. Slug matching
  idx = folders.findIndex((f) => {
    if (!f) return false;
    const slug = f.slug || getAlbumSlug(f.name);
    const idSlug = getAlbumSlug(f.id);
    const pathSlug = f.folderPath ? getAlbumSlug(f.folderPath) : '';
    const leafSlug = f.folderPath ? getAlbumSlug(f.folderPath.split('/').pop() || '') : '';
    return slug === slugQuery || idSlug === slugQuery || pathSlug === slugQuery || leafSlug === slugQuery;
  });
  if (idx !== -1) return { folder: folders[idx], index: idx };

  // 3. Substring matching
  idx = folders.findIndex((f) => {
    if (!f) return false;
    const cleanName = clean(f.name);
    const cleanPath = clean(f.folderPath);
    return cleanName.includes(cleanTarget) || cleanPath.includes(cleanTarget) || cleanTarget.includes(cleanName);
  });
  if (idx !== -1) return { folder: folders[idx], index: idx };

  return null;
}

export const normalizeComparisonString = (s?: string | null): string => {
  if (!s) return '';
  let str = s;
  try {
    str = decodeURIComponent(str.replace(/\+/g, ' '));
  } catch {
    // keep str if malformed
  }
  return str.toLowerCase().replace(/[-_\s.+]/g, '');
};

/**
 * Checks whether a StageMediaItem matches a media query string
 * using case-insensitive, whitespace-insensitive, and slug-normalized matching.
 */
export function isMediaMatch(item: StageMediaItem, mediaParam: string): boolean {
  if (!item || !mediaParam) return false;
  const target = normalizeComparisonString(mediaParam);
  if (!target) return false;

  const rawCandidates: (string | undefined)[] = [
    item.name,
    item.title,
    item.id,
    item.path,
    item.path ? item.path.split('/').pop() : undefined,
    item.url,
    item.url ? item.url.split('?')[0].split('#')[0].split('/').pop() : undefined,
  ];

  for (const raw of rawCandidates) {
    if (!raw) continue;
    const c = normalizeComparisonString(raw);
    const cNoExt = normalizeComparisonString(raw.replace(/\.[a-z0-9]{2,5}$/i, ''));
    if (c === target || cNoExt === target || c.endsWith(target) || cNoExt.endsWith(target)) return true;
  }
  return false;
}

export interface RecursiveMediaMatchResult {
  matchedItem: StageMediaItem;
  playlist: StageMediaItem[];
  preferredAlbum: string;
  targetIndex: number;
}

/**
 * Recursively traverses all catalog subdirectories and parent folders to locate target media.
 * If album is "shorts" (or any parent folder), recursively traverses all subdirectories under that folder.
 * Populates full playlist from that subfolder (or combined shorts category) and safely falls back.
 */
export function searchCatalogRecursively(
  folders: MediaFolderEntry[],
  allPool: StageMediaItem[],
  shortsPool: StageMediaItem[],
  albumParam: string | null,
  mediaParam: string | null
): RecursiveMediaMatchResult {
  const clean = normalizeComparisonString;
  const cleanAlbum = clean(albumParam || '');
  const cleanMedia = clean(mediaParam || '');

  let matchedItem: StageMediaItem | null = null;
  let matchedFolder: MediaFolderEntry | null = null;

  const isShortsQuery = cleanAlbum === 'shorts' || cleanAlbum === 'reels' || cleanAlbum === 'short' || cleanAlbum.includes('short');

  // 1. If albumParam is provided, resolve folder using loose normalization
  if (albumParam) {
    const directFolderMatch = findMatchingFolder(folders, albumParam);
    if (directFolderMatch) {
      matchedFolder = directFolderMatch.folder;
    }
  }

  // 2. Inside the matched album, resolve mediaParam using clean() normalization
  if (matchedFolder && matchedFolder.items && matchedFolder.items.length > 0) {
    if (cleanMedia) {
      for (const it of matchedFolder.items) {
        if (!it) continue;
        const itClean = clean(it.name || it.title || it.id);
        const itTitle = clean(it.title);
        const itName = clean(it.name);
        const itId = clean(it.id);
        const itPath = clean(it.path ? it.path.split('/').pop() : '');
        const itPathNoExt = clean(it.path ? it.path.split('/').pop()?.replace(/\.[a-z0-9]{2,5}$/i, '') : '');

        if (
          itClean === cleanMedia ||
          itTitle === cleanMedia ||
          itName === cleanMedia ||
          itId === cleanMedia ||
          itPath === cleanMedia ||
          itPathNoExt === cleanMedia ||
          isMediaMatch(it, mediaParam!)
        ) {
          matchedItem = it;
          break;
        }
      }
    }

    // If the resolved album contains items but the specific mediaParam is not found, fallback to items[0]
    if (!matchedItem && matchedFolder.items.length > 0) {
      matchedItem = matchedFolder.items[0];
    }
  }

  // 3. If not matched in direct folder, search through subdirectories and pools
  if (!matchedItem && cleanAlbum) {
    let subfolderNodes: MediaFolderEntry[] = [];
    if (isShortsQuery) {
      subfolderNodes = folders.filter(
        (f) =>
          f.variant === 'shorts' ||
          clean(f.folderPath).includes('short') ||
          clean(f.name).includes('short') ||
          clean(f.slug).includes('short') ||
          f.items.some((it) => it.mediaType === 'short')
      );
    } else {
      subfolderNodes = folders.filter(
        (f) =>
          clean(f.folderPath).includes(cleanAlbum) ||
          clean(f.folderPath?.split('/')[0]) === cleanAlbum ||
          clean(f.name).includes(cleanAlbum) ||
          clean(f.slug).includes(cleanAlbum)
      );
    }

    // Traverse all matching subdirectories to find target media file
    if (cleanMedia) {
      for (const folder of subfolderNodes) {
        for (const it of folder.items) {
          if (it && isMediaMatch(it, mediaParam!)) {
            matchedItem = it;
            matchedFolder = folder;
            break;
          }
        }
        if (matchedItem) break;
      }
    }

    // If not found in those subfolders yet, also check shortsPool if album was shorts
    if (!matchedItem && isShortsQuery && cleanMedia) {
      for (const it of shortsPool) {
        if (it && isMediaMatch(it, mediaParam!)) {
          matchedItem = it;
          matchedFolder = folders.find((f) => f.items.some((x) => x && (x.id === it.id || x.url === it.url))) || null;
          break;
        }
      }
    }
  }

  // 2. If not found under specified album, recursively search through ALL subdirectories
  if (!matchedItem && cleanMedia) {
    for (const folder of folders) {
      for (const it of folder.items) {
        if (it && isMediaMatch(it, mediaParam!)) {
          matchedItem = it;
          matchedFolder = folder;
          break;
        }
      }
      if (matchedItem) break;
    }
  }

  // 3. Search allMediaPool as fallback search
  if (!matchedItem && cleanMedia) {
    for (const it of allPool) {
      if (it && isMediaMatch(it, mediaParam!)) {
        matchedItem = it;
        matchedFolder = folders.find((f) => f.items.some((x) => x && (x.id === it.id || x.url === it.url))) || null;
        break;
      }
    }
  }

  // 4. Safe fallback: if still no match found, fall back to first available video/short item
  if (!matchedItem) {
    if (isShortsQuery) {
      matchedItem =
        (shortsPool && shortsPool.length > 0 ? shortsPool[0] : null) ||
        allPool.find((it) => it && (it.mediaType === 'short' || it.type === 'video')) ||
        (allPool && allPool.length > 0 ? allPool[0] : null) ||
        (folders.length > 0 && folders[0].items.length > 0 ? folders[0].items[0] : null);
    } else {
      matchedItem =
        allPool.find((it) => it && (it.type === 'video' || it.mediaType === 'clip' || it.mediaType === 'short')) ||
        (allPool && allPool.length > 0 ? allPool[0] : null) ||
        (shortsPool && shortsPool.length > 0 ? shortsPool[0] : null) ||
        (folders.length > 0 && folders[0].items.length > 0 ? folders[0].items[0] : null);
    }
  }

  if (matchedItem && !matchedFolder) {
    matchedFolder = folders.find((f) => f.items.some((x) => x && (x.id === matchedItem!.id || x.url === matchedItem!.url))) || null;
  }

  // 5. Populate full swipe playlist:
  // "Once the active short is found, populate the entire swipe playlist with all shorts from that subfolder
  // (or the combined shorts category) so scrolling/swiping down moves to the next short naturally."
  let playlist: StageMediaItem[] = [];
  const isShort = Boolean(
    cleanAlbum === 'shorts' ||
    cleanAlbum === 'reels' ||
    cleanAlbum.includes('short') ||
    matchedItem?.mediaType === 'short' ||
    matchedItem?.category?.toLowerCase().includes('short') ||
    matchedItem?.url?.toLowerCase().includes('/shorts/') ||
    matchedItem?.id?.toLowerCase().includes('shorts') ||
    matchedFolder?.variant === 'shorts' ||
    matchedFolder?.name?.toLowerCase().includes('short')
  );

  if (cleanAlbum === 'shorts' && shortsPool && shortsPool.length > 0) {
    playlist = shortsPool.filter(Boolean);
  } else if (isShort) {
    const folderShorts = (matchedFolder?.items || []).filter((it) => it && (it.mediaType === 'short' || it.type === 'video'));
    if (folderShorts.length > 0) {
      playlist = folderShorts;
    } else if (shortsPool && shortsPool.length > 0) {
      playlist = shortsPool.filter(Boolean);
    } else if (matchedFolder?.items && matchedFolder.items.length > 0) {
      playlist = matchedFolder.items.filter(Boolean);
    } else if (matchedItem) {
      playlist = [matchedItem];
    }
  } else {
    if (matchedFolder?.items && matchedFolder.items.length > 0) {
      playlist = matchedFolder.items.filter(Boolean);
    } else if (matchedItem) {
      playlist = [matchedItem];
    }
  }

  if (playlist.length === 0 && matchedItem) {
    playlist = [matchedItem];
  }

  if (!matchedItem && playlist.length > 0) {
    matchedItem = playlist[0];
  } else if (!matchedItem) {
    const fallback = (shortsPool && shortsPool.length > 0 ? shortsPool[0] : null) || (allPool && allPool.length > 0 ? allPool[0] : null);
    if (fallback) {
      matchedItem = fallback;
      playlist = [fallback];
    }
  }

  let targetIndex = 0;
  if (matchedItem && playlist.length > 0) {
    const idx = playlist.findIndex(
      (it) => it && (it.id === matchedItem!.id || it.url === matchedItem!.url || clean(it.name) === clean(matchedItem!.name))
    );
    targetIndex = idx !== -1 ? idx : 0;
  }

  const preferredAlbum =
    matchedFolder?.name ||
    matchedItem?.category ||
    (isShort ? 'Shorts' : undefined) ||
    albumParam ||
    'Featured';

  return {
    matchedItem: matchedItem || playlist[0],
    playlist,
    preferredAlbum,
    targetIndex,
  };
}

/**
 * Finds a matching media item inside an album or full media pool using ID, filename, stem, title, or index.
 * Normalizes comparison strings (strips hyphens, underscores, spaces, dots) and guarantees a safe fallback.
 */
export function findMatchingMediaItem(
  items: StageMediaItem[],
  query: string | null
): { item: StageMediaItem; index: number } | null {
  if (!items || items.length === 0) return null;
  if (!query) return { item: items[0], index: 0 };

  let rawQuery = query.trim().toLowerCase();
  try {
    rawQuery = decodeURIComponent(rawQuery).trim().toLowerCase();
  } catch {
    // keep rawQuery
  }
  const queryStem = rawQuery.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
  const slugQuery = rawQuery.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const normQuery = normalizeComparisonString(rawQuery);
  const normStem = normalizeComparisonString(queryStem);

  // 0. Loose clean normalization match: clean(item.name || item.title || item.id) === clean(mediaParam)
  const clean = (s?: string | null) => (s || '').toLowerCase().replace(/[-_\s.]/g, '');
  const cleanTarget = clean(rawQuery);
  if (cleanTarget) {
    const cleanIdx = items.findIndex((it) => {
      if (!it) return false;
      return (
        clean(it.name || it.title || it.id) === cleanTarget ||
        clean(it.name) === cleanTarget ||
        clean(it.title) === cleanTarget ||
        clean(it.id) === cleanTarget ||
        clean(it.path ? it.path.split('/').pop()?.replace(/\.[a-z0-9]{2,5}$/i, '') : '') === cleanTarget
      );
    });
    if (cleanIdx !== -1) return { item: items[cleanIdx], index: cleanIdx };
  }

  // 1. Instant normalized match
  const directIdx = items.findIndex((it) => isMediaMatch(it, rawQuery));
  if (directIdx !== -1) return { item: items[directIdx], index: directIdx };

  // 1. Normalized comparison across title, name, ID, path, and URL filename
  if (normQuery) {
    const normIdx = items.findIndex((it) => {
      if (!it) return false;
      const candidates = [
        it.name || '',
        it.title || '',
        it.id || '',
        it.path ? it.path.split('/').pop() || it.path : '',
        it.url ? it.url.split('?')[0].split('#')[0].split('/').pop() || '' : '',
      ];
      return candidates.some((c) => {
        if (!c) return false;
        const nc = normalizeComparisonString(c);
        const ncNoExt = normalizeComparisonString(c.replace(/\.[a-z0-9]{2,5}$/i, ''));
        return nc === normQuery || ncNoExt === normQuery || nc === normStem || ncNoExt === normStem;
      });
    });
    if (normIdx !== -1) return { item: items[normIdx], index: normIdx };
  }

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

  // 9. Safe Fallback: always return index 0 if query didn't match so it NEVER returns null or crashes
  return { item: items[0], index: 0 };
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

/* ==========================================================================
   MICROSOFT-STYLE CONCISE ID ROUTING ENGINE
   Uniform ?id=<ID> links across all hubs, subfolders, celebrities, and media
   ========================================================================== */

export const CELEBRITY_SLUG_MAP: Record<string, string> = {
  // Bangladesh (12)
  porimoni: 'Porimoni',
  mim: 'Bidya Sinha Mim',
  bidyasinha: 'Bidya Sinha Mim',
  bidyasimhamim: 'Bidya Sinha Mim',
  mehazabien: 'Mehazabien Chowdhury',
  mehazabienchowdhury: 'Mehazabien Chowdhury',
  tisha: 'Tanjin Tisha',
  tanjintisha: 'Tanjin Tisha',
  faria: 'Nusraat Faria',
  nusraatfaria: 'Nusraat Faria',
  farin: 'Tasnia Farin',
  tasniafarin: 'Tasnia Farin',
  jaya: 'Jaya Ahsan',
  jayaahsan: 'Jaya Ahsan',
  sabila: 'Sabila Nur',
  sabilanur: 'Sabila Nur',
  puja: 'Puja Cherry',
  pujacherry: 'Puja Cherry',
  apubiswas: 'Apu Biswas',
  apu: 'Apu Biswas',
  bubly: 'Shabnam Bubly',
  shabnambubly: 'Shabnam Bubly',
  keyapayel: 'Keya Payel',
  keya: 'Keya Payel',

  // South India (13)
  samantha: 'Samantha Ruth Prabhu',
  samantharuthprabhu: 'Samantha Ruth Prabhu',
  rashmika: 'Rashmika Mandanna',
  rashmikamandanna: 'Rashmika Mandanna',
  nayanthara: 'Nayanthara',
  trisha: 'Trisha Krishnan',
  trishakrishnan: 'Trisha Krishnan',
  saipallavi: 'Sai Pallavi',
  tamannaah: 'Tamannaah Bhatia',
  tamannaahbhatia: 'Tamannaah Bhatia',
  sreeleela: 'Sreeleela',
  poojahegde: 'Pooja Hegde',
  pooja: 'Pooja Hegde',
  kajalaggarwal: 'Kajal Aggarwal',
  keerthysuresh: 'Keerthy Suresh',
  keerthy: 'Keerthy Suresh',
  anushkashetty: 'Anushka Shetty',
  kalyani: 'Kalyani Priyadarshan',
  kalyanipriyadarshan: 'Kalyani Priyadarshan',
  hansika: 'Hansika Motwani',
  hansikamotwani: 'Hansika Motwani',

  // Bollywood (12)
  deepika: 'Deepika Padukone',
  deepikapadukone: 'Deepika Padukone',
  katrina: 'Katrina Kaif',
  katrinakaif: 'Katrina Kaif',
  alia: 'Alia Bhatt',
  aliabhatt: 'Alia Bhatt',
  kiara: 'Kiara Advani',
  kiaraadvani: 'Kiara Advani',
  shraddha: 'Shraddha Kapoor',
  shraddhakapoor: 'Shraddha Kapoor',
  kriti: 'Kriti Sanon',
  kritisanon: 'Kriti Sanon',
  disha: 'Disha Patani',
  dishapatani: 'Disha Patani',
  kareena: 'Kareena Kapoor',
  kareenakapoor: 'Kareena Kapoor',
  jacqueline: 'Jacqueline Fernandez',
  jacquelinefernandez: 'Jacqueline Fernandez',
  anushka: 'Anushka Sharma',
  anushkasharma: 'Anushka Sharma',
  aishwarya: 'Aishwarya Rai',
  aishwaryarai: 'Aishwarya Rai',
  priyanka: 'Priyanka Chopra',
  priyankachopra: 'Priyanka Chopra',

  // Bhojpuri (4)
  akshara: 'Akshara Singh',
  aksharasingh: 'Akshara Singh',
  monalisa: 'Monalisa (Antara)',
  monalisaofficial: 'Monalisa (Antara)',
  amrapali: 'Amrapali Dubey',
  amrapalidubey: 'Amrapali Dubey',
  kajalraghwani: 'Kajal Raghwani',

  // Pakistan (9)
  mahira: 'Mahira Khan',
  mahirakhan: 'Mahira Khan',
  hania: 'Hania Aamir',
  haniaaamir: 'Hania Aamir',
  yumna: 'Yumna Zaidi',
  yumnazaidi: 'Yumna Zaidi',
  sajal: 'Sajal Aly',
  sajalaly: 'Sajal Aly',
  ayeza: 'Ayeza Khan',
  ayezakhan: 'Ayeza Khan',
  mehwish: 'Mehwish Hayat',
  mehwishhayat: 'Mehwish Hayat',
  iqra: 'Iqra Aziz',
  iqraaziz: 'Iqra Aziz',
  kinza: 'Kinza Hashmi',
  kinzahashmi: 'Kinza Hashmi',
  kubra: 'Kubra Khan',
  kubrakhan: 'Kubra Khan',

  // Additional legacy & international
  sunny: 'Sunny Leone',
  sunnyleone: 'Sunny Leone',
  phoebe: 'Phoebe Tonkin',
  phoebetonkin: 'Phoebe Tonkin',
  michelle: 'Michelle Rodriguez',
  michellerodriguez: 'Michelle Rodriguez',
  scarlett: 'Scarlett Johansson',
  scarlettjohansson: 'Scarlett Johansson',
  gal: 'Gal Gadot',
  galgadot: 'Gal Gadot',
  ana: 'Ana de Armas',
  anadearmas: 'Ana de Armas',
  margot: 'Margot Robbie',
  margotrobbie: 'Margot Robbie',
  sydney: 'Sydney Sweeney',
  sydneysweeney: 'Sydney Sweeney',
  zendaya: 'Zendaya',
};

export function getStarSlug(fullName: string): string {
  if (!fullName) return '';
  const first = fullName.trim().split(/\s+/)[0].toLowerCase();
  return first.replace(/[^a-z0-9]/g, '');
}

export interface AppIdRoute {
  category: 'NEWS' | 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY' | 'CLASSIC' | 'MUSIC' | 'ARCHIVE' | 'YOUTUBE' | 'REALTUBE' | null;
  subfolder: string | null;
  celebrityStar: string | null;
  celebrityTab: 'PORTRAITS' | 'DISPATCHES' | 'REELS' | null;
  videoId: string | null;
  mediaId: string | null;
}

export function parseIdRoute(): AppIdRoute {
  if (typeof window === 'undefined') {
    return {
      category: null,
      subfolder: null,
      celebrityStar: null,
      celebrityTab: null,
      videoId: null,
      mediaId: null,
    };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash.replace(/^#\/?/, '').trim();
  const hashParams = hash.includes('=') ? new URLSearchParams(hash) : null;
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '').trim();

  let rawId = (
    searchParams.get('id') ||
    searchParams.get('p') ||
    searchParams.get('page') ||
    searchParams.get('category') ||
    hashParams?.get('id') ||
    hashParams?.get('p') ||
    ''
  ).trim();

  let videoId = (
    searchParams.get('v') ||
    searchParams.get('video') ||
    hashParams?.get('v') ||
    ''
  ).trim();

  let mediaId = (
    searchParams.get('m') ||
    searchParams.get('media') ||
    searchParams.get('item') ||
    hashParams?.get('m') ||
    hashParams?.get('media') ||
    ''
  ).trim();

  const starParam = (
    searchParams.get('star') ||
    searchParams.get('celebrity') ||
    hashParams?.get('star') ||
    ''
  ).trim();

  const tabParam = (
    searchParams.get('tab') ||
    searchParams.get('view') ||
    hashParams?.get('tab') ||
    ''
  ).trim();

  const subParam = (
    searchParams.get('sub') ||
    searchParams.get('folder') ||
    hashParams?.get('sub') ||
    ''
  ).trim();

  if (!rawId) {
    if (hash && !hash.includes('=')) {
      rawId = hash;
    } else if (path && path !== 'index.html') {
      rawId = path;
    }
  }

  let category: AppIdRoute['category'] = null;
  let celebrityStar: string | null = null;
  let celebrityTab: AppIdRoute['celebrityTab'] = null;

  if (rawId.startsWith('v/')) {
    videoId = rawId.replace(/^v\//, '');
    rawId = '';
  } else if (
    !videoId &&
    rawId &&
    /^[a-zA-Z0-9_-]{11}$/.test(rawId) &&
    !['photography', 'realtubevod'].includes(rawId.toLowerCase())
  ) {
    videoId = rawId;
  }

  if (rawId.startsWith('m/')) {
    mediaId = rawId.replace(/^m\//, '');
    rawId = '';
  }

  const cleanId = rawId.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (['news', 'dispatches', 'feed', 'chronicle'].includes(cleanId)) {
    category = 'NEWS';
    celebrityTab = 'DISPATCHES';
  } else if (['archive', 'home', 'main'].includes(cleanId)) {
    category = 'NEWS';
  } else if (['classic', 'classics', 'retro', 'vintage'].includes(cleanId)) {
    category = 'CLASSIC';
  } else if (['music', 'soundtrack', 'soundtracks', 'songs', 'lounge'].includes(cleanId)) {
    category = 'MUSIC';
  } else if (['reels', 'shorts', 'reelsshorts', 'short', 'reel', 'youtube'].includes(cleanId)) {
    category = 'SHORTS';
  } else if (['videoclips', 'clips', 'clip', 'video', 'videos', 'cinema', 'realtube', 'channel'].includes(cleanId)) {
    category = 'CLIPS';
  } else if (['photographs', 'photo', 'photography', 'photos', 'images'].includes(cleanId)) {
    category = 'PHOTOGRAPHY';
  } else if (['videos', 'cinemareels'].includes(cleanId)) {
    category = 'CLIPS';
    celebrityTab = 'REELS';
  } else if (['portraits'].includes(cleanId)) {
    category = 'PHOTOGRAPHY';
    celebrityTab = 'PORTRAITS';
  } else if (CELEBRITY_SLUG_MAP[cleanId]) {
    category = 'NEWS';
    celebrityStar = CELEBRITY_SLUG_MAP[cleanId];
  } else if (cleanId && !videoId && !mediaId) {
    const matched = Object.keys(CELEBRITY_SLUG_MAP).find(
      (k) => cleanId.startsWith(k) || k.startsWith(cleanId)
    );
    if (matched) {
      category = 'NEWS';
      celebrityStar = CELEBRITY_SLUG_MAP[matched];
    } else if (rawId.length >= 6) {
      mediaId = rawId;
    }
  }

  if (starParam) {
    const cleanStar = starParam.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (CELEBRITY_SLUG_MAP[cleanStar]) {
      celebrityStar = CELEBRITY_SLUG_MAP[cleanStar];
    } else {
      celebrityStar = starParam;
    }
  }

  if (tabParam) {
    const cleanTab = tabParam.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (['photo', 'photos', 'portraits', 'photography', 'images'].includes(cleanTab)) {
      celebrityTab = 'PORTRAITS';
    } else if (['news', 'dispatches', 'articles', 'feed'].includes(cleanTab)) {
      celebrityTab = 'DISPATCHES';
    } else if (['videos', 'reels', 'cinema', 'cinemareels', 'clips'].includes(cleanTab)) {
      celebrityTab = 'REELS';
    }
  }

  return {
    category,
    subfolder: subParam || null,
    celebrityStar,
    celebrityTab,
    videoId: videoId || null,
    mediaId: mediaId || null,
  };
}

export function buildIdUrl(route: Partial<AppIdRoute>): string {
  if (typeof window === 'undefined') return '/';

  if (route.videoId) {
    return `/?id=${encodeURIComponent(route.videoId)}`;
  }

  if (route.mediaId) {
    return `/?id=${encodeURIComponent(route.mediaId)}`;
  }

  if (route.category === 'CLASSIC') {
    return '/?id=classic';
  }
  if (route.category === 'MUSIC') {
    return '/?id=music';
  }
  if (route.category === 'SHORTS' || route.category === 'YOUTUBE') {
    return route.subfolder ? `/?id=shorts&sub=${encodeURIComponent(route.subfolder)}` : '/?id=shorts';
  }
  if (route.category === 'CLIPS' || route.category === 'REALTUBE') {
    return route.subfolder ? `/?id=clips&sub=${encodeURIComponent(route.subfolder)}` : '/?id=clips';
  }
  if (route.category === 'PHOTOGRAPHY') {
    return route.subfolder ? `/?id=photo&sub=${encodeURIComponent(route.subfolder)}` : '/?id=photo';
  }
  if (route.category === 'NEWS') {
    return route.subfolder ? `/?id=news&sub=${encodeURIComponent(route.subfolder)}` : '/?id=news';
  }

  const starSlug = route.celebrityStar ? getStarSlug(route.celebrityStar) : null;
  const tabSlug =
    route.celebrityTab === 'REELS'
      ? 'videos'
      : route.celebrityTab === 'DISPATCHES'
      ? 'news'
      : null;

  if (starSlug && starSlug !== 'all') {
    if (tabSlug) {
      return `/?id=${starSlug}&tab=${tabSlug}`;
    }
    return `/?id=${starSlug}`;
  }

  if (tabSlug) {
    return `/?id=${tabSlug}`;
  }

  return '/';
}

export function syncAppRoute(route: Partial<AppIdRoute>, replace = false): void {
  if (typeof window === 'undefined') return;

  const newUrl = buildIdUrl(route);
  const currentFull = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (newUrl !== currentFull) {
    const stateObj = { route };
    if (replace) {
      window.history.replaceState(stateObj, '', newUrl);
    } else {
      window.history.pushState(stateObj, '', newUrl);
    }
  }
}


