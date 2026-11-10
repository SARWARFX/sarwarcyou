import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Play, Folder, Music2, Film, CheckCircle2 } from 'lucide-react';
import type { StageMediaItem } from '../../types';
import { MIDNIGHT_OBSIDIAN_THEME } from './themeManager';
import { CinematicBackdropCanvas } from './CinematicBackdropCanvas';
import { SmartThumbnail } from '../common/SmartThumbnail';
import { MAJOR_FOLDERS } from '../navigation/SidebarAccordionNav';
import { isPhotoExtension } from '../../utils/mediaTypeDetector';
import { getMediaUrl, getThumbnailUrl, getImageUrl } from '../../utils/imageUrlResolver';
import { resolveStaticVideoThumbnail } from '../../utils/thumbnailResolver';
import { sortMediaItemsDescending } from '../../utils/albumExtractor';
import { type DirectoryNode } from '../DeepSpaceTreeExplorer';
import { useBackButton } from '../../utils/backButtonManager';
import { HeaderBrandLogo } from '../updater/HeaderBrandLogo';
import { CelebrityShowcase } from '../CelebrityShowcase';
import { VaultDrawer } from '../VaultDrawer';
import { CelebrityReelPlayerModal, type CelebrityReelItem } from '../CelebrityReelPlayerModal';
import celebrityReelsData from '../../data/celebrityReels.json';
import actressesRegistryData from '../../data/actressesRegistry.json';
import { hapticMedium } from '../../utils/hapticsManager';
import { trackActivityEvent } from '../../utils/usageTelemetry';
import {
  parseIdRoute,
  syncAppRoute,
  type AppIdRoute,
} from '../../utils/urlRouter';

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
  } else if (/^shorts$/i.test(root)) {
    root = 'Shorts';
  } else if (/^realtube$/i.test(root)) {
    root = 'REALTube';
  } else if (/^youtube$/i.test(root)) {
    root = 'YouTube';
  } else {
    if (item.mediaType === 'short' || item.category?.toLowerCase().includes('short') || item.url?.toLowerCase().includes('short')) {
      root = 'Shorts';
      sub = dirParts.length > 0 ? dirParts : ['Shorts Classic'];
    } else if (item.type === 'image' || isPhotoExtension(item.url || item.name)) {
      root = 'Images';
      sub = dirParts.length > 0 ? dirParts : ['H2026'];
    } else {
      root = 'Clips';
      sub = dirParts.length > 0 ? dirParts : ['H2027'];
    }
  }

  if (sub.length === 0) {
    if (root === 'Shorts') sub = ['Shorts Classic'];
    else if (root === 'REALTube') sub = ['REALTube Shorts'];
    else if (root === 'Images') sub = ['H2026'];
    else sub = ['H2027'];
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
  // Level 0: selectedCategory === null && selectedSubfolder === null (Bollywood Overview)
  // Level 1: selectedCategory !== null && selectedSubfolder === null (Child Subfolders Grid)
  // Level 2: selectedCategory !== null && selectedSubfolder !== null (Direct Media Items)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialRoute.category);
  const [selectedSubfolder, setSelectedSubfolder] = useState<string | null>(initialRoute.subfolder);
  const [activeCelebrityFilter, setActiveCelebrityFilter] = useState<string>(initialRoute.celebrityStar || 'ALL');
  const [activeCelebrityTab, setActiveCelebrityTab] = useState<'PORTRAITS' | 'DISPATCHES' | 'REELS'>(
    initialRoute.celebrityTab || 'PORTRAITS'
  );
  const [activeVideoId, setActiveVideoId] = useState<string | null>(initialRoute.videoId);
  const [slideDirection, setSlideDirection] = useState<'right' | 'left'>('right');

  // Synchronize route state with browser address bar
  const updateRoute = useCallback(
    (newRoute: Partial<AppIdRoute>, replace = false) => {
      syncAppRoute(
        {
          category: newRoute.category !== undefined ? newRoute.category : (selectedCategory as any),
          subfolder: newRoute.subfolder !== undefined ? newRoute.subfolder : selectedSubfolder,
          celebrityStar:
            newRoute.celebrityStar !== undefined ? newRoute.celebrityStar : activeCelebrityFilter,
          celebrityTab: newRoute.celebrityTab !== undefined ? newRoute.celebrityTab : activeCelebrityTab,
          videoId: newRoute.videoId !== undefined ? newRoute.videoId : activeVideoId,
        },
        replace
      );
    },
    [selectedCategory, selectedSubfolder, activeCelebrityFilter, activeCelebrityTab, activeVideoId]
  );

  // Synchronize state when browser Back / Forward (popstate) is clicked
  useEffect(() => {
    const handlePopState = () => {
      const route = parseIdRoute();
      setSelectedCategory(route.category);
      setSelectedSubfolder(route.subfolder);
      if (route.celebrityStar) {
        setActiveCelebrityFilter(route.celebrityStar);
      } else if (route.category === null) {
        setActiveCelebrityFilter('ALL');
      }
      if (route.celebrityTab) {
        setActiveCelebrityTab(route.celebrityTab);
      } else if (route.category === null) {
        setActiveCelebrityTab('PORTRAITS');
      }
      setActiveVideoId(route.videoId);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // When modals close, clear videoId/mediaId in URL and restore current page route
  const prevModalOpen = useRef(isModalOpen);
  useEffect(() => {
    if (prevModalOpen.current && !isModalOpen) {
      setActiveVideoId(null);
      updateRoute({ videoId: null, mediaId: null }, true);
    }
    prevModalOpen.current = isModalOpen;
  }, [isModalOpen, updateRoute]);

  // Concealed Option A Terminal Drawer State
  const [isVaultDrawerOpen, setVaultDrawerOpen] = useState(false);

  // Celebrity Reels Engine (250 Verified 9:16 Vertical Video Reels across 50 Actresses)
  const [selectedReelRegion, setSelectedReelRegion] = useState<string>('ALL');
  const [selectedReelStar, setSelectedReelStar] = useState<string>('ALL');
  const [isReelPlayerOpen, setIsReelPlayerOpen] = useState(false);
  const [activeReelIndex, setActiveReelIndex] = useState(0);

  const REEL_REGION_TABS = useMemo(
    () => [
      { id: 'ALL', label: 'ALL', count: 250 },
      { id: 'BANGLADESH', label: 'BANGLADESH', count: 60 },
      { id: 'BOLLYWOOD', label: 'BOLLYWOOD', count: 60 },
      { id: 'SOUTH_INDIA', label: 'SOUTH INDIA', count: 65 },
      { id: 'PAKISTAN', label: 'PAKISTAN', count: 45 },
      { id: 'BHOJPURI', label: 'BHOJPURI', count: 20 },
    ],
    []
  );

  const visibleReelActresses = useMemo(() => {
    const list = actressesRegistryData as Array<{
      id: string;
      slug: string;
      name: string;
      label: string;
      region: string;
      avatar: string;
      country: string;
    }>;
    if (selectedReelRegion === 'ALL') return list;
    return list.filter((a) => a.region === selectedReelRegion);
  }, [selectedReelRegion]);

  const filteredReels = useMemo(() => {
    let list = celebrityReelsData as CelebrityReelItem[];
    if (selectedReelRegion !== 'ALL') {
      list = list.filter((r) => r.region === selectedReelRegion);
    }
    if (selectedReelStar !== 'ALL') {
      const starLower = selectedReelStar.toLowerCase();
      list = list.filter(
        (r) =>
          r.actressName.toLowerCase() === starLower ||
          r.actressId === starLower ||
          r.actressSlug === starLower
      );
    }
    return list;
  }, [selectedReelRegion, selectedReelStar]);

  const handleOpenCelebrityReel = useCallback(
    (index: number) => {
      hapticMedium();
      trackActivityEvent(1);
      setActiveReelIndex(index);
      setIsReelPlayerOpen(true);
      const reel = filteredReels[index];
      if (reel) {
        setActiveVideoId(reel.id);
        updateRoute({ videoId: reel.id });
      }
    },
    [filteredReels, updateRoute]
  );

  // Auto-open reel from deep link (?id=reels&v=reel-...)
  useEffect(() => {
    if (initialRoute.category === 'YOUTUBE' && initialRoute.videoId) {
      const allReels = celebrityReelsData as CelebrityReelItem[];
      const rIdx = allReels.findIndex((r) => r.id === initialRoute.videoId);
      if (rIdx !== -1) {
        setActiveReelIndex(rIdx);
        setIsReelPlayerOpen(true);
      }
    }
  }, [initialRoute]);

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

    ensureSubfolders('Clips', ['H2027', 'H2026', 'H2025', 'Favorite', 'Others']);
    ensureSubfolders('Shorts', ['Shorts Classic', 'REALTube Shorts']);
    ensureSubfolders('Images', ['H2026', 'H2025', 'Bandhobis', 'Works', 'Classic']);
    ensureSubfolders('REALTube', ['REALTube Shorts', 'Archive Feeds']);

    // Sort files descending
    for (const rootNode of map.values()) {
      rootNode.files = sortMediaItemsDescending(rootNode.files);
      for (const sub of rootNode.subfolders.values()) {
        sub.files = sortMediaItemsDescending(sub.files);
      }
    }

    return map;
  }, [items]);

  // Initial deep link routing support
  useEffect(() => {
    if (!initialAlbum || items.length === 0) return;

    const cleanTarget = initialAlbum.toLowerCase().replace(/[-_\s]+/g, '');
    for (const folder of MAJOR_FOLDERS) {
      if (folder.key.toLowerCase().replace(/[-_\s]+/g, '') === cleanTarget) {
        setSelectedCategory(folder.key);
        setSelectedSubfolder(null); // Level 1 first
        return;
      }
      const rootNode = rootMap.get(folder.rawName);
      if (!rootNode) continue;
      for (const sub of rootNode.subfolders.values()) {
        if (sub.name.toLowerCase().replace(/[-_\s]+/g, '') === cleanTarget) {
          setSelectedCategory(folder.key);
          setSelectedSubfolder(sub.name);
          return;
        }
      }
    }
  }, [initialAlbum, items.length, rootMap]);

  // Direct ID URL auto-launch on initial mount
  const hasAutoLaunchedRef = useRef(false);
  useEffect(() => {
    if (hasAutoLaunchedRef.current) return;

    if (initialRoute.videoId) {
      const allReels = celebrityReelsData as CelebrityReelItem[];
      const reelIdx = allReels.findIndex((r) => r.id === initialRoute.videoId);
      if (reelIdx !== -1) {
        hasAutoLaunchedRef.current = true;
        setActiveReelIndex(reelIdx);
        setIsReelPlayerOpen(true);
        return;
      }
    }

    if (initialRoute.mediaId && items.length > 0) {
      const matched = items.find(
        (it) => it.id === initialRoute.mediaId || (it.url && it.url.includes(initialRoute.mediaId!))
      );
      if (matched) {
        hasAutoLaunchedRef.current = true;
        onOpenPhoto(matched, [matched], 0);
      }
    }
  }, [
    initialRoute,
    items,
    onOpenPhoto,
  ]);

  // Active Category Root Node
  const activeCategoryNode = useMemo(() => {
    if (!selectedCategory) return null;
    const activeAlbumConfig = MAJOR_FOLDERS.find((h) => h.key === selectedCategory);
    if (!activeAlbumConfig) return null;
    return rootMap.get(activeAlbumConfig.rawName) || null;
  }, [selectedCategory, rootMap]);

  // Active Category Child Subfolders (for Filter Pills)
  const childSubfoldersList = useMemo(() => {
    if (!activeCategoryNode) return [];
    return Array.from(activeCategoryNode.subfolders.values());
  }, [activeCategoryNode]);

  // All files under this category (across all subfolders)
  const allCategoryFiles = useMemo(() => {
    if (!activeCategoryNode) return [];
    const set = new Set<string>();
    const list: StageMediaItem[] = [];

    // 1. Files on root node
    for (const f of activeCategoryNode.files) {
      const key = f.id || f.url || f.path || f.name;
      if (key && !set.has(key)) {
        set.add(key);
        list.push(f);
      }
    }

    // 2. Files in all subfolders
    for (const sub of activeCategoryNode.subfolders.values()) {
      for (const f of sub.files) {
        const key = f.id || f.url || f.path || f.name;
        if (key && !set.has(key)) {
          set.add(key);
          list.push(f);
        }
      }
    }

    return sortMediaItemsDescending(list);
  }, [activeCategoryNode]);

  // Active Media Items List: If a subfolder pill is selected, show that subfolder; otherwise show allCategoryFiles!
  const activeMediaList = useMemo(() => {
    if (!activeCategoryNode) return [];
    if (selectedSubfolder) {
      const subNode = activeCategoryNode.subfolders.get(selectedSubfolder);
      if (subNode && subNode.files.length > 0) {
        return subNode.files;
      }
    }
    return allCategoryFiles;
  }, [activeCategoryNode, selectedSubfolder, allCategoryFiles]);

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
      console.warn('Failed to update media views:', e);
    }

    if (item.id) {
      updateRoute({ mediaId: item.id });
    }

    const isPhoto =
      item.type === 'image' || isPhotoExtension(item.path || item.url || item.name || '');

    if (isPhoto) {
      const photoPool = activeMediaList.filter(
        (f) =>
          f.type === 'image' || isPhotoExtension(f.path || f.url || f.name || '')
      );
      const photoIdx = photoPool.findIndex((p) => p.id === item.id || p.url === item.url);
      onOpenPhoto(item, photoPool.length > 0 ? photoPool : [item], photoIdx >= 0 ? photoIdx : 0);
      return;
    }

    const isShort =
      item.mediaType === 'short' ||
      item.path?.toLowerCase().includes('short') ||
      item.url?.toLowerCase().includes('short') ||
      item.category?.toLowerCase().includes('short') ||
      selectedCategory === 'SHORTS';

    if (isShort) {
      const shortPool = activeMediaList.filter(
        (f) =>
          f.mediaType === 'short' ||
          f.path?.toLowerCase().includes('short') ||
          f.url?.toLowerCase().includes('short') ||
          f.category?.toLowerCase().includes('short') ||
          selectedCategory === 'SHORTS'
      );
      const shortIdx = shortPool.findIndex((s) => s.id === item.id || s.url === item.url);
      onOpenShort(
        item,
        shortPool,
        shortIdx >= 0 ? shortIdx : 0,
        selectedSubfolder || item.category || 'Shorts'
      );
      return;
    }

    const videoPool = activeMediaList.filter(
      (f) => f.type === 'video' || (!f.type && !isPhoto && !isShort)
    );
    onOpenVideo(item, videoPool.length > 0 ? videoPool : [item]);
  };

  // Drawer Category selection handler: sets Category and opens Level 1 (or directly Level 2 if subfolder selected)
  const handleSelectDrawerFolder = useCallback(
    (folderId: 'clips' | 'shorts' | 'photography' | 'realtube' | 'youtube', subfolderId?: string) => {
      const keyMap: Record<string, string> = {
        clips: 'CLIPS',
        shorts: 'SHORTS',
        photography: 'PHOTOGRAPHY',
        realtube: 'REALTUBE',
        youtube: 'YOUTUBE',
      };
      const targetKey = keyMap[folderId] || 'CLIPS';
      setSelectedCategory(targetKey);

      if (!subfolderId) {
        setSelectedSubfolder(null);
      } else {
        if (targetKey === 'YOUTUBE') {
          setSelectedSubfolder(subfolderId);
        } else {
          const activeAlbumConfig = MAJOR_FOLDERS.find((h) => h.key === targetKey);
          const rootNode = activeAlbumConfig ? rootMap.get(activeAlbumConfig.rawName) : null;
          let matchedName: string | null = null;
          if (rootNode) {
            const cleanSub = subfolderId.toLowerCase().replace(/[-_\s&]+/g, '');
            for (const [name] of rootNode.subfolders.entries()) {
              if (name.toLowerCase().replace(/[-_\s&]+/g, '') === cleanSub) {
                matchedName = name;
                break;
              }
            }
          }
          setSelectedSubfolder(matchedName || subfolderId);
        }
      }
      updateRoute({ category: targetKey as any, subfolder: subfolderId || null });
      setVaultDrawerOpen(false);
    },
    [rootMap, updateRoute]
  );

  const MAIN_TAB_ORDER = useMemo(() => ['ARCHIVE', 'YOUTUBE', 'SHORTS', 'CLIPS', 'PHOTOGRAPHY', 'REALTUBE'], []);

  const navigateTab = useCallback(
    (newCat: string | null) => {
      const currentKey = selectedCategory || 'ARCHIVE';
      const targetKey = newCat || 'ARCHIVE';
      if (currentKey === targetKey) return;
      const oldIdx = MAIN_TAB_ORDER.indexOf(currentKey);
      const newIdx = MAIN_TAB_ORDER.indexOf(targetKey);
      setSlideDirection(newIdx >= oldIdx ? 'right' : 'left');
      setSelectedCategory(newCat);
      setSelectedSubfolder(null);
      updateRoute({ category: (newCat as any) || null, subfolder: null, videoId: null });
    },
    [selectedCategory, MAIN_TAB_ORDER, updateRoute]
  );

  const navigateSubfolder = useCallback(
    (newSub: string | null) => {
      if (selectedSubfolder === newSub) return;
      const allSubs = ['ALL', ...childSubfoldersList.map((s) => s.name)];
      const oldIdx = allSubs.indexOf(selectedSubfolder || 'ALL');
      const newIdx = allSubs.indexOf(newSub || 'ALL');
      setSlideDirection(newIdx >= oldIdx ? 'right' : 'left');
      setSelectedSubfolder(newSub);
      updateRoute({ subfolder: newSub });
    },
    [selectedSubfolder, childSubfoldersList, updateRoute]
  );

  // Idle reset handler: returns to Public Bollywood Overview (Level 0)
  const handleExitToHome = useCallback(() => {
    navigateTab(null);
  }, [navigateTab]);

  // Return to Category Subfolders handler (Level 2 -> Level 1)
  const handleReturnToCategory = useCallback(() => {
    navigateSubfolder(null);
  }, [navigateSubfolder]);

  // Android Native Hardware Back Button handler (stepped 2-tier back navigation)
  useBackButton(
    useCallback(() => {
      // 0. If Celebrity Reel Player modal is open, close it
      if (isReelPlayerOpen) {
        setIsReelPlayerOpen(false);
        setActiveVideoId(null);
        updateRoute({ videoId: null });
        return true;
      }

      // 1. If concealed terminal drawer is open, close it
      if (isVaultDrawerOpen) {
        setVaultDrawerOpen(false);
        return true;
      }

      // 2. If at Level 2 (viewing individual subfolder assets), step back to Level 1
      if (selectedSubfolder !== null) {
        handleReturnToCategory();
        return true;
      }

      // 3. If at Level 1 (viewing category child collections), step back to Level 0
      if (selectedCategory !== null) {
        handleExitToHome();
        return true;
      }

      return false;
    }, [isReelPlayerOpen, isVaultDrawerOpen, selectedSubfolder, selectedCategory, handleReturnToCategory, handleExitToHome, updateRoute])
  );

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

      {/* Top Acid Lime Kinetic Marquee Ticker */}
      <div className="w-full overflow-hidden py-1 sm:py-1.5 bg-[#ccff00] text-black font-mono font-black text-[11px] sm:text-xs uppercase tracking-widest select-none shrink-0 z-40 shadow-md">
        <div className="animate-marquee whitespace-nowrap flex gap-8 items-center">
          <span>SARWARCYOU ARCHIVE 2026</span>
          <span>•</span>
          <span>CELEBRITY PORTRAITS</span>
          <span>•</span>
          <span>CINEMA REELS 4K</span>
          <span>•</span>
          <span>ZERO MOCKUP • STRICT VERIFIED FEED</span>
          <span>•</span>
          <span>BIENNALE EDITION // VOL. 2026</span>
          <span>•</span>
          <span>SARWARCYOU ARCHIVE 2026</span>
          <span>•</span>
          <span>CELEBRITY PORTRAITS</span>
          <span>•</span>
          <span>CINEMA REELS 4K</span>
          <span>•</span>
          <span>ZERO MOCKUP • STRICT VERIFIED FEED</span>
          <span>•</span>
          <span>BIENNALE EDITION // VOL. 2026</span>
        </div>
      </div>

      {/* TOP HEADER BAR: Zero-Clue Logo Trigger & Minimalist Status */}
      <header className="w-full px-4 sm:px-8 py-3 flex items-center justify-between border-b border-white/[0.08] bg-[#050505]/95 backdrop-blur-md z-30 shrink-0">
        <div className="flex items-center gap-3">
          <HeaderBrandLogo
            trackingClass="tracking-[0.2em] sm:tracking-[0.24em]"
            onTrigger={() => setVaultDrawerOpen((prev) => !prev)}
          />
          <span className="hidden sm:inline-block text-[10px] font-mono text-[#ccff00] uppercase tracking-widest px-2 py-0.5 rounded bg-[#ccff00]/10 border border-[#ccff00]/25">
            ARCHIVE
          </span>
        </div>

        {/* Avant-Garde Quick Select Keys */}
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              navigateTab(null);
            }}
            className={`px-2.5 sm:px-3 py-1 rounded text-[11px] sm:text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer ${
              selectedCategory === null
                ? 'bg-[#ccff00] text-black shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            ARCHIVE
          </button>
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              navigateTab('YOUTUBE');
            }}
            className={`px-2.5 sm:px-3 py-1 rounded text-[11px] sm:text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer ${
              selectedCategory === 'YOUTUBE'
                ? 'bg-[#ccff00] text-black shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            REELS
          </button>
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              navigateTab('SHORTS');
            }}
            className={`px-2.5 sm:px-3 py-1 rounded text-[11px] sm:text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer ${
              selectedCategory === 'SHORTS'
                ? 'bg-[#ccff00] text-black shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            SHORTS
          </button>
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              navigateTab('CLIPS');
            }}
            className={`px-2.5 sm:px-3 py-1 rounded text-[11px] sm:text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer ${
              selectedCategory === 'CLIPS'
                ? 'bg-[#ccff00] text-black shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            CLIPS
          </button>
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              navigateTab('PHOTOGRAPHY');
            }}
            className={`px-2.5 sm:px-3 py-1 rounded text-[11px] sm:text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer ${
              selectedCategory === 'PHOTOGRAPHY'
                ? 'bg-[#ccff00] text-black shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            PHOTO
          </button>
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              navigateTab('REALTUBE');
            }}
            className={`px-2.5 sm:px-3 py-1 rounded text-[11px] sm:text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer ${
              selectedCategory === 'REALTUBE'
                ? 'bg-[#ccff00] text-black shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            REALTUBE
          </button>
        </div>
      </header>

      {/* MAIN VIEWPORT STAGE */}
      {selectedCategory === null ? (
        /* ===================================================================== */
        /* LEVEL 0: PUBLIC ENTERTAINMENT HUB & CHRONICLE NEWS                    */
        /* ===================================================================== */
        <main
          aria-label="Bollywood Celebrity Archive Overview"
          className={`flex-1 w-full min-h-0 overflow-hidden flex flex-col min-w-0 z-10 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isModalOpen ? 'scale-[0.985] brightness-[0.7] blur-[1px]' : 'scale-100 brightness-100 blur-0'
          }`}
        >
          <div key="archive-overview" className={`w-full h-full ${slideDirection === 'right' ? 'animate-kinetic-slide-right' : 'animate-kinetic-slide-left'}`}>
            <CelebrityShowcase
              onOpenPhoto={onOpenPhoto}
              initialTab={activeCelebrityTab}
              initialFilter={activeCelebrityFilter}
              initialVideoId={activeVideoId}
              onTabChange={(tab) => {
                setActiveCelebrityTab(tab);
                updateRoute({ celebrityTab: tab });
              }}
              onFilterChange={(filter) => {
                setActiveCelebrityFilter(filter);
                updateRoute({ celebrityStar: filter });
              }}
              onVideoChange={(videoId) => {
                setActiveVideoId(videoId);
                updateRoute({ videoId });
              }}
            />
          </div>
        </main>
      ) : selectedCategory === 'YOUTUBE' ? (
        /* ===================================================================== */
        /* LEVEL 1: CELEBRITY REELS // 9:16 VERTICAL STREAM FEED                 */
        /* ===================================================================== */
        <main
          aria-label="Celebrity Reels 9:16 Vertical Hub"
          className={`flex-1 w-full min-h-0 overflow-y-auto space-scrollbar p-4 sm:p-7 lg:p-10 z-10 flex flex-col bg-transparent transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isModalOpen ? 'scale-[0.985] brightness-[0.7] blur-[1px]' : 'scale-100 brightness-100 blur-0'
          }`}
        >
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-white/10">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Music2 className="w-5 h-5 text-[#ccff00]" />
                <span className="font-['Space_Grotesk'] font-black text-lg sm:text-xl tracking-wider uppercase text-white">
                  CELEBRITY REELS
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-[#ccff00]/15 border border-[#ccff00]/30 text-xs font-mono font-bold text-[#ccff00]">
                9:16 VERTICAL STREAM
              </span>
              <span className="text-xs font-mono text-neutral-400">
                ({filteredReels.length} verified reels)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#ccff00] animate-pulse" />
              <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
                DAILY INGESTION • 365-DAY RETENTION
              </span>
            </div>
          </div>

          {/* Tier 1 Region Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto autohide-scrollbar pb-3">
            {REEL_REGION_TABS.map((tab) => {
              const isActive = selectedReelRegion === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    setSelectedReelRegion(tab.id);
                    if (selectedReelStar !== 'ALL') {
                      const found = (actressesRegistryData as Array<{ id: string; region: string }>).find(
                        (a) => a.id === selectedReelStar
                      );
                      if (tab.id !== 'ALL' && (!found || found.region !== tab.id)) {
                        setSelectedReelStar('ALL');
                      }
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer shrink-0 border ${
                    isActive
                      ? 'bg-[#ccff00] text-black border-[#ccff00] shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                      : 'bg-white/[0.03] text-neutral-400 border-white/10 hover:text-white hover:border-white/20'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-black text-[#ccff00] font-black' : 'bg-white/10 text-neutral-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tier 2 Actress Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto autohide-scrollbar pb-5 mb-4 border-b border-white/[0.06]">
            <button
              type="button"
              onClick={() => {
                hapticMedium();
                setSelectedReelStar('ALL');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono tracking-wider uppercase transition-all duration-150 cursor-pointer shrink-0 border ${
                selectedReelStar === 'ALL'
                  ? 'bg-white text-black font-black border-white shadow-md'
                  : 'bg-white/[0.02] text-neutral-400 border-white/10 hover:text-white'
              }`}
            >
              <span>ALL ACTRESSES ({visibleReelActresses.length})</span>
            </button>

            {visibleReelActresses.map((actress) => {
              const isActive = selectedReelStar === actress.id || selectedReelStar === actress.name;
              return (
                <button
                  key={actress.id}
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    setSelectedReelStar(actress.id);
                  }}
                  className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-mono tracking-wider uppercase transition-all duration-150 cursor-pointer shrink-0 border ${
                    isActive
                      ? 'bg-[#ccff00] text-black font-black border-[#ccff00] shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                      : 'bg-white/[0.02] text-neutral-300 border-white/10 hover:border-white/30 hover:text-white'
                  }`}
                >
                  <img
                    src={actress.avatar}
                    alt={actress.name}
                    loading="lazy"
                    className="w-4 h-4 rounded-full object-cover shrink-0"
                  />
                  <span>{actress.label}</span>
                </button>
              );
            })}
          </div>

          {/* 9:16 Vertical Reels Grid Wall */}
          <div
            key={`${selectedReelRegion}-${selectedReelStar}`}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-5 pb-24 animate-fade-in"
          >
            {filteredReels.map((reel, idx) => {
              return (
                <div
                  key={reel.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenCelebrityReel(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenCelebrityReel(idx);
                    }
                  }}
                  style={{ animationDelay: `${Math.min(idx * 20, 240)}ms` }}
                  className="group relative rounded-2xl overflow-hidden bg-[#090d16] border border-white/10 hover:border-[#ccff00] shadow-[0_12px_35px_rgba(0,0,0,0.85)] hover:shadow-[0_20px_45px_rgba(204,255,0,0.18)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.97] cursor-pointer flex flex-col select-none aspect-[9/16]"
                >
                  {/* Poster Image */}
                  <img
                    src={reel.thumbnail}
                    alt={reel.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  {/* Gradient Scrim */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent pointer-events-none" />

                  {/* Top Floating Tags */}
                  <div className="absolute top-2.5 inset-x-2.5 z-10 flex items-center justify-between pointer-events-none">
                    {/* Sound Equalizer Bars */}
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/65 backdrop-blur-md border border-white/15">
                      <span className="w-0.5 h-2.5 bg-[#ccff00] rounded animate-pulse" />
                      <span className="w-0.5 h-3 bg-[#ccff00] rounded animate-pulse delay-75" />
                      <span className="w-0.5 h-2 bg-[#ccff00] rounded animate-pulse delay-150" />
                    </div>

                    <span className="px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-[9px] font-mono font-bold text-neutral-200 uppercase tracking-wider">
                      {reel.views}
                    </span>
                  </div>

                  {/* Hover Center Play Button */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                    <div className="w-12 h-12 rounded-full bg-[#ccff00] text-black flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </div>
                  </div>

                  {/* Bottom Caption & Actress Info */}
                  <div className="absolute bottom-0 inset-x-0 p-3 z-10 flex flex-col gap-1.5 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none">
                    <div className="flex items-center gap-1.5">
                      <span className="font-['Space_Grotesk'] font-bold text-xs text-white truncate">
                        {reel.actressName}
                      </span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#ccff00] shrink-0 fill-[#ccff00]/20" />
                    </div>

                    <h3 className="font-sans text-[11px] font-normal text-neutral-200 line-clamp-2 leading-tight group-hover:text-white transition-colors">
                      {reel.title}
                    </h3>

                    <div className="flex items-center gap-1 text-[10px] font-mono text-neutral-400 truncate pt-1 border-t border-white/10">
                      <Music2 className="w-3 h-3 text-[#ccff00] shrink-0" />
                      <span className="truncate">{reel.sound}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      ) : (
        /* ===================================================================== */
        /* LEVEL 1: UNIFIED EDITORIAL EXPERIENCE (SHORTS / PHOTO / CLIPS / REALTUBE) */
        /* ===================================================================== */
        <main
          aria-label={`${selectedCategory} Media Hub`}
          className={`flex-1 w-full overflow-y-auto space-scrollbar p-5 sm:p-8 lg:p-12 z-10 flex flex-col bg-transparent min-h-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isModalOpen ? 'scale-[0.985] brightness-[0.7] blur-[1px]' : 'scale-100 brightness-100 blur-0'
          }`}
        >
          {/* Section Hero Header */}
          <div key={selectedCategory} className={`flex flex-col gap-2 pb-6 mb-6 border-b border-white/10 shrink-0 ${slideDirection === 'right' ? 'animate-kinetic-slide-right' : 'animate-kinetic-slide-left'}`}>
            <div className="flex items-center gap-2.5 font-mono text-[10px] sm:text-xs text-[#ccff00] uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-[#ccff00] shadow-[0_0_8px_rgba(204,255,0,0.8)] animate-pulse" />
              <span>
                {selectedCategory === 'SHORTS' && '9:16 VERTICAL STREAM // ULTRA HIGH-DEF SHORT-FORM REELS'}
                {selectedCategory === 'PHOTOGRAPHY' && 'CURATED EXHIBITION // STILL PHOTOGRAPHY & EDITORIAL PORTFOLIO'}
                {selectedCategory === 'CLIPS' && 'CINEMATIC VAULT // 16:9 4K SCENE SELECTIONS & TEASERS'}
                {selectedCategory === 'REALTUBE' && 'STREAMING CHANNEL HUB // EXCLUSIVE EXTENDED BROADCASTS'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <h1 className="font-['Space_Grotesk',sans-serif] font-black text-2xl sm:text-3xl lg:text-4xl tracking-wider uppercase text-white">
                {selectedCategory === 'SHORTS' && 'EXCLUSIVE SHORTS'}
                {selectedCategory === 'PHOTOGRAPHY' && 'STILL PHOTOGRAPHY'}
                {selectedCategory === 'CLIPS' && 'CINEMA CLIPS'}
                {selectedCategory === 'REALTUBE' && 'REALTUBE BROADCASTS'}
              </h1>
              <span className="text-xs font-mono text-neutral-400">
                ({activeMediaList.length} {activeMediaList.length === 1 ? 'item' : 'items'} available)
              </span>
            </div>

            <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl leading-relaxed">
              {selectedCategory === 'SHORTS' &&
                'Bite-sized, high-energy vertical reels curated from viral moments, dance highlights, and backstage appearances.'}
              {selectedCategory === 'PHOTOGRAPHY' &&
                'High-definition editorial galleries, red carpet appearances, and studio portrait shoots rendered in true natural master color.'}
              {selectedCategory === 'CLIPS' &&
                'Iconic high-definition cinema sequences, song highlights, and official teaser trailers streamed in lossless 4K theater fidelity.'}
              {selectedCategory === 'REALTUBE' &&
                'Curated long-form feature releases, interview retrospectives, and studio programs.'}
            </p>
          </div>

          {/* Interactive Collection Filter Pills */}
          {childSubfoldersList.length > 0 && (
            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-2 mb-6 shrink-0">
              <button
                type="button"
                onClick={() => {
                  hapticMedium();
                  navigateSubfolder(null);
                }}
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap leading-none flex items-center justify-center ${
                  selectedSubfolder === null
                    ? 'bg-[#ccff00] text-black shadow-[0_0_14px_rgba(204,255,0,0.35)]'
                    : 'text-neutral-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10'
                }`}
              >
                ALL {selectedCategory} ({allCategoryFiles.length})
              </button>

              {childSubfoldersList.map((sub) => (
                <button
                  key={sub.name}
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    navigateSubfolder(sub.name);
                  }}
                  className={`shrink-0 px-4 py-2 rounded-full text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap leading-none flex items-center justify-center ${
                    selectedSubfolder === sub.name
                      ? 'bg-[#ccff00] text-black shadow-[0_0_14px_rgba(204,255,0,0.35)]'
                      : 'text-neutral-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10'
                  }`}
                >
                  {sub.name} ({sub.files.length})
                </button>
              ))}
            </div>
          )}

          {/* REALTUBE Spotlight Hero Banner (Featured Premiere) */}
          {selectedCategory === 'REALTUBE' && activeMediaList.length > 0 && selectedSubfolder === null && (
            <div className="relative rounded-2xl overflow-hidden mb-8 border border-white/10 bg-[#08080a] group aspect-[21/9] min-h-[260px] sm:min-h-[320px] flex flex-col justify-end p-6 sm:p-10 select-none shadow-2xl shrink-0">
              {/* Background Thumbnail */}
              {(() => {
                const heroItem = activeMediaList[0];
                const imageSrc =
                  (heroItem as any).thumbnail ||
                  (heroItem as any).src ||
                  heroItem.url ||
                  (heroItem as any).image ||
                  heroItem.path ||
                  '';
                const heroThumb =
                  getImageUrl(heroItem) ||
                  getThumbnailUrl(heroItem) ||
                  resolveStaticVideoThumbnail(heroItem) ||
                  getMediaUrl(imageSrc) ||
                  imageSrc;

                return heroThumb ? (
                  <img
                    src={heroThumb}
                    alt={heroItem.title || heroItem.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-60"
                  />
                ) : null;
              })()}

              {/* Gradient Scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/70 to-transparent pointer-events-none" />

              {/* Hero Content */}
              <div className="relative z-10 max-w-2xl flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#ccff00] animate-pulse" />
                  <span className="font-mono text-[10px] font-bold text-[#ccff00] uppercase tracking-widest">
                    FEATURED PREMIERE // 2026
                  </span>
                </div>

                <h2 className="font-['Space_Grotesk',sans-serif] font-black text-xl sm:text-2xl lg:text-3xl text-white uppercase tracking-wider line-clamp-2">
                  {activeMediaList[0]?.title || (activeMediaList[0]?.name ? activeMediaList[0].name.replace(/\.[a-z0-9]+$/i, '') : 'PREMIERE')}
                </h2>

                <p className="text-xs sm:text-sm text-neutral-300 line-clamp-2">
                  {activeMediaList[0]?.parentAlbum || 'Exclusive uncut broadcast stream presented in lossless master theater fidelity.'}
                </p>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handleOpenItem(activeMediaList[0], 0)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#ccff00] hover:bg-[#b8e600] text-black font-mono font-bold text-xs uppercase tracking-wider cursor-pointer shadow-[0_0_18px_rgba(204,255,0,0.4)] transition-all hover:scale-105 active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                    <span>PLAY PREMIERE</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Media Items Presentation Grid */}
          {activeMediaList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center my-auto min-h-[40vh] border border-white/5 rounded-2xl bg-[#08080a]">
              <div className="w-12 h-12 rounded-full bg-[#ccff00]/10 border border-[#ccff00]/30 flex items-center justify-center text-[#ccff00] mb-3">
                <Folder className="w-6 h-6" />
              </div>
              <p className="font-['Space_Grotesk',sans-serif] text-white text-base font-bold uppercase tracking-wider mb-1">
                No Media Items in this Collection
              </p>
              <span className="text-xs font-mono text-neutral-500 uppercase tracking-widest">
                INDEX READY // SCAN COMPLETE
              </span>
            </div>
          ) : (
            <div
              key={`${selectedCategory}-${selectedSubfolder || 'all'}`}
              className={`w-full pb-20 ${
                slideDirection === 'right' ? 'animate-kinetic-slide-right' : 'animate-kinetic-slide-left'
              } ${
                selectedCategory === 'SHORTS'
                  ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4'
                  : selectedCategory === 'PHOTOGRAPHY'
                  ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4'
                  : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5'
              }`}
            >
              {activeMediaList.map((item, idx) => {
                const isPhoto =
                  item.type === 'image' || isPhotoExtension(item.path || item.url || item.name || '');

                const imageSrc =
                  (item as any).thumbnail ||
                  (item as any).src ||
                  item.url ||
                  (item as any).image ||
                  item.path ||
                  '';

                const thumb = isPhoto
                  ? getMediaUrl(imageSrc) || imageSrc
                  : getImageUrl(item) ||
                    getThumbnailUrl(item) ||
                    resolveStaticVideoThumbnail(item) ||
                    getMediaUrl(imageSrc) ||
                    imageSrc;

                const displayName = item.title || (item.name ? item.name.replace(/\.[a-z0-9]+$/i, '') : 'Media');

                /* ------------------------------------------------------------- */
                /* 1. SHORTS: 9:16 Vertical Card with Soundwave & Play Bloom     */
                /* ------------------------------------------------------------- */
                if (selectedCategory === 'SHORTS') {
                  return (
                    <div
                      key={item.id || item.url || idx}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenItem(item, idx);
                      }}
                      style={{ animationDelay: `${Math.min(idx * 28, 300)}ms` }}
                      className="group relative rounded-xl overflow-hidden bg-[#08080a] border border-white/10 hover:border-[#ccff00] hover:shadow-[0_0_25px_rgba(204,255,0,0.25)] aspect-[9/16] cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.97] animate-velvet-cascade flex flex-col justify-end select-none"
                    >
                      <SmartThumbnail
                        src={thumb}
                        alt=""
                        aspectClass="aspect-[9/16]"
                        containerClassName="absolute inset-0 w-full h-full border-0"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />

                      {/* Top Badges: Duration & Soundwave */}
                      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none">
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider uppercase text-white bg-black/70 backdrop-blur-md border border-white/10">
                          REEL 4K
                        </span>
                        <div className="flex items-end gap-0.5 h-3 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md">
                          <span className="w-0.5 h-1.5 bg-[#ccff00] rounded-full animate-pulse" />
                          <span className="w-0.5 h-3 bg-[#ccff00] rounded-full animate-pulse [animation-delay:150ms]" />
                          <span className="w-0.5 h-2 bg-[#ccff00] rounded-full animate-pulse [animation-delay:300ms]" />
                        </div>
                      </div>

                      {/* Floating Play Icon on Hover */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-10">
                        <div className="w-12 h-12 rounded-full bg-[#ccff00] text-black flex items-center justify-center shadow-[0_0_20px_rgba(204,255,0,0.7)] group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 fill-current ml-0.5 text-black" />
                        </div>
                      </div>

                      {/* Bottom Gradient Scrim & Title */}
                      <div className="relative z-10 p-3 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none">
                        <span className="text-[9px] font-mono font-bold text-[#ccff00] uppercase tracking-wider block truncate">
                          {item.parentAlbum || 'SHORT'}
                        </span>
                        <h3 className="text-xs font-bold text-white leading-tight line-clamp-2 mt-0.5 group-hover:text-white transition-colors">
                          {displayName}
                        </h3>
                      </div>
                    </div>
                  );
                }

                /* ------------------------------------------------------------- */
                /* 2. PHOTOGRAPHY: Editorial Exhibition Portrait Card            */
                /* ------------------------------------------------------------- */
                if (selectedCategory === 'PHOTOGRAPHY') {
                  return (
                    <div
                      key={item.id || item.url || idx}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenItem(item, idx);
                      }}
                      style={{ animationDelay: `${Math.min(idx * 28, 300)}ms` }}
                      className="group relative rounded-xl overflow-hidden bg-[#08080a] border border-white/10 hover:border-[#ccff00] hover:shadow-[0_0_20px_rgba(204,255,0,0.25)] aspect-[3/4] cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.97] animate-velvet-cascade flex flex-col justify-end select-none"
                    >
                      <SmartThumbnail
                        src={thumb}
                        alt=""
                        aspectClass="aspect-[3/4]"
                        containerClassName="absolute inset-0 w-full h-full border-0"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />

                      {/* Subtle Corner Reticle Ticks on Hover */}
                      <div className="absolute inset-0 border border-transparent group-hover:border-[#ccff00]/30 transition-colors pointer-events-none z-10" />

                      {/* Bottom Caption Overlay */}
                      <div className="relative z-10 p-3 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none opacity-90 group-hover:opacity-100 transition-opacity">
                        <span className="text-[9px] font-mono text-[#ccff00] uppercase tracking-wider block truncate">
                          STILL // {item.parentAlbum || 'EXHIBIT'}
                        </span>
                        <h3 className="text-xs font-medium text-white truncate mt-0.5">
                          {displayName}
                        </h3>
                      </div>
                    </div>
                  );
                }

                /* ------------------------------------------------------------- */
                /* 3. CLIPS & REALTUBE: 16:9 Widescreen Cinema Card             */
                /* ------------------------------------------------------------- */
                return (
                  <div
                    key={item.id || item.url || idx}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenItem(item, idx);
                    }}
                    style={{ animationDelay: `${Math.min(idx * 28, 300)}ms` }}
                    className="group relative rounded-xl overflow-hidden bg-[#08080a] border border-white/10 hover:border-[#ccff00] hover:shadow-[0_0_25px_rgba(204,255,0,0.25)] cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.97] animate-velvet-cascade flex flex-col select-none"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-[#050505]">
                      <SmartThumbnail
                        src={thumb}
                        alt=""
                        aspectClass="aspect-video"
                        containerClassName="w-full h-full border-0"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />

                      {/* 4K UHD Badge */}
                      <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider uppercase text-black bg-[#ccff00] shadow-sm">
                          4K UHD
                        </span>
                      </div>

                      {/* Hover Center Play Button */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                        <div className="w-11 h-11 rounded-full bg-[#ccff00] text-black flex items-center justify-center shadow-[0_0_20px_rgba(204,255,0,0.7)] group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 fill-current ml-0.5 text-black" />
                        </div>
                      </div>
                    </div>

                    {/* Card Info Details */}
                    <div className="p-3 sm:p-3.5 flex flex-col gap-1 bg-[#0a0a0d]">
                      <span className="text-[9px] font-mono font-bold text-[#ccff00] uppercase tracking-wider block truncate">
                        {item.parentAlbum || selectedCategory}
                      </span>
                      <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-1 group-hover:text-white transition-colors">
                        {displayName}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-400 mt-0.5">
                        <Film className="w-3 h-3 text-[#ccff00]" />
                        <span>STREAM READY</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* 9:16 Fullscreen Vertical Celebrity Reel Player Modal */}
      <CelebrityReelPlayerModal
        isOpen={isReelPlayerOpen}
        onClose={() => {
          setIsReelPlayerOpen(false);
          setActiveVideoId(null);
          updateRoute({ videoId: null });
        }}
        reels={filteredReels}
        initialIndex={activeReelIndex}
        onIndexChange={(newIdx) => {
          setActiveReelIndex(newIdx);
          const r = filteredReels[newIdx];
          if (r?.id) {
            setActiveVideoId(r.id);
            updateRoute({ videoId: r.id });
          }
        }}
      />
    </div>
  );
};

export default MonolithBarGate;
