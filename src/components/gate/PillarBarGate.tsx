import React, { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import type { StageMediaItem } from '../../types';
import { MIDNIGHT_OBSIDIAN_THEME } from './themeManager';
import { CinematicBackdropCanvas } from './CinematicBackdropCanvas';
import { isPhotoExtension, isVideoExtension } from '../../utils/mediaTypeDetector';
import { sortMediaItemsDescending } from '../../utils/albumExtractor';
import { hapticMedium, hapticLight } from '../../utils/hapticsManager';
import { trackActivityEvent } from '../../utils/usageTelemetry';
import {
  parseAppPathname,
  updateBrowserUrl,
  findMediaByShortId,
  getMediaShortId,
  getSubfolderHref,
} from '../../utils/urlRouter';
import { MediaNotFoundDialog } from '../common/MediaNotFoundDialog';
import { BufferedMediaGrid } from './BufferedMediaGrid';
import { InitializingArchiveLoader } from './InitializingArchiveLoader';
import { LaserSparkLogo } from '../brand/LaserSparkLogo';
import { TacticalTelemetryGraph } from '../navigation/TacticalTelemetryGraph';
import { HomepageSlidingShorts } from './HomepageSlidingShorts';
import { HomepageCachedFeatured } from './HomepageCachedFeatured';
import { PhotographsSlidingFeatured } from './PhotographsSlidingFeatured';
import { VideoClipsCinemaTheater } from './VideoClipsCinemaTheater';
import { BandhobiSlidingFeaturedPhotos } from './BandhobiSlidingFeaturedPhotos';
import { DeepDiurnalTelemetryView } from '../telemetry/DeepDiurnalTelemetryView';
import { CyberSearchBar } from '../navigation/CyberSearchBar';
import { searchWebImages } from '../../services/imageSearchService';
import {
  isBrowsingOffline,
  subscribeBrowsingOffline,
  triggerOpenOfflineModal,
} from '../../utils/offlineManager';
import {
  getCachedMediaRecords,
  clearCachedMedia,
  type CacheCategory,
} from '../../utils/cachedMediaManager';
import { ClearCacheConfirmDialog } from '../common/ClearCacheConfirmDialog';
import { AddToHomeScreenDialog } from '../common/AddToHomeScreenDialog';
import { isStandalone, subscribeInstallable } from '../../utils/pwaInstallManager';

export interface PillarBarGateProps {
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

const HOMEPAGE_CACHED_SUBFOLDERS = ['Photographs', 'Shorts', 'Video Clips'];
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
  'FAV_Eva 2025 (6).jpg',
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

export const PillarBarGate: React.FC<PillarBarGateProps> = ({
  items,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
  initialAlbum: _initialAlbum,
  isModalOpen = false,
}) => {
  const initialRoute = useMemo(() => parseAppPathname(), []);

  // Visual tab display ordering: 0: Homepage, 1: Photographs, 3: Video Clips, 2: Shorts, 4: Bandhobi
  const TAB_VISUAL_ORDER = useMemo<Record<number, number>>(() => ({
    0: 0,
    1: 1,
    3: 2,
    2: 3,
    4: 4,
  }), []);

  // 0: Homepage (via Logo), 1: Photographs, 2: Shorts, 3: Video Clips, 4: Bandhobi
  const [tabIndex, setTabIndex] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const parsed = parseAppPathname();
    if (parsed.tab === 'PHOTOGRAPHY') return 1;
    if (parsed.tab === 'SHORTS') return 2;
    if (parsed.tab === 'CLIPS') return 3;
    if (parsed.tab === 'BANDHOBI') return 4;
    return 0; // Default to Homepage
  });

  const [homeSubfolder, setHomeSubfolder] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Featured';
    const parsed = parseAppPathname();
    if (parsed.tab === 'HOME' && parsed.subfolder) return parsed.subfolder;
    return 'Featured';
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
    tabIndex === 0
      ? homeSubfolder
      : tabIndex === 1
      ? photosSubfolder
      : tabIndex === 2
      ? shortsSubfolder
      : tabIndex === 3
      ? clipsSubfolder
      : bandhobiSubfolder;

  // Scroll position preservation per subfolder page (guarantees zero jump-to-top on modal close)
  const pageScrollPositionsRef = useRef<Map<string, number>>(new Map());
  const activeScrollContainerRef = useRef<HTMLDivElement | null>(null);

  const handleContainerScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    const pageId = `${tabIndex}-${currentSubfolder}`;
    pageScrollPositionsRef.current.set(pageId, top);
  }, [tabIndex, currentSubfolder]);

  // Restore exact scroll position when returning from modal or switching pages
  useLayoutEffect(() => {
    const container = activeScrollContainerRef.current;
    if (!container) return;
    const pageId = `${tabIndex}-${currentSubfolder}`;
    const savedTop = pageScrollPositionsRef.current.get(pageId);
    if (savedTop !== undefined && savedTop > 0) {
      container.scrollTop = savedTop;
    }
  }, [tabIndex, currentSubfolder, isModalOpen]);

  // Real-time cached media records
  const [cacheUpdateTrigger, setCacheUpdateTrigger] = useState<number>(0);

  useEffect(() => {
    const handleUpdate = () => {
      setCacheUpdateTrigger((prev) => prev + 1);
    };
    window.addEventListener('cached-media-updated', handleUpdate);
    return () => window.removeEventListener('cached-media-updated', handleUpdate);
  }, []);

  const { cachedPhotos, cachedShorts, cachedClips } = useMemo(() => {
    const records = getCachedMediaRecords();
    const p: StageMediaItem[] = [];
    const s: StageMediaItem[] = [];
    const c: StageMediaItem[] = [];

    records.forEach((r) => {
      if (!r || !r.item) return;
      const item = r.item;
      const isShort =
        item.mediaType === 'short' ||
        (item.path || item.url || '').toLowerCase().includes('/shorts/');
      const isVid =
        !isShort &&
        (item.type === 'video' ||
          item.mediaType === 'clip' ||
          isVideoExtension(item.path || item.url || item.name || ''));

      if (isShort) s.push(item);
      else if (isVid) c.push(item);
      else p.push(item);
    });

    return { cachedPhotos: p, cachedShorts: s, cachedClips: c };
  }, [cacheUpdateTrigger]);

  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  const handleExecuteClearCache = useCallback(
    async (deleteAll: boolean) => {
      if (deleteAll) {
        await clearCachedMedia('All');
      } else {
        const cat: CacheCategory =
          homeSubfolder === 'Photographs'
            ? 'Photographs'
            : homeSubfolder === 'Shorts'
            ? 'Shorts'
            : homeSubfolder === 'Video Clips'
            ? 'Video Clips'
            : 'All';
        await clearCachedMedia(cat);
      }
    },
    [homeSubfolder]
  );


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

  const [offlineBrowsing, setOfflineBrowsing] = useState<boolean>(() => isBrowsingOffline());
  const [isInstallDialogOpen, setIsInstallDialogOpen] = useState(false);
  const [appStandalone, setAppStandalone] = useState(() => isStandalone());

  useEffect(() => {
    setAppStandalone(isStandalone());
    const unsub = subscribeInstallable(() => {
      setAppStandalone(isStandalone());
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeBrowsingOffline((val) => {
      setOfflineBrowsing(val);
    });
    return unsub;
  }, []);

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

    if (targetIndex === 0) {
      if (tabIndex === 0 && homeSubfolder === 'Featured') return;
      setTabIndex(0);
      setHomeSubfolder('Featured');
      setShuffleTrigger((prev) => prev + 1);
      if (typeof window !== 'undefined') {
        updateBrowserUrl('/');
      }
      return;
    }

    if (targetIndex === tabIndex) {
      if (currentSubfolder === 'Featured') return;

      // Clicked active tab while in a subfolder: Switch back to Featured
      if (tabIndex === 0) setHomeSubfolder('Featured');
      else if (tabIndex === 1) setPhotosSubfolder('Featured');
      else if (tabIndex === 2) setShortsSubfolder('Featured');
      else if (tabIndex === 3) setClipsSubfolder('Featured');
      else if (tabIndex === 4) setBandhobiSubfolder('Featured');
      setShuffleTrigger((prev) => prev + 1);

      if (typeof window !== 'undefined') {
        let route = '/shorts';
        if (tabIndex === 0) route = '/';
        else if (tabIndex === 1) route = '/photographs';
        else if (tabIndex === 2) route = '/shorts';
        else if (tabIndex === 3) route = '/clips';
        else if (tabIndex === 4) route = '/bandhobiz';
        updateBrowserUrl(route);
      }
      return;
    }

    setTabIndex(targetIndex);
    if (targetIndex === 0) setHomeSubfolder('Featured');
    else if (targetIndex === 1) setPhotosSubfolder('Featured');
    else if (targetIndex === 2) setShortsSubfolder('Featured');
    else if (targetIndex === 3) setClipsSubfolder('Featured');
    else if (targetIndex === 4) setBandhobiSubfolder('Featured');
    setShuffleTrigger((prev) => prev + 1);

    if (typeof window !== 'undefined') {
      let route = '/shorts';
      if (targetIndex === 0) route = '/';
      else if (targetIndex === 1) route = '/photographs';
      else if (targetIndex === 2) route = '/shorts';
      else if (targetIndex === 3) route = '/clips';
      else if (targetIndex === 4) route = '/bandhobiz';
      updateBrowserUrl(route);
    }
  }, [tabIndex, currentSubfolder, homeSubfolder, handleClearSearch]);

  // Navigate directly to Homepage at '/' (triggered via website logo)
  const goToHome = useCallback(() => {
    handleClearSearch();
    if (tabIndex === 0 && homeSubfolder === 'Featured') return;

    setTabIndex(0);
    setHomeSubfolder('Featured');
    setShuffleTrigger((prev) => prev + 1);

    if (typeof window !== 'undefined') {
      updateBrowserUrl('/');
    }
  }, [tabIndex, homeSubfolder, handleClearSearch]);

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
        // Root / or /cached lands on Homepage
        setTabIndex(0);
        setHomeSubfolder(parsed.subfolder || 'Featured');
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

    // Ensure all subfolders strictly display latest media first (newest first)
    for (const rootNode of map.values()) {
      rootNode.files = sortMediaItemsDescending(rootNode.files);
      for (const subNode of rootNode.subfolders.values()) {
        subNode.files = sortMediaItemsDescending(subNode.files);
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
    }
  }, [items, initialRoute, launchMatchedItem]);

  const currentSubfolderList =
    tabIndex === 0
      ? HOMEPAGE_CACHED_SUBFOLDERS
      : tabIndex === 1
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

      if (tabIndex === 0) {
        setHomeSubfolder(sub);
        if (typeof window !== 'undefined') updateBrowserUrl(getSubfolderHref(0, sub));
      } else if (tabIndex === 1) {
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
      if (viewTab === 0) {
        if (viewSub === 'Featured') {
          return (
            <HomepageCachedFeatured
              allItems={items}
              onOpenPhoto={(item: StageMediaItem, playlist: StageMediaItem[], idx: number) =>
                onOpenPhoto(item, playlist, idx)
              }
              onOpenShort={(item: StageMediaItem, playlist: StageMediaItem[], idx: number, folder?: string) =>
                onOpenShort(item, playlist, idx, folder || 'Cached')
              }
              onOpenVideo={(item: StageMediaItem, playlist: StageMediaItem[]) =>
                onOpenVideo(item, playlist)
              }
              isPortrait={isPortrait}
              portraitSelectedDay={portraitSelectedDay}
              setPortraitSelectedDay={setPortraitSelectedDay}
              randomSeed={shuffleTrigger}
            />
          );
        }

        // Homepage Cached Subfolder Pages: Photographs, Shorts, Video Clips
        let cachedItems: StageMediaItem[] = [];
        let aspectRatio: '3/4' | '9/16' | '16/9' = '3/4';

        if (viewSub === 'Photographs') {
          cachedItems = cachedPhotos;
          aspectRatio = '3/4';
        } else if (viewSub === 'Shorts') {
          cachedItems = cachedShorts;
          aspectRatio = '9/16';
        } else if (viewSub === 'Video Clips') {
          cachedItems = cachedClips;
          aspectRatio = '16/9';
        }

        if (cachedItems.length === 0) {
          return (
            <div className="w-full flex-1 flex flex-col items-center justify-center py-24 select-none">
              <span
                className="font-firjar text-[#64748b] text-xs font-mono tracking-widest uppercase"
                style={{ fontFamily: "'Firjar', 'Science Gothic', sans-serif !important" }}
              >
                // NO CACHED {viewSub.toUpperCase()}
              </span>
              <span className="text-[#475569] text-[11px] mt-2 font-mono tracking-wider">
                MEDIA CACHES AUTOMATICALLY FOR 7 DAYS AS YOU BROWSE
              </span>
            </div>
          );
        }

        return (
          <BufferedMediaGrid
            key={`cached-${viewSub}`}
            pageKey={`cached-${viewSub}`}
            itemsList={cachedItems}
            aspectRatio={aspectRatio}
            onOpenItem={(item: StageMediaItem, list: StageMediaItem[], idx: number) => {
              if (viewSub === 'Photographs') onOpenPhoto(item, list, idx);
              else if (viewSub === 'Shorts') onOpenShort(item, list, idx, 'Cached');
              else onOpenVideo(item, list);
            }}
            hapticMedium={hapticMedium}
            trackActivityEvent={trackActivityEvent}
          />
        );
      }

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

      const getSubNode = (hubKey: string, subKey: string) => {
        const rootNode = rootMap.get(hubKey);
        if (!rootNode) return undefined;
        if (rootNode.subfolders.has(subKey)) return rootNode.subfolders.get(subKey);
        const subLower = subKey.toLowerCase();
        for (const [k, v] of rootNode.subfolders.entries()) {
          if (k.toLowerCase() === subLower) return v;
        }
        return undefined;
      };

      if (viewTab === 1) {
        aspectRatio = '3/4';
        if (viewSub === 'Featured' || viewSub === 'ALL') itemsList = allPhotosFiles;
        else {
          const node = getSubNode('Photographs', viewSub);
          itemsList = node && node.files.length > 0 ? node.files : allPhotosFiles;
        }
      } else if (viewTab === 2) {
        aspectRatio = '9/16';
        if (viewSub === 'Featured') itemsList = allShortsFiles;
        else {
          const node = getSubNode('Shorts', viewSub);
          itemsList = node && node.files.length > 0 ? node.files : allShortsFiles;
        }
      } else if (viewTab === 3) {
        aspectRatio = '16/9';
        if (viewSub === 'Featured' || viewSub === 'ALL') itemsList = allClipsFiles;
        else {
          const node = getSubNode('Video Clips', viewSub);
          itemsList = node && node.files.length > 0 ? node.files : allClipsFiles;
        }
      } else if (viewTab === 4) {
        if (viewSub === 'Photographs') {
          aspectRatio = '3/4';
          const node = getSubNode('bandhobiz', 'Photographs') || getSubNode('Bandhobi', 'Photographs');
          itemsList = node && node.files.length > 0 ? node.files : [];
        } else if (viewSub === 'Shorts') {
          aspectRatio = '9/16';
          const node = getSubNode('bandhobiz', 'Shorts') || getSubNode('Bandhobi', 'Shorts');
          itemsList = node && node.files.length > 0 ? node.files : [];
        } else {
          aspectRatio = '16/9';
          const node = getSubNode('bandhobiz', 'Video Clips') || getSubNode('Bandhobi', 'Video Clips');
          itemsList = node && node.files.length > 0 ? node.files : [];
        }
      }

      return (
        <BufferedMediaGrid
          key={`page-${viewTab}-${viewSub}`}
          pageKey={`page-${viewTab}-${viewSub}`}
          itemsList={itemsList}
          aspectRatio={aspectRatio}
          onOpenItem={(item: StageMediaItem, list: StageMediaItem[], idx: number) => {
            const isPhoto = item.type === 'image' || isPhotoExtension(item.path || item.url || item.name || '');
            const isShort = item.mediaType === 'short' || (item.path || item.url || '').toLowerCase().includes('/shorts/');
            if (viewTab === 1) onOpenPhoto(item, list, idx);
            else if (viewTab === 2) onOpenShort(item, list, idx, 'Shorts');
            else if (viewTab === 3) onOpenVideo(item, list);
            else if (viewTab === 4) {
              if (viewSub === 'Photographs' || isPhoto) onOpenPhoto(item, list, idx);
              else if (viewSub === 'Shorts' || isShort) onOpenShort(item, list, idx, 'Bandhobi');
              else onOpenVideo(item, list);
            }
          }}
          hapticMedium={hapticMedium}
          trackActivityEvent={trackActivityEvent}
        />
      );
    },
    [items, allPhotosFiles, allShortsFiles, allClipsFiles, activeBandhobiList, cachedPhotos, cachedShorts, cachedClips, rootMap, isPortrait, portraitSelectedDay, shuffleTrigger, onOpenPhoto, onOpenShort, onOpenVideo]
  );

  // -------------------------------------------------------------
  // DUAL-ZONE TOUCH SWIPE ENGINE (MOBILE & TABLET ONLY)
  // Completely disabled on desktop to preserve Chrome native back/forward.
  // Upper Half (<= 50% height) -> Major Tabs Turn
  // Lower Half (> 50% height)  -> Subfolder Pages Turn
  // -------------------------------------------------------------
  const TAB_SEQUENCE = useMemo(() => [0, 1, 3, 2, 4], []);

  const handleSwipeTab = useCallback(
    (direction: 'next' | 'prev') => {
      const currentVis = TAB_VISUAL_ORDER[tabIndex] ?? 0;
      const targetVis =
        direction === 'next'
          ? (currentVis + 1) % TAB_SEQUENCE.length
          : (currentVis - 1 + TAB_SEQUENCE.length) % TAB_SEQUENCE.length;
      const targetTab = TAB_SEQUENCE[targetVis];
      if (targetTab === 0) {
        goToHome();
      } else if (targetTab !== undefined) {
        switchTab(targetTab);
      }
    },
    [tabIndex, TAB_VISUAL_ORDER, TAB_SEQUENCE, switchTab, goToHome]
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

  // Gesture callback refs to prevent re-attaching listeners on every state change
  const handleSwipeTabRef = useRef(handleSwipeTab);
  handleSwipeTabRef.current = handleSwipeTab;

  const handleSwipeSubfolderRef = useRef(handleSwipeSubfolder);
  handleSwipeSubfolderRef.current = handleSwipeSubfolder;

  // Persistent touchpad lock refs (survives tab/subfolder re-renders without reset)
  const isWheelLockedRef = useRef<boolean>(false);
  const wheelAccumulatorXRef = useRef<number>(0);
  const wheelLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Laptop Touchpad Two-Finger Wheel Gesture Engine (Single deliberate action per physical swipe)
  useEffect(() => {
    if (isModalOpen || notFoundInfo.isOpen || showTelemetry) return;
    if (typeof window === 'undefined') return;

    const handleWheel = (e: WheelEvent) => {
      const absDeltaX = Math.abs(e.deltaX);
      const absDeltaY = Math.abs(e.deltaY);

      // If locked from a previous action in the current swipe, discard all residual momentum events
      if (isWheelLockedRef.current) {
        wheelAccumulatorXRef.current = 0;
        // Extend lock while momentum events are still streaming from trackpad inertia
        if (wheelLockTimerRef.current) clearTimeout(wheelLockTimerRef.current);
        wheelLockTimerRef.current = setTimeout(() => {
          isWheelLockedRef.current = false;
          wheelAccumulatorXRef.current = 0;
        }, 350);
        return;
      }

      // Horizontal dominance guard: horizontal scroll delta must clearly exceed vertical
      if (absDeltaX > 15 && absDeltaX > absDeltaY * 1.2) {
        wheelAccumulatorXRef.current += e.deltaX;
        const isUpperZone = e.clientY <= window.innerHeight * 0.5;
        const THRESHOLD = 75;

        if (Math.abs(wheelAccumulatorXRef.current) >= THRESHOLD) {
          const isSwipeLeft = wheelAccumulatorXRef.current > 0; // deltaX > 0 is finger moving left -> NEXT
          // Engage persistent lock
          isWheelLockedRef.current = true;
          wheelAccumulatorXRef.current = 0;

          if (isUpperZone) {
            handleSwipeTabRef.current(isSwipeLeft ? 'next' : 'prev');
          } else {
            handleSwipeSubfolderRef.current(isSwipeLeft ? 'next' : 'prev');
          }

          if (wheelLockTimerRef.current) clearTimeout(wheelLockTimerRef.current);
          wheelLockTimerRef.current = setTimeout(() => {
            isWheelLockedRef.current = false;
            wheelAccumulatorXRef.current = 0;
          }, 700);
        }
      } else {
        wheelAccumulatorXRef.current = 0;
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      window.removeEventListener('wheel', handleWheel);
      if (wheelLockTimerRef.current) clearTimeout(wheelLockTimerRef.current);
    };
  }, [isModalOpen, notFoundInfo.isOpen, showTelemetry]);

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
      if (absX > 45 && absX >= 1.5 * absY && duration < 600) {
        const isSwipeLeft = deltaX < 0; // finger swiped right-to-left -> NEXT
        const isUpperZone = touchStartY <= window.innerHeight * 0.5;

        if (isUpperZone) {
          // Upper half: Major Tabs
          handleSwipeTabRef.current(isSwipeLeft ? 'next' : 'prev');
        } else {
          // Lower half: Subfolder Pages
          handleSwipeSubfolderRef.current(isSwipeLeft ? 'next' : 'prev');
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isModalOpen, notFoundInfo.isOpen, showTelemetry]);

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
        {/* Left: Logo (clicking acts as Home) + Search Bar beside it on Desktop */}
        <div className="flex flex-col gap-2.5 sm:gap-4 shrink-0 max-w-full">
          <div className="flex items-center gap-2 sm:gap-5 max-w-full">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                goToHome();
              }}
              className="inline-flex items-center cursor-pointer transition-opacity hover:opacity-85 bg-transparent p-0 no-underline shrink-0"
              title="SARWAR.CYOU"
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              <LaserSparkLogo width={isPortrait ? 175 : 240} height={isPortrait ? 24 : 33} interactive={false} />
            </a>

            {/* Universal Search Bar beside Logo for Any Screen */}
            <CyberSearchBar
              onSearch={handleWebImageSearch}
              onClear={handleClearSearch}
              isLoading={searchState.isLoading}
            />

            {/* Offline Text Indicator beside Search Box */}
            {offlineBrowsing && (
              <span
                onClick={triggerOpenOfflineModal}
                className="text-[11px] sm:text-[12px] font-mono font-bold tracking-[0.14em] uppercase text-[#ef4444] animate-pulse shrink-0 cursor-pointer select-none"
                title="Browsing in Offline Mode (Click to open network dialog)"
                style={{ borderRadius: 0 }}
              >
                OFFLINE
              </span>
            )}
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

        {/* Center: Spacer */}
        <div className="flex-1" />

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
              /* High-Tech Cybernetic Text-as-Slider Loading */
              <div className="w-full flex-1 flex items-center justify-center py-28 px-4 select-none">
                <InitializingArchiveLoader progress={70} scheme="red" />
              </div>
            ) : searchState.results.length > 0 ? (
              /* Search Results: Buffered Pillar Grid */
              <BufferedMediaGrid
                key={`search-${searchState.query}`}
                pageKey={`search-${searchState.query}`}
                itemsList={searchState.results}
                aspectRatio="3/4"
                onOpenItem={(item, list, idx) => onOpenPhoto(item, list, idx)}
                hapticMedium={hapticMedium}
                trackActivityEvent={trackActivityEvent}
              />
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
          /* Instant Switch Container (Zero tab/page animation, direct loading gate) */
          <div
            ref={activeScrollContainerRef}
            onScroll={handleContainerScroll}
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
        className="w-full px-6 sm:px-10 py-3 sm:py-4 shrink-0 z-20 flex items-center justify-between bg-transparent min-h-[44px]"
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

        {/* Bottom Right Corner: Controls (INSTALL APP + CLEAR CACHE) */}
        <div className="flex items-center shrink-0 ml-auto pl-4">
          {!appStandalone && tabIndex === 0 && !searchState.isActive && (
            <button
              onClick={() => {
                hapticLight();
                setIsInstallDialogOpen(true);
              }}
              className="font-firjar text-[11px] sm:text-[11.5px] text-[#38bdf8] hover:text-white tracking-wider uppercase font-bold cursor-pointer transition-colors bg-transparent border-0 outline-none p-0 whitespace-nowrap select-none flex items-center gap-1 mr-4"
              style={{ borderRadius: 0, outline: 'none', border: 'none', fontFamily: "'Firjar', 'Science Gothic', sans-serif !important" }}
              title="Add Sarwar C You to Home Screen"
            >
              <span className="text-[#38bdf8] text-xs font-black">+</span>
              <span>APP</span>
            </button>
          )}

          {/* CLEAR CACHE (Available on Homepage cached tab when cached items exist) */}
          {tabIndex === 0 && (cachedPhotos.length > 0 || cachedShorts.length > 0 || cachedClips.length > 0) && !searchState.isActive && (
            <button
              onClick={() => {
                hapticMedium();
                setIsClearConfirmOpen(true);
              }}
              className="font-firjar text-[11.5px] sm:text-[12px] text-[#ef4444] hover:text-[#f87171] tracking-wider uppercase font-bold cursor-pointer transition-colors bg-transparent border-0 outline-none p-0 whitespace-nowrap select-none"
              style={{ borderRadius: 0, outline: 'none', border: 'none', fontFamily: "'Firjar', 'Science Gothic', sans-serif !important" }}
            >
              CLEAR CACHE
            </button>
          )}
        </div>
      </footer>

      {/* Clear Cache Confirmation Dialog */}
      <ClearCacheConfirmDialog
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        currentPageName={homeSubfolder}
        onConfirm={handleExecuteClearCache}
      />

      {/* Add to Home Screen Dialog */}
      <AddToHomeScreenDialog
        isOpen={isInstallDialogOpen}
        onClose={() => setIsInstallDialogOpen(false)}
      />

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

export default PillarBarGate;
