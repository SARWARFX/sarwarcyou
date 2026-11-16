import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { StageMediaItem } from '../../types';
import { MIDNIGHT_OBSIDIAN_THEME } from './themeManager';
import { CinematicBackdropCanvas } from './CinematicBackdropCanvas';
import { MAJOR_FOLDERS } from '../navigation/SidebarAccordionNav';
import { isPhotoExtension } from '../../utils/mediaTypeDetector';
import { sortMediaItemsDescending } from '../../utils/albumExtractor';
import { type DirectoryNode } from '../DeepSpaceTreeExplorer';
import { useBackButton } from '../../utils/backButtonManager';
import { VaultDrawer } from '../VaultDrawer';
import { hapticMedium, hapticLight } from '../../utils/hapticsManager';
import { trackActivityEvent, getRolling15DayUsage } from '../../utils/usageTelemetry';
import {
  parseIdRoute,
  parseAppPathname,
  updateBrowserUrl,
} from '../../utils/urlRouter';
import { MediaNotFoundDialog } from '../common/MediaNotFoundDialog';
import { LivingMediaCard } from './LivingMediaCard';
import { QuickSearchModal } from '../QuickSearchModal';
import { LaserSparkLogo } from '../brand/LaserSparkLogo';
import {
  toggleKeepScreenOn,
  getKeepScreenOnState,
  subscribeKeepScreenOn,
} from '../../utils/keepAwakeManager';

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
  initialAlbum: _initialAlbum,
  isModalOpen = false,
}) => {
  // 0. Parse initial route from short ID URL (?id=..., ?v=..., ?star=..., etc.)
  const initialRoute = useMemo(() => parseIdRoute(), []);

  // 4 Panoramic Slides: 0: Home (Living Wall), 1: Shorts, 2: Videos, 3: Photographs
  const [tabIndex, setTabIndex] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const parsed = parseAppPathname();
    if (parsed.tab === 'PHOTOGRAPHY') return 3;
    if (parsed.tab === 'CLIPS') return 2;
    if (parsed.tab === 'SHORTS') return 1;
    return 0; // Default Home living wall
  });

  const [_activeVideoId, setActiveVideoId] = useState<string | null>(initialRoute.videoId);

  // Individual section subfolder filters
  const [shortsSubfolder, setShortsSubfolder] = useState<string>('ALL');
  const [clipsSubfolder, setClipsSubfolder] = useState<string>('ALL');
  const [photosSubfolder, setPhotosSubfolder] = useState<string>('ALL');

  // Progressive batch visibility for each section
  const [visibleShorts, setVisibleShorts] = useState<number>(24);
  const [visibleClips, setVisibleClips] = useState<number>(16);
  const [visiblePhotos, setVisiblePhotos] = useState<number>(24);

  // Dropdown open states for the 3 tabs: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY' | null
  const [activeDropdown, setActiveDropdown] = useState<'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY' | null>(null);

  // Keep screen on state
  const [keepAwakeOn, setKeepAwakeOn] = useState(() => getKeepScreenOnState());

  // 15-Day Minimalist Telemetry Graph Modal state
  const [isTelemetryModalOpen, setIsTelemetryModalOpen] = useState(false);


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

  // Concealed Option A Terminal Drawer State
  const [isVaultDrawerOpen, setVaultDrawerOpen] = useState(false);

  // Sync wake lock state
  useEffect(() => {
    const unsub = subscribeKeepScreenOn((active) => {
      setKeepAwakeOn(active);
    });
    return unsub;
  }, []);

  // Keyboard shortcut listener for Ctrl+K, Cmd+K, /, or Escape
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
      } else if (e.key === 'Escape') {
        setActiveDropdown(null);
        setIsTelemetryModalOpen(false);
      } else if (e.key === 'ArrowRight' && !isModalOpen && !isTelemetryModalOpen) {
        setTabIndex((prev) => Math.min(3, prev + 1));
      } else if (e.key === 'ArrowLeft' && !isModalOpen && !isTelemetryModalOpen) {
        setTabIndex((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isTelemetryModalOpen]);

  // Synchronize state when browser Back / Forward (popstate) is clicked
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseAppPathname();
      if (parsed.tab === 'PHOTOGRAPHY') setTabIndex(3);
      else if (parsed.tab === 'CLIPS') setTabIndex(2);
      else if (parsed.tab === 'SHORTS') setTabIndex(1);
      else setTabIndex(0);
      setActiveVideoId(parsed.shortId);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync tab navigation to browser URL
  const switchTab = useCallback((idx: number) => {
    setTabIndex(idx);
    setActiveDropdown(null);
    hapticMedium();

    const targetPath =
      idx === 1 ? '/shorts'
      : idx === 2 ? '/clips'
      : idx === 3 ? '/photographs'
      : '/';
    updateBrowserUrl(targetPath, false);
  }, []);

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

    for (const rootNode of map.values()) {
      rootNode.files = sortMediaItemsDescending(rootNode.files);
      for (const sub of rootNode.subfolders.values()) {
        sub.files = sortMediaItemsDescending(sub.files);
      }
    }

    return map;
  }, [items]);

  // Deep collections for each section
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
    const node = rootMap.get('Clips');
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

  const allPhotosFiles = useMemo(() => {
    const node = rootMap.get('Images');
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

  // 5 Living Wall Videos for Homepage (Zero space wall)
  const homeWallVideos = useMemo(() => {
    if (allShortsFiles.length >= 5) {
      return allShortsFiles.slice(0, 5);
    }
    return allShortsFiles;
  }, [allShortsFiles]);

  // Filtered active media lists
  const activeShortsList = useMemo(() => {
    if (shortsSubfolder === 'ALL') return allShortsFiles;
    const node = rootMap.get('Shorts')?.subfolders.get(shortsSubfolder);
    return node ? node.files : allShortsFiles;
  }, [allShortsFiles, rootMap, shortsSubfolder]);

  const activeClipsList = useMemo(() => {
    if (clipsSubfolder === 'ALL') return allClipsFiles;
    const node = rootMap.get('Clips')?.subfolders.get(clipsSubfolder);
    return node ? node.files : allClipsFiles;
  }, [allClipsFiles, rootMap, clipsSubfolder]);

  const activePhotosList = useMemo(() => {
    if (photosSubfolder === 'ALL') return allPhotosFiles;
    const node = rootMap.get('Images')?.subfolders.get(photosSubfolder);
    return node ? node.files : allPhotosFiles;
  }, [allPhotosFiles, rootMap, photosSubfolder]);

  // Subfolder label resolver for LivingMediaCard
  const getItemSubfolderLabel = useCallback(
    (item: StageMediaItem): string => {
      const { subfolders } = getFolderSegments(item);
      return subfolders.length > 0 ? subfolders[0] : item.category || 'Archive';
    },
    []
  );

  // Universal Media Open Handlers
  const handleOpenItem = useCallback(
    (item: StageMediaItem, index: number = 0) => {
      hapticMedium();
      trackActivityEvent(1);

      const isPhoto = item.type === 'image' || isPhotoExtension(item.path || item.url || item.name || '');
      const isShort =
        item.mediaType === 'short' ||
        item.path?.toLowerCase().includes('short') ||
        item.url?.toLowerCase().includes('short');

      if (isPhoto) {
        onOpenPhoto(item, activePhotosList, index);
      } else if (isShort) {
        onOpenShort(item, activeShortsList, index, getItemSubfolderLabel(item));
      } else {
        onOpenVideo(item, activeClipsList);
      }
    },
    [activePhotosList, activeShortsList, activeClipsList, getItemSubfolderLabel, onOpenPhoto, onOpenShort, onOpenVideo]
  );

  // Close dropdown on click outside
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.tab-dropdown-wrap')) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  // Back button closes active modal/drawer/dropdown or returns home
  useBackButton(
    useCallback(() => {
      if (isTelemetryModalOpen) {
        setIsTelemetryModalOpen(false);
        return true;
      }
      if (isSearchOpen) {
        setIsSearchOpen(false);
        return true;
      }
      if (activeDropdown) {
        setActiveDropdown(null);
        return true;
      }
      if (isVaultDrawerOpen) {
        setVaultDrawerOpen(false);
        return true;
      }
      if (tabIndex !== 0) {
        switchTab(0);
        return true;
      }
      return false;
    }, [isTelemetryModalOpen, isSearchOpen, activeDropdown, isVaultDrawerOpen, tabIndex, switchTab]),
    Boolean(isTelemetryModalOpen || isSearchOpen || activeDropdown || isVaultDrawerOpen || tabIndex !== 0)
  );

  // 15-day rolling session telemetry metrics (zero suppression: days with 0 data are excluded)
  const telemetry15DayData = useMemo(() => {
    return getRolling15DayUsage();
  }, [isTelemetryModalOpen]);

  const max15Minutes = useMemo(() => {
    if (telemetry15DayData.length === 0) return 60;
    return Math.max(...telemetry15DayData.map((d) => d.minutes), 60);
  }, [telemetry15DayData]);

  // Subfolders list corresponding to the currently active tab
  const activeSubfoldersList = useMemo(() => {
    if (tabIndex === 1) {
      const list = Array.from(rootMap.get('Shorts')?.subfolders.values() || []).map((s) => s.name);
      return ['ALL', ...list];
    }
    if (tabIndex === 2) {
      const list = Array.from(rootMap.get('Clips')?.subfolders.values() || []).map((s) => s.name);
      return ['ALL', ...list];
    }
    if (tabIndex === 3) {
      const list = Array.from(rootMap.get('Images')?.subfolders.values() || []).map((s) => s.name);
      return ['ALL', ...list];
    }
    return [];
  }, [tabIndex, rootMap]);

  const currentActiveSubfolder = useMemo(() => {
    if (tabIndex === 1) return shortsSubfolder;
    if (tabIndex === 2) return clipsSubfolder;
    if (tabIndex === 3) return photosSubfolder;
    return 'ALL';
  }, [tabIndex, shortsSubfolder, clipsSubfolder, photosSubfolder]);

  const handleSubfolderSelect = useCallback((subName: string) => {
    hapticLight();
    if (tabIndex === 1) setShortsSubfolder(subName);
    else if (tabIndex === 2) setClipsSubfolder(subName);
    else if (tabIndex === 3) setPhotosSubfolder(subName);
  }, [tabIndex]);

  // Infinite scroll handlers for each media tab (automatic progressive loading)
  const handleShortsScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 600) {
      setVisibleShorts((prev) => {
        if (prev < activeShortsList.length) {
          return Math.min(prev + 18, activeShortsList.length);
        }
        return prev;
      });
    }
  }, [activeShortsList.length]);

  const handleClipsScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 600) {
      setVisibleClips((prev) => {
        if (prev < activeClipsList.length) {
          return Math.min(prev + 12, activeClipsList.length);
        }
        return prev;
      });
    }
  }, [activeClipsList.length]);

  const handlePhotosScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 600) {
      setVisiblePhotos((prev) => {
        if (prev < activePhotosList.length) {
          return Math.min(prev + 16, activePhotosList.length);
        }
        return prev;
      });
    }
  }, [activePhotosList.length]);

  // Reset pagination count when subfolders change
  useEffect(() => {
    setVisibleShorts(24);
  }, [shortsSubfolder]);

  useEffect(() => {
    setVisibleClips(16);
  }, [clipsSubfolder]);

  useEffect(() => {
    setVisiblePhotos(24);
  }, [photosSubfolder]);

  return (
    <div
      className="w-screen h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col bg-black relative select-none font-['Roboto_Condensed'] font-sans text-white"
      style={{
        isolation: 'isolate',
        backgroundColor: '#000000',
      }}
    >
      {/* Permanent Midnight Obsidian Backdrop Canvas */}
      <CinematicBackdropCanvas theme={MIDNIGHT_OBSIDIAN_THEME} isPaused={isModalOpen} />

      {/* Option A: Concealed Left Navigation Drawer */}
      <VaultDrawer
        isOpen={isVaultDrawerOpen}
        onClose={() => setVaultDrawerOpen(false)}
        onSelectFolder={(folderId, subfolderName) => {
          if (folderId === 'shorts') {
            if (subfolderName) setShortsSubfolder(subfolderName);
            switchTab(1);
          } else if (folderId === 'clips' || folderId === 'realtube') {
            if (subfolderName) setClipsSubfolder(subfolderName);
            switchTab(2);
          } else if (folderId === 'photography') {
            if (subfolderName) setPhotosSubfolder(subfolderName);
            switchTab(3);
          }
          setVaultDrawerOpen(false);
        }}
        onSelectHome={() => switchTab(0)}
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
          if (tab === 'SHORTS') switchTab(1);
          else if (tab === 'CLIPS') switchTab(2);
          else if (tab === 'PHOTOGRAPHY') switchTab(3);
          else switchTab(0);
        }}
      />

      {/* 1. TOP ACID LIME KINETIC MARQUEE TICKER (EXACTLY UNCHANGED) */}
      <div className="w-full h-[28px] overflow-hidden bg-[#00f0ff] text-black font-mono font-black text-[11px] uppercase tracking-widest select-none shrink-0 z-50 shadow-md flex items-center">
        <div className="animate-marquee whitespace-nowrap flex gap-8 items-center">
          <span className="bg-black text-[#00f0ff] px-2 py-0.5 rounded text-[9px] font-bold tracking-wider">INDEX NOTICE</span>
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
          <span className="bg-black text-[#00f0ff] px-2 py-0.5 rounded text-[9px] font-bold tracking-wider">INDEX NOTICE</span>
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

      {/* 2. MIDDLE-RIGHT SIDE: PURE TEXT SVP DOCK (NO BACKGROUND, NO OUTLINE) */}
      <aside
        className="fixed right-4 sm:right-7 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-4 sm:gap-5 select-none pointer-events-auto"
        aria-label="SVP Navigation"
      >
        <button
          type="button"
          onClick={() => switchTab(1)}
          className={`font-['Orbitron',sans-serif] text-xl sm:text-2xl font-black tracking-wider text-[#00f0ff] cursor-pointer transition-all duration-300 p-1 ${
            tabIndex === 1
              ? 'opacity-100 scale-125 drop-shadow-[0_0_16px_#00f0ff] drop-shadow-[0_0_32px_#00f0ff]'
              : 'opacity-40 hover:opacity-85 hover:scale-110 drop-shadow-[0_0_10px_#00f0ff]'
          }`}
          title="Shorts"
        >
          S
        </button>
        <button
          type="button"
          onClick={() => switchTab(2)}
          className={`font-['Orbitron',sans-serif] text-xl sm:text-2xl font-black tracking-wider text-[#00f0ff] cursor-pointer transition-all duration-300 p-1 ${
            tabIndex === 2
              ? 'opacity-100 scale-125 drop-shadow-[0_0_16px_#00f0ff] drop-shadow-[0_0_32px_#00f0ff]'
              : 'opacity-40 hover:opacity-85 hover:scale-110 drop-shadow-[0_0_10px_#00f0ff]'
          }`}
          title="Video Clips"
        >
          V
        </button>
        <button
          type="button"
          onClick={() => switchTab(3)}
          className={`font-['Orbitron',sans-serif] text-xl sm:text-2xl font-black tracking-wider text-[#00f0ff] cursor-pointer transition-all duration-300 p-1 ${
            tabIndex === 3
              ? 'opacity-100 scale-125 drop-shadow-[0_0_16px_#00f0ff] drop-shadow-[0_0_32px_#00f0ff]'
              : 'opacity-40 hover:opacity-85 hover:scale-110 drop-shadow-[0_0_10px_#00f0ff]'
          }`}
          title="Photographs"
        >
          P
        </button>
      </aside>

      {/* 3. BOTTOM-LEFT CORNER: OPTION 2 SWEEPING LASER LOGO (DUAL ACTION) */}
      <div className="fixed bottom-4 sm:bottom-6 left-4 sm:left-6 z-40 select-none pointer-events-auto">
        <button
          type="button"
          onClick={() => {
            hapticMedium();
            if (tabIndex !== 0) {
              switchTab(0);
            } else {
              setIsTelemetryModalOpen(true);
            }
          }}
          className="inline-flex items-center cursor-pointer transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none bg-transparent border-0 p-0"
          title={tabIndex !== 0 ? 'Return to Homepage' : 'Open 15-Day Time Log'}
        >
          <LaserSparkLogo
            width={210}
            height={30}
            interactive={false}
          />
        </button>
      </div>

      {/* 4. BOTTOM-RIGHT CORNER: PURE TEXT SUBFOLDERS (HORIZONTAL DESKTOP / VERTICAL MOBILE) */}
      {activeSubfoldersList.length > 0 && (
        <nav
          className="fixed bottom-4 sm:bottom-6 right-4 sm:right-7 z-40 flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-4 max-h-[45vh] sm:max-h-none overflow-y-auto sm:overflow-visible select-none pointer-events-auto"
          aria-label="Subfolders Filter"
        >
          {activeSubfoldersList.map((subName) => {
            const isActive = currentActiveSubfolder === subName;
            return (
              <button
                key={subName}
                type="button"
                onClick={() => handleSubfolderSelect(subName)}
                className={`font-['Orbitron',sans-serif] text-[9.5px] sm:text-[11px] tracking-[0.14em] uppercase transition-all duration-200 cursor-pointer whitespace-nowrap p-0.5 ${
                  isActive
                    ? 'text-[#00f0ff] font-black drop-shadow-[0_0_12px_#00f0ff] scale-105'
                    : 'text-white/45 hover:text-white font-bold'
                }`}
              >
                {subName}
              </button>
            );
          })}
        </nav>
      )}

      {/* 5. 15-DAY MINIMALIST TELEMETRY GRAPH MODAL (DISMISSED VIA CLICK OUTSIDE OR ESC) */}
      {isTelemetryModalOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-2xl flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setIsTelemetryModalOpen(false)}
        >
          <div
            className="bg-[#080808]/95 border border-white/10 rounded-2xl p-6 sm:p-7 max-w-2xl w-full shadow-[0_24px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(0, 240, 255,0.12)] relative cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile View: Adaptive Horizontal Track Rails (< 640px) */}
            <div className="flex sm:hidden flex-col gap-2.5 max-h-[290px] overflow-y-auto space-scrollbar border-b border-white/10 pb-3 mt-1">
              {telemetry15DayData.map((d) => {
                const isToday = d.label === 'Today';
                const widthPct = d.minutes > 0 ? Math.max(8, Math.round((d.minutes / max15Minutes) * 100)) : 0;
                return (
                  <div key={d.date} className="flex items-center justify-between gap-3">
                    <span
                      className={`w-14 font-['Orbitron',sans-serif] text-[10px] tracking-wider uppercase shrink-0 ${
                        isToday ? 'text-[#00f0ff] font-black' : 'text-white/50 font-bold'
                      }`}
                    >
                      {d.label}
                    </span>
                    <div className="flex-1 h-2.5 bg-white/[0.06] rounded-full overflow-hidden flex items-center p-0.5">
                      <div
                        className="h-full bg-gradient-to-r from-[#0088aa] to-[#00f0ff] rounded-full shadow-[0_0_10px_rgba(0, 240, 255,0.4)] transition-all duration-500"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <span className="w-14 font-mono text-[10px] font-bold text-white text-right shrink-0">
                      {d.formattedMinutes}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Pure Vertical Pillar Bars (>= 640px) */}
            <div className="hidden sm:flex items-end justify-between gap-3 h-[210px] border-b border-white/10 pb-3 mt-2 overflow-x-auto">
              {telemetry15DayData.map((d) => {
                const isToday = d.label === 'Today';
                const heightPct = d.minutes > 0 ? Math.max(12, Math.round((d.minutes / max15Minutes) * 100)) : 2;
                return (
                  <div key={d.date} className="flex-1 min-w-[42px] flex flex-col items-center justify-end h-full gap-2">
                    <span className="font-mono text-[10.5px] font-bold text-white/85 whitespace-nowrap">
                      {d.formattedMinutes}
                    </span>
                    <div className="w-full max-w-[22px] bg-white/[0.05] rounded-xl flex items-end h-[145px] p-0.5 overflow-hidden">
                      <div
                        className="w-full bg-gradient-to-t from-[#0099bb] to-[#00f0ff] rounded-lg shadow-[0_0_14px_rgba(0, 240, 255,0.45)] transition-all duration-500"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span
                      className={`font-['Orbitron',sans-serif] text-[9.5px] tracking-wider uppercase pt-1 whitespace-nowrap ${
                        isToday ? 'text-[#00f0ff] font-black' : 'text-white/50 font-bold'
                      }`}
                    >
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Minimalist Footer with Keep Screen On Toggle */}
            <div className="flex items-center justify-start mt-4 pt-1">
              <label
                className="inline-flex items-center gap-2.5 cursor-pointer select-none"
                onClick={() => {
                  hapticLight();
                  toggleKeepScreenOn();
                }}
              >
                <div
                  className={`w-9 h-5 rounded-full relative transition-colors duration-200 ${
                    keepAwakeOn ? 'bg-[#00f0ff]' : 'bg-white/15'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full absolute top-0.5 transition-transform duration-200 ${
                      keepAwakeOn ? 'translate-x-4 bg-black' : 'translate-x-0.5 bg-white'
                    }`}
                  />
                </div>
                <span className="font-mono text-[11px] text-white/60 tracking-wider">
                  Keep Screen On
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* 3. 4-PANEL HORIZONTAL PANORAMIC SLIDING VIEWPORT */}
      <main
        className="flex-1 w-full min-h-0 relative overflow-hidden"
        style={{
          height: 'calc(100dvh - 28px)',
        }}
      >
        <div
          className="panoramic-viewport"
          style={{
            transform: `translate3d(calc(-100vw * ${tabIndex}), 0, 0)`,
          }}
        >
          {/* ================================================================= */}
          {/* PANEL 0: HOMEPAGE LIVING MULTI-SHORT VIDEO WALL                   */}
          {/* ZERO SPACE: NO SPACE BETWEEN, ABOVE, OR BELOW SHORTS             */}
          {/* ================================================================= */}
          <section className="panoramic-panel panel-home-seamless">
            <div className="seamless-shorts-row">
              {homeWallVideos.map((short, idx) => {
                return (
                  <div
                    key={short.id || short.url || idx}
                    onClick={() => handleOpenItem(short, idx)}
                    className="seamless-short-col group"
                    title={`Play ${short.name || short.title || 'Short'}`}
                  >
                    <video
                      src={short.url}
                      poster={short.thumbnail}
                      autoPlay
                      loop
                      muted
                      playsInline
                      preload="auto"
                      ref={(el) => {
                        if (el) el.muted = true;
                      }}
                    />
                  </div>
                );
              })}
            </div>

            
          </section>

          {/* ================================================================= */}
          {/* PANEL 1: SHORTS TAB PAGE (SEAMLESS FULL-BLEED GRID OF SHORTS)     */}
          {/* ZERO GAP ABOVE, BELOW, AND BETWEEN CARDS                          */}
          {/* ================================================================= */}
          <section className="panoramic-panel">
            <div
              onScroll={handleShortsScroll}
              className="w-full h-full overflow-y-auto overflow-x-hidden space-scrollbar p-0 m-0 pb-24"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-0">
                {activeShortsList.slice(0, visibleShorts).map((item, idx) => (
                  <LivingMediaCard
                    key={item.id || item.url || idx}
                    item={item}
                    aspectRatio="9/16"
                    delayIdx={idx}
                    onClick={() => handleOpenItem(item, idx)}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* ================================================================= */}
          {/* PANEL 2: VIDEO CLIPS TAB PAGE (SEAMLESS FULL-BLEED GRID OF CLIPS) */}
          {/* ZERO GAP ABOVE, BELOW, AND BETWEEN CARDS                          */}
          {/* ================================================================= */}
          <section className="panoramic-panel">
            <div
              onScroll={handleClipsScroll}
              className="w-full h-full overflow-y-auto overflow-x-hidden space-scrollbar p-0 m-0 pb-24"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0">
                {activeClipsList.slice(0, visibleClips).map((item, idx) => (
                  <LivingMediaCard
                    key={item.id || item.url || idx}
                    item={item}
                    aspectRatio="16/9"
                    delayIdx={idx}
                    onClick={() => handleOpenItem(item, idx)}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* ================================================================= */}
          {/* PANEL 3: PHOTOGRAPHS TAB PAGE (SEAMLESS FULL-BLEED GRID OF PHOTOS)*/}
          {/* ZERO GAP ABOVE, BELOW, AND BETWEEN CARDS                          */}
          {/* ================================================================= */}
          <section className="panoramic-panel">
            <div
              onScroll={handlePhotosScroll}
              className="w-full h-full overflow-y-auto overflow-x-hidden space-scrollbar p-0 m-0 pb-24"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-0">
                {activePhotosList.slice(0, visiblePhotos).map((item, idx) => (
                  <LivingMediaCard
                    key={item.id || item.url || idx}
                    item={item}
                    aspectRatio="3/4"
                    delayIdx={idx}
                    onClick={() => handleOpenItem(item, idx)}
                  />
                ))}
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* Universal Instant Command Search Palette */}
      <QuickSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        items={items}
        onOpenPhoto={onOpenPhoto}
        onOpenVideo={onOpenVideo}
        onOpenShort={onOpenShort}
      />
    </div>
  );
};

export default MonolithBarGate;
