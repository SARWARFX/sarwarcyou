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

export interface FrequencyGateProps {
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
      className={`text-left font-['Roboto',sans-serif] uppercase transition-all duration-200 cursor-pointer select-none border-0 outline-none p-0 bg-transparent flex items-center gap-2.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] ${
        isActive
          ? 'text-white font-bold tracking-[0.25em] text-xl md:text-2xl scale-[1.02] origin-left'
          : 'text-neutral-400 font-medium tracking-[0.2em] text-lg hover:text-white'
      }`}
    >
      {isActive && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
      )}
      {scrambled}
    </button>
  );
};

export const FrequencyGate: React.FC<FrequencyGateProps> = ({
  items,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
  initialAlbum,
  isModalOpen = false,
}) => {
  // Rotate dynamic cinematic theme per session / page reload
  const [theme] = useState<CinematicTheme>(() => getRandomCinematicTheme());

  // Gate unlock state: false = classified frequency telemetry; true = decrypted menu & cascade
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);

  // Active Category Key: 'CLIPS' | 'SHORTS' | 'PHOTOGRAPHY' | 'REALTUBE'
  const [selectedHub, setSelectedHub] = useState<string | null>(null);

  // Active Subfolder Name within selected Hub
  const [selectedSubfolder, setSelectedSubfolder] = useState<string | null>(null);

  // Frequency readout value (e.g. 104.7 MHz)
  const [frequency] = useState<string>('104.7 MHz');

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

  // Global Escape key listener for auto-conceal (re-encrypt)
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

  // Backdrop Auto-Conceal: clicking empty canvas resets to frequency gate
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (isModalOpen) return;
    if (menuContainerRef.current && menuContainerRef.current.contains(e.target as Node)) {
      return;
    }
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
      {/* 1. Deep Atmospheric Backdrop Canvas */}
      <CinematicBackdropCanvas theme={theme} isPaused={isModalOpen} />

      {/* 2. Top-Left Archival Telemetry Stamp */}
      <div className="fixed top-6 left-6 md:top-8 md:left-10 z-20 pointer-events-none select-none font-['JetBrains_Mono',monospace]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[10px] sm:text-xs font-semibold tracking-[0.2em] text-emerald-400/90 uppercase">
            TRANSMISSION // ENCRYPTED
          </span>
        </div>
        <div className="text-[9px] sm:text-[11px] text-neutral-400 tracking-[0.15em] flex flex-col gap-0.5 opacity-80">
          <span>STATION ID: SRW-95-CX</span>
          <span>CIPHER: AES-256-GCM</span>
        </div>
      </div>

      {/* 3. Top-Right Complementary Telemetry Data */}
      <div className="fixed top-6 right-6 md:top-8 md:right-10 z-20 pointer-events-none select-none font-['JetBrains_Mono',monospace] text-right hidden sm:block">
        <div className="text-[10px] font-medium tracking-[0.2em] text-neutral-400 uppercase">
          FREQ BAND: 104.7 MHZ
        </div>
        <div className="text-[9px] text-neutral-500 tracking-[0.15em]">
          CARRIER: LOCKED // LATENCY: 12ms
        </div>
      </div>

      {/* 4. Center Interactive Encrypted Frequency Dial Core */}
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
        role="button"
        tabIndex={0}
        aria-label="Encrypted frequency dial. Touch to decrypt vault."
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 select-none z-10 flex flex-col items-center justify-center outline-none focus:outline-none ${
          isUnlocked
            ? 'opacity-10 pointer-events-none scale-90 blur-sm'
            : 'opacity-90 hover:opacity-100 cursor-pointer pointer-events-auto scale-100'
        }`}
      >
        <div className="flex flex-col items-center justify-center group p-6 sm:p-8 rounded-3xl transition-transform duration-300 hover:scale-[1.03]">
          {/* Subtle Ambient Radial Glow */}
          <div
            className="absolute inset-0 rounded-full blur-3xl opacity-30 pointer-events-none transition-opacity duration-500 group-hover:opacity-50"
            style={{
              background:
                theme.id === 'wick-noir'
                  ? 'radial-gradient(circle, rgba(230,165,55,0.2) 0%, rgba(0,0,0,0) 70%)'
                  : theme.id === 'dark-shadows'
                  ? 'radial-gradient(circle, rgba(60,110,210,0.22) 0%, rgba(0,0,0,0) 70%)'
                  : 'radial-gradient(circle, rgba(140,160,180,0.2) 0%, rgba(0,0,0,0) 70%)',
            }}
          />

          {/* Large, Crisp Frequency Readout */}
          <div className="relative font-['Roboto',sans-serif] font-bold text-5xl sm:text-7xl md:text-8xl tracking-[0.15em] text-white drop-shadow-[0_10px_35px_rgba(0,0,0,0.95)]">
            {frequency}
          </div>

          {/* Oscillating Carrier Wave Line */}
          <div className="w-36 sm:w-56 h-3 my-3 flex items-center justify-center overflow-hidden opacity-60 group-hover:opacity-100 transition-opacity">
            <svg viewBox="0 0 200 20" className="w-full h-full text-emerald-400 stroke-current fill-none stroke-[1.5]">
              <path d="M0,10 Q25,0 50,10 T100,10 T150,10 T200,10" />
            </svg>
          </div>

          {/* Status Pill: [ TOUCH TO DECRYPT VAULT ] */}
          <div className="font-['JetBrains_Mono',monospace] text-[11px] sm:text-xs tracking-[0.25em] text-emerald-400/90 uppercase font-medium bg-emerald-950/40 px-3.5 py-1.5 rounded-full border-0 shadow-[0_0_15px_rgba(52,211,153,0.15)] animate-pulse">
            [ TOUCH TO DECRYPT VAULT ]
          </div>
        </div>
      </div>

      {/* 5. Progressive Navigation Stage (Desktop 3-Tier Cascade + Mobile Adaptive Drill-Down) */}
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
                <div className="text-[10px] font-['JetBrains_Mono',monospace] tracking-[0.25em] text-emerald-400/80 uppercase pb-2 border-b border-white/10 text-center">
                  SELECT HUB ARCHIVE
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
    </div>
  );
};

export default FrequencyGate;
