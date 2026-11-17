import React, { useRef } from 'react';
import type { StageMediaItem } from '../../types';
import { getMediaUrl } from '../../utils/imageUrlResolver';

export interface BandhobiSlidingFeaturedPhotosProps {
  photos: StageMediaItem[];
  onOpenPhoto: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
}

/**
 * Bandhobi Featured Showcase
 * - Displays user-selected photos sliding smoothly from right to left
 * - Starts directly on screen (filling from the left edge)
 * - Zero rounded corners, zero outlines, zero text
 * - Enlarges slightly on hover
 * - Click launches the full photo viewer
 */
export const BandhobiSlidingFeaturedPhotos: React.FC<BandhobiSlidingFeaturedPhotosProps> = ({
  photos,
  onOpenPhoto,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Duplicate list if needed for continuous, seamless sliding loop
  const displayList = React.useMemo(() => {
    if (!photos || photos.length === 0) return [];
    if (photos.length < 10) {
      return [...photos, ...photos, ...photos];
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
        className="flex gap-4 sm:gap-6 w-max animate-homepage-slow-slide hover:[animation-play-state:paused]"
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
              onClick={() => onOpenPhoto(item, photos, actualIndex)}
              className="w-[210px] sm:w-[250px] md:w-[280px] h-[280px] sm:h-[333px] md:h-[373px] aspect-[3/4] bg-[#080b12] flex-shrink-0 cursor-pointer overflow-hidden transition-transform duration-300 hover:scale-[1.04] hover:z-20 relative"
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              <img
                src={imageSrc}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover block filter saturate-[0.98] contrast-[1.03]"
                style={{ borderRadius: 0, outline: 'none', border: 'none' }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BandhobiSlidingFeaturedPhotos;
