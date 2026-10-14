/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Play, Camera } from 'lucide-react';
import { getDirectImageUrl, ensureHttps } from '../utils/imageUrlResolver';
import { prewarmVideoStream, getCachedVideoPoster } from '../utils/videoPosterGenerator';
import { useVideoThumbnail, getCachedThumbnailSync } from '../utils/clientVideoThumbnails';
import { isVideoExtension, encodeStreamUrl } from '../utils/mediaTypeDetector';
import {
  resolveMultiFrameThumbnails,
  resolveMultiFrameThumbnailsExt,
  useHoverThumbnailScrub,
} from '../utils/thumbnailResolver';
import type { AlbumData, StageMediaItem } from '../types';

export interface MediaCardProps {
  item: StageMediaItem;
  idx: number;
  album: AlbumData;
  variant?: string;
  heightClass?: string;
  staggeredOffset?: string;
  diptychMargin?: string;
  isHovered: boolean;
  onHover: (idx: number | null) => void;
  onSelectItem: (item: StageMediaItem, posterUrl?: string) => void;
  onActiveIndexChange?: (index: number) => void;
  updateMaxScroll?: () => void;
  hasDragged?: () => boolean;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  idx,
  album,
  variant = 'filmstrip',
  heightClass = 'h-[36vh] sm:h-[42vh] md:h-[46vh]',
  staggeredOffset = '',
  diptychMargin = '',
  isHovered,
  onHover,
  onSelectItem,
  onActiveIndexChange,
  updateMaxScroll,
  hasDragged,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Strict file extension-based video detection: any .mp4/.mov/.mkv/.webm/.avi is strictly a VIDEO
  const isVideo = isVideoExtension(item.url || item.id || item.title) || item.type === 'video';
  const isShort =
    variant === 'shorts' ||
    album.name.toLowerCase().includes('short') ||
    album.name.toLowerCase().includes('reel');

  const [useExtFallback, setUseExtFallback] = useState(false);
  const [remoteImageFailed, setRemoteImageFailed] = useState(false);
  const [staticFallbackFailed, setStaticFallbackFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Throttled mouse scrub state
  const [manualFrameIndex, setManualFrameIndex] = useState<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const currentFrameIndexRef = useRef<number | null>(null);
  const preloadedSet = useRef<Set<string>>(new Set());

  // 1. Resolve Multi-Frame WebP thumbnails (stem vs extension)
  const primaryThumbnails = useMemo(() => {
    return isVideo ? resolveMultiFrameThumbnails(item) : [];
  }, [isVideo, item]);

  const extThumbnails = useMemo(() => {
    return isVideo ? resolveMultiFrameThumbnailsExt(item) : [];
  }, [isVideo, item]);

  const activeThumbList = useExtFallback ? extThumbnails : primaryThumbnails;

  const streamUrl = isVideo ? encodeStreamUrl(item.url) : '';

  // 2. Client-side Canvas/IndexedDB thumbnail fallback ONLY if hovered (strictly zero eager video preloading)
  const { thumbnail: clientThumbnail } = useVideoThumbnail(
    isVideo && isHovered ? streamUrl : undefined,
    isShort
  );

  const directImgUrl = getDirectImageUrl(item, idx);
  const staticFallbackThumbnail = isVideo
    ? clientThumbnail ||
      getCachedThumbnailSync(streamUrl) ||
      getCachedThumbnailSync(item.url) ||
      getCachedVideoPoster(streamUrl) ||
      getCachedVideoPoster(item.url) ||
      item.thumbnail ||
      item.poster
    : directImgUrl;

  // 3. High-performance Hover Scrubbing hook with 404 resilience and zero-blanking
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

  // Active target thumbnail: prioritize scrubbed WebP frame; fall back to client/static thumbnail
  let activeThumbnail: string | null = null;
  if (!remoteImageFailed && scrubThumbnail) {
    activeThumbnail = scrubThumbnail;
  } else if (!staticFallbackFailed && staticFallbackThumbnail) {
    activeThumbnail = staticFallbackThumbnail;
  }

  // 4. Double-Buffered Zero-Blanking Frame Swapping State
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
    updateMaxScroll?.();
    if (url) {
      lastValidSrcRef.current = url;
    }
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
    // Note: activeLayer is NOT swapped on error, keeping the last valid frame strictly rendered
  };

  // 5. Eager Frame Pre-caching on Card Enter
  const handleMouseEnter = useCallback(() => {
    onHover(idx);
    if (isVideo) {
      prewarmVideoStream(streamUrl || item.url);
      const allFrames = [...activeThumbList, ...extThumbnails];
      allFrames.forEach((url) => {
        if (!url || preloadedSet.current.has(url)) return;
        const safe = ensureHttps(url);
        const img = new Image();
        img.src = safe;
        img.onload = () => {
          preloadedSet.current.add(url);
          preloadedSet.current.add(safe);
        };
      });
    }
  }, [idx, isVideo, onHover, streamUrl, item.url, activeThumbList, extThumbnails]);

