/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play, Camera, Trash2, Film, Sparkles } from 'lucide-react';
import type { StageMediaItem } from '../types';
import { getDirectImageUrl } from '../utils/imageUrlResolver';
import { prewarmVideoStream, getCachedVideoPoster } from '../utils/videoPosterGenerator';
import { useVideoThumbnail, getCachedThumbnailSync } from '../utils/clientVideoThumbnails';
import { isVideoExtension, encodeStreamUrl } from '../utils/mediaTypeDetector';
import {
  resolveMultiFrameThumbnails,
  resolveMultiFrameThumbnailsExt,
  useHoverThumbnailScrub,
} from '../utils/thumbnailResolver';

interface CarouselCardProps {
  item: StageMediaItem;
  idx: number;
  onSelectItem: (item: StageMediaItem, posterUrl?: string) => void;
  hasDragged: () => boolean;
}

const CarouselCard: React.FC<CarouselCardProps> = ({
  item,
  idx,
  onSelectItem,
  hasDragged,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [useExtFallback, setUseExtFallback] = useState(false);
  const [remoteImageFailed, setRemoteImageFailed] = useState(false);
  const [staticFallbackFailed, setStaticFallbackFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [manualFrameIndex, setManualFrameIndex] = useState<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const preloadedSet = useRef<Set<string>>(new Set());

  const isShort = Boolean(
    item.category?.toLowerCase().includes('short') ||
    item.category?.toLowerCase().includes('reel') ||
    item.url?.toLowerCase().includes('/shorts/') ||
    item.id?.toLowerCase().includes('shorts/')
  );

  const isVideo = isShort || isVideoExtension(item.url || item.id || item.title) || item.type === 'video';

  const primaryThumbnails = useMemo(() => {
    return isVideo ? resolveMultiFrameThumbnails(item) : [];
  }, [isVideo, item]);

  const extThumbnails = useMemo(() => {
    return isVideo ? resolveMultiFrameThumbnailsExt(item) : [];
  }, [isVideo, item]);

  const activeThumbList = useExtFallback ? extThumbnails : primaryThumbnails;
  const streamUrl = isVideo ? encodeStreamUrl(item.url) : '';

  const { thumbnail: clientThumbnail } = useVideoThumbnail(
    isVideo ? streamUrl : undefined,
    isShort
  );

  const directImgUrl = getDirectImageUrl(item, idx);
  const staticFallbackThumbnail = isVideo
    ? clientThumbnail ||
      getCachedThumbnailSync(streamUrl) ||
      getCachedThumbnailSync(item.url) ||
      getCachedVideoPoster(streamUrl) ||
      getCachedVideoPoster(item.url) ||
      item.thumbnail
    : directImgUrl;

  const {
    activeThumbnail: scrubThumbnail,
    activeFrameIndex,
    isScrubbing,
    totalFrames,
    handleFrameError,
  } = useHoverThumbnailScrub({
    thumbnails: activeThumbList,
    defaultThumbnail: staticFallbackThumbnail,
    isHovered,
    manualIndex: manualFrameIndex,
    intervalMs: 380,
    enabled: isVideo && activeThumbList.length > 0 && !remoteImageFailed,
  });

  let activeThumbnail: string | null = null;
  if (!remoteImageFailed && scrubThumbnail) {
    activeThumbnail = scrubThumbnail;
  } else if (!staticFallbackFailed && staticFallbackThumbnail) {
    activeThumbnail = staticFallbackThumbnail;
  }

  // Double-Buffered Layer Swapping (Zero-Blanking)
  const [layerA, setLayerA] = useState<string | null>(activeThumbnail);
  const [layerB, setLayerB] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<'A' | 'B'>('A');
  const lastValidSrcRef = useRef<string | null>(activeThumbnail);

  useEffect(() => {
    if (!activeThumbnail) return;
    const currentLayerSrc = activeLayer === 'A' ? layerA : layerB;
    if (activeThumbnail === currentLayerSrc) return;

    if (activeLayer === 'A') {
      setLayerB(activeThumbnail);
    } else {
      setLayerA(activeThumbnail);
    }
  }, [activeThumbnail, activeLayer, layerA, layerB]);

  const handleLayerLoad = (layer: 'A' | 'B', url: string | null) => {
    setImageLoaded(true);
    if (url) lastValidSrcRef.current = url;
    setActiveLayer(layer);
  };

  const handleLayerError = (_layer: 'A' | 'B', failedUrl: string | null) => {
    if (!failedUrl) return;
    handleFrameError?.(failedUrl);
    if (isVideo && !useExtFallback && extThumbnails.length > 0) {
      setUseExtFallback(true);
    } else if (isVideo && !remoteImageFailed && !lastValidSrcRef.current) {
      setRemoteImageFailed(true);
    } else if (!lastValidSrcRef.current) {
      setStaticFallbackFailed(true);
    }
  };

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (isVideo && activeThumbList.length > 0) {
      activeThumbList.forEach((frameUrl) => {
        if (!preloadedSet.current.has(frameUrl)) {
          const img = new Image();
          img.src = frameUrl;
          img.onload = () => preloadedSet.current.add(frameUrl);
        }
      });
    }
    if (isVideo && item.url) {
      prewarmVideoStream(item.url);
    }
  }, [isVideo, activeThumbList, item.url]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isVideo || totalFrames <= 1 || !cardRef.current) return;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

      rafIdRef.current = requestAnimationFrame(() => {
        const rect = cardRef.current?.getBoundingClientRect();
        if (!rect || rect.width <= 0) return;
        const relX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const progress = relX / rect.width;
        const frameIdx = Math.min(totalFrames - 1, Math.max(0, Math.floor(progress * totalFrames)));
        setManualFrameIndex(frameIdx);
      });
    },
    [isVideo, totalFrames]
  );

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    setManualFrameIndex(null);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasDragged()) return;
    onSelectItem(item, lastValidSrcRef.current || undefined);
  };

  const rawTitle = item.title || `Media ${idx + 1}`;
  const cleanTitle = rawTitle
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="group relative flex-shrink-0 w-[230px] sm:w-[270px] md:w-[310px] aspect-[16/10] rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer select-none bg-zinc-950 border border-white/[0.08] hover:border-white/25 transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-1"
    >
      {/* Fallback Obsidian Card Typography branding */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black flex flex-col justify-between p-3.5 z-0">
        <div className="flex items-center justify-between">
          <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center">
            {isShort ? (
              <Film className="w-3 h-3 text-fuchsia-400" />
            ) : isVideo ? (
              <Play className="w-3 h-3 text-amber-400 ml-0.5" />
            ) : (
              <Camera className="w-3 h-3 text-cyan-400" />
            )}
          </div>
          <span className="text-[8px] font-mono text-zinc-600 tracking-widest font-semibold uppercase">
            SARWARCYOU
          </span>
        </div>
        <div className="truncate">
          <span className="text-xs font-medium text-zinc-300 block truncate">{cleanTitle}</span>
        </div>
      </div>

      {/* Skeleton Shimmer */}
      {!imageLoaded && !staticFallbackFailed && (layerA || layerB) && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden bg-zinc-950/40 z-[5]">
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
        </div>
      )}

      {/* Zero-Blanking Double-Buffered Layer Presentation */}
      <div className="relative h-full w-full overflow-hidden pointer-events-none select-none z-10">
        {layerA && (
          <img
            src={layerA}
            alt={cleanTitle}
            draggable={false}
            style={{ contentVisibility: 'auto' }}
            onLoad={() => handleLayerLoad('A', layerA)}
            onError={() => handleLayerError('A', layerA)}
            className={`w-full h-full object-cover block group-hover:scale-105 transition-all duration-300 ease-out select-none pointer-events-none ${
              activeLayer === 'A' && imageLoaded
                ? 'opacity-100 relative z-10'
                : 'opacity-0 absolute inset-0 z-0'
            }`}
          />
        )}
        {layerB && (
          <img
            src={layerB}
            alt={cleanTitle}
            draggable={false}
            style={{ contentVisibility: 'auto' }}
            onLoad={() => handleLayerLoad('B', layerB)}
            onError={() => handleLayerError('B', layerB)}
            className={`w-full h-full object-cover block group-hover:scale-105 transition-all duration-300 ease-out select-none pointer-events-none ${
              activeLayer === 'B' && imageLoaded
                ? 'opacity-100 relative z-10'
                : 'opacity-0 absolute inset-0 z-0'
            }`}
          />
        )}
      </div>

      {/* Distinct Corner Badge: SHORTS (fuchsia), VIDEO (amber), PHOTO (cyan) */}
      <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none">
        {isShort ? (
          <span className="px-2 py-0.5 rounded-full bg-fuchsia-950/85 border border-fuchsia-500/40 text-fuchsia-300 font-mono text-[8px] sm:text-[9px] font-bold tracking-wider uppercase backdrop-blur-md shadow-lg flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
            SHORTS
          </span>
        ) : isVideo ? (
          <span className="px-2 py-0.5 rounded-full bg-amber-950/85 border border-amber-500/40 text-amber-300 font-mono text-[8px] sm:text-[9px] font-bold tracking-wider uppercase backdrop-blur-md shadow-lg flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            VIDEO
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-cyan-950/85 border border-cyan-500/40 text-cyan-300 font-mono text-[8px] sm:text-[9px] font-bold tracking-wider uppercase backdrop-blur-md shadow-lg flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            PHOTO
          </span>
        )}
      </div>

      {/* Hover Scrubbing Multi-Frame Indicator */}
      {isVideo && isScrubbing && totalFrames > 1 && (
        <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none flex items-center gap-1 bg-black/85 backdrop-blur-md px-2 py-1 rounded-full border border-white/15 animate-fade-in">
          {Array.from({ length: totalFrames }).map((_, fIdx) => (
            <div
              key={fIdx}
              className={`h-1 rounded-full transition-all duration-200 ${
                fIdx === activeFrameIndex
                  ? 'w-3.5 bg-zinc-100 shadow-[0_0_8px_rgba(255,255,255,0.8)]'
                  : 'w-1 bg-zinc-600'
              }`}
            />
          ))}
        </div>
      )}

      {/* Video Play Glyph indicator on Hover */}
      {isVideo && !isHovered && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/25 backdrop-blur-[1px] pointer-events-none z-20">
          <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-xl">
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          </div>
        </div>
      )}

      {/* Bottom Gradient Metadata Bar */}
      <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 via-black/45 to-transparent z-20 pointer-events-none flex flex-col justify-end">
        <span className="text-[11px] sm:text-xs font-medium text-zinc-100 truncate block leading-tight">
          {cleanTitle}
        </span>
        <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider block mt-0.5 truncate">
          {item.category || (isShort ? 'Short Reel' : isVideo ? 'Cinema' : 'Photography')}
        </span>
      </div>

      {/* Specular gloss highlight */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-white/[0.12] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-25" />
    </div>
  );
};

