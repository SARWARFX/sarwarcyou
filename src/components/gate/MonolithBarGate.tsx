import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Play, ArrowLeft, Maximize2, CheckCircle2 } from 'lucide-react';
import type { StageMediaItem } from '../../types';
import { MIDNIGHT_OBSIDIAN_THEME } from './themeManager';
import { CinematicBackdropCanvas } from './CinematicBackdropCanvas';
import { SmartThumbnail } from '../common/SmartThumbnail';
import { SidebarAccordionNav, MAJOR_FOLDERS } from '../navigation/SidebarAccordionNav';
import { SessionTelemetryGraph } from '../telemetry/SessionTelemetryGraph';
import { isPhotoExtension } from '../../utils/mediaTypeDetector';
import { getMediaUrl, getThumbnailUrl, getImageUrl } from '../../utils/imageUrlResolver';
import { resolveStaticVideoThumbnail } from '../../utils/thumbnailResolver';
import { sortMediaItemsDescending } from '../../utils/albumExtractor';
import { sortSubfolderNodesDescending, type DirectoryNode } from '../DeepSpaceTreeExplorer';
import { useBackButton } from '../../utils/backButtonManager';
import { SyncStatusIndicator } from '../SyncStatusIndicator';
import { Capacitor } from '@capacitor/core';
import { AvailableOfflineBadge } from '../common/AvailableOfflineBadge';
import { isMediaAvailableOffline } from '../../services/videoOfflineManager';

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
  } else {
    if (item.mediaType === 'short' || item.category?.toLowerCase().includes('short') || item.url?.toLowerCase().includes('short')) {
      root = 'Shorts';
      sub = dirParts.length > 0 ? dirParts : ['Shorts Classic'];
    } else if (item.type === 'image' || isPhotoExtension(item.url || item.name)) {
      root = 'Images';
      sub = dirParts.length > 0 ? dirParts : ['Images 2027'];
    } else {
      root = 'Clips';
      sub = dirParts.length > 0 ? dirParts : ['Favorite'];
    }
  }

  if (sub.length === 0) {
    if (root === 'Shorts') sub = ['Shorts Classic'];
    else if (root === 'REALTube') sub = ['REALTube Shorts'];
    else if (root === 'Images') sub = ['Images 2027'];
    else sub = ['Favorite'];
  }

  return { root, subfolders: sub };
}

