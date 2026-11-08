import React, { useState, useMemo, useEffect } from 'react';
import { Play } from 'lucide-react';
import type { StageMediaItem } from '../../types';
import { MIDNIGHT_OBSIDIAN_THEME } from './themeManager';
import { CinematicBackdropCanvas } from './CinematicBackdropCanvas';
import { SmartThumbnail } from '../common/SmartThumbnail';
import { SidebarAccordionNav, MAJOR_FOLDERS } from '../navigation/SidebarAccordionNav';
import { SessionTelemetryGraph } from '../telemetry/SessionTelemetryGraph';
import { isPhotoExtension } from '../../utils/mediaTypeDetector';
import { getMediaUrl, getThumbnailUrl, getImageUrl } from '../../utils/imageUrlResolver';
import { resolveStaticVideoThumbnail } from '../../utils/thumbnailResolver';
import { sanitizeMediaTitle } from '../../utils/titleSanitizer';
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

  // Active album configuration
  const activeAlbumConfig = useMemo(() => {
    if (!selectedAlbum) return null;
    return MAJOR_FOLDERS.find((h) => h.key === selectedAlbum) || null;
  }, [selectedAlbum]);

  // Categorize files within active subfolder
  const { subfolderPhotos, subfolderVideos, subfolderShorts } = useMemo(() => {
    if (!activeDirectoryNode) {
      return { subfolderPhotos: [], subfolderVideos: [], subfolderShorts: [] };
    }

    const photos: StageMediaItem[] = [];
    const videos: StageMediaItem[] = [];
    const shorts: StageMediaItem[] = [];

    const isShortDir =
      activeDirectoryNode.fullPath.toLowerCase().includes('short') ||
      selectedAlbum === 'SHORTS';

    for (const file of activeDirectoryNode.files) {
      const isPhoto =
        file.type === 'image' || isPhotoExtension(file.path || file.url || file.name || '');
      if (isPhoto) {
        photos.push(file);
      } else {
        const isShort =
          isShortDir ||
          file.mediaType === 'short' ||
          file.path?.toLowerCase().includes('short') ||
          file.url?.toLowerCase().includes('short');

        if (isShort) shorts.push(file);
        else videos.push(file);
      }
    }

    return {
      subfolderPhotos: sortMediaItemsDescending(photos),
      subfolderVideos: sortMediaItemsDescending(videos),
      subfolderShorts: sortMediaItemsDescending(shorts),
    };
  }, [activeDirectoryNode, selectedAlbum]);

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

  // Handler to open item from Latest Uploads
  const handleOpenLatestItem = (item: StageMediaItem) => {
    const isPhoto =
      item.type === 'image' || isPhotoExtension(item.path || item.url || item.name || '');
    if (isPhoto) {
      const photoPool = latestUploads.filter(
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
      item.category?.toLowerCase().includes('short');

    if (isShort) {
      const shortPool = latestUploads.filter(
        (f) =>
          f.mediaType === 'short' ||
          f.path?.toLowerCase().includes('short') ||
          f.url?.toLowerCase().includes('short') ||
          f.category?.toLowerCase().includes('short')
      );
      const shortIdx = shortPool.findIndex((s) => s.id === item.id || s.url === item.url);
      onOpenShort(item, shortPool, shortIdx >= 0 ? shortIdx : 0, item.category || 'Latest Shorts');
      return;
    }

    const videoPool = latestUploads.filter((f) => f.type === 'video' || (!f.type && !isPhoto && !isShort));
    onOpenVideo(item, videoPool.length > 0 ? videoPool : [item]);
  };

  // Subfolder select handler: highlights subfolder and renders media grid
  const handleSelectSubfolder = (albumKey: string, subfolderName: string) => {
    setSelectedAlbum(albumKey);
    setSelectedSubfolder(subfolderName);
  };

  // Idle reset handler: returns to Home Overview stage
  const handleSelectIdle = () => {
    setSelectedAlbum(null);
    setSelectedSubfolder(null);
  };

  return (
    <div
      className="relative w-full h-[100dvh] overflow-hidden select-none text-white font-['Google_Sans'] bg-[#03060a] flex flex-col md:flex-row"
      style={{
        isolation: 'isolate',
        background: 'radial-gradient(circle at 50% 35%, rgba(8, 20, 38, 0.6) 0%, #020408 85%)',
        backgroundColor: '#03060a',
      }}
    >
      {/* 1. Seamless Midnight Obsidian Canvas */}
      <CinematicBackdropCanvas theme={MIDNIGHT_OBSIDIAN_THEME} isPaused={isModalOpen} />

      {/* 2. Responsive Navigation (Desktop Left Sidebar + Mobile Compact Top Rails) */}
      <SidebarAccordionNav
        rootMap={rootMap}
        selectedAlbum={selectedAlbum}
        selectedSubfolder={selectedSubfolder}
        onSelectSubfolder={handleSelectSubfolder}
        onSelectIdle={handleSelectIdle}
      />

      {/* 3. Media Grid Recovery: Main Stage Container */}
      <main className="flex-1 w-full h-full overflow-y-auto space-scrollbar px-3 py-4 md:p-8 lg:p-12 z-20 flex flex-col bg-transparent border-0">
        {/* ========================================================================= */}
        {/* A. IDLE STAGE: LATEST UPLOADS (TOP) + SESSION TELEMETRY GRAPH (BOTTOM)   */}
        {/* ========================================================================= */}
        {selectedSubfolder === null ? (
          <div className="flex-1 flex flex-col justify-between animate-fade-in">
            {/* TOP SECTION: LATEST UPLOADS // CROSS-DIRECTORY */}
            <section aria-label="Latest Uploads" className="flex-1">
              <div className="border-b border-white/8 pb-2 mb-3 md:pb-3 md:mb-5 flex justify-between items-baseline">
                <h2 className="font-['Google_Sans'] font-bold text-xs md:text-sm tracking-[0.2em] uppercase text-white flex items-center gap-2">
                  <span>LATEST UPLOADS // CROSS-DIRECTORY</span>
                </h2>
                <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest hidden sm:inline">
                  {latestUploads.length} CURATED ASSETS
                </span>
              </div>

              {/* Responsive Media Grid: Full available vertical height on mobile (2 cols, gap-3.5) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 md:gap-4">
                {latestUploads.map((item, idx) => {
                  const isPhoto =
                    item.type === 'image' || isPhotoExtension(item.path || item.url || item.name || '');
                  const isShort =
                    !isPhoto &&
                    (item.mediaType === 'short' ||
                      item.path?.toLowerCase().includes('short') ||
                      item.url?.toLowerCase().includes('short') ||
                      item.category?.toLowerCase().includes('short'));

                  const badgeText = isPhoto ? 'PHOTO' : isShort ? 'SHORTS' : 'CLIP';
                  const aspectClass = !isPhoto && !isShort ? 'aspect-video' : 'aspect-[4/5]';

                  const cleanTitle = sanitizeMediaTitle(item.title || item.name || '', badgeText);
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
                        handleOpenLatestItem(item);
                      }}
                      style={{ animationDelay: `${Math.min(idx * 35, 280)}ms` }}
                      className="animate-card-enter will-change-transform transform-gpu group relative flex flex-col rounded-xl overflow-hidden cursor-pointer select-none border border-white/10 hover:border-[#38bdf8]/50 transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-2xl"
                    >
                      <SmartThumbnail
                        src={thumb}
                        alt={cleanTitle}
                        aspectClass={aspectClass}
                        containerClassName={`w-full ${aspectClass} rounded-xl border-0`}
                        fallbackTitle={cleanTitle}
                      >
                        {/* Top-Left Pill Badge */}
                        <div className="absolute top-2 left-2 z-20 pointer-events-none">
                          <span className="font-mono text-[9px] font-bold text-[#38bdf8] bg-black/75 backdrop-blur-md px-2 py-0.5 rounded border border-white/10 tracking-widest uppercase">
                            {badgeText}
                          </span>
                        </div>

                        {/* Center Play Indicator for Videos / Shorts on Hover */}
                        {!isPhoto && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                            <div className="w-9 h-9 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                            </div>
                          </div>
                        )}

                        {/* Card Scrim: Bottom gradient with title and metadata */}
                        <div className="absolute inset-x-0 bottom-0 pt-8 pb-2 px-2.5 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end pointer-events-none">
                          <span className="font-['Google_Sans'] text-xs font-medium text-slate-200 group-hover:text-white truncate line-clamp-1 drop-shadow-md">
                            {cleanTitle}
                          </span>
                        </div>
                      </SmartThumbnail>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* BOTTOM SECTION: SESSION TELEMETRY & 7-DAY TIME-SPENT GRAPH */}
            <section aria-label="Session Telemetry">
              <SessionTelemetryGraph />
            </section>
          </div>
        ) : (
          /* ========================================================================= */
          /* B. SUBFOLDER VIEW: FULL-CANVAS MEDIA GRID                                 */
          /* ========================================================================= */
          <div className="flex-1 flex flex-col animate-fade-in">
            {/* Subfolder Header Banner: Compact for mobile */}
            <div className="flex items-center justify-between pb-2 mb-3 md:pb-3.5 md:mb-6 border-b border-white/8">
              <h2 className="font-['Google_Sans'] font-bold text-xs sm:text-sm tracking-[0.2em] uppercase text-white flex items-center gap-2">
                <span className="text-slate-400 hidden sm:inline">{activeAlbumConfig?.label} //</span>
                <span className="text-[#38bdf8] drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]">
                  {activeDirectoryNode?.name}
                </span>
              </h2>

              <button
                type="button"
                onClick={handleSelectIdle}
                className="font-['Google_Sans'] text-[11px] md:text-xs tracking-wider uppercase text-slate-400 hover:text-white transition-colors cursor-pointer bg-transparent border-0 outline-none flex items-center gap-1.5"
              >
                ← RETURN TO OVERVIEW
              </button>
            </div>

            {/* Subfolder Media Grid: Full available vertical height on mobile (2 cols, gap-3.5) */}
            <div className="flex flex-col gap-6 w-full">
              {/* Photos */}
              {subfolderPhotos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 md:gap-4 p-0.5">
                  {subfolderPhotos.map((photo, idx) => {
                    const cleanTitle = sanitizeMediaTitle(photo.title || photo.name || '', selectedSubfolder || '');
                    const imageSrc =
                      (photo as any).thumbnail ||
                      (photo as any).src ||
                      photo.url ||
                      (photo as any).image ||
                      photo.path ||
                      '';
                    const resolvedPhotoSrc = getMediaUrl(imageSrc) || imageSrc;

                    return (
                      <div
                        key={photo.id || photo.url || idx}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPhoto(photo, subfolderPhotos, idx);
                        }}
                        style={{ animationDelay: `${Math.min(idx * 35, 280)}ms` }}
                        className="animate-card-enter will-change-transform transform-gpu relative aspect-[4/5] cursor-pointer overflow-hidden rounded-xl group transition-all duration-300 transform border-0 shadow-lg hover:shadow-2xl hover:scale-[1.03] hover:-translate-y-1"
                      >
                        <SmartThumbnail
                          src={resolvedPhotoSrc}
                          alt={cleanTitle}
                          aspectClass="aspect-[4/5]"
                          containerClassName="w-full h-full rounded-xl border-0"
                          className="group-hover:brightness-110 transition-all duration-300"
                          fallbackTitle={cleanTitle}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Videos */}
              {subfolderVideos.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 md:gap-4 p-0.5">
                  {subfolderVideos.map((video, idx) => {
                    const cleanTitle = sanitizeMediaTitle(video.title || video.name, selectedSubfolder || '');
                    const rawVideoFallback =
                      (video as any).thumbnail ||
                      (video as any).src ||
                      video.url ||
                      (video as any).image ||
                      video.path ||
                      '';
                    const thumb =
                      getThumbnailUrl(video) ||
                      resolveStaticVideoThumbnail(video) ||
                      getMediaUrl(rawVideoFallback) ||
                      rawVideoFallback;

                    return (
                      <div
                        key={video.id || video.url || idx}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenVideo(video, subfolderVideos);
                        }}
                        style={{ animationDelay: `${Math.min(idx * 35, 280)}ms` }}
                        className="animate-card-enter will-change-transform transform-gpu group relative aspect-video rounded-xl overflow-hidden cursor-pointer select-none transition-all duration-300 transform border-0 shadow-lg hover:shadow-2xl hover:scale-[1.03] hover:-translate-y-1"
                      >
                        <SmartThumbnail
                          src={thumb}
                          alt={cleanTitle}
                          aspectClass="aspect-video"
                          containerClassName="w-full h-full rounded-xl border-0"
                          fallbackTitle={cleanTitle}
                        >
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                            <div className="w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                              <Play className="w-4 h-4 fill-current ml-0.5" />
                            </div>
                          </div>
                        </SmartThumbnail>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Shorts */}
              {subfolderShorts.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 md:gap-4 p-0.5">
                  {subfolderShorts.map((short, idx) => {
                    const cleanTitle = sanitizeMediaTitle(short.title || short.name, selectedSubfolder || '');
                    const rawShortFallback =
                      (short as any).thumbnail ||
                      (short as any).src ||
                      short.url ||
                      (short as any).image ||
                      short.path ||
                      '';
                    const thumb =
                      getImageUrl(short) ||
                      getThumbnailUrl(short) ||
                      resolveStaticVideoThumbnail(short) ||
                      getMediaUrl(rawShortFallback) ||
                      rawShortFallback;

                    return (
                      <div
                        key={short.id || short.url || idx}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenShort(short, subfolderShorts, idx, selectedSubfolder || undefined);
                        }}
                        style={{ animationDelay: `${Math.min(idx * 35, 280)}ms` }}
                        className="animate-card-enter will-change-transform transform-gpu relative aspect-[4/5] cursor-pointer overflow-hidden rounded-xl group transition-all duration-300 transform border-0 shadow-lg hover:shadow-2xl hover:scale-[1.03] hover:-translate-y-1"
                      >
                        <SmartThumbnail
                          src={thumb}
                          alt={cleanTitle}
                          aspectClass="aspect-[4/5]"
                          containerClassName="w-full h-full rounded-xl border-0"
                          fallbackTitle={cleanTitle}
                        >
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                            <div className="w-9 h-9 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                            </div>
                          </div>
                        </SmartThumbnail>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MonolithBarGate;
