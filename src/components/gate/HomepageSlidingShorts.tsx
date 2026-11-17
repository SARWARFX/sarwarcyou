import React, { useRef } from 'react';
import type { StageMediaItem } from '../../types';
import { getVideoStreamUrl, getMediaUrl } from '../../utils/imageUrlResolver';
import { resolveStaticVideoThumbnail } from '../../utils/thumbnailResolver';

export interface HomepageSlidingShortsProps {
  shorts: StageMediaItem[];
  onOpenShort: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
}

/**
 * Homepage Showcase: Latest 10 Shorts
 * - Shows the latest 10 shorts
 * - All playing automatically (muted) all at once
 * - Starts directly on screen (filling from the left as many cards as fit)
 * - Slowly glides continuously from right to left
 * - Zero rounded corners, zero outlines, zero text
 * - Enlarges slightly on hover
 * - Click launches the real shorts player
 */
export const HomepageSlidingShorts: React.FC<HomepageSlidingShortsProps> = ({
  shorts,
  onOpenShort,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Strictly pick the latest 10 shorts
  const latest10 = React.useMemo(() => {
    if (!shorts || shorts.length === 0) return [];
    return shorts.slice(0, 10);
  }, [shorts]);

  // Duplicate the 10 shorts once to create an infinite, seamless loop
  const displayList = React.useMemo(() => {
    if (latest10.length === 0) return [];
    return [...latest10, ...latest10];
  }, [latest10]);

  // Ensure all videos play simultaneously (muted) without autoplay lock
  const setVideoRef = (el: HTMLVideoElement | null) => {
    if (el) {
      el.muted = true;
      el.defaultMuted = true;
      el.play().catch(() => {});
    }
  };

  if (latest10.length === 0) return null;

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
          const videoSrc = getVideoStreamUrl(item.url || item.path || '');
          const imageSrc =
            (item as any).thumbnail ||
            resolveStaticVideoThumbnail(item) ||
            item.poster ||
            getMediaUrl(item.url || '');

          const actualIndex = idx % latest10.length;

          return (
            <div
              key={`${item.id || item.url || item.name}-${idx}`}
              onClick={() => onOpenShort(item, latest10, actualIndex)}
              className="w-[200px] sm:w-[240px] md:w-[260px] h-[356px] sm:h-[426px] md:h-[462px] aspect-[9/16] bg-black flex-shrink-0 cursor-pointer overflow-hidden transition-transform duration-300 hover:scale-[1.04] hover:z-20 relative"
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              <video
                ref={setVideoRef}
                src={videoSrc}
                poster={imageSrc}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                className="w-full h-full object-cover block filter saturate-[0.95] contrast-[1.05]"
                style={{ borderRadius: 0, outline: 'none', border: 'none' }}
              />
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes homepageSlowSlide {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-homepage-slow-slide {
          animation: homepageSlowSlide 95s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default HomepageSlidingShorts;