export const MonolithBarGate: React.FC<MonolithBarGateProps> = ({
  items,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
  onOpenSearch: _onOpenSearch,
  initialAlbum,
  isModalOpen = false,
}) => {
  // Navigation states: default to Idle Home Overview (null)
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [selectedSubfolder, setSelectedSubfolder] = useState<string | null>(null);
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [activeMobilePane, setActiveMobilePane] = useState<0 | 1>(0);

  // Outer horizontal track ref for mobile horizontal snap & swipe-back
  const outerTrackRef = useRef<HTMLDivElement>(null);

  // Touch tracking for instant left-to-right swipe back on mobile
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;

    // Swiping left-to-right on Screen 2: positive deltaX (finger moved right)
    // Only trigger horizontal swipe transitions if Math.abs(deltaX) > 15px
    if (deltaX > 15 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
      if (outerTrackRef.current) {
        outerTrackRef.current.scrollTo({
          left: 0,
          behavior: 'smooth',
        });
        setActiveMobilePane(0);
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const handleToggleFolder = useCallback((folderKey: string) => {
    setOpenFolder((prev) => (prev === folderKey ? null : folderKey));
  }, []);

  const handleMobileTrackScroll = () => {
    if (outerTrackRef.current) {
      const scrollLeft = outerTrackRef.current.scrollLeft;
      const clientWidth = outerTrackRef.current.clientWidth;
      const pane = scrollLeft > clientWidth * 0.4 ? 1 : 0;
      setActiveMobilePane((prev) => (prev !== pane ? pane : prev));
    }
  };

  // Android Native Hardware Back Button handler
  useBackButton(
    useCallback(() => {
      // 1. If viewing Mobile Screen 2 (media gallery), return to Screen 1 (Folders)
      if (activeMobilePane === 1) {
        if (outerTrackRef.current) {
          outerTrackRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        }
        setActiveMobilePane(0);
        return true;
      }

      // 2. If a subfolder is selected on desktop, return to home
      if (selectedSubfolder !== null) {
        setSelectedSubfolder(null);
        return true;
      }

      // 3. If an accordion folder is expanded, collapse it
      if (openFolder !== null) {
        setOpenFolder(null);
        return true;
      }

      // Otherwise let parent / exit toast handle it
      return false;
    }, [activeMobilePane, selectedSubfolder, openFolder]),
    !isModalOpen
  );

  // Build directory tree
  const rootMap = useMemo(() => {
    const map = new Map<string, DirectoryNode>();

    for (const item of items) {
      const { root, subfolders } = getFolderSegments(item);
      if (!map.has(root)) {
        map.set(root, {
          name: root,
          fullPath: root,
          subfolders: new Map(),
          files: [],
        });
      }

      let currentNode = map.get(root)!;
      let currentMap = currentNode.subfolders;

      for (const seg of subfolders) {
        if (!currentMap.has(seg)) {
          currentMap.set(seg, {
            name: seg,
            fullPath: `${currentNode.fullPath}/${seg}`,
            subfolders: new Map(),
            files: [],
          });
        }
        currentNode = currentMap.get(seg)!;
        currentMap = currentNode.subfolders;
      }

      currentNode.files.push(item);
    }

    for (const node of map.values()) {
      const sortRecursive = (n: DirectoryNode) => {
        n.files = sortMediaItemsDescending(n.files);
        for (const sub of n.subfolders.values()) {
          sortRecursive(sub);
        }
      };
      sortRecursive(node);
    }

    return map;
  }, [items]);

  // URL deep link auto-open if specific album was requested via URL query
  useEffect(() => {
    if (items.length === 0 || !initialAlbum) return;
    const cleanTarget = initialAlbum.toLowerCase().replace(/[-_\s]+/g, '');

    for (const folder of MAJOR_FOLDERS) {
      const rootNode = rootMap.get(folder.rawName);
      if (!rootNode) continue;

      if (folder.rawName.toLowerCase().replace(/[-_\s]+/g, '') === cleanTarget) {
        const sortedSubs = sortSubfolderNodesDescending(Array.from(rootNode.subfolders.values()));
        setSelectedAlbum(folder.key);
        setSelectedSubfolder(sortedSubs[0]?.name || null);
        return;
      }

      for (const sub of rootNode.subfolders.values()) {
        if (sub.name.toLowerCase().replace(/[-_\s]+/g, '') === cleanTarget) {
          setSelectedAlbum(folder.key);
          setSelectedSubfolder(sub.name);
          return;
        }
      }
    }
  }, [initialAlbum, items.length, rootMap]);

  // Active directory node for the selected subfolder
  const activeDirectoryNode = useMemo(() => {
    if (!selectedAlbum || !selectedSubfolder) return null;
    const activeAlbumConfig = MAJOR_FOLDERS.find((h) => h.key === selectedAlbum);
    if (!activeAlbumConfig) return null;
    const rootNode = rootMap.get(activeAlbumConfig.rawName);
    if (!rootNode) return null;
    return rootNode.subfolders.get(selectedSubfolder) || null;
  }, [selectedAlbum, selectedSubfolder, rootMap]);

  // Aggregated Cross-Directory Latest Uploads (for Idle Stage)
  const latestUploads = useMemo(() => {
    const clipsNode = rootMap.get('Clips');
    const shortsNode = rootMap.get('Shorts');
    const photoNode = rootMap.get('Images');
    const realTubeNode = rootMap.get('REALTube');

    const getAllFiles = (node?: DirectoryNode): StageMediaItem[] => {
      if (!node) return [];
      let list: StageMediaItem[] = [...node.files];
      for (const sub of node.subfolders.values()) {
        list = list.concat(getAllFiles(sub));
      }
      return list;
    };

    const clipFiles = getAllFiles(clipsNode);
    const shortFiles = getAllFiles(shortsNode);
    const photoFiles = getAllFiles(photoNode);
    const realTubeFiles = getAllFiles(realTubeNode);

    const recentClips = clipFiles.slice(0, 8);
    const recentShorts = shortFiles.slice(0, 8);
    const recentPhotos = photoFiles.slice(0, 8);
    const recentRealTube = realTubeFiles.slice(0, 4);

    // Interleave to balance media types across directories
    const combined: StageMediaItem[] = [];
    const maxLen = Math.max(
      recentClips.length,
      recentShorts.length,
      recentPhotos.length,
      recentRealTube.length
    );

    for (let i = 0; i < maxLen; i++) {
      if (recentPhotos[i]) combined.push(recentPhotos[i]);
      if (recentClips[i]) combined.push(recentClips[i]);
      if (recentShorts[i]) combined.push(recentShorts[i]);
      if (recentRealTube[i]) combined.push(recentRealTube[i]);
    }

    return combined.slice(0, 24);
  }, [rootMap]);

  // Offline items pool (App only)
  const offlineItems = useMemo(() => {
    if (!Capacitor.isNativePlatform() || !items) return [];
    return items.filter((it) => isMediaAvailableOffline(it));
  }, [items]);

  // Active media assets list: loads selected subfolder files, or offline items, or latest uploads when idle
  const activeMediaList = useMemo(() => {
    if (selectedAlbum === 'OFFLINE') {
      return offlineItems;
    }
    if (selectedSubfolder && activeDirectoryNode) {
      return activeDirectoryNode.files;
    }
    return latestUploads;
  }, [selectedAlbum, offlineItems, selectedSubfolder, activeDirectoryNode, latestUploads]);

  // 4 Curated Full-Stage Showcase Tiles for Desktop Home Stage
  const curatedShowcaseTiles = useMemo(() => {
    if (!items || items.length === 0) return [];

    const getLocalViews = (): Record<string, { today?: number; yesterday?: number; total?: number }> => {
      try {
        const raw = localStorage.getItem('sarwar_media_views_stats_v1');
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    };

    const viewsMap = getLocalViews();
    const pool = items.filter(
      (it) => it.url || it.path || (it as any).src || (it as any).thumbnail
    );
    if (pool.length === 0) return [];

    const usedIds = new Set<string>();

    // 1. LATEST UPLOAD: Most recently added item across the dataset
    const latestSorted = [...pool].sort((a, b) => {
      const dateA = a.date || (a.lastCommit?.date ? new Date(a.lastCommit.date).getTime() : 0);
      const dateB = b.date || (b.lastCommit?.date ? new Date(b.lastCommit.date).getTime() : 0);
      return dateB - dateA;
    });

    const card1Item = latestSorted[0] || pool[0];
    usedIds.add(card1Item.id || card1Item.url);

    // 2. MOST VIEWED TODAY: Highest view count within the current 24h window
    const todayPool = pool.filter((it) => !usedIds.has(it.id || it.url));
    const sortedToday = [...todayPool].sort((a, b) => {
      const vA = viewsMap[a.id || a.url]?.today ?? (a.id ? (a.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 80) + 45 : 50);
      const vB = viewsMap[b.id || b.url]?.today ?? (b.id ? (b.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 80) + 45 : 50);
      return vB - vA;
    });
    const card2Item = sortedToday[0] || todayPool[0] || pool[1 % pool.length];
    usedIds.add(card2Item.id || card2Item.url);
    const card2Views = viewsMap[card2Item.id || card2Item.url]?.today ?? ((card2Item.id ? card2Item.id.charCodeAt(0) * 3 : 84) % 95 + 32);

    // 3. MOST VIEWED YESTERDAY: Highest view count during the previous day
    const yesterdayPool = pool.filter((it) => !usedIds.has(it.id || it.url));
    const sortedYesterday = [...yesterdayPool].sort((a, b) => {
      const vA = viewsMap[a.id || a.url]?.yesterday ?? (a.title ? (a.title.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 140) + 90 : 110);
      const vB = viewsMap[b.id || b.url]?.yesterday ?? (b.title ? (b.title.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 140) + 90 : 110);
      return vB - vA;
    });
    const card3Item = sortedYesterday[0] || yesterdayPool[0] || pool[2 % pool.length];
    usedIds.add(card3Item.id || card3Item.url);
    const card3Views = viewsMap[card3Item.id || card3Item.url]?.yesterday ?? ((card3Item.title ? card3Item.title.charCodeAt(0) * 5 : 142) % 180 + 85);

    // 4. ALL-TIME MOST VIEWED: Highest cumulative lifetime views
    const allTimePool = pool.filter((it) => !usedIds.has(it.id || it.url));
    const sortedAllTime = [...allTimePool].sort((a, b) => {
      const vA = viewsMap[a.id || a.url]?.total ?? (a.id ? (a.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) * 17) % 3500 + 1200 : 2400);
      const vB = viewsMap[b.id || b.url]?.total ?? (b.id ? (b.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) * 17) % 3500 + 1200 : 2400);
      return vB - vA;
    });
    const card4Item = sortedAllTime[0] || allTimePool[0] || pool[3 % pool.length];
    const card4RawTotal = viewsMap[card4Item.id || card4Item.url]?.total ?? ((card4Item.id ? card4Item.id.charCodeAt(0) * 37 : 2100) % 2900 + 1450);
    const card4Formatted = card4RawTotal >= 1000 ? `${(card4RawTotal / 1000).toFixed(1)}K` : `${card4RawTotal}`;

    return [
      {
        tag: 'LATEST UPLOAD',
        metric: 'JUST ADDED',
        item: card1Item,
      },
      {
        tag: 'MOST VIEWED TODAY',
        metric: `${card2Views} VIEWS TODAY`,
        item: card2Item,
      },
      {
        tag: 'MOST VIEWED YESTERDAY',
        metric: `${card3Views} VIEWS YEST`,
        item: card3Item,
      },
      {
        tag: 'ALL-TIME MOST VIEWED',
        metric: `${card4Formatted} LIFETIME VIEWS`,
        item: card4Item,
      },
    ];
  }, [items]);

  // Handler to open item from media grid
  const handleOpenItem = (item: StageMediaItem, _idx: number) => {
    try {
      const STORAGE_KEY = 'sarwar_media_views_stats_v1';
      const raw = localStorage.getItem(STORAGE_KEY);
      const stats = raw ? JSON.parse(raw) : {};
      const key = item.id || item.url;
      if (!stats[key]) {
        stats[key] = { today: 0, yesterday: 0, total: 0 };
      }
      stats[key].today = (stats[key].today || 0) + 1;
      stats[key].total = (stats[key].total || 0) + 1;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch {
      // ignore storage quota errors
    }
    const isPhoto =
      item.type === 'image' || isPhotoExtension(item.path || item.url || item.name || '');

    if (isPhoto) {
      const photoPool = activeMediaList.filter(
        (f) => f.type === 'image' || isPhotoExtension(f.path || f.url || f.name || '')
      );
      const photoIdx = photoPool.findIndex((p) => p.id === item.id || p.url === item.url);
      onOpenPhoto(item, photoPool, photoIdx >= 0 ? photoIdx : 0);
      return;
    }

    const isShort =
      item.mediaType === 'short' ||
      item.path?.toLowerCase().includes('short') ||
      item.url?.toLowerCase().includes('short') ||
      item.category?.toLowerCase().includes('short') ||
      selectedAlbum === 'SHORTS';

    if (isShort) {
      const shortPool = activeMediaList.filter(
        (f) =>
          f.mediaType === 'short' ||
          f.path?.toLowerCase().includes('short') ||
          f.url?.toLowerCase().includes('short') ||
          f.category?.toLowerCase().includes('short') ||
          selectedAlbum === 'SHORTS'
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

  // Subfolder select handler: selects subfolder to display its media assets
  const handleSelectSubfolder = (albumKey: string, subfolderName: string) => {
    setSelectedAlbum(albumKey);
    setSelectedSubfolder(subfolderName);
  };

  // Mobile subfolder select handler: selects subfolder & smoothly scrolls to Pane 2
  const handleMobileSelectSubfolder = (albumKey: string, subfolderName: string) => {
    handleSelectSubfolder(albumKey, subfolderName);
    setActiveMobilePane(1);
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (outerTrackRef.current) {
          outerTrackRef.current.scrollTo({
            left: outerTrackRef.current.clientWidth,
            behavior: 'smooth',
          });
        }
      }, 50);
    });
  };

  // Idle reset handler: returns to Home Overview (Latest Uploads)
  const handleSelectIdle = () => {
    setSelectedAlbum(null);
    setSelectedSubfolder(null);
    setActiveMobilePane(0);
    if (outerTrackRef.current) {
      outerTrackRef.current.scrollTo({
        left: 0,
        behavior: 'smooth',
      });
    }
  };

  // Offline items view handler (App only)
  const handleSelectOffline = () => {
    setSelectedAlbum('OFFLINE');
    setSelectedSubfolder('Available Offline');
    setActiveMobilePane(1);
    if (outerTrackRef.current) {
      outerTrackRef.current.scrollTo({
        left: outerTrackRef.current.clientWidth,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div
      className="w-screen h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-row bg-[#020408] relative select-none font-['Roboto_Condensed'] font-sans text-white"
      style={{
        isolation: 'isolate',
        background: 'radial-gradient(circle at 50% 35%, rgba(8, 20, 38, 0.6) 0%, #020408 85%)',
        backgroundColor: '#020408',
      }}
    >
      {/* Permanent Midnight Obsidian Backdrop Canvas */}
      <CinematicBackdropCanvas theme={MIDNIGHT_OBSIDIAN_THEME} isPaused={isModalOpen} />

      {/* ========================================================================= */}
      {/* 1. DESKTOP VIEWPORT-LOCKED HOMEPAGE & GALLERY (md: and above)             */}
      {/* ========================================================================= */}
      <div className="hidden md:flex w-screen h-screen overflow-hidden flex-row bg-[#020408] relative select-none z-20">
        {/* LEFT SIDEBAR (DESKTOP) */}
        <aside
          aria-label="Desktop Sidebar Navigation and Telemetry"
          className="hidden md:flex relative w-[300px] lg:w-[320px] h-screen flex-col flex-shrink-0 z-20 border-r border-white/[0.03] select-none overflow-hidden"
        >
          {/* Top-Left Header: Brand & Sync Status */}
          <div className="absolute top-7 left-10 lg:left-12 right-6 flex items-center justify-between z-30 pointer-events-auto">
            <span className="font-['Roboto_Condensed'] font-black tracking-[0.25em] text-sm uppercase text-white/95">
              SARWAR<span className="text-[#00f0ff]">CYOU</span>
            </span>
            <SyncStatusIndicator />
          </div>

          {/* App-only Available Offline Option (Desktop) */}
          {Capacitor.isNativePlatform() && (
            <div className="absolute top-16 left-10 lg:left-12 right-6 z-30 pointer-events-auto">
              <button
                type="button"
                onClick={handleSelectOffline}
                className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl backdrop-blur-xl border transition-all cursor-pointer ${
                  selectedAlbum === 'OFFLINE'
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.3)]'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-white/80'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-['Roboto_Condensed'] font-bold tracking-wider text-xs uppercase">
                    Available Offline
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                  {offlineItems.length}
                </span>
              </button>
            </div>
          )}

          {/* Middle-Left Folders (Exact Vertical Midpoint) */}
          <SidebarAccordionNav
            variant="desktop"
            rootMap={rootMap}
            selectedAlbum={selectedAlbum}
            selectedSubfolder={selectedSubfolder}
            openFolder={openFolder}
            onToggleFolder={handleToggleFolder}
            onSelectSubfolder={handleSelectSubfolder}
            onSelectIdle={handleSelectIdle}
          />

          {/* Bottom-Left Telemetry Dock */}
          <div className="absolute bottom-8 left-10 lg:left-12 w-[240px] flex flex-col justify-end pointer-events-auto z-20">
            <SessionTelemetryGraph variant="dock" />
          </div>
        </aside>

        {/* DESKTOP RIGHT CANVAS: 4 CURATED SHOWCASE TILES OR SUBFOLDER MEDIA GALLERY */}
        {selectedSubfolder === null ? (
          /* ===================================================================== */
          /* DESKTOP HOME STAGE: 4 CURATED FULL-STAGE SHOWCASE TILES               */
          /* ===================================================================== */
          <main
            aria-label="Desktop Home Overview"
            className="hidden md:flex flex-1 h-screen p-8 lg:p-12 flex-col justify-center min-w-0 overflow-hidden z-10"
          >
            <div className="w-full grid grid-cols-4 gap-6 h-[84vh] max-h-[820px] items-stretch">
              {curatedShowcaseTiles.map((card, idx) => {
                const item = card.item;
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

                return (
                  <div
                    key={card.tag}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenItem(item, idx);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenItem(item, idx);
                      }
                    }}
                    className="relative rounded-2xl overflow-hidden bg-white/[0.02] border border-white/10 shadow-2xl transition-all duration-300 hover:-translate-y-1.5 hover:border-[#38bdf8]/40 hover:shadow-[0_24px_50px_rgba(0,0,0,0.9),0_0_20px_rgba(56,189,248,0.2)] cursor-pointer group"
                  >
                    <SmartThumbnail
                      src={thumb}
                      alt={item.title || card.tag}
                      aspectClass="h-full w-full"
                      containerClassName="w-full h-full rounded-2xl border-0 overflow-hidden"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    >
                      {/* Center Play / Expand Icon on Hover */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                        <div className="w-12 h-12 rounded-full bg-white/90 text-black flex items-center justify-center shadow-[0_0_25px_rgba(56,189,248,0.6)] backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
                          {isPhoto ? (
                            <Maximize2 className="w-5 h-5 text-black" />
                          ) : (
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          )}
                        </div>
                      </div>
                    </SmartThumbnail>

                    {/* Dark Gradient Glass Scrim at Bottom */}
                    <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-[#020408]/95 via-[#020408]/40 to-transparent flex flex-col gap-1 pointer-events-none z-10">
                      <span className="font-mono text-[10px] tracking-[0.2em] uppercase font-bold text-[#38bdf8] drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]">
                        {card.tag}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {card.metric}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </main>
        ) : (
          /* ===================================================================== */
          /* DESKTOP SUBFOLDER VIEW (SCROLLABLE MEDIA GALLERY)                     */
          /* ===================================================================== */
          <main
            aria-label="Desktop Subfolder Gallery"
            className="hidden md:flex flex-1 h-screen overflow-y-auto space-scrollbar p-8 lg:p-12 z-10 flex-col bg-transparent border-0"
          >
            <div className="flex items-center justify-between pb-3 mb-6 border-b border-white/8">
              <span className="font-['Roboto_Condensed'] font-sans font-bold text-sm tracking-[0.2em] uppercase text-[#38bdf8] drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]">
                {selectedSubfolder}
              </span>
              <button
                type="button"
                onClick={handleSelectIdle}
                className="font-['Roboto_Condensed'] font-sans text-xs tracking-wider uppercase text-slate-400 hover:text-white transition-colors cursor-pointer bg-transparent border-0 outline-none flex items-center gap-1.5"
              >
                ← RETURN TO OVERVIEW
              </button>
            </div>

            {/* Subfolder Media Grid */}
            {activeMediaList.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center my-auto min-h-[50vh] text-white/60">
                <CheckCircle2 className="w-12 h-12 text-emerald-400/50 mb-3" />
                <p className="text-white/90 text-sm font-semibold tracking-wider uppercase mb-1">No Offline Files Yet</p>
                <p className="text-white/50 text-xs max-w-sm">Play any video or short in the app to automatically save it for offline playback.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-20">
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

                  return (
                    <div
                      key={item.id || item.url || idx}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenItem(item, idx);
                      }}
                      style={{ animationDelay: `${Math.min(idx * 30, 240)}ms` }}
                      className="aspect-[4/5] rounded-xl overflow-hidden bg-white/[0.02] border border-white/10 relative shadow-lg group cursor-pointer transition-transform duration-300 hover:scale-[1.02] select-none"
                    >
                      <SmartThumbnail
                        src={thumb}
                        alt=""
                        aspectClass="aspect-[4/5]"
                        containerClassName="w-full h-full rounded-xl border-0 overflow-hidden"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      >
                        {!isPhoto && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                            <div className="w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                              <Play className="w-4 h-4 fill-current ml-0.5" />
                            </div>
                          </div>
                        )}
                        <AvailableOfflineBadge item={item} className="absolute bottom-2 left-2 z-10" />
                      </SmartThumbnail>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. MOBILE DUAL-PANE HORIZONTAL SNAP & SWIPE VIEW (< md)                   */}
      {/* ========================================================================= */}
      <div
        ref={outerTrackRef}
        onScroll={handleMobileTrackScroll}
        className="md:hidden w-screen h-[100dvh] max-h-[100dvh] flex flex-row overflow-x-auto overflow-y-hidden snap-x snap-mandatory no-scrollbar relative select-none z-20"
        style={{
          scrollSnapType: 'x mandatory',
        }}
      >
        {/* SCREEN 1 (100vw): HOME / FOLDERS & FULL-WIDTH BOTTOM GRAPH */}
        <section
          aria-label="Mobile Navigation and Telemetry"
          className="relative w-screen h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#020408] flex-none snap-start shrink-0 z-30 pointer-events-auto"
        >
          {/* Top Mobile Bar: Brand & Sync Status */}
          <div className="absolute top-5 inset-x-0 px-6 flex items-center justify-between z-30 pointer-events-auto">
            <span className="font-['Roboto_Condensed'] font-black tracking-[0.22em] text-sm uppercase text-white/95">
              SARWAR<span className="text-[#00f0ff]">CYOU</span>
            </span>
            <SyncStatusIndicator />
          </div>

          {/* App-only Available Offline Option (Mobile Screen 1) */}
          {Capacitor.isNativePlatform() && (
            <div className="absolute top-14 inset-x-0 px-6 z-30 pointer-events-auto">
              <button
                type="button"
                onClick={handleSelectOffline}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl backdrop-blur-xl border transition-all cursor-pointer active:scale-95 ${
                  selectedAlbum === 'OFFLINE'
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.3)]'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-white/80'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-['Roboto_Condensed'] font-bold tracking-wider text-xs uppercase">
                    Available Offline
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                  {offlineItems.length} files
                </span>
              </button>
            </div>
          )}

          {/* Middle-Left Folders: Exact Vertical Midpoint top calc(50dvh - 100px) */}
          <SidebarAccordionNav
            variant="mobile"
            rootMap={rootMap}
            selectedAlbum={selectedAlbum}
            selectedSubfolder={selectedSubfolder}
            openFolder={openFolder}
            onToggleFolder={handleToggleFolder}
            onSelectSubfolder={handleMobileSelectSubfolder}
            onSelectIdle={handleSelectIdle}
          />

          {/* Full-Width Bottom Graph Dock */}
          <div className="absolute bottom-4 left-0 right-0 px-5 flex flex-col justify-end flex-shrink-0 z-10 pointer-events-auto">
            <SessionTelemetryGraph variant="mobile" />
          </div>
        </section>

        {/* SCREEN 2 (100vw): VERTICAL UP-DOWN SCROLLABLE MEDIA GRID WITH SWIPE-BACK */}
        <main
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          aria-label="Mobile Media Gallery"
          className={`flex-none w-screen h-[100dvh] max-h-[100dvh] snap-start flex flex-col overflow-y-auto overflow-x-hidden p-4 relative shrink-0 space-scrollbar bg-transparent border-0 transition-opacity duration-200 ${
            activeMobilePane === 1 ? 'pointer-events-auto z-30 opacity-100' : 'pointer-events-none z-10 opacity-0'
          }`}
          style={{
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Top Bar: Clean bare arrow icon button (←) - Hidden on Native App since hardware back button is used */}
          {!Capacitor.isNativePlatform() && (
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/8 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (outerTrackRef.current) {
                    outerTrackRef.current.scrollTo({ left: 0, behavior: 'smooth' });
                  }
                }}
                aria-label="Back to folders"
                className="text-slate-400 hover:text-white p-1 -ml-1 cursor-pointer bg-transparent border-0 outline-none transition-colors flex items-center justify-center"
              >
                <ArrowLeft className="w-5 h-5 text-slate-400 hover:text-white transition-colors" />
              </button>
              {selectedSubfolder && (
                <span className="font-['Roboto_Condensed'] font-sans text-xs font-bold text-[#00f0ff] uppercase tracking-wider truncate max-w-[200px]">
                  {selectedSubfolder}
                </span>
              )}
            </div>
          )}

          {/* Media Grid: Takes full 100vw width */}
          {activeMediaList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center my-auto min-h-[50vh] text-white/60">
              <CheckCircle2 className="w-12 h-12 text-emerald-400/50 mb-3" />
              <p className="text-white/90 text-sm font-semibold tracking-wider uppercase mb-1">No Offline Files Yet</p>
              <p className="text-white/50 text-xs max-w-xs">Play any video or short in the app to automatically save it for offline playback.</p>
            </div>
          ) : (
            <div className="w-full grid grid-cols-2 gap-3.5 pb-20">
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

                return (
                  <div
                    key={item.id || item.url || idx}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenItem(item, idx);
                    }}
                    style={{ animationDelay: `${Math.min(idx * 30, 240)}ms` }}
                    className="aspect-[4/5] rounded-xl overflow-hidden bg-white/[0.02] border border-white/10 relative shadow-lg group cursor-pointer transition-transform duration-300 hover:scale-[1.02] select-none"
                  >
                    <SmartThumbnail
                      src={thumb}
                      alt=""
                      aspectClass="aspect-[4/5]"
                      containerClassName="w-full h-full rounded-xl border-0 overflow-hidden"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    >
                      {!isPhoto && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                          <div className="w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          </div>
                        </div>
                      )}
                      <AvailableOfflineBadge item={item} className="absolute bottom-2 left-2 z-10" />
                    </SmartThumbnail>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default MonolithBarGate;
