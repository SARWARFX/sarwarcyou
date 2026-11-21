import React, { useRef, useMemo, useState, useEffect } from 'react';
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
 * - High-Tech Cybernetic Text-as-Slider loader ensures bufferless readiness
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
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isPlaybackReady, setIsPlaybackReady] = useState(false);

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

  // Buffer Gate: Preload initial batch of photographs for bufferless presentation
  useEffect(() => {
    if (selected20.length === 0) {
      setIsPlaybackReady(true);
      return;
    }

    setIsPlaybackReady(false);
    setDisplayProgress(0);

    const initialBatch = selected20.slice(0, Math.min(8, selected20.length));
    const total = initialBatch.length;
    let loadedCount = 0;
    let isCancelled = false;

    const checkComplete = () => {
      loadedCount++;
      const pct = Math.min(95, Math.round((loadedCount / total) * 100));
      setDisplayProgress(pct);

      if (loadedCount >= total) {
        setDisplayProgress(100);
        setTimeout(() => {
          if (!isCancelled) {
            setIsPlaybackReady(true);
          }
        }, 350);
      }
    };

    initialBatch.forEach((item) => {
      const src =
        item.thumbnail ||
        item.poster ||
        getMediaUrl(item.url || item.path || '');

      let done = false;
      const onImageLoaded = () => {
        if (done) return;
        done = true;
        checkComplete();
      };

      const img = new Image();
      img.onload = onImageLoaded;
      img.onerror = onImageLoaded;
      img.src = src;

      if (img.complete && img.naturalWidth > 0) {
        onImageLoaded();
      }
    });

    const safetyTimer = setTimeout(() => {
      if (!isCancelled && loadedCount < total) {
        setDisplayProgress(100);
        setTimeout(() => {
          if (!isCancelled) setIsPlaybackReady(true);
        }, 200);
      }
    }, 2800);

    return () => {
      isCancelled = true;
      clearTimeout(safetyTimer);
    };
  }, [selected20]);

  if (selected20.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-start overflow-hidden relative select-none pl-6 sm:pl-10"
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
    >
      {/* High-Tech Cybernetic Text-as-Slider Loading: Color fills left-to-right as progress */}
      {!isPlaybackReady && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-transparent pointer-events-none select-none px-4">
          <div
            className="relative inline-block font-bold uppercase select-none text-base sm:text-lg md:text-xl tracking-[0.22em] whitespace-nowrap"
            style={{ fontFamily: "'Science Gothic', sans-serif" }}
          >
            {/* Base Layer: Initial two-color dimmed state */}
            <div className="opacity-25 transition-opacity duration-300">
              <span className="text-white">INITIALIZING </span>
              <span className="text-[#38bdf8]">ARCHIVE</span>
            </div>

            {/* Active Progress Layer: Fills in glowing vibrant colors from left to the very right edge */}
            <div
              className="absolute inset-y-0 left-0 overflow-hidden transition-[width] duration-300 ease-out"
              style={{
                width: `${displayProgress}%`,
                borderRight: displayProgress < 100 ? '2px solid #38bdf8' : 'none',
                boxShadow: displayProgress < 100 ? '2px 0 10px rgba(56,189,248,0.85)' : 'none',
              }}
            >
              <div className="whitespace-nowrap">
                <span className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]">INITIALIZING </span>
                <span className="text-[#38bdf8] drop-shadow-[0_0_12px_#38bdf8]">ARCHIVE</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sliding Strip: Only revealed bufferlessly when 100% loaded */}
      <div
        className={`flex gap-4 sm:gap-6 w-max transition-opacity duration-700 ${
          isPlaybackReady
            ? 'opacity-100 animate-photos-slow-slide hover:[animation-play-state:paused]'
            : 'opacity-0 pointer-events-none'
        }`}
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
