import React from 'react';
import type { StageMediaItem } from '../../types';
import { resolveStaticVideoThumbnail } from '../../utils/thumbnailResolver';
import { getMediaUrl } from '../../utils/imageUrlResolver';

export interface HomepageSlidingShortsProps {
  shorts: StageMediaItem[];
  onOpenShort: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
}

export const HomepageSlidingShorts: React.FC<HomepageSlidingShortsProps> = ({
  shorts,
  onOpenShort,
}) => {
  if (!shorts || shorts.length === 0) return null;

  // Duplicate the list to create an infinite right-to-left glide
  const displayList = shorts.length < 8 ? [...shorts, ...shorts, ...shorts] : [...shorts, ...shorts];

  return (
    <div
      className="w-full h-full flex items-center justify-center overflow-hidden relative select-none"
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
    >
      <div
        className="flex gap-4 sm:gap-6 w-max animate-homepage-slide hover:[animation-play-state:paused]"
        style={{
          borderRadius: 0,
          outline: 'none',
          border: 'none',
        }}
      >
        {displayList.map((item, idx) => {
          const imageSrc =
            (item as any).thumbnail ||
            resolveStaticVideoThumbnail(item) ||
            item.poster ||
            getMediaUrl(item.url || '');

          return (
            <div
              key={`${item.id || item.url || item.name}-${idx}`}
              onClick={() => onOpenShort(item, shorts, idx % shorts.length)}
              className="w-[220px] sm:w-[260px] h-[390px] sm:h-[460px] aspect-[9/16] bg-black flex-shrink-0 cursor-pointer overflow-hidden transition-transform duration-300 hover:scale-[1.04] hover:z-20 relative"
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              <img
                src={imageSrc}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover block filter saturate-[0.95] contrast-[1.05]"
                style={{ borderRadius: 0, outline: 'none', border: 'none' }}
              />
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes homepageSlide {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-homepage-slide {
          animation: homepageSlide 36s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default HomepageSlidingShorts;
