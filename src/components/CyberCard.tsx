import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Play, Camera, Film } from 'lucide-react';
import type { StageMediaItem } from '../types';
import { getVideoThumbnails } from '../utils/thumbnailResolver';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';
import { isVideoExtension } from '../utils/mediaTypeDetector';

export interface CyberCardProps {
  item: StageMediaItem;
  variant?: 'standard' | 'shorts' | 'photo';
  onClick: (item: StageMediaItem) => void;
  albumItems?: StageMediaItem[];
  initialIndex?: number;
}

export const CyberCard: React.FC<CyberCardProps> = ({
  item,
  variant = 'standard',
  onClick,
  albumItems,
  initialIndex,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isInViewport, setIsInViewport] = useState(false);

  // Viewport observer to only run timers when card is visible
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting);
      },
      { rootMargin: '100px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Multi-frame thumbnail scrubbing state (5 frames: thumb 1 to thumb 5)
  const [frameIndex, setFrameIndex] = useState(0); // 0 corresponds to _thumb_1.jpg
  const [isHovered, setIsHovered] = useState(false);
  const [failedFrames, setFailedFrames] = useState<Record<number, boolean>>({});

  // 10-Second Auto-Cycling for Album / Multi-Item Media
  const totalAlbumItems = albumItems && albumItems.length > 0 ? albumItems.length : 0;
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(initialIndex ?? 0);

  useEffect(() => {
    if (initialIndex !== undefined) {
      setCurrentPreviewIndex(initialIndex);
    }
  }, [initialIndex]);

  useEffect(() => {
    if (!isInViewport || isHovered || totalAlbumItems <= 1) {
      return;
    }

    const intervalId = setInterval(() => {
      setCurrentPreviewIndex((prev) => (prev + 1) % totalAlbumItems);
    }, 10000);

    return () => clearInterval(intervalId);
  }, [isInViewport, isHovered, totalAlbumItems]);

  // Resolve currently active preview item
  const activeItem = useMemo(() => {
    if (albumItems && albumItems.length > 0) {
      return albumItems[currentPreviewIndex % albumItems.length] || item;
    }
    return item;
  }, [albumItems, currentPreviewIndex, item]);

  // Reset frame scrubbing when item cycles
  useEffect(() => {
    setFailedFrames({});
    setFrameIndex(0);
  }, [activeItem.id, activeItem.url]);

  const isShort =
    variant === 'shorts' ||
    Boolean(
      activeItem.mediaType === 'short' ||
      activeItem.category?.toLowerCase().includes('short') ||
      activeItem.category?.toLowerCase().includes('reel') ||
      activeItem.url?.toLowerCase().includes('/shorts/') ||
      activeItem.id?.toLowerCase().includes('shorts')
    );

  const isVideo = isShort || activeItem.type === 'video' || activeItem.mediaType === 'clip' || /\.(mp4|mov|webm|mkv)$/i.test(activeItem.url);

  const cleanTitle = useMemo(() => {
    return sanitizeMediaTitle(activeItem.title || activeItem.name, activeItem.category);
  }, [activeItem.title, activeItem.name, activeItem.category]);

  const cleanCategory = useMemo(() => {
    if (activeItem.category) {
      return activeItem.category.replace(/[-_]+/g, ' ').trim();
    }
    return isVideo ? 'Cinema' : 'Photography';
  }, [activeItem.category, isVideo]);

  // 5-Frame pre-rendered thumbnails
  const videoThumbs = useMemo(() => {
    if (!isVideo) return [];
    if (activeItem.thumbnails && activeItem.thumbnails.length === 5) return activeItem.thumbnails;
    return getVideoThumbnails(activeItem);
  }, [isVideo, activeItem]);

  const hasThumbs = isVideo && videoThumbs.length === 5;

  // Preload frames 2-5 when cursor enters card for instant flicker-free scrubbing
  useEffect(() => {
    if (isHovered && hasThumbs) {
      videoThumbs.forEach((url, i) => {
        if (i !== 0) {
          const img = new Image();
          img.src = url;
        }
      });
    }
  }, [isHovered, hasThumbs, videoThumbs]);

  // Handle horizontal cursor movement for interactive frame scrubbing (0-20%, 20-40%, etc.)
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hasThumbs) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = Math.max(0, Math.min(rect.width - 1, e.clientX - rect.left));
    const pct = x / rect.width;
    const idx = Math.min(4, Math.floor(pct * 5));
    if (idx !== frameIndex) {
      setFrameIndex(idx);
    }
  };

  const handlePointerEnter = () => {
    setIsHovered(true);
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
    setFrameIndex(0); // Reset to default static display: _thumb_1.jpg
  };

  // Mobile touch scrub support
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!hasThumbs) return;
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = Math.max(0, Math.min(rect.width - 1, touch.clientX - rect.left));
    const pct = x / rect.width;
    const idx = Math.min(4, Math.floor(pct * 5));
    if (idx !== frameIndex) {
      setFrameIndex(idx);
      setIsHovered(true);
    }
  };

  const handleTouchEnd = () => {
    setTimeout(() => {
      setIsHovered(false);
      setFrameIndex(0);
    }, 1200);
  };

  // Aspect Ratio & Sizing: adapt to item's actual nature even within composite rows
  const effectiveVariant = isShort ? 'shorts' : (isVideo && variant === 'photo' ? 'standard' : variant);

  const sizeClass = {
    standard: 'w-[250px] sm:w-[280px] md:w-[310px] aspect-video',
    shorts: 'w-[150px] sm:w-[175px] md:w-[200px] aspect-[9/16]',
    photo: 'w-[160px] sm:w-[185px] md:w-[210px] aspect-[2/3]',
  }[effectiveVariant];

  const rawFallback = isVideo
    ? (activeItem.poster || activeItem.thumbnail || videoThumbs[0] || '')
    : (activeItem.thumbnail || activeItem.url || '');
  const safeFallbackUrl = isVideo && isVideoExtension(rawFallback) ? '' : rawFallback;
  const currentThumbUrl = hasThumbs
    ? (!failedFrames[frameIndex]
        ? videoThumbs[frameIndex]
        : (!failedFrames[0] ? videoThumbs[0] : safeFallbackUrl))
    : safeFallbackUrl;

  const validThumbUrl = isVideo && isVideoExtension(currentThumbUrl) ? '' : currentThumbUrl;

  // Cross-dissolve image layer state
  const [displayedThumbUrl, setDisplayedThumbUrl] = useState(validThumbUrl);
  const [prevThumbUrl, setPrevThumbUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (validThumbUrl && validThumbUrl !== displayedThumbUrl) {
      setPrevThumbUrl(displayedThumbUrl);
      setDisplayedThumbUrl(validThumbUrl);
      setImageLoaded(false);
      setImageError(false);
    }
  }, [validThumbUrl, displayedThumbUrl]);

  const handleImageLoaded = () => {
    setImageLoaded(true);
    const timer = setTimeout(() => {
      setPrevThumbUrl(null);
    }, 700);
    return () => clearTimeout(timer);
  };

  return (
    <div
      ref={cardRef}
      onClick={() => onClick(activeItem)}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(activeItem);
        }
      }}
      className={`group relative flex-shrink-0 cursor-pointer select-none rounded-xl overflow-hidden bg-black/60 backdrop-blur-md border border-white/10 transition-all duration-300 ease-out hover:scale-[1.04] hover:border-[#00E5FF]/40 hover:shadow-[0_14px_35px_rgba(0,0,0,0.85)] hover:z-20 ${sizeClass}`}
    >
      {/* Background Poster / Fallback */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col justify-between p-3.5 z-0">
        <div className="flex items-center justify-between">
          <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
            {isShort ? (
              <Film className="w-3 h-3 text-fuchsia-400" />
            ) : isVideo ? (
              <Play className="w-3 h-3 text-amber-400 ml-0.5 fill-current" />
            ) : (
              <Camera className="w-3 h-3 text-cyan-400" />
            )}
          </div>
          <span className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase">
            SARWARCYOU
          </span>
        </div>
        {!isShort && (
          <span className="text-xs font-medium text-zinc-400 truncate">{cleanTitle}</span>
        )}
      </div>

      {/* Cross-Dissolve: Previous Image Layer */}
      {prevThumbUrl && (
        <img
          src={prevThumbUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover z-10 opacity-100 pointer-events-none"
        />
      )}

      {/* Active Image Layer with Cross-Dissolve Fade */}
      {!imageError && displayedThumbUrl && (
        <img
          key={displayedThumbUrl}
          src={displayedThumbUrl}
          alt={activeItem.title}
          loading="lazy"
          decoding="async"
          onLoad={handleImageLoaded}
          onError={() => {
            if (hasThumbs) {
              setFailedFrames((prev) => ({ ...prev, [frameIndex]: true }));
            } else {
              setImageError(true);
            }
          }}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out group-hover:scale-105 z-10 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* 5-Segment Multi-Frame Hover Scrub Bar for Videos & Shorts */}
      {hasThumbs && isHovered && (
        <div className="absolute top-0 inset-x-0 z-30 p-1.5 flex items-center gap-1 bg-gradient-to-b from-black/85 via-black/40 to-transparent pointer-events-none transition-opacity duration-200">
          {[0, 1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className={`flex-1 h-0.5 sm:h-1 rounded-full transition-all duration-150 ${
                idx === frameIndex
                  ? 'bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]'
                  : 'bg-white/25'
              }`}
            />
          ))}
        </div>
      )}

      {/* Category Corner Badge */}
      <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none">
        {isShort ? (
          <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-fuchsia-300 font-mono text-[9px] font-bold tracking-wider uppercase border border-fuchsia-500/30 flex items-center gap-1 shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
            SHORTS
          </span>
        ) : isVideo ? (
          <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-amber-300 font-mono text-[9px] font-bold tracking-wider uppercase border border-amber-500/30 flex items-center gap-1 shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            CLIPS
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-cyan-300 font-mono text-[9px] font-bold tracking-wider uppercase border border-cyan-500/30 flex items-center gap-1 shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            PHOTO
          </span>
        )}
      </div>

      {/* Corner Counter Badge for Multi-Item Albums */}
      {totalAlbumItems > 1 && (
        <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none">
          <span className="px-2 py-0.5 rounded-full bg-black/65 backdrop-blur-md text-white/90 font-mono text-[9px] font-bold border border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
            {(currentPreviewIndex % totalAlbumItems) + 1} / {totalAlbumItems}
          </span>
        </div>
      )}

      {/* Play Icon Centered on Hover for Videos */}
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/30 backdrop-blur-[1px] pointer-events-none z-20">
          <div className="w-11 h-11 rounded-full bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center text-white shadow-[0_0_20px_rgba(0,229,255,0.3)]">
            <Play className="w-4 h-4 fill-current ml-0.5 text-cyan-300" />
          </div>
        </div>
      )}

      {/* Bottom Gradient Metadata Bar */}
      {isShort ? (
        <div className="absolute bottom-0 inset-x-0 p-2.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent z-20 pointer-events-none flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Film className="w-3.5 h-3.5 text-fuchsia-400" />
            <span className="text-[10px] font-mono font-bold tracking-wider text-fuchsia-300 uppercase">
              REEL
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-zinc-300 border border-white/10">
            9:16
          </span>
        </div>
      ) : (
        <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 via-black/45 to-transparent z-20 pointer-events-none flex flex-col justify-end">
          <span className="text-xs sm:text-sm font-semibold text-zinc-100 truncate block leading-tight">
            {cleanTitle}
          </span>
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mt-0.5 truncate">
            {cleanCategory}
          </span>
        </div>
      )}

      {/* Ambient Gloss Highlight on Hover */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-cyan-400/[0.03] to-white/[0.08] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-25" />
    </div>
  );
};

export default CyberCard;
