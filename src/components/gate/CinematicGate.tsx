import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import type { StageMediaItem } from '../../types';
import { getRandomCinematicTheme, type CinematicTheme } from './themeManager';
import { CinematicBackdropCanvas } from './CinematicBackdropCanvas';
import { useScrambleText } from './useScrambleText';
import { isPhotoExtension } from '../../utils/mediaTypeDetector';
import { getMediaUrl, getThumbnailUrl, getImageUrl } from '../../utils/imageUrlResolver';
import { resolveStaticVideoThumbnail } from '../../utils/thumbnailResolver';
import { sanitizeMediaTitle } from '../../utils/titleSanitizer';
import { sortMediaItemsDescending } from '../../utils/albumExtractor';
import { sortSubfolderNodesDescending, type DirectoryNode } from '../DeepSpaceTreeExplorer';

export interface CinematicGateProps {
  items: StageMediaItem[];
  onOpenPhoto: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo: (item: StageMediaItem, playlist: StageMediaItem[]) => void;
  onOpenShort: (item: StageMediaItem, shorts: StageMediaItem[], index: number, folderName?: string) => void;
  initialAlbum?: string;
  isModalOpen?: boolean;
}

const HUBS = [
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

const ScrambledHubItem: React.FC<{
  label: string;
  isActive: boolean;
  isUnlocked: boolean;
  onClick: (e: React.MouseEvent) => void;
}> = ({ label, isActive, isUnlocked, onClick }) => {
  const scrambled = useScrambleText(label, isUnlocked, 380);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left font-['Roboto',sans-serif] uppercase transition-all duration-200 cursor-pointer select-none border-0 outline-none p-0 bg-transparent drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] ${
        isActive
          ? 'text-white font-bold tracking-[0.25em] text-xl md:text-2xl scale-[1.02] origin-left'
          : 'text-neutral-400 font-medium tracking-[0.2em] text-lg hover:text-white'
      }`}
    >
      {scrambled}
    </button>
  );
};

export const CinematicGate: React.FC<CinematicGateProps> = ({
  items,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
  initialAlbum,
  isModalOpen = false,
}) => {
  // Rotate dynamic cinematic theme per session / page reload
  const [theme] = useState<CinematicTheme>(() => getRandomCinematicTheme());

  // Gate unlock state: false = cryptic poster & specter; true = decrypted menu & cascade
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);

  // Active Category Key: 'CLIPS' | 'SHORTS' | 'PHOTOGRAPHY' | 'REALTUBE'
  const [selectedHub, setSelectedHub] = useState<string | null>(null);

  // Active Subfolder Name within selected Hub
  const [selectedSubfolder, setSelectedSubfolder] = useState<string | null>(null);

  // Container refs for backdrop auto-conceal
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  // Build root directory structure
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

  // Deep-linking: If initialAlbum is present in URL, auto-unlock into that album
  useEffect(() => {
    if (!initialAlbum || items.length === 0) return;
    const cleanTarget = initialAlbum.toLowerCase().replace(/[-_\s]+/g, '');

    for (const hub of HUBS) {
      const rootNode = rootMap.get(hub.rawName);
      if (!rootNode) continue;

      if (hub.rawName.toLowerCase().replace(/[-_\s]+/g, '') === cleanTarget) {
        const sortedSubs = sortSubfolderNodesDescending(Array.from(rootNode.subfolders.values()));
        setIsUnlocked(true);
        setSelectedHub(hub.key);
        setSelectedSubfolder(sortedSubs[0]?.name || null);
        return;
      }

      for (const sub of rootNode.subfolders.values()) {
        if (sub.name.toLowerCase().replace(/[-_\s]+/g, '') === cleanTarget) {
          setIsUnlocked(true);
          setSelectedHub(hub.key);
          setSelectedSubfolder(sub.name);
          return;
        }
      }
    }
  }, [initialAlbum, items.length, rootMap]);

  // Handle Hub selection -> auto-selects first subfolder
  const handleSelectHub = (hubKey: string, rawName: string) => {
    if (selectedHub === hubKey) {
      // Toggle off to root hubs
      setSelectedHub(null);
      setSelectedSubfolder(null);
      return;
    }

    setSelectedHub(hubKey);
    const rootNode = rootMap.get(rawName);
    if (rootNode && rootNode.subfolders.size > 0) {
      const sortedSubs = sortSubfolderNodesDescending(Array.from(rootNode.subfolders.values()));
      setSelectedSubfolder(sortedSubs[0]?.name || null);
    } else {
      setSelectedSubfolder(null);
    }
  };

  // Get active subfolders list for currently selected Hub
  const currentSubfolders = useMemo(() => {
    if (!selectedHub) return [];
    const activeHubConfig = HUBS.find((h) => h.key === selectedHub);
    if (!activeHubConfig) return [];
    const rootNode = rootMap.get(activeHubConfig.rawName);
    if (!rootNode) return [];
    return sortSubfolderNodesDescending(Array.from(rootNode.subfolders.values()));
  }, [selectedHub, rootMap]);

  // Get active directory node
  const activeDirectoryNode = useMemo(() => {
    if (!selectedHub || !selectedSubfolder) return null;
    const activeHubConfig = HUBS.find((h) => h.key === selectedHub);
    if (!activeHubConfig) return null;
    const rootNode = rootMap.get(activeHubConfig.rawName);
    if (!rootNode) return null;
    return rootNode.subfolders.get(selectedSubfolder) || null;
  }, [selectedHub, selectedSubfolder, rootMap]);

  // Partition files in active leaf directory
  const { photoFiles, videoFiles, shortFiles } = useMemo(() => {
    if (!activeDirectoryNode) return { photoFiles: [], videoFiles: [], shortFiles: [] };

    const photos: StageMediaItem[] = [];
    const videos: StageMediaItem[] = [];
    const shorts: StageMediaItem[] = [];

    const isShortDir =
      activeDirectoryNode.fullPath.toLowerCase().includes('short') ||
      (selectedHub === 'SHORTS');

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
  }, [activeDirectoryNode, selectedHub]);

  // Escape key global listener for auto-conceal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isUnlocked && !isModalOpen) {
        if (e.cancelable) e.preventDefault();
        setIsUnlocked(false);
        setSelectedHub(null);
        setSelectedSubfolder(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUnlocked, isModalOpen]);

  // Backdrop Auto-Conceal (Re-encrypt): clicking the empty canvas conceals the UI
  const handleBackdropClick = (e: React.MouseEvent) => {
    // If a modal (video, shorts, lightbox) is open, ignore
    if (isModalOpen) return;

    // Check if click target is outside the menus & cards
    if (menuContainerRef.current && menuContainerRef.current.contains(e.target as Node)) {
      return;
    }

    // Auto-conceal back into cryptic ghost gate
    if (isUnlocked) {
      setIsUnlocked(false);
      setSelectedHub(null);
      setSelectedSubfolder(null);
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="relative w-full h-[100dvh] overflow-hidden select-none text-white font-['Roboto',sans-serif]"
      style={{ isolation: 'isolate' }}
    >
      {/* 1. Dynamic Rotating Atmospheric Canvas Backdrop with Modal Pause */}
      <CinematicBackdropCanvas theme={theme} isPaused={isModalOpen} />

      {/* 2. Floating Vaporous Mist Specter / Shadow Apparition (Center Stage) */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          setIsUnlocked(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            setIsUnlocked(true);
          }
        }}
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 select-none z-10 flex flex-col items-center justify-center outline-none focus:outline-none ${
          isUnlocked
            ? 'opacity-10 pointer-events-none scale-90 blur-sm'
            : 'opacity-85 hover:opacity-100 cursor-pointer pointer-events-auto scale-100'
        }`}
        style={{
          animation: 'specterVaporFloat 7s ease-in-out infinite, specterVaporBreathe 5s ease-in-out infinite',
        }}
        title="Tap to decrypt"
        aria-label="Enigmatic entity gate"
        role="button"
        tabIndex={0}
      >
        {/* Organic Volumetric Mist & Shadow Smoke Entity */}
        <div className="relative w-56 sm:w-72 md:w-84 aspect-[3/4] flex items-center justify-center pointer-events-none">
          {/* Ethereal dark ambient aura matching active theme */}
          <div
            className="absolute inset-0 rounded-full blur-3xl opacity-50 transition-opacity duration-700"
            style={{
              background:
                theme.id === 'wick-noir'
                  ? 'radial-gradient(circle, rgba(230,165,55,0.22) 0%, rgba(30,20,5,0.12) 50%, rgba(0,0,0,0) 75%)'
                  : theme.id === 'dark-shadows'
                  ? 'radial-gradient(circle, rgba(50,95,190,0.25) 0%, rgba(10,20,50,0.15) 50%, rgba(0,0,0,0) 75%)'
                  : 'radial-gradient(circle, rgba(135,155,175,0.22) 0%, rgba(25,35,45,0.12) 50%, rgba(0,0,0,0) 75%)',
            }}
          />

          <svg
            viewBox="0 0 240 320"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full drop-shadow-[0_20px_45px_rgba(0,0,0,0.98)]"
          >
            <defs>
              {/* Ethereal Smoke Fluid Distortion Filter */}
              <filter id="organicMist" x="-30%" y="-30%" width="160%" height="160%">
                <feTurbulence type="fractalNoise" baseFrequency="0.015 0.02" numOctaves="3" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="22" xChannelSelector="R" yChannelSelector="G" result="displaced" />
                <feGaussianBlur in="displaced" stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" opacity="0.6" />
                </feMerge>
              </filter>

              {/* Radial Vapor Core Gradient */}
              <radialGradient id="vaporCore" cx="50%" cy="40%" r="55%">
                <stop offset="0%" stopColor="#141720" stopOpacity="0.95" />
                <stop offset="35%" stopColor="#0b0e14" stopOpacity="0.85" />
                <stop offset="70%" stopColor="#05070a" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#020304" stopOpacity="0" />
              </radialGradient>

              {/* Outer Ethereal Tendril Gradient */}
              <linearGradient id="tendrilGrad" x1="120" y1="30" x2="120" y2="300" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#1c212c" stopOpacity="0.8" />
                <stop offset="40%" stopColor="#0d1017" stopOpacity="0.7" />
                <stop offset="75%" stopColor="#05070a" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Layer 1: Diffuse Outer Shadow Vapor */}
            <path
              d="M120 40 C70 45 40 85 35 145 C30 205 15 260 25 295 C55 280 85 290 120 275 C155 290 185 280 215 295 C225 260 210 205 205 145 C200 85 170 45 120 40 Z"
              fill="url(#tendrilGrad)"
              filter="url(#organicMist)"
              opacity="0.85"
            />

            {/* Layer 2: Deep Volumetric Mist Core */}
            <path
              d="M120 55 C85 58 65 95 60 145 C55 195 45 240 55 270 C80 260 100 268 120 258 C140 268 160 260 185 270 C195 240 185 195 180 145 C175 95 155 58 120 55 Z"
              fill="url(#vaporCore)"
              filter="url(#organicMist)"
            />

            {/* Layer 3: Secondary Ascending Smoke Wisps */}
            <path
              d="M120 70 C100 70 85 98 82 135 C78 172 72 205 80 230 C95 224 108 228 120 222 C132 228 145 224 160 230 C168 205 162 172 158 135 C155 98 140 70 120 70 Z"
              fill="url(#vaporCore)"
              opacity="0.9"
            />
          </svg>
        </div>
      </div>

      {/* 3. Progressive Navigation Stage (Desktop 3-Tier Cascade + Mobile Adaptive Drill-Down) */}
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
        <div className="hidden md:flex flex-row items-center w-full h-full p-6 sm:p-10 md:p-14 gap-6 sm:gap-8 md:gap-10 overflow-x-auto overflow-y-hidden no-scrollbar">
          {/* TIER 1: Left-Middle Navigation Menu (4 Major Hubs) */}
          <div className="flex-shrink-0 flex flex-col justify-center">
            <div className="bg-black/40 backdrop-blur-2xl rounded-2xl p-6 md:p-8 flex flex-col space-y-6 shadow-2xl">
              {HUBS.map((hub) => (
                <ScrambledHubItem
                  key={hub.key}
                  label={hub.label}
                  isActive={selectedHub === hub.key}
                  isUnlocked={isUnlocked}
                  onClick={() => handleSelectHub(hub.key, hub.rawName)}
                />
              ))}
            </div>
          </div>

          {/* TIER 2: Subfolders Column (Smoothly slides open on choosing major hub) */}
          {selectedHub && currentSubfolders.length > 0 && (
            <div className="flex-shrink-0 flex flex-col justify-center min-w-[170px] sm:min-w-[200px] md:min-w-[230px] max-w-[290px] animate-fade-in">
              <div className="bg-black/40 backdrop-blur-2xl rounded-2xl p-5 md:p-6 flex flex-col space-y-3.5 max-h-[75vh] overflow-y-auto no-scrollbar shadow-2xl">
                {currentSubfolders.map((subNode) => {
                  const isSubActive = selectedSubfolder === subNode.name;
                  return (
                    <button
                      key={subNode.name}
                      type="button"
                      onClick={() => setSelectedSubfolder(subNode.name)}
                      className={`text-left font-['Roboto',sans-serif] uppercase transition-all duration-200 cursor-pointer p-0 bg-transparent border-0 outline-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ${
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
            <div className="flex-1 min-w-[320px] max-w-[85vw] h-full overflow-y-auto space-scrollbar py-6 sm:py-10 pl-2 pr-4 sm:pr-8 flex flex-col justify-center">
              <div className="my-auto flex flex-col gap-6 w-full max-h-[82vh]">
                {/* Photos: Multi-Row Responsive Grid */}
                {photoFiles.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 p-1">
                    {photoFiles.map((photo, idx) => (
                      <div
                        key={photo.id || idx}
                        onClick={() => onOpenPhoto(photo, photoFiles, idx)}
                        className="relative aspect-square cursor-pointer overflow-hidden rounded-xl group bg-neutral-900/40 backdrop-blur-sm transition-all duration-300 transform border-0 shadow-lg hover:shadow-2xl hover:scale-[1.03]"
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
                    {videoFiles.map((video) => {
                      const cleanTitle = sanitizeMediaTitle(video.title || video.name, activeDirectoryNode.name);
                      const thumb = getThumbnailUrl(video) || resolveStaticVideoThumbnail(video);
                      return (
                        <div
                          key={video.id || video.url}
                          role="button"
                          tabIndex={0}
                          onClick={() => onOpenVideo(video, videoFiles)}
                          className="group flex flex-col gap-2 cursor-pointer select-none text-left transition-all duration-300 transform hover:-translate-y-1"
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
                          onClick={() => onOpenShort(short, shortFiles, idx, activeDirectoryNode.name)}
                          className="group flex flex-col gap-2 cursor-pointer select-none text-left transition-all duration-300 transform hover:-translate-y-1"
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
        <div className="md:hidden flex flex-col w-full h-full pt-14 pb-4 px-4 overflow-hidden">
          {!selectedHub ? (
            /* Mobile Step 1: Centered 4 Major Hubs */
            <div className="flex-1 flex flex-col justify-center items-center">
              <div className="w-full max-w-xs bg-black/50 backdrop-blur-2xl rounded-2xl p-6 flex flex-col space-y-6 shadow-2xl">
                <div className="text-[10px] font-['JetBrains_Mono',monospace] tracking-[0.25em] text-neutral-400 uppercase pb-2 border-b border-white/10 text-center">
                  SELECT HUB
                </div>
                {HUBS.map((hub) => (
                  <ScrambledHubItem
                    key={hub.key}
                    label={hub.label}
                    isActive={selectedHub === hub.key}
                    isUnlocked={isUnlocked}
                    onClick={() => handleSelectHub(hub.key, hub.rawName)}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Mobile Step 2: Top Subfolder Switcher & Full-Width Media Grid */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Mobile Header Bar with Back Button & Subfolder Pills */}
              <div className="flex-shrink-0 flex items-center gap-2 pb-3 mb-2 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHub(null);
                    setSelectedSubfolder(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-['JetBrains_Mono',monospace] tracking-wider uppercase flex items-center gap-1 active:scale-95 transition-transform flex-shrink-0"
                >
                  ← HUBS
                </button>

                {/* Horizontal Scrollable Subfolder Selector */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 py-1">
                  {currentSubfolders.map((subNode) => {
                    const isSubActive = selectedSubfolder === subNode.name;
                    return (
                      <button
                        key={subNode.name}
                        type="button"
                        onClick={() => setSelectedSubfolder(subNode.name)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-['Roboto',sans-serif] uppercase whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
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
              <div className="flex-1 overflow-y-auto space-scrollbar py-2">
                {activeDirectoryNode && (
                  <div className="flex flex-col gap-5 pb-8">
                    {/* Photos Grid */}
                    {photoFiles.length > 0 && (
                      <div className="grid grid-cols-2 gap-3">
                        {photoFiles.map((photo, idx) => (
                          <div
                            key={photo.id || idx}
                            onClick={() => onOpenPhoto(photo, photoFiles, idx)}
                            className="relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-neutral-900/50 backdrop-blur-sm border-0 shadow-md active:scale-95 transition-transform"
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
                      <div className="grid grid-cols-1 gap-4">
                        {videoFiles.map((video) => {
                          const cleanTitle = sanitizeMediaTitle(video.title || video.name, activeDirectoryNode.name);
                          const thumb = getThumbnailUrl(video) || resolveStaticVideoThumbnail(video);
                          return (
                            <div
                              key={video.id || video.url}
                              role="button"
                              tabIndex={0}
                              onClick={() => onOpenVideo(video, videoFiles)}
                              className="group flex flex-col gap-1.5 cursor-pointer select-none text-left active:scale-[0.98] transition-transform"
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
                      <div className="grid grid-cols-2 gap-3">
                        {shortFiles.map((short, idx) => {
                          const cleanTitle = sanitizeMediaTitle(short.title || short.name, activeDirectoryNode.name);
                          const thumb = getImageUrl(short) || getThumbnailUrl(short) || resolveStaticVideoThumbnail(short);
                          return (
                            <div
                              key={short.id || short.url}
                              role="button"
                              tabIndex={0}
                              onClick={() => onOpenShort(short, shortFiles, idx, activeDirectoryNode.name)}
                              className="group flex flex-col gap-1.5 cursor-pointer select-none text-left active:scale-[0.98] transition-transform"
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

      {/* Floating Organic Mist Keyframe Animations */}
      <style>{`
        @keyframes specterVaporFloat {
          0%, 100% {
            transform: translate(-50%, -50%) translateY(0);
          }
          50% {
            transform: translate(-50%, -50%) translateY(-15px);
          }
        }
        @keyframes specterVaporBreathe {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1) scaleX(0.97) scaleY(1.03);
            filter: drop-shadow(0 0 20px rgba(0,0,0,0.9));
          }
          50% {
            transform: translate(-50%, -50%) scale(1.04) scaleX(1.03) scaleY(0.97);
            filter: drop-shadow(0 0 45px rgba(255,255,255,0.06));
          }
        }
      `}</style>
    </div>
  );
};

export default CinematicGate;
