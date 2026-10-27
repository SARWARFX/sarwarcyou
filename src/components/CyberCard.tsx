import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
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
  const [imageLoaded, setImageLoaded] = useState(false);

  // Viewport observer to pause cycling when card is offscreen
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

  const totalAlbumItems = albumItems && albumItems.length > 0 ? albumItems.length : 0;
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(initialIndex ?? 0);

  useEffect(() => {
    if (initialIndex !== undefined) {
      setCurrentPreviewIndex(initialIndex);
    }
  }, [initialIndex]);

  useEffect(() => {
    if (!isInViewport || totalAlbumItems <= 1) return;

    const intervalId = setInterval(() => {
      setCurrentPreviewIndex((prev) => (prev + 1) % totalAlbumItems);
    }, 10000);

    return () => clearInterval(intervalId);
  }, [isInViewport, totalAlbumItems]);

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

  // Non-video poster image resolution
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

  const effectiveVariant = isShort ? 'shorts' : (isVideo && variant === 'photo' ? 'standard' : variant);

  const sizeClass = {
    standard: 'w-[220px] sm:w-[250px] aspect-video',
    shorts: 'w-[130px] sm:w-[150px] aspect-[9/16]',
    photo: 'w-[140px] sm:w-[160px] aspect-[3/4]',
  }[effectiveVariant];

  return (
    <div
      ref={cardRef}
      onClick={() => onClick(activeItem)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(activeItem);
        }
      }}
      className={`group relative flex-shrink-0 cursor-pointer select-none rounded-xl overflow-hidden bg-[#0c0d12] border border-white/10 hover:border-white/40 transition-transform duration-150 active:scale-95 ${sizeClass}`}
      style={{
        contain: 'paint',
        transform: 'translateZ(0)',
      }}
    >
      {/* 1. Minimal Card Base / Fallback */}
      <div className="absolute inset-0 bg-[#0e0f14] flex flex-col items-center justify-center p-2 z-0">
        {isVideo && (
          <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-sm">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        )}
      </div>

      {/* 2. Lazy Poster / Thumbnail Layer */}
      {posterImage && (
        <img
          key={posterImage}
          src={posterImage}
          alt={cleanTitle}
          loading="lazy"
          decoding="async"
          onLoad={() => setImageLoaded(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 z-10 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* 3. Center Play Icon Overlay for Videos with Poster */}
      {isVideo && posterImage && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none z-20">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/60 border border-white/30 flex items-center justify-center text-white shadow-md">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        </div>
      )}

      {/* 4. Clean File Name Bar (Single-Line CSS Ellipsis Truncation, max-width: 120px) */}
      <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-20 pointer-events-none flex items-center">
        <span
          title={cleanTitle}
          className="text-[11px] font-sans font-medium text-zinc-100 block truncate"
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '120px',
          }}
        >
          {cleanTitle}
        </span>
      </div>
    </div>
  );
};

export default CyberCard;
