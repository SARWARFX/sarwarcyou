import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import type { StageMediaItem } from '../../types';
import { getVideoStreamUrl, getMediaUrl } from '../../utils/imageUrlResolver';
import { resolveStaticVideoThumbnail } from '../../utils/thumbnailResolver';

export interface VideoClipsCinemaTheaterProps {
  clips: StageMediaItem[];
  onOpenVideo: (item: StageMediaItem, playlist: StageMediaItem[]) => void;
  randomSeed?: number;
  isPortrait?: boolean;
}

interface CinemaScreenCardProps {
  item: StageMediaItem;
  slotIdx: number;
  isCenter: boolean;
  isPlaybackReady: boolean;
  onReady: (slotIdx: number) => void;
  onClick: () => void;
  transformStyle: string;
  opacity: number;
  zIndex: number;
  isPortrait: boolean;
  registerVideoRef: (slotIdx: number, el: HTMLVideoElement | null) => void;
}

/**
 * Individual Screen Card within the Cinema Theater:
 * - Center Main Stage: Plays from 20% to 80% of duration in a continuous loop.
 * - Other Four Screens (Walls & Peeks): Plays preview from 10% to 35% of duration in a continuous loop
 *   (matches exact hover preview behavior from LivingMediaCard).
 * - Thin 2px bottom cyan progress line showing relative playback progress within each mode's slice.
 * - Pure Cinema: ZERO borders, ZERO outlines, ZERO text labels.
 */
