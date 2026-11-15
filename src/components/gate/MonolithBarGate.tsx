import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Folder, Film, Search, Shuffle } from 'lucide-react';
import type { StageMediaItem } from '../../types';
import { MIDNIGHT_OBSIDIAN_THEME } from './themeManager';
import { CinematicBackdropCanvas } from './CinematicBackdropCanvas';
import { MAJOR_FOLDERS } from '../navigation/SidebarAccordionNav';
import { isPhotoExtension } from '../../utils/mediaTypeDetector';
import { sortMediaItemsDescending } from '../../utils/albumExtractor';
import { type DirectoryNode } from '../DeepSpaceTreeExplorer';
import { useBackButton } from '../../utils/backButtonManager';
import { HeaderBrandLogo } from '../updater/HeaderBrandLogo';
import { VaultDrawer } from '../VaultDrawer';
import { hapticMedium, hapticLight } from '../../utils/hapticsManager';
import { trackActivityEvent } from '../../utils/usageTelemetry';
import {
  parseIdRoute,
  getMediaShortId,
  findMediaByShortId,
  parseAppPathname,
  updateBrowserUrl,
} from '../../utils/urlRouter';
import { MediaNotFoundDialog } from '../common/MediaNotFoundDialog';
import { FALLBACK_HF_CATALOG } from '../../data/fallbackData';
import { LivingMediaCard } from './LivingMediaCard';
import { SectorRadarRail } from './SectorRadarRail';
import { SectorTelemetryDivider } from './SectorTelemetryDivider';
import { SpotlightCarouselRow } from './SpotlightCarouselRow';
import { QuickSearchModal } from '../QuickSearchModal';

export interface MonolithBarGateProps {
  items: StageMediaItem[];
  onOpenPhoto: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo: (item: StageMediaItem, playlist: StageMediaItem[]) => void;
  onOpenShort: (item: StageMediaItem, shorts: StageMediaItem[], index: number, folderName?: string) => void;
  onOpenSearch?: () => void;
  initialAlbum?: string;
  isModalOpen?: boolean;
}

function getFolderSegments(item: StageMediaItem): { root: string; subfolders: string[] } {
  const raw = item.path || item.parentAlbum || item.category || '';
  let clean = raw.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (clean.includes('://')) {
    clean = clean.split('://')[1].split('/').slice(1).join('/');
  }
  const parts = clean.split('/').map((s) => s.trim()).filter(Boolean);
  const hasExt = parts.length > 0 && /\.[a-z0-9]{2,5}$/i.test(parts[parts.length - 1]);
  const dirParts = hasExt ? parts.slice(0, -1) : parts;

  let root = dirParts.length > 0 ? dirParts[0] : '';
  let sub = dirParts.slice(1);

  if (/^(?:video\s*clips|clips)$/i.test(root)) {
    root = 'Clips';
  } else if (/^(?:photographs|images|photography)$/i.test(root)) {
    root = 'Images';
  } else if (/^(?:reels\/shorts|shorts|reels)$/i.test(root)) {
    root = 'Shorts';
  } else if (/^realtube$/i.test(root)) {
    if (item.mediaType === 'short' || item.category?.toLowerCase().includes('short') || item.url?.toLowerCase().includes('short') || clean.toLowerCase().includes('short')) {
      root = 'Shorts';
      sub = dirParts.length > 1 ? [dirParts[1]] : ['REALTube Shorts'];
    } else if (item.type === 'image' || isPhotoExtension(item.url || item.name)) {
      root = 'Images';
      sub = dirParts.length > 1 ? [dirParts[1]] : ['REALTube Images'];
    } else {
      root = 'Clips';
      sub = dirParts.length > 1 ? [dirParts[1]] : ['REALTube Video Clips'];
    }
  } else {
    if (item.mediaType === 'short' || item.category?.toLowerCase().includes('short') || item.url?.toLowerCase().includes('short')) {
      root = 'Shorts';
      sub = dirParts.length > 0 ? dirParts : ['Shorts 2027'];
    } else if (item.type === 'image' || isPhotoExtension(item.url || item.name)) {
      root = 'Images';
      sub = dirParts.length > 0 ? dirParts : ['Images 2027'];
    } else {
      root = 'Clips';
      sub = dirParts.length > 0 ? dirParts : ['Clips 2027'];
    }
  }

  if (sub.length === 0) {
    if (root === 'Shorts') sub = ['Shorts 2027'];
    else if (root === 'Images') sub = ['Images 2027'];
    else sub = ['Clips 2027'];
  }

  return { root, subfolders: sub };
}

