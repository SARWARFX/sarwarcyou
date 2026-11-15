import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ChevronDown, X, Volume2, VolumeX, Sun } from 'lucide-react';
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
  parseAppPathname,
  updateBrowserUrl,
} from '../../utils/urlRouter';
import { MediaNotFoundDialog } from '../common/MediaNotFoundDialog';
import { LivingMediaCard } from './LivingMediaCard';
import { QuickSearchModal } from '../QuickSearchModal';
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
  const [visibleShorts, setVisibleShorts] = useState<number>(36);
  const [visibleClips, setVisibleClips] = useState<number>(36);
  const [visiblePhotos, setVisiblePhotos] = useState<number>(48);

  // Dropdown open states for the 3 tabs: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY' | null
  const [activeDropdown, setActiveDropdown] = useState<'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY' | null>(null);

  // Auto Tour state (default OFF)
  const [isAutoTour, setIsAutoTour] = useState(false);

  // Keep screen on state
  const [keepAwakeOn, setKeepAwakeOn] = useState(() => getKeepScreenOnState());

  // Muted states for homepage 5 living video wall columns
  const [mutedColumns, setMutedColumns] = useState<boolean[]>([true, true, true, true, true]);

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
      } else if (e.key === 'Escape') {
        setActiveDropdown(null);
      } else if (e.key === 'ArrowRight' && !isModalOpen) {
        setTabIndex((prev) => Math.min(3, prev + 1));
      } else if (e.key === 'ArrowLeft' && !isModalOpen) {
        setTabIndex((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

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

  // Auto Tour Timer
  useEffect(() => {
    if (!isAutoTour) return;
    const interval = setInterval(() => {
      setTabIndex((prev) => (prev + 1) % 4);
    }, 7500);
    return () => clearInterval(interval);
  }, [isAutoTour]);

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

  // Subfolder lists and item counts for dropdown menus
  const shortsSubOptions = useMemo(() => {
    const node = rootMap.get('Shorts');
    if (!node) return [];
    const subs = Array.from(node.subfolders.keys());
    return subs.map((s) => ({
      name: s,
      count: node.subfolders.get(s)?.files.length || 0,
    }));
  }, [rootMap]);

  const clipsSubOptions = useMemo(() => {
    const node = rootMap.get('Clips');
    if (!node) return [];
    const subs = Array.from(node.subfolders.keys());
    return subs.map((s) => ({
      name: s,
      count: node.subfolders.get(s)?.files.length || 0,
    }));
  }, [rootMap]);

  const photosSubOptions = useMemo(() => {
    const node = rootMap.get('Images');
    if (!node) return [];
    const subs = Array.from(node.subfolders.keys());
    return subs.map((s) => ({
      name: s,
      count: node.subfolders.get(s)?.files.length || 0,
    }));
  }, [rootMap]);

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

  // Back button closes active drawer/dropdown
  useBackButton(
    useCallback(() => {
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
    }, [activeDropdown, isVaultDrawerOpen, tabIndex, switchTab]),
    Boolean(activeDropdown || isVaultDrawerOpen || tabIndex !== 0)
  );

  // 7-day session telemetry metrics for futuristic graph
  const telemetryData = useMemo(() => [
    { label: 'MON', val: 24, fill: 55 },
    { label: 'TUE', val: 32, fill: 72 },
    { label: 'WED', val: 19, fill: 42 },
    { label: 'THU', val: 41, fill: 88 },
    { label: 'FRI', val: 37, fill: 78 },
    { label: 'SAT', val: 48, fill: 94 },
    { label: 'TODAY', val: 56, fill: 100, today: true },
  ], []);

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
      <div className="w-full h-[28px] overflow-hidden bg-[#ccff00] text-black font-mono font-black text-[11px] uppercase tracking-widest select-none shrink-0 z-50 shadow-md flex items-center">
        <div className="animate-marquee whitespace-nowrap flex gap-8 items-center">
          <span className="bg-black text-[#ccff00] px-2 py-0.5 rounded text-[9px] font-bold tracking-wider">INDEX NOTICE</span>
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
          <span className="bg-black text-[#ccff00] px-2 py-0.5 rounded text-[9px] font-bold tracking-wider">INDEX NOTICE</span>
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

      {/* 2. TRANSPARENT FLOATING HEADER (RIGHT UNDER EULO BAR) */}
      <header className="fixed top-[28px] inset-x-0 h-[58px] px-3 sm:px-6 flex items-center justify-between z-40 bg-transparent pointer-events-none">
        {/* Left: Authentic Brand Logo + Section Badge + Auto Tour Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
          <HeaderBrandLogo
            trackingClass="tracking-[0.2em] sm:tracking-[0.25em]"
            onTrigger={() => switchTab(0)}
          />

          {/* Section Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0a0b0f]/85 border border-[#ccff00]/30 text-[#ccff00] font-mono text-[10px] font-bold uppercase tracking-wider backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ccff00] shadow-[0_0_8px_#ccff00]" />
            <span>
              {tabIndex === 0 ? 'LIVE FEED' : tabIndex === 1 ? (shortsSubfolder === 'ALL' ? 'SHORTS' : `SHORTS // ${shortsSubfolder}`) : tabIndex === 2 ? (clipsSubfolder === 'ALL' ? 'VIDEO CLIPS' : `CLIPS // ${clipsSubfolder}`) : (photosSubfolder === 'ALL' ? 'PHOTOGRAPHS' : `PHOTOS // ${photosSubfolder}`)}
            </span>
          </div>

          {/* Auto Tour Toggle Button */}
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              setIsAutoTour((prev) => !prev);
            }}
            title="Auto Tour (Cycles tabs)"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-[10px] font-bold tracking-wider uppercase cursor-pointer backdrop-blur-md transition-all ${
              isAutoTour
                ? 'bg-[#0a0b0f]/95 border-[#ccff00] text-[#ccff00] shadow-[0_0_16px_rgba(204,255,0,0.35)]'
                : 'bg-[#0a0b0f]/80 border-white/15 text-neutral-400 hover:border-[#ccff00] hover:text-white'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isAutoTour ? 'bg-[#ccff00] shadow-[0_0_8px_#ccff00] animate-pulse' : 'bg-neutral-500'}`} />
            <span className="hidden sm:inline">TOUR:</span>
            <span>{isAutoTour ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Right: Three Tabs with Subfolder Dropdown Menus */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="tabs-dock">

            {/* TAB 1: SHORTS + DROPDOWN */}
            <div
              className={`tab-dropdown-wrap ${activeDropdown === 'SHORTS' ? 'open' : ''}`}
              onMouseEnter={() => setActiveDropdown('SHORTS')}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button
                type="button"
                onClick={() => {
                  if (tabIndex === 1) {
                    setActiveDropdown((prev) => (prev === 'SHORTS' ? null : 'SHORTS'));
                  } else {
                    switchTab(1);
                  }
                }}
                className={`reticle-chip whitespace-nowrap ${tabIndex === 1 ? 'active-chip' : ''}`}
                title="Shorts Exhibition & Subfolders"
              >
                <span className="tab-label-full">SHORTS</span>
                <span className="tab-label-short">S</span>
                <ChevronDown className="w-3 h-3 tab-chevron" />
              </button>

              <div className="tab-dropdown-menu">
                <button
                  type="button"
                  onClick={() => {
                    setShortsSubfolder('ALL');
                    switchTab(1);
                  }}
                  className={`dropdown-item ${shortsSubfolder === 'ALL' ? 'active' : ''}`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    <span>ALL SHORTS</span>
                  </span>
                  <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-white/10 text-neutral-300 font-mono">
                    {allShortsFiles.length}
                  </span>
                </button>
                {shortsSubOptions.map((sub) => (
                  <button
                    key={sub.name}
                    type="button"
                    onClick={() => {
                      setShortsSubfolder(sub.name);
                      switchTab(1);
                    }}
                    className={`dropdown-item ${shortsSubfolder === sub.name ? 'active' : ''}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      <span>{sub.name}</span>
                    </span>
                    <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-white/10 text-neutral-300 font-mono">
                      {sub.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* TAB 2: VIDEO CLIPS + DROPDOWN */}
            <div
              className={`tab-dropdown-wrap ${activeDropdown === 'CLIPS' ? 'open' : ''}`}
              onMouseEnter={() => setActiveDropdown('CLIPS')}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button
                type="button"
                onClick={() => {
                  if (tabIndex === 2) {
                    setActiveDropdown((prev) => (prev === 'CLIPS' ? null : 'CLIPS'));
                  } else {
                    switchTab(2);
                  }
                }}
                className={`reticle-chip whitespace-nowrap ${tabIndex === 2 ? 'active-chip' : ''}`}
                title="Video Clips Exhibition & Subfolders"
              >
                <span className="tab-label-full">VIDEO CLIPS</span>
                <span className="tab-label-short">V</span>
                <ChevronDown className="w-3 h-3 tab-chevron" />
              </button>

              <div className="tab-dropdown-menu">
                <button
                  type="button"
                  onClick={() => {
                    setClipsSubfolder('ALL');
                    switchTab(2);
                  }}
                  className={`dropdown-item ${clipsSubfolder === 'ALL' ? 'active' : ''}`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    <span>ALL VIDEO CLIPS</span>
                  </span>
                  <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-white/10 text-neutral-300 font-mono">
                    {allClipsFiles.length}
                  </span>
                </button>
                {clipsSubOptions.map((sub) => (
                  <button
                    key={sub.name}
                    type="button"
                    onClick={() => {
                      setClipsSubfolder(sub.name);
                      switchTab(2);
                    }}
                    className={`dropdown-item ${clipsSubfolder === sub.name ? 'active' : ''}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      <span>{sub.name}</span>
                    </span>
                    <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-white/10 text-neutral-300 font-mono">
                      {sub.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* TAB 3: PHOTOGRAPHS + DROPDOWN */}
            <div
              className={`tab-dropdown-wrap ${activeDropdown === 'PHOTOGRAPHY' ? 'open' : ''}`}
              onMouseEnter={() => setActiveDropdown('PHOTOGRAPHY')}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button
                type="button"
                onClick={() => {
                  if (tabIndex === 3) {
                    setActiveDropdown((prev) => (prev === 'PHOTOGRAPHY' ? null : 'PHOTOGRAPHY'));
                  } else {
                    switchTab(3);
                  }
                }}
                className={`reticle-chip whitespace-nowrap ${tabIndex === 3 ? 'active-chip' : ''}`}
                title="Photographs Exhibition & Subfolders"
              >
                <span className="tab-label-full">PHOTOGRAPHS</span>
                <span className="tab-label-short">P</span>
                <ChevronDown className="w-3 h-3 tab-chevron" />
              </button>

              <div className="tab-dropdown-menu">
                <button
                  type="button"
                  onClick={() => {
                    setPhotosSubfolder('ALL');
                    switchTab(3);
                  }}
                  className={`dropdown-item ${photosSubfolder === 'ALL' ? 'active' : ''}`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    <span>ALL PHOTOGRAPHS</span>
                  </span>
                  <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-white/10 text-neutral-300 font-mono">
                    {allPhotosFiles.length}
                  </span>
                </button>
                {photosSubOptions.map((sub) => (
                  <button
                    key={sub.name}
                    type="button"
                    onClick={() => {
                      setPhotosSubfolder(sub.name);
                      switchTab(3);
                    }}
                    className={`dropdown-item ${photosSubfolder === sub.name ? 'active' : ''}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      <span>{sub.name}</span>
                    </span>
                    <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-white/10 text-neutral-300 font-mono">
                      {sub.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      </header>

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
                const isMuted = mutedColumns[idx] ?? true;
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
                      muted={isMuted}
                      playsInline
                      preload="auto"
                      ref={(el) => {
                        if (el) el.muted = isMuted;
                      }}
                    />

                    {/* Badge */}
                    <div className="absolute top-[72px] left-[18px] bg-black/85 border border-[#ccff00] rounded px-2 py-0.5 font-mono text-[9px] font-bold text-[#ccff00] tracking-wider backdrop-blur-sm z-10 pointer-events-none">
                      {idx === 0 ? 'PREMIERE' : idx === 1 ? 'FEATURED' : idx === 2 ? 'LATEST' : idx === 3 ? 'TRENDING' : 'POPULAR'}
                    </div>

                    {/* Sound toggle button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMutedColumns((prev) => {
                          const next = [...prev];
                          next[idx] = !next[idx];
                          return next;
                        });
                      }}
                      title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                      className="absolute top-[72px] right-[18px] w-7 h-7 rounded-full bg-black/75 border border-white/20 flex items-center justify-center text-white hover:border-[#ccff00] hover:text-[#ccff00] hover:scale-110 transition-all z-20 cursor-pointer"
                    >
                      {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>

                    {/* Bottom overlay info */}
                    <div className="absolute bottom-0 inset-x-0 pt-12 pb-6 px-4 bg-gradient-to-t from-black/95 via-black/50 to-transparent z-10 flex flex-col gap-1 pointer-events-none">
                      <span className="font-['Space_Grotesk',sans-serif] text-sm font-bold text-white truncate drop-shadow">
                        {short.name || short.title}
                      </span>
                      <span className="font-mono text-[9.5px] text-neutral-400 uppercase tracking-wider">
                        {getItemSubfolderLabel(short)} // STREAM 0{idx + 1}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom-Left HUD: Futuristic Telemetry Graph + Compact Wake Lock Pill */}
            <div
              className={`fixed bottom-6 left-6 z-30 flex flex-col items-start gap-2 transition-all duration-300 pointer-events-auto ${
                tabIndex === 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
              }`}
            >
              {/* Compact Keep Screen On Toggle Button */}
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  toggleKeepScreenOn();
                }}
                title="Toggle Screen Wake Lock"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[9px] font-bold tracking-wider uppercase backdrop-blur-md transition-all cursor-pointer border ${
                  keepAwakeOn
                    ? 'bg-[#0a0b0f]/95 border-[#ccff00] text-[#ccff00] shadow-[0_0_14px_rgba(204,255,0,0.3)]'
                    : 'bg-[#0a0b0f]/85 border-white/15 text-neutral-400 hover:border-[#ccff00] hover:text-white'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${keepAwakeOn ? 'bg-[#ccff00] shadow-[0_0_8px_#ccff00] animate-pulse' : 'bg-neutral-500'}`} />
                <Sun className="w-3 h-3" />
                <span>WAKE LOCK {keepAwakeOn ? '[ACTIVE]' : ''}</span>
              </button>

              {/* Futuristic Cyber Telemetry Graph */}
              <div className="futuristic-graph-card">
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                  <div className="font-mono text-[9.5px] font-extrabold text-[#ccff00] tracking-wider uppercase flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ccff00] shadow-[0_0_6px_#ccff00]" />
                    <span>SESSION TELEMETRY</span>
                  </div>
                  <div className="font-mono text-[8.5px] text-neutral-400 tracking-wide">
                    SYS_60FPS // LIVE
                  </div>
                </div>

                <div className="flex items-end justify-between gap-2 h-[60px] pt-1">
                  {telemetryData.map((d) => (
                    <div key={d.label} className="flex-1 flex flex-col items-center justify-end h-full">
                      <span className={`font-mono text-[8px] font-bold mb-0.5 ${d.today ? 'text-[#ccff00]' : 'text-neutral-400'}`}>
                        {d.val}
                      </span>
                      <div className="w-full max-w-[22px] h-[36px] bg-white/[0.06] rounded-sm flex items-end overflow-hidden border border-white/[0.04]">
                        <div
                          className={`w-full rounded-t-sm transition-all duration-300 ${
                            d.today
                              ? 'bg-gradient-to-t from-[#ccff00]/40 to-[#ccff00] shadow-[0_0_10px_rgba(204,255,0,0.7)]'
                              : 'bg-gradient-to-t from-white/20 to-white/50'
                          }`}
                          style={{ height: `${d.fill}%` }}
                        />
                      </div>
                      <span className={`font-['Space_Grotesk',sans-serif] text-[8px] font-bold mt-1 tracking-wide uppercase ${d.today ? 'text-white' : 'text-neutral-500'}`}>
                        {d.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ================================================================= */}
          {/* PANEL 1: SHORTS TAB PAGE (PURE FULL-BLEED GRID OF SHORTS CARDS)   */}
          {/* ================================================================= */}
          <section className="panoramic-panel">
            <div className="w-full h-full overflow-y-auto space-scrollbar pt-[70px] pb-16 px-3 sm:px-6 lg:px-8">
              {/* Filter Active Notice Bar */}
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#ccff00]/10 border border-[#ccff00]/30 text-[#ccff00] font-mono text-[10px] font-bold uppercase tracking-wider">
                    SUBFOLDER // {shortsSubfolder}
                  </span>
                  <span className="font-mono text-[10px] text-neutral-400">
                    {activeShortsList.length} items indexed
                  </span>
                </div>
                {shortsSubfolder !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setShortsSubfolder('ALL')}
                    className="flex items-center gap-1 px-2 py-0.5 rounded border border-white/20 text-neutral-400 hover:text-[#ccff00] hover:border-[#ccff00] text-[10px] font-mono font-bold uppercase transition-all cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>SHOW ALL</span>
                  </button>
                )}
              </div>

              {/* Cards Grid */}
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
                <div className="w-full py-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setVisibleShorts((v) => v + 24);
                    }}
                    className="reticle-chip px-6 py-2.5 text-xs text-[#ccff00] border-[#ccff00]/40 hover:border-[#ccff00] hover:bg-[#ccff00]/10 transition-all cursor-pointer shadow-[0_0_15px_rgba(204,255,0,0.15)]"
                  >
                    SHOW MORE SHORTS ({Math.min(visibleShorts, activeShortsList.length)} / {activeShortsList.length})
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* ================================================================= */}
          {/* PANEL 2: VIDEO CLIPS TAB PAGE (PURE FULL-BLEED GRID OF VIDEO)     */}
          {/* ================================================================= */}
          <section className="panoramic-panel">
            <div className="w-full h-full overflow-y-auto space-scrollbar pt-[70px] pb-16 px-3 sm:px-6 lg:px-8">
              {/* Filter Active Notice Bar */}
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#ccff00]/10 border border-[#ccff00]/30 text-[#ccff00] font-mono text-[10px] font-bold uppercase tracking-wider">
                    SUBFOLDER // {clipsSubfolder}
                  </span>
                  <span className="font-mono text-[10px] text-neutral-400">
                    {activeClipsList.length} items indexed
                  </span>
                </div>
                {clipsSubfolder !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setClipsSubfolder('ALL')}
                    className="flex items-center gap-1 px-2 py-0.5 rounded border border-white/20 text-neutral-400 hover:text-[#ccff00] hover:border-[#ccff00] text-[10px] font-mono font-bold uppercase transition-all cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>SHOW ALL</span>
                  </button>
                )}
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 pb-6">
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
                <div className="w-full py-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setVisibleClips((v) => v + 24);
                    }}
                    className="reticle-chip px-6 py-2.5 text-xs text-[#ccff00] border-[#ccff00]/40 hover:border-[#ccff00] hover:bg-[#ccff00]/10 transition-all cursor-pointer shadow-[0_0_15px_rgba(204,255,0,0.15)]"
                  >
                    SHOW MORE CLIPS ({Math.min(visibleClips, activeClipsList.length)} / {activeClipsList.length})
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* ================================================================= */}
          {/* PANEL 3: PHOTOGRAPHS TAB PAGE (PURE FULL-BLEED GRID OF PHOTOS)    */}
          {/* ================================================================= */}
          <section className="panoramic-panel">
            <div className="w-full h-full overflow-y-auto space-scrollbar pt-[70px] pb-16 px-3 sm:px-6 lg:px-8">
              {/* Filter Active Notice Bar */}
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#ccff00]/10 border border-[#ccff00]/30 text-[#ccff00] font-mono text-[10px] font-bold uppercase tracking-wider">
                    SUBFOLDER // {photosSubfolder}
                  </span>
                  <span className="font-mono text-[10px] text-neutral-400">
                    {activePhotosList.length} items indexed
                  </span>
                </div>
                {photosSubfolder !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setPhotosSubfolder('ALL')}
                    className="flex items-center gap-1 px-2 py-0.5 rounded border border-white/20 text-neutral-400 hover:text-[#ccff00] hover:border-[#ccff00] text-[10px] font-mono font-bold uppercase transition-all cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>SHOW ALL</span>
                  </button>
                )}
              </div>

              {/* Cards Grid */}
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
                <div className="w-full py-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setVisiblePhotos((v) => v + 24);
                    }}
                    className="reticle-chip px-6 py-2.5 text-xs text-[#ccff00] border-[#ccff00]/40 hover:border-[#ccff00] hover:bg-[#ccff00]/10 transition-all cursor-pointer shadow-[0_0_15px_rgba(204,255,0,0.15)]"
                  >
                    SHOW MORE PHOTOGRAPHS ({Math.min(visiblePhotos, activePhotosList.length)} / {activePhotosList.length})
                  </button>
                </div>
              )}
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
