import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { StageMediaItem } from '../../types';
import { MIDNIGHT_OBSIDIAN_THEME } from './themeManager';
import { CinematicBackdropCanvas } from './CinematicBackdropCanvas';
import { MAJOR_FOLDERS } from '../navigation/SidebarAccordionNav';
import { isPhotoExtension } from '../../utils/mediaTypeDetector';
import { sortMediaItemsDescending } from '../../utils/albumExtractor';
import { type DirectoryNode } from '../DeepSpaceTreeExplorer';
import { useBackButton } from '../../utils/backButtonManager';
import { VaultDrawer } from '../VaultDrawer';
import { hapticMedium } from '../../utils/hapticsManager';
import { trackActivityEvent, getRolling7DayDisplayData } from '../../utils/usageTelemetry';
import {
  parseIdRoute,
  parseAppPathname,
  updateBrowserUrl,
  findMediaByShortId,
} from '../../utils/urlRouter';
import { MediaNotFoundDialog } from '../common/MediaNotFoundDialog';
import { LivingMediaCard } from './LivingMediaCard';
import { QuickSearchModal } from '../QuickSearchModal';
import { LaserSparkLogo } from '../brand/LaserSparkLogo';
import { LogoDropUpNav, type MainDirectoryTab } from '../navigation/LogoDropUpNav';
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

  // 1. Bandhobi: Completely independent 4th main directory (never mixed with other collections)
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

  // 2. Photographs
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

  // 3. Shorts
  if (/^(?:reels\/shorts|shorts|reels)$/i.test(root) || item.mediaType === 'short' || clean.toLowerCase().includes('/shorts/')) {
    root = 'Shorts';
    let subName = sub.length > 0 ? sub[0] : '';
    if (/2027/i.test(subName)) subName = '2027';
    else subName = 'Older';
    return { root, subfolders: [subName] };
  }

  // 4. Video Clips
  root = 'Video Clips';
  let subName = sub.length > 0 ? sub[0] : '';
  if (/fav/i.test(subName)) subName = 'Favorite';
  else if (/2027/i.test(subName)) subName = '2027';
  else if (/2026/i.test(subName)) subName = '2026';
  else if (/2025/i.test(subName)) subName = '2025';
  else subName = 'Older';

  return { root, subfolders: [subName] };
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

  // 5 Panoramic Slides: 0: Home (Living Wall), 1: Photographs, 2: Shorts, 3: Video Clips, 4: Bandhobi
  const [tabIndex, setTabIndex] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const parsed = parseAppPathname();
    if (parsed.tab === 'PHOTOGRAPHY') return 1;
    if (parsed.tab === 'SHORTS') return 2;
    if (parsed.tab === 'CLIPS') return 3;
    if (parsed.tab === 'BANDHOBI') return 4;
    return 0; // Default Home living wall
  });

  const [_activeVideoId, setActiveVideoId] = useState<string | null>(initialRoute.videoId);

  // Active Main Directory Tab inside Logo Drop-Up Nav (initialized from route)
  const [activeMainTab, setActiveMainTab] = useState<MainDirectoryTab>(() => {
    if (typeof window === 'undefined') return 'Photographs';
    const parsed = parseAppPathname();
    if (parsed.tab === 'BANDHOBI') return 'Bandhobi';
    if (parsed.tab === 'SHORTS') return 'Shorts';
    if (parsed.tab === 'CLIPS') return 'Video Clips';
    return 'Photographs';
  });

  // Logo Drop-Up Navigation Menu Open State (shown by default, toggles on logo click)
  const [isNavTrayOpen, setIsNavTrayOpen] = useState(true);

  // Screen Aspect Ratio Detector:
  // - Portrait screens (mobile phone): scroll strictly up-down
  // - Wide screen devices (desktop, tablet, mobile landscape): scroll strictly left-right, not up-down
  const [isWideScreen, setIsWideScreen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth > window.innerHeight;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsWideScreen(window.innerWidth > window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Scroll detector:
  // On wide screen devices:
  //   Scrolling rightwards (content moves right-to-left) -> dock disappears
  //   Scrolling leftwards (content moves left-to-right) -> dock appears
  // On portrait:
  //   Scrolling downwards -> dock disappears
  //   Scrolling upwards -> dock appears
  useEffect(() => {
    let lastWheelTime = 0;
    const handleGlobalWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now - lastWheelTime < 60) return;
      lastWheelTime = now;

      if (isWideScreen) {
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (delta > 8) {
          setIsNavTrayOpen(false);
        } else if (delta < -8) {
          setIsNavTrayOpen(true);
        }
      } else {
        if (e.deltaY > 8) {
          setIsNavTrayOpen(false);
        } else if (e.deltaY < -8) {
          setIsNavTrayOpen(true);
        }
      }
    };

    let startX = 0;
    let startY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const curX = e.touches[0].clientX;
      const curY = e.touches[0].clientY;
      const diffX = startX - curX; // positive when swiping left (scrolling rightwards)
      const diffY = startY - curY; // positive when swiping up (scrolling downwards)

      if (isWideScreen && Math.abs(diffX) > 20) {
        if (diffX > 20) {
          setIsNavTrayOpen(false);
        } else if (diffX < -20) {
          setIsNavTrayOpen(true);
        }
        startX = curX;
      } else if (!isWideScreen) {
        // Portrait mobile screen:
        // Swiping left-to-right (curX > startX -> diffX < -30): SHOW DOCK!
        if (diffX < -30 && Math.abs(diffX) > Math.abs(diffY)) {
          setIsNavTrayOpen(true);
          startX = curX;
        } else if (diffX > 30 && Math.abs(diffX) > Math.abs(diffY)) {
          // Swiping right-to-left: HIDE DOCK
          setIsNavTrayOpen(false);
          startX = curX;
        } else if (Math.abs(diffY) > 25) {
          // Vertical scroll: down hides dock, up reveals dock
          if (diffY > 25) {
            setIsNavTrayOpen(false);
          } else if (diffY < -25) {
            setIsNavTrayOpen(true);
          }
          startY = curY;
        }
      }
    };

    window.addEventListener('wheel', handleGlobalWheel, { passive: true, capture: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true, capture: true });

    return () => {
      window.removeEventListener('wheel', handleGlobalWheel, { capture: true });
      window.removeEventListener('touchstart', handleTouchStart, { capture: true });
      window.removeEventListener('touchmove', handleTouchMove, { capture: true });
    };
  }, [isWideScreen]);

  // Individual section subfolder filters (ordered per strict specs)
  const [photosSubfolder, setPhotosSubfolder] = useState<string>('Favorite');
  const [shortsSubfolder, setShortsSubfolder] = useState<string>('2027');
  const [clipsSubfolder, setClipsSubfolder] = useState<string>('Favorite');
  const [bandhobiSubfolder, setBandhobiSubfolder] = useState<string>('Photographs');

  // Progressive batch visibility for each section
  const [visiblePhotos, setVisiblePhotos] = useState<number>(24);
  const [visibleShorts, setVisibleShorts] = useState<number>(24);
  const [visibleClips, setVisibleClips] = useState<number>(16);
  const [visibleBandhobi, setVisibleBandhobi] = useState<number>(24);

  // Dropdown open states for the tabs: null
  const [activeDropdown, setActiveDropdown] = useState<'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY' | null>(null);

  // Keep screen on state
  const [keepAwakeOn, setKeepAwakeOn] = useState(() => getKeepScreenOnState());

  const handleHorizontalWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (isWideScreen) {
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (delta !== 0) {
          if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) && e.deltaY !== 0) {
            e.currentTarget.scrollLeft += e.deltaY;
          }
          if (delta > 8) {
            setIsNavTrayOpen(false);
          } else if (delta < -8) {
            setIsNavTrayOpen(true);
          }
        }
      }
    },
    [isWideScreen]
  );


  // 404 Media / Route Not Found Dialog State
  const [notFoundInfo, setNotFoundInfo] = useState<{
    isOpen: boolean;
    path: string;
    tab?: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY' | 'BANDHOBI' | 'TRAILER';
  }>({
    isOpen: false,
    path: '',
    tab: 'TRAILER',
  });

  // Direct Short ID or Invalid URL validation on initial load
  const hasAutoLaunchedRef = useRef(false);
  useEffect(() => {
    if (hasAutoLaunchedRef.current || !items || items.length === 0) return;

    const parsed = parseAppPathname();

    // 1. If path is an unrecognized root path (e.g. /unknown-page) -> Show 404 error screen
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
          item.type === 'image' || isPhotoExtension(item.path || item.url || item.name || '');
        const isShort =
          item.mediaType === 'short' ||
          item.path?.toLowerCase().includes('short') ||
          item.url?.toLowerCase().includes('short');

        if (isPhoto) {
          setTabIndex(1);
          onOpenPhoto(item, [item], 0);
        } else if (isShort) {
          setTabIndex(2);
          onOpenShort(item, [item], 0);
        } else {
          setTabIndex(3);
          onOpenVideo(item, [item]);
        }
      } else {
        // Short ID not found in library -> Show 404 error screen
        setNotFoundInfo({ isOpen: true, path: '/' + parsed.rawPath, tab: parsed.tab });
      }
    }
  }, [items, onOpenPhoto, onOpenShort, onOpenVideo]);

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
        setIsNavTrayOpen(false);
      } else if (e.key === 'ArrowRight' && !isModalOpen && !isNavTrayOpen) {
        setTabIndex((prev) => Math.min(4, prev + 1));
      } else if (e.key === 'ArrowLeft' && !isModalOpen && !isNavTrayOpen) {
        setTabIndex((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isNavTrayOpen]);

  // Synchronize state when browser Back / Forward (popstate) is clicked
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseAppPathname();
      if (parsed.isNotFound) {
        setNotFoundInfo({ isOpen: true, path: '/' + parsed.rawPath, tab: parsed.tab });
        return;
      }
      if (parsed.tab === 'PHOTOGRAPHY') setTabIndex(1);
      else if (parsed.tab === 'SHORTS') setTabIndex(2);
      else if (parsed.tab === 'CLIPS') setTabIndex(3);
      else if (parsed.tab === 'BANDHOBI') setTabIndex(4);
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
      idx === 1 ? '/photographs'
      : idx === 2 ? '/shorts'
      : idx === 3 ? '/clips'
      : idx === 4 ? '/bandhobi'
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

    ensureSubfolders('Photographs', ['Favorite', '2027', '2026', '2025', 'Older']);
    ensureSubfolders('Shorts', ['2027', 'Older']);
    ensureSubfolders('Video Clips', ['Favorite', '2027', '2026', '2025', 'Older']);
    ensureSubfolders('Bandhobi', ['Photographs', 'Shorts', 'Video Clips']);

    for (const rootNode of map.values()) {
      rootNode.files = sortMediaItemsDescending(rootNode.files);
      for (const sub of rootNode.subfolders.values()) {
        sub.files = sortMediaItemsDescending(sub.files);
      }
    }

    return map;
  }, [items]);

  // Deep collections for each section
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

  const allBandhobiFiles = useMemo(() => {
    const node = rootMap.get('Bandhobi');
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

  // Filtered active media lists (ordered per specs)
  const activePhotosList = useMemo(() => {
    if (photosSubfolder === 'ALL') return allPhotosFiles;
    const node = rootMap.get('Photographs')?.subfolders.get(photosSubfolder);
    return node && node.files.length > 0 ? node.files : allPhotosFiles;
  }, [allPhotosFiles, rootMap, photosSubfolder]);

  const activeShortsList = useMemo(() => {
    if (shortsSubfolder === 'ALL') return allShortsFiles;
    const node = rootMap.get('Shorts')?.subfolders.get(shortsSubfolder);
    return node && node.files.length > 0 ? node.files : allShortsFiles;
  }, [allShortsFiles, rootMap, shortsSubfolder]);

  const activeClipsList = useMemo(() => {
    if (clipsSubfolder === 'ALL') return allClipsFiles;
    const node = rootMap.get('Video Clips')?.subfolders.get(clipsSubfolder);
    return node && node.files.length > 0 ? node.files : allClipsFiles;
  }, [allClipsFiles, rootMap, clipsSubfolder]);

  const activeBandhobiList = useMemo(() => {
    if (bandhobiSubfolder === 'ALL') return allBandhobiFiles;
    const node = rootMap.get('Bandhobi')?.subfolders.get(bandhobiSubfolder);
    return node && node.files.length > 0 ? node.files : allBandhobiFiles;
  }, [allBandhobiFiles, rootMap, bandhobiSubfolder]);

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

      if (tabIndex === 4) {
        if (isPhoto) {
          onOpenPhoto(item, activeBandhobiList, index);
        } else if (isShort) {
          onOpenShort(item, activeBandhobiList, index, getItemSubfolderLabel(item));
        } else {
          onOpenVideo(item, activeBandhobiList);
        }
        return;
      }

      if (isPhoto) {
        onOpenPhoto(item, activePhotosList, index);
      } else if (isShort) {
        onOpenShort(item, activeShortsList, index, getItemSubfolderLabel(item));
      } else {
        onOpenVideo(item, activeClipsList);
      }
    },
    [tabIndex, activeBandhobiList, activePhotosList, activeShortsList, activeClipsList, getItemSubfolderLabel, onOpenPhoto, onOpenShort, onOpenVideo]
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

  // Back button closes active modal/drawer/dropdown/nav-tray or returns home
  useBackButton(
    useCallback(() => {
      if (isNavTrayOpen) {
        setIsNavTrayOpen(false);
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
    }, [isNavTrayOpen, isSearchOpen, activeDropdown, isVaultDrawerOpen, tabIndex, switchTab]),
    Boolean(isNavTrayOpen || isSearchOpen || activeDropdown || isVaultDrawerOpen || tabIndex !== 0)
  );

  // 7-day rolling session telemetry metrics (zero suppression: days with 0 data are excluded)
  const telemetry7DayData = useMemo(() => {
    return getRolling7DayDisplayData();
  }, [isNavTrayOpen]);

  // Infinite scroll handlers for each media tab (automatic progressive loading)
  const handleShortsScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isNearEnd = isWideScreen
      ? target.scrollWidth - target.scrollLeft - target.clientWidth < 800
      : target.scrollHeight - target.scrollTop - target.clientHeight < 600;

    if (isNearEnd) {
      setVisibleShorts((prev) => {
        if (prev < activeShortsList.length) {
          return Math.min(prev + 18, activeShortsList.length);
        }
        return prev;
      });
    }
  }, [activeShortsList.length, isWideScreen]);

  const handleClipsScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isNearEnd = isWideScreen
      ? target.scrollWidth - target.scrollLeft - target.clientWidth < 800
      : target.scrollHeight - target.scrollTop - target.clientHeight < 600;

    if (isNearEnd) {
      setVisibleClips((prev) => {
        if (prev < activeClipsList.length) {
          return Math.min(prev + 12, activeClipsList.length);
        }
        return prev;
      });
    }
  }, [activeClipsList.length, isWideScreen]);

  const handlePhotosScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isNearEnd = isWideScreen
      ? target.scrollWidth - target.scrollLeft - target.clientWidth < 800
      : target.scrollHeight - target.scrollTop - target.clientHeight < 600;

    if (isNearEnd) {
      setVisiblePhotos((prev) => {
        if (prev < activePhotosList.length) {
          return Math.min(prev + 16, activePhotosList.length);
        }
        return prev;
      });
    }
  }, [activePhotosList.length, isWideScreen]);

  const handleBandhobiScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isNearEnd = isWideScreen
      ? target.scrollWidth - target.scrollLeft - target.clientWidth < 800
      : target.scrollHeight - target.scrollTop - target.clientHeight < 600;

    if (isNearEnd) {
      setVisibleBandhobi((prev) => {
        if (prev < activeBandhobiList.length) {
          return Math.min(prev + 16, activeBandhobiList.length);
        }
        return prev;
      });
    }
  }, [activeBandhobiList.length, isWideScreen]);

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

  useEffect(() => {
    setVisibleBandhobi(24);
  }, [bandhobiSubfolder]);

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
          if (folderId === 'photography') {
            if (subfolderName) setPhotosSubfolder(subfolderName);
            switchTab(1);
          } else if (folderId === 'shorts') {
            if (subfolderName) setShortsSubfolder(subfolderName);
            switchTab(2);
          } else if (folderId === 'clips') {
            if (subfolderName) setClipsSubfolder(subfolderName);
            switchTab(3);
          } else if (folderId === 'realtube') {
            if (subfolderName) setBandhobiSubfolder(subfolderName);
            switchTab(4);
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
          if (tab === 'PHOTOGRAPHY') switchTab(1);
          else if (tab === 'SHORTS') switchTab(2);
          else if (tab === 'CLIPS') switchTab(3);
          else if (tab === 'BANDHOBI') switchTab(4);
          else switchTab(0);
        }}
      />

      {/* 1. TOP ACID LIME KINETIC MARQUEE TICKER (ROBOTO FLEX FONT) */}
      <div
        className="w-full h-[28px] overflow-hidden bg-[#ccff00] text-black font-black text-[11px] uppercase tracking-widest select-none shrink-0 z-50 shadow-md flex items-center"
        style={{ fontFamily: "'Roboto Flex', sans-serif" }}
      >
        <div className="animate-marquee whitespace-nowrap flex gap-8 items-center" style={{ fontFamily: "'Roboto Flex', sans-serif" }}>
          <span className="bg-black text-[#ccff00] px-2 py-0.5 rounded-none text-[9px] font-bold tracking-wider" style={{ fontFamily: "'Roboto Flex', sans-serif" }}>INDEX NOTICE</span>
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
          <span className="bg-black text-[#ccff00] px-2 py-0.5 rounded-none text-[9px] font-bold tracking-wider" style={{ fontFamily: "'Roboto Flex', sans-serif" }}>INDEX NOTICE</span>
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

      {/* 2. BOTTOM-LEFT CORNER: WEBSITE LOGO (Slides left outside when dock opens, slides back in from left when dock closes) */}
      <div
        className={`fixed bottom-4 sm:bottom-6 left-4 sm:left-6 z-40 select-none transition-all duration-300 ease-out ${
          !isNavTrayOpen
            ? 'translate-x-0 opacity-100 pointer-events-auto'
            : '-translate-x-[180%] opacity-0 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            hapticMedium();
            setIsNavTrayOpen(true);
          }}
          className="inline-flex items-center cursor-pointer transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none bg-transparent border-0 p-0"
          title="Open Directory Navigation Menu"
        >
          <LaserSparkLogo
            width={270}
            height={38}
            interactive={false}
          />
        </button>
      </div>

      {/* 3. MIDDLE-LEFT: UNIFIED TALL NAVIGATION DOCK (Shown ONLY when dock is open) */}
      <LogoDropUpNav
        isOpen={isNavTrayOpen}
        onClose={() => setIsNavTrayOpen(false)}
        onToggleOpen={() => setIsNavTrayOpen((prev) => !prev)}
        activeMainTab={activeMainTab}
        onSelectMainTab={(tab) => {
          setActiveMainTab(tab);
          // DO NOT switch tab or show media cards when clicking major tab!
        }}
        activeSubfolder={
          activeMainTab === 'Photographs'
            ? photosSubfolder
            : activeMainTab === 'Shorts'
            ? shortsSubfolder
            : activeMainTab === 'Video Clips'
            ? clipsSubfolder
            : bandhobiSubfolder
        }
        onSelectSubfolder={(tab, subfolder) => {
          setActiveMainTab(tab);
          // ONLY clicking a subfolder switches the page and shows media cards
          if (tab === 'Photographs') {
            setPhotosSubfolder(subfolder);
            switchTab(1);
          } else if (tab === 'Shorts') {
            setShortsSubfolder(subfolder);
            switchTab(2);
          } else if (tab === 'Video Clips') {
            setClipsSubfolder(subfolder);
            switchTab(3);
          } else if (tab === 'Bandhobi') {
            setBandhobiSubfolder(subfolder);
            switchTab(4);
          }
        }}
        onSelectHome={() => switchTab(0)}
        telemetryData={telemetry7DayData}
        keepAwakeOn={keepAwakeOn}
        onToggleKeepAwake={toggleKeepScreenOn}
        onOpenSearch={() => setIsSearchOpen(true)}
      />

      {/* 3. 5-PANEL HORIZONTAL PANORAMIC SLIDING VIEWPORT */}
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
          {/* PANEL 1: PHOTOGRAPHS TAB PAGE                                     */}
          {/* Widescreen: 2-Row Horizontal Strip (Fits screen height, tight gap) */}
          {/* Portrait: Vertical Up-Down Grid                                   */}
          {/* ================================================================= */}
          <section className="panoramic-panel">
            <div
              onScroll={handlePhotosScroll}
              onWheel={handleHorizontalWheel}
              className={`w-full h-full space-scrollbar p-0 m-0 ${
                isWideScreen
                  ? 'overflow-x-auto overflow-y-hidden flex items-center px-4 sm:px-6'
                  : 'overflow-y-auto overflow-x-hidden pb-28'
              }`}
            >
              <div
                className={
                  isWideScreen
                    ? 'grid grid-rows-2 grid-flow-col auto-cols-max gap-3 h-[calc(100dvh-44px)] py-1.5 shrink-0'
                    : 'grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 max-w-[1200px] mx-auto'
                }
              >
                {activePhotosList.slice(0, visiblePhotos).map((item, idx) => (
                  <div
                    key={item.id || item.url || idx}
                    className={isWideScreen ? 'h-full aspect-[3/4] shrink-0' : 'w-full'}
                  >
                    <LivingMediaCard
                      item={item}
                      aspectRatio="3/4"
                      delayIdx={idx}
                      onClick={() => handleOpenItem(item, idx)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ================================================================= */}
          {/* PANEL 2: SHORTS TAB PAGE                                          */}
          {/* Widescreen: 2-Row Horizontal Strip (Fits screen height, tight gap) */}
          {/* Portrait: Vertical Up-Down Grid                                   */}
          {/* ================================================================= */}
          <section className="panoramic-panel">
            <div
              onScroll={handleShortsScroll}
              onWheel={handleHorizontalWheel}
              className={`w-full h-full space-scrollbar p-0 m-0 ${
                isWideScreen
                  ? 'overflow-x-auto overflow-y-hidden flex items-center px-4 sm:px-6'
                  : 'overflow-y-auto overflow-x-hidden pb-28'
              }`}
            >
              <div
                className={
                  isWideScreen
                    ? 'grid grid-rows-2 grid-flow-col auto-cols-max gap-3 h-[calc(100dvh-44px)] py-1.5 shrink-0'
                    : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-3 max-w-[1400px] mx-auto'
                }
              >
                {activeShortsList.slice(0, visibleShorts).map((item, idx) => (
                  <div
                    key={item.id || item.url || idx}
                    className={isWideScreen ? 'h-full aspect-[9/16] shrink-0' : 'w-full'}
                  >
                    <LivingMediaCard
                      item={item}
                      aspectRatio="9/16"
                      delayIdx={idx}
                      onClick={() => handleOpenItem(item, idx)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ================================================================= */}
          {/* PANEL 3: VIDEO CLIPS TAB PAGE                                     */}
          {/* Widescreen: Cinema-scale Large Horizontal Cards                   */}
          {/* Portrait: 1-Column Full-width Large Cards                         */}
          {/* ================================================================= */}
          <section className="panoramic-panel">
            <div
              onScroll={handleClipsScroll}
              onWheel={handleHorizontalWheel}
              className={`w-full h-full space-scrollbar p-0 m-0 ${
                isWideScreen
                  ? 'overflow-x-auto overflow-y-hidden flex items-center px-4 sm:px-8'
                  : 'overflow-y-auto overflow-x-hidden pb-28'
              }`}
            >
              <div
                className={
                  isWideScreen
                    ? 'grid grid-rows-2 grid-flow-col auto-cols-max gap-3 h-[calc(100dvh-44px)] py-1.5 shrink-0'
                    : 'grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 max-w-[1200px] mx-auto'
                }
              >
                {activeClipsList.slice(0, visibleClips).map((item, idx) => (
                  <div
                    key={item.id || item.url || idx}
                    className={isWideScreen ? 'h-full aspect-video shrink-0' : 'w-full'}
                  >
                    <LivingMediaCard
                      item={item}
                      aspectRatio="16/9"
                      delayIdx={idx}
                      onClick={() => handleOpenItem(item, idx)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ================================================================= */}
          {/* PANEL 4: BANDHOBI TAB PAGE                                        */}
          {/* Widescreen: 2-Row or Grand Single Row (Tight gaps, proper height) */}
          {/* Portrait: Vertical Up-Down Grid                                   */}
          {/* ================================================================= */}
          <section className="panoramic-panel">
            <div
              onScroll={handleBandhobiScroll}
              onWheel={handleHorizontalWheel}
              className={`w-full h-full space-scrollbar p-0 m-0 ${
                isWideScreen
                  ? 'overflow-x-auto overflow-y-hidden flex items-center px-4 sm:px-6'
                  : 'overflow-y-auto overflow-x-hidden pb-28'
              }`}
            >
              <div
                className={
                  isWideScreen
                    ? 'grid grid-rows-2 grid-flow-col auto-cols-max gap-3 h-[calc(100dvh-44px)] py-1.5 shrink-0'
                    : `grid gap-3 p-3 max-w-[1400px] mx-auto ${
                        bandhobiSubfolder === 'Video Clips'
                          ? 'grid-cols-1 sm:grid-cols-2'
                          : 'grid-cols-2 sm:grid-cols-3'
                      }`
                }
              >
                {activeBandhobiList.slice(0, visibleBandhobi).map((item, idx) => {
                  const aspect =
                    bandhobiSubfolder === 'Shorts'
                      ? '9/16'
                      : bandhobiSubfolder === 'Video Clips'
                      ? '16/9'
                      : '3/4';
                  const aspectClass =
                    aspect === '9/16'
                      ? 'aspect-[9/16]'
                      : aspect === '16/9'
                      ? 'aspect-video'
                      : 'aspect-[3/4]';
                  return (
                    <div
                      key={item.id || item.url || idx}
                      className={isWideScreen ? `h-full ${aspectClass} shrink-0` : 'w-full'}
                    >
                      <LivingMediaCard
                        item={item}
                        aspectRatio={aspect}
                        delayIdx={idx}
                        onClick={() => handleOpenItem(item, idx)}
                      />
                    </div>
                  );
                })}
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
