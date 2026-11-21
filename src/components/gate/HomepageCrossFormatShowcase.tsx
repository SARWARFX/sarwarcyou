import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import type { StageMediaItem } from '../../types';
import { getVideoStreamUrl, getMediaUrl } from '../../utils/imageUrlResolver';
import { resolveStaticVideoThumbnail } from '../../utils/thumbnailResolver';

export type ShowcaseFormatType = 'PHOTO' | 'CLIP' | 'BANDHOBI_PHOTO' | 'SHORT';

export interface CrossFormatItem {
  type: ShowcaseFormatType;
  item: StageMediaItem;
  originalIndex: number;
}

export interface HomepageCrossFormatShowcaseProps {
  shorts: StageMediaItem[];
  clips: StageMediaItem[];
  photos: StageMediaItem[];
  bandhobiPhotos: StageMediaItem[];
  onOpenPhoto: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo: (item: StageMediaItem, playlist: StageMediaItem[]) => void;
  onOpenShort: (item: StageMediaItem, shorts: StageMediaItem[], index: number, folderName?: string) => void;
  randomSeed?: number;
}

/**
 * Modern Homepage Cross-Format Showcase:
 * - 3 Random Shorts (Shorts tab)
 * - 3 Random Video Clips (Video Clips tab)
 * - 3 Random Vault Photographs (Photographs tab)
 * - 3 Random Bandhobi Photographs (bandhobiz -> Photographs)
 *
 * Hardware-Safety: Exactly 6 active video elements (3 shorts + 3 clips) to prevent GPU decode bottlenecks.
 * 6 Photographs interleave seamlessly without adding video decode overhead.
 */
