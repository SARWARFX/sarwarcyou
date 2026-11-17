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

  if (/^(?:bandhobi|realtube)$/i.test(root) || clean.toLowerCase().startsWith('bandhobi/') || clean.toLowerCase().startsWith('realtube/')) {
    root = 'Bandhobi';
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

// Selected photo identifiers to showcase under Bandhobi -> Featured in user's exact order
export const BANDHOBI_FEATURED_PHOTO_KEYS: string[] = [
  'hs0c', // webmedia-serial-254.jpeg
  'cKsr', // Farhana2.png
  '1uZH', // Farhana.jpg
  'xMUf', // f26140392.jpg
  'X6jY', // Eva8.jpg
  'ky2w', // Eva6.jpg
  'Aiox', // Eva5.jpg
  'Hr06', // Eva4.jpg
  'GMBe', // Asha5.jpg
  'GVKR', // Asha2.jpg
  '300N', // Anamika7.jpg
  'c4LO', // Anamika4.jpg
];

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

  const [photosSubfolder, setPhotosSubfolder] = useState<string>('ALL');
  const [shortsSubfolder, setShortsSubfolder] = useState<string>('Featured');
  const [clipsSubfolder, setClipsSubfolder] = useState<string>('ALL');
  const [bandhobiSubfolder, setBandhobiSubfolder] = useState<string>('Featured');
  const [shuffleTrigger, setShuffleTrigger] = useState<number>(0);

  // Content display state (synchronized with Quantum 0.25x speed directional transitions)
  const [displayedTab, setDisplayedTab] = useState<number>(() => tabIndex);
  const [displayedPhotosSub, setDisplayedPhotosSub] = useState<string>('ALL');
  const [displayedShortsSub, setDisplayedShortsSub] = useState<string>('Featured');
  const [displayedClipsSub, setDisplayedClipsSub] = useState<string>('ALL');
  const [displayedBandhobiSub, setDisplayedBandhobiSub] = useState<string>('Featured');
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
    tab?: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY' | 'BANDHOBI' | 'TRAILER';
  }>({ isOpen: false, path: '' });

  const switchTab = useCallback((targetIndex: number) => {
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
    else if (targetIndex === 2) setShortsSubfolder('Featured');
    else if (targetIndex === 3) setClipsSubfolder('ALL');
    else if (targetIndex === 4) setBandhobiSubfolder('Featured');
    setShuffleTrigger((prev) => prev + 1);

    if (typeof window !== 'undefined') {
      let route = '/';
      if (targetIndex === 1) route = '/photographs';
      else if (targetIndex === 2) route = '/shorts';
      else if (targetIndex === 3) route = '/clips';
      else if (targetIndex === 4) route = '/bandhobi';
      updateBrowserUrl(route);
    }

    // Quantum 0.25x speed: 800ms exit sweep, then swap displayed content and 880ms enter sweep
    setQuantumAnimClass(exitClass);

    transitionTimerRef.current.t1 = setTimeout(() => {
      setDisplayedTab(targetIndex);
      if (targetIndex === 1) setDisplayedPhotosSub('ALL');
      else if (targetIndex === 2) setDisplayedShortsSub('Featured');
      else if (targetIndex === 3) setDisplayedClipsSub('ALL');
      else if (targetIndex === 4) setDisplayedBandhobiSub('Featured');

      setQuantumAnimClass(enterClass);

      transitionTimerRef.current.t2 = setTimeout(() => {
        setQuantumAnimClass('');
      }, 880);
    }, 800);
  }, [tabIndex, TAB_VISUAL_ORDER]);

  // Synchronize state when browser Back / Forward (popstate) is clicked
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
      setShuffleTrigger((prev) => prev + 1);
      if (parsed.tab === 'PHOTOGRAPHY') {
        setPhotosSubfolder('ALL');
        setDisplayedPhotosSub('ALL');
        setTabIndex(1);
        setDisplayedTab(1);
      } else if (parsed.tab === 'SHORTS') {
        setShortsSubfolder('Featured');
        setDisplayedShortsSub('Featured');
        setTabIndex(2);
        setDisplayedTab(2);
      } else if (parsed.tab === 'CLIPS') {
        setClipsSubfolder('ALL');
        setDisplayedClipsSub('ALL');
        setTabIndex(3);
        setDisplayedTab(3);
      } else if (parsed.tab === 'BANDHOBI') {
        setBandhobiSubfolder('Featured');
        setDisplayedBandhobiSub('Featured');
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

  // Deep Link Synchronizer on load
  const hasAutoLaunchedRef = useRef(false);
  useEffect(() => {
    if (hasAutoLaunchedRef.current || !items || items.length === 0) return;

    if (initialRoute.shortId) {
      hasAutoLaunchedRef.current = true;
      const matched = findMediaByShortId(items, initialRoute.shortId);
      if (matched) {
        const item = matched.item;
        const isPhoto =
          item.type === 'image' || isPhotoExtension(item.path || item.url || item.name || '');
        const isShort =
          item.mediaType === 'short' ||
          item.path?.toLowerCase().includes('short') ||
          item.url?.toLowerCase().includes('short');

        if (isPhoto) {
          switchTab(1);
          onOpenPhoto(item, [item], 0);
        } else if (isShort) {
          switchTab(2);
          onOpenShort(item, [item], 0);
        } else {
          switchTab(3);
          onOpenVideo(item, [item]);
        }
      } else {
        setNotFoundInfo({ isOpen: true, path: window.location.pathname });
      }
      return;
    }

    const parsed = parseAppPathname();
    if (parsed.isNotFound) {
      setNotFoundInfo({ isOpen: true, path: '/' + parsed.rawPath });
    }
  }, [items, initialRoute, onOpenPhoto, onOpenShort, onOpenVideo, switchTab]);

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
      const photosNode = rootMap.get('Bandhobi')?.subfolders.get('Photographs');
      const allPhotos = photosNode ? photosNode.files : [];
      // Build lookup map by shortId and filename
      const itemMap = new Map<string, StageMediaItem>();
      for (const item of allPhotos) {
        const sid = getMediaShortId(item);
        if (sid) itemMap.set(sid.toLowerCase(), item);
        const name = (item.name || '').toLowerCase();
        if (name) itemMap.set(name, item);
        const pathPart = (item.path || '').split('/').pop()?.toLowerCase();
        if (pathPart) itemMap.set(pathPart, item);
      }
      for (const item of items) {
        const sid = getMediaShortId(item);
        if (sid && !itemMap.has(sid.toLowerCase())) itemMap.set(sid.toLowerCase(), item);
      }

      const selected: StageMediaItem[] = [];
      for (const key of BANDHOBI_FEATURED_PHOTO_KEYS) {
        const match = itemMap.get(key.toLowerCase());
        if (match) {
          selected.push(match);
        }
      }
      return selected.length > 0 ? selected : sortMediaItemsDescending<StageMediaItem>(allPhotos).slice(0, 12);
    }
    const node = rootMap.get('Bandhobi')?.subfolders.get(displayedBandhobiSub);
    return node && node.files.length > 0 ? sortMediaItemsDescending<StageMediaItem>(node.files) : [];
  }, [items, rootMap, displayedBandhobiSub]);

  const handleOpenItem = useCallback(
    (item: StageMediaItem, index: number = 0) => {
      hapticMedium();
      trackActivityEvent(1);

      const isPhoto = item.type === 'image' || isPhotoExtension(item.path || item.url || item.name || '');
      const isShort =
        item.mediaType === 'short' ||
        item.path?.toLowerCase().includes('short') ||
        item.url?.toLowerCase().includes('short');

      if (displayedTab === 4) {
        if (isPhoto) {
          onOpenPhoto(item, activeBandhobiList, index);
        } else if (isShort) {
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
    if (tabIndex === 1) setPhotosSubfolder(sub);
    else if (tabIndex === 2) setShortsSubfolder(sub);
    else if (tabIndex === 3) setClipsSubfolder(sub);
    else if (tabIndex === 4) setBandhobiSubfolder(sub);

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
        onClose={() => setNotFoundInfo((prev) => ({ ...prev, isOpen: false }))}
        onNavigateTab={(tab) => {
          setNotFoundInfo((prev) => ({ ...prev, isOpen: false }));
          if (tab === 'PHOTOGRAPHY') switchTab(1);
          else if (tab === 'SHORTS') switchTab(2);
          else if (tab === 'CLIPS') switchTab(3);
          else if (tab === 'BANDHOBI') switchTab(4);
          else {
            switchTab(2);
            setShortsSubfolder('Featured');
          }
        }}
      />

      {/* TOP HEADER: LOGO (LEFT) + NOTIF (CENTER) + GRAPH (RIGHT) */}
      <header
        className="w-full flex justify-between items-start pt-6 sm:pt-7 pb-2 px-6 sm:px-10 shrink-0 z-30 bg-transparent gap-4"
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      >
        {/* Left: Logo (clicking acts as Home) + Major Folders Bar directly underneath */}
        <div className="flex flex-col gap-3 sm:gap-4 shrink-0">
          <button
            type="button"
            onClick={() => {
              switchTab(2);
              setShortsSubfolder('Featured');
              if (typeof window !== 'undefined') {
                updateBrowserUrl('/');
              }
            }}
            className="inline-flex items-center cursor-pointer transition-opacity hover:opacity-85 bg-transparent p-0"
            title="SARWAR.CYOU"
            style={{ borderRadius: 0, outline: 'none', border: 'none' }}
          >
            <LaserSparkLogo width={250} height={34} interactive={false} />
          </button>

          {/* Major Folders (Pure text, zero lines, zero outlines, zero borders) */}
          <nav className="flex items-center gap-5 sm:gap-6">
            <button
              type="button"
              onClick={() => switchTab(1)}
              className={`text-[12.5px] sm:text-[13px] tracking-wide transition-colors cursor-pointer p-0 bg-transparent ${
                tabIndex === 1 ? 'text-white font-bold' : 'text-[#64748b] font-medium hover:text-white'
              }`}
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              Photographs
            </button>
            <button
              type="button"
              onClick={() => switchTab(3)}
              className={`text-[12.5px] sm:text-[13px] tracking-wide transition-colors cursor-pointer p-0 bg-transparent ${
                tabIndex === 3 ? 'text-white font-bold' : 'text-[#64748b] font-medium hover:text-white'
              }`}
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              Video Clips
            </button>
            <button
              type="button"
              onClick={() => switchTab(2)}
              className={`text-[12.5px] sm:text-[13px] tracking-wide transition-colors cursor-pointer p-0 bg-transparent ${
                tabIndex === 2 ? 'text-white font-bold' : 'text-[#64748b] font-medium hover:text-white'
              }`}
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              Shorts
            </button>
            <button
              type="button"
              onClick={() => switchTab(4)}
              className={`text-[12.5px] sm:text-[13px] tracking-wide transition-colors cursor-pointer p-0 bg-transparent ${
                tabIndex === 4 ? 'text-white font-bold' : 'text-[#64748b] font-medium hover:text-white'
              }`}
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              Bandhobi
            </button>
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
          {displayedTab === 2 && displayedShortsSub === 'Featured' ? (
            isPortrait ? (
              /* Portrait Screen Homepage: Mini Graph (Top) -> Sliding Media Cards (Center) -> 24h Statistic (Bottom) */
              <div
                className="w-full h-full flex flex-col justify-between items-center overflow-hidden py-1 gap-2"
                style={{ borderRadius: 0, outline: 'none', border: 'none' }}
              >
                {/* 1. First Graph: Mini Graph (Above Media Cards) */}
                <div className="w-full flex justify-center shrink-0 pt-1 pb-1">
                  <TacticalTelemetryGraph
                    selectedDayIndex={portraitSelectedDay}
                    onSelectDay={(dayIdx) => setPortraitSelectedDay(dayIdx)}
                  />
                </div>

                {/* 2. Center: 10 Randomly Selected Shorts Playing & Sliding Right-to-Left */}
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
          {currentSubfolderList.map((sub) => {
            const isActive = currentSubfolder === sub;
            return (
              <button
                key={sub}
                type="button"
                onClick={() => handleSelectSubfolder(sub)}
                className={`text-[11.5px] sm:text-[12px] tracking-wide transition-colors cursor-pointer whitespace-nowrap p-0 bg-transparent ${
                  isActive ? 'text-white font-bold' : 'text-[#64748b] font-medium hover:text-white'
                }`}
                style={{ borderRadius: 0, outline: 'none', border: 'none' }}
              >
                {sub}
              </button>
            );
          })}
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
