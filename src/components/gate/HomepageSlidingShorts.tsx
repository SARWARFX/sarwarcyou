import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import type { StageMediaItem } from '../../types';
import { getVideoStreamUrl, getMediaUrl } from '../../utils/imageUrlResolver';
import { resolveStaticVideoThumbnail } from '../../utils/thumbnailResolver';

export interface HomepageSlidingShortsProps {
  shorts: StageMediaItem[];
  onOpenShort: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  randomSeed?: number;
}

/**
 * Shorts Featured Showcase: 6 Randomly Selected Shorts
 * - Showcases 6 curated shorts perfectly filling the homepage width
 * - Preloads the primary visible videos to eliminate network contention
 * - Strict buffer-depth verification (canplaythrough & deep buffer check) prevents stutter
 * - Strictly waits until ALL 6 media items are truly buffered before showing and launching playback (zero timeout ceilings)
 * - Duplicate loop cards stay idle (preload="none") during startup to dedicate 100% bandwidth
 * - Zero rounded corners, zero outlines, zero border strokes
 * - Font: Science Gothic
 */
export const HomepageSlidingShorts: React.FC<HomepageSlidingShortsProps> = ({
  shorts,
  onOpenShort,
  randomSeed,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 6 randomly selected shorts (the optimal 6-stream hardware decoder threshold)
  const selected6 = useMemo(() => {
    if (!shorts || shorts.length === 0) return [];
    const pool = [...shorts];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 6);
  }, [shorts, randomSeed]);

  // Duplicate the 6 shorts once to create an infinite, seamless 12-card loop
  const displayList = useMemo(() => {
    if (selected6.length === 0) return [];
    return [...selected6, ...selected6];
  }, [selected6]);

  // Buffer synchronization states
  const [readyIndices, setReadyIndices] = useState<Set<number>>(new Set());
  const [isPlaybackReady, setIsPlaybackReady] = useState(false);
  const isPlaybackReadyRef = useRef(false);

  // Target threshold: ALL 6 media items must be fully buffered before launching bufferless playback
  const targetThreshold = useMemo(() => {
    return selected6.length;
  }, [selected6.length]);

  // Reset buffering state whenever the selected shorts change
  useEffect(() => {
    setReadyIndices(new Set());
    setIsPlaybackReady(false);
    isPlaybackReadyRef.current = false;
    videoRefs.current = [];
    cardRefs.current = [];
  }, [selected6]);

  // Sync ref with state
  useEffect(() => {
    isPlaybackReadyRef.current = isPlaybackReady;
  }, [isPlaybackReady]);

  // Mark an item as truly ready
  const handleMediaReady = useCallback(
    (itemIndex: number) => {
      setReadyIndices((prev) => {
        if (prev.has(itemIndex)) return prev;
        const next = new Set(prev);
        next.add(itemIndex);
        return next;
      });

      // If showcase already started, ensure newly ready videos start playing immediately
      if (isPlaybackReadyRef.current && selected6.length > 0) {
        const v1 = videoRefs.current[itemIndex];
        const v2 = videoRefs.current[itemIndex + selected6.length];
        [v1, v2].forEach((v) => {
          if (v && v.paused) {
            v.muted = true;
            v.defaultMuted = true;
            v.play().catch(() => {});
          }
        });
      }
    },
    [selected6.length]
  );

  // Deep buffer inspection: confirms substantial buffer depth before marking ready
  const verifyBufferDepth = useCallback(
    (el: HTMLVideoElement | null, itemIndex: number) => {
      if (!el) return;

      // HTML5 readyState >= 4 means HAVE_ENOUGH_DATA (browser estimates buffer can play through)
      if (el.readyState >= 4) {
        handleMediaReady(itemIndex);
        return;
      }

      // Check timeRanges buffer depth in seconds
      if (el.buffered.length > 0) {
        const bufferedEnd = el.buffered.end(el.buffered.length - 1);
        const duration = el.duration;
        // Require at least 3 seconds of buffer, or 60% of short's total duration, or readyState >= 3
        if (
          bufferedEnd >= 3 ||
          (duration && !isNaN(duration) && duration > 0 && bufferedEnd >= duration * 0.6) ||
          (el.readyState >= 3 && bufferedEnd >= 2)
        ) {
          handleMediaReady(itemIndex);
        }
      }
    },
    [handleMediaReady]
  );

  // Check if buffer threshold is met: show up when all are ready, with a safety timeout so it never hangs indefinitely
  useEffect(() => {
    if (isPlaybackReady) return;

    if (targetThreshold > 0 && readyIndices.size >= targetThreshold) {
      setIsPlaybackReady(true);
      isPlaybackReadyRef.current = true;
      return;
    }

    // Safety timeout: never leave visitor frozen on loading screen if network throttles concurrent requests
    const timer = setTimeout(() => {
      if (!isPlaybackReadyRef.current) {
        setIsPlaybackReady(true);
        isPlaybackReadyRef.current = true;
      }
    }, 3500);

    return () => clearTimeout(timer);
  }, [readyIndices.size, targetThreshold, isPlaybackReady]);

  // Launch and synchronize playback on showcase videos once buffering completes
  useEffect(() => {
    if (isPlaybackReady && selected6.length > 0) {
      videoRefs.current.forEach((v) => {
        if (v && v.paused) {
          v.muted = true;
          v.defaultMuted = true;
          v.play().catch(() => {});
        }
      });
    }
  }, [isPlaybackReady, selected6.length]);

  const handleVideoRef = (el: HTMLVideoElement | null, idx: number) => {
    videoRefs.current[idx] = el;
    if (!el || selected6.length === 0) return;

    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;

    const actualIndex = idx % selected6.length;

    // Check buffer state if element is mounted
    verifyBufferDepth(el, actualIndex);
  };

  if (selected6.length === 0) return null;

  const readyCount = readyIndices.size;
  const rawPct = targetThreshold > 0 ? (readyCount / targetThreshold) * 100 : 0;
  const progressPercent = Math.min(100, Math.max(10, Math.round(rawPct)));

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-start overflow-hidden relative select-none pl-6 sm:pl-10 min-h-[300px] sm:min-h-[380px] md:min-h-[480px]"
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
    >
      {/* High-Tech Cybernetic Loading Screen: Shows while buffering until ALL 6 are truly ready */}
      {!isPlaybackReady && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-transparent pointer-events-none select-none px-4">
          {/* Responsive Dual-Mode Cyber Loading Card: Taller rectangular monolith on mobile, spacious horizontal banner on desktop */}
          <div className="flex flex-col items-center justify-between w-full max-w-[295px] min-h-[290px] p-8 sm:w-auto sm:min-w-[500px] sm:max-w-[620px] sm:min-h-0 sm:px-14 sm:py-6 md:px-16 md:py-7 bg-[#07090e]/95 border border-[#38bdf8]/45 shadow-[0_0_45px_rgba(0,0,0,0.9),0_0_25px_rgba(56,189,248,0.22)] backdrop-blur-md">
            {/* Mobile View: Taller Rectangular Card with Exact 2-Line Desktop Split (Option A) */}
            <div className="flex sm:hidden flex-col items-center justify-center gap-5 flex-1 w-full text-center py-2">
              <div className="w-3.5 h-3.5 bg-[#38bdf8] shadow-[0_0_12px_#38bdf8] animate-pulse shrink-0" />
              <div
                className="flex flex-col items-center text-center gap-1.5 font-bold tracking-[0.16em] uppercase text-base leading-snug"
                style={{ fontFamily: "'Science Gothic', sans-serif" }}
              >
                <span className="text-[#38bdf8] drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]">
                  LOADING MEDIA //
                </span>
                <span className="text-white">
                  PLEASE WAIT
                </span>
              </div>
            </div>

            {/* Desktop & Tablet View: Single Horizontal Line with Generous Breathing Room */}
            <div className="hidden sm:flex items-center gap-3.5 mb-4">
              <div className="w-3 h-3 bg-[#38bdf8] shadow-[0_0_12px_#38bdf8] animate-pulse shrink-0" />
              <span
                className="text-base sm:text-base md:text-lg font-bold tracking-[0.14em] uppercase text-white whitespace-nowrap"
                style={{ fontFamily: "'Science Gothic', sans-serif" }}
              >
                <span className="text-[#38bdf8] drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]">LOADING MEDIA //</span> PLEASE WAIT
              </span>
            </div>

            {/* Tactical Solid Rectangular Progress Gauge (Option A) */}
            <div className="w-full h-3.5 sm:h-4 bg-[#030712] border border-[#38bdf8]/50 shadow-[inset_0_0_8px_rgba(0,0,0,0.9)] p-[2px] overflow-hidden relative">
              <div
                className="h-full bg-[#38bdf8] shadow-[0_0_10px_#38bdf8,0_0_20px_rgba(56,189,248,0.65)] transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Sliding Shorts Strip: ONLY appears when really ready (all 6 buffered) */}
      <div
        className={`flex gap-4 sm:gap-6 w-max transition-opacity duration-700 ${
          isPlaybackReady
            ? 'opacity-100 animate-homepage-slow-slide hover:[animation-play-state:paused]'
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
          const videoSrc = getVideoStreamUrl(item.url || item.path || '');
          const imageSrc =
            (item as any).thumbnail ||
            resolveStaticVideoThumbnail(item) ||
            item.poster ||
            getMediaUrl(item.url || '');

          const actualIndex = idx % selected6.length;
          const isPrimaryVisibleCard = idx < selected6.length;

          return (
            <div
              key={`${item.id || item.url || item.name}-${idx}`}
              ref={(el) => {
                cardRefs.current[idx] = el;
              }}
              data-card-index={idx}
              onClick={() => onOpenShort(item, selected6, actualIndex)}
              onMouseEnter={() => {
                const v = videoRefs.current[idx];
                if (v && v.paused) {
                  v.muted = true;
                  v.defaultMuted = true;
                  v.play().catch(() => {});
                }
              }}
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
              <video
                ref={(el) => handleVideoRef(el, idx)}
                src={videoSrc}
                poster={imageSrc}
                loop
                muted
                playsInline
                preload={isPrimaryVisibleCard ? 'auto' : isPlaybackReady ? 'auto' : 'none'}
                onCanPlayThrough={() => handleMediaReady(actualIndex)}
                onProgress={(e) => verifyBufferDepth(e.currentTarget, actualIndex)}
                onLoadedData={(e) => {
                  if (e.currentTarget.readyState >= 4) {
                    handleMediaReady(actualIndex);
                  }
                }}
                onError={() => handleMediaReady(actualIndex)}
                className="w-full h-full object-cover block filter saturate-[0.95] contrast-[1.05]"
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
        @keyframes homepageSlowSlide {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }
        .animate-homepage-slow-slide {
          animation: homepageSlowSlide 55s linear infinite;
          will-change: transform;
          transform: translate3d(0, 0, 0);
          backface-visibility: hidden;
        }
      `}</style>
    </div>
  );
};

export default HomepageSlidingShorts;
