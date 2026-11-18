import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import type { StageMediaItem } from '../../types';
import { getVideoStreamUrl, getMediaUrl } from '../../utils/imageUrlResolver';
import { resolveStaticVideoThumbnail } from '../../utils/thumbnailResolver';
import { CryoFluidCanvas } from './CryoFluidCanvas';

export interface HomepageSlidingShortsProps {
  shorts: StageMediaItem[];
  onOpenShort: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  randomSeed?: number;
}

/**
 * Shorts Featured Showcase: 10 Randomly Selected Shorts
 * - Showcases 10 curated shorts perfectly filling the homepage width
 * - Preloads the primary visible videos to eliminate network contention
 * - Strict buffer-depth verification (canplaythrough & deep buffer check) prevents stutter
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

  // 10 randomly selected shorts
  const selected10 = useMemo(() => {
    if (!shorts || shorts.length === 0) return [];
    const pool = [...shorts];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 10);
  }, [shorts, randomSeed]);

  // Duplicate the 10 shorts once to create an infinite, seamless 20-card loop
  const displayList = useMemo(() => {
    if (selected10.length === 0) return [];
    return [...selected10, ...selected10];
  }, [selected10]);

  // Buffer synchronization states
  const [readyIndices, setReadyIndices] = useState<Set<number>>(new Set());
  const [bufferProgressMap, setBufferProgressMap] = useState<Record<number, number>>({});
  const [isPlaybackReady, setIsPlaybackReady] = useState(false);
  const isPlaybackReadyRef = useRef(false);

  // Target threshold: ALL 10 media items must be fully buffered before launching bufferless playback
  const targetThreshold = useMemo(() => {
    return selected10.length;
  }, [selected10.length]);

  // Reset buffering state whenever the selected shorts change
  useEffect(() => {
    setReadyIndices(new Set());
    setBufferProgressMap({});
    setIsPlaybackReady(false);
    isPlaybackReadyRef.current = false;
    videoRefs.current = [];
  }, [selected10]);

  // Generous safety ceiling timer (14s): ensures if an unusual network stall occurs, visitor is never locked out indefinitely
  useEffect(() => {
    if (isPlaybackReady) return;
    const timer = setTimeout(() => {
      setIsPlaybackReady(true);
      isPlaybackReadyRef.current = true;
    }, 14000);
    return () => clearTimeout(timer);
  }, [isPlaybackReady, selected10]);

  // Sync ref with state
  useEffect(() => {
    isPlaybackReadyRef.current = isPlaybackReady;
  }, [isPlaybackReady]);

  // Mark an item as truly ready
  const handleMediaReady = useCallback(
    (itemIndex: number) => {
      setBufferProgressMap((prev) => (prev[itemIndex] === 100 ? prev : { ...prev, [itemIndex]: 100 }));
      setReadyIndices((prev) => {
        if (prev.has(itemIndex)) return prev;
        const next = new Set(prev);
        next.add(itemIndex);
        return next;
      });

      // If showcase already started, ensure newly ready videos start playing immediately
      if (isPlaybackReadyRef.current && selected10.length > 0) {
        const v1 = videoRefs.current[itemIndex];
        const v2 = videoRefs.current[itemIndex + selected10.length];
        [v1, v2].forEach((v) => {
          if (v && v.paused) {
            v.muted = true;
            v.defaultMuted = true;
            v.play().catch(() => {});
          }
        });
      }
    },
    [selected10.length]
  );

  // Deep buffer inspection: confirms substantial buffer depth before marking ready
  const verifyBufferDepth = useCallback(
    (el: HTMLVideoElement | null, itemIndex: number) => {
      if (!el) return;

      // HTML5 readyState >= 4 means HAVE_ENOUGH_DATA (browser estimates buffer can play through)
      if (el.readyState >= 4) {
        setBufferProgressMap((prev) => (prev[itemIndex] === 100 ? prev : { ...prev, [itemIndex]: 100 }));
        handleMediaReady(itemIndex);
        return;
      }

      // Check timeRanges buffer depth in seconds
      if (el.buffered.length > 0) {
        const bufferedEnd = el.buffered.end(el.buffered.length - 1);
        const duration = el.duration;
        let pct = 20;
        if (duration && !isNaN(duration) && duration > 0) {
          pct = Math.min(100, Math.max(20, Math.round((bufferedEnd / (duration * 0.6)) * 100)));
        } else {
          pct = Math.min(100, Math.max(20, Math.round((bufferedEnd / 3) * 100)));
        }
        setBufferProgressMap((prev) => {
          const current = prev[itemIndex] || 0;
          return pct > current ? { ...prev, [itemIndex]: pct } : prev;
        });

        // Require at least 3 seconds of buffer, or 60% of short's total duration, or readyState >= 3
        if (
          bufferedEnd >= 3 ||
          (duration && !isNaN(duration) && duration > 0 && bufferedEnd >= duration * 0.6) ||
          (el.readyState >= 3 && bufferedEnd >= 2)
        ) {
          handleMediaReady(itemIndex);
        }
      } else if (el.readyState >= 2) {
        setBufferProgressMap((prev) => {
          const current = prev[itemIndex] || 0;
          return current < 45 ? { ...prev, [itemIndex]: 45 } : prev;
        });
      }
    },
    [handleMediaReady]
  );

  // Check if buffer threshold is met
  useEffect(() => {
    if (!isPlaybackReady && targetThreshold > 0 && readyIndices.size >= targetThreshold) {
      setIsPlaybackReady(true);
      isPlaybackReadyRef.current = true;
    }
  }, [readyIndices.size, targetThreshold, isPlaybackReady]);

  // When playback threshold is met, simultaneously start all buffered videos from frame 0
  useEffect(() => {
    if (isPlaybackReady) {
      videoRefs.current.forEach((v) => {
        if (v) {
          v.muted = true;
          v.defaultMuted = true;
          try {
            v.currentTime = 0;
          } catch {}
          v.play().catch(() => {});
        }
      });
    }
  }, [isPlaybackReady]);

  const handleVideoRef = (el: HTMLVideoElement | null, idx: number) => {
    videoRefs.current[idx] = el;
    if (!el || selected10.length === 0) return;

    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;

    const actualIndex = idx % selected10.length;

    // Check buffer state if element is mounted
    verifyBufferDepth(el, actualIndex);
  };

  if (selected10.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-start overflow-hidden relative select-none pl-6 sm:pl-10 min-h-[300px] sm:min-h-[380px] md:min-h-[480px]"
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
    >
      {/* Sliding Shorts Strip with Instant Rendering & Cryogenic Cyber Fluid Filling (Style 3) */}
      <div
        className={`flex gap-4 sm:gap-6 w-max transition-opacity duration-700 opacity-100 ${
          isPlaybackReady
            ? 'animate-homepage-slow-slide hover:[animation-play-state:paused]'
            : ''
        }`}
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

          const actualIndex = idx % selected10.length;
          const isPrimaryVisibleCard = idx < selected10.length;
          const cardFillPct = isPlaybackReady ? 100 : bufferProgressMap[actualIndex] || 15;

          return (
            <div
              key={`${item.id || item.url || item.name}-${idx}`}
              onClick={() => onOpenShort(item, selected10, actualIndex)}
              className="w-[155px] sm:w-[200px] md:w-[260px] h-[275px] sm:h-[356px] md:h-[462px] aspect-[9/16] bg-[#080b12] flex-shrink-0 cursor-pointer overflow-hidden transition-transform duration-300 hover:scale-[1.04] hover:z-20 relative select-none"
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
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
                style={{ borderRadius: 0, outline: 'none', border: 'none' }}
              />

              {/* Cryogenic Cyber Fluid Filling Canvas (Style 3: Bioluminescent Neon Plasma) */}
              <CryoFluidCanvas
                fillPercent={cardFillPct}
                isPlaybackReady={isPlaybackReady}
              />

              {/* Optical Flash Transition upon reaching 100% full */}
              <div
                className={`absolute inset-0 pointer-events-none z-20 bg-white transition-opacity duration-700 ${
                  isPlaybackReady ? 'opacity-0 animate-burst-flash' : 'opacity-0'
                }`}
                style={{ borderRadius: 0, outline: 'none' }}
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
          animation: homepageSlowSlide 85s linear infinite;
        }
        @keyframes burstFlash {
          0% {
            opacity: 0.75;
          }
          100% {
            opacity: 0;
          }
        }
        .animate-burst-flash {
          animation: burstFlash 0.65s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default HomepageSlidingShorts;
