import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Play, ArrowLeft } from 'lucide-react';
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

export interface MonolithBarGateProps {
  items: StageMediaItem[];
  onOpenPhoto: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo: (item: StageMediaItem, playlist: StageMediaItem[]) => void;
  onOpenShort: (item: StageMediaItem, shorts: StageMediaItem[], index: number, folderName?: string) => void;
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

  // Active media assets list: loads selected subfolder files, or latest uploads when idle
  const activeMediaList = useMemo(() => {
    if (selectedSubfolder && activeDirectoryNode) {
      return activeDirectoryNode.files;
    }
    return latestUploads;
  }, [selectedSubfolder, activeDirectoryNode, latestUploads]);

  // Handler to open item from media grid
  const handleOpenItem = (item: StageMediaItem, _idx: number) => {
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

  return (
    <div
      className="w-screen h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-row bg-[#020408] relative select-none font-['Google_Sans'] text-white"
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
        {/* LEFT MIDDLE NAVIGATION (DESKTOP) */}
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

        {/* DESKTOP RIGHT CANVAS: HOME STAGE OR SUBFOLDER MEDIA GALLERY */}
        {selectedSubfolder === null ? (
          /* ===================================================================== */
          /* DESKTOP HOME STAGE: LOCKED VIEWPORT (100vw, 100vh), ZERO SCROLL       */
          /* ===================================================================== */
          <main
            aria-label="Desktop Home Overview"
            className="hidden md:flex flex-1 h-screen py-10 pr-12 pl-6 flex-col justify-between overflow-hidden z-10"
          >
            {/* UPPER ROW (5 LATEST UPLOADS) */}
            <div className="flex-1 min-h-0 flex items-center w-full overflow-hidden">
              <div className="w-full grid grid-cols-5 gap-5 items-center max-h-[calc(100vh-230px)]">
                {latestUploads.slice(0, 5).map((item, idx) => {
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
                      className="relative rounded-2xl overflow-hidden aspect-[4/5] h-full max-h-[500px] bg-white/[0.02] border border-white/10 shadow-2xl transition-transform hover:-translate-y-1 hover:border-[#38bdf8]/40 cursor-pointer select-none group"
                    >
                      <SmartThumbnail
                        src={thumb}
                        alt=""
                        aspectClass="aspect-[4/5]"
                        containerClassName="w-full h-full rounded-2xl border-0 overflow-hidden"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      >
                        {!isPhoto && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                            <div className="w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                              <Play className="w-4 h-4 fill-current ml-0.5" />
                            </div>
                          </div>
                        )}
                      </SmartThumbnail>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* LOWER DOCK (7-DAY TELEMETRY GRAPH) */}
            <SessionTelemetryGraph variant="dock" />
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
              <span className="font-['Google_Sans'] font-bold text-sm tracking-[0.2em] uppercase text-[#38bdf8] drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]">
                {selectedSubfolder}
              </span>
              <button
                type="button"
                onClick={handleSelectIdle}
                className="font-['Google_Sans'] text-xs tracking-wider uppercase text-slate-400 hover:text-white transition-colors cursor-pointer bg-transparent border-0 outline-none flex items-center gap-1.5"
              >
                ← RETURN TO OVERVIEW
              </button>
            </div>

            {/* Subfolder Media Grid */}
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
                    </SmartThumbnail>
                  </div>
                );
              })}
            </div>
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
          className="w-screen h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col justify-between relative bg-[#020408] flex-none snap-start shrink-0 z-30 pointer-events-auto"
        >
          {/* Middle-Left Folders: Vertically centered */}
          <div className="flex-1 flex flex-col justify-center pl-8 md:pl-12 gap-7 z-20 select-none relative pointer-events-auto">
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
          </div>

          {/* Full-Width Bottom Graph Dock */}
          <div className="w-full px-5 pb-5 pt-1 flex flex-col justify-end flex-shrink-0 z-10 relative pointer-events-auto">
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
          {/* Top Bar: Clean bare arrow icon button (←) with NO "FOLDERS" text & active subfolder name tag */}
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
              <span className="font-['Google_Sans'] text-xs font-bold text-[#38bdf8] uppercase tracking-wider truncate max-w-[200px]">
                {selectedSubfolder}
              </span>
            )}
          </div>

          {/* Media Grid: Takes full 100vw width */}
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
                  </SmartThumbnail>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MonolithBarGate;
