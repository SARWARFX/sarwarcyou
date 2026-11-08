import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import type { StageMediaItem } from '../../types';
import { MIDNIGHT_OBSIDIAN_THEME } from './themeManager';
import { CinematicBackdropCanvas } from './CinematicBackdropCanvas';
import { useScrambleText } from './useScrambleText';
import { GhostApparition } from './GhostApparition';
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

const ALBUMS = [
  { key: 'CLIPS', rawName: 'Clips', label: 'CLIPS' },
  { key: 'SHORTS', rawName: 'Shorts', label: 'SHORTS' },
  { key: 'PHOTOGRAPHY', rawName: 'Images', label: 'PHOTOGRAPHY' },
  { key: 'REALTUBE', rawName: 'REALTube', label: 'REALTUBE' },
];

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

const ScrambledAlbumItem: React.FC<{
  label: string;
  isActive: boolean;
  isUnlocked: boolean;
  onClick: (e: React.MouseEvent | React.TouchEvent) => void;
}> = ({ label, isActive, isUnlocked, onClick }) => {
  const scrambled = useScrambleText(label, isUnlocked, 350);
  const lastActionTimeRef = useRef<number>(0);

  const handleAction = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const now = performance.now();
    if (now - lastActionTimeRef.current < 350) {
      return;
    }
    lastActionTimeRef.current = now;
    onClick(e);
  };

  return (
    <button
      type="button"
      onClick={handleAction}
      onTouchEnd={(e) => {
        e.stopPropagation();
      }}
      className={`text-left font-['Roboto',sans-serif] uppercase transition-all duration-300 cursor-pointer select-none border-0 outline-none p-0 bg-transparent flex items-center gap-3 drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] ${
        isActive
          ? 'text-white font-black tracking-[0.28em] text-2xl md:text-3xl scale-[1.03] origin-left'
          : 'text-neutral-400 font-bold tracking-[0.22em] text-xl md:text-2xl hover:text-white hover:tracking-[0.25em]'
      }`}
    >
      {isActive && (
        <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,1),0_0_20px_rgba(56,189,248,0.8)] animate-pulse" />
      )}
      {scrambled}
    </button>
  );
};

