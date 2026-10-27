import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Play, Camera } from 'lucide-react';
import type { MediaItem, MediaVariant } from '../../models/media';
import { HoverScrubber } from './HoverScrubber';
import { ThumbnailPlaceholder } from './ThumbnailPlaceholder';

export interface MediaCardProps {
  item: MediaItem;
  variant?: MediaVariant;
  onClick: (item: MediaItem) => void;
  className?: string;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  variant,
  onClick,
  className = '',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const effectiveVariant = variant || item.variant;
  const isVideo = item.type === 'video';
  const isShort = effectiveVariant === 'short';

  const [frameIndex, setFrameIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const hasThumbs = isVideo && item.thumbnails && item.thumbnails.length >= 5;

  // Active thumbnail selection based on hover scrub frame
  const activeThumbnail = useMemo(() => {
    if (imgError || !item.thumbnailUrl) return null;
    if (hasThumbs && isHovered && item.thumbnails[frameIndex]) {
      return item.thumbnails[frameIndex];
    }
    return item.thumbnailUrl;
  }, [hasThumbs, isHovered, frameIndex, item.thumbnailUrl, item.thumbnails, imgError]);

  // Preload frames 1-4 on hover
  useEffect(() => {
    if (isHovered && hasThumbs) {
      item.thumbnails.slice(1).forEach((url) => {
        const img = new Image();
        img.src = url;
      });
    }
  }, [isHovered, hasThumbs, item.thumbnails]);

  // Cursor movement for YouTube-style scrub bar
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

  const handlePointerEnter = () => setIsHovered(true);
  const handlePointerLeave = () => {
    setIsHovered(false);
    setFrameIndex(0);
  };

  // Aspect ratio classes
  const aspectClass = {
    standard: 'aspect-video w-full',
    short: 'aspect-[9/16] w-full',
    photo: 'w-full h-auto',
  }[effectiveVariant];

  return (
    <div
      ref={cardRef}
      onClick={() => onClick(item)}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(item);
        }
      }}
      className={`group relative rounded-xl overflow-hidden bg-[#0d0e14] border border-white/10 hover:border-[#00E5FF]/50 transition-all duration-300 ease-out hover:scale-[1.025] hover:shadow-[0_12px_32px_rgba(0,0,0,0.85)] cursor-pointer select-none flex-shrink-0 ${aspectClass} ${className}`}
    >
      {/* 1. Underlying Themed Placeholder (Zero blank/broken states) */}
      <ThumbnailPlaceholder variant={effectiveVariant} title={item.title} />

      {/* 2. Remote Image Layer (Cross-fades on load) */}
      {!imgError && activeThumbnail && (
        <img
          key={activeThumbnail}
          src={activeThumbnail}
          alt={item.title}
          loading="lazy"
          decoding="async"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 group-hover:scale-105 ${
            imgLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* 3. 5-Segment Hover Scrub Bar */}
      {hasThumbs && isHovered && (
        <HoverScrubber currentIndex={frameIndex} totalSegments={5} />
      )}

      {/* 4. Top Badges */}
      <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none">
        {isShort ? (
          <span className="px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-fuchsia-300 font-mono text-[9px] font-bold tracking-wider uppercase border border-fuchsia-500/30 flex items-center gap-1 shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
            SHORTS
          </span>
        ) : isVideo ? (
          <span className="px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-amber-300 font-mono text-[9px] font-bold tracking-wider uppercase border border-amber-500/30 flex items-center gap-1 shadow-md">
            <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
            CLIP
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-cyan-300 font-mono text-[9px] font-bold tracking-wider uppercase border border-cyan-500/30 flex items-center gap-1 shadow-md">
            <Camera className="w-2.5 h-2.5" />
            PHOTO
          </span>
        )}
      </div>

      {/* 5. Play Button Overlay on Hover for Videos */}
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/35 backdrop-blur-[1px] pointer-events-none z-20">
          <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-[0_0_20px_rgba(0,229,255,0.35)] group-hover:scale-110 transition-transform">
            <Play className="w-4 h-4 fill-current ml-0.5 text-[#00E5FF]" />
          </div>
        </div>
      )}

      {/* 6. Bottom Title & Metadata Bar */}
      <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/95 via-black/55 to-transparent z-20 pointer-events-none flex flex-col justify-end">
        <span className="text-xs sm:text-sm font-semibold text-white line-clamp-1 drop-shadow">
          {item.title}
        </span>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider truncate">
            {item.albumTitle}
          </span>
          {isShort && (
            <span className="text-[9px] font-mono px-1 rounded bg-black/60 text-zinc-400 border border-white/10">
              9:16
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
