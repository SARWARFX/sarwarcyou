import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Play, ArrowLeft } from 'lucide-react';
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
import { SyncStatusIndicator } from '../SyncStatusIndicator';
import { AvailableOfflineBadge } from '../common/AvailableOfflineBadge';
import { HeaderBrandLogo } from '../updater/HeaderBrandLogo';
import { CelebrityShowcase } from '../CelebrityShowcase';
import { VaultDrawer } from '../VaultDrawer';

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
  initialAlbum,
  isModalOpen = false,
}) => {
  // Navigation states: default to Public Bollywood Overview (null)
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [selectedSubfolder, setSelectedSubfolder] = useState<string | null>(null);

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
        setSelectedAlbum(folder.key);
        setSelectedSubfolder(folder.key);
        return;
      }
      const rootNode = rootMap.get(folder.rawName);
      if (!rootNode) continue;
      for (const sub of rootNode.subfolders.values()) {
        if (sub.name.toLowerCase().replace(/[-_\s]+/g, '') === cleanTarget) {
          setSelectedAlbum(folder.key);
          setSelectedSubfolder(sub.name);
          return;
        }
      }
    }
  }, [initialAlbum, items.length, rootMap]);

  // Helper to gather all files under a DirectoryNode recursively
  const getAllFiles = useCallback((node?: DirectoryNode): StageMediaItem[] => {
    if (!node) return [];
    let list: StageMediaItem[] = [...node.files];
    for (const sub of node.subfolders.values()) {
      list = list.concat(getAllFiles(sub));
    }
    return list;
  }, []);

  // Active media assets list for selected archive folder
  const activeMediaList = useMemo(() => {
    if (!selectedAlbum) return [];

    const activeAlbumConfig = MAJOR_FOLDERS.find((h) => h.key === selectedAlbum);
    if (!activeAlbumConfig) return [];

    const rootNode = rootMap.get(activeAlbumConfig.rawName);
    if (!rootNode) return [];

    // If a specific subfolder is selected
    if (selectedSubfolder && selectedSubfolder !== activeAlbumConfig.key && rootNode.subfolders.has(selectedSubfolder)) {
      const subNode = rootNode.subfolders.get(selectedSubfolder);
      return subNode ? getAllFiles(subNode) : [];
    }

    // Default: return all files in this core archive
    return getAllFiles(rootNode);
  }, [selectedAlbum, selectedSubfolder, rootMap, getAllFiles]);

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

  // Drawer Folder selection handler
  const handleSelectDrawerFolder = useCallback((folderId: 'clips' | 'shorts' | 'photography' | 'realtube') => {
    const keyMap: Record<string, string> = {
      clips: 'CLIPS',
      shorts: 'SHORTS',
      photography: 'PHOTOGRAPHY',
      realtube: 'REALTUBE',
    };
    const targetKey = keyMap[folderId] || 'CLIPS';
    setSelectedAlbum(targetKey);
    setSelectedSubfolder(targetKey);
    setVaultDrawerOpen(false);
  }, []);

  // Idle reset handler: returns to Public Bollywood Overview
  const handleSelectIdle = useCallback(() => {
    setSelectedAlbum(null);
    setSelectedSubfolder(null);
  }, []);

  // Android Native Hardware Back Button handler
  useBackButton(
    useCallback(() => {
      // 1. If concealed terminal drawer is open, close it
      if (isVaultDrawerOpen) {
        setVaultDrawerOpen(false);
        return true;
      }

      // 2. If viewing a core archive folder, return to Public Overview
      if (selectedSubfolder !== null) {
        handleSelectIdle();
        return true;
      }

      return false;
    }, [isVaultDrawerOpen, selectedSubfolder, handleSelectIdle])
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

      {/* Option A: Concealed Left Terminal Drawer */}
      <VaultDrawer
        isOpen={isVaultDrawerOpen}
        onClose={() => setVaultDrawerOpen(false)}
        onSelectFolder={handleSelectDrawerFolder}
      />

      {/* TOP HEADER BAR: Zero-Clue Logo Trigger & Sync Indicator */}
      <header className="w-full px-5 sm:px-8 py-3.5 flex items-center justify-between border-b border-white/[0.06] bg-[#020408]/80 backdrop-blur-md z-30 shrink-0">
        <div className="flex items-center gap-3">
          <HeaderBrandLogo
            trackingClass="tracking-[0.22em] sm:tracking-[0.25em]"
            onTrigger={() => setVaultDrawerOpen((prev) => !prev)}
          />

          {selectedSubfolder && (
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase text-[#38bdf8] bg-[#38bdf8]/10 border border-[#38bdf8]/30">
              CORE // {selectedSubfolder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {selectedSubfolder && (
            <button
              type="button"
              onClick={handleSelectIdle}
              className="text-xs font-mono tracking-wider uppercase text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>RETURN</span>
            </button>
          )}
          <SyncStatusIndicator />
        </div>
      </header>

      {/* MAIN VIEWPORT STAGE */}
      {selectedSubfolder === null ? (
        /* ===================================================================== */
        /* DEFAULT FACADE: FULL-STAGE BOLLYWOOD WALLPAPERS & NEWS FEED           */
        /* ===================================================================== */
        <main
          aria-label="Bollywood Celebrity Archive Overview"
          className="flex-1 w-full h-[calc(100dvh-60px)] overflow-hidden p-4 sm:p-6 lg:p-8 flex flex-col min-w-0 z-10"
        >
          <CelebrityShowcase onOpenPhoto={onOpenPhoto} />
        </main>
      ) : (
        /* ===================================================================== */
        /* CORE ARCHIVE VIEW: FULL-WIDTH SCROLLABLE MEDIA GALLERY                */
        /* ===================================================================== */
        <main
          aria-label="Core Archive Gallery"
          className="flex-1 w-full h-[calc(100dvh-60px)] overflow-y-auto space-scrollbar p-5 sm:p-8 lg:p-12 z-10 flex flex-col bg-transparent"
        >
          <div className="flex items-center justify-between pb-3 mb-6 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="font-['Roboto_Condensed'] font-black text-base sm:text-lg tracking-[0.2em] uppercase text-[#38bdf8] drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]">
                {selectedSubfolder}
              </span>
              <span className="text-xs font-mono text-neutral-400">
                ({activeMediaList.length} files)
              </span>
            </div>

            <button
              type="button"
              onClick={handleSelectIdle}
              className="font-['Roboto_Condensed'] text-xs tracking-wider uppercase text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              ← RETURN TO OVERVIEW
            </button>
          </div>

          {activeMediaList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center my-auto min-h-[40vh] text-white/60">
              <p className="text-white/80 text-sm font-semibold tracking-wider uppercase mb-1">
                No Media Items in this Collection
              </p>
              <p className="text-white/40 text-xs">
                Tap the top SARWARCYOU logo to access other core archives.
              </p>
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
    </div>
  );
};

export default MonolithBarGate;
