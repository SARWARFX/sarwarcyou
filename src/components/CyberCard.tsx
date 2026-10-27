import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Play, Camera, Film } from 'lucide-react';
import type { StageMediaItem } from '../types';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';
import { isVideoExtension } from '../utils/mediaTypeDetector';
import { getMediaUrl } from '../utils/imageUrlResolver';

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
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Viewport observer to only run cycling when card is visible
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting);
      },
      { rootMargin: '150px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 10-Second Auto-Cycling for Multi-Item Albums
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

  const isShort =
    variant === 'shorts' ||
    Boolean(
      activeItem.mediaType === 'short' ||
      activeItem.category?.toLowerCase().includes('short') ||
      activeItem.category?.toLowerCase().includes('reel') ||
      activeItem.url?.toLowerCase().includes('/shorts/') ||
      activeItem.id?.toLowerCase().includes('shorts')
    );

  const isVideo =
    isShort ||
    activeItem.type === 'video' ||
    activeItem.mediaType === 'clip' ||
    isVideoExtension(activeItem.url || activeItem.id || activeItem.path);

  // Clean media URL via Cloudflare Edge proxy
  const cleanMediaUrl = useMemo(() => {
    return getMediaUrl(activeItem.url || activeItem.path || activeItem.id);
  }, [activeItem.url, activeItem.path, activeItem.id]);

  const cleanTitle = useMemo(() => {
    return sanitizeMediaTitle(activeItem.title || activeItem.name, activeItem.category);
  }, [activeItem.title, activeItem.name, activeItem.category]);

  const cleanCategory = useMemo(() => {
    if (activeItem.category) {
      return activeItem.category.replace(/[-_]+/g, ' ').trim();
    }
    return isVideo ? 'Cinema' : 'Photography';
  }, [activeItem.category, isVideo]);

  // If item is a photo or has a valid non-video poster image
  const posterImage = useMemo(() => {
    if (!isVideo) {
      return cleanMediaUrl;
    }
    if (activeItem.poster && !isVideoExtension(activeItem.poster)) {
      return getMediaUrl(activeItem.poster);
    }
    if (activeItem.posterUrl && !isVideoExtension(activeItem.posterUrl)) {
      return getMediaUrl(activeItem.posterUrl);
    }
    if (activeItem.thumbnail && !isVideoExtension(activeItem.thumbnail)) {
      return getMediaUrl(activeItem.thumbnail);
    }
    return null;
  }, [isVideo, cleanMediaUrl, activeItem.poster, activeItem.posterUrl, activeItem.thumbnail]);

  // Aspect Ratio & Sizing
  const effectiveVariant = isShort ? 'shorts' : (isVideo && variant === 'photo' ? 'standard' : variant);

  const sizeClass = {
    standard: 'w-[250px] sm:w-[280px] md:w-[310px] aspect-video',
    shorts: 'w-[150px] sm:w-[175px] md:w-[200px] aspect-[9/16]',
    photo: 'w-[160px] sm:w-[185px] md:w-[210px] aspect-[2/3]',
  }[effectiveVariant];

  return (
    <div
      ref={cardRef}
      onClick={() => onClick(activeItem)}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(activeItem);
        }
      }}
      className={`group relative flex-shrink-0 cursor-pointer select-none rounded-xl overflow-hidden bg-[#0c0d12] border border-white/10 transition-all duration-200 ease-out hover:scale-[1.03] hover:border-[#00E5FF]/50 hover:shadow-[0_10px_30px_rgba(0,0,0,0.8)] hover:z-20 ${sizeClass}`}
      style={{
        contain: 'paint',
        transform: 'translateZ(0)',
      }}
    >
      {/* 1. Card Base Layout: Dark Cyberpunk Placeholder & Meta */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#13141c] via-[#0b0c10] to-[#050608] flex flex-col justify-between p-3 z-0">
        <div className="flex items-center justify-between">
          <div className="w-6 h-6 rounded-full bg-white/[0.07] flex items-center justify-center">
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

        {/* Center Prominent Play Indicator for Videos */}
        {isVideo && (
          <div className="flex flex-col items-center justify-center my-auto">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/10 group-hover:bg-[#00E5FF]/20 border border-white/20 group-hover:border-[#00E5FF]/60 flex items-center justify-center text-white group-hover:text-[#00E5FF] transition-all duration-200 shadow-md group-hover:scale-110">
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
            </div>
            <span className="text-[10px] font-mono text-zinc-400 tracking-wider uppercase mt-2 group-hover:text-zinc-200">
              {isShort ? 'Watch Reel' : 'Watch Video'}
            </span>
          </div>
        )}

        {!isShort && (
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-zinc-200 truncate">{cleanTitle}</span>
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">{cleanCategory}</span>
          </div>
        )}
      </div>

      {/* 2. Lazy Image Layer (Rendered only when a valid image exists) */}
      {posterImage && (
        <img
          key={posterImage}
          src={posterImage}
          alt={cleanTitle}
          loading="lazy"
          decoding="async"
          onLoad={() => setImageLoaded(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 group-hover:scale-105 z-10 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* 3. Category Corner Badge */}
      <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none">
        {isShort ? (
          <span className="px-2 py-0.5 rounded-full bg-black/80 text-fuchsia-300 font-mono text-[9px] font-bold tracking-wider uppercase border border-fuchsia-500/30 flex items-center gap-1 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
            SHORTS
          </span>
        ) : isVideo ? (
          <span className="px-2 py-0.5 rounded-full bg-black/80 text-amber-300 font-mono text-[9px] font-bold tracking-wider uppercase border border-amber-500/30 flex items-center gap-1 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            CLIPS
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-black/80 text-cyan-300 font-mono text-[9px] font-bold tracking-wider uppercase border border-cyan-500/30 flex items-center gap-1 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            PHOTO
          </span>
        )}
      </div>

      {/* 4. Corner Counter Badge for Multi-Item Albums */}
      {totalAlbumItems > 1 && (
        <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none">
          <span className="px-2 py-0.5 rounded-full bg-black/85 text-white/90 font-mono text-[9px] font-bold border border-white/10 shadow-sm">
            {(currentPreviewIndex % totalAlbumItems) + 1} / {totalAlbumItems}
          </span>
        </div>
      )}

      {/* 5. Center Play Icon Overlay on Image on Desktop Hover */}
      {isVideo && posterImage && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/30 pointer-events-none z-20">
          <div className="w-11 h-11 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-[#00E5FF] shadow-[0_0_20px_rgba(0,229,255,0.4)]">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        </div>
      )}

      {/* 6. Bottom Metadata Bar for Shorts */}
      {isShort && (
        <div className="absolute bottom-0 inset-x-0 p-2.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-20 pointer-events-none flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-zinc-300 min-w-0 pr-1">
            <Film className="w-3 h-3 text-fuchsia-400 flex-shrink-0" />
            <span className="text-[10px] font-sans font-bold text-white truncate">
              {cleanTitle}
            </span>
          </div>
          <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-black/80 text-zinc-300 border border-white/10 flex-shrink-0">
            9:16
          </span>
        </div>
      )}

      {/* Ambient Gloss Highlight on Desktop Hover */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-cyan-400/[0.02] to-white/[0.05] opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-25" />
    </div>
  );
};

export default CyberCard;
