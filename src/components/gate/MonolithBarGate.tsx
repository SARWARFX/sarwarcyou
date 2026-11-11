import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Play, Folder, Film } from 'lucide-react';
import type { StageMediaItem } from '../../types';
import { MIDNIGHT_OBSIDIAN_THEME } from './themeManager';
import { CinematicBackdropCanvas } from './CinematicBackdropCanvas';
import { MAJOR_FOLDERS } from '../navigation/SidebarAccordionNav';
import { isPhotoExtension } from '../../utils/mediaTypeDetector';
import { resolveStaticVideoThumbnail } from '../../utils/thumbnailResolver';
import { sortMediaItemsDescending } from '../../utils/albumExtractor';
import { type DirectoryNode } from '../DeepSpaceTreeExplorer';
import { useBackButton } from '../../utils/backButtonManager';
import { HeaderBrandLogo } from '../updater/HeaderBrandLogo';
import { VaultDrawer } from '../VaultDrawer';
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
  // 3 Core Categories solely for Hugging Face Directory: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY'
  const [selectedCategory, setSelectedCategory] = useState<string | null>(() => {
    if (!initialRoute.category || initialRoute.category === 'ARCHIVE' || initialRoute.category === 'NEWS' || initialRoute.category === 'YOUTUBE' || initialRoute.category === 'SHORTS') return 'SHORTS';
    if (initialRoute.category === 'REALTUBE' || initialRoute.category === 'CLIPS') return 'CLIPS';
    if (initialRoute.category === 'PHOTOGRAPHY' || (initialRoute.category as string) === 'IMAGES') return 'PHOTOGRAPHY';
    return initialRoute.category;
  });
  const [selectedSubfolder, setSelectedSubfolder] = useState<string | null>(initialRoute.subfolder);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(initialRoute.videoId);

  // Dynamic Animated Transition Pool for Fluid Channel Surfing & Shift Animations
  const TRANSITION_ANIMATIONS = useMemo(
    () => [
      'animate-kinetic-slide-right',
      'animate-kinetic-slide-left',
      'animate-kinetic-zoom-dissolve',
      'animate-cyber-shimmer-fade',
      'animate-kinetic-slide-up',
    ],
    []
  );

  const [activeTransitionClass, setActiveTransitionClass] = useState<string>('animate-kinetic-slide-right');
  const [idleTourProgress, setIdleTourProgress] = useState<number>(0);
  const [isAutoTourPaused, setIsAutoTourPaused] = useState<boolean>(true);
  const lastUserActivityRef = useRef<number>(Date.now());

  // Synchronize route state with browser address bar
  const updateRoute = useCallback(
    (newRoute: Partial<AppIdRoute>, replace = false) => {
      syncAppRoute(
        {
          category: newRoute.category !== undefined ? newRoute.category : (selectedCategory as any),
          subfolder: newRoute.subfolder !== undefined ? newRoute.subfolder : selectedSubfolder,
          videoId: newRoute.videoId !== undefined ? newRoute.videoId : activeVideoId,
        },
        replace
      );
    },
    [selectedCategory, selectedSubfolder, activeVideoId]
  );

  // Synchronize state when browser Back / Forward (popstate) is clicked
  useEffect(() => {
    const handlePopState = () => {
      const route = parseIdRoute();
      const cat = (!route.category || route.category === 'ARCHIVE' || route.category === 'NEWS' || route.category === 'YOUTUBE' || route.category === 'SHORTS')
        ? 'SHORTS'
        : (route.category === 'REALTUBE' || route.category === 'CLIPS')
        ? 'CLIPS'
        : 'PHOTOGRAPHY';
      setSelectedCategory(cat);
      setSelectedSubfolder(route.subfolder);
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

  const MAIN_TAB_ORDER = useMemo(() => ['SHORTS', 'CLIPS', 'PHOTOGRAPHY'], []);

  // User activity tracker: any touch, keypress, click, or scroll resets the 10-second idle timer
  const recordUserActivity = useCallback(() => {
    lastUserActivityRef.current = Date.now();
    setIdleTourProgress(0);
  }, []);

  // Listen to all user activity events across window & document
  useEffect(() => {
    const activityEvents = [
      'mousemove',
      'mousedown',
      'pointerdown',
      'keydown',
      'touchstart',
      'touchmove',
      'wheel',
      'scroll',
    ];

    const resetIdleTimer = () => {
      lastUserActivityRef.current = Date.now();
      setIdleTourProgress(0);
    };

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, resetIdleTimer, { passive: true, capture: true });
    });

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, resetIdleTimer, { capture: true });
      });
    };
  }, []);

  const navigateTab = useCallback(
    (newCat: string | null) => {
      recordUserActivity();
      const currentKey = selectedCategory || 'NEWS';
      const targetKey = newCat || 'NEWS';
      if (currentKey === targetKey) return;
      const oldIdx = MAIN_TAB_ORDER.indexOf(currentKey);
      const newIdx = MAIN_TAB_ORDER.indexOf(targetKey);
      setActiveTransitionClass(newIdx >= oldIdx ? 'animate-kinetic-slide-right' : 'animate-kinetic-slide-left');
      setSelectedCategory(targetKey);
      setSelectedSubfolder(null);
      updateRoute({ category: targetKey as any, subfolder: null, videoId: null });
    },
    [selectedCategory, MAIN_TAB_ORDER, updateRoute, recordUserActivity]
  );

  const navigateSubfolder = useCallback(
    (newSub: string | null) => {
      recordUserActivity();
      if (selectedSubfolder === newSub) return;
      const allSubs = ['ALL', ...childSubfoldersList.map((s) => s.name)];
      const oldIdx = allSubs.indexOf(selectedSubfolder || 'ALL');
      const newIdx = allSubs.indexOf(newSub || 'ALL');
      setActiveTransitionClass(newIdx >= oldIdx ? 'animate-kinetic-slide-right' : 'animate-kinetic-slide-left');
      setSelectedSubfolder(newSub);
      updateRoute({ subfolder: newSub });
    },
    [selectedSubfolder, childSubfoldersList, updateRoute, recordUserActivity]
  );

  // Home navigation handler: returns to Public News Overview & resets all state
  const handleExitToHome = useCallback(() => {
    recordUserActivity();
    setSelectedCategory('SHORTS');
    setSelectedSubfolder(null);
    setActiveVideoId(null);
    setActiveTransitionClass('animate-kinetic-slide-left');
    updateRoute({ category: 'SHORTS', subfolder: null, videoId: null, mediaId: null });
    setVaultDrawerOpen(false);
  }, [updateRoute, recordUserActivity]);

  // =========================================================================
  // 10-SECOND AUTONOMOUS SHOWCASE TOUR / IDLE CAROUSEL ROLLER
  // Cycles automatically across folders: NEWS -> SHORTS -> CLIPS ->
  // PHOTOGRAPHY -> CLASSIC -> MUSIC -> NEWS every 10s if visitor is idle.
  // Immediately pauses and resets on any mouse, touch, scroll, or key action.
  // =========================================================================
  const IDLE_ROLL_LIMIT_MS = 10000;

  useEffect(() => {
    // If any modal, player, or drawer is active, pause rolling
    if (isModalOpen || isVaultDrawerOpen || isAutoTourPaused) {
      setIdleTourProgress(0);
      return;
    }

    const interval = setInterval(() => {
      if (isModalOpen || isVaultDrawerOpen || isAutoTourPaused) {
        setIdleTourProgress(0);
        return;
      }

      const idleDuration = Date.now() - lastUserActivityRef.current;
      const pct = Math.min(100, (idleDuration / IDLE_ROLL_LIMIT_MS) * 100);
      setIdleTourProgress(pct);

      if (idleDuration >= IDLE_ROLL_LIMIT_MS) {
        // Reset timer for next 10 seconds
        lastUserActivityRef.current = Date.now();
        setIdleTourProgress(0);

        // Pick a random animated transition from the pool
        const randomAnim =
          TRANSITION_ANIMATIONS[Math.floor(Math.random() * TRANSITION_ANIMATIONS.length)];
        setActiveTransitionClass(randomAnim);

        setSelectedCategory((currentCat) => {
          const current = currentCat || 'NEWS';
          const curIdx = MAIN_TAB_ORDER.indexOf(current as any);
          const nextIdx = curIdx === -1 ? 0 : (curIdx + 1) % MAIN_TAB_ORDER.length;
          const nextCat = MAIN_TAB_ORDER[nextIdx];

          setSelectedSubfolder(null);
          updateRoute({ category: nextCat as any, subfolder: null, videoId: null });
          return nextCat;
        });
      }
    }, 200);

    return () => clearInterval(interval);
  }, [
    isModalOpen,
    isVaultDrawerOpen,
    isAutoTourPaused,
    MAIN_TAB_ORDER,
    TRANSITION_ANIMATIONS,
    updateRoute,
  ]);

  // Return to Category Subfolders handler (Level 2 -> Level 1)
  const handleReturnToCategory = useCallback(() => {
    navigateSubfolder(null);
  }, [navigateSubfolder]);

  // Android Native Hardware Back Button handler (stepped 2-tier back navigation)
  useBackButton(
    useCallback(() => {
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

      // 3. If in another category, return to NEWS
      if (selectedCategory !== 'NEWS') {
        handleExitToHome();
        return true;
      }

      return false;
    }, [isVaultDrawerOpen, selectedSubfolder, selectedCategory, handleReturnToCategory, handleExitToHome, updateRoute])
  );

  const renderCategorySubfolderBar = (category: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY', compact = false) => {
    let subOptions: { name: string; count: number; isCelebrity?: boolean }[] = [];
    if (category === 'SHORTS') {
      const shortsNode = rootMap.get('Shorts');
      const catalogSubs = shortsNode ? Array.from(shortsNode.subfolders.keys()).filter((s) => s !== 'Celebrity Reels') : [];
      const knownShorts = ['Shorts 2027', 'Shorts Classic', 'REALTube Shorts'];
      const allSubs = Array.from(new Set([...knownShorts, ...catalogSubs]));

      subOptions = allSubs.map((s) => ({
        name: s,
        count: shortsNode?.subfolders.get(s)?.files.length || 0,
      }));
    } else if (category === 'CLIPS') {
      const clipsNode = rootMap.get('Clips');
      const catalogSubs = clipsNode ? Array.from(clipsNode.subfolders.keys()) : [];
      const knownClips = ['Clips 2027', 'Clips 2026', 'Clips 2025', 'Favorite Video Clips', 'Classic Video Clips', 'REALTube Video Clips'];
      const allSubs = Array.from(new Set([...knownClips, ...catalogSubs]));

      subOptions = allSubs.map((s) => ({
        name: s,
        count: clipsNode?.subfolders.get(s)?.files.length || 0,
      }));
    } else if (category === 'PHOTOGRAPHY') {
      const imagesNode = rootMap.get('Images');
      const catalogSubs = imagesNode ? Array.from(imagesNode.subfolders.keys()) : [];
      const knownImages = ['Images 2027', 'Images 2026', 'Images 2025', 'Favourite Images', 'Classic Images', 'REALTube Images'];
      const allSubs = Array.from(new Set([...knownImages, ...catalogSubs]));
      subOptions = allSubs.map((s) => ({
        name: s,
        count: imagesNode?.subfolders.get(s)?.files.length || 0,
      }));
    }

    const currentSub = selectedSubfolder || subOptions[0]?.name;

    return (
      <div
        className={`flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 max-w-full ${
          compact ? 'py-0.5' : 'w-full py-2 mb-4 min-h-[46px] border-b border-white/[0.08]'
        }`}
      >
        {subOptions.map((sub) => {
          const isActive = currentSub === sub.name;
          return (
            <button
              key={sub.name}
              type="button"
              onClick={() => {
                hapticMedium();
                navigateSubfolder(sub.name);
              }}
              className={`flex items-center gap-1.5 ${
                compact ? 'px-3 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs'
              } rounded-full font-mono font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer shrink-0 border ${
                isActive
                  ? 'bg-[#ccff00] text-black border-[#ccff00] shadow-[0_0_12px_rgba(204,255,0,0.35)]'
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

      {/* TOP HEADER BAR: Zero-Clue Logo Trigger & Minimalist Status */}
      <header className="relative w-full px-4 sm:px-8 py-3 flex items-center justify-between border-b border-white/[0.08] bg-[#050505]/95 backdrop-blur-md z-30 shrink-0">
        {/* Dynamic 10-Second Idle Tour Laser Progress Line */}
        <div className="absolute bottom-0 left-0 h-[2px] w-full bg-white/[0.03] overflow-hidden pointer-events-none">
          <div
            className="h-full bg-[#ccff00] transition-all duration-200 ease-linear shadow-[0_0_8px_#ccff00]"
            style={{
              width: `${idleTourProgress}%`,
              opacity: isAutoTourPaused ? 0 : 0.85,
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <HeaderBrandLogo
            trackingClass="tracking-[0.2em] sm:tracking-[0.24em]"
            onTrigger={() => setVaultDrawerOpen((prev) => !prev)}
          />
          <span className="hidden sm:inline-block text-[10px] font-mono text-[#ccff00] uppercase tracking-widest px-2 py-0.5 rounded bg-[#ccff00]/10 border border-[#ccff00]/25">
            {selectedCategory === 'PHOTOGRAPHY'
              ? 'PHOTOGRAPHS'
              : selectedCategory === 'CLIPS'
              ? 'VIDEO CLIPS'
              : 'SHORTS'}
          </span>
        </div>

        {/* Avant-Garde Quick Select Keys: Consolidated Tabs */}
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
          {/* Autonomous Rolling Tour Toggle Pill (Paused by default until visitor starts it) */}
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              setIsAutoTourPaused((p) => {
                const nextState = !p;
                if (!nextState) {
                  // Starting tour: reset activity timer and progress
                  lastUserActivityRef.current = Date.now();
                  setIdleTourProgress(0);
                }
                return nextState;
              });
            }}
            title={isAutoTourPaused ? 'Click to start 10s autonomous tour across feeds' : 'Click to pause autonomous tour'}
            className={`flex items-center gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-md text-[10px] font-mono tracking-wider uppercase border transition-all cursor-pointer mr-1 ${
              isAutoTourPaused
                ? 'bg-white/[0.03] border-white/10 hover:border-[#ccff00]/50 text-neutral-400 hover:text-white'
                : 'bg-[#ccff00]/10 border-[#ccff00]/40 text-[#ccff00] shadow-[0_0_10px_rgba(204,255,0,0.2)]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isAutoTourPaused ? 'bg-neutral-500' : 'bg-[#ccff00] animate-pulse shadow-[0_0_6px_#ccff00]'
              }`}
            />
            <span>{isAutoTourPaused ? 'START TOUR' : 'AUTO TOUR'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticMedium();
              navigateTab('SHORTS');
            }}
            className={`px-3 sm:px-4 py-1.5 rounded-md text-[11px] sm:text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'SHORTS' || selectedCategory === null || selectedCategory === 'YOUTUBE'
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
            className={`px-3 sm:px-4 py-1.5 rounded-md text-[11px] sm:text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'CLIPS' || selectedCategory === 'REALTUBE'
                ? 'bg-[#ccff00] text-black shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            VIDEO CLIPS
          </button>
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              navigateTab('PHOTOGRAPHY');
            }}
            className={`px-3 sm:px-4 py-1.5 rounded-md text-[11px] sm:text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'PHOTOGRAPHY'
                ? 'bg-[#ccff00] text-black shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            PHOTOGRAPHS
          </button>
        </div>
      </header>

      {/* MAIN VIEWPORT STAGE: 3 Hugging Face Directory Sections */}
      {selectedCategory === 'SHORTS' || selectedCategory === null || selectedCategory === 'YOUTUBE' ? (
        /* ===================================================================== */
        /* TAB 1: SHORTS // 9:16 VERTICAL STREAM FEED                            */
        /* ===================================================================== */
        <main
          key="shorts-hub"
          aria-label="Shorts Hub"
          className={`flex-1 w-full min-h-0 overflow-y-auto space-scrollbar p-4 sm:p-7 lg:p-10 z-10 flex flex-col bg-transparent transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isModalOpen ? 'scale-[0.985] brightness-[0.7] blur-[1px]' : 'scale-100 brightness-100 blur-0'
          } ${activeTransitionClass}`}
        >
          {/* Header Bar for Catalog Subfolder */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 mb-6 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3 shrink-0">
              <Film className="w-5 h-5 text-[#ccff00]" />
              <div>
                <h1 className="text-base sm:text-lg font-serif font-bold tracking-widest text-[#f4f4f5] uppercase">
                  {selectedSubfolder || 'Shorts 2027'}
                </h1>
                <p className="text-[10px] sm:text-[11px] tracking-wide text-neutral-400">
                  Archived Shorts Stream • {activeMediaList.length} Items Indexed
                </p>
              </div>
            </div>
            <div className="flex items-center md:justify-end gap-1.5 overflow-x-auto no-scrollbar max-w-full md:max-w-[70%] shrink-0">
              {renderCategorySubfolderBar('SHORTS', true)}
            </div>
          </div>

          {/* Subfolder Media Grid (Shorts 2027, Shorts Classic, REALTube Shorts) */}
          {activeMediaList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center my-auto min-h-[40vh] border border-white/5 rounded-2xl bg-[#08080a]">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4 pb-20">
              {activeMediaList.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => handleOpenItem(item, idx)}
                  className="group relative rounded-2xl overflow-hidden bg-[#090d16] border border-white/10 hover:border-[#ccff00] cursor-pointer aspect-[9/16] transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <img
                    src={item.thumbnail || item.url}
                    alt={item.title || item.name}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-[#ccff00] text-black flex items-center justify-center shadow-lg">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 p-3">
                    <p className="text-xs font-bold text-white line-clamp-2">{item.title || item.name}</p>
                    <span className="text-[10px] font-mono text-[#ccff00]">{selectedSubfolder || 'Shorts 2027'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      ) : selectedCategory === 'CLIPS' || selectedCategory === 'REALTUBE' ? (
        /* ===================================================================== */
        /* TAB 2: VIDEO CLIPS // 16:9 WIDESCREEN CINEMA & MUSIC RELEASES         */
        /* ===================================================================== */
        <main
          key="clips-hub"
          aria-label="Video Clips Hub"
          className={`flex-1 w-full min-h-0 overflow-hidden flex flex-col min-w-0 z-10 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isModalOpen ? 'scale-[0.985] brightness-[0.7] blur-[1px]' : 'scale-100 brightness-100 blur-0'
          } ${activeTransitionClass}`}
        >
          <div className="flex-1 w-full overflow-y-auto space-scrollbar p-5 sm:p-8 lg:p-12">
            {/* Header Bar for Catalog Subfolder */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 mb-6 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3 shrink-0">
                <Film className="w-5 h-5 text-[#ccff00]" />
                <div>
                  <h1 className="text-base sm:text-lg font-serif font-bold tracking-widest text-[#f4f4f5] uppercase">
                    {selectedSubfolder || 'Clips 2027'}
                  </h1>
                  <p className="text-[10px] sm:text-[11px] tracking-wide text-neutral-400">
                    Archived Video Clips & Broadcasts • {activeMediaList.length} Items Indexed
                  </p>
                </div>
              </div>
              <div className="flex items-center md:justify-end gap-1.5 overflow-x-auto no-scrollbar max-w-full md:max-w-[70%] shrink-0">
                {renderCategorySubfolderBar('CLIPS', true)}
              </div>
            </div>

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
                key={`clips-${selectedSubfolder || 'all'}`}
                className={`w-full pb-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 ${activeTransitionClass}`}
              >
                {activeMediaList.map((item, idx) => {
                  const imageSrc =
                    (item as any).thumbnail ||
                    resolveStaticVideoThumbnail(item) ||
                    item.poster ||
                    item.url;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleOpenItem(item, idx)}
                      className="group relative rounded-xl overflow-hidden bg-[#0d0d10] border border-white/[0.08] hover:border-[#ccff00] hover:shadow-[0_0_20px_rgba(204,255,0,0.2)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex flex-col justify-between aspect-video select-none"
                    >
                      <img
                        src={imageSrc}
                        alt={item.title || item.name}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent pointer-events-none" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                        <div className="w-11 h-11 rounded-full bg-[#ccff00] text-black flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>
                      <div className="absolute bottom-0 inset-x-0 p-3 pointer-events-none">
                        <p className="text-xs font-bold text-white line-clamp-1 group-hover:text-[#ccff00] transition-colors">
                          {item.title || item.name}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-400 mt-0.5">
                          <Film className="w-3 h-3 text-[#ccff00]" />
                          <span>{selectedSubfolder || 'Clips 2027'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      ) : (
        /* ===================================================================== */
        /* TAB 3: PHOTOGRAPHS // HIGH-RESOLUTION PHOTO VAULT                     */
        /* ===================================================================== */
        <main
          key="photos-hub"
          aria-label="Photographs Hub"
          className={`flex-1 w-full min-h-0 overflow-y-auto space-scrollbar p-5 sm:p-8 lg:p-12 z-10 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isModalOpen ? 'scale-[0.985] brightness-[0.7] blur-[1px]' : 'scale-100 brightness-100 blur-0'
          } ${activeTransitionClass}`}
        >
          {/* Header Bar for Catalog Subfolder */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 mb-6 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3 shrink-0">
              <Folder className="w-5 h-5 text-[#ccff00]" />
              <div>
                <h1 className="text-base sm:text-lg font-serif font-bold tracking-widest text-[#f4f4f5] uppercase">
                  {selectedSubfolder || 'Images 2027'}
                </h1>
                <p className="text-[10px] sm:text-[11px] tracking-wide text-neutral-400">
                  Archived Photo Collection • {activeMediaList.length} Items Indexed
                </p>
              </div>
            </div>
            <div className="flex items-center md:justify-end gap-1.5 overflow-x-auto no-scrollbar max-w-full md:max-w-[70%] shrink-0">
              {renderCategorySubfolderBar('PHOTOGRAPHY', true)}
            </div>
          </div>

          {activeMediaList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center my-auto min-h-[40vh] border border-white/5 rounded-2xl bg-[#08080a]">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4 pb-20">
              {activeMediaList.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => handleOpenItem(item, idx)}
                  className="group relative rounded-xl overflow-hidden bg-[#0d0d10] border border-white/[0.08] hover:border-[#ccff00] cursor-pointer aspect-[3/4] transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <img
                    src={item.thumbnail || item.url}
                    alt={item.title || item.name}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-0 inset-x-0 p-3">
                    <p className="text-xs font-bold text-white line-clamp-1">{item.title || item.name}</p>
                    <span className="text-[10px] font-mono text-neutral-400">{selectedSubfolder || 'Photographs'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}
    </div>
  );
};

export default MonolithBarGate;