export interface DynamicMediaCarouselProps {
  title: string;
  subtitle?: string;
  countBadge?: number | string;
  items: StageMediaItem[];
  onSelectItem: (item: StageMediaItem, posterUrl?: string) => void;
  onClearHistory?: () => void;
  icon?: 'recent' | 'releases';
}

export const DynamicMediaCarousel: React.FC<DynamicMediaCarouselProps> = ({
  title,
  subtitle,
  countBadge,
  items,
  onSelectItem,
  onClearHistory,
  icon = 'releases',
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const dragDistanceRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    isMouseDownRef.current = true;
    startXRef.current = e.pageX - trackRef.current.offsetLeft;
    scrollLeftRef.current = trackRef.current.scrollLeft;
    dragDistanceRef.current = 0;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current || !trackRef.current) return;
    e.preventDefault();
    const x = e.pageX - trackRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.4;
    trackRef.current.scrollLeft = scrollLeftRef.current - walk;
    dragDistanceRef.current = Math.abs(walk);
  };

  const handleMouseUp = () => {
    isMouseDownRef.current = false;
  };

  const hasDragged = useCallback(() => {
    return dragDistanceRef.current > 6;
  }, []);

  const scrollByDelta = (delta: number) => {
    if (!trackRef.current) return;
    trackRef.current.scrollBy({ left: delta, behavior: 'smooth' });
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="w-full flex flex-col gap-2.5 sm:gap-3.5 select-none">
      {/* Rail Header */}
      <div className="flex items-center justify-between px-1 sm:px-2">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-300">
            {icon === 'recent' ? (
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            ) : (
              <Film className="w-3.5 h-3.5 text-amber-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-space font-bold text-sm sm:text-base tracking-wider text-zinc-100 uppercase">
                {title}
              </h3>
              {countBadge !== undefined && (
                <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-white/10 text-zinc-400 font-mono text-[9px] font-semibold">
                  {countBadge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-[10px] sm:text-[11px] font-mono text-zinc-500 tracking-wider">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onClearHistory && (
            <button
              type="button"
              onClick={onClearHistory}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/80 hover:bg-red-950/60 border border-white/10 hover:border-red-500/30 text-zinc-400 hover:text-red-300 text-[10px] font-mono tracking-wider transition-colors duration-200 cursor-pointer"
              title="Clear recently opened history"
            >
              <Trash2 className="w-3 h-3" />
              <span className="hidden sm:inline">CLEAR HISTORY</span>
            </button>
          )}

          {/* Desktop Arrow Navigation */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollByDelta(-360)}
              className="p-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Scroll left"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollByDelta(360)}
              className="p-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Scroll right"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Scroll Track */}
      <div
        ref={trackRef}
        data-disable-page-swipe="true"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1 cursor-grab active:cursor-grabbing"
      >
        {items.map((item, idx) => (
          <CarouselCard
            key={item.id || `carousel-item-${idx}`}
            item={item}
            idx={idx}
            onSelectItem={onSelectItem}
            hasDragged={hasDragged}
          />
        ))}
      </div>
    </div>
  );
};
