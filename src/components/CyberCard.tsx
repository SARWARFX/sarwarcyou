import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import type { StageMediaItem } from '../types';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';
import { isVideoExtension } from '../utils/mediaTypeDetector';
import { getMediaUrl } from '../utils/imageUrlResolver';
import { generateVideoThumbnail, getCachedVideoThumbnail } from '../utils/videoThumbnailGenerator';

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

  // Viewport observer to pause cycling & control offscreen media
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

  // Visual thumbnail state for video files without static poster image
  const [videoThumb, setVideoThumb] = useState<string | null>(() => {
    return isVideo && !posterImage ? getCachedVideoThumbnail(cleanMediaUrl) : null;
  });

  useEffect(() => {
    if (!isVideo || posterImage) return;

    const cached = getCachedVideoThumbnail(cleanMediaUrl);
    if (cached) {
      setVideoThumb(cached);
      return;
    }

    if (isInViewport) {
      let isSubscribed = true;
      generateVideoThumbnail(cleanMediaUrl, isShort ? '9/16' : '16/9').then((dataUrl) => {
        if (isSubscribed && dataUrl) {
          setVideoThumb(dataUrl);
        }
      });
      return () => {
        isSubscribed = false;
      };
    }
  }, [isVideo, posterImage, cleanMediaUrl, isInViewport, isShort]);

  const effectiveVariant = isShort ? 'shorts' : (isVideo && variant === 'photo' ? 'standard' : variant);

  const sizeClass = {
    standard: 'w-[220px] sm:w-[250px] aspect-video',
    shorts: 'w-[130px] sm:w-[150px] aspect-[9/16]',
    photo: 'w-[140px] sm:w-[160px] aspect-[3/4]',
  }[effectiveVariant];

  const displayImageSrc = posterImage || videoThumb;

  return (
    <div
      ref={cardRef}
      onClick={() => onClick(activeItem)}
      role="button"
      tabIndex={0}
      data-media-card="true"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(activeItem);
        }
      }}
      className={`media-card group relative flex-shrink-0 cursor-pointer select-none rounded-lg overflow-hidden bg-[var(--card-bg)] transition-transform duration-150 active:scale-95 ${sizeClass}`}
      style={{
        border: 'none',
        outline: 'none',
        boxShadow: 'none',
        contain: 'paint',
        transform: 'translateZ(0)',
      }}
    >
      {/* 1. Visual Thumbnail Layer (Captured canvas frame or photo image) */}
      {displayImageSrc ? (
        <img
          key={displayImageSrc}
          src={displayImageSrc}
          alt={cleanTitle}
          loading="lazy"
          decoding="async"
          onLoad={() => setImageLoaded(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 z-10 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : isVideo && isInViewport ? (
        /* 2. Direct Hardware-Accelerated Poster Fallback (Seeked to 1.0s, only while visible) */
        <video
          src={cleanMediaUrl.includes('#') ? cleanMediaUrl : `${cleanMediaUrl}#t=1.0`}
          preload="metadata"
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
        />
      ) : null}

      {/* 3. Center Play Icon Overlay for Videos */}
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-20">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/60 flex items-center justify-center text-white shadow-sm">
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          </div>
        </div>
      )}

      {/* 4. Clean File Name Bar (Single-Line CSS Ellipsis Truncation, max-width: 120px) */}
      <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/85 via-black/45 to-transparent z-20 pointer-events-none flex items-center">
        <span
          title={cleanTitle}
          className="text-[11px] font-sans font-medium text-white block truncate drop-shadow-sm"
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
