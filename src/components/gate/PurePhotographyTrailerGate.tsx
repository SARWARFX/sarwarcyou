import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Play } from 'lucide-react';
import type { StageMediaItem } from '../../types';
import { SmartThumbnail } from '../common/SmartThumbnail';
import { useScrambleText } from './useScrambleText';
import { isPhotoExtension } from '../../utils/mediaTypeDetector';
import { getMediaUrl, getThumbnailUrl, getImageUrl } from '../../utils/imageUrlResolver';
import { resolveStaticVideoThumbnail } from '../../utils/thumbnailResolver';
import { sanitizeMediaTitle } from '../../utils/titleSanitizer';
import { sortMediaItemsDescending } from '../../utils/albumExtractor';
import { sortSubfolderNodesDescending, type DirectoryNode } from '../DeepSpaceTreeExplorer';
import { FALLBACK_HF_CATALOG, FALLBACK_MEDIA_DATA } from '../../data/fallbackData';

export interface PurePhotographyTrailerGateProps {
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

// Cinematic Timing Constants
const SLIDE_DURATION_MS = 5200;      // 5.2 seconds per still
const CROSSFADE_DURATION_MS = 1400;  // 1.4 seconds smooth dissolve crossfade
const STABLE_DURATION_MS = SLIDE_DURATION_MS - CROSSFADE_DURATION_MS; // 3800ms full opacity

interface KenBurnsTrajectory {
  startScale: number;
  endScale: number;
  startPanX: number; // percentage of canvas width
  endPanX: number;
  startPanY: number; // percentage of canvas height
  endPanY: number;
}

const KEN_BURNS_TRAJECTORIES: KenBurnsTrajectory[] = [
  { startScale: 1.04, endScale: 1.14, startPanX: -0.02, endPanX: 0.02, startPanY: -0.01, endPanY: 0.01 },
  { startScale: 1.15, endScale: 1.05, startPanX: 0.025, endPanX: -0.025, startPanY: 0.015, endPanY: -0.015 },
  { startScale: 1.05, endScale: 1.15, startPanX: 0, endPanX: 0, startPanY: 0.02, endPanY: -0.02 },
  { startScale: 1.14, endScale: 1.04, startPanX: -0.02, endPanX: 0.02, startPanY: -0.02, endPanY: 0.02 },
  { startScale: 1.06, endScale: 1.15, startPanX: 0.02, endPanX: -0.015, startPanY: -0.015, endPanY: 0.015 },
  { startScale: 1.13, endScale: 1.05, startPanX: 0, endPanX: 0, startPanY: -0.02, endPanY: 0.02 },
];

function smoothEaseInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function extractPhotographyStills(items: StageMediaItem[]): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const addUrl = (rawUrl?: string | null) => {
    if (!rawUrl) return;
    const resolved = getMediaUrl(rawUrl);
    if (resolved && !seen.has(resolved) && !resolved.includes('ustream_thumb')) {
      seen.add(resolved);
      urls.push(resolved);
    }
  };

  for (const item of items) {
    if (item.type === 'image' || isPhotoExtension(item.url || item.name || item.path || '')) {
      addUrl(item.url || item.path || item.id);
    }
  }

  // Fallback to embedded catalogs if the live items list is still loading
  if (urls.length === 0 && FALLBACK_HF_CATALOG?.images) {
    for (const img of FALLBACK_HF_CATALOG.images) {
      addUrl(img.path);
    }
  }

  if (urls.length === 0 && FALLBACK_MEDIA_DATA?.trailerImages) {
    for (const img of FALLBACK_MEDIA_DATA.trailerImages) {
      addUrl(img.url || img.thumbnail);
    }
  }

  return urls;
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

const ScrambledHubItem: React.FC<{
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
      className={`text-left font-['Google Sans'] font-bold uppercase transition-all duration-200 cursor-pointer select-none border-0 outline-none p-0 bg-transparent flex items-center gap-2.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] ${
        isActive
          ? 'text-white tracking-[0.24em] text-lg sm:text-xl md:text-2xl scale-[1.02] origin-left'
          : 'text-neutral-400 tracking-[0.2em] text-base sm:text-lg hover:text-white'
      }`}
    >
      {isActive && (
        <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] animate-pulse" />
      )}
      {scrambled}
    </button>
  );
};