  // 6. Throttled Mouse Scrub Calculation (requestAnimationFrame)
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isVideo || totalFrames <= 1) return;
      const card = cardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      if (rect.width <= 0) return;

      const relativeX = Math.max(0, Math.min(e.clientX - rect.left, rect.width - 1));
      const pct = relativeX / rect.width;
      const targetIdx = Math.min(totalFrames - 1, Math.floor(pct * totalFrames));

      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          if (targetIdx !== currentFrameIndexRef.current) {
            currentFrameIndexRef.current = targetIdx;
            setManualFrameIndex(targetIdx);
          }
        });
      }
    },
    [isVideo, totalFrames]
  );

  const handleMouseLeave = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    currentFrameIndexRef.current = null;
    setManualFrameIndex(null);
    onHover(null);
  }, [onHover]);

  const cleanCardTitle = (item.title || album.name)
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();

  const badgeLabel = isVideo ? (isShort ? 'SHORT' : 'VIDEO') : 'PHOTO';
  const aspectClass = isVideo ? (isShort ? 'aspect-[9/16]' : 'aspect-video') : '';

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={() => {
        if (isVideo) prewarmVideoStream(streamUrl || item.url);
      }}
      onTouchMove={(e) => {
        if (!isVideo || totalFrames <= 1) return;
        const card = cardRef.current;
        if (!card) return;
        const rect = card.getBoundingClientRect();
        if (rect.width <= 0) return;
        const touch = e.touches[0];
        if (!touch) return;
        const relativeX = Math.max(0, Math.min(touch.clientX - rect.left, rect.width - 1));
        const pct = relativeX / rect.width;
        const targetIdx = Math.min(totalFrames - 1, Math.floor(pct * totalFrames));
        setManualFrameIndex(targetIdx);
      }}
      onTouchEnd={() => {
        setManualFrameIndex(null);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!hasDragged || !hasDragged()) {
          onActiveIndexChange?.(idx);
          onSelectItem(item, activeThumbnail || lastValidSrcRef.current || undefined);
        }
      }}
      role="article"
      aria-label={item.title ? `${item.title} — ${album.name}` : `${album.name} media item`}
      className={`relative flex-shrink-0 cursor-pointer group rounded-xl sm:rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900 to-black border border-white/[0.07] shadow-2xl hover:shadow-[0_24px_60px_rgba(0,0,0,0.95)] hover:border-white/20 transition-all duration-300 ease-out hover:scale-[1.018] hover:-translate-y-1 select-none animate-fade-in ${heightClass} ${aspectClass} ${staggeredOffset} ${diptychMargin}`}
    >
      {/* Intentional Obsidian Typography Surface (Zero Black Screen Fallback) */}
      <div className="absolute inset-0 flex flex-col justify-between p-4 sm:p-5 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black select-none pointer-events-none z-0">
        <div className="flex items-center justify-between">
          <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            {isVideo ? (
              <Play className="w-3 h-3 text-zinc-400 fill-current ml-0.5" />
            ) : (
              <Camera className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </div>
          <span className="text-[9px] font-mono uppercase tracking-widest font-semibold brand-unified-wordmark">
            SARWARCYOU
          </span>
        </div>
        <div className="mt-auto">
          <span className="text-xs sm:text-sm font-medium text-zinc-200 tracking-wide line-clamp-2 block leading-snug">
            {cleanCardTitle}
          </span>
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block mt-1">
            {badgeLabel} {isVideo ? 'STREAM' : 'GALLERY'}
          </span>
        </div>
      </div>

      {/* Subtle Micro-Badge (VIDEO, SHORT, PHOTO) */}
      <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none">
        <span className="px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/10 text-[8px] font-mono font-semibold tracking-wider text-zinc-300 uppercase shadow-md">
          {badgeLabel}
        </span>
      </div>

      {/* YouTube-Style Multi-Frame Hover Scrubbing Progress Bar */}
      {isVideo && isScrubbing && totalFrames > 1 && (
        <div className="absolute top-2.5 right-2.5 z-30 pointer-events-none flex items-center gap-1 bg-black/80 backdrop-blur-md px-2 py-1 rounded-full border border-white/15 animate-fade-in">
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

      {/* Intuitive Skeleton Shimmer while Image is Loading */}
      {!imageLoaded && !staticFallbackFailed && (layerA || layerB) && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden bg-zinc-950/40 z-[5]">
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
        </div>
      )}

      {/* Visual Thumbnail Presentation - Double-Buffered Zero-Blanking Architecture */}
      <div className="relative h-full w-full flex items-center justify-center overflow-hidden pointer-events-none select-none">
        {layerA ? (
          <img
            src={layerA}
            alt={cleanCardTitle}
            draggable={false}
            loading="lazy"
            decoding="async"
            style={{ contentVisibility: 'auto' }}
            onLoad={() => handleLayerLoad('A', layerA)}
            onError={() => handleLayerError('A', layerA)}
            className={`w-full h-full object-cover block group-hover:scale-104 transition-opacity duration-200 ease-out select-none pointer-events-none ${
              activeLayer === 'A' && imageLoaded
                ? 'opacity-100 relative z-10'
                : 'opacity-0 absolute inset-0 m-auto z-0'
            }`}
          />
        ) : null}

        {layerB ? (
          <img
            src={layerB}
            alt={cleanCardTitle}
            draggable={false}
            loading="lazy"
            decoding="async"
            style={{ contentVisibility: 'auto' }}
            onLoad={() => handleLayerLoad('B', layerB)}
            onError={() => handleLayerError('B', layerB)}
            className={`w-full h-full object-cover block group-hover:scale-104 transition-opacity duration-200 ease-out select-none pointer-events-none ${
              activeLayer === 'B' && imageLoaded
                ? 'opacity-100 relative z-10'
                : 'opacity-0 absolute inset-0 m-auto z-0'
            }`}
          />
        ) : null}
      </div>

      {/* Specular gloss highlight on hover */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] to-white/[0.18] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20" />

      {/* Video Play Glyph indicator */}
      {isVideo && !isHovered && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/25 backdrop-blur-[1px] pointer-events-none z-20">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-xl">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        </div>
      )}

      {/* Razor-thin border sheen on hover */}
      <div className="pointer-events-none absolute inset-0 rounded-xl sm:rounded-2xl border border-transparent group-hover:border-white/15 transition-colors duration-300 z-20" />
    </div>
  );
};