export const HomepageCrossFormatShowcase: React.FC<HomepageCrossFormatShowcaseProps> = ({
  shorts,
  clips,
  photos,
  bandhobiPhotos,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
  randomSeed,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Helper to pick n unique random items from an array
  const pickRandom = useCallback((arr: StageMediaItem[], count: number): StageMediaItem[] => {
    if (!arr || arr.length === 0) return [];
    const pool = [...arr];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  }, []);

  // 12 curated items: 3 Photos, 3 Clips, 3 Bandhobi Photos, 3 Shorts
  const selected12 = useMemo<CrossFormatItem[]>(() => {
    const chosenPhotos = pickRandom(photos, 3);
    const chosenClips = pickRandom(clips, 3);
    const chosenBandhobi = pickRandom(bandhobiPhotos, 3);
    const chosenShorts = pickRandom(shorts, 3);

    const list: CrossFormatItem[] = [];

    // Interleave: Photo -> Clip -> Bandhobi Photo -> Short (3 cycles = 12 items)
    for (let i = 0; i < 3; i++) {
      if (chosenPhotos[i]) {
        list.push({ type: 'PHOTO', item: chosenPhotos[i], originalIndex: i });
      }
      if (chosenClips[i]) {
        list.push({ type: 'CLIP', item: chosenClips[i], originalIndex: i });
      }
      if (chosenBandhobi[i]) {
        list.push({ type: 'BANDHOBI_PHOTO', item: chosenBandhobi[i], originalIndex: i });
      }
      if (chosenShorts[i]) {
        list.push({ type: 'SHORT', item: chosenShorts[i], originalIndex: i });
      }
    }

    return list;
  }, [shorts, clips, photos, bandhobiPhotos, randomSeed, pickRandom]);

  // Duplicate for seamless 55s CSS marquee loop
  const displayList = useMemo(() => {
    if (selected12.length === 0) return [];
    return [...selected12, ...selected12];
  }, [selected12]);

  // Buffer state: only video items (CLIP and SHORT) count toward buffering threshold
  const [readyVideoIndices, setReadyVideoIndices] = useState<Set<number>>(new Set());
  const [isPlaybackReady, setIsPlaybackReady] = useState(false);
  const isPlaybackReadyRef = useRef(false);

  // Indices of video items within selected12 (should be 6 total)
  const videoItemIndices = useMemo(() => {
    const indices: number[] = [];
    selected12.forEach((it, idx) => {
      if (it.type === 'CLIP' || it.type === 'SHORT') {
        indices.push(idx);
      }
    });
    return indices;
  }, [selected12]);

  const targetVideoThreshold = videoItemIndices.length;

  useEffect(() => {
    setReadyVideoIndices(new Set());
    setIsPlaybackReady(false);
    isPlaybackReadyRef.current = false;
    videoRefs.current = [];
    cardRefs.current = [];
  }, [selected12]);

  useEffect(() => {
    isPlaybackReadyRef.current = isPlaybackReady;
  }, [isPlaybackReady]);

  const handleVideoReady = useCallback(
    (itemIndex: number) => {
      setReadyVideoIndices((prev) => {
        if (prev.has(itemIndex)) return prev;
        const next = new Set(prev);
        next.add(itemIndex);
        return next;
      });

      if (isPlaybackReadyRef.current && selected12.length > 0) {
        const v1 = videoRefs.current[itemIndex];
        const v2 = videoRefs.current[itemIndex + selected12.length];
        [v1, v2].forEach((v) => {
          if (v && v.paused) {
            v.muted = true;
            v.defaultMuted = true;
            v.play().catch(() => {});
          }
        });
      }
    },
    [selected12.length]
  );

  const verifyBufferDepth = useCallback(
    (el: HTMLVideoElement | null, itemIndex: number) => {
      if (!el) return;
      if (el.readyState >= 4) {
        handleVideoReady(itemIndex);
        return;
      }
      if (el.buffered.length > 0) {
        const bufferedEnd = el.buffered.end(el.buffered.length - 1);
        const duration = el.duration;
        if (
          bufferedEnd >= 2 ||
          (duration && !isNaN(duration) && duration > 0 && bufferedEnd >= duration * 0.5) ||
          (el.readyState >= 3 && bufferedEnd >= 1)
        ) {
          handleVideoReady(itemIndex);
        }
      }
    },
    [handleVideoReady]
  );

  // Buffer unlock trigger with safety timeout
  useEffect(() => {
    if (isPlaybackReady) return;

    if (targetVideoThreshold > 0 && readyVideoIndices.size >= targetVideoThreshold) {
      setIsPlaybackReady(true);
      isPlaybackReadyRef.current = true;
      return;
    }

    const timer = setTimeout(() => {
      if (!isPlaybackReadyRef.current) {
        setIsPlaybackReady(true);
        isPlaybackReadyRef.current = true;
      }
    }, 3200);

    return () => clearTimeout(timer);
  }, [readyVideoIndices.size, targetVideoThreshold, isPlaybackReady]);

  // Synchronize playback once ready
  useEffect(() => {
    if (isPlaybackReady && selected12.length > 0) {
      videoRefs.current.forEach((v) => {
        if (v && v.paused) {
          v.muted = true;
          v.defaultMuted = true;
          v.play().catch(() => {});
        }
      });
    }
  }, [isPlaybackReady, selected12.length]);

  const handleCardClick = (entry: CrossFormatItem) => {
    const { type, item } = entry;
    if (type === 'PHOTO') {
      const idx = photos.findIndex((p) => (p.id || p.name) === (item.id || item.name));
      onOpenPhoto(item, photos, idx >= 0 ? idx : 0);
    } else if (type === 'BANDHOBI_PHOTO') {
      const idx = bandhobiPhotos.findIndex((p) => (p.id || p.name) === (item.id || item.name));
      onOpenPhoto(item, bandhobiPhotos, idx >= 0 ? idx : 0);
    } else if (type === 'CLIP') {
      onOpenVideo(item, clips);
    } else if (type === 'SHORT') {
      const idx = shorts.findIndex((s) => (s.id || s.name) === (item.id || item.name));
      onOpenShort(item, shorts, idx >= 0 ? idx : 0, 'Shorts');
    }
  };

  if (selected12.length === 0) return null;

  const readyCount = readyVideoIndices.size;
  const rawPct = targetVideoThreshold > 0 ? (readyCount / targetVideoThreshold) * 100 : 0;
  const progressPercent = Math.min(100, Math.max(15, Math.round(rawPct)));

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-start overflow-hidden relative select-none pl-6 sm:pl-10 min-h-[300px] sm:min-h-[380px] md:min-h-[480px]"
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
    >
      {/* High-Tech Cybernetic Loading Screen */}
      {!isPlaybackReady && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-transparent pointer-events-none select-none px-4">
          <div className="flex flex-col items-center justify-between w-full max-w-[295px] min-h-[290px] p-8 sm:w-auto sm:min-w-[500px] sm:max-w-[620px] sm:min-h-0 sm:px-14 sm:py-6 md:px-16 md:py-7 bg-[#07090e]/95 border border-[#38bdf8]/45 shadow-[0_0_45px_rgba(0,0,0,0.9),0_0_25px_rgba(56,189,248,0.22)] backdrop-blur-md">
            {/* Mobile View */}
            <div className="flex sm:hidden flex-col items-center justify-center gap-5 flex-1 w-full text-center py-2">
              <div className="w-3.5 h-3.5 bg-[#38bdf8] shadow-[0_0_12px_#38bdf8] animate-pulse shrink-0" />
              <div
                className="flex flex-col items-center text-center gap-1.5 font-bold tracking-[0.16em] uppercase text-base leading-snug"
                style={{ fontFamily: "'Science Gothic', sans-serif" }}
              >
                <span className="text-[#38bdf8] drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]">
                  LOADING VAULT //
                </span>
                <span className="text-white">PLEASE WAIT</span>
              </div>
            </div>

            {/* Desktop & Tablet View */}
            <div className="hidden sm:flex items-center gap-3.5 mb-4">
              <div className="w-3 h-3 bg-[#38bdf8] shadow-[0_0_12px_#38bdf8] animate-pulse shrink-0" />
              <span
                className="text-base sm:text-base md:text-lg font-bold tracking-[0.14em] uppercase text-white whitespace-nowrap"
                style={{ fontFamily: "'Science Gothic', sans-serif" }}
              >
                <span className="text-[#38bdf8] drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]">LOADING VAULT //</span> PLEASE WAIT
              </span>
            </div>

            {/* Tactical Solid Rectangular Progress Gauge */}
            <div className="w-full h-3.5 sm:h-4 bg-[#030712] border border-[#38bdf8]/50 shadow-[inset_0_0_8px_rgba(0,0,0,0.9)] p-[2px] overflow-hidden relative">
              <div
                className="h-full bg-[#38bdf8] shadow-[0_0_10px_#38bdf8,0_0_20px_rgba(56,189,248,0.65)] transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Sliding Reel: Cross-Format Showcase (Photos, Clips, Bandhobi, Shorts) */}
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
        {displayList.map((entry, idx) => {
          const { type, item } = entry;
          const actualIndex = idx % selected12.length;
          const isPrimaryVisibleCard = idx < selected12.length;
          const isVideoType = type === 'CLIP' || type === 'SHORT';

          const videoSrc = isVideoType ? getVideoStreamUrl(item.url || item.path || '') : '';
          const imageSrc =
            (item as any).thumbnail ||
            resolveStaticVideoThumbnail(item) ||
            item.poster ||
            getMediaUrl(item.url || item.path || '');

          return (
            <div
              key={`${item.id || item.url || item.name}-${idx}`}
              ref={(el) => {
                cardRefs.current[idx] = el;
              }}
              data-card-index={idx}
              onClick={() => handleCardClick(entry)}
              onMouseEnter={() => {
                if (isVideoType) {
                  const v = videoRefs.current[idx];
                  if (v && v.paused) {
                    v.muted = true;
                    v.defaultMuted = true;
                    v.play().catch(() => {});
                  }
                }
              }}
              className="w-[155px] sm:w-[200px] md:w-[260px] h-[275px] sm:h-[356px] md:h-[462px] aspect-[9/16] bg-[#080b12] flex-shrink-0 cursor-pointer overflow-hidden transition-transform duration-300 hover:scale-[1.04] hover:z-20 relative select-none group"
              style={{
                borderRadius: 0,
                outline: 'none',
                border: 'none',
                willChange: 'transform',
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
              }}
            >
              {/* Media Element: Video or Image */}
              {isVideoType ? (
                <video
                  ref={(el) => {
                    videoRefs.current[idx] = el;
                    if (el) {
                      el.muted = true;
                      el.defaultMuted = true;
                      el.playsInline = true;
                      verifyBufferDepth(el, actualIndex);
                    }
                  }}
                  src={videoSrc}
                  poster={imageSrc}
                  loop
                  muted
                  playsInline
                  preload={isPrimaryVisibleCard ? 'auto' : isPlaybackReady ? 'auto' : 'none'}
                  onCanPlayThrough={() => handleVideoReady(actualIndex)}
                  onProgress={(e) => verifyBufferDepth(e.currentTarget, actualIndex)}
                  onLoadedData={(e) => {
                    if (e.currentTarget.readyState >= 4) {
                      handleVideoReady(actualIndex);
                    }
                  }}
                  onError={() => handleVideoReady(actualIndex)}
                  className="w-full h-full object-cover block filter saturate-[0.95] contrast-[1.05]"
                  style={{
                    borderRadius: 0,
                    outline: 'none',
                    border: 'none',
                    transform: 'translateZ(0)',
                  }}
                />
              ) : (
                <img
                  src={imageSrc}
                  alt={item.name || 'Photograph'}
                  loading={isPrimaryVisibleCard ? 'eager' : 'lazy'}
                  className="w-full h-full object-cover block filter saturate-[0.98] contrast-[1.03] transition-transform duration-500 group-hover:scale-105"
                  style={{
                    borderRadius: 0,
                    outline: 'none',
                    border: 'none',
                    transform: 'translateZ(0)',
                  }}
                />
              )}

              {/* Minimalist Tactical Format Badge on Hover */}
              <div className="absolute inset-x-0 bottom-0 p-2 sm:p-3 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-between pointer-events-none">
                <span
                  className={`text-[9px] sm:text-[10px] font-bold tracking-widest uppercase ${
                    type === 'SHORT'
                      ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                      : type === 'CLIP'
                      ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                      : type === 'BANDHOBI_PHOTO'
                      ? 'text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]'
                      : 'text-cyan-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]'
                  }`}
                  style={{ fontFamily: "'Science Gothic', sans-serif" }}
                >
                  {type === 'SHORT'
                    ? '// SHORTS'
                    : type === 'CLIP'
                    ? '// VIDEO CLIP'
                    : type === 'BANDHOBI_PHOTO'
                    ? '// BANDHOBIZ'
                    : '// PHOTOGRAPH'}
                </span>
                <span className="text-[9px] text-white/70 uppercase">OPEN</span>
              </div>
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

export default HomepageCrossFormatShowcase;