const CinemaScreenCard: React.FC<CinemaScreenCardProps> = ({
  item,
  slotIdx,
  isCenter,
  isPlaybackReady,
  onReady,
  onClick,
  transformStyle,
  opacity,
  zIndex,
  isPortrait,
  registerVideoRef,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [hasError, setHasError] = useState<boolean>(false);

  const videoSrc = getVideoStreamUrl(item.url || item.path || '');
  const imageSrc =
    (item as any).thumbnail ||
    resolveStaticVideoThumbnail(item) ||
    item.poster ||
    getMediaUrl(item.url || item.path || '');

  // Deep buffer verification to prevent stutter
  const verifyBufferDepth = useCallback(
    (el: HTMLVideoElement | null) => {
      if (!el) return;

      if (el.readyState >= 4) {
        onReady(slotIdx);
        return;
      }

      const cur = el.currentTime;
      const dur = el.duration;
      if (el.buffered && el.buffered.length > 0) {
        for (let i = 0; i < el.buffered.length; i++) {
          const bStart = el.buffered.start(i);
          const bEnd = el.buffered.end(i);
          if (cur >= bStart - 0.5 && cur <= bEnd) {
            const bufferedAhead = bEnd - cur;
            if (
              bufferedAhead >= 2.5 ||
              (dur && !isNaN(dur) && dur > 0 && bufferedAhead >= dur * 0.2) ||
              el.readyState >= 3
            ) {
              onReady(slotIdx);
              return;
            }
          }
        }
      }

      if (el.readyState >= 3) {
        onReady(slotIdx);
      }
    },
    [onReady, slotIdx]
  );

  // Initial metadata loaded: seek to starting slice point
  const handleLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const v = e.currentTarget;
      v.muted = true;
      v.defaultMuted = true;
      const dur = v.duration;
      if (dur && !isNaN(dur) && dur > 0) {
        // Main stage: start at 20%; Other screens (preview): start at 10%
        const start = isCenter ? dur * 0.2 : dur * 0.1;
        v.currentTime = start;
      }
      verifyBufferDepth(v);
    },
    [isCenter, verifyBufferDepth]
  );

  const handleSeeked = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      verifyBufferDepth(e.currentTarget);
    },
    [verifyBufferDepth]
  );

  // Adjust playback slice when switching between Center Stage and Wall/Peek
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const dur = v.duration;
    if (!dur || isNaN(dur) || dur <= 0) return;

    const start = isCenter ? dur * 0.2 : dur * 0.1;
    const end = isCenter ? dur * 0.8 : dur * 0.35;

    if (v.currentTime < start || v.currentTime >= end) {
      v.currentTime = start;
    }
    if (isPlaybackReady && v.paused) {
      v.play().catch(() => {});
    }
  }, [isCenter, isPlaybackReady]);

  // Handle auto-play once global loading screen lifts
  useEffect(() => {
    if (isPlaybackReady && videoRef.current && videoRef.current.paused) {
      videoRef.current.muted = true;
      videoRef.current.defaultMuted = true;
      videoRef.current.play().catch(() => {});
    }
  }, [isPlaybackReady]);

  // Continuous looping within designated time slice
  const handleTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const v = e.currentTarget;
      const dur = v.duration;
      if (!dur || isNaN(dur) || dur <= 0) return;

      // Main stage: 20% to 80% | Other 4 screens: 10% to 35% preview
      const start = isCenter ? dur * 0.2 : dur * 0.1;
      const end = isCenter ? dur * 0.8 : dur * 0.35;

      if (v.currentTime >= end || v.currentTime < start) {
        v.currentTime = start;
      }

      const sliceLength = end - start;
      if (sliceLength > 0) {
        const pct = Math.min(100, Math.max(0, ((v.currentTime - start) / sliceLength) * 100));
        setProgress(pct);
      }
    },
    [isCenter]
  );

  return (
    <div
      onClick={onClick}
      className={`absolute ${
        isPortrait
          ? 'w-[92vw] max-w-[370px] sm:max-w-[420px] aspect-[16/9]'
          : 'w-[460px] sm:w-[580px] md:w-[700px] lg:w-[820px] xl:w-[920px] max-w-[76vw] aspect-[16/9]'
      } bg-black overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] cursor-pointer ${
        isCenter
          ? isPortrait
            ? 'shadow-[0_12px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(56,189,248,0.25)]'
            : 'shadow-[0_16px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(56,189,248,0.25)]'
          : isPortrait
          ? 'shadow-[0_8px_30px_rgba(0,0,0,0.85)] hover:brightness-110'
          : 'shadow-[0_8px_35px_rgba(0,0,0,0.85)] hover:brightness-110'
      }`}
      style={{
        transform: transformStyle,
        opacity,
        zIndex,
        borderRadius: 0,
        outline: 'none',
        border: 'none',
        willChange: 'transform',
      }}
    >
      {videoSrc && !hasError ? (
        <video
          ref={(el) => {
            videoRef.current = el;
            registerVideoRef(slotIdx, el);
            if (el) {
              el.muted = true;
              el.defaultMuted = true;
              el.playsInline = true;
              verifyBufferDepth(el);
            }
          }}
          src={videoSrc}
          poster={imageSrc}
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={handleLoadedMetadata}
          onSeeked={handleSeeked}
          onCanPlayThrough={() => onReady(slotIdx)}
          onLoadedData={() => verifyBufferDepth(videoRef.current)}
          onProgress={() => verifyBufferDepth(videoRef.current)}
          onTimeUpdate={handleTimeUpdate}
          onError={() => {
            setHasError(true);
            onReady(slotIdx);
          }}
          className="w-full h-full object-cover block"
          style={{ borderRadius: 0, outline: 'none', border: 'none' }}
        />
      ) : (
        <img src={imageSrc} alt="" className="w-full h-full object-cover block" />
      )}

      {/* Tactical Thin Micro Progress Track at bottom */}
      {isPlaybackReady && (
        <div
          className="absolute bottom-0 inset-x-0 h-[2px] bg-white/15 z-20 pointer-events-none overflow-hidden"
          style={{ borderRadius: 0, outline: 'none', border: 'none' }}
        >
          <div
            className={`h-full ${
              isCenter ? 'bg-[#38bdf8] shadow-[0_0_8px_#38bdf8]' : 'bg-[#38bdf8]/80'
            } transition-all duration-75 ease-linear`}
            style={{ width: `${progress}%`, borderRadius: 0 }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Modern 5-Stage Cinema Theater Showcase for Video Clips:
 * - Desktop: 3D Horizontal Auditorium:
 *     - Center Main Stage: Massively scaled hero screen (100% visible, elevated in front), plays 20% to 80% loop.
 *     - Left & Right Walls: Show ~50% (half) of screen, angled inward (rotateY 40deg), plays 10% to 35% preview.
 *     - Far Outer Reserve Peeks: Show ~18-20% at the very sides, angled deeper (rotateY 55deg), plays 10% to 35% preview.
 * - Mobile Portrait: Option A Vertical Cinema Tower:
 *     - Center Main Stage: Largest 16:9 hero screen, plays 20% to 80% loop.
 *     - Ceiling & Floor Screens: Show ~50% (half) of screen, angled backward (rotateX 36deg), plays 10% to 35% preview.
 *     - Top & Bottom Outer Peeks: Show ~18-20% at the extreme top/bottom edges, plays 10% to 35% preview.
 * - Pure Cinematic Presentation: ZERO outlines, ZERO borders, ZERO text overlays.
 * - Buffer-Guaranteed Loading Screen:
 *     - Identical to Shorts featured page (mobile 2-line split, desktop horizontal banner, solid gauge).
 *     - Holds until visible videos have buffered sufficient data before revealing for stutter-free playback.
 * - Interactive: Clicking any wall/peek screen smoothly rotates it into Center Stage; clicking Center Stage launches full player.
 */
export const VideoClipsCinemaTheater: React.FC<VideoClipsCinemaTheaterProps> = ({
  clips,
  onOpenVideo,
  randomSeed,
  isPortrait = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Pick 5 random video clips from vault
  const selected5 = useMemo(() => {
    if (!clips || clips.length === 0) return [];
    const pool = [...clips];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 5);
  }, [clips, randomSeed]);

  // Center index in selected5 (starts at 2: 0=peek-1, 1=wall-1, 2=center, 3=wall-2, 4=peek-2)
  const [centerIndex, setCenterIndex] = useState<number>(2);

  // Buffering states for all screens
  const [readyIndices, setReadyIndices] = useState<Set<number>>(new Set());
  const [isPlaybackReady, setIsPlaybackReady] = useState<boolean>(false);
  const isPlaybackReadyRef = useRef<boolean>(false);

  // Target threshold: 5 screens total (unlocks at 5, or center + at least 2 walls)
  const targetThreshold = Math.min(5, Math.max(3, selected5.length));

  useEffect(() => {
    setReadyIndices(new Set());
    setIsPlaybackReady(false);
    isPlaybackReadyRef.current = false;
    videoRefs.current = [];
  }, [selected5]);

  useEffect(() => {
    isPlaybackReadyRef.current = isPlaybackReady;
  }, [isPlaybackReady]);

  // Clean up all video elements on unmount to conserve GPU decoders
  useEffect(() => {
    return () => {
      videoRefs.current.forEach((v) => {
        if (v) {
          try {
            v.pause();
            v.src = '';
            v.load();
          } catch {}
        }
      });
      videoRefs.current = [];
    };
  }, []);

  const handleVideoReady = useCallback((slotIdx: number) => {
    setReadyIndices((prev) => {
      if (prev.has(slotIdx)) return prev;
      const next = new Set(prev);
      next.add(slotIdx);
      return next;
    });
  }, []);

  const registerVideoRef = useCallback((slotIdx: number, el: HTMLVideoElement | null) => {
    videoRefs.current[slotIdx] = el;
  }, []);

  // Buffer gate: wait until center + 2 walls or all screens are ready before revealing
  useEffect(() => {
    if (isPlaybackReady) return;

    const hasCenter = readyIndices.has(centerIndex);
    const hasEnough = readyIndices.size >= targetThreshold || (hasCenter && readyIndices.size >= 3);

    if (hasEnough) {
      setIsPlaybackReady(true);
      isPlaybackReadyRef.current = true;
      return;
    }

    // Safety timeout: prevents freezing if a specific media file takes longer
    const timer = setTimeout(() => {
      if (!isPlaybackReadyRef.current && (readyIndices.size >= 1 || selected5.length > 0)) {
        setIsPlaybackReady(true);
        isPlaybackReadyRef.current = true;
      }
    }, 7000);

    return () => clearTimeout(timer);
  }, [readyIndices, isPlaybackReady, centerIndex, targetThreshold, selected5.length]);

  const handleCardClick = (clickedIdx: number) => {
    if (clickedIdx === centerIndex) {
      // Center stage clicked: launch full cinema video player!
      onOpenVideo(selected5[centerIndex], clips);
      return;
    }
    // Rotate clicked screen into center stage
    setCenterIndex(clickedIdx);
  };

  if (selected5.length === 0) return null;

  const readyCount = readyIndices.size;
  const rawPct = (readyCount / targetThreshold) * 100;
  const progressPercent = Math.min(100, Math.max(10, Math.round(rawPct)));

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden select-none min-h-[360px] sm:min-h-[460px] md:min-h-[540px]"
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
    >
      {/* High-Tech Cybernetic Loading Screen: Exact Same as Shorts Featured Page */}
      {!isPlaybackReady && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-transparent pointer-events-none select-none px-4">
          <div className="flex flex-col items-center justify-between w-full max-w-[295px] min-h-[290px] p-8 sm:w-auto sm:min-w-[500px] sm:max-w-[620px] sm:min-h-0 sm:px-14 sm:py-6 md:px-16 md:py-7 bg-[#07090e]/95 border border-[#38bdf8]/45 shadow-[0_0_45px_rgba(0,0,0,0.9),0_0_25px_rgba(56,189,248,0.22)] backdrop-blur-md">
            {/* Mobile View: Taller Rectangular Card with Exact 2-Line Split */}
            <div className="flex sm:hidden flex-col items-center justify-center gap-5 flex-1 w-full text-center py-2">
              <div className="w-3.5 h-3.5 bg-[#38bdf8] shadow-[0_0_12px_#38bdf8] animate-pulse shrink-0" />
              <div
                className="flex flex-col items-center text-center gap-1.5 font-bold tracking-[0.16em] uppercase text-base leading-snug"
                style={{ fontFamily: "'Science Gothic', sans-serif" }}
              >
                <span className="text-[#38bdf8] drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]">
                  LOADING MEDIA //
                </span>
                <span className="text-white">PLEASE WAIT</span>
              </div>
            </div>

            {/* Desktop & Tablet View: Single Horizontal Line */}
            <div className="hidden sm:flex items-center gap-3.5 mb-4">
              <div className="w-3 h-3 bg-[#38bdf8] shadow-[0_0_12px_#38bdf8] animate-pulse shrink-0" />
              <span
                className="text-base sm:text-base md:text-lg font-bold tracking-[0.14em] uppercase text-white whitespace-nowrap"
                style={{ fontFamily: "'Science Gothic', sans-serif" }}
              >
                <span className="text-[#38bdf8] drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]">
                  LOADING MEDIA //
                </span>{' '}
                PLEASE WAIT
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

      {/* STAGE CONTAINER */}
      <div
        className={`w-full h-full flex items-center justify-center transition-opacity duration-700 ${
          isPlaybackReady ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      >
        {isPortrait ? (
          /* ================================================================= */
          /* MOBILE PORTRAIT: OPTION A VERTICAL CINEMA TOWER (Ceiling -> Center -> Floor) */
          /* ================================================================= */
          <div
            className="w-full h-full max-h-[640px] flex items-center justify-center relative"
            style={{ perspective: '1100px', transformStyle: 'preserve-3d' }}
          >
            {selected5.map((item, idx) => {
              let offset = (idx - centerIndex + 5) % 5;
              if (offset > 2) offset -= 5; // -2, -1, 0, 1, 2
              const isCenter = offset === 0;
              const isCeiling = offset === -1;
              const isFloor = offset === 1;

              let transformStyle = '';
              let opacity = 0.3;
              let zIndex = 5;

              if (offset === -2) {
                // Top Reserve Peek: Shows ~18% at extreme top
                transformStyle = 'translateY(-98%) rotateX(-48deg) translateZ(-140px) scale(0.72)';
                opacity = 0.28;
                zIndex = 10;
              } else if (isCeiling) {
                // Ceiling Screen: Shows ~50% (half) above center screen
                transformStyle = 'translateY(-54%) rotateX(-36deg) translateZ(-45px) scale(0.86)';
                opacity = 0.85;
                zIndex = 20;
              } else if (isCenter) {
                // Center Hero Screen: 100% visible, larger, elevated
                transformStyle = 'translateY(0%) rotateX(0deg) translateZ(60px) scale(1)';
                opacity = 1;
                zIndex = 30;
              } else if (isFloor) {
                // Floor Screen: Shows ~50% (half) below center screen
                transformStyle = 'translateY(54%) rotateX(36deg) translateZ(-45px) scale(0.86)';
                opacity = 0.85;
                zIndex = 20;
              } else if (offset === 2) {
                // Bottom Reserve Peek: Shows ~18% at extreme bottom
                transformStyle = 'translateY(98%) rotateX(48deg) translateZ(-140px) scale(0.72)';
                opacity = 0.28;
                zIndex = 10;
              }

              return (
                <CinemaScreenCard
                  key={`${item.id || item.url || item.name}-${idx}`}
                  item={item}
                  slotIdx={idx}
                  isCenter={isCenter}
                  isPlaybackReady={isPlaybackReady}
                  onReady={handleVideoReady}
                  onClick={() => handleCardClick(idx)}
                  transformStyle={transformStyle}
                  opacity={opacity}
                  zIndex={zIndex}
                  isPortrait={true}
                  registerVideoRef={registerVideoRef}
                />
              );
            })}
          </div>
        ) : (
          /* ================================================================= */
          /* DESKTOP & TABLET: HORIZONTAL 5-STAGE 3D AUDITORIUM */
          /* ================================================================= */
          <div
            className="w-full h-full max-h-[640px] flex items-center justify-center relative px-2"
            style={{ perspective: '1300px', transformStyle: 'preserve-3d' }}
          >
            {selected5.map((item, idx) => {
              let offset = (idx - centerIndex + 5) % 5;
              if (offset > 2) offset -= 5; // -2, -1, 0, 1, 2
              const isCenter = offset === 0;
              const isLeftWall = offset === -1;
              const isRightWall = offset === 1;

              let transformStyle = '';
              let opacity = 0.3;
              let zIndex = 5;

              if (offset === -2) {
                // Left Outer Reserve Peek: Shows ~18-20% at the very left edge
                transformStyle = 'translateX(-98%) rotateY(55deg) scale(0.72) translateZ(-170px)';
                opacity = 0.35;
                zIndex = 10;
              } else if (isLeftWall) {
                // Left Wall: Shows ~50% (half) of screen, angled inward
                transformStyle = 'translateX(-54%) rotateY(40deg) translateZ(-50px) scale(0.86)';
                opacity = 0.85;
                zIndex = 20;
              } else if (isCenter) {
                // Center Hero Screen: Significantly bigger, 100% visible, elevated in front
                transformStyle = 'translateX(0%) rotateY(0deg) translateZ(80px) scale(1)';
                opacity = 1;
                zIndex = 30;
              } else if (isRightWall) {
                // Right Wall: Shows ~50% (half) of screen, angled inward
                transformStyle = 'translateX(54%) rotateY(-40deg) translateZ(-50px) scale(0.86)';
                opacity = 0.85;
                zIndex = 20;
              } else if (offset === 2) {
                // Right Outer Reserve Peek: Shows ~18-20% at the very right edge
                transformStyle = 'translateX(98%) rotateY(-55deg) scale(0.72) translateZ(-170px)';
                opacity = 0.35;
                zIndex = 10;
              }

              return (
                <CinemaScreenCard
                  key={`${item.id || item.url || item.name}-${idx}`}
                  item={item}
                  slotIdx={idx}
                  isCenter={isCenter}
                  isPlaybackReady={isPlaybackReady}
                  onReady={handleVideoReady}
                  onClick={() => handleCardClick(idx)}
                  transformStyle={transformStyle}
                  opacity={opacity}
                  zIndex={zIndex}
                  isPortrait={false}
                  registerVideoRef={registerVideoRef}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoClipsCinemaTheater;
