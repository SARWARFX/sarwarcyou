import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play, Flame } from 'lucide-react';
import type { StageMediaItem } from '../types';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';
import { getMediaUrl } from '../utils/imageUrlResolver';
import { isVideoExtension } from '../utils/mediaTypeDetector';
import { getCachedVideoThumbnail, generateVideoThumbnail } from '../utils/videoThumbnailGenerator';

export interface ShortsReelsRibbonProps {
  shorts: StageMediaItem[];
  onSelectShort: (item: StageMediaItem, index: number) => void;
  onViewAll?: () => void;
  className?: string;
}

const ShortCardItem: React.FC<{
  item: StageMediaItem;
  index: number;
  onSelect: (item: StageMediaItem, index: number) => void;
}> = ({ item, index, onSelect }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isInViewport, setIsInViewport] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const cleanTitle = sanitizeMediaTitle(item.title || item.name || `Short #${index + 1}`, item.category);
  const cleanMediaUrl = getMediaUrl(item.url || item.path || item.id);

  const staticPoster =
    item.thumbnails?.[0] ||
    item.posterUrl ||
    item.poster ||
    item.thumbnail;

  const posterSrc = staticPoster && !isVideoExtension(staticPoster) ? getMediaUrl(staticPoster) : null;

  const [videoThumb, setVideoThumb] = useState<string | null>(() => {
    return !posterSrc ? getCachedVideoThumbnail(cleanMediaUrl) : null;
  });

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting);
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (posterSrc || !isInViewport) return;

    const cached = getCachedVideoThumbnail(cleanMediaUrl);
    if (cached) {
      setVideoThumb(cached);
      return;
    }

    let isSubscribed = true;
    generateVideoThumbnail(cleanMediaUrl, '9/16').then((dataUrl) => {
      if (isSubscribed && dataUrl) {
        setVideoThumb(dataUrl);
      }
    });

    return () => {
      isSubscribed = false;
    };
  }, [posterSrc, cleanMediaUrl, isInViewport]);

  const displayImage = posterSrc || videoThumb;

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item, index)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(item, index);
        }
      }}
      aria-label={`Play short: ${cleanTitle}`}
      className="group relative flex-shrink-0 w-[140px] sm:w-[170px] md:w-[195px] aspect-[9/16] rounded-2xl overflow-hidden cursor-pointer select-none bg-zinc-950 border border-white/10 hover:border-red-500/60 shadow-lg hover:shadow-[0_0_25px_rgba(239,68,68,0.3)] transition-all duration-300 transform hover:-translate-y-1.5 snap-start"
    >
      {/* Background Poster Image */}
      {displayImage ? (
        <img
          src={displayImage}
          alt={cleanTitle}
          loading="lazy"
          decoding="async"
          onLoad={() => setImgLoaded(true)}
          className={`w-full h-full object-cover object-center transition-all duration-500 group-hover:scale-108 ${
            imgLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-neutral-900 to-black flex items-center justify-center">
          <Play className="w-8 h-8 text-white/20" />
        </div>
      )}

      {/* Top Red Shorts Badge */}
      <div className="absolute top-2.5 left-2.5 z-10">
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-600/90 text-white font-bold text-[10px] tracking-wider uppercase backdrop-blur-md shadow-[0_2px_8px_rgba(239,68,68,0.5)]">
          <Flame className="w-3 h-3 fill-current" />
          <span>Shorts</span>
        </span>
      </div>

      {/* Hover Center Play Pulse Indicator */}
      <div className="absolute inset-0 flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <div className="w-11 h-11 rounded-full bg-red-600/80 backdrop-blur-md text-white flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.7)] transform scale-90 group-hover:scale-100 transition-transform">
          <Play className="w-5 h-5 fill-current ml-0.5" />
        </div>
      </div>

      {/* Bottom Translucent Title Gradient */}
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black via-black/60 to-transparent z-10 flex flex-col justify-end p-2.5 sm:p-3 pointer-events-none">
        <p className="text-white font-semibold text-xs sm:text-sm line-clamp-2 leading-snug drop-shadow-md">
          {cleanTitle}
        </p>
        {item.category && (
          <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider truncate mt-0.5">
            {item.category}
          </span>
        )}
      </div>
    </div>
  );
};

export const ShortsReelsRibbon: React.FC<ShortsReelsRibbonProps> = ({
  shorts,
  onSelectShort,
  onViewAll,
  className = '',
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [shorts]);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = trackRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (!shorts || shorts.length === 0) return null;

  return (
    <section className={`w-full flex flex-col gap-3 select-none ${className}`}>
      {/* Header with Title and Scroll Controls */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-red-600/15 border border-red-500/30 text-red-500">
            <Flame className="w-4 h-4 fill-current" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Shorts & Reels</span>
              <span className="text-xs font-mono text-zinc-500 font-normal">({shorts.length})</span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer mr-2"
            >
              View all
            </button>
          )}

          {/* Desktop Left / Right Scroll Chevrons */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleScroll('left')}
              disabled={!canScrollLeft}
              aria-label="Scroll left"
              className={`p-2 rounded-full border border-white/10 transition-all ${
                canScrollLeft
                  ? 'bg-white/5 hover:bg-white/15 text-white cursor-pointer active:scale-95'
                  : 'bg-white/[0.02] text-zinc-600 border-white/5 cursor-not-allowed opacity-40'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleScroll('right')}
              disabled={!canScrollRight}
              aria-label="Scroll right"
              className={`p-2 rounded-full border border-white/10 transition-all ${
                canScrollRight
                  ? 'bg-white/5 hover:bg-white/15 text-white cursor-pointer active:scale-95'
                  : 'bg-white/[0.02] text-zinc-600 border-white/5 cursor-not-allowed opacity-40'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Scroll Shelf */}
      <div
        ref={trackRef}
        onScroll={checkScroll}
        className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar scrollbar-none py-2 px-1 snap-x snap-mandatory"
      >
        {shorts.map((short, idx) => (
          <ShortCardItem
            key={short.id || short.url || idx}
            item={short}
            index={idx}
            onSelect={onSelectShort}
          />
        ))}
      </div>
    </section>
  );
};

export default ShortsReelsRibbon;
