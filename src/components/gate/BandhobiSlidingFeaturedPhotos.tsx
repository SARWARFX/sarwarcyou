import React, { useRef } from 'react';
import type { StageMediaItem } from '../../types';
import { getMediaUrl } from '../../utils/imageUrlResolver';

export interface BandhobiSlidingFeaturedPhotosProps {
  photos: StageMediaItem[];
  onOpenPhoto: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
}

/**
 * Bandhobi Featured Showcase
 * - Displays user's selected photos sliding smoothly and infinitely from right to left
 * - Starts directly on screen (filling from the left edge)
 * - Zero rounded corners, zero outlines, zero text
 * - Enlarges slightly on hover, pauses slide on hover
 * - Click launches the full photo viewer
 */
export const BandhobiSlidingFeaturedPhotos: React.FC<BandhobiSlidingFeaturedPhotosProps> = ({
  photos,
  onOpenPhoto,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Seamless infinite loop: duplicate list exactly once
  const displayList = React.useMemo(() => {
    if (!photos || photos.length === 0) return [];
    if (photos.length < 6) {
      return [...photos, ...photos, ...photos, ...photos];
    }
    return [...photos, ...photos];
  }, [photos]);

  if (!photos || photos.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-start overflow-hidden relative select-none pl-6 sm:pl-10"
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
    >
      <div
        className="flex gap-4 sm:gap-6 w-max animate-bandhobi-slow-slide hover:[animation-play-state:paused]"
        style={{
          borderRadius: 0,
          outline: 'none',
          border: 'none',
        }}
      >
        {displayList.map((item, idx) => {
          const imageSrc =
            item.thumbnail ||
            item.poster ||
            getMediaUrl(item.url || item.path || '');

          const actualIndex = idx % photos.length;

          return (
            <div
              key={`${item.id || item.url || item.name}-${idx}`}
              data-card-index={idx}
              onClick={() => onOpenPhoto(item, photos, actualIndex)}
              className="w-[200px] sm:w-[240px] md:w-[260px] h-[356px] sm:h-[426px] md:h-[462px] aspect-[9/16] bg-[#080b12] flex-shrink-0 cursor-pointer overflow-hidden transition-transform duration-300 hover:scale-[1.04] hover:z-20 relative"
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              <img
                src={imageSrc}
                alt=""
                loading={idx < 8 ? 'eager' : 'lazy'}
                className="w-full h-full object-cover block filter saturate-[0.98] contrast-[1.03]"
                style={{ borderRadius: 0, outline: 'none', border: 'none' }}
              />
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes bandhobiSlowSlide {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-bandhobi-slow-slide {
          animation: bandhobiSlowSlide 100s linear infinite;
          will-change: transform;
        }
      `}</style>
    </div>
  );
};

export default BandhobiSlidingFeaturedPhotos;
