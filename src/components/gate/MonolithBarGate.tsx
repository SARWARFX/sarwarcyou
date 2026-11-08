import React, { useState, useMemo, useEffect } from 'react';
import { Play } from 'lucide-react';
import type { StageMediaItem } from '../../types';
import { MIDNIGHT_OBSIDIAN_THEME } from './themeManager';
import { CinematicBackdropCanvas } from './CinematicBackdropCanvas';
import { SmartThumbnail } from '../common/SmartThumbnail';
import { SidebarAccordionNav, MAJOR_FOLDERS } from '../navigation/SidebarAccordionNav';
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
  // Navigation states: default to Photography > Images 2027
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>('PHOTOGRAPHY');
  const [selectedSubfolder, setSelectedSubfolder] = useState<string | null>('Images 2027');

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

  // URL deep link auto-open or default to Photography > Images 2027
  useEffect(() => {
    if (items.length === 0) return;
    const cleanTarget = initialAlbum ? initialAlbum.toLowerCase().replace(/[-_\s]+/g, '') : null;

    if (cleanTarget) {
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
    }

    // Default to Photography > Images 2027
    const photoNode = rootMap.get('Images');
    if (photoNode && photoNode.subfolders.size > 0) {
      setSelectedAlbum('PHOTOGRAPHY');
      const targetSub =
        Array.from(photoNode.subfolders.values()).find(
          (s) => s.name.toLowerCase().replace(/[-_\s]+/g, '') === 'images2027'
        ) || sortSubfolderNodesDescending(Array.from(photoNode.subfolders.values()))[0];

      if (targetSub) {
        setSelectedSubfolder(targetSub.name);
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

  // Subfolder select handler: highlights subfolder and renders media grid
  const handleSelectSubfolder = (albumKey: string, subfolderName: string) => {
    setSelectedAlbum(albumKey);
    setSelectedSubfolder(subfolderName);
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
      {/* 1. Seamless Midnight Obsidian Canvas (Continuous Background with Zero Splits) */}
      <CinematicBackdropCanvas theme={MIDNIGHT_OBSIDIAN_THEME} isPaused={isModalOpen} />

      {/* 2. Floating Major Folders & Subfolder Accordion (Zero Backgrounds, Zero Borders, Zero Headers) */}
      <div className="flex-shrink-0 w-full md:w-[240px] sm:md:w-[260px] lg:w-[280px] h-auto md:h-full flex flex-col justify-center p-6 sm:p-8 md:p-12 z-20 overflow-y-auto no-scrollbar bg-transparent border-0">
        <SidebarAccordionNav
          rootMap={rootMap}
          selectedAlbum={selectedAlbum}
          selectedSubfolder={selectedSubfolder}
          onSelectSubfolder={handleSelectSubfolder}
          className="w-full bg-transparent border-0"
        />
      </div>

      {/* 3. Pure Media Grid Canvas (100% Pure Media Thumbnails, Zero Captions, Zero Scrims, Zero Text) */}
      <main className="flex-1 h-full overflow-y-auto space-scrollbar p-6 sm:p-8 md:p-12 z-20 flex flex-col justify-center bg-transparent border-0">
        <div className="my-auto flex flex-col gap-6 w-full max-h-[88vh]">
          {/* Photos: 100% Pure Image Thumbnails */}
          {subfolderPhotos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 p-1">
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

          {/* Videos: 100% Pure Widescreen Thumbnails */}
          {subfolderVideos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 p-1">
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

          {/* Shorts: 100% Pure Vertical Thumbnails */}
          {subfolderShorts.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 p-1">
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
      </main>
    </div>
  );
};

export default MonolithBarGate;
