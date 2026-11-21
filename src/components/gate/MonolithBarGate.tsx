import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { StageMediaItem } from '../../types';
import { MIDNIGHT_OBSIDIAN_THEME } from './themeManager';
import { CinematicBackdropCanvas } from './CinematicBackdropCanvas';
import { isPhotoExtension } from '../../utils/mediaTypeDetector';
import { sortMediaItemsDescending } from '../../utils/albumExtractor';
import { hapticMedium } from '../../utils/hapticsManager';
import { trackActivityEvent } from '../../utils/usageTelemetry';
import {
  parseAppPathname,
  updateBrowserUrl,
  findMediaByShortId,
  getMediaShortId,
  getSubfolderHref,
} from '../../utils/urlRouter';
import { MediaNotFoundDialog } from '../common/MediaNotFoundDialog';
import { LivingMediaCard } from './LivingMediaCard';
import { LaserSparkLogo } from '../brand/LaserSparkLogo';
import { TopMiddleNetworkStatus } from '../navigation/TopMiddleNetworkStatus';
import { TacticalTelemetryGraph } from '../navigation/TacticalTelemetryGraph';
import { HomepageSlidingShorts } from './HomepageSlidingShorts';
import { PhotographsSlidingFeatured } from './PhotographsSlidingFeatured';
import { VideoClipsCinemaTheater } from './VideoClipsCinemaTheater';
import { BandhobiSlidingFeaturedPhotos } from './BandhobiSlidingFeaturedPhotos';
import { DeepDiurnalTelemetryView } from '../telemetry/DeepDiurnalTelemetryView';
import { DiurnalPhase24hSummary } from '../telemetry/DiurnalPhase24hSummary';
import { CyberSearchBar } from '../navigation/CyberSearchBar';
import { searchWebImages } from '../../services/imageSearchService';

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

  if (/^(?:bandhobiz|bandhobi|realtube)$/i.test(root) || clean.toLowerCase().startsWith('bandhobiz/') || clean.toLowerCase().startsWith('bandhobi/') || clean.toLowerCase().startsWith('realtube/')) {
    root = 'bandhobiz';
    let subName = sub.length > 0 ? sub[0] : '';
    if (!subName && clean.toLowerCase().includes('/photographs/')) subName = 'Photographs';
    if (!subName && clean.toLowerCase().includes('/shorts/')) subName = 'Shorts';
    if (!subName && clean.toLowerCase().includes('/video clips/')) subName = 'Video Clips';

    if (/image|photo/i.test(subName) || isPhotoExtension(clean)) {
      sub = ['Photographs'];
    } else if (/short/i.test(subName) || item.mediaType === 'short') {
      sub = ['Shorts'];
    } else {
      sub = ['Video Clips'];
    }
    return { root, subfolders: sub };
  }

  if (/^(?:photographs|images|photography)$/i.test(root) || isPhotoExtension(clean)) {
    root = 'Photographs';
    let subName = sub.length > 0 ? sub[0] : '';
    if (/fav/i.test(subName)) subName = 'Favorite';
    else if (/2027/i.test(subName)) subName = '2027';
    else if (/2026/i.test(subName)) subName = '2026';
    else if (/2025/i.test(subName)) subName = '2025';
    else subName = 'Older';
    return { root, subfolders: [subName] };
  }

  if (/^(?:reels\/shorts|shorts|reels)$/i.test(root) || item.mediaType === 'short' || clean.toLowerCase().includes('/shorts/')) {
    root = 'Shorts';
    let subName = sub.length > 0 ? sub[0] : '';
    if (/2027/i.test(subName)) subName = '2027';
    else subName = 'Older';
    return { root, subfolders: [subName] };
  }

  root = 'Video Clips';
  let subName = sub.length > 0 ? sub[0] : '';
  if (/fav/i.test(subName)) subName = 'Favorite';
  else if (/2027/i.test(subName)) subName = '2027';
  else if (/2026/i.test(subName)) subName = '2026';
  else subName = 'Older';

  return { root, subfolders: [subName] };
}

const PHOTO_SUBFOLDERS = ['Favorite', '2027', '2026', '2025', 'Older'];
const SHORTS_SUBFOLDERS = ['2027', 'Older'];
const CLIPS_SUBFOLDERS = ['Favorite', '2027', '2026', 'Older'];
const BANDHOBI_SUBFOLDERS = ['Photographs', 'Video Clips', 'Shorts'];



// Selected photo filenames to showcase under bandhobiz -> Featured in user's exact order
export const BANDHOBI_FEATURED_PHOTO_FILENAMES: string[] = [
  'FAV_webmedia-serial-254.jpeg',
  'FAV_Farhana2.png',
  'FAV_Farhana.jpg',
  'FAV_f26140392.jpg',
  'FAV_Eva8.jpg',
  'FAV_Eva6.jpg',
  'FAV_Eva5.jpg',
  'FAV_Eva4.jpg',
  'FAV_Asha5.jpg',
  'FAV_Asha2.jpg',
  'FAV_Anamika7.jpg',
  'FAV_Anamika4.jpg',
  'FAV_Drthrinaislam.jpg',
];
export const BANDHOBI_FEATURED_PHOTO_KEYS = BANDHOBI_FEATURED_PHOTO_FILENAMES;

