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

const PHOTO_SUBFOLDERS = ['ALL', 'Favorite', '2027', '2026', '2025', 'Older'];
const SHORTS_SUBFOLDERS = ['Featured', '2027', 'Older'];
const CLIPS_SUBFOLDERS = ['ALL', 'Favorite', '2027', '2026', 'Older'];
const BANDHOBI_SUBFOLDERS = ['Featured', 'Photographs', 'Video Clips', 'Shorts'];

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

function shuffleArray<T>(list: T[]): T[] {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

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
    if (typeof window === 'undefined') return 'ALL';
    const parsed = parseAppPathname();
    if (parsed.tab === 'PHOTOGRAPHY' && parsed.subfolder) return parsed.subfolder;
    return 'ALL';
  });
  const [shortsSubfolder, setShortsSubfolder] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Featured';
    const parsed = parseAppPathname();
    if (parsed.tab === 'SHORTS') return parsed.subfolder || '2027';
    if (parsed.tab === 'TRAILER') return 'Featured';
    return 'Featured';
  });
  const [clipsSubfolder, setClipsSubfolder] = useState<string>(() => {
    if (typeof window === 'undefined') return 'ALL';
    const parsed = parseAppPathname();
    if (parsed.tab === 'CLIPS' && parsed.subfolder) return parsed.subfolder;
    return 'ALL';
  });
  const [bandhobiSubfolder, setBandhobiSubfolder] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Featured';
    const parsed = parseAppPathname();
    if (parsed.tab === 'BANDHOBI' && parsed.subfolder) return parsed.subfolder;
    return 'Featured';
  });
  const [shuffleTrigger, setShuffleTrigger] = useState<number>(0);

  // Content display state (synchronized with Quantum 0.25x speed directional transitions)
  const [displayedTab, setDisplayedTab] = useState<number>(() => tabIndex);
  const [displayedPhotosSub, setDisplayedPhotosSub] = useState<string>(() => photosSubfolder);
  const [displayedShortsSub, setDisplayedShortsSub] = useState<string>(() => shortsSubfolder);
  const [displayedClipsSub, setDisplayedClipsSub] = useState<string>(() => clipsSubfolder);
  const [displayedBandhobiSub, setDisplayedBandhobiSub] = useState<string>(() => bandhobiSubfolder);
  const [quantumAnimClass, setQuantumAnimClass] = useState<string>('');
  const transitionTimerRef = useRef<{ t1?: ReturnType<typeof setTimeout>; t2?: ReturnType<typeof setTimeout> }>({});

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
    if (targetIndex === tabIndex) return;

    const currentVis = TAB_VISUAL_ORDER[tabIndex] ?? 0;
    const targetVis = TAB_VISUAL_ORDER[targetIndex] ?? 0;
    const isForward = targetVis >= currentVis;
    const exitClass = isForward ? 'animate-quantum-tab-exit-fwd' : 'animate-quantum-tab-exit-bwd';
    const enterClass = isForward ? 'animate-quantum-tab-enter-fwd' : 'animate-quantum-tab-enter-bwd';

    // Clear existing animation timers
    if (transitionTimerRef.current.t1) clearTimeout(transitionTimerRef.current.t1);
    if (transitionTimerRef.current.t2) clearTimeout(transitionTimerRef.current.t2);

    // Instantly highlight target nav button and update route
    setTabIndex(targetIndex);
    if (targetIndex === 1) setPhotosSubfolder('ALL');
    else if (targetIndex === 2) setShortsSubfolder('2027');
    else if (targetIndex === 3) setClipsSubfolder('ALL');
    else if (targetIndex === 4) setBandhobiSubfolder('Featured');
    setShuffleTrigger((prev) => prev + 1);

    if (typeof window !== 'undefined') {
      let route = '/';
      if (targetIndex === 1) route = '/photographs';
      else if (targetIndex === 2) route = '/shorts';
      else if (targetIndex === 3) route = '/clips';
      else if (targetIndex === 4) route = '/bandhobiz';
      updateBrowserUrl(route);
    }

    // Quantum 0.25x speed: 800ms exit sweep, then swap displayed content and 880ms enter sweep
    setQuantumAnimClass(exitClass);

    transitionTimerRef.current.t1 = setTimeout(() => {
      setDisplayedTab(targetIndex);
      if (targetIndex === 1) setDisplayedPhotosSub('ALL');
      else if (targetIndex === 2) setDisplayedShortsSub('2027');
      else if (targetIndex === 3) setDisplayedClipsSub('ALL');
      else if (targetIndex === 4) setDisplayedBandhobiSub('Featured');

      setQuantumAnimClass(enterClass);

      transitionTimerRef.current.t2 = setTimeout(() => {
        setQuantumAnimClass('');
      }, 880);
    }, 800);
  }, [tabIndex, TAB_VISUAL_ORDER]);

  // Navigate directly to the real homepage (Shorts -> Featured showcase at root '/')
  const goToHome = useCallback(() => {
    handleClearSearch();
    if (transitionTimerRef.current.t1) clearTimeout(transitionTimerRef.current.t1);
    if (transitionTimerRef.current.t2) clearTimeout(transitionTimerRef.current.t2);

    setTabIndex(2);
    setShortsSubfolder('Featured');
    setDisplayedTab(2);
    setDisplayedShortsSub('Featured');
    setQuantumAnimClass('');
    setShuffleTrigger((prev) => prev + 1);

    if (typeof window !== 'undefined') {
      updateBrowserUrl('/');
    }
  }, []);

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
        const sub = parsed.subfolder || 'ALL';
        setPhotosSubfolder(sub);
        setDisplayedPhotosSub(sub);
        setTabIndex(1);
        setDisplayedTab(1);
      } else if (parsed.tab === 'SHORTS') {
        const sub = parsed.subfolder || '2027';
        setShortsSubfolder(sub);
        setDisplayedShortsSub(sub);
        setTabIndex(2);
        setDisplayedTab(2);
      } else if (parsed.tab === 'CLIPS') {
        const sub = parsed.subfolder || 'ALL';
        setClipsSubfolder(sub);
        setDisplayedClipsSub(sub);
        setTabIndex(3);
        setDisplayedTab(3);
      } else if (parsed.tab === 'BANDHOBI') {
        const sub = parsed.subfolder || 'Featured';
        setBandhobiSubfolder(sub);
        setDisplayedBandhobiSub(sub);
        setTabIndex(4);
        setDisplayedTab(4);
      } else {
        setShortsSubfolder('Featured');
        setDisplayedShortsSub('Featured');
        setTabIndex(2);
        setDisplayedTab(2);
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

  // Active subfolder-filtered lists (ALL is shuffled, subfolders are strictly newest first)
  const activePhotosList: StageMediaItem[] = useMemo(() => {
    if (displayedPhotosSub === 'ALL') return shuffleArray(allPhotosFiles);
    const node = rootMap.get('Photographs')?.subfolders.get(displayedPhotosSub);
    return node && node.files.length > 0 ? sortMediaItemsDescending<StageMediaItem>(node.files) : allPhotosFiles;
  }, [allPhotosFiles, rootMap, displayedPhotosSub, shuffleTrigger]);

  const activeShortsList: StageMediaItem[] = useMemo(() => {
    if (displayedShortsSub === 'Featured') return allShortsFiles;
    const node = rootMap.get('Shorts')?.subfolders.get(displayedShortsSub);
    return node && node.files.length > 0 ? sortMediaItemsDescending<StageMediaItem>(node.files) : allShortsFiles;
  }, [allShortsFiles, rootMap, displayedShortsSub]);

  const activeClipsList: StageMediaItem[] = useMemo(() => {
    if (displayedClipsSub === 'ALL') return shuffleArray(allClipsFiles);
    const node = rootMap.get('Video Clips')?.subfolders.get(displayedClipsSub);
    return node && node.files.length > 0 ? sortMediaItemsDescending<StageMediaItem>(node.files) : allClipsFiles;
  }, [allClipsFiles, rootMap, displayedClipsSub, shuffleTrigger]);

  const activeBandhobiList: StageMediaItem[] = useMemo(() => {
    if (displayedBandhobiSub === 'Featured') {
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
    }
    const node = rootMap.get('bandhobiz')?.subfolders.get(displayedBandhobiSub) || rootMap.get('Bandhobi')?.subfolders.get(displayedBandhobiSub);
    return node && node.files.length > 0 ? sortMediaItemsDescending<StageMediaItem>(node.files) : [];
  }, [rootMap, displayedBandhobiSub, shuffleTrigger]);

  const handleOpenItem = useCallback(
    (item: StageMediaItem, index: number = 0) => {
      hapticMedium();
      trackActivityEvent(1);

      const isPhoto = item.type === 'image' || isPhotoExtension(item.path || item.url || item.name || '');
      const isShort =
        item.mediaType === 'short' ||
        item.path?.toLowerCase().includes('short') ||
        item.url?.toLowerCase().includes('short');

      if (displayedTab === 1) {
        onOpenPhoto(item, activePhotosList, index);
        return;
      }
      if (displayedTab === 2) {
        onOpenShort(item, activeShortsList, index, 'Shorts');
        return;
      }
      if (displayedTab === 3) {
        onOpenVideo(item, activeClipsList);
        return;
      }
      if (displayedTab === 4) {
        if (displayedBandhobiSub === 'Photographs' || isPhoto) {
          onOpenPhoto(item, activeBandhobiList, index);
        } else if (displayedBandhobiSub === 'Shorts' || isShort) {
          onOpenShort(item, activeBandhobiList, index, 'Bandhobi');
        } else {
          onOpenVideo(item, activeBandhobiList);
        }
        return;
      }

      if (isPhoto) {
        onOpenPhoto(item, activePhotosList, index);
      } else if (isShort) {
        onOpenShort(item, activeShortsList, index, 'Shorts');
      } else {
        onOpenVideo(item, activeClipsList);
      }
    },
    [displayedTab, activeBandhobiList, activePhotosList, activeShortsList, activeClipsList, onOpenPhoto, onOpenShort, onOpenVideo]
  );

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
        setDisplayedTab(4);
        const subName = subfolders[0] || (isPhoto ? 'Photographs' : isShort ? 'Shorts' : 'Video Clips');
        setBandhobiSubfolder(subName);
        setDisplayedBandhobiSub(subName);

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
        setDisplayedTab(1);
        const subName = subfolders[0] || 'ALL';
        setPhotosSubfolder(subName);
        setDisplayedPhotosSub(subName);

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
        setDisplayedTab(2);
        const subName = subfolders[0] || '2027';
        setShortsSubfolder(subName);
        setDisplayedShortsSub(subName);

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
      setDisplayedTab(3);
      const subName = subfolders[0] || 'ALL';
      setClipsSubfolder(subName);
      setDisplayedClipsSub(subName);

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

  // Active list & subfolder list resolution
  const currentActiveList =
    displayedTab === 1
      ? activePhotosList
      : displayedTab === 2
      ? activeShortsList
      : displayedTab === 3
      ? activeClipsList
      : activeBandhobiList;

  const currentSubfolderList =
    tabIndex === 1
      ? PHOTO_SUBFOLDERS
      : tabIndex === 2
      ? SHORTS_SUBFOLDERS
      : tabIndex === 3
      ? CLIPS_SUBFOLDERS
      : BANDHOBI_SUBFOLDERS;

  const currentSubfolder =
    tabIndex === 1
      ? photosSubfolder
      : tabIndex === 2
      ? shortsSubfolder
      : tabIndex === 3
      ? clipsSubfolder
      : bandhobiSubfolder;

  const handleSelectSubfolder = (sub: string) => {
    const currentSub =
      tabIndex === 1
        ? photosSubfolder
        : tabIndex === 2
        ? shortsSubfolder
        : tabIndex === 3
        ? clipsSubfolder
        : bandhobiSubfolder;
    if (sub === currentSub) return;

    const list = currentSubfolderList;
    const currentIdx = list.indexOf(currentSub);
    const targetIdx = list.indexOf(sub);
    const isForward = targetIdx >= currentIdx;
    const exitClass = isForward ? 'animate-quantum-tab-exit-fwd' : 'animate-quantum-tab-exit-bwd';
    const enterClass = isForward ? 'animate-quantum-tab-enter-fwd' : 'animate-quantum-tab-enter-bwd';

    if (sub === 'ALL' || sub === 'Featured') {
      setShuffleTrigger((prev) => prev + 1);
    }
    if (tabIndex === 1) {
      setPhotosSubfolder(sub);
      if (typeof window !== 'undefined') {
        updateBrowserUrl(getSubfolderHref(1, sub));
      }
    } else if (tabIndex === 2) {
      setShortsSubfolder(sub);
      if (typeof window !== 'undefined') {
        updateBrowserUrl(getSubfolderHref(2, sub));
      }
    } else if (tabIndex === 3) {
      setClipsSubfolder(sub);
      if (typeof window !== 'undefined') {
        updateBrowserUrl(getSubfolderHref(3, sub));
      }
    } else if (tabIndex === 4) {
      setBandhobiSubfolder(sub);
      if (typeof window !== 'undefined') {
        updateBrowserUrl(getSubfolderHref(4, sub));
      }
    }

    // Clear existing animation timers
    if (transitionTimerRef.current.t1) clearTimeout(transitionTimerRef.current.t1);
    if (transitionTimerRef.current.t2) clearTimeout(transitionTimerRef.current.t2);

    // Quantum 0.25x speed: 800ms exit sweep, swap displayed content, then 880ms enter sweep
    setQuantumAnimClass(exitClass);

    transitionTimerRef.current.t1 = setTimeout(() => {
      if (tabIndex === 1) setDisplayedPhotosSub(sub);
      else if (tabIndex === 2) setDisplayedShortsSub(sub);
      else if (tabIndex === 3) setDisplayedClipsSub(sub);
      else if (tabIndex === 4) setDisplayedBandhobiSub(sub);

      setQuantumAnimClass(enterClass);

      transitionTimerRef.current.t2 = setTimeout(() => {
        setQuantumAnimClass('');
      }, 880);
    }, 800);
  };

  // -------------------------------------------------------------
  // DUAL-ZONE GESTURE & TOUCHPAD ENGINE
  // Upper Half (<= 40% height) -> Major Tabs Turn
  // Lower Half (> 40% height)  -> Subfolder Pages Turn
  // Exception: Featured sliding cards scrub directly
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
      if (currentIdx === -1) return;
      const targetIdx =
        direction === 'next'
          ? (currentIdx + 1) % list.length
          : (currentIdx - 1 + list.length) % list.length;
      handleSelectSubfolder(list[targetIdx]);
    },
    [currentSubfolderList, currentSubfolder, handleSelectSubfolder]
  );

  // 1. Laptop Touchpad Two-Finger Wheel Gesture Engine
  useEffect(() => {
    if (isModalOpen || notFoundInfo.isOpen || showTelemetry) return;

    let wheelAccumulatorX = 0;
    let isWheelLocked = false;
    let wheelLockTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleWheel = (e: WheelEvent) => {
      // Ignore if user is interacting with featured sliding cards
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.closest('[data-card-index]') ||
          target.closest('.animate-homepage-slow-slide') ||
          target.closest('.animate-bandhobi-slow-slide'))
      ) {
        return;
      }

      // Horizontal dominance filter (|deltaX| must clearly exceed |deltaY|)
      const absDeltaX = Math.abs(e.deltaX);
      const absDeltaY = Math.abs(e.deltaY);

      if (absDeltaX > 15 && absDeltaX > absDeltaY * 1.2) {
        if (isWheelLocked) return;

        wheelAccumulatorX += e.deltaX;
        const isUpperZone = e.clientY <= window.innerHeight * 0.4;
        const THRESHOLD = 65;

        if (Math.abs(wheelAccumulatorX) >= THRESHOLD) {
          const isSwipeLeft = wheelAccumulatorX > 0;
          isWheelLocked = true;
          wheelAccumulatorX = 0;

          if (isUpperZone) {
            handleSwipeTab(isSwipeLeft ? 'next' : 'prev');
          } else {
            const isFeatured =
              (tabIndex === 2 && shortsSubfolder === 'Featured') ||
              (tabIndex === 4 && bandhobiSubfolder === 'Featured');
            if (!isFeatured) {
              handleSwipeSubfolder(isSwipeLeft ? 'next' : 'prev');
            }
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
    tabIndex,
    shortsSubfolder,
    bandhobiSubfolder,
    handleSwipeTab,
    handleSwipeSubfolder,
  ]);

  // 2. Mobile Touch Swipe Gesture Engine
  useEffect(() => {
    if (isModalOpen || notFoundInfo.isOpen || showTelemetry) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let isIgnoredTouch = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = Date.now();

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.closest('[data-card-index]') ||
          target.closest('.animate-homepage-slow-slide') ||
          target.closest('.animate-bandhobi-slow-slide'))
      ) {
        isIgnoredTouch = true;
      } else {
        isIgnoredTouch = false;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isIgnoredTouch) {
        isIgnoredTouch = false;
        return;
      }
      if (e.changedTouches.length !== 1) return;
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const duration = Date.now() - touchStartTime;

      if (absX > 45 && absX >= 1.5 * absY && duration < 600) {
        const isSwipeLeft = deltaX < 0;
        const isUpperZone = touchStartY <= window.innerHeight * 0.4;

        if (isUpperZone) {
          handleSwipeTab(isSwipeLeft ? 'next' : 'prev');
        } else {
          const isFeatured =
            (tabIndex === 2 && shortsSubfolder === 'Featured') ||
            (tabIndex === 4 && bandhobiSubfolder === 'Featured');
          if (!isFeatured) {
            handleSwipeSubfolder(isSwipeLeft ? 'next' : 'prev');
          }
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
    tabIndex,
    shortsSubfolder,
    bandhobiSubfolder,
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
                if (tabIndex === 2 && shortsSubfolder === 'Featured' && displayedShortsSub === 'Featured') {
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
                if (tabIndex === 2 && (shortsSubfolder === 'Featured' || displayedShortsSub === 'Featured')) {
                  handleSelectSubfolder('2027');
                } else {
                  switchTab(2);
                }
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

        {/* Right: Clean Tactical Telemetry Graph (Desktop Only - Zero Text Noise) */}
        {!isPortrait && (
          <div className="shrink-0">
            <TacticalTelemetryGraph
              onSelectDay={handleOpenTelemetryWithDay}
              onClick={handleOpenTelemetry}
            />
          </div>
        )}
      </header>

      {/* MIDDLE PAGE SPACE: HOMEPAGE SLIDING SHORTS OR RECTANGULAR MEDIA GRID */}
      <main
        className="flex-1 overflow-hidden px-6 sm:px-10 py-4 relative z-10 scrollbar-none flex flex-col"
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      >
        <div
          className={`w-full h-full flex-1 flex flex-col overflow-y-auto overflow-x-hidden scrollbar-none ${quantumAnimClass}`}
          style={{ borderRadius: 0, outline: 'none', border: 'none' }}
        >
          {searchState.isActive ? (
            searchState.isLoading ? (
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
            )
          ) : displayedTab === 2 && displayedShortsSub === 'Featured' ? (
            isPortrait ? (
              /* Portrait Screen Homepage: Mini Graph (Top) -> Sliding Media Cards (Center) -> 24h Statistic (Bottom) */
              <div
                className="w-full h-full flex flex-col justify-between items-center overflow-hidden py-1 gap-2"
                style={{ borderRadius: 0, outline: 'none', border: 'none' }}
              >
                {/* 1. First Graph: Mini Graph (Above Media Cards) */}
                <div className="w-full flex justify-center shrink-0 pt-1 pb-1">
                  <TacticalTelemetryGraph
                    size="large"
                    selectedDayIndex={portraitSelectedDay}
                    onSelectDay={(dayIdx) => setPortraitSelectedDay(dayIdx)}
                  />
                </div>

                {/* 2. Center: 6 Randomly Selected Shorts Playing & Sliding Right-to-Left */}
                <div className="w-full flex-1 flex items-center justify-start overflow-hidden min-h-[220px]">
                  <HomepageSlidingShorts
                    shorts={allShortsFiles}
                    randomSeed={shuffleTrigger}
                    onOpenShort={(item: StageMediaItem, playlist: StageMediaItem[], idx: number) =>
                      onOpenShort(item, playlist, idx, 'Shorts')
                    }
                  />
                </div>

                {/* 3. Second Graph: 24-Hour Diurnal Statistics (Underneath Media Cards) */}
                <div className="w-full flex justify-center shrink-0 pt-1 pb-1">
                  <DiurnalPhase24hSummary dayIndex={portraitSelectedDay} />
                </div>
              </div>
            ) : (
              /* Desktop Screen Homepage: Full Middle Sliding Media Cards */
              <div className="w-full h-full flex items-center justify-start overflow-hidden">
                <HomepageSlidingShorts
                  shorts={allShortsFiles}
                  randomSeed={shuffleTrigger}
                  onOpenShort={(item: StageMediaItem, playlist: StageMediaItem[], idx: number) =>
                    onOpenShort(item, playlist, idx, 'Shorts')
                  }
                />
              </div>
            )
          ) : displayedTab === 4 && displayedBandhobiSub === 'Featured' ? (
            /* Bandhobi Featured: Selected Photos Sliding Right-to-Left */
            <div className="w-full h-full flex items-center justify-start overflow-hidden">
              <BandhobiSlidingFeaturedPhotos
                photos={activeBandhobiList}
                onOpenPhoto={(item: StageMediaItem, playlist: StageMediaItem[], idx: number) => onOpenPhoto(item, playlist, idx)}
              />
            </div>
          ) : (
            /* Media Pages: Monolith Rectangular Grid (Zero Text, Enlarges on Hover) */
            <div
              className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 pb-6"
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              {currentActiveList.map((item: StageMediaItem, idx: number) => (
                <LivingMediaCard
                  key={`${item.id || item.url || item.name}-${idx}`}
                  item={item}
                  aspectRatio={
                    displayedTab === 1
                      ? '3/4'
                      : displayedTab === 2
                      ? '9/16'
                      : displayedTab === 3
                      ? '16/9'
                      : displayedTab === 4 && displayedBandhobiSub === 'Photographs'
                      ? '3/4'
                      : displayedTab === 4 && displayedBandhobiSub === 'Shorts'
                      ? '9/16'
                      : displayedTab === 4 && displayedBandhobiSub === 'Video Clips'
                      ? '16/9'
                      : item.mediaType === 'short'
                      ? '9/16'
                      : isPhotoExtension(item.path || item.url || item.name || '')
                      ? '3/4'
                      : '16/9'
                  }
                  delayIdx={idx}
                  onClick={() => handleOpenItem(item, idx)}
                />
              ))}
            </div>
          )}
        </div>
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

      {/* QUANTUM 0.25X SPEED DIRECTIONAL NAVIGATION KEYFRAMES */}
      <style>{`
        @keyframes quantumTabExitFwd {
          0% {
            opacity: 1;
            transform: translateX(0);
          }
          100% {
            opacity: 0;
            transform: translateX(-100%);
          }
        }

        @keyframes quantumTabEnterFwd {
          0% {
            opacity: 0;
            transform: translateX(100%);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes quantumTabExitBwd {
          0% {
            opacity: 1;
            transform: translateX(0);
          }
          100% {
            opacity: 0;
            transform: translateX(100%);
          }
        }

        @keyframes quantumTabEnterBwd {
          0% {
            opacity: 0;
            transform: translateX(-100%);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .animate-quantum-tab-exit-fwd {
          animation: quantumTabExitFwd 0.72s cubic-bezier(0.4, 0, 1, 1) forwards;
        }

        .animate-quantum-tab-enter-fwd {
          animation: quantumTabEnterFwd 0.88s cubic-bezier(0, 0, 0.2, 1) forwards;
        }

        .animate-quantum-tab-exit-bwd {
          animation: quantumTabExitBwd 0.72s cubic-bezier(0.4, 0, 1, 1) forwards;
        }

        .animate-quantum-tab-enter-bwd {
          animation: quantumTabEnterBwd 0.88s cubic-bezier(0, 0, 0.2, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default MonolithBarGate;