export const MonolithBarGate: React.FC<MonolithBarGateProps> = ({
  items,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
  initialAlbum,
  isModalOpen = false,
}) => {
  // 0. Parse initial route from short ID URL (?id=..., ?v=..., ?star=..., etc.)
  const initialRoute = useMemo(() => parseIdRoute(), []);

  // Navigation states:
  // 3 Core Categories in strict SVP sequence: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY'
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    if (typeof window === 'undefined') return 'SHORTS';
    const parsed = parseAppPathname();
    if (parsed.tab === 'CLIPS' || parsed.tab === 'PHOTOGRAPHY') {
      return parsed.tab;
    }
    return 'SHORTS';
  });
  const [_activeVideoId, setActiveVideoId] = useState<string | null>(initialRoute.videoId);

  // Individual section subfolder filters
  const [shortsSubfolder, setShortsSubfolder] = useState<string>('ALL');
  const [clipsSubfolder, setClipsSubfolder] = useState<string>('ALL');
  const [photosSubfolder, setPhotosSubfolder] = useState<string>('ALL');

  // Progressive batch visibility for each section
  const [visibleShorts, setVisibleShorts] = useState<number>(24);
  const [visibleClips, setVisibleClips] = useState<number>(24);
  const [visiblePhotos, setVisiblePhotos] = useState<number>(24);

  // 404 Media / Route Not Found Dialog State
  const [notFoundInfo, setNotFoundInfo] = useState<{
    isOpen: boolean;
    path: string;
    tab?: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY' | 'TRAILER';
  }>({
    isOpen: false,
    path: '',
    tab: 'TRAILER',
  });

  // Universal Command Palette / Fast-Find Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Keyboard shortcut listener for Ctrl+K, Cmd+K, or /
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      } else if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Synchronize state when browser Back / Forward (popstate) is clicked
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseAppPathname();
      setSelectedCategory(parsed.tab);
      setActiveVideoId(parsed.shortId);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // When modals close, clear videoId/mediaId in URL and restore current page route
  const prevModalOpen = useRef(isModalOpen);
  useEffect(() => {
    if (prevModalOpen.current && !isModalOpen) {
      setActiveVideoId(null);
      const targetPath =
        selectedCategory === 'SHORTS' ? '/shorts'
        : selectedCategory === 'CLIPS' || selectedCategory === 'REALTUBE' ? '/clips'
        : selectedCategory === 'PHOTOGRAPHY' ? '/photographs'
        : '/';
      updateBrowserUrl(targetPath, true);
    }
    prevModalOpen.current = isModalOpen;
  }, [isModalOpen, selectedCategory]);

  // Concealed Option A Terminal Drawer State
  const [isVaultDrawerOpen, setVaultDrawerOpen] = useState(false);

  // Group media into hierarchical directory nodes
  const rootMap = useMemo(() => {
    const map = new Map<string, DirectoryNode>();
    for (const folder of MAJOR_FOLDERS) {
      map.set(folder.rawName, {
        name: folder.rawName,
        fullPath: folder.rawName,
        subfolders: new Map(),
        files: [],
      });
    }

    if (!items || items.length === 0) return map;

    for (const item of items) {
      const { root, subfolders } = getFolderSegments(item);
      const rootNode = map.get(root);
      if (!rootNode) continue;

      // Store in rootNode so rootNode.files holds the complete collection of this category
      rootNode.files.push(item);

      let currentNode = rootNode;
      for (const sub of subfolders) {
        if (!currentNode.subfolders.has(sub)) {
          currentNode.subfolders.set(sub, {
            name: sub,
            fullPath: `${currentNode.fullPath}/${sub}`,
            subfolders: new Map(),
            files: [],
          });
        }
        currentNode = currentNode.subfolders.get(sub)!;
      }
      currentNode.files.push(item);
    }

    // Ensure designated canonical subfolders exist if empty
    const ensureSubfolders = (rootKey: string, defaultNames: string[]) => {
      const node = map.get(rootKey);
      if (!node) return;
      if (node.subfolders.size === 0 && node.files.length > 0) {
        const chunkSize = Math.ceil(node.files.length / defaultNames.length);
        defaultNames.forEach((name, i) => {
          const slice = node.files.slice(i * chunkSize, (i + 1) * chunkSize);
          if (slice.length > 0 || i === 0) {
            node.subfolders.set(name, {
              name,
              fullPath: `${node.fullPath}/${name}`,
              subfolders: new Map(),
              files: slice,
            });
          }
        });
      }
    };

    ensureSubfolders('Clips', ['Clips 2027', 'Clips 2026', 'Clips 2025', 'Favorite Video Clips', 'Classic Video Clips', 'REALTube Video Clips']);
    ensureSubfolders('Shorts', ['Shorts 2027', 'Shorts Classic', 'REALTube Shorts']);
    ensureSubfolders('Images', ['Images 2027', 'Images 2026', 'Images 2025', 'Favourite Images', 'Classic Images', 'REALTube Images']);

    // Sort files descending
    for (const rootNode of map.values()) {
      rootNode.files = sortMediaItemsDescending(rootNode.files);
      for (const sub of rootNode.subfolders.values()) {
        sub.files = sortMediaItemsDescending(sub.files);
      }
    }

    return map;
  }, [items]);

  // Memoized collections for DynamicTrailerShowcase with multi-layer resilience
  const trailerShorts = useMemo(() => {
    const fromRoot = rootMap.get('Shorts')?.files || [];
    if (fromRoot.length > 0) return fromRoot;

    const node = rootMap.get('Shorts');
    const fromSubs: StageMediaItem[] = [];
    if (node) {
      for (const sub of node.subfolders.values()) {
        fromSubs.push(...sub.files);
      }
    }
    if (fromSubs.length > 0) return fromSubs;

    const fromItems = (items || []).filter(
      (i) => i.mediaType === 'short' || i.category?.toLowerCase().includes('short') || i.url?.toLowerCase().includes('short')
    );
    if (fromItems.length > 0) return fromItems;

    return ((FALLBACK_HF_CATALOG?.shorts || []) as any[]).map((s) => ({
      ...s,
      type: 'video' as const,
      mediaType: 'short' as const,
      category: 'Shorts',
    })) as StageMediaItem[];
  }, [rootMap, items]);

  const trailerClips = useMemo(() => {
    const fromRoot = rootMap.get('Clips')?.files || [];
    if (fromRoot.length > 0) return fromRoot;

    const node = rootMap.get('Clips');
    const fromSubs: StageMediaItem[] = [];
    if (node) {
      for (const sub of node.subfolders.values()) {
        fromSubs.push(...sub.files);
      }
    }
    if (fromSubs.length > 0) return fromSubs;

    const fromItems = (items || []).filter(
      (i) => (i.type === 'video' || !i.type) && !i.category?.toLowerCase().includes('short') && !i.url?.toLowerCase().includes('short')
    );
    if (fromItems.length > 0) return fromItems;

    return ((FALLBACK_HF_CATALOG?.clips || []) as any[]).map((c) => ({
      ...c,
      type: 'video' as const,
      category: 'Video Clips',
    })) as StageMediaItem[];
  }, [rootMap, items]);

  const trailerImages = useMemo(() => {
    const fromRoot = rootMap.get('Images')?.files || [];
    if (fromRoot.length > 0) return fromRoot;

    const node = rootMap.get('Images');
    const fromSubs: StageMediaItem[] = [];
    if (node) {
      for (const sub of node.subfolders.values()) {
        fromSubs.push(...sub.files);
      }
    }
    if (fromSubs.length > 0) return fromSubs;

    const fromItems = (items || []).filter(
      (i) => i.type === 'image' || isPhotoExtension(i.url || i.name)
    );
    if (fromItems.length > 0) return fromItems;

    return ((FALLBACK_HF_CATALOG?.images || []) as any[]).map((img) => ({
      ...img,
      type: 'image' as const,
      category: 'Photographs',
    })) as StageMediaItem[];
  }, [rootMap, items]);

  // Initial deep link routing support
  useEffect(() => {
    if (!initialAlbum || items.length === 0) return;

    const cleanTarget = initialAlbum.toLowerCase().replace(/[-_\s]+/g, '');
    for (const folder of MAJOR_FOLDERS) {
      if (folder.key.toLowerCase().replace(/[-_\s]+/g, '') === cleanTarget) {
        setSelectedCategory(folder.key);
        return;
      }
      const rootNode = rootMap.get(folder.rawName);
      if (!rootNode) continue;
      for (const sub of rootNode.subfolders.values()) {
        if (sub.name.toLowerCase().replace(/[-_\s]+/g, '') === cleanTarget) {
          setSelectedCategory(folder.key);
          if (folder.key === 'SHORTS') setShortsSubfolder(sub.name);
          else if (folder.key === 'CLIPS') setClipsSubfolder(sub.name);
          else if (folder.key === 'PHOTOGRAPHY') setPhotosSubfolder(sub.name);
          return;
        }
      }
    }
  }, [initialAlbum, items.length, rootMap]);

  // Direct Short ID or Slug URL auto-launch on initial mount
  const hasAutoLaunchedRef = useRef(false);
  useEffect(() => {
    if (hasAutoLaunchedRef.current || !items || items.length === 0) return;

    const parsed = parseAppPathname();

    // 1. If path is an unrecognized root path (e.g. /unknown-page)
    if (parsed.isNotFound) {
      hasAutoLaunchedRef.current = true;
      setNotFoundInfo({ isOpen: true, path: '/' + parsed.rawPath, tab: parsed.tab });
      return;
    }

    // 2. If path has a media short ID (e.g. /shorts/7mK9 or /photographs/v9Q1)
    if (parsed.shortId) {
      hasAutoLaunchedRef.current = true;
      const matched = findMediaByShortId(items, parsed.shortId);
      if (matched) {
        const item = matched.item;
        const isPhoto =
          parsed.tab === 'PHOTOGRAPHY' ||
          item.type === 'image' ||
          isPhotoExtension(item.path || item.url || item.name || '');
        const isShort =
          parsed.tab === 'SHORTS' ||
          item.mediaType === 'short' ||
          item.path?.toLowerCase().includes('short') ||
          item.url?.toLowerCase().includes('short');

        if (isPhoto) {
          setSelectedCategory('PHOTOGRAPHY');
          const photoPool = items.filter(
            (f) => f.type === 'image' || isPhotoExtension(f.path || f.url || f.name || '')
          );
          const idx = photoPool.findIndex((p) => p.id === item.id || p.url === item.url);
          onOpenPhoto(item, photoPool.length > 0 ? photoPool : [item], idx >= 0 ? idx : 0);
        } else if (isShort) {
          setSelectedCategory('SHORTS');
          const shortPool = items.filter(
            (f) =>
              f.mediaType === 'short' ||
              f.path?.toLowerCase().includes('short') ||
              f.url?.toLowerCase().includes('short')
          );
          const idx = shortPool.findIndex((s) => s.id === item.id || s.url === item.url);
          onOpenShort(item, shortPool.length > 0 ? shortPool : [item], idx >= 0 ? idx : 0);
        } else {
          setSelectedCategory('CLIPS');
          onOpenVideo(item, [item]);
        }
      } else {
        // Short ID not found in library -> Show animated Not Found modal!
        setNotFoundInfo({ isOpen: true, path: '/' + parsed.rawPath, tab: parsed.tab });
      }
      return;
    }

    // 3. Fallback: check legacy query params
    if (initialRoute.mediaId) {
      const matchedLegacy = items.find(
        (it) => it.id === initialRoute.mediaId || (it.url && it.url.includes(initialRoute.mediaId!))
      );
      if (matchedLegacy) {
        hasAutoLaunchedRef.current = true;
        onOpenPhoto(matchedLegacy, [matchedLegacy], 0);
      }
    }
  }, [items, onOpenPhoto, onOpenShort, onOpenVideo, initialRoute]);

  // Active Category Root Node
  // Shorts collection
  const allShortsFiles = useMemo(() => {
    const node = rootMap.get('Shorts');
    if (!node) return trailerShorts;
    const set = new Set<string>();
    const list: StageMediaItem[] = [];
    for (const f of node.files) {
      const key = f.id || f.url || f.path || f.name;
      if (key && !set.has(key)) { set.add(key); list.push(f); }
    }
    for (const sub of node.subfolders.values()) {
      for (const f of sub.files) {
        const key = f.id || f.url || f.path || f.name;
        if (key && !set.has(key)) { set.add(key); list.push(f); }
      }
    }
    return list.length > 0 ? sortMediaItemsDescending(list) : trailerShorts;
  }, [rootMap, trailerShorts]);

  const activeShortsList = useMemo(() => {
    if (shortsSubfolder === 'ALL') return allShortsFiles;
    const node = rootMap.get('Shorts');
    const sub = node?.subfolders.get(shortsSubfolder);
    return sub && sub.files.length > 0 ? sub.files : allShortsFiles;
  }, [allShortsFiles, shortsSubfolder, rootMap]);

  // Clips collection
  const allClipsFiles = useMemo(() => {
    const node = rootMap.get('Clips');
    if (!node) return trailerClips;
    const set = new Set<string>();
    const list: StageMediaItem[] = [];
    for (const f of node.files) {
      const key = f.id || f.url || f.path || f.name;
      if (key && !set.has(key)) { set.add(key); list.push(f); }
    }
    for (const sub of node.subfolders.values()) {
      for (const f of sub.files) {
        const key = f.id || f.url || f.path || f.name;
        if (key && !set.has(key)) { set.add(key); list.push(f); }
      }
    }
    return list.length > 0 ? sortMediaItemsDescending(list) : trailerClips;
  }, [rootMap, trailerClips]);

  const activeClipsList = useMemo(() => {
    if (clipsSubfolder === 'ALL') return allClipsFiles;
    const node = rootMap.get('Clips');
    const sub = node?.subfolders.get(clipsSubfolder);
    return sub && sub.files.length > 0 ? sub.files : allClipsFiles;
  }, [allClipsFiles, clipsSubfolder, rootMap]);

  // Photographs collection
  const allPhotosFiles = useMemo(() => {
    const node = rootMap.get('Images');
    if (!node) return trailerImages;
    const set = new Set<string>();
    const list: StageMediaItem[] = [];
    for (const f of node.files) {
      const key = f.id || f.url || f.path || f.name;
      if (key && !set.has(key)) { set.add(key); list.push(f); }
    }
    for (const sub of node.subfolders.values()) {
      for (const f of sub.files) {
        const key = f.id || f.url || f.path || f.name;
        if (key && !set.has(key)) { set.add(key); list.push(f); }
      }
    }
    return list.length > 0 ? sortMediaItemsDescending(list) : trailerImages;
  }, [rootMap, trailerImages]);

  const activePhotosList = useMemo(() => {
    if (photosSubfolder === 'ALL') return allPhotosFiles;
    const node = rootMap.get('Images');
    const sub = node?.subfolders.get(photosSubfolder);
    return sub && sub.files.length > 0 ? sub.files : allPhotosFiles;
  }, [allPhotosFiles, photosSubfolder, rootMap]);

  // Helper to extract clean subfolder badge for each card
  const getItemSubfolderLabel = useCallback(
    (item: StageMediaItem): string => {
      const { subfolders } = getFolderSegments(item);
      return subfolders[0] || (item.type === 'image' ? 'Images' : item.mediaType === 'short' ? 'Shorts' : 'Clips');
    },
    []
  );

  // Handler to open item from media grid
  const handleOpenItem = (item: StageMediaItem, _idx: number) => {
    trackActivityEvent(1);
    try {
      const STORAGE_KEY = 'sarwar_media_views_stats_v1';
      const raw = localStorage.getItem(STORAGE_KEY);
      const stats = raw ? JSON.parse(raw) : {};
      const key = item.id || item.url;
      if (!stats[key]) {
        stats[key] = { today: 0, yesterday: 0, total: 0 };
      }
      stats[key].today += 1;
      stats[key].total += 1;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('Failed to update media views:', e);
      }
    }

    const shortId = getMediaShortId(item);

    const isPhoto =
      item.type === 'image' || isPhotoExtension(item.path || item.url || item.name || '');

    if (isPhoto) {
      updateBrowserUrl('/photographs/' + shortId);
      const photoPool = activePhotosList.length > 0 ? activePhotosList : [item];
      const photoIdx = photoPool.findIndex((p) => p.id === item.id || p.url === item.url);
      onOpenPhoto(item, photoPool, photoIdx >= 0 ? photoIdx : 0);
      return;
    }

    const isShort =
      item.mediaType === 'short' ||
      item.path?.toLowerCase().includes('short') ||
      item.url?.toLowerCase().includes('short') ||
      item.category?.toLowerCase().includes('short') ||
      selectedCategory === 'SHORTS';

    if (isShort) {
      updateBrowserUrl('/shorts/' + shortId);
      const shortPool = activeShortsList.length > 0 ? activeShortsList : [item];
      const shortIdx = shortPool.findIndex((s) => s.id === item.id || s.url === item.url);
      onOpenShort(
        item,
        shortPool,
        shortIdx >= 0 ? shortIdx : 0,
        shortsSubfolder !== 'ALL' ? shortsSubfolder : item.category || 'Shorts'
      );
      return;
    }

    const videoPool = activeClipsList.length > 0 ? activeClipsList : [item];
    updateBrowserUrl('/clips/' + shortId);
    onOpenVideo(item, videoPool);
  };

  const scrollToSection = useCallback(
    (targetSection: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY') => {
      setSelectedCategory(targetSection);
      const targetId =
        targetSection === 'SHORTS'
          ? 'section-shorts'
          : targetSection === 'CLIPS'
          ? 'section-clips'
          : 'section-photographs';
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      const targetPath =
        targetSection === 'SHORTS' ? '/shorts' : targetSection === 'CLIPS' ? '/clips' : '/photographs';
      updateBrowserUrl(targetPath, true);
    },
    []
  );

  const handleExitToHome = useCallback(() => {
    scrollToSection('SHORTS');
  }, [scrollToSection]);

  // Drawer Category selection handler: scrolls smoothly to selected section
  const handleSelectDrawerFolder = useCallback(
    (folderId: 'clips' | 'shorts' | 'photography' | 'realtube' | 'youtube', subfolderId?: string) => {
      setVaultDrawerOpen(false);
      let targetSection: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY' = 'SHORTS';
      if (folderId === 'shorts' || folderId === 'youtube') {
        targetSection = 'SHORTS';
        if (subfolderId) setShortsSubfolder(subfolderId);
      } else if (folderId === 'photography') {
        targetSection = 'PHOTOGRAPHY';
        if (subfolderId) setPhotosSubfolder(subfolderId);
      } else {
        targetSection = 'CLIPS';
        if (subfolderId) setClipsSubfolder(subfolderId);
      }
      scrollToSection(targetSection);
    },
    [scrollToSection]
  );

  // Surprise Me // Random Archive Warp
  const handleRandomWarp = useCallback(() => {
    hapticMedium();
    if (!items || items.length === 0) return;
    const randomIndex = Math.floor(Math.random() * items.length);
    const randomItem = items[randomIndex];
    if (!randomItem) return;

    handleOpenItem(randomItem, randomIndex);
  }, [items]);

  // Scroll spy via IntersectionObserver: updates selectedCategory and URL as user scrolls
  useEffect(() => {
    const shortsEl = document.getElementById('section-shorts');
    const clipsEl = document.getElementById('section-clips');
    const photosEl = document.getElementById('section-photographs');
    if (!shortsEl || !clipsEl || !photosEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target.id === 'section-shorts') {
              setSelectedCategory('SHORTS');
              updateBrowserUrl('/shorts', true);
            } else if (entry.target.id === 'section-clips') {
              setSelectedCategory('CLIPS');
              updateBrowserUrl('/clips', true);
            } else if (entry.target.id === 'section-photographs') {
              setSelectedCategory('PHOTOGRAPHY');
              updateBrowserUrl('/photographs', true);
            }
          }
        });
      },
      {
        threshold: 0.25,
        rootMargin: '-10% 0px -40% 0px',
      }
    );

    observer.observe(shortsEl);
    observer.observe(clipsEl);
    observer.observe(photosEl);

    return () => observer.disconnect();
  }, []);

  // Initial deep link scroll on mount
  useEffect(() => {
    const parsed = parseAppPathname();
    if (!parsed.shortId) {
      if (parsed.tab === 'SHORTS') {
        setSelectedCategory('SHORTS');
        setTimeout(() => document.getElementById('section-shorts')?.scrollIntoView({ behavior: 'smooth' }), 200);
      } else if (parsed.tab === 'CLIPS') {
        setSelectedCategory('CLIPS');
        setTimeout(() => document.getElementById('section-clips')?.scrollIntoView({ behavior: 'smooth' }), 200);
      } else if (parsed.tab === 'PHOTOGRAPHY') {
        setSelectedCategory('PHOTOGRAPHY');
        setTimeout(() => document.getElementById('section-photographs')?.scrollIntoView({ behavior: 'smooth' }), 200);
      }
    }
  }, []);

  // Android Native Hardware Back Button handler
  useBackButton(
    useCallback(() => {
      if (isVaultDrawerOpen) {
        setVaultDrawerOpen(false);
        return true;
      }
      return false;
    }, [isVaultDrawerOpen])
  );

  const renderCategorySubfolderBar = (
    category: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY',
    currentSub = 'ALL',
    onSelectSub?: (sub: string) => void,
    compact = false
  ) => {
    let subOptions: { name: string; count: number; isCelebrity?: boolean }[] = [];
    let totalCategoryCount = 0;

    if (category === 'SHORTS') {
      const shortsNode = rootMap.get('Shorts');
      const catalogSubs = shortsNode ? Array.from(shortsNode.subfolders.keys()).filter((s) => s !== 'Celebrity Reels') : [];
      const knownShorts = ['Shorts 2027', 'Shorts Classic', 'REALTube Shorts'];
      const allSubs = Array.from(new Set([...knownShorts, ...catalogSubs]));

      subOptions = allSubs.map((s) => ({
        name: s,
        count: shortsNode?.subfolders.get(s)?.files.length || 0,
      }));

      if (shortsNode) {
        const seen = new Set<string>();
        for (const f of shortsNode.files) {
          const k = f.id || f.url || f.path || f.name;
          if (k && !seen.has(k)) { seen.add(k); totalCategoryCount++; }
        }
        for (const sub of shortsNode.subfolders.values()) {
          for (const f of sub.files) {
            const k = f.id || f.url || f.path || f.name;
            if (k && !seen.has(k)) { seen.add(k); totalCategoryCount++; }
          }
        }
      }
    } else if (category === 'CLIPS') {
      const clipsNode = rootMap.get('Clips');
      const catalogSubs = clipsNode ? Array.from(clipsNode.subfolders.keys()) : [];
      const knownClips = ['Clips 2027', 'Clips 2026', 'Clips 2025', 'Favorite Video Clips', 'Classic Video Clips', 'REALTube Video Clips'];
      const allSubs = Array.from(new Set([...knownClips, ...catalogSubs]));

      subOptions = allSubs.map((s) => ({
        name: s,
        count: clipsNode?.subfolders.get(s)?.files.length || 0,
      }));

      if (clipsNode) {
        const seen = new Set<string>();
        for (const f of clipsNode.files) {
          const k = f.id || f.url || f.path || f.name;
          if (k && !seen.has(k)) { seen.add(k); totalCategoryCount++; }
        }
        for (const sub of clipsNode.subfolders.values()) {
          for (const f of sub.files) {
            const k = f.id || f.url || f.path || f.name;
            if (k && !seen.has(k)) { seen.add(k); totalCategoryCount++; }
          }
        }
      }
    } else if (category === 'PHOTOGRAPHY') {
      const imagesNode = rootMap.get('Images');
      const catalogSubs = imagesNode ? Array.from(imagesNode.subfolders.keys()) : [];
      const knownImages = ['Images 2027', 'Images 2026', 'Images 2025', 'Favourite Images', 'Classic Images', 'REALTube Images'];
      const allSubs = Array.from(new Set([...knownImages, ...catalogSubs]));
      subOptions = allSubs.map((s) => ({
        name: s,
        count: imagesNode?.subfolders.get(s)?.files.length || 0,
      }));

      if (imagesNode) {
        const seen = new Set<string>();
        for (const f of imagesNode.files) {
          const k = f.id || f.url || f.path || f.name;
          if (k && !seen.has(k)) { seen.add(k); totalCategoryCount++; }
        }
        for (const sub of imagesNode.subfolders.values()) {
          for (const f of sub.files) {
            const k = f.id || f.url || f.path || f.name;
            if (k && !seen.has(k)) { seen.add(k); totalCategoryCount++; }
          }
        }
      }
    }

    const fullOptions = [{ name: 'ALL', count: totalCategoryCount }, ...subOptions];
    const currentSubOption = currentSub || 'ALL';

    return (
      <div
        className={`flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 max-w-full ${
          compact ? 'py-0.5' : 'w-full py-2 mb-4 min-h-[46px] border-b border-white/[0.08]'
        }`}
      >
        {fullOptions.map((sub) => {
          const isActive = currentSubOption === sub.name;
          return (
            <button
              key={sub.name}
              type="button"
              onClick={() => {
                hapticMedium();
                if (onSelectSub) onSelectSub(sub.name);
              }}
              className={`flex items-center gap-1.5 ${
                compact ? 'px-3 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs'
              } rounded-full font-mono font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer shrink-0 border ${
                isActive
                  ? 'bg-[#ccff00] text-black border-[#ccff00] shadow-[0_0_12px_rgba(204,255,0,0.35)] font-black'
                  : 'bg-white/[0.03] text-neutral-400 border-white/10 hover:text-white hover:border-white/20'
              }`}
            >
              <span>{sub.name}</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-black text-[#ccff00] font-black' : 'bg-white/10 text-neutral-400'
                }`}
              >
                {sub.count}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="w-screen h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col bg-[#050505] relative select-none font-['Roboto_Condensed'] font-sans text-white"
      style={{
        isolation: 'isolate',
        backgroundColor: '#050505',
      }}
    >
      {/* Permanent Midnight Obsidian Backdrop Canvas */}
      <CinematicBackdropCanvas theme={MIDNIGHT_OBSIDIAN_THEME} isPaused={isModalOpen} />

      {/* Option A: Concealed Left Navigation Drawer */}
      <VaultDrawer
        isOpen={isVaultDrawerOpen}
        onClose={() => setVaultDrawerOpen(false)}
        onSelectFolder={handleSelectDrawerFolder}
        onSelectHome={handleExitToHome}
        rootMap={rootMap}
        onOpenPhoto={onOpenPhoto}
        onOpenVideo={(item) => onOpenVideo(item, [item])}
      />

      {/* 404 Media / Route Not Found Modal */}
      <MediaNotFoundDialog
        isOpen={notFoundInfo.isOpen}
        attemptedPath={notFoundInfo.path}
        suggestedTab={notFoundInfo.tab}
        onClose={() => setNotFoundInfo((prev) => ({ ...prev, isOpen: false }))}
        onNavigateTab={(tab) => {
          setNotFoundInfo((prev) => ({ ...prev, isOpen: false }));
          if (tab === 'SHORTS') {
            scrollToSection('SHORTS');
          } else if (tab === 'CLIPS') {
            scrollToSection('CLIPS');
          } else if (tab === 'PHOTOGRAPHY') {
            scrollToSection('PHOTOGRAPHY');
          } else {
            scrollToSection('SHORTS');
          }
        }}
      />

      {/* Top Acid Lime Kinetic Marquee Ticker */}
      <div className="w-full overflow-hidden py-1 sm:py-1.5 bg-[#ccff00] text-black font-mono font-black text-[11px] sm:text-xs uppercase tracking-widest select-none shrink-0 z-40 shadow-md">
        <div className="animate-marquee whitespace-nowrap flex gap-8 items-center">
          <span className="bg-black text-[#ccff00] px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">INDEX NOTICE</span>
          <span>ALL CONTENT INDEXED ON THIS ARCHIVE IS AGGREGATED FROM PUBLIC INTERNET SOURCES • SARWAR.CYOU DOES NOT INDEPENDENTLY HOST OR PUBLISH PROPRIETARY MEDIA</span>
          <span>•</span>
          <span>SARWARCYOU ARCHIVE 2026</span>
          <span>•</span>
          <span>CELEBRITY PORTRAITS</span>
          <span>•</span>
          <span>CINEMA REELS 4K</span>
          <span>•</span>
          <span>STRICT VERIFIED FEED</span>
          <span>•</span>
          <span>BIENNALE EDITION // VOL. 2026</span>
          <span>•</span>
          <span className="bg-black text-[#ccff00] px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">INDEX NOTICE</span>
          <span>ALL CONTENT INDEXED ON THIS ARCHIVE IS AGGREGATED FROM PUBLIC INTERNET SOURCES • SARWAR.CYOU DOES NOT INDEPENDENTLY HOST OR PUBLISH PROPRIETARY MEDIA</span>
          <span>•</span>
          <span>SARWARCYOU ARCHIVE 2026</span>
          <span>•</span>
          <span>CELEBRITY PORTRAITS</span>
          <span>•</span>
          <span>CINEMA REELS 4K</span>
          <span>•</span>
          <span>STRICT VERIFIED FEED</span>
          <span>•</span>
          <span>BIENNALE EDITION // VOL. 2026</span>
        </div>
      </div>

      {/* TOP HEADER BAR: Compact 2-Row Cyber Dock */}
      <header className="sticky top-0 w-full flex flex-col border-b border-white/[0.08] bg-[#050505]/95 backdrop-blur-md z-30 shrink-0">
        {/* ROW 1: Clean Brand Logo on Left + Primary SVP Tabs & Tools on Right */}
        <div className="w-full px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2 border-b border-white/[0.08]">
          <div className="flex items-center shrink-0">
            <HeaderBrandLogo
              trackingClass="tracking-[0.16em] sm:tracking-[0.24em]"
              onTrigger={() => setVaultDrawerOpen((prev) => !prev)}
            />
          </div>

          {/* Avant-Garde Quick Select Keys: Consolidated Tabs (SVP on mobile portrait, Full on landscape/desktop) */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 py-0.5">
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              scrollToSection('SHORTS');
            }}
            title="Shorts"
            className={`reticle-chip whitespace-nowrap ${
              selectedCategory === 'SHORTS' || selectedCategory === 'YOUTUBE'
                ? 'active-chip'
                : ''
            }`}
          >
            <span className="tab-label-full">SHORTS</span>
            <span className="tab-label-short">S</span>
          </button>
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              scrollToSection('CLIPS');
            }}
            title="Video Clips"
            className={`reticle-chip whitespace-nowrap ${
              selectedCategory === 'CLIPS' || selectedCategory === 'REALTUBE'
                ? 'active-chip'
                : ''
            }`}
          >
            <span className="tab-label-full">VIDEO CLIPS</span>
            <span className="tab-label-short">V</span>
          </button>
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              scrollToSection('PHOTOGRAPHY');
            }}
            title="Photographs"
            className={`reticle-chip whitespace-nowrap ${
              selectedCategory === 'PHOTOGRAPHY'
                ? 'active-chip'
                : ''
            }`}
          >
            <span className="tab-label-full">PHOTOGRAPHS</span>
            <span className="tab-label-short">P</span>
          </button>

          {/* Quick Search Action Button */}
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              setIsSearchOpen(true);
            }}
            title="Universal Command Search (Ctrl+K or /)"
            className="reticle-chip whitespace-nowrap flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5 text-[#ccff00]" />
            <span className="tab-label-full">SEARCH</span>
            <span className="tab-label-short">?</span>
            <kbd className="hidden lg:inline text-[8px] bg-white/10 px-1 py-0.5 rounded text-neutral-400 font-mono">⌘K</kbd>
          </button>

          {/* Surprise Me / Random Warp Trigger */}
          <button
            type="button"
            onClick={handleRandomWarp}
            title="Surprise Me // Random Archive Warp"
            className="reticle-chip whitespace-nowrap flex items-center gap-1.5 text-[#ccff00] border-[#ccff00]/40 hover:border-[#ccff00] hover:bg-[#ccff00]/10"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span className="tab-label-full">WARP</span>
            <span className="tab-label-short">✦</span>
          </button>
        </div>
      </div>

        {/* ROW 2: Subfolder Title (under Logo on Left) + Subfolder Filter Pills (under Tabs on Right) */}
        <div className="w-full px-3 sm:px-6 py-1.5 sm:py-2 flex items-center justify-between gap-3 bg-[#08080a]/90 backdrop-blur-md">
          {/* Active Subfolder Title & Item Count (Directly under the website logo) */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 min-w-0">
            {selectedCategory === 'PHOTOGRAPHY' ? (
              <Folder className="w-4 h-4 text-[#ccff00] shrink-0" />
            ) : (
              <Film className="w-4 h-4 text-[#ccff00] shrink-0" />
            )}
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-xs sm:text-sm font-bold tracking-wider text-white uppercase truncate font-mono">
                {selectedCategory === 'PHOTOGRAPHY'
                  ? photosSubfolder && photosSubfolder !== 'ALL'
                    ? photosSubfolder
                    : 'ALL PHOTOGRAPHS'
                  : selectedCategory === 'CLIPS'
                  ? clipsSubfolder && clipsSubfolder !== 'ALL'
                    ? clipsSubfolder
                    : 'ALL VIDEO CLIPS'
                  : shortsSubfolder && shortsSubfolder !== 'ALL'
                  ? shortsSubfolder
                  : 'ALL SHORTS'}
              </span>
              <span className="text-[10px] font-mono text-neutral-400 shrink-0">
                (
                {selectedCategory === 'PHOTOGRAPHY'
                  ? activePhotosList.length
                  : selectedCategory === 'CLIPS'
                  ? activeClipsList.length
                  : activeShortsList.length}
                )
              </span>
            </div>
          </div>

          {/* Subfolder Filter Pills (Directly under navigation tabs on the right) */}
          <div className="flex items-center justify-end overflow-x-auto no-scrollbar max-w-[65%] sm:max-w-[75%] shrink-0">
            {selectedCategory === 'PHOTOGRAPHY'
              ? renderCategorySubfolderBar('PHOTOGRAPHY', photosSubfolder, setPhotosSubfolder, true)
              : selectedCategory === 'CLIPS'
              ? renderCategorySubfolderBar('CLIPS', clipsSubfolder, setClipsSubfolder, true)
              : renderCategorySubfolderBar('SHORTS', shortsSubfolder, setShortsSubfolder, true)}
          </div>
        </div>
      </header>

      {/* Sector Spatial Waypoint Radar on Right Edge (Desktop & Tablet) */}
      <SectorRadarRail
        activeSector={selectedCategory as any}
        onNavigateSector={(sector) => scrollToSection(sector)}
      />

      {/* Universal Instant Command Search Palette */}
      <QuickSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        items={items}
        onOpenPhoto={onOpenPhoto}
        onOpenVideo={onOpenVideo}
        onOpenShort={onOpenShort}
      />

      {/* MAIN VIEWPORT STAGE: Single-Page SVP Media Hub (Shorts -> Video Clips -> Photographs) */}
      <main
        aria-label="Single-Page Media Hub"
        className={`flex-1 w-full min-h-0 overflow-y-auto space-scrollbar z-10 flex flex-col bg-transparent transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isModalOpen ? 'scale-[0.985] brightness-[0.7] blur-[1px]' : 'scale-100 brightness-100 blur-0'
        }`}
      >
        {/* ===================================================================== */}
        {/* SECTION 1: SHORTS // 9:16 VERTICAL STREAM FEED                         */}
        {/* ===================================================================== */}
        <section
          id="section-shorts"
          className="w-full px-3 sm:px-6 lg:px-8 pt-3 pb-6 sm:pb-8 border-b border-white/[0.06] flex flex-col shrink-0"
        >
          {/* Spotlight Horizontal Carousel Reel */}
          <SpotlightCarouselRow
            title="SPOTLIGHT SHORTS // HIGH-VELOCITY REELS"
            badge="FEATURED"
            items={allShortsFiles}
            aspectRatio="9/16"
            cardWidthClass="w-36 sm:w-44 lg:w-52"
            onOpenItem={handleOpenItem}
            subfolderLabelResolver={getItemSubfolderLabel}
          />

          {activeShortsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center my-auto min-h-[30vh] border border-white/5 rounded-2xl bg-[#08080a]">
              <div className="w-12 h-12 rounded-full bg-[#ccff00]/10 border border-[#ccff00]/30 flex items-center justify-center text-[#ccff00] mb-3">
                <Folder className="w-6 h-6" />
              </div>
              <p className="font-['Space_Grotesk',sans-serif] text-white text-base font-bold uppercase tracking-wider mb-1">
                No Shorts in this Collection
              </p>
              <span className="text-xs font-mono text-neutral-500 uppercase tracking-widest">
                INDEX READY // SCAN COMPLETE
              </span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4 pb-6">
                {activeShortsList.slice(0, visibleShorts).map((item, idx) => (
                  <LivingMediaCard
                    key={item.id || item.url || idx}
                    item={item}
                    aspectRatio="9/16"
                    subfolderLabel={getItemSubfolderLabel(item)}
                    delayIdx={idx}
                    onClick={() => handleOpenItem(item, idx)}
                  />
                ))}
              </div>

              {visibleShorts < activeShortsList.length && (
                <div className="w-full py-6 flex flex-col items-center justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setVisibleShorts((v) => v + 24);
                    }}
                    className="reticle-btn px-6 py-2.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase text-[#ccff00] border border-[#ccff00]/40 hover:border-[#ccff00] hover:bg-[#ccff00]/10 transition-all cursor-pointer shadow-[0_0_15px_rgba(204,255,0,0.15)] flex items-center gap-2"
                  >
                    <span>SHOW MORE SHORTS ({Math.min(visibleShorts, activeShortsList.length)} / {activeShortsList.length})</span>
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Cinematic Chapter Telemetry Divider 1 -> 2 */}
        <SectorTelemetryDivider
          sectorNumber="02"
          sectorTitle="WIDESCREEN CINEMA"
          subtitle="16:9 Cinema Broadcasts, Music Videos & Master Visual Cuts"
          telemetryTags={['BUFFER: SYNCHRONIZED', 'LATENCY: 0.12ms', 'VERIFIED 4K']}
        />

        {/* ===================================================================== */}
        {/* SECTION 2: VIDEO CLIPS // 16:9 WIDESCREEN CINEMA & MUSIC RELEASES     */}
        {/* ===================================================================== */}
        <section
          id="section-clips"
          className="w-full px-3 sm:px-6 lg:px-8 pt-3 pb-6 sm:pb-8 border-b border-white/[0.06] flex flex-col shrink-0"
        >
          {/* Spotlight Horizontal Carousel Reel */}
          <SpotlightCarouselRow
            title="SPOTLIGHT CINEMA // 16:9 PREMIERES"
            badge="PREMIERE"
            items={allClipsFiles}
            aspectRatio="16/9"
            cardWidthClass="w-56 sm:w-72 lg:w-80"
            onOpenItem={handleOpenItem}
            subfolderLabelResolver={getItemSubfolderLabel}
          />

          {activeClipsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center my-auto min-h-[30vh] border border-white/5 rounded-2xl bg-[#08080a]">
              <div className="w-12 h-12 rounded-full bg-[#ccff00]/10 border border-[#ccff00]/30 flex items-center justify-center text-[#ccff00] mb-3">
                <Folder className="w-6 h-6" />
              </div>
              <p className="font-['Space_Grotesk',sans-serif] text-white text-base font-bold uppercase tracking-wider mb-1">
                No Video Clips in this Collection
              </p>
              <span className="text-xs font-mono text-neutral-500 uppercase tracking-widest">
                INDEX READY // SCAN COMPLETE
              </span>
            </div>
          ) : (
            <>
              <div className="w-full pb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                {activeClipsList.slice(0, visibleClips).map((item, idx) => (
                  <LivingMediaCard
                    key={item.id || item.url || idx}
                    item={item}
                    aspectRatio="16/9"
                    subfolderLabel={getItemSubfolderLabel(item)}
                    delayIdx={idx}
                    onClick={() => handleOpenItem(item, idx)}
                  />
                ))}
              </div>

              {visibleClips < activeClipsList.length && (
                <div className="w-full py-6 flex flex-col items-center justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setVisibleClips((v) => v + 24);
                    }}
                    className="reticle-btn px-6 py-2.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase text-[#ccff00] border border-[#ccff00]/40 hover:border-[#ccff00] hover:bg-[#ccff00]/10 transition-all cursor-pointer shadow-[0_0_15px_rgba(204,255,0,0.15)] flex items-center gap-2"
                  >
                    <span>SHOW MORE CLIPS ({Math.min(visibleClips, activeClipsList.length)} / {activeClipsList.length})</span>
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Cinematic Chapter Telemetry Divider 2 -> 3 */}
        <SectorTelemetryDivider
          sectorNumber="03"
          sectorTitle="PHOTOGRAPHIC VAULT"
          subtitle="High-Resolution Celebrity Portraits & Master Photographic Stills"
          telemetryTags={['SPECTRAL: RAW EXIF', 'COLORSPACE: DCI-P3', 'LOSSLESS']}
        />

        {/* ===================================================================== */}
        {/* SECTION 3: PHOTOGRAPHS // HIGH-RESOLUTION PHOTO VAULT                 */}
        {/* ===================================================================== */}
        <section
          id="section-photographs"
          className="w-full px-3 sm:px-6 lg:px-8 pt-3 pb-6 sm:pb-8 flex flex-col shrink-0"
        >
          {/* Spotlight Horizontal Carousel Reel */}
          <SpotlightCarouselRow
            title="SPOTLIGHT PORTRAITS // MASTER GALLERY"
            badge="GALLERY PICK"
            items={allPhotosFiles}
            aspectRatio="3/4"
            cardWidthClass="w-36 sm:w-44 lg:w-52"
            onOpenItem={handleOpenItem}
            subfolderLabelResolver={getItemSubfolderLabel}
          />

          {activePhotosList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center my-auto min-h-[30vh] border border-white/5 rounded-2xl bg-[#08080a]">
              <div className="w-12 h-12 rounded-full bg-[#ccff00]/10 border border-[#ccff00]/30 flex items-center justify-center text-[#ccff00] mb-3">
                <Folder className="w-6 h-6" />
              </div>
              <p className="font-['Space_Grotesk',sans-serif] text-white text-base font-bold uppercase tracking-wider mb-1">
                No Photographs in this Collection
              </p>
              <span className="text-xs font-mono text-neutral-500 uppercase tracking-widest">
                INDEX READY // SCAN COMPLETE
              </span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4 pb-6">
                {activePhotosList.slice(0, visiblePhotos).map((item, idx) => (
                  <LivingMediaCard
                    key={item.id || item.url || idx}
                    item={item}
                    aspectRatio="3/4"
                    subfolderLabel={getItemSubfolderLabel(item)}
                    delayIdx={idx}
                    onClick={() => handleOpenItem(item, idx)}
                  />
                ))}
              </div>

              {visiblePhotos < activePhotosList.length && (
                <div className="w-full py-6 flex flex-col items-center justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setVisiblePhotos((v) => v + 24);
                    }}
                    className="reticle-btn px-6 py-2.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase text-[#ccff00] border border-[#ccff00]/40 hover:border-[#ccff00] hover:bg-[#ccff00]/10 transition-all cursor-pointer shadow-[0_0_15px_rgba(204,255,0,0.15)] flex items-center gap-2"
                  >
                    <span>SHOW MORE PHOTOGRAPHS ({Math.min(visiblePhotos, activePhotosList.length)} / {activePhotosList.length})</span>
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
};

export default MonolithBarGate;