export const MonolithBarGate: React.FC<MonolithBarGateProps> = ({
  items,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
  initialAlbum: _initialAlbum,
  isModalOpen = false,
}) => {
  const initialRoute = useMemo(() => parseAppPathname(), []);

  // Visual tab display ordering for directional transitions (Photographs -> Video Clips -> Shorts -> Bandhobi)
  const TAB_VISUAL_ORDER = useMemo<Record<number, number>>(() => ({
    1: 0,
    3: 1,
    2: 2,
    4: 3,
  }), []);

  // 1: Photographs, 2: Shorts (Homepage Landing), 3: Video Clips, 4: Bandhobi
  const [tabIndex, setTabIndex] = useState<number>(() => {
    if (typeof window === 'undefined') return 2;
    const parsed = parseAppPathname();
    if (parsed.tab === 'PHOTOGRAPHY') return 1;
    if (parsed.tab === 'SHORTS') return 2;
    if (parsed.tab === 'CLIPS') return 3;
    if (parsed.tab === 'BANDHOBI') return 4;
    return 2;
  });

  const [photosSubfolder, setPhotosSubfolder] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Featured';
    const parsed = parseAppPathname();
    if (parsed.tab === 'PHOTOGRAPHY' && parsed.subfolder) return parsed.subfolder;
    return 'Featured';
  });
  const [shortsSubfolder, setShortsSubfolder] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Featured';
    const parsed = parseAppPathname();
    if (parsed.tab === 'SHORTS') return parsed.subfolder || 'Featured';
    return 'Featured';
  });
  const [clipsSubfolder, setClipsSubfolder] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Featured';
    const parsed = parseAppPathname();
    if (parsed.tab === 'CLIPS' && parsed.subfolder) return parsed.subfolder;
    return 'Featured';
  });
  const [bandhobiSubfolder, setBandhobiSubfolder] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Featured';
    const parsed = parseAppPathname();
    if (parsed.tab === 'BANDHOBI' && parsed.subfolder) return parsed.subfolder;
    return 'Featured';
  });
  const [shuffleTrigger, setShuffleTrigger] = useState<number>(0);

  // Active subfolder for current tab
  const currentSubfolder =
    tabIndex === 1
      ? photosSubfolder
      : tabIndex === 2
      ? shortsSubfolder
      : tabIndex === 3
      ? clipsSubfolder
      : bandhobiSubfolder;


  // Screen orientation detection for portrait layout
  const [isPortrait, setIsPortrait] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerHeight > window.innerWidth;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Selected day for in-page portrait telemetry (0 = Today, 1 = Yesterday, etc.)
  const [portraitSelectedDay, setPortraitSelectedDay] = useState<number>(0);

  const [showTelemetry, setShowTelemetry] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return parseAppPathname().tab === 'TELEMETRY';
  });
  const [telemetryInitialDay, setTelemetryInitialDay] = useState<number | null>(null);
  const previousRouteRef = useRef<string>('/');

  const handleOpenTelemetryWithDay = useCallback((dayIdx: number) => {
    if (typeof window !== 'undefined') {
      previousRouteRef.current = window.location.pathname;
    }
    setTelemetryInitialDay(dayIdx);
    setShowTelemetry(true);
    updateBrowserUrl('/telemetry');
  }, []);

  const handleOpenTelemetry = useCallback(() => {
    if (typeof window !== 'undefined') {
      previousRouteRef.current = window.location.pathname;
    }
    setTelemetryInitialDay(null);
    setShowTelemetry(true);
    updateBrowserUrl('/telemetry');
  }, []);

  const handleCloseTelemetry = useCallback(() => {
    setShowTelemetry(false);
    setTelemetryInitialDay(null);
    updateBrowserUrl(previousRouteRef.current || '/');
  }, []);

  const [notFoundInfo, setNotFoundInfo] = useState<{
    isOpen: boolean;
    path: string;
    tab?: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY' | 'BANDHOBI' | 'TRAILER' | 'HOME' | 'TELEMETRY';
  }>({ isOpen: false, path: '' });

  const [searchState, setSearchState] = useState<{
    isActive: boolean;
    query: string;
    isLoading: boolean;
    results: StageMediaItem[];
  }>({
    isActive: false,
    query: '',
    isLoading: false,
    results: [],
  });

  const handleWebImageSearch = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) return;

    setSearchState({
      isActive: true,
      query: q,
      isLoading: true,
      results: [],
    });

    try {
      const items = await searchWebImages(q);
      setSearchState((prev) => ({
        ...prev,
        isLoading: false,
        results: items,
      }));
    } catch {
      setSearchState((prev) => ({
        ...prev,
        isLoading: false,
        results: [],
      }));
    }
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchState({
      isActive: false,
      query: '',
      isLoading: false,
      results: [],
    });
  }, []);

  const switchTab = useCallback((targetIndex: number) => {
    handleClearSearch();

    if (targetIndex === tabIndex) {
      if (currentSubfolder === 'Featured') return;

      // Clicked active tab while in a subfolder: Switch back to Featured
      if (tabIndex === 1) setPhotosSubfolder('Featured');
      else if (tabIndex === 2) setShortsSubfolder('Featured');
      else if (tabIndex === 3) setClipsSubfolder('Featured');
      else if (tabIndex === 4) setBandhobiSubfolder('Featured');
      setShuffleTrigger((prev) => prev + 1);

      if (typeof window !== 'undefined') {
        let route = '/shorts';
        if (tabIndex === 1) route = '/photographs';
        else if (tabIndex === 2) route = '/shorts';
        else if (tabIndex === 3) route = '/clips';
        else if (tabIndex === 4) route = '/bandhobiz';
        updateBrowserUrl(route);
      }
      return;
    }

    setTabIndex(targetIndex);
    if (targetIndex === 1) setPhotosSubfolder('Featured');
    else if (targetIndex === 2) setShortsSubfolder('Featured');
    else if (targetIndex === 3) setClipsSubfolder('Featured');
    else if (targetIndex === 4) setBandhobiSubfolder('Featured');
    setShuffleTrigger((prev) => prev + 1);

    if (typeof window !== 'undefined') {
      let route = '/shorts';
      if (targetIndex === 1) route = '/photographs';
      else if (targetIndex === 2) route = '/shorts';
      else if (targetIndex === 3) route = '/clips';
      else if (targetIndex === 4) route = '/bandhobiz';
      updateBrowserUrl(route);
    }
  }, [tabIndex, currentSubfolder, handleClearSearch]);

  // Navigate directly to Shorts Featured showcase at '/shorts'
  const goToHome = useCallback(() => {
    handleClearSearch();
    if (tabIndex === 2 && currentSubfolder === 'Featured') return;

    setTabIndex(2);
    setShortsSubfolder('Featured');
    setShuffleTrigger((prev) => prev + 1);

    if (typeof window !== 'undefined') {
      updateBrowserUrl('/shorts');
    }
  }, [tabIndex, currentSubfolder, handleClearSearch]);

  // Synchronize state when browser Back / Forward (popstate) is clicked
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const launchMatchedItemRef = useRef<(item: StageMediaItem) => void>(() => {});

  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseAppPathname();
      if (parsed.isNotFound) {
        setNotFoundInfo({ isOpen: true, path: window.location.pathname });
        return;
      }
      if (parsed.tab === 'TELEMETRY') {
        setShowTelemetry(true);
        return;
      }
      setShowTelemetry(false);

      if (parsed.shortId && itemsRef.current && itemsRef.current.length > 0) {
        const matched = findMediaByShortId(itemsRef.current, parsed.shortId);
        if (matched) {
          launchMatchedItemRef.current(matched.item);
          return;
        }
      }

      setShuffleTrigger((prev) => prev + 1);

      if (parsed.tab === 'PHOTOGRAPHY') {
        const sub = parsed.subfolder || 'Featured';
        setPhotosSubfolder(sub);
        setTabIndex(1);
      } else if (parsed.tab === 'SHORTS') {
        const sub = parsed.subfolder || 'Featured';
        setShortsSubfolder(sub);
        setTabIndex(2);
      } else if (parsed.tab === 'CLIPS') {
        const sub = parsed.subfolder || 'Featured';
        setClipsSubfolder(sub);
        setTabIndex(3);
      } else if (parsed.tab === 'BANDHOBI') {
        const sub = parsed.subfolder || 'Featured';
        setBandhobiSubfolder(sub);
        setTabIndex(4);
      } else {
        // Root / lands on Shorts Featured
        setTabIndex(2);
        setShortsSubfolder('Featured');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Catalog indexation by directory
  const rootMap = useMemo(() => {
    const map = new Map<string, any>();
    const getOrCreate = (name: string) => {
      if (!map.has(name)) {
        map.set(name, {
          name,
          fullPath: name,
          subfolders: new Map(),
          files: [],
        });
      }
      return map.get(name)!;
    };

    for (const item of items) {
      const { root, subfolders } = getFolderSegments(item);
      const rootNode = getOrCreate(root);
      if (subfolders.length === 0) {
        rootNode.files.push(item);
      } else {
        const subName = subfolders[0];
        if (!rootNode.subfolders.has(subName)) {
          rootNode.subfolders.set(subName, {
            name: subName,
            fullPath: `${root}/${subName}`,
            subfolders: new Map(),
            files: [],
          });
        }
        rootNode.subfolders.get(subName)!.files.push(item);
      }
    }

    return map;
  }, [items]);

  const allPhotosFiles = useMemo(() => {
    const node = rootMap.get('Photographs');
    if (!node) return [];
    const seen = new Set<string>();
    const list: StageMediaItem[] = [];
    for (const f of node.files) {
      const k = f.id || f.url || f.path || f.name;
      if (k && !seen.has(k)) { seen.add(k); list.push(f); }
    }
    for (const sub of node.subfolders.values()) {
      for (const f of sub.files) {
        const k = f.id || f.url || f.path || f.name;
        if (k && !seen.has(k)) { seen.add(k); list.push(f); }
      }
    }
    return sortMediaItemsDescending(list);
  }, [rootMap]);

  const allShortsFiles = useMemo(() => {
    const node = rootMap.get('Shorts');
    if (!node) return [];
    const seen = new Set<string>();
    const list: StageMediaItem[] = [];
    for (const f of node.files) {
      const k = f.id || f.url || f.path || f.name;
      if (k && !seen.has(k)) { seen.add(k); list.push(f); }
    }
    for (const sub of node.subfolders.values()) {
      for (const f of sub.files) {
        const k = f.id || f.url || f.path || f.name;
        if (k && !seen.has(k)) { seen.add(k); list.push(f); }
      }
    }
    return sortMediaItemsDescending(list);
  }, [rootMap]);

  const allClipsFiles = useMemo(() => {
    const node = rootMap.get('Video Clips');
    if (!node) return [];
    const seen = new Set<string>();
    const list: StageMediaItem[] = [];
    for (const f of node.files) {
      const k = f.id || f.url || f.path || f.name;
      if (k && !seen.has(k)) { seen.add(k); list.push(f); }
    }
    for (const sub of node.subfolders.values()) {
      for (const f of sub.files) {
        const k = f.id || f.url || f.path || f.name;
        if (k && !seen.has(k)) { seen.add(k); list.push(f); }
      }
    }
    return sortMediaItemsDescending(list);
  }, [rootMap]);

  const activeBandhobiList: StageMediaItem[] = useMemo(() => {
    const photosNode = rootMap.get('bandhobiz')?.subfolders.get('Photographs') || rootMap.get('Bandhobi')?.subfolders.get('Photographs');
    // Strictly isolate to bandhobiz/Photographs photos only - NEVER accept files outside this directory
    const allPhotos = (photosNode ? photosNode.files : []).filter((item: StageMediaItem) => {
      const p = (item.path || '').toLowerCase();
      return p.startsWith('bandhobiz/photographs/') || p.startsWith('bandhobi/photographs/');
    });

    // Build lookup map ONLY from bandhobiz/Photographs photos
    const itemMap = new Map<string, StageMediaItem>();
    const registerItem = (item: StageMediaItem) => {
      const sid = getMediaShortId(item);
      if (sid) itemMap.set(sid.toLowerCase(), item);
      const name = (item.name || '').toLowerCase();
      if (name) itemMap.set(name, item);
      const pathPart = (item.path || '').split('/').pop()?.toLowerCase();
      if (pathPart) itemMap.set(pathPart, item);
    };

    for (const item of allPhotos) registerItem(item);

    const selected: StageMediaItem[] = [];
    for (const fname of BANDHOBI_FEATURED_PHOTO_FILENAMES) {
      const cleanName = fname.replace(/^fav[_\s-]+/i, '').toLowerCase();
      const favName = `fav_${cleanName}`;
      const match =
        itemMap.get(fname.toLowerCase()) ||
        itemMap.get(favName) ||
        itemMap.get(cleanName);
      if (match && !selected.some((s) => s.id === match.id || s.path === match.path)) {
        selected.push(match);
      }
    }

    // Automatic discovery: STRICTLY within allPhotos (bandhobiz/Photographs only)
    for (const item of allPhotos) {
      const baseName = (item.name || (item.path ? item.path.split('/').pop() : '') || '').toLowerCase();
      if (baseName.startsWith('fav_') || baseName.startsWith('fav-') || item.path?.toLowerCase().includes('/favorite/')) {
        if (!selected.some((s) => s.id === item.id || s.path === item.path)) {
          selected.push(item);
        }
      }
    }

    return selected.length > 0 ? selected : allPhotos.slice(0, 13);
  }, [rootMap]);

  // Full folder playlist launcher for deep links and popstate navigation
  const launchMatchedItem = useCallback(
    (item: StageMediaItem) => {
      const { root, subfolders } = getFolderSegments(item);
      const isPhoto =
        item.type === 'image' || isPhotoExtension(item.path || item.url || item.name || '');
      const isShort =
        item.mediaType === 'short' ||
        item.path?.toLowerCase().includes('short') ||
        item.url?.toLowerCase().includes('short');

      const findIdx = (list: StageMediaItem[]) => {
        return list.findIndex(
          (x) =>
            (x.id && item.id && x.id === item.id) ||
            (x.name && item.name && x.name === item.name) ||
            (x.path && item.path && x.path === item.path) ||
            (x.url && item.url && x.url === item.url)
        );
      };

      const withItem = (list: StageMediaItem[]) => {
        if (findIdx(list) >= 0) return list;
        return [item, ...list];
      };

      if (root === 'bandhobiz' || root === 'Bandhobi') {
        setTabIndex(4);
        const subName = subfolders[0] || (isPhoto ? 'Photographs' : isShort ? 'Shorts' : 'Video Clips');
        setBandhobiSubfolder(subName);

        if (subName === 'Photographs' || isPhoto) {
          const node = rootMap.get('bandhobiz')?.subfolders.get('Photographs') || rootMap.get('Bandhobi')?.subfolders.get('Photographs');
          const rawFiles =
            node && node.files.length > 0
              ? sortMediaItemsDescending<StageMediaItem>(node.files)
              : activeBandhobiList;
          const playlist = withItem(rawFiles);
          const idx = findIdx(playlist);
          onOpenPhoto(item, playlist, idx >= 0 ? idx : 0);
        } else if (subName === 'Shorts' || isShort) {
          const node = rootMap.get('bandhobiz')?.subfolders.get('Shorts') || rootMap.get('Bandhobi')?.subfolders.get('Shorts');
          const rawFiles =
            node && node.files.length > 0
              ? sortMediaItemsDescending<StageMediaItem>(node.files)
              : activeBandhobiList;
          const playlist = withItem(rawFiles);
          const idx = findIdx(playlist);
          onOpenShort(item, playlist, idx >= 0 ? idx : 0, 'bandhobiz');
        } else {
          const node = rootMap.get('bandhobiz')?.subfolders.get('Video Clips') || rootMap.get('Bandhobi')?.subfolders.get('Video Clips');
          const rawFiles =
            node && node.files.length > 0
              ? sortMediaItemsDescending<StageMediaItem>(node.files)
              : activeBandhobiList;
          const playlist = withItem(rawFiles);
          onOpenVideo(item, playlist);
        }
        return;
      }

      if (root === 'Photographs' || isPhoto) {
        setTabIndex(1);
        const subName = subfolders[0] || 'Featured';
        setPhotosSubfolder(subName);

        const node = rootMap.get('Photographs')?.subfolders.get(subName);
        const rawFiles =
          node && node.files.length > 0
            ? sortMediaItemsDescending<StageMediaItem>(node.files)
            : allPhotosFiles;
        const playlist = withItem(rawFiles);
        const idx = findIdx(playlist);
        onOpenPhoto(item, playlist, idx >= 0 ? idx : 0);
        return;
      }

      if (root === 'Shorts' || isShort) {
        setTabIndex(2);
        const subName = subfolders[0] || 'Featured';
        setShortsSubfolder(subName);

        const node = rootMap.get('Shorts')?.subfolders.get(subName);
        const rawFiles =
          node && node.files.length > 0
            ? sortMediaItemsDescending<StageMediaItem>(node.files)
            : allShortsFiles;
        const playlist = withItem(rawFiles);
        const idx = findIdx(playlist);
        onOpenShort(item, playlist, idx >= 0 ? idx : 0, 'Shorts');
        return;
      }

      // Root === 'Video Clips' or fallback
      setTabIndex(3);
      const subName = subfolders[0] || 'Featured';
      setClipsSubfolder(subName);

      const node = rootMap.get('Video Clips')?.subfolders.get(subName);
      const rawFiles =
        node && node.files.length > 0
          ? sortMediaItemsDescending<StageMediaItem>(node.files)
          : allClipsFiles;
      const playlist = withItem(rawFiles);
      onOpenVideo(item, playlist);
    },
    [rootMap, allPhotosFiles, allShortsFiles, allClipsFiles, activeBandhobiList, onOpenPhoto, onOpenShort, onOpenVideo]
  );

  launchMatchedItemRef.current = launchMatchedItem;

  // Deep Link Synchronizer on load
  const hasAutoLaunchedRef = useRef(false);
  useEffect(() => {
    if (hasAutoLaunchedRef.current || !items || items.length === 0) return;

    if (initialRoute.shortId) {
      hasAutoLaunchedRef.current = true;
      const matched = findMediaByShortId(items, initialRoute.shortId);
      if (matched) {
        launchMatchedItem(matched.item);
      } else {
        setNotFoundInfo({ isOpen: true, path: window.location.pathname, tab: initialRoute.tab });
      }
      return;
    }

    const parsed = parseAppPathname();
    if (parsed.isNotFound) {
      setNotFoundInfo({ isOpen: true, path: '/' + parsed.rawPath, tab: parsed.tab });
    } else if (typeof window !== 'undefined' && (window.location.pathname === '/' || window.location.pathname === '')) {
      updateBrowserUrl('/shorts', true);
    }
  }, [items, initialRoute, launchMatchedItem]);

  const currentSubfolderList =
    tabIndex === 1
      ? PHOTO_SUBFOLDERS
      : tabIndex === 2
      ? SHORTS_SUBFOLDERS
      : tabIndex === 3
      ? CLIPS_SUBFOLDERS
      : tabIndex === 4
      ? BANDHOBI_SUBFOLDERS
      : [];



  const handleSelectSubfolder = useCallback(
    (sub: string) => {
      if (sub === currentSubfolder) return;

      if (sub === 'ALL' || sub === 'Featured') {
        setShuffleTrigger((prev) => prev + 1);
      }

      if (tabIndex === 1) {
        setPhotosSubfolder(sub);
        if (typeof window !== 'undefined') updateBrowserUrl(getSubfolderHref(1, sub));
      } else if (tabIndex === 2) {
        setShortsSubfolder(sub);
        if (typeof window !== 'undefined') updateBrowserUrl(getSubfolderHref(2, sub));
      } else if (tabIndex === 3) {
        setClipsSubfolder(sub);
        if (typeof window !== 'undefined') updateBrowserUrl(getSubfolderHref(3, sub));
      } else if (tabIndex === 4) {
        setBandhobiSubfolder(sub);
        if (typeof window !== 'undefined') updateBrowserUrl(getSubfolderHref(4, sub));
      }
    },
    [tabIndex, currentSubfolder]
  );

  const renderViewContent = useCallback(
    (viewTab: number, viewSub: string) => {
      if (viewTab === 1 && viewSub === 'Featured') {
        return (
          <div className="w-full h-full flex items-center justify-start overflow-hidden">
            <PhotographsSlidingFeatured
              photos={allPhotosFiles}
              onOpenPhoto={(item: StageMediaItem, playlist: StageMediaItem[], idx: number) =>
                onOpenPhoto(item, playlist, idx)
              }
              randomSeed={shuffleTrigger}
            />
          </div>
        );
      }

      if (viewTab === 2 && viewSub === 'Featured') {
        if (isPortrait) {
          return (
            <div
              className="w-full h-full flex flex-col justify-between items-center overflow-hidden py-1 gap-2"
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              <div className="w-full flex justify-center shrink-0 pt-1 pb-1">
                <TacticalTelemetryGraph
                  size="large"
                  selectedDayIndex={portraitSelectedDay}
                  onSelectDay={(dayIdx) => setPortraitSelectedDay(dayIdx)}
                />
              </div>
              <div className="w-full flex-1 flex items-center justify-start overflow-hidden min-h-[220px]">
                <HomepageSlidingShorts
                  shorts={allShortsFiles}
                  randomSeed={shuffleTrigger}
                  onOpenShort={(item: StageMediaItem, playlist: StageMediaItem[], idx: number) =>
                    onOpenShort(item, playlist, idx, 'Shorts')
                  }
                />
              </div>
              <div className="w-full flex justify-center shrink-0 pt-1 pb-1">
                <DiurnalPhase24hSummary dayIndex={portraitSelectedDay} />
              </div>
            </div>
          );
        }
        return (
          <div className="w-full h-full flex items-center justify-start overflow-hidden">
            <HomepageSlidingShorts
              shorts={allShortsFiles}
              randomSeed={shuffleTrigger}
              onOpenShort={(item: StageMediaItem, playlist: StageMediaItem[], idx: number) =>
                onOpenShort(item, playlist, idx, 'Shorts')
              }
            />
          </div>
        );
      }

      if (viewTab === 3 && viewSub === 'Featured') {
        return (
          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            <VideoClipsCinemaTheater
              clips={allClipsFiles}
              onOpenVideo={(item: StageMediaItem, playlist: StageMediaItem[]) => onOpenVideo(item, playlist)}
              randomSeed={shuffleTrigger}
              isPortrait={isPortrait}
            />
          </div>
        );
      }

      if (viewTab === 4 && viewSub === 'Featured') {
        return (
          <div className="w-full h-full flex items-center justify-start overflow-hidden">
            <BandhobiSlidingFeaturedPhotos
              photos={activeBandhobiList}
              onOpenPhoto={(item: StageMediaItem, playlist: StageMediaItem[], idx: number) =>
                onOpenPhoto(item, playlist, idx)
              }
            />
          </div>
        );
      }

      // Subfolder Media Grids
      let itemsList: StageMediaItem[] = [];
      let aspectRatio: '3/4' | '9/16' | '16/9' = '16/9';

      if (viewTab === 1) {
        aspectRatio = '3/4';
        if (viewSub === 'Featured' || viewSub === 'ALL') itemsList = allPhotosFiles;
        else {
          const node = rootMap.get('Photographs')?.subfolders.get(viewSub);
          itemsList = node && node.files.length > 0 ? sortMediaItemsDescending<StageMediaItem>(node.files) : allPhotosFiles;
        }
      } else if (viewTab === 2) {
        aspectRatio = '9/16';
        if (viewSub === 'Featured') itemsList = allShortsFiles;
        else {
          const node = rootMap.get('Shorts')?.subfolders.get(viewSub);
          itemsList = node && node.files.length > 0 ? sortMediaItemsDescending<StageMediaItem>(node.files) : allShortsFiles;
        }
      } else if (viewTab === 3) {
        aspectRatio = '16/9';
        if (viewSub === 'Featured' || viewSub === 'ALL') itemsList = allClipsFiles;
        else {
          const node = rootMap.get('Video Clips')?.subfolders.get(viewSub);
          itemsList = node && node.files.length > 0 ? sortMediaItemsDescending<StageMediaItem>(node.files) : allClipsFiles;
        }
      } else if (viewTab === 4) {
        if (viewSub === 'Photographs') {
          aspectRatio = '3/4';
          const node = rootMap.get('bandhobiz')?.subfolders.get('Photographs') || rootMap.get('Bandhobi')?.subfolders.get('Photographs');
          itemsList = node && node.files.length > 0 ? sortMediaItemsDescending<StageMediaItem>(node.files) : [];
        } else if (viewSub === 'Shorts') {
          aspectRatio = '9/16';
          const node = rootMap.get('bandhobiz')?.subfolders.get('Shorts') || rootMap.get('Bandhobi')?.subfolders.get('Shorts');
          itemsList = node && node.files.length > 0 ? sortMediaItemsDescending<StageMediaItem>(node.files) : [];
        } else {
          aspectRatio = '16/9';
          const node = rootMap.get('bandhobiz')?.subfolders.get('Video Clips') || rootMap.get('Bandhobi')?.subfolders.get('Video Clips');
          itemsList = node && node.files.length > 0 ? sortMediaItemsDescending<StageMediaItem>(node.files) : [];
        }
      }

      return (
        <div
          className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 pb-6"
          style={{ borderRadius: 0, outline: 'none', border: 'none' }}
        >
          {itemsList.map((item: StageMediaItem, idx: number) => (
            <LivingMediaCard
              key={`${item.id || item.url || item.name}-${idx}`}
              item={item}
              aspectRatio={aspectRatio}
              delayIdx={idx}
              onClick={() => {
                hapticMedium();
                trackActivityEvent(1);
                const isPhoto = item.type === 'image' || isPhotoExtension(item.path || item.url || item.name || '');
                const isShort = item.mediaType === 'short' || (item.path || item.url || '').toLowerCase().includes('/shorts/');
                if (viewTab === 1) onOpenPhoto(item, itemsList, idx);
                else if (viewTab === 2) onOpenShort(item, itemsList, idx, 'Shorts');
                else if (viewTab === 3) onOpenVideo(item, itemsList);
                else if (viewTab === 4) {
                  if (viewSub === 'Photographs' || isPhoto) onOpenPhoto(item, itemsList, idx);
                  else if (viewSub === 'Shorts' || isShort) onOpenShort(item, itemsList, idx, 'Bandhobi');
                  else onOpenVideo(item, itemsList);
                }
              }}
            />
          ))}
        </div>
      );
    },
    [allPhotosFiles, allShortsFiles, allClipsFiles, activeBandhobiList, rootMap, isPortrait, portraitSelectedDay, shuffleTrigger, onOpenPhoto, onOpenShort, onOpenVideo]
  );

  // -------------------------------------------------------------
  // DUAL-ZONE TOUCH SWIPE ENGINE (MOBILE & TABLET ONLY)
  // Completely disabled on desktop to preserve Chrome native back/forward.
  // Upper Half (<= 50% height) -> Major Tabs Turn
  // Lower Half (> 50% height)  -> Subfolder Pages Turn
  // -------------------------------------------------------------
  const TAB_SEQUENCE = useMemo(() => [1, 3, 2, 4], []);

  const handleSwipeTab = useCallback(
    (direction: 'next' | 'prev') => {
      const currentVis = TAB_VISUAL_ORDER[tabIndex] ?? 0;
      const targetVis =
        direction === 'next'
          ? (currentVis + 1) % TAB_SEQUENCE.length
          : (currentVis - 1 + TAB_SEQUENCE.length) % TAB_SEQUENCE.length;
      const targetTab = TAB_SEQUENCE[targetVis];
      if (targetTab !== undefined) {
        switchTab(targetTab);
      }
    },
    [tabIndex, TAB_VISUAL_ORDER, TAB_SEQUENCE, switchTab]
  );

  const handleSwipeSubfolder = useCallback(
    (direction: 'next' | 'prev') => {
      const list = currentSubfolderList;
      if (!list || list.length <= 1) return;
      const currentIdx = list.indexOf(currentSubfolder);
      if (currentIdx === -1) {
        if (direction === 'next') handleSelectSubfolder(list[0]);
        else handleSelectSubfolder(list[list.length - 1]);
        return;
      }
      const targetIdx =
        direction === 'next'
          ? (currentIdx + 1) % list.length
          : (currentIdx - 1 + list.length) % list.length;
      handleSelectSubfolder(list[targetIdx]);
    },
    [currentSubfolderList, currentSubfolder, handleSelectSubfolder]
  );

  // Dynamic overscroll management:
  // When browsing main catalog: disable Chrome horizontal back/forward overscroll navigation
  // so touchpad two-finger horizontal gestures smoothly switch tabs and pages without browser collision.
  // When a media player is open: restore overscroll so Chrome's native back works to close players!
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!isModalOpen) {
      document.documentElement.style.overscrollBehaviorX = 'none';
      document.body.style.overscrollBehaviorX = 'none';
    } else {
      document.documentElement.style.overscrollBehaviorX = 'auto';
      document.body.style.overscrollBehaviorX = 'auto';
    }
    return () => {
      document.documentElement.style.overscrollBehaviorX = 'auto';
      document.body.style.overscrollBehaviorX = 'auto';
    };
  }, [isModalOpen]);

  // 1. Laptop Touchpad Two-Finger Wheel Gesture Engine (Chrome back/forward disabled on catalog)
  useEffect(() => {
    if (isModalOpen || notFoundInfo.isOpen || showTelemetry) return;
    if (typeof window === 'undefined') return;

    let wheelAccumulatorX = 0;
    let isWheelLocked = false;
    let wheelLockTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleWheel = (e: WheelEvent) => {
      const absDeltaX = Math.abs(e.deltaX);
      const absDeltaY = Math.abs(e.deltaY);

      // Horizontal dominance guard: horizontal scroll delta must clearly exceed vertical
      if (absDeltaX > 15 && absDeltaX > absDeltaY * 1.2) {
        if (isWheelLocked) return;

        wheelAccumulatorX += e.deltaX;
        const isUpperZone = e.clientY <= window.innerHeight * 0.5;
        const THRESHOLD = 65;

        if (Math.abs(wheelAccumulatorX) >= THRESHOLD) {
          const isSwipeLeft = wheelAccumulatorX > 0; // deltaX > 0 is finger moving left -> NEXT
          isWheelLocked = true;
          wheelAccumulatorX = 0;

          if (isUpperZone) {
            handleSwipeTab(isSwipeLeft ? 'next' : 'prev');
          } else {
            handleSwipeSubfolder(isSwipeLeft ? 'next' : 'prev');
          }

          if (wheelLockTimeout) clearTimeout(wheelLockTimeout);
          wheelLockTimeout = setTimeout(() => {
            isWheelLocked = false;
            wheelAccumulatorX = 0;
          }, 550);
        }
      } else {
        wheelAccumulatorX = 0;
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      window.removeEventListener('wheel', handleWheel);
      if (wheelLockTimeout) clearTimeout(wheelLockTimeout);
    };
  }, [
    isModalOpen,
    notFoundInfo.isOpen,
    showTelemetry,
    handleSwipeTab,
    handleSwipeSubfolder,
  ]);

  // 2. Mobile & Tablet Touch Swipe Gesture Engine (50% Upper = Tabs, 50% Lower = Pages)
  useEffect(() => {
    if (isModalOpen || notFoundInfo.isOpen || showTelemetry) return;
    if (typeof window === 'undefined') return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = Date.now();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length !== 1) return;
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const duration = Date.now() - touchStartTime;

      // Strict horizontal swipe check: horizontal delta must exceed vertical by 1.5x
      if (absX > 40 && absX >= 1.5 * absY && duration < 600) {
        const isSwipeLeft = deltaX < 0; // finger swiped right-to-left -> NEXT
        const isUpperZone = touchStartY <= window.innerHeight * 0.5;

        if (isUpperZone) {
          // Upper half: Major Tabs
          handleSwipeTab(isSwipeLeft ? 'next' : 'prev');
        } else {
          // Lower half: Subfolder Pages
          handleSwipeSubfolder(isSwipeLeft ? 'next' : 'prev');
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [
    isModalOpen,
    notFoundInfo.isOpen,
    showTelemetry,
    handleSwipeTab,
    handleSwipeSubfolder,
  ]);

  return (
    <div
      className="w-screen h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col bg-transparent relative select-none font-sans text-white"
      style={{
        isolation: 'isolate',
        borderRadius: 0,
        outline: 'none',
        border: 'none',
      }}
    >
      {/* Permanent Midnight Obsidian Backdrop Canvas */}
      <CinematicBackdropCanvas theme={MIDNIGHT_OBSIDIAN_THEME} isPaused={isModalOpen} />

      {/* 404 Route Not Found Dialog (Centered with 20px blur) */}
      <MediaNotFoundDialog
        isOpen={notFoundInfo.isOpen}
        attemptedPath={notFoundInfo.path}
        suggestedTab={notFoundInfo.tab}
        onClose={() => {
          setNotFoundInfo((prev) => ({ ...prev, isOpen: false }));
          goToHome();
        }}
        onNavigateTab={(tab) => {
          setNotFoundInfo((prev) => ({ ...prev, isOpen: false }));
          if (tab === 'PHOTOGRAPHY') switchTab(1);
          else if (tab === 'SHORTS') switchTab(2);
          else if (tab === 'CLIPS') switchTab(3);
          else if (tab === 'BANDHOBI') switchTab(4);
          else {
            goToHome();
          }
        }}
      />

      {/* TOP HEADER: LOGO (LEFT) + NOTIF (CENTER) + GRAPH (RIGHT) */}
      <header
        className="w-full flex justify-between items-start pt-5 sm:pt-7 pb-2 px-4 sm:px-10 shrink-0 z-30 bg-transparent gap-2 sm:gap-4"
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      >
        {/* Left: Logo (clicking acts as Home) + Search Bar beside it */}
        <div className="flex flex-col gap-2.5 sm:gap-4 shrink-0 max-w-full">
          <div className="flex items-center gap-2 sm:gap-5 max-w-full">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                if (tabIndex === 2 && currentSubfolder === 'Featured') {
                  return;
                }
                goToHome();
              }}
              className="inline-flex items-center cursor-pointer transition-opacity hover:opacity-85 bg-transparent p-0 no-underline shrink-0"
              title="SARWAR.CYOU"
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              <LaserSparkLogo width={isPortrait ? 175 : 240} height={isPortrait ? 24 : 33} interactive={false} />
            </a>

            {/* Cyber Search Bar */}
            <CyberSearchBar
              onSearch={handleWebImageSearch}
              onClear={handleClearSearch}
              isLoading={searchState.isLoading}
            />
          </div>

          {/* Major Folders (Pure text, zero lines, zero outlines, zero borders) */}
          <nav className="flex items-center gap-5 sm:gap-6">
            <a
              href="/photographs"
              onClick={(e) => {
                e.preventDefault();
                switchTab(1);
              }}
              className={`text-[12.5px] sm:text-[13px] tracking-wide transition-colors cursor-pointer p-0 bg-transparent no-underline ${
                tabIndex === 1 ? 'text-white font-bold' : 'text-[#64748b] font-medium hover:text-white'
              }`}
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              Photographs
            </a>
            <a
              href="/clips"
              onClick={(e) => {
                e.preventDefault();
                switchTab(3);
              }}
              className={`text-[12.5px] sm:text-[13px] tracking-wide transition-colors cursor-pointer p-0 bg-transparent no-underline ${
                tabIndex === 3 ? 'text-white font-bold' : 'text-[#64748b] font-medium hover:text-white'
              }`}
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              Video Clips
            </a>
            <a
              href="/shorts"
              onClick={(e) => {
                e.preventDefault();
                switchTab(2);
              }}
              className={`text-[12.5px] sm:text-[13px] tracking-wide transition-colors cursor-pointer p-0 bg-transparent no-underline ${
                tabIndex === 2 ? 'text-white font-bold' : 'text-[#64748b] font-medium hover:text-white'
              }`}
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              Shorts
            </a>
            <a
              href="/bandhobiz"
              onClick={(e) => {
                e.preventDefault();
                switchTab(4);
              }}
              className={`text-[12.5px] sm:text-[13px] tracking-wide transition-colors cursor-pointer p-0 bg-transparent no-underline ${
                tabIndex === 4 ? 'text-white font-bold' : 'text-[#64748b] font-medium hover:text-white'
              }`}
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              bandhobiz
            </a>
          </nav>
        </div>

        {/* Center: Top-Middle Network Status (Silent on Wi-Fi) */}
        <div className="flex-1 flex justify-center pt-1">
          <TopMiddleNetworkStatus />
        </div>

        {/* Right: Clean Tactical Telemetry Graph (Desktop/Tablet Only) */}
        {!isPortrait && (
          <div className="shrink-0 flex items-center justify-end">
            <TacticalTelemetryGraph
              onSelectDay={handleOpenTelemetryWithDay}
              onClick={handleOpenTelemetry}
            />
          </div>
        )}
      </header>

      {/* MIDDLE PAGE SPACE: SIMULTANEOUS ADJACENT SLIDING PANELS (ZERO MIDDLE TIMING) */}
      <main
        className="flex-1 overflow-hidden relative z-10 scrollbar-none flex flex-col"
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      >
        {searchState.isActive ? (
          <div className="w-full h-full flex flex-col overflow-y-auto overflow-x-hidden scrollbar-none px-6 sm:px-10 py-4">
            {searchState.isLoading ? (
              /* Cyber Loading Progress Bar */
              <div className="w-full flex-1 flex flex-col items-center justify-center py-24 gap-3">
                <div className="w-48 sm:w-64 h-[2px] bg-white/10 overflow-hidden relative" style={{ borderRadius: 0 }}>
                  <div className="h-full bg-[#38bdf8] shadow-[0_0_12px_#38bdf8] animate-pulse w-full" style={{ borderRadius: 0 }} />
                </div>
                <span
                  className="font-firjar text-[11px] font-bold tracking-widest text-[#38bdf8] uppercase"
                  style={{ fontFamily: "'Firjar', 'Science Gothic', sans-serif !important" }}
                >
                  LOADING MEDIA // PLEASE WAIT
                </span>
              </div>
            ) : searchState.results.length > 0 ? (
              /* Search Results: Exact Same Monolith Rectangular Grid as Photographs */
              <div
                className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 pb-6"
                style={{ borderRadius: 0, outline: 'none', border: 'none' }}
              >
                {searchState.results.map((item: StageMediaItem, idx: number) => (
                  <LivingMediaCard
                    key={`${item.id}-${idx}`}
                    item={item}
                    aspectRatio="3/4"
                    delayIdx={idx}
                    onClick={() => onOpenPhoto(item, searchState.results, idx)}
                  />
                ))}
              </div>
            ) : (
              <div
                className="font-firjar w-full flex-1 flex items-center justify-center py-24 text-white/40 text-xs tracking-widest uppercase font-bold"
                style={{ fontFamily: "'Firjar', 'Science Gothic', sans-serif !important" }}
              >
                // NO MEDIA FOUND
              </div>
            )}
          </div>
        ) : (
          /* Instant Static Active Panel (Zero Transition Animation) */
          <div
            key={`view-${tabIndex}-${currentSubfolder}`}
            className="w-full h-full flex flex-col overflow-y-auto overflow-x-hidden scrollbar-none px-6 sm:px-10 py-4"
            style={{ borderRadius: 0, outline: 'none', border: 'none' }}
          >
            {renderViewContent(tabIndex, currentSubfolder)}
          </div>
        )}
      </main>

      {/* BOTTOM NAVIGATION BAR: DYNAMIC SUBFOLDERS (Pure text, zero borders, zero outlines) */}
      <footer
        className="w-full px-6 sm:px-10 py-3 sm:py-4 shrink-0 z-20 flex items-center bg-transparent min-h-[44px]"
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      >
        <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto scrollbar-none">
          {searchState.isActive ? (
            <button
              onClick={handleClearSearch}
              className="font-firjar text-[11.5px] sm:text-[12px] tracking-wider text-[#38bdf8] hover:text-white font-bold cursor-pointer p-0 bg-transparent border-0 outline-none flex items-center gap-2 transition-colors uppercase"
              style={{ borderRadius: 0, fontFamily: "'Firjar', 'Science Gothic', sans-serif !important" }}
            >
              <span>✕</span>
              <span>CLEAR SEARCH</span>
            </button>
          ) : (
            currentSubfolderList.map((sub) => {
              const isActive = currentSubfolder === sub;
              const href = getSubfolderHref(tabIndex, sub);
              return (
                <a
                  key={sub}
                  href={href}
                  onClick={(e) => {
                    e.preventDefault();
                    handleSelectSubfolder(sub);
                  }}
                  className={`text-[11.5px] sm:text-[12px] tracking-wide transition-colors cursor-pointer whitespace-nowrap p-0 bg-transparent no-underline ${
                    isActive ? 'text-white font-bold' : 'text-[#64748b] font-medium hover:text-white'
                  }`}
                  style={{ borderRadius: 0, outline: 'none', border: 'none' }}
                >
                  {sub}
                </a>
              );
            })
          )}
        </div>
      </footer>

      {/* 24-HOUR DEEP DIURNAL TELEMETRY MATRIX VIEW */}
      {showTelemetry && (
        <DeepDiurnalTelemetryView
          initialDayIndex={telemetryInitialDay}
          onClose={handleCloseTelemetry}
        />
      )}
    </div>
  );
};

export default MonolithBarGate;
