import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Play, ArrowLeft, Folder, ChevronRight, Music2 } from 'lucide-react';
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
import { SyncStatusIndicator } from '../SyncStatusIndicator';
import { AvailableOfflineBadge } from '../common/AvailableOfflineBadge';
import { HeaderBrandLogo } from '../updater/HeaderBrandLogo';
import { CelebrityShowcase } from '../CelebrityShowcase';
import { VaultDrawer } from '../VaultDrawer';
import { YouTubeTheaterModal } from '../YouTubeTheaterModal';
import youtubeMusicData from '../../data/youtubeMusic.json';
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

  // YouTube Music dataset mapped to StageMediaItem[]
  const youtubeMediaItems: StageMediaItem[] = useMemo(() => {
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
      parentAlbum: 'YOUTUBE',
      poster: track.thumbnail,
      posterUrl: track.thumbnail,
      date: Date.now(),
      artist: track.artist,
      album: track.album,
    } as StageMediaItem & { artist?: string; album?: string }));
  }, []);

  const [isYouTubeTheaterOpen, setIsYouTubeTheaterOpen] = useState(false);
  const [youTubeTheaterIndex, setYouTubeTheaterIndex] = useState(0);

  const youTubeAlbumData: AlbumData = useMemo(() => ({
    id: 'youtube-vault-archive',
    index: 0,
    name: 'YOUTUBE',
    type: 'video' as const,
    itemCount: youtubeMediaItems.length,
    items: youtubeMediaItems,
    layoutType: 'grid-wall' as const,
    subtitle: 'Official Curated Music Videos',
  }), [youtubeMediaItems]);

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

  // Active Category Child Subfolders (for Level 1 Grid)
  const childSubfoldersList = useMemo(() => {
    if (!activeCategoryNode) return [];
    return Array.from(activeCategoryNode.subfolders.values());
  }, [activeCategoryNode]);

  // Active Media Items List (for Level 2 Grid)
  const activeMediaList = useMemo(() => {
    if (!activeCategoryNode || !selectedSubfolder) return [];
    const subNode = activeCategoryNode.subfolders.get(selectedSubfolder);
    if (subNode) {
      return subNode.files;
    }
    return activeCategoryNode.files;
  }, [activeCategoryNode, selectedSubfolder]);

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
      className="w-screen h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col bg-[#020408] relative select-none font-['Roboto_Condensed'] font-sans text-white"
      style={{
        isolation: 'isolate',
        background: 'radial-gradient(circle at 50% 35%, rgba(8, 20, 38, 0.6) 0%, #020408 85%)',
        backgroundColor: '#020408',
      }}
    >
      {/* Permanent Midnight Obsidian Backdrop Canvas */}
      <CinematicBackdropCanvas theme={MIDNIGHT_OBSIDIAN_THEME} isPaused={isModalOpen} />

      {/* Option A: Concealed Left Navigation Drawer */}
      <VaultDrawer
        isOpen={isVaultDrawerOpen}
        onClose={() => setVaultDrawerOpen(false)}
        onSelectFolder={handleSelectDrawerFolder}
        rootMap={rootMap}
        onOpenPhoto={onOpenPhoto}
        onOpenVideo={(item) => onOpenVideo(item, [item])}
      />

      {/* TOP HEADER BAR: Zero-Clue Logo Trigger & Stepped Breadcrumbs */}
      <header className="w-full px-5 sm:px-8 py-3.5 flex items-center justify-between border-b border-white/[0.06] bg-[#020408]/80 backdrop-blur-md z-30 shrink-0">
        <div className="flex items-center gap-3">
          <HeaderBrandLogo
            trackingClass="tracking-[0.22em] sm:tracking-[0.25em]"
            onTrigger={() => setVaultDrawerOpen((prev) => !prev)}
          />

          {/* Breadcrumb Indicators */}
          {selectedCategory && !selectedSubfolder && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase text-[#38bdf8] bg-[#38bdf8]/10 border border-[#38bdf8]/30">
              <span>CORE</span>
              <span>//</span>
              <span>{selectedCategory}</span>
            </span>
          )}

          {selectedCategory && selectedSubfolder && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase text-[#38bdf8] bg-[#38bdf8]/10 border border-[#38bdf8]/30">
              <span>CORE</span>
              <span>//</span>
              <button
                type="button"
                onClick={handleReturnToCategory}
                className="hover:underline cursor-pointer"
              >
                {selectedCategory}
              </button>
              <span>/</span>
              <span className="text-white">{selectedSubfolder}</span>
            </span>
          )}
        </div>

        {/* Header Right Action: Level-Specific Return Buttons & Sync Status */}
        <div className="flex items-center gap-2.5">
          {selectedSubfolder && (
            <button
              type="button"
              onClick={handleReturnToCategory}
              className="text-xs font-mono tracking-wider uppercase text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 px-3 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>RETURN TO {selectedCategory}</span>
            </button>
          )}

          {selectedCategory && (
            <button
              type="button"
              onClick={handleExitToHome}
              className="text-xs font-mono tracking-wider uppercase text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1 px-3 py-1 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/5"
            >
              <span>EXIT TO HOME</span>
            </button>
          )}

          <SyncStatusIndicator />
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
                <Music2 className="w-5 h-5 text-[#38bdf8]" />
                <span className="font-['Roboto_Condensed'] font-black text-lg sm:text-xl tracking-[0.2em] uppercase text-[#38bdf8] drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]">
                  YOUTUBE MUSIC THEATER
                </span>
              </div>
              <span className="text-xs font-mono text-neutral-400">
                ({youtubeMediaItems.length} curated tracks)
              </span>

              {/* Subfolder Collection Tabs */}
              <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/10 ml-0 sm:ml-3">
                <button
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    setSelectedSubfolder('FAVORITE TRACKS');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-mono tracking-wider uppercase transition-all cursor-pointer ${
                    selectedSubfolder === 'FAVORITE TRACKS' || !selectedSubfolder
                      ? 'bg-[#38bdf8] text-neutral-950 font-bold shadow-md'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  FAVORITE TRACKS (14)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    setSelectedSubfolder('HD REMASTERS');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-mono tracking-wider uppercase transition-all cursor-pointer ${
                    selectedSubfolder === 'HD REMASTERS'
                      ? 'bg-[#38bdf8] text-neutral-950 font-bold shadow-md'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  HD REMASTERS (8K/4K)
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExitToHome}
              className="self-start sm:self-auto font-mono text-xs tracking-wider uppercase text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              ← EXIT TO CELEBRITY HUB
            </button>
          </div>

          {/* Editorial Masonry/Grid of Curated Tracks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 pb-24">
            {youtubeMediaItems.map((track, idx) => {
              const trackAny = track as any;
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
                  className="group relative rounded-2xl overflow-hidden bg-[#090d16] border border-white/10 hover:border-[#38bdf8]/60 shadow-[0_12px_35px_rgba(0,0,0,0.85)] hover:shadow-[0_20px_45px_rgba(56,189,248,0.25)] transition-all duration-300 hover:scale-[1.02] cursor-pointer flex flex-col select-none"
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

                    {/* Quality Pill Tag */}
                    <div className="absolute top-2.5 right-2.5 z-10">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase text-[#38bdf8] bg-black/80 backdrop-blur-md border border-[#38bdf8]/30 shadow-md">
                        {selectedSubfolder === 'HD REMASTERS' ? '8K REMASTER' : '4K UHD'}
                      </span>
                    </div>

                    {/* Discreet Play Badge Overlay on Hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                      <div className="w-12 h-12 rounded-full bg-[#38bdf8] text-neutral-950 flex items-center justify-center shadow-[0_0_24px_rgba(56,189,248,0.7)] transform group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Editorial Typography & Metadata */}
                  <div className="p-4 flex flex-col gap-2 flex-1 justify-between bg-gradient-to-b from-transparent to-[#05080e]">
                    <div className="flex flex-col gap-0.5">
                      <h3 className="font-['Roboto_Condensed'] font-bold text-base sm:text-lg text-white group-hover:text-[#38bdf8] transition-colors line-clamp-1">
                        {track.title}
                      </h3>
                      <p className="text-xs text-neutral-400 font-sans line-clamp-1">
                        {trackAny.artist}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[11px] font-mono text-neutral-400">
                      <span className="truncate max-w-[140px] px-2 py-0.5 rounded bg-white/[0.04] border border-white/5 text-[10px]">
                        {trackAny.album}
                      </span>
                      <span className="text-[#38bdf8] text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
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
      ) : selectedSubfolder === null ? (
        /* ===================================================================== */
        /* LEVEL 1: STRUCTURED CHILD COLLECTIONS / ALBUMS GRID                   */
        /* ===================================================================== */
        <main
          aria-label="Category Child Collections"
          className="flex-1 w-full h-[calc(100dvh-60px)] overflow-y-auto space-scrollbar p-5 sm:p-8 lg:p-12 z-10 flex flex-col bg-transparent"
        >
          {/* Section Breadcrumb Bar */}
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="font-['Roboto_Condensed'] font-black text-lg sm:text-xl tracking-[0.2em] uppercase text-[#38bdf8] drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]">
                {selectedCategory} DIRECTORIES
              </span>
              <span className="text-xs font-mono text-neutral-400">
                ({childSubfoldersList.length} collections)
              </span>
            </div>

            <button
              type="button"
              onClick={handleExitToHome}
              className="font-mono text-xs tracking-wider uppercase text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              ← EXIT TO CELEBRITY HUB
            </button>
          </div>

          {/* Subfolders / Child Collections Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
            {childSubfoldersList.map((sub) => {
              const firstItem = sub.files[0];
              const isPhoto = firstItem
                ? firstItem.type === 'image' || isPhotoExtension(firstItem.path || firstItem.url || firstItem.name || '')
                : false;

              const imageSrc = firstItem
                ? (firstItem as any).thumbnail ||
                  (firstItem as any).src ||
                  firstItem.url ||
                  (firstItem as any).image ||
                  firstItem.path ||
                  ''
                : '';

              const thumb = firstItem
                ? isPhoto
                  ? getMediaUrl(imageSrc) || imageSrc
                  : getImageUrl(firstItem) ||
                    getThumbnailUrl(firstItem) ||
                    resolveStaticVideoThumbnail(firstItem) ||
                    getMediaUrl(imageSrc) ||
                    imageSrc
                : '';

              return (
                <div
                  key={sub.name}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    hapticMedium();
                    setSelectedSubfolder(sub.name);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      hapticMedium();
                      setSelectedSubfolder(sub.name);
                    }
                  }}
                  className="group relative rounded-2xl overflow-hidden bg-[#090d16] border border-[#38bdf8]/20 hover:border-[#38bdf8]/60 shadow-[0_12px_35px_rgba(0,0,0,0.85)] hover:shadow-[0_20px_45px_rgba(56,189,248,0.25)] transition-all duration-300 hover:scale-[1.02] cursor-pointer flex flex-col justify-end aspect-[16/10] sm:aspect-[4/3] select-none"
                >
                  {/* Thumbnail Preview */}
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={sub.name}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-tr from-[#020408] to-[#0c1e38] flex items-center justify-center">
                      <Folder className="w-12 h-12 text-[#38bdf8]/40" />
                    </div>
                  )}

                  {/* Ambient Dark Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#020408]/95 via-[#020408]/50 to-transparent pointer-events-none" />

                  {/* Top Badge: Item Count */}
                  <div className="absolute top-3 right-3 z-10">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase text-[#38bdf8] bg-black/75 backdrop-blur-md border border-[#38bdf8]/30 shadow-md">
                      <Folder className="w-3 h-3 text-[#38bdf8]" />
                      <span>{sub.files.length} ITEMS</span>
                    </span>
                  </div>

                  {/* Bottom Info: Subfolder Name & Arrow Prompt */}
                  <div className="relative z-10 p-5 flex items-center justify-between pointer-events-none">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-mono tracking-widest text-[#38bdf8] uppercase">
                        {selectedCategory} // SUBFOLDER
                      </span>
                      <h3 className="font-['Roboto_Condensed'] font-black tracking-wider text-lg sm:text-xl text-white uppercase group-hover:text-[#38bdf8] transition-colors line-clamp-1">
                        {sub.name}
                      </h3>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-white/10 group-hover:bg-[#38bdf8] text-white group-hover:text-black flex items-center justify-center transition-all duration-300 shadow-md shrink-0">
                      <ChevronRight className="w-5 h-5 ml-0.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      ) : (
        /* ===================================================================== */
        /* LEVEL 2: SPECIFIC SUBFOLDER MEDIA ASSETS GALLERY                      */
        /* ===================================================================== */
        <main
          aria-label="Subfolder Media Assets"
          className="flex-1 w-full h-[calc(100dvh-60px)] overflow-y-auto space-scrollbar p-5 sm:p-8 lg:p-12 z-10 flex flex-col bg-transparent"
        >
          {/* Breadcrumb Header Rail */}
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/10">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReturnToCategory}
                className="font-mono text-xs uppercase tracking-wider text-slate-400 hover:text-white cursor-pointer"
              >
                {selectedCategory}
              </button>
              <span className="text-slate-500">/</span>
              <span className="font-['Roboto_Condensed'] font-black text-base sm:text-lg tracking-[0.2em] uppercase text-[#38bdf8] drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]">
                {selectedSubfolder}
              </span>
              <span className="text-xs font-mono text-neutral-400">
                ({activeMediaList.length} files)
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleReturnToCategory}
                className="font-mono text-xs tracking-wider uppercase text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#38bdf8]" />
                <span>RETURN TO {selectedCategory}</span>
              </button>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <button
                type="button"
                onClick={handleExitToHome}
                className="font-mono text-xs tracking-wider uppercase text-neutral-400 hover:text-white transition-colors cursor-pointer hidden sm:inline"
              >
                EXIT TO CELEBRITY HUB
              </button>
            </div>
          </div>

          {/* Media Items Grid */}
          {activeMediaList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center my-auto min-h-[40vh] text-white/60">
              <p className="text-white/80 text-sm font-semibold tracking-wider uppercase mb-1">
                No Media Items in this Collection
              </p>
              <button
                type="button"
                onClick={handleReturnToCategory}
                className="mt-4 px-4 py-2 rounded-lg bg-[#38bdf8]/15 hover:bg-[#38bdf8]/25 text-[#38bdf8] border border-[#38bdf8]/30 font-mono text-xs uppercase tracking-wider transition-all"
              >
                Return to {selectedCategory} Directories
              </button>
            </div>
          ) : (
            <div className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-20">
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
                    className="aspect-[4/5] rounded-xl overflow-hidden bg-white/[0.02] border border-white/10 hover:border-[#38bdf8]/40 relative shadow-lg group cursor-pointer transition-all duration-300 hover:scale-[1.02] select-none"
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

      {/* Native In-App YouTube Theater Modal Overlay */}
      <YouTubeTheaterModal
        isOpen={isYouTubeTheaterOpen}
        onClose={() => setIsYouTubeTheaterOpen(false)}
        album={youTubeAlbumData}
        allAlbums={[youTubeAlbumData]}
        initialIndex={youTubeTheaterIndex}
        onIndexChange={(newIdx) => setYouTubeTheaterIndex(newIdx)}
      />
    </div>
  );
};

export default MonolithBarGate;