export const PurePhotographyTrailerGate: React.FC<PurePhotographyTrailerGateProps> = ({
  items,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
  initialAlbum,
  isModalOpen = false,
}) => {
  // Gate unlock & navigation states
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [selectedHub, setSelectedHub] = useState<string | null>(null);
  const [selectedSubfolder, setSelectedSubfolder] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  // Extract photography stills pool
  const stillsList = useMemo(() => extractPhotographyStills(items), [items]);

  // Image preloading & caching
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const activeSlideIndexRef = useRef<number>(0);
  const slideStartTimeRef = useRef<number>(0);
  const trajectoryIndexRef = useRef<number>(0);
  const animFrameIdRef = useRef<number | null>(null);
  const grainCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Create pre-rendered film grain canvas pattern
  useEffect(() => {
    const grainCanvas = document.createElement('canvas');
    grainCanvas.width = 128;
    grainCanvas.height = 128;
    const gCtx = grainCanvas.getContext('2d');
    if (gCtx) {
      const imgData = gCtx.createImageData(128, 128);
      const buffer = new Uint32Array(imgData.data.buffer);
      for (let i = 0; i < buffer.length; i++) {
        const noise = (Math.random() * 255) | 0;
        // Low-opacity white speckle
        buffer[i] = (16 << 24) | (noise << 16) | (noise << 8) | noise;
      }
      gCtx.putImageData(imgData, 0, 0);
      grainCanvasRef.current = grainCanvas;
    }
  }, []);

  // Preload an image URL into HTMLImageElement
  const getImageElement = useCallback((url: string): HTMLImageElement | null => {
    if (!url) return null;
    const cache = imageCacheRef.current;
    if (cache.has(url)) {
      const img = cache.get(url)!;
      return img.complete && img.naturalWidth > 0 ? img : null;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.src = url;
    cache.set(url, img);
    return null;
  }, []);

  // Preload upcoming slides in sequence
  useEffect(() => {
    if (stillsList.length === 0) return;
    const countToPreload = Math.min(stillsList.length, 5);
    for (let i = 0; i < countToPreload; i++) {
      const idx = (activeSlideIndexRef.current + i) % stillsList.length;
      getImageElement(stillsList[idx]);
    }
  }, [stillsList, getImageElement]);

  // --------------------------------------------------------------------------
  // Canvas Ken Burns Render Loop
  // --------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const renderCoverImage = (
      img: HTMLImageElement,
      cw: number,
      ch: number,
      scale: number,
      panX: number,
      panY: number,
      alpha: number
    ) => {
      if (!img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return;

      const imgAspect = img.naturalWidth / img.naturalHeight;
      const canvasAspect = cw / ch;

      let drawW: number;
      let drawH: number;

      if (canvasAspect > imgAspect) {
        drawW = cw;
        drawH = cw / imgAspect;
      } else {
        drawH = ch;
        drawW = ch * imgAspect;
      }

      const finalW = drawW * scale;
      const finalH = drawH * scale;

      const posX = (cw - finalW) / 2 + panX * cw;
      const posY = (ch - finalH) / 2 + panY * ch;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.drawImage(img, posX, posY, finalW, finalH);
      ctx.restore();
    };

    const drawVignetteAndGrain = (cw: number, ch: number) => {
      ctx.save();

      // Deep Edge Vignette
      const radius = Math.max(cw, ch) * 0.72;
      const vignette = ctx.createRadialGradient(
        cw / 2, ch / 2, Math.min(cw, ch) * 0.22,
        cw / 2, ch / 2, radius
      );
      vignette.addColorStop(0, 'rgba(2, 3, 6, 0)');
      vignette.addColorStop(0.55, 'rgba(2, 3, 6, 0.45)');
      vignette.addColorStop(1, 'rgba(2, 3, 6, 0.96)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, cw, ch);

      // Subtle Film Grain Overlay
      if (grainCanvasRef.current) {
        const pattern = ctx.createPattern(grainCanvasRef.current, 'repeat');
        if (pattern) {
          ctx.globalAlpha = 0.055;
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, cw, ch);
        }
      }

      ctx.restore();
    };

    slideStartTimeRef.current = performance.now();

    const loop = (now: number) => {
      if (!isRunning) return;

      // When vault is unlocked or another media modal is open, halt canvas updates to save GPU/battery
      if (isUnlocked || isModalOpen) {
        slideStartTimeRef.current = now; // keep reel ready to resume on dismiss
        animFrameIdRef.current = requestAnimationFrame(loop);
        return;
      }

      const cw = canvas.width;
      const ch = canvas.height;

      // Dark obsidian base clear
      ctx.fillStyle = '#020306';
      ctx.fillRect(0, 0, cw, ch);

      if (stillsList.length === 0) {
        drawVignetteAndGrain(cw, ch);
        animFrameIdRef.current = requestAnimationFrame(loop);
        return;
      }

      let elapsed = now - slideStartTimeRef.current;

      // Advance to next slide once duration expires
      if (elapsed >= SLIDE_DURATION_MS) {
        activeSlideIndexRef.current = (activeSlideIndexRef.current + 1) % stillsList.length;
        trajectoryIndexRef.current = (trajectoryIndexRef.current + 1) % KEN_BURNS_TRAJECTORIES.length;
        slideStartTimeRef.current = now;
        elapsed = 0;
      }

      const currIdx = activeSlideIndexRef.current;
      const nextIdx = (currIdx + 1) % stillsList.length;

      const currUrl = stillsList[currIdx];
      const nextUrl = stillsList[nextIdx];

      const currImg = getImageElement(currUrl);
      const nextImg = getImageElement(nextUrl);

      // Preload next+1 in background
      const upcomingIdx = (nextIdx + 1) % stillsList.length;
      getImageElement(stillsList[upcomingIdx]);

      // Calculate Ken Burns progress
      const progress = Math.min(1, elapsed / SLIDE_DURATION_MS);
      const easedProgress = smoothEaseInOut(progress);

      const traj = KEN_BURNS_TRAJECTORIES[trajectoryIndexRef.current];
      const currScale = traj.startScale + (traj.endScale - traj.startScale) * easedProgress;
      const currPanX = traj.startPanX + (traj.endPanX - traj.startPanX) * easedProgress;
      const currPanY = traj.startPanY + (traj.endPanY - traj.startPanY) * easedProgress;

      let currAlpha = 1.0;
      let nextAlpha = 0.0;

      if (elapsed > STABLE_DURATION_MS) {
        const fadeElapsed = elapsed - STABLE_DURATION_MS;
        const fadeProgress = Math.min(1, fadeElapsed / CROSSFADE_DURATION_MS);
        const smoothFade = smoothEaseInOut(fadeProgress);
        currAlpha = 1.0 - smoothFade;
        nextAlpha = smoothFade;
      }

      // Draw primary slide
      if (currImg) {
        renderCoverImage(currImg, cw, ch, currScale, currPanX, currPanY, currAlpha);
      }

      // Draw incoming slide during crossfade
      if (nextAlpha > 0 && nextImg) {
        const nextTrajIdx = (trajectoryIndexRef.current + 1) % KEN_BURNS_TRAJECTORIES.length;
        const nextTraj = KEN_BURNS_TRAJECTORIES[nextTrajIdx];
        const nextElapsed = elapsed - STABLE_DURATION_MS;
        const nextProgress = Math.min(1, nextElapsed / SLIDE_DURATION_MS);
        const nextEased = smoothEaseInOut(nextProgress);

        const nextScale = nextTraj.startScale + (nextTraj.endScale - nextTraj.startScale) * nextEased;
        const nextPanX = nextTraj.startPanX + (nextTraj.endPanX - nextTraj.startPanX) * nextEased;
        const nextPanY = nextTraj.startPanY + (nextTraj.endPanY - nextTraj.startPanY) * nextEased;

        renderCoverImage(nextImg, cw, ch, nextScale, nextPanX, nextPanY, nextAlpha);
      }

      // Draw edge vignette and film grain
      drawVignetteAndGrain(cw, ch);

      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      isRunning = false;
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [stillsList, getImageElement, isUnlocked, isModalOpen]);

  // Build directory tree for 3-Tier Media Cascade
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

      let current = map.get(root)!;
      let pathAccum = root;

      for (const sub of subfolders) {
        pathAccum += `/${sub}`;
        if (!current.subfolders.has(sub)) {
          current.subfolders.set(sub, {
            name: sub,
            fullPath: pathAccum,
            subfolders: new Map(),
            files: [],
          });
        }
        current = current.subfolders.get(sub)!;
      }

      current.files.push(item);
    }

    return map;
  }, [items]);

  // Handle Hub Selection
  const handleSelectHub = useCallback(
    (hubKey: string, hubRawName: string) => {
      setSelectedHub(hubKey);

      const node = rootMap.get(hubRawName);
      if (node && node.subfolders.size > 0) {
        const sortedSubs = sortSubfolderNodesDescending(Array.from(node.subfolders.values()));
        setSelectedSubfolder(sortedSubs[0].name);
      } else {
        setSelectedSubfolder(null);
      }
    },
    [rootMap]
  );

  // Auto-select initial album or default hub on unlock
  useEffect(() => {
    if (!isUnlocked) return;

    if (selectedHub) return;

    if (initialAlbum) {
      const matchKey = HUBS.find((h) =>
        initialAlbum.toLowerCase().includes(h.key.toLowerCase()) ||
        initialAlbum.toLowerCase().includes(h.rawName.toLowerCase())
      );
      if (matchKey) {
        handleSelectHub(matchKey.key, matchKey.rawName);
        return;
      }
    }

    // Default to CLIPS or first hub
    handleSelectHub('CLIPS', 'Clips');
  }, [isUnlocked, initialAlbum, selectedHub, handleSelectHub]);

  // Current subfolders list
  const currentSubfolders = useMemo(() => {
    if (!selectedHub) return [];
    const hubDef = HUBS.find((h) => h.key === selectedHub);
    if (!hubDef) return [];
    const rootNode = rootMap.get(hubDef.rawName);
    if (!rootNode) return [];
    return sortSubfolderNodesDescending(Array.from(rootNode.subfolders.values()));
  }, [selectedHub, rootMap]);

  // Active directory node for media items
  const activeDirectoryNode = useMemo(() => {
    if (!selectedHub) return null;
    const hubDef = HUBS.find((h) => h.key === selectedHub);
    if (!hubDef) return null;
    const rootNode = rootMap.get(hubDef.rawName);
    if (!rootNode) return null;

    if (selectedSubfolder && rootNode.subfolders.has(selectedSubfolder)) {
      return rootNode.subfolders.get(selectedSubfolder)!;
    }
    return rootNode;
  }, [selectedHub, selectedSubfolder, rootMap]);

  // Segregated active media files
  const { photoFiles, videoFiles, shortFiles } = useMemo(() => {
    if (!activeDirectoryNode) {
      return { photoFiles: [], videoFiles: [], shortFiles: [] };
    }

    const all = sortMediaItemsDescending(activeDirectoryNode.files);
    const photos: StageMediaItem[] = [];
    const videos: StageMediaItem[] = [];
    const shorts: StageMediaItem[] = [];

    for (const f of all) {
      const isShort =
        f.mediaType === 'short' ||
        f.category?.toLowerCase().includes('short') ||
        f.url?.toLowerCase().includes('short') ||
        activeDirectoryNode.name.toLowerCase().includes('short');

      if (isShort) {
        shorts.push(f);
      } else if (f.type === 'image' || isPhotoExtension(f.url || f.name)) {
        photos.push(f);
      } else {
        videos.push(f);
      }
    }

    return { photoFiles: photos, videoFiles: videos, shortFiles: shorts };
  }, [activeDirectoryNode]);

  // Global keydown listener: 'Escape' dismisses the overlay back to pure trailer reel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isUnlocked) {
        if (e.cancelable) e.preventDefault();
        setIsUnlocked(false);
        setSelectedHub(null);
        setSelectedSubfolder(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUnlocked]);

  // Click-Anywhere Vault Trigger:
  // Tapping anywhere on the screen when idle halts the reel and opens the 3-Tier Frosted Vault
  const handleStageClick = () => {
    if (!isUnlocked) {
      setIsUnlocked(true);
    }
  };

  // Dismiss: Clicking any empty space outside the panels smoothly conceals the overlay
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) {
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
      onClick={isUnlocked ? handleBackdropClick : handleStageClick}
      className="relative w-full h-[100dvh] overflow-hidden select-none text-white font-['Roboto',sans-serif] bg-[#020306] cursor-pointer"
      style={{ isolation: 'isolate' }}
    >
      {/* 1. Fullscreen HTML5 Photography Trailer Canvas Engine (100% Wordless, No Text) */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full object-cover pointer-events-none z-0"
      />

      {/* 2. Three-Tier Frosted Obsidian Vault Cascade Overlay */}
      <div
        ref={menuContainerRef}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setIsUnlocked(false);
            setSelectedHub(null);
            setSelectedSubfolder(null);
          }
        }}
        className={`fixed inset-0 w-full h-full select-none z-30 transition-all duration-500 flex flex-col justify-center items-center ${
          isUnlocked
            ? 'opacity-100 pointer-events-auto bg-black/85 backdrop-blur-3xl'
            : 'opacity-0 pointer-events-none bg-transparent'
        }`}
      >
        {/* ========================================================= */}
        {/* DESKTOP 3-TIER HORIZONTAL CASCADE (md: and up)            */}
        {/* ========================================================= */}
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsUnlocked(false);
              setSelectedHub(null);
              setSelectedSubfolder(null);
            }
          }}
          className="hidden md:flex flex-row items-center w-full h-full p-6 sm:p-10 md:p-14 gap-6 sm:gap-8 md:gap-10 overflow-x-auto overflow-y-hidden no-scrollbar"
        >
          {/* TIER 1: Left-Middle Navigation Menu (4 Major Hubs with Scramble Effect) */}
          <div className="flex-shrink-0 flex flex-col justify-center">
            <div className="bg-black/60 backdrop-blur-2xl rounded-2xl p-6 md:p-8 flex flex-col space-y-6 shadow-2xl border border-white/5">
              {HUBS.map((hub) => (
                <ScrambledHubItem
                  key={hub.key}
                  label={hub.label}
                  isActive={selectedHub === hub.key}
                  isUnlocked={isUnlocked}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectHub(hub.key, hub.rawName);
                  }}
                />
              ))}
            </div>
          </div>

          {/* TIER 2: Subfolders Column (Smoothly slides open on choosing major hub) */}
          {selectedHub && currentSubfolders.length > 0 && (
            <div className="flex-shrink-0 flex flex-col justify-center min-w-[170px] sm:min-w-[200px] md:min-w-[230px] max-w-[290px] animate-fade-in">
              <div className="bg-black/60 backdrop-blur-2xl rounded-2xl p-5 md:p-6 flex flex-col space-y-3.5 max-h-[75vh] overflow-y-auto no-scrollbar shadow-2xl border border-white/5">
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
                      className={`text-left font-['Google Sans'] font-medium uppercase transition-all duration-200 cursor-pointer p-0 bg-transparent border-0 outline-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ${
                        isSubActive
                          ? 'text-white tracking-[0.18em] text-sm md:text-base'
                          : 'text-neutral-400 tracking-[0.15em] text-sm md:text-base hover:text-white'
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
              key={activeDirectoryNode.fullPath || `${selectedHub}-${selectedSubfolder}`}
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
                        className="animate-card-enter will-change-transform transform-gpu relative aspect-square cursor-pointer overflow-hidden rounded-xl group transition-all duration-300 transform border-0 shadow-lg hover:shadow-2xl hover:scale-[1.03]"
                      >
                        <SmartThumbnail
                          src={getMediaUrl(photo.url)}
                          alt={photo.title || photo.name || 'Photo'}
                          aspectClass="aspect-square"
                          containerClassName="w-full h-full rounded-xl border-0"
                          className="group-hover:brightness-110 transition-all duration-300"
                          fallbackTitle={photo.title || photo.name}
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
                          <SmartThumbnail
                            src={thumb}
                            alt={cleanTitle}
                            aspectClass="aspect-video"
                            containerClassName="w-full aspect-video rounded-xl border-0 shadow-lg group-hover:shadow-2xl transition-all duration-200"
                            className="object-center group-hover:scale-105 transition-transform duration-500"
                            fallbackTitle={cleanTitle}
                          >
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                              <div className="w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                              </div>
                            </div>
                          </SmartThumbnail>
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
                          <SmartThumbnail
                            src={thumb}
                            alt={cleanTitle}
                            aspectClass="aspect-[9/16]"
                            containerClassName="w-full aspect-[9/16] rounded-xl border-0 shadow-lg group-hover:shadow-2xl transition-all duration-200"
                            className="object-center group-hover:scale-105 transition-transform duration-500"
                            fallbackTitle={cleanTitle}
                          >
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                              <div className="w-9 h-9 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                              </div>
                            </div>
                          </SmartThumbnail>
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
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsUnlocked(false);
              setSelectedHub(null);
              setSelectedSubfolder(null);
            }
          }}
          className="md:hidden flex flex-col w-full h-full pt-12 sm:pt-14 pb-3 sm:pb-4 px-3 sm:px-4 overflow-hidden min-w-0"
        >
          {!selectedHub ? (
            /* Mobile Step 1: Centered 4 Major Hubs */
            <div 
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setIsUnlocked(false);
                  setSelectedHub(null);
                  setSelectedSubfolder(null);
                }
              }}
              className="flex-1 flex flex-col justify-center items-center"
            >
              <div 
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-xs bg-black/60 backdrop-blur-2xl rounded-2xl p-6 flex flex-col space-y-6 shadow-2xl border border-white/5"
              >
                <div className="text-[10px] font-['Roboto',sans-serif] tracking-[0.25em] text-neutral-400 uppercase pb-2 border-b border-white/10 text-center">
                  SELECT HUB
                </div>
                {HUBS.map((hub) => (
                  <ScrambledHubItem
                    key={hub.key}
                    label={hub.label}
                    isActive={selectedHub === hub.key}
                    isUnlocked={isUnlocked}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectHub(hub.key, hub.rawName);
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
                    setSelectedHub(null);
                    setSelectedSubfolder(null);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/25 text-white text-[10px] font-['Google Sans'] font-medium tracking-wider uppercase flex items-center gap-1 active:scale-95 transition-all flex-shrink-0 cursor-pointer"
                >
                  ← HUBS
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
                        className={`px-2.5 py-1.5 rounded-xl text-[10px] font-['Google Sans'] font-medium uppercase whitespace-nowrap transition-all duration-200 flex-shrink-0 cursor-pointer ${
                          isSubActive
                            ? 'bg-white/20 text-white font-bold shadow-md tracking-wider'
                            : 'bg-black/40 text-neutral-400 hover:text-white tracking-wide'
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
                key={activeDirectoryNode ? (activeDirectoryNode.fullPath || `${selectedHub}-${selectedSubfolder}`) : 'empty'}
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
                            className="animate-card-enter will-change-transform transform-gpu relative aspect-square cursor-pointer overflow-hidden rounded-xl shadow-md active:scale-95 transition-transform"
                          >
                            <SmartThumbnail
                              src={getMediaUrl(photo.url)}
                              alt={photo.title || photo.name || 'Photo'}
                              aspectClass="aspect-square"
                              containerClassName="w-full h-full rounded-xl border-0"
                              fallbackTitle={photo.title || photo.name}
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
                              <SmartThumbnail
                                src={thumb}
                                alt={cleanTitle}
                                aspectClass="aspect-video"
                                containerClassName="w-full aspect-video rounded-xl border-0 shadow-lg"
                                fallbackTitle={cleanTitle}
                              >
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                                    <Play className="w-4 h-4 fill-current ml-0.5" />
                                  </div>
                                </div>
                              </SmartThumbnail>
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
                              <SmartThumbnail
                                src={thumb}
                                alt={cleanTitle}
                                aspectClass="aspect-[9/16]"
                                containerClassName="w-full aspect-[9/16] rounded-xl border-0 shadow-lg"
                                fallbackTitle={cleanTitle}
                              >
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-9 h-9 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                  </div>
                                </div>
                              </SmartThumbnail>
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

export default PurePhotographyTrailerGate;
