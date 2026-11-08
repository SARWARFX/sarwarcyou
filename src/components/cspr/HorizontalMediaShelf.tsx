import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import type { StageMediaItem } from '../../types';
import { getMediaUrl, getThumbnailUrl, getImageUrl } from '../../utils/imageUrlResolver';
import { resolveStaticVideoThumbnail } from '../../utils/thumbnailResolver';
import { sanitizeMediaTitle } from '../../utils/titleSanitizer';

export type ShelfAspectRatio = 'video' | 'vertical' | 'portrait';

export interface HorizontalMediaShelfProps {
  title: string;
  subtitle?: string;
  badge?: string;
  items: StageMediaItem[];
  aspectRatio: ShelfAspectRatio;
  onOpenItem: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
}

export const HorizontalMediaShelf: React.FC<HorizontalMediaShelfProps> = ({
  title,
  subtitle,
  badge,
  items,
  aspectRatio,
  onOpenItem,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  if (!items || items.length === 0) return null;

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  const scrollBy = (offset: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  // Dimensional card configuration based on requested aspect ratio
  const getCardClasses = () => {
    switch (aspectRatio) {
      case 'video': // 16:9 widescreen (Clips)
        return {
          container: 'w-[230px] sm:w-[270px] md:w-[320px] aspect-video',
          ratio: 'aspect-video',
          isVideo: true,
        };
      case 'vertical': // 9:16 vertical (Shorts)
        return {
          container: 'w-[130px] sm:w-[155px] md:w-[185px] aspect-[9/16]',
          ratio: 'aspect-[9/16]',
          isVideo: true,
        };
      case 'portrait': // 4:5 portrait (Photography)
      default:
        return {
          container: 'w-[150px] sm:w-[180px] md:w-[215px] aspect-[4/5]',
          ratio: 'aspect-[4/5]',
          isVideo: false,
        };
    }
  };

  const { container: cardContainerClass, ratio: cardRatioClass, isVideo } = getCardClasses();

  return (
    <section className="relative w-full py-4 group/shelf">
      {/* Shelf Header */}
      <div className="flex items-baseline justify-between px-4 sm:px-6 md:px-8 mb-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-['Audiowide',cursive,sans-serif] text-sm sm:text-base md:text-lg tracking-[0.18em] text-white uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {title}
          </h2>
          {subtitle && (
            <span className="text-[10px] sm:text-xs font-['Audiowide',cursive,sans-serif] tracking-[0.14em] text-neutral-400 uppercase hidden sm:inline">
              // {subtitle}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {badge && (
            <span className="text-[10px] sm:text-xs font-mono tracking-wider text-neutral-400 uppercase bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}

          {/* Desktop Left / Right Scroll Chevrons */}
          <div className="hidden md:flex items-center gap-1.5 ml-2">
            <button
              type="button"
              onClick={() => scrollBy(-420)}
              disabled={!canScrollLeft}
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/20 disabled:opacity-20 disabled:pointer-events-none text-white flex items-center justify-center transition-all cursor-pointer border border-white/10"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(420)}
              disabled={!canScrollRight}
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/20 disabled:opacity-20 disabled:pointer-events-none text-white flex items-center justify-center transition-all cursor-pointer border border-white/10"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Carousel Scroller */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 sm:gap-4 md:gap-5 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory px-4 sm:px-6 md:px-8 py-2"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {items.map((item, idx) => {
          const cleanTitle = sanitizeMediaTitle(item.title || item.name || '', title);
          const thumb =
            item.type === 'image'
              ? getMediaUrl(item.url || item.path || item.id)
              : getImageUrl(item) || getThumbnailUrl(item) || resolveStaticVideoThumbnail(item);

          return (
            <div
              key={item.id || item.url || idx}
              role="button"
              tabIndex={0}
              onClick={() => onOpenItem(item, items, idx)}
              className={`group/card flex-shrink-0 snap-start flex flex-col gap-1.5 cursor-pointer select-none text-left transition-all duration-300 transform hover:-translate-y-1 ${cardContainerClass}`}
            >
              {/* Card Media Preview Container */}
              <div
                className={`relative w-full ${cardRatioClass} rounded-2xl overflow-hidden bg-neutral-900/60 backdrop-blur-sm border-0 shadow-lg group-hover/card:shadow-2xl transition-all duration-300`}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt={cleanTitle}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) parent.classList.add('bg-neutral-900');
                    }}
                    className="w-full h-full object-cover object-center transition-transform duration-500 group-hover/card:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-neutral-950">
                    <Play className="w-6 h-6 text-neutral-500" />
                  </div>
                )}

                {/* Video / Shorts Play Button Overlay */}
                {isVideo && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 pointer-events-none bg-black/25">
                    <div className="w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow-xl transform scale-90 group-hover/card:scale-100 transition-transform">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>
                )}

                {/* Subtle Bottom Vignette on Card */}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
              </div>

              {/* Title Label */}
              <span className="text-[11px] sm:text-xs font-['Audiowide',cursive,sans-serif] uppercase font-normal line-clamp-1 leading-snug text-neutral-300 group-hover/card:text-white transition-colors px-0.5 tracking-[0.08em] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                {cleanTitle}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
};
