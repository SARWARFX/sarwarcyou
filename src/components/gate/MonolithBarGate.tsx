import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Play, Folder, Music2, Film } from 'lucide-react';
import type { StageMediaItem, AlbumData } from '../../types';
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
import { YouTubeTheaterModal } from '../YouTubeTheaterModal';
import youtubeMusicData from '../../data/youtubeMusic.json';
import latestMusicReleasesData from '../../data/latestMusicReleases.json';
import { hapticMedium } from '../../utils/hapticsManager';
import { trackActivityEvent } from '../../utils/usageTelemetry';

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
  // Navigation states:
  // Level 0: selectedCategory === null && selectedSubfolder === null (Bollywood Overview)
  // Level 1: selectedCategory !== null && selectedSubfolder === null (Child Subfolders Grid)
  // Level 2: selectedCategory !== null && selectedSubfolder !== null (Direct Media Items)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubfolder, setSelectedSubfolder] = useState<string | null>(null);

  // Concealed Option A Terminal Drawer State
  const [isVaultDrawerOpen, setVaultDrawerOpen] = useState(false);

  // Permanent 14 Curated Classics
  const favoriteClassicsItems: StageMediaItem[] = useMemo(() => {
    return (youtubeMusicData as Array<{
      id: string;
      title: string;
      artist: string;
      album: string;
      thumbnail: string;
    }>).map((track) => ({
      id: track.id,
      title: track.title,
      name: `${track.title} - ${track.artist}`,
      url: `https://www.youtube-nocookie.com/embed/${track.id}`,
      thumbnail: track.thumbnail,
      category: 'YOUTUBE',
      type: 'video' as const,
      mediaType: 'clip' as const,
      parentAlbum: 'FAVORITE CLASSICS',
      poster: track.thumbnail,
      posterUrl: track.thumbnail,
      date: Date.now(),
      artist: track.artist,
      album: track.album,
    } as StageMediaItem & { artist?: string; album?: string }));
  }, []);

  // Automated Ingested Actress Music Releases (Latest Dispatches)
  const latestDispatchesItems: StageMediaItem[] = useMemo(() => {
    return (latestMusicReleasesData as Array<{
      id: string;
      title: string;
      actress: string;
      channel: string;
      publishedAt: string;
      thumbnail: string;
    }>).map((rel) => ({
      id: rel.id,
      title: rel.title,
      name: `${rel.title} - ${rel.actress}`,
      url: `https://www.youtube-nocookie.com/embed/${rel.id}`,
      thumbnail: rel.thumbnail,
      category: 'YOUTUBE',
      type: 'video' as const,
      mediaType: 'clip' as const,
      parentAlbum: 'LATEST DISPATCHES',
      poster: rel.thumbnail,
      posterUrl: rel.thumbnail,
      date: new Date(rel.publishedAt).getTime(),
      actress: rel.actress,
      channel: rel.channel,
      publishedAt: rel.publishedAt,
    } as StageMediaItem & { actress?: string; channel?: string; publishedAt?: string }));
  }, []);

  const [isYouTubeTheaterOpen, setIsYouTubeTheaterOpen] = useState(false);
  const [youTubeTheaterIndex, setYouTubeTheaterIndex] = useState(0);

  // Active YouTube tab & active playlist for Theater Modal
  const isLatestDispatches = selectedSubfolder === 'LATEST DISPATCHES';
  const currentYouTubeList = isLatestDispatches ? latestDispatchesItems : favoriteClassicsItems;

  const youTubeAlbumData: AlbumData = useMemo(() => ({
    id: isLatestDispatches ? 'youtube-dispatches-archive' : 'youtube-classics-archive',
    index: 0,
    name: isLatestDispatches ? 'LATEST DISPATCHES' : 'FAVORITE CLASSICS',
    type: 'video' as const,
    itemCount: currentYouTubeList.length,
    items: currentYouTubeList,
    layoutType: 'grid-wall' as const,
    subtitle: isLatestDispatches ? 'Automated Official Releases' : 'Curated Official Music Videos',
  }), [isLatestDispatches, currentYouTubeList]);

  const handlePlayYouTubeTrack = useCallback((index: number) => {
    hapticMedium();
    trackActivityEvent(1);
    setYouTubeTheaterIndex(index);
    setIsYouTubeTheaterOpen(true);
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
      setVaultDrawerOpen(false);
    },
    [rootMap]
  );

  // Idle reset handler: returns to Public Bollywood Overview (Level 0)
  const handleExitToHome = useCallback(() => {
    setSelectedCategory(null);
    setSelectedSubfolder(null);
  }, []);

  // Return to Category Subfolders handler (Level 2 -> Level 1)
  const handleReturnToCategory = useCallback(() => {
    setSelectedSubfolder(null);
  }, []);

  // Android Native Hardware Back Button handler (stepped 2-tier back navigation)
  useBackButton(
    useCallback(() => {
      // 0. If YouTube Theater modal is open, close it
      if (isYouTubeTheaterOpen) {
        setIsYouTubeTheaterOpen(false);
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
    }, [isYouTubeTheaterOpen, isVaultDrawerOpen, selectedSubfolder, selectedCategory, handleReturnToCategory, handleExitToHome])
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
              handleExitToHome();
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
              setSelectedCategory('YOUTUBE');
              setSelectedSubfolder(null);
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
              handleSelectDrawerFolder('shorts');
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
              handleSelectDrawerFolder('clips');
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
              handleSelectDrawerFolder('photography');
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
              handleSelectDrawerFolder('realtube');
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
          className="flex-1 w-full h-[calc(100dvh-60px)] overflow-hidden flex flex-col min-w-0 z-10"
        >
          <CelebrityShowcase onOpenPhoto={onOpenPhoto} />
        </main>
      ) : selectedCategory === 'YOUTUBE' ? (
        /* ===================================================================== */
        /* LEVEL 1/2: YOUTUBE MUSIC THEATER & CURATED OFFICIAL VIDEOS             */
        /* ===================================================================== */
        <main
          aria-label="YouTube Music Vault Archive"
          className="flex-1 w-full h-[calc(100dvh-60px)] overflow-y-auto space-scrollbar p-5 sm:p-8 lg:p-12 z-10 flex flex-col bg-transparent"
        >
          {/* Header & Subfolder Navigation Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-white/10">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Music2 className="w-5 h-5 text-white/80" />
                <span className="font-['Roboto_Condensed'] font-black text-lg sm:text-xl tracking-[0.2em] uppercase text-white">
                  YOUTUBE MUSIC THEATER
                </span>
              </div>
              <span className="text-xs font-mono text-neutral-400">
                ({currentYouTubeList.length} tracks)
              </span>

              {/* Minimalist Two-Tab Toggle */}
              <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/10 ml-0 sm:ml-3">
                <button
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    setSelectedSubfolder('FAVORITE CLASSICS');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-mono tracking-wider uppercase transition-all cursor-pointer ${
                    !isLatestDispatches
                      ? 'bg-white text-neutral-950 font-semibold shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  FAVORITE CLASSICS ({favoriteClassicsItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    setSelectedSubfolder('LATEST DISPATCHES');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-mono tracking-wider uppercase transition-all cursor-pointer ${
                    isLatestDispatches
                      ? 'bg-white text-neutral-950 font-semibold shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  LATEST DISPATCHES ({latestDispatchesItems.length})
                </button>
              </div>
            </div>
          </div>

          {/* Editorial Masonry/Grid of Curated Tracks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 pb-24">
            {currentYouTubeList.map((track, idx) => {
              const trackAny = track as any;
              const formattedDate = trackAny.publishedAt
                ? new Date(trackAny.publishedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : '';

              const channelBadgeClass =
                trackAny.channel === 'T-Series'
                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                  : trackAny.channel === 'Zee Music Company'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : trackAny.channel === 'Sony Music India'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : trackAny.channel === 'YRF'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-white/10 text-white/90 border-white/20';

              return (
                <div
                  key={track.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handlePlayYouTubeTrack(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handlePlayYouTubeTrack(idx);
                    }
                  }}
                  className="group relative rounded-2xl overflow-hidden bg-[#090d16] border border-white/10 hover:border-white/30 shadow-[0_12px_35px_rgba(0,0,0,0.85)] hover:shadow-[0_20px_45px_rgba(255,255,255,0.06)] transition-all duration-300 hover:scale-[1.02] cursor-pointer flex flex-col select-none"
                >
                  {/* 16:9 Thumbnail Stage */}
                  <div className="relative aspect-video w-full overflow-hidden bg-black/60">
                    <img
                      src={track.thumbnail}
                      alt={track.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* Ambient Obsidian Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#090d16] via-[#090d16]/30 to-transparent pointer-events-none" />

                    {/* Top Right Label/Badge: Channel label for dispatches, Quality for classics */}
                    <div className="absolute top-2.5 right-2.5 z-10">
                      {isLatestDispatches ? (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase backdrop-blur-md border shadow-md ${channelBadgeClass}`}
                        >
                          {trackAny.channel || 'OFFICIAL'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase text-white/80 bg-black/80 backdrop-blur-md border border-white/15 shadow-md">
                          4K UHD
                        </span>
                      )}
                    </div>

                    {/* Discreet Play Badge Overlay on Hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                      <div className="w-12 h-12 rounded-full bg-white text-neutral-950 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Editorial Typography & Metadata */}
                  <div className="p-4 flex flex-col gap-2 flex-1 justify-between bg-gradient-to-b from-transparent to-[#05080e]">
                    <div className="flex flex-col gap-1">
                      <h3 className="font-['Roboto_Condensed'] font-bold text-base sm:text-lg text-white group-hover:text-white transition-colors line-clamp-1">
                        {track.title}
                      </h3>
                      {isLatestDispatches ? (
                        <div className="flex items-center gap-1.5 text-xs text-neutral-300 font-sans">
                          <span className="text-neutral-500 text-[11px] font-mono uppercase tracking-wider">
                            LEAD:
                          </span>
                          <span className="text-zinc-300 font-semibold">
                            {trackAny.actress}
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-400 font-sans line-clamp-1">
                          {trackAny.artist}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[11px] font-mono text-neutral-400">
                      <span className="truncate max-w-[140px] px-2 py-0.5 rounded bg-white/[0.04] border border-white/5 text-[10px]">
                        {isLatestDispatches ? formattedDate : trackAny.album}
                      </span>
                      <span className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                        <Play className="w-2.5 h-2.5 fill-current" />
                        IN-APP THEATER
                      </span>
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
          className="flex-1 w-full overflow-y-auto space-scrollbar p-5 sm:p-8 lg:p-12 z-10 flex flex-col bg-transparent min-h-0"
        >
          {/* Section Hero Header */}
          <div className="flex flex-col gap-2 pb-6 mb-6 border-b border-white/10 shrink-0">
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
                  setSelectedSubfolder(null);
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
                    setSelectedSubfolder(sub.name);
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
              className={`w-full pb-20 ${
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
                      style={{ animationDelay: `${Math.min(idx * 25, 200)}ms` }}
                      className="group relative rounded-xl overflow-hidden bg-[#08080a] border border-white/10 hover:border-[#ccff00] hover:shadow-[0_0_25px_rgba(204,255,0,0.25)] aspect-[9/16] cursor-pointer transition-all duration-300 hover:scale-[1.02] flex flex-col justify-end select-none"
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
                      style={{ animationDelay: `${Math.min(idx * 25, 200)}ms` }}
                      className="group relative rounded-xl overflow-hidden bg-[#08080a] border border-white/10 hover:border-[#ccff00] hover:shadow-[0_0_20px_rgba(204,255,0,0.25)] aspect-[3/4] cursor-pointer transition-all duration-300 hover:scale-[1.02] flex flex-col justify-end select-none"
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
                    style={{ animationDelay: `${Math.min(idx * 25, 200)}ms` }}
                    className="group relative rounded-xl overflow-hidden bg-[#08080a] border border-white/10 hover:border-[#ccff00] hover:shadow-[0_0_25px_rgba(204,255,0,0.25)] cursor-pointer transition-all duration-300 hover:scale-[1.02] flex flex-col select-none"
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

      {/* Native In-App YouTube Theater Modal Overlay */}
      <YouTubeTheaterModal
        isOpen={isYouTubeTheaterOpen}
        onClose={() => setIsYouTubeTheaterOpen(false)}
        album={youTubeAlbumData}
        allAlbums={[youTubeAlbumData]}
        initialIndex={youTubeTheaterIndex}
        title={youTubeAlbumData?.items[youTubeTheaterIndex]?.title}
        onIndexChange={(newIdx) => setYouTubeTheaterIndex(newIdx)}
      />
    </div>
  );
};

export default MonolithBarGate;
