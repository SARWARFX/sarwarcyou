import React, { useRef, useMemo } from 'react';
import type { StageMediaItem } from '../../types';
import { getMediaUrl } from '../../utils/imageUrlResolver';

export interface PhotographsSlidingFeaturedProps {
  photos: StageMediaItem[];
  onOpenPhoto: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  randomSeed?: number;
}

/**
 * Photographs Featured Showcase:
 * - Dynamically picks 20 random photographs from the vault
 * - Slides smoothly and infinitely from right to left in a continuous loop
 * - Zero rounded corners, zero outlines, zero text
 * - Enlarges on hover, pauses animation on hover
 * - Click launches the full high-res photo viewer
 */
export const PhotographsSlidingFeatured: React.FC<PhotographsSlidingFeaturedProps> = ({
  photos,
  onOpenPhoto,
  randomSeed,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Pick 20 random photographs dynamically on visit or randomSeed change
  const selected20 = useMemo(() => {
    if (!photos || photos.length === 0) return [];
    const pool = [...photos];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 20);
  }, [photos, randomSeed]);

  // Duplicate the 20 photos for a seamless infinite loop
  const displayList = useMemo(() => {
    if (selected20.length === 0) return [];
    return [...selected20, ...selected20];
  }, [selected20]);

  if (selected20.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-start overflow-hidden relative select-none pl-6 sm:pl-10"
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
    >
      <div
        className="flex gap-4 sm:gap-6 w-max animate-photos-slow-slide hover:[animation-play-state:paused]"
        style={{
          borderRadius: 0,
          outline: 'none',
          border: 'none',
          willChange: 'transform',
          transform: 'translate3d(0, 0, 0)',
        }}
      >
        {displayList.map((item, idx) => {
          const imageSrc =
            item.thumbnail ||
            item.poster ||
            getMediaUrl(item.url || item.path || '');

          const actualIndex = idx % selected20.length;

          return (
            <div
              key={`${item.id || item.url || item.name}-${idx}`}
              data-card-index={idx}
              onClick={() => onOpenPhoto(item, selected20, actualIndex)}
              className="w-[155px] sm:w-[200px] md:w-[260px] h-[275px] sm:h-[356px] md:h-[462px] aspect-[9/16] bg-[#080b12] flex-shrink-0 cursor-pointer overflow-hidden transition-transform duration-300 hover:scale-[1.04] hover:z-20 relative select-none"
              style={{
                borderRadius: 0,
                outline: 'none',
                border: 'none',
                willChange: 'transform',
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
              }}
            >
              <img
                src={imageSrc}
                alt={item.name || ''}
                loading={idx < 8 ? 'eager' : 'lazy'}
                className="w-full h-full object-cover block filter saturate-[0.98] contrast-[1.03]"
                style={{
                  borderRadius: 0,
                  outline: 'none',
                  border: 'none',
                  transform: 'translateZ(0)',
                }}
              />
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes photosSlowSlide {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }
        .animate-photos-slow-slide {
          animation: photosSlowSlide 90s linear infinite;
          will-change: transform;
          transform: translate3d(0, 0, 0);
          backface-visibility: hidden;
        }
      `}</style>
    </div>
  );
};

export default PhotographsSlidingFeatured;
