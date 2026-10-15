import type { HfMediaCatalog, StageMediaItem, MediaFolderEntry } from '../types';
import { getMediaUrl } from './imageUrlResolver';
import {
  isHiddenOrSystemPath,
  isHiddenOrSystemFolder,
  isExcludedAlbum,
  isThumbnailFile,
} from './mediaTypeDetector';
import { getItemTimestamp } from './albumExtractor';

export interface VaultFeedData {
  latestReleases: StageMediaItem[];
  shorts: StageMediaItem[];
  videoVaultFolders: MediaFolderEntry[];
  photoVaultFolders: MediaFolderEntry[];
}

function cleanTitleFromPath(path: string): string {
  const file = path.split('/').pop() || path;
  return file
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b(smartselect|videocapture|screenshot)\b/gi, '')
    .trim() || 'Media Item';
}

function formatFolderName(raw: string): string {
  const decoded = decodeURIComponent(raw).trim();
  // Format standard folders nicely
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
  // Capitalize words
  return decoded
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function organizeVaultFeed(catalog: HfMediaCatalog | null | undefined): VaultFeedData {
  if (!catalog) {
    return {
      latestReleases: [],
      shorts: [],
      videoVaultFolders: [],
      photoVaultFolders: [],
    };
  }

  const clipsRaw = catalog.clips || [];
  const shortsRaw = catalog.shorts || [];
  const imagesRaw = catalog.images || [];

  // 1. Process Shorts
  const shortsItems: StageMediaItem[] = shortsRaw
    .filter((it) => {
      const p = it.path || it.name || it.url;
      return !isHiddenOrSystemPath(p) && !isExcludedAlbum(p);
    })
    .map((it) => {
      const p = it.path || it.name || it.url;
      const mediaUrl = getMediaUrl(it.url || p);
      const title = cleanTitleFromPath(p);
      return {
        id: `short-${p.replace(/[/\\.]+/g, '-')}`,
        title,
        name: title,
        url: mediaUrl,
        thumbnail: it.poster ? getMediaUrl(it.poster) : mediaUrl,
        poster: it.poster ? getMediaUrl(it.poster) : undefined,
        category: 'Shorts & Reels',
        type: 'video' as const,
        date: getItemTimestamp(it),
        lastCommit: it.lastCommit,
      };
    })
    .sort((a, b) => (b.date || 0) - (a.date || 0));

  // 2. Process Clips into Dynamic Folders
  const clipFolderMap = new Map<string, StageMediaItem[]>();
  for (const it of clipsRaw) {
    const p = it.path || it.name || it.url;
    if (isHiddenOrSystemPath(p) || isExcludedAlbum(p)) continue;
    const parts = p.replace(/\\/g, '/').split('/');
    let subfolder = 'Featured Videos';
    if (parts.length >= 2 && parts[0].toLowerCase() === 'clips') {
      subfolder = parts[1];
    } else if (parts.length >= 2) {
      subfolder = parts[0];
    }
    if (isHiddenOrSystemFolder(subfolder) || isExcludedAlbum(subfolder)) continue;

    const mediaUrl = getMediaUrl(it.url || p);
    const title = cleanTitleFromPath(p);
    const item: StageMediaItem = {
      id: `clip-${p.replace(/[/\\.]+/g, '-')}`,
      title,
      name: title,
      url: mediaUrl,
      thumbnail: it.poster ? getMediaUrl(it.poster) : mediaUrl,
      poster: it.poster ? getMediaUrl(it.poster) : undefined,
      category: formatFolderName(subfolder),
      type: 'video',
      date: getItemTimestamp(it),
      lastCommit: it.lastCommit,
    };

    const list = clipFolderMap.get(subfolder) || [];
    list.push(item);
    clipFolderMap.set(subfolder, list);
  }

  // Desired order for Video Vault folders
  const videoOrder = ['h2027', 'h2026', 'h2025', 'favorite', 'others'];
  const videoVaultFolders: MediaFolderEntry[] = Array.from(clipFolderMap.entries())
    .map(([rawSubfolder, items]) => ({
      id: `folder-video-${rawSubfolder.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: formatFolderName(rawSubfolder),
      type: 'video' as const,
      count: items.length,
      items: items.sort((a, b) => (b.date || 0) - (a.date || 0)),
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
    const parts = p.replace(/\\/g, '/').split('/');
    let subfolder = 'Featured Photography';
    if (parts.length >= 2 && parts[0].toLowerCase() === 'images') {
      subfolder = parts[1];
    } else if (parts.length >= 2) {
      subfolder = parts[0];
    }
    if (isHiddenOrSystemFolder(subfolder) || isExcludedAlbum(subfolder)) continue;

    const mediaUrl = getMediaUrl(it.url || p);
    const title = cleanTitleFromPath(p);
    const item: StageMediaItem = {
      id: `photo-${p.replace(/[/\\.]+/g, '-')}`,
      title,
      name: title,
      url: mediaUrl,
      thumbnail: mediaUrl,
      poster: mediaUrl,
      category: formatFolderName(subfolder),
      type: 'image',
      date: getItemTimestamp(it),
      lastCommit: it.lastCommit,
    };

    const list = imageFolderMap.get(subfolder) || [];
    list.push(item);
    imageFolderMap.set(subfolder, list);
  }

  // Desired order for Photo Vault folders
  const photoOrder = ['works', 'bandhobis', 'h2027', 'h2026', 'h2025', 'classic'];
  const photoVaultFolders: MediaFolderEntry[] = Array.from(imageFolderMap.entries())
    .map(([rawSubfolder, items]) => ({
      id: `folder-photo-${rawSubfolder.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: formatFolderName(rawSubfolder),
      type: 'image' as const,
      count: items.length,
      items: items.sort((a, b) => (b.date || 0) - (a.date || 0)),
    }))
    .sort((a, b) => {
      const idxA = photoOrder.findIndex((k) => a.name.toLowerCase().includes(k));
      const idxB = photoOrder.findIndex((k) => b.name.toLowerCase().includes(k));
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

  // 4. Unified Latest Releases: Top 20 newest items aggregated from ALL folders
  const allMediaPool: StageMediaItem[] = [];
  const seenUrls = new Set<string>();

  const addToPool = (it: StageMediaItem) => {
    if (!it.url || seenUrls.has(it.url)) return;
    seenUrls.add(it.url);
    allMediaPool.push(it);
  };

  shortsItems.forEach(addToPool);
  videoVaultFolders.forEach((f) => f.items.forEach(addToPool));
  photoVaultFolders.forEach((f) => f.items.forEach(addToPool));

  const latestReleases = allMediaPool
    .sort((a, b) => (b.date || 0) - (a.date || 0))
    .slice(0, 20);

  return {
    latestReleases,
    shorts: shortsItems,
    videoVaultFolders,
    photoVaultFolders,
  };
}
