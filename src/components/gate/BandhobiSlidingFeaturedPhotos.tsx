import React, { useRef, useMemo, useState, useEffect } from 'react';
import type { StageMediaItem } from '../../types';
import { getMediaUrl } from '../../utils/imageUrlResolver';

export interface BandhobiSlidingFeaturedPhotosProps {
  photos: StageMediaItem[];
  onOpenPhoto: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
}

/**
 * Bandhobi Featured Showcase
 * - Displays selected photos sliding smoothly and infinitely from right to left
 * - High-Tech Cybernetic Text-as-Slider loader ensures bufferless readiness
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
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isPlaybackReady, setIsPlaybackReady] = useState(false);

  // Seamless infinite loop: duplicate list
  const displayList = useMemo(() => {
    if (!photos || photos.length === 0) return [];
    if (photos.length < 6) {
      return [...photos, ...photos, ...photos, ...photos];
    }
    return [...photos, ...photos];
  }, [photos]);

  // Buffer Gate: Preload initial batch of photos for bufferless presentation
  useEffect(() => {
    if (!photos || photos.length === 0) {
      setIsPlaybackReady(true);
      return;
    }

    setIsPlaybackReady(false);
    setDisplayProgress(0);

    const initialBatch = photos.slice(0, Math.min(8, photos.length));
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
      const img = new Image();
      img.onload = checkComplete;
      img.onerror = checkComplete;
      img.src = src;
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
  }, [photos]);

  if (!photos || photos.length === 0) return null;

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
            ? 'opacity-100 animate-bandhobi-slow-slide hover:[animation-play-state:paused]'
            : 'opacity-0 pointer-events-none'
        }`}
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
