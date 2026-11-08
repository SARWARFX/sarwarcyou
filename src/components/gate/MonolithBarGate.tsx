import React, { useState, useMemo, useEffect, useRef } from 'react';
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

  // Horizontal track ref for horizontal sliding transitions
  const horizontalTrackRef = useRef<HTMLDivElement>(null);

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

  // Handler to open item from horizontal media cards rail
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

  // Subfolder select handler: loads category assets & automatically smooth-scrolls track to center first media card
  const handleSelectSubfolder = (albumKey: string, subfolderName: string) => {
    setSelectedAlbum(albumKey);
    setSelectedSubfolder(subfolderName);

    // Automatic smooth-scroll transition: reveals and centers first media card
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (horizontalTrackRef.current) {
          const scrollTarget = window.innerWidth >= 768 ? 340 : window.innerWidth;
          horizontalTrackRef.current.scrollTo({
            left: scrollTarget,
            behavior: 'smooth',
          });
        }
      }, 50);
    });
  };

  // Idle reset handler: returns to Screen 1
  const handleSelectIdle = () => {
    setSelectedAlbum(null);
    setSelectedSubfolder(null);
    if (horizontalTrackRef.current) {
      horizontalTrackRef.current.scrollTo({
        left: 0,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div
      ref={horizontalTrackRef}
      className="w-screen h-screen flex flex-row items-center overflow-x-auto overflow-y-hidden snap-x snap-mandatory no-scrollbar bg-transparent select-none text-white font-['Google_Sans']"
      style={{
        isolation: 'isolate',
        background: 'radial-gradient(circle at 50% 35%, rgba(8, 20, 38, 0.6) 0%, #020408 85%)',
        backgroundColor: '#03060a',
      }}
    >
      {/* Permanent Midnight Obsidian Backdrop Canvas */}
      <CinematicBackdropCanvas theme={MIDNIGHT_OBSIDIAN_THEME} isPaused={isModalOpen} />

      {/* ========================================================================= */}
      {/* SCREEN 1: MIDDLE-LEFT FOLDERS & ATTACHED BOTTOM GRAPH                    */}
      {/* ========================================================================= */}
      <section
        aria-label="Folder Navigation and Telemetry"
        className="flex-none w-screen md:w-[340px] h-screen relative flex flex-col justify-center pl-8 md:pl-14 snap-start shrink-0 z-20 select-none bg-transparent"
      >
        {/* Vertically Centered Folder Navigation */}
        <SidebarAccordionNav
          rootMap={rootMap}
          selectedAlbum={selectedAlbum}
          selectedSubfolder={selectedSubfolder}
          onSelectSubfolder={handleSelectSubfolder}
          onSelectIdle={handleSelectIdle}
        />

        {/* Telemetry Graph Dock: Anchored at the bottom inside Screen 1 (slides away with folders) */}
        <div className="absolute bottom-6 left-6 right-6 md:left-14 md:right-10 h-20 flex items-end">
          <SessionTelemetryGraph />
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SCREEN 2+: PROMINENT HORIZONTAL MEDIA CARDS                              */}
      {/* ========================================================================= */}
      <section
        aria-label="Media Rail"
        className="flex flex-row items-center h-screen px-4 md:px-10 gap-5 flex-nowrap shrink-0 z-20"
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
              className="flex-none w-[76vw] max-w-[380px] h-[72vh] max-h-[560px] aspect-[9/16] rounded-2xl overflow-hidden snap-center relative shadow-2xl border border-white/10 group cursor-pointer transition-transform duration-300 hover:scale-[1.02] bg-[#05080e] select-none"
            >
              <SmartThumbnail
                src={thumb}
                alt=""
                aspectClass="w-full h-full object-cover"
                containerClassName="w-full h-full rounded-2xl border-0 overflow-hidden"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              >
                {/* Center Play Indicator for Videos / Shorts on Hover */}
                {!isPhoto && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                    <div className="w-14 h-14 rounded-full bg-white/90 text-black flex items-center justify-center shadow-2xl">
                      <Play className="w-6 h-6 fill-current ml-0.5" />
                    </div>
                  </div>
                )}
              </SmartThumbnail>
            </div>
          );
        })}
      </section>
    </div>
  );
};

export default MonolithBarGate;