export const MonolithBarGate: React.FC<MonolithBarGateProps> = ({
  items,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
  initialAlbum,
  isModalOpen = false,
}) => {
  // Gate unlock & navigation states (Default homepage: Photography > Images 2027)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(true);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>('PHOTOGRAPHY');
  const [selectedSubfolder, setSelectedSubfolder] = useState<string | null>('Images 2027');

  const menuContainerRef = useRef<HTMLDivElement | null>(null);

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

  // URL deep link auto-unlock or default to Photography > Images 2027
  useEffect(() => {
    if (items.length === 0) return;
    const cleanTarget = initialAlbum ? initialAlbum.toLowerCase().replace(/[-_\s]+/g, '') : null;

    if (cleanTarget) {
      for (const album of ALBUMS) {
        const rootNode = rootMap.get(album.rawName);
        if (!rootNode) continue;

        if (album.rawName.toLowerCase().replace(/[-_\s]+/g, '') === cleanTarget) {
          const sortedSubs = sortSubfolderNodesDescending(Array.from(rootNode.subfolders.values()));
          setIsUnlocked(true);
          setSelectedAlbum(album.key);
          setSelectedSubfolder(sortedSubs[0]?.name || null);
          return;
        }

        for (const sub of rootNode.subfolders.values()) {
          if (sub.name.toLowerCase().replace(/[-_\s]+/g, '') === cleanTarget) {
            setIsUnlocked(true);
            setSelectedAlbum(album.key);
            setSelectedSubfolder(sub.name);
            return;
          }
        }
      }
    }

    // Default homepage: Photography > Images 2027
    const photoNode = rootMap.get('Images');
    if (photoNode && photoNode.subfolders.size > 0) {
      setIsUnlocked(true);
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

  // Album selection handler
  const handleSelectAlbum = (albumKey: string, rawName: string) => {
    setSelectedAlbum(albumKey);
    const rootNode = rootMap.get(rawName);
    if (rootNode && rootNode.subfolders.size > 0) {
      const sortedSubs = sortSubfolderNodesDescending(Array.from(rootNode.subfolders.values()));
      if (albumKey === 'PHOTOGRAPHY') {
        const img2027 = sortedSubs.find(
          (s) => s.name.toLowerCase().replace(/[-_\s]+/g, '') === 'images2027'
        );
        setSelectedSubfolder(img2027 ? img2027.name : (sortedSubs[0]?.name || null));
      } else {
        setSelectedSubfolder(sortedSubs[0]?.name || null);
      }
    } else {
      setSelectedSubfolder(null);
    }
  };

  const currentSubfolders = useMemo(() => {
    if (!selectedAlbum) return [];
    const activeAlbumConfig = ALBUMS.find((h) => h.key === selectedAlbum);
    if (!activeAlbumConfig) return [];
    const rootNode = rootMap.get(activeAlbumConfig.rawName);
    if (!rootNode) return [];
    return sortSubfolderNodesDescending(Array.from(rootNode.subfolders.values()));
  }, [selectedAlbum, rootMap]);

  const activeDirectoryNode = useMemo(() => {
    if (!selectedAlbum || !selectedSubfolder) return null;
    const activeAlbumConfig = ALBUMS.find((h) => h.key === selectedAlbum);
    if (!activeAlbumConfig) return null;
    const rootNode = rootMap.get(activeAlbumConfig.rawName);
    if (!rootNode) return null;
    return rootNode.subfolders.get(selectedSubfolder) || null;
  }, [selectedAlbum, selectedSubfolder, rootMap]);

  const { photoFiles, videoFiles, shortFiles } = useMemo(() => {
    if (!activeDirectoryNode) return { photoFiles: [], videoFiles: [], shortFiles: [] };

    const photos: StageMediaItem[] = [];
    const videos: StageMediaItem[] = [];
    const shorts: StageMediaItem[] = [];

    const isShortDir =
      activeDirectoryNode.fullPath.toLowerCase().includes('short') ||
      (selectedAlbum === 'SHORTS');

    for (const file of activeDirectoryNode.files) {
      const isPhoto = file.type === 'image' || isPhotoExtension(file.path || file.url || file.name || '');
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
      photoFiles: sortMediaItemsDescending(photos),
      videoFiles: sortMediaItemsDescending(videos),
      shortFiles: sortMediaItemsDescending(shorts),
    };
  }, [activeDirectoryNode, selectedAlbum]);

  // Global Escape key listener: resets to default Photography > Images 2027
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isModalOpen) {
        setSelectedAlbum('PHOTOGRAPHY');
        const photoNode = rootMap.get('Images');
        if (photoNode) {
          const img2027 = Array.from(photoNode.subfolders.values()).find(
            (s) => s.name.toLowerCase().replace(/[-_\s]+/g, '') === 'images2027'
          );
          setSelectedSubfolder(img2027 ? img2027.name : 'Images 2027');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, rootMap]);

  // Backdrop Click: keeps the open archive interactive
  const handleBackdropClick = () => {
    // Permanent open homepage
  };

  return (
    <div
      onClick={handleBackdropClick}
      className={`relative w-full h-[100dvh] overflow-hidden select-none text-white font-['Roboto',sans-serif] bg-[#03060a] ${
        isUnlocked ? 'cursor-default' : 'cursor-pointer'
      }`}
      style={{
        isolation: 'isolate',
        background: 'radial-gradient(circle at 50% 40%, rgba(8, 20, 38, 0.65) 0%, #020408 80%)',
        backgroundColor: '#03060a',
      }}
    >
      {/* 1. Permanent Midnight Obsidian Canvas with Drifting Cyan-White Mist */}
      <CinematicBackdropCanvas theme={MIDNIGHT_OBSIDIAN_THEME} isPaused={isModalOpen} />

      {/* 2. Central Ethereal Ghost Apparition (Tap to open 4 major album names) */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center justify-center">
        <GhostApparition
          isUnlocked={isUnlocked}
          onClick={(e) => {
            e.stopPropagation();
            setIsUnlocked(true);
          }}
        />
      </div>

      {/* 3. Fixed Required Signature at Bottom-Right: "SARWAR.CYOU" */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsUnlocked(true);
        }}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-10 z-20 cursor-pointer select-none font-['Roboto',sans-serif] font-bold text-xs sm:text-sm tracking-[0.28em] text-white uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] bg-transparent border-0 outline-none p-0"
      >
        SARWAR.CYOU
      </button>

      {/* 4. Progressive Navigation Stage (Desktop 3-Tier Cascade + Mobile Adaptive Drill-Down) */}
      <div
        ref={menuContainerRef}
        onClick={(e) => e.stopPropagation()}
        className={`w-full h-full select-none z-30 transition-all duration-500 ${
          isUnlocked
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* ========================================================= */}
        {/* DESKTOP 3-TIER HORIZONTAL CASCADE (md: and up)            */}
        {/* ========================================================= */}
        <div 
          onClick={(e) => e.stopPropagation()}
          className="hidden md:flex flex-row items-center w-full h-full p-6 sm:p-10 md:p-14 gap-6 sm:gap-8 md:gap-10 overflow-x-auto overflow-y-hidden no-scrollbar"
        >
          {/* TIER 1: 4 Major Album Names - Clean Floating Typography, No Dark Background */}
          <div className="flex-shrink-0 flex flex-col justify-center py-6 px-4">
            <div className="flex flex-col space-y-7">
              {ALBUMS.map((album) => (
                <ScrambledAlbumItem
                  key={album.key}
                  label={album.label}
                  isActive={selectedAlbum === album.key}
                  isUnlocked={isUnlocked}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectAlbum(album.key, album.rawName);
                  }}
                />
              ))}
            </div>
          </div>

          {/* TIER 2: Subfolders Column (Clean floating list, no dark box) */}
          {selectedAlbum && currentSubfolders.length > 0 && (
            <div className="flex-shrink-0 flex flex-col justify-center min-w-[170px] sm:min-w-[200px] md:min-w-[240px] max-w-[300px] animate-fade-in py-6">
              <div className="flex flex-col space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar pr-4">
                {currentSubfolders.map((subNode) => {
                  const isSubActive = selectedSubfolder === subNode.name;
                  return (
                    <button
                      key={subNode.name}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSubfolder(subNode.name);
                      }}
                      className={`text-left font-['Roboto',sans-serif] uppercase transition-all duration-200 cursor-pointer p-0 bg-transparent border-0 outline-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] ${
                        isSubActive
                          ? 'text-white font-bold tracking-wider text-base md:text-lg'
                          : 'text-neutral-400 font-medium tracking-wide text-base md:text-lg hover:text-white'
                      }`}
                    >
                      {subNode.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TIER 3: Edge-to-Edge Media Grid (Responsive Multi-Row Layout, Non-Clipping) */}
          {activeDirectoryNode && (
            <div 
              key={activeDirectoryNode.fullPath || `${selectedAlbum}-${selectedSubfolder}`}
              className="flex-1 min-w-[320px] max-w-[85vw] h-full overflow-y-auto space-scrollbar py-6 sm:py-10 pl-2 pr-4 sm:pr-8 flex flex-col justify-center"
            >
              <div className="my-auto flex flex-col gap-6 w-full max-h-[82vh]">
                {/* Photos: Multi-Row Responsive Grid */}
                {photoFiles.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 p-1">
                    {photoFiles.map((photo, idx) => (
                      <div
                        key={photo.id || idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPhoto(photo, photoFiles, idx);
                        }}
                        style={{ animationDelay: `${Math.min(idx * 35, 280)}ms` }}
                        className="animate-card-enter will-change-transform transform-gpu relative aspect-square cursor-pointer overflow-hidden rounded-xl group bg-neutral-900/40 backdrop-blur-sm transition-all duration-300 transform border-0 shadow-lg hover:shadow-2xl hover:scale-[1.03]"
                      >
                        <img
                          src={getMediaUrl(photo.url)}
                          alt={photo.title || photo.name || 'Photo'}
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) parent.classList.add('bg-neutral-900');
                          }}
                          className="w-full h-full object-cover rounded-xl transition-all duration-300 group-hover:brightness-110"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Videos: 16:9 Landscape Widescreen Cards Grid */}
                {videoFiles.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 sm:gap-5 p-1">
                    {videoFiles.map((video, idx) => {
                      const cleanTitle = sanitizeMediaTitle(video.title || video.name, activeDirectoryNode.name);
                      const thumb = getThumbnailUrl(video) || resolveStaticVideoThumbnail(video);
                      return (
                        <div
                          key={video.id || video.url}
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenVideo(video, videoFiles);
                          }}
                          style={{ animationDelay: `${Math.min(idx * 35, 280)}ms` }}
                          className="animate-card-enter will-change-transform transform-gpu group flex flex-col gap-2 cursor-pointer select-none text-left transition-all duration-300 transform hover:-translate-y-1"
                        >
                          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-neutral-900/60 backdrop-blur-sm border-0 shadow-lg group-hover:shadow-2xl transition-all duration-200">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt={cleanTitle}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-neutral-950">
                                <Play className="w-6 h-6 text-neutral-400" />
                              </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                              <div className="w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                              </div>
                            </div>
                          </div>
                          <span className="text-xs sm:text-sm font-['Roboto',sans-serif] uppercase line-clamp-2 leading-snug text-neutral-300 group-hover:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                            {cleanTitle}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Shorts: 9:16 Vertical Cards Grid */}
                {shortFiles.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 p-1">
                    {shortFiles.map((short, idx) => {
                      const cleanTitle = sanitizeMediaTitle(short.title || short.name, activeDirectoryNode.name);
                      const thumb = getImageUrl(short) || getThumbnailUrl(short) || resolveStaticVideoThumbnail(short);
                      return (
                        <div
                          key={short.id || short.url}
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenShort(short, shortFiles, idx, activeDirectoryNode.name);
                          }}
                          style={{ animationDelay: `${Math.min(idx * 35, 280)}ms` }}
                          className="animate-card-enter will-change-transform transform-gpu group flex flex-col gap-2 cursor-pointer select-none text-left transition-all duration-300 transform hover:-translate-y-1"
                        >
                          <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-neutral-900/60 backdrop-blur-sm border-0 shadow-lg group-hover:shadow-2xl transition-all duration-200">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt={cleanTitle}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-neutral-950">
                                <Play className="w-5 h-5 text-neutral-400" />
                              </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                              <div className="w-9 h-9 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                              </div>
                            </div>
                          </div>
                          <span className="text-xs sm:text-sm font-['Roboto',sans-serif] uppercase line-clamp-2 leading-snug text-neutral-300 group-hover:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                            {cleanTitle}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* MOBILE ADAPTIVE VIEW (< md, 418px mobile screens)         */}
        {/* ========================================================= */}
        <div 
          onClick={(e) => e.stopPropagation()}
          className="md:hidden flex flex-col w-full h-full pt-12 sm:pt-14 pb-3 sm:pb-4 px-3 sm:px-4 overflow-hidden min-w-0"
        >
          {!selectedAlbum ? (
            /* Mobile Step 1: Centered 4 Major Album Names - Pure Floating Text, No Dark Box */
            <div 
              onClick={(e) => e.stopPropagation()}
              className="flex-1 flex flex-col justify-center items-center"
            >
              <div 
                onClick={(e) => e.stopPropagation()}
                className="flex flex-col items-center space-y-7 sm:space-y-8 py-6 sm:py-8"
              >
                {ALBUMS.map((album) => (
                  <ScrambledAlbumItem
                    key={album.key}
                    label={album.label}
                    isActive={selectedAlbum === album.key}
                    isUnlocked={isUnlocked}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectAlbum(album.key, album.rawName);
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Mobile Step 2: Top Subfolder Switcher & Full-Width Media Grid */
            <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
              {/* Mobile Header Bar with Back Button & Subfolder Pills */}
              <div className="flex-shrink-0 flex items-center gap-2 pb-2.5 mb-2 border-b border-white/10 w-full min-w-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAlbum(null);
                    setSelectedSubfolder(null);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/25 text-white text-[11px] font-['Roboto',sans-serif] tracking-wider uppercase flex items-center gap-1 active:scale-95 transition-all flex-shrink-0 cursor-pointer"
                >
                  ← BACK
                </button>

                {/* Horizontal Scrollable Subfolder Selector */}
                <div 
                  className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 py-1 min-w-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {currentSubfolders.map((subNode) => {
                    const isSubActive = selectedSubfolder === subNode.name;
                    return (
                      <button
                        key={subNode.name}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSubfolder(subNode.name);
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-['Roboto',sans-serif] uppercase whitespace-nowrap transition-all duration-200 flex-shrink-0 cursor-pointer ${
                          isSubActive
                            ? 'bg-white/20 text-white font-bold shadow-md'
                            : 'bg-black/40 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {subNode.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Full-Width Mobile Media Stage */}
              <div 
                key={activeDirectoryNode ? (activeDirectoryNode.fullPath || `${selectedAlbum}-${selectedSubfolder}`) : 'empty'}
                className="flex-1 overflow-y-auto space-scrollbar py-1"
              >
                {activeDirectoryNode && (
                  <div className="flex flex-col gap-4 sm:gap-5 pb-8">
                    {/* Photos Grid */}
                    {photoFiles.length > 0 && (
                      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                        {photoFiles.map((photo, idx) => (
                          <div
                            key={photo.id || idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenPhoto(photo, photoFiles, idx);
                            }}
                            style={{ animationDelay: `${Math.min(idx * 35, 280)}ms` }}
                            className="animate-card-enter will-change-transform transform-gpu relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-neutral-900/50 backdrop-blur-sm border-0 shadow-md active:scale-95 transition-transform"
                          >
                            <img
                              src={getMediaUrl(photo.url)}
                              alt={photo.title || photo.name || 'Photo'}
                              loading="lazy"
                              decoding="async"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const parent = e.currentTarget.parentElement;
                                if (parent) parent.classList.add('bg-neutral-900');
                              }}
                              className="w-full h-full object-cover rounded-xl"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Videos Grid */}
                    {videoFiles.length > 0 && (
                      <div className="grid grid-cols-1 gap-3.5 sm:gap-4">
                        {videoFiles.map((video, idx) => {
                          const cleanTitle = sanitizeMediaTitle(video.title || video.name, activeDirectoryNode.name);
                          const thumb = getThumbnailUrl(video) || resolveStaticVideoThumbnail(video);
                          return (
                            <div
                              key={video.id || video.url}
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenVideo(video, videoFiles);
                              }}
                              style={{ animationDelay: `${Math.min(idx * 35, 280)}ms` }}
                              className="animate-card-enter will-change-transform transform-gpu group flex flex-col gap-1.5 cursor-pointer select-none text-left active:scale-[0.98] transition-transform"
                            >
                              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-neutral-900/60 backdrop-blur-sm border-0 shadow-lg">
                                {thumb ? (
                                  <img
                                    src={thumb}
                                    alt={cleanTitle}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover object-center"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-neutral-950">
                                    <Play className="w-6 h-6 text-neutral-400" />
                                  </div>
                                )}
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                                    <Play className="w-4 h-4 fill-current ml-0.5" />
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs font-['Roboto',sans-serif] uppercase line-clamp-2 leading-snug text-neutral-300">
                                {cleanTitle}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Shorts Grid */}
                    {shortFiles.length > 0 && (
                      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                        {shortFiles.map((short, idx) => {
                          const cleanTitle = sanitizeMediaTitle(short.title || short.name, activeDirectoryNode.name);
                          const thumb = getImageUrl(short) || getThumbnailUrl(short) || resolveStaticVideoThumbnail(short);
                          return (
                            <div
                              key={short.id || short.url}
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenShort(short, shortFiles, idx, activeDirectoryNode.name);
                              }}
                              style={{ animationDelay: `${Math.min(idx * 35, 280)}ms` }}
                              className="animate-card-enter will-change-transform transform-gpu group flex flex-col gap-1.5 cursor-pointer select-none text-left active:scale-[0.98] transition-transform"
                            >
                              <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-neutral-900/60 backdrop-blur-sm border-0 shadow-lg">
                                {thumb ? (
                                  <img
                                    src={thumb}
                                    alt={cleanTitle}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover object-center"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-neutral-950">
                                    <Play className="w-5 h-5 text-neutral-400" />
                                  </div>
                                )}
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-9 h-9 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs font-['Roboto',sans-serif] uppercase line-clamp-2 leading-snug text-neutral-300">
                                {cleanTitle}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonolithBarGate;