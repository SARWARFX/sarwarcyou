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
  isWall: boolean;
  isPlaybackReady: boolean;
  onReady: (slotIdx: number) => void;
  onClick: () => void;
  transformStyle: string;
  width: number;
  height: number;
  opacity: number;
  zIndex: number;
  shadowClass: string;
  registerVideoRef: (slotIdx: number, el: HTMLVideoElement | null) => void;
}

/**
 * Individual Screen Card within the Cinema Theater:
 * - Center Main Stage (isCenter): Plays from 30% to 70% of duration in a continuous loop.
 * - The Two Walls/Ceiling/Floor Beside It (isWall): Plays from 40% to 60% of duration in a continuous loop.
 * - Outer Screens (!isCenter && !isWall): Displays static high-res thumbnail (0% background video decoders).
 * - Thin 2px bottom cyan progress line on active video screens.
 * - Pure Cinema: ZERO borders, ZERO outlines, ZERO text labels.
 */
const CinemaScreenCard: React.FC<CinemaScreenCardProps> = ({
  item,
  slotIdx,
  isCenter,
  isWall,
  isPlaybackReady,
  onReady,
  onClick,
  transformStyle,
  width,
  height,
  opacity,
  zIndex,
  shadowClass,
  registerVideoRef,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [hasError, setHasError] = useState<boolean>(false);

  const isVideoScreen = isCenter || isWall;
  const videoSrc = isVideoScreen ? getVideoStreamUrl(item.url || item.path || '') : null;
  const imageSrc =
    (item as any).thumbnail ||
    resolveStaticVideoThumbnail(item) ||
    item.poster ||
    getMediaUrl(item.url || item.path || '');

  // Deep buffer verification for the 3 active video screens
  const verifyBufferDepth = useCallback(
    (el: HTMLVideoElement | null) => {
      if (!el || !isVideoScreen) return;

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
              bufferedAhead >= 2.0 ||
              (dur && !isNaN(dur) && dur > 0 && bufferedAhead >= dur * 0.15) ||
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
    [isVideoScreen, onReady, slotIdx]
  );

  // Initial metadata loaded: seek to starting slice point
  const handleLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const v = e.currentTarget;
      v.muted = true;
      v.defaultMuted = true;
      const dur = v.duration;
      if (dur && !isNaN(dur) && dur > 0) {
        // Main stage: start at 30%; Walls/Ceiling/Floor: start at 40%
        const start = isCenter ? dur * 0.3 : dur * 0.4;
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

  // Adjust playback slice when transitioning between Center (30%-70%) and Wall (40%-60%)
  useEffect(() => {
    if (!isVideoScreen) return;
    const v = videoRef.current;
    if (!v) return;
    const dur = v.duration;
    if (!dur || isNaN(dur) || dur <= 0) return;

    const start = isCenter ? dur * 0.3 : dur * 0.4;
    const end = isCenter ? dur * 0.7 : dur * 0.6;

    if (v.currentTime < start || v.currentTime >= end) {
      v.currentTime = start;
    }
    if (isPlaybackReady && v.paused) {
      v.play().catch(() => {});
    }
  }, [isCenter, isVideoScreen, isPlaybackReady]);

  // Handle auto-play once global loading screen lifts
  useEffect(() => {
    if (isVideoScreen && isPlaybackReady && videoRef.current && videoRef.current.paused) {
      videoRef.current.muted = true;
      videoRef.current.defaultMuted = true;
      videoRef.current.play().catch(() => {});
    }
  }, [isVideoScreen, isPlaybackReady]);

  // Continuous looping within designated time slice
  const handleTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const v = e.currentTarget;
      const dur = v.duration;
      if (!dur || isNaN(dur) || dur <= 0) return;

      // Main stage: 30% to 70% | Adjacent Walls/Ceiling/Floor: 40% to 60%
      const start = isCenter ? dur * 0.3 : dur * 0.4;
      const end = isCenter ? dur * 0.7 : dur * 0.6;

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
      className={`absolute bg-black overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] cursor-pointer select-none ${shadowClass}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        transform: transformStyle,
        opacity,
        zIndex,
        borderRadius: 0,
        outline: 'none',
        border: 'none',
        willChange: 'transform',
      }}
    >
      {isVideoScreen && videoSrc && !hasError ? (
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
        <img
          src={imageSrc}
          alt=""
          className="w-full h-full object-cover block pointer-events-none"
          style={{ borderRadius: 0, outline: 'none', border: 'none' }}
        />
      )}

      {/* Tactical Thin Micro Progress Track on Active Video Screens */}
      {isVideoScreen && isPlaybackReady && (
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
 * Dynamic Screen-Decided 3D Cinema Theater:
 * - Portrait Screens: Floor-to-Ceiling 3D View (Ceiling -> Center -> Floor -> Outer Peeks).
 *     - Optimized for vertical orientation: Ceiling angled backward, Center elevated, Floor angled forward.
 * - Landscape / Desktop / Laptop Screens: 25% Larger Horizontal 3D Auditorium:
 *     - Center card scaled 25% larger (up to 720px / 52vw).
 *     - Left & Right Walls show 30% of card beside Center.
 *     - Left & Right Wings show 10% of card beside Walls.
 *     - Horizon shows 5% for ultra-wide displays.
 * - Video Playback Rules:
 *     - Main screen: Plays 30% to 70% in a continuous loop.
 *     - The two beside it (Walls or Ceiling/Floor): Plays 40% to 60% in a continuous loop.
 *     - All other cards: Static high-res thumbnails (0% GPU video decoding overhead).
 * - Buffer Gate: Waits for the 3 active video screens to buffer before revealing for stutter-free playback.
 * - Interactive: Clicking any wall/screen smoothly rotates it to Center Stage.
 */
export const VideoClipsCinemaTheater: React.FC<VideoClipsCinemaTheaterProps> = ({
  clips,
  onOpenVideo,
  randomSeed,
  isPortrait = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Container dimensions observed via ResizeObserver
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 700,
  });

  // Track container dimensions in real-time
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Determine effective portrait mode (prop or aspect ratio)
  const isEffectivePortrait = isPortrait || dimensions.height > dimensions.width * 1.05;

  // Pool of clips from vault (shuffled once per seed/clips change)
  const clipPool = useMemo(() => {
    if (!clips || clips.length === 0) return [];
    const pool = [...clips];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
  }, [clips, randomSeed]);

  // Center index in clipPool
  const [centerIndex, setCenterIndex] = useState<number>(() => {
    return clipPool.length > 2 ? 2 : 0;
  });

  // Buffering states for the 3 active video screens (center, left/ceiling, right/floor)
  const [readySlots, setReadySlots] = useState<Set<number>>(new Set());
  const [isPlaybackReady, setIsPlaybackReady] = useState<boolean>(false);
  const isPlaybackReadyRef = useRef<boolean>(false);

  // Target threshold: 3 active video screens
  const targetThreshold = 3;

  useEffect(() => {
    setReadySlots(new Set());
    setIsPlaybackReady(false);
    isPlaybackReadyRef.current = false;
    videoRefs.current = [];
  }, [clipPool]);

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
    setReadySlots((prev) => {
      if (prev.has(slotIdx)) return prev;
      const next = new Set(prev);
      next.add(slotIdx);
      return next;
    });
  }, []);

  const registerVideoRef = useCallback((slotIdx: number, el: HTMLVideoElement | null) => {
    videoRefs.current[slotIdx] = el;
  }, []);

  // Calculate dynamic tiers and exposure positions
  const layout = useMemo(() => {
    const W_box = dimensions.width;
    const H_box = dimensions.height;

    if (isEffectivePortrait) {
      /* ===================================================================== */
      /* PORTRAIT MODE: FLOOR-TO-CEILING VERTICAL 3D THEATER                   */
      /* ===================================================================== */
      // Width bounded to ~90vw or max 440px
      const W_main = Math.min(
        440,
        Math.max(260, Math.min(W_box * 0.90, H_box * 0.38 * (16 / 9)))
      );
      const H_main = W_main * (9 / 16);

      // Vertical Tier 1 (Ceiling & Floor): 88% scale, 30% of card exposed
      const H1 = H_main * 0.88;
      const W1 = W_main * 0.88;
      const E1_y = H_main / 2 + 0.30 * H1;

      // Vertical Tier 2 (Top & Bottom Outer Peeks): 76% scale, 10% of card exposed
      const H2 = H_main * 0.76;
      const W2 = W_main * 0.76;
      const E2_y = E1_y + 0.10 * H2;

      const halfH = H_box / 2;
      let tiersAllowed = 1; // 3 screens: Ceiling + Center + Floor
      if (E2_y <= halfH - 10 && H_box >= 680) tiersAllowed = 2; // 5 screens: + Top & Bottom Peeks

      return {
        isPortraitMode: true,
        W_main,
        H_main,
        W1,
        H1,
        E1_y,
        W2,
        H2,
        E2_y,
        W3: 0,
        H3: 0,
        E3_y: 0,
        tiersAllowed,
      };
    } else {
      /* ===================================================================== */
      /* LANDSCAPE / LAPTOP / DESKTOP MODE: 25% LARGER HORIZONTAL 3D THEATER  */
      /* ===================================================================== */
      // Scaled up by 25%: max width up to 720px, larger view fractions
      const W_main = Math.min(
        720,
        Math.max(300, Math.min(W_box * 0.52, H_box * 0.64 * (16 / 9)))
      );
      const H_main = W_main * (9 / 16);

      // Tier 1 card width & outer exposure edge (30% exposed)
      const W1 = W_main * 0.88;
      const E1 = W_main / 2 + 0.30 * W1;

      // Tier 2 card width & outer exposure edge (10% exposed)
      const W2 = W_main * 0.76;
      const E2 = E1 + 0.10 * W2;

      // Tier 3 card width & outer exposure edge (5% exposed)
      const W3 = W_main * 0.65;
      const E3 = E2 + 0.05 * W3;

      // Tier 4 card width & outer exposure edge (5% exposed for ultra-wide)
      const W4 = W_main * 0.55;
      const E4 = E3 + 0.05 * W4;

      const halfW = W_box / 2;

      let tiersAllowed = 1; // Default 3 cards
      if (E2 <= halfW - 10 && W_box >= 640) tiersAllowed = 2; // 5 cards
      if (E3 <= halfW - 10 && W_box >= 1100) tiersAllowed = 3; // 7 cards
      if (E4 <= halfW - 10 && W_box >= 1700) tiersAllowed = 4; // 9 cards

      return {
        isPortraitMode: false,
        W_main,
        H_main,
        W1,
        H1: W1 * (9 / 16),
        E1,
        W2,
        H2: W2 * (9 / 16),
        E2,
        W3,
        H3: W3 * (9 / 16),
        E3,
        W4,
        H4: W4 * (9 / 16),
        E4,
        tiersAllowed,
      };
    }
  }, [dimensions, isEffectivePortrait]);

  // Buffer gate: wait until center + 2 walls/ceiling/floor are ready before revealing
  useEffect(() => {
    if (isPlaybackReady) return;

    if (readySlots.size >= targetThreshold) {
      setIsPlaybackReady(true);
      isPlaybackReadyRef.current = true;
      return;
    }

    // Safety timeout: prevents visitors from freezing permanently if network throttles
    const timer = setTimeout(() => {
      if (!isPlaybackReadyRef.current && (readySlots.size >= 1 || clipPool.length > 0)) {
        setIsPlaybackReady(true);
        isPlaybackReadyRef.current = true;
      }
    }, 6500);

    return () => clearTimeout(timer);
  }, [readySlots, isPlaybackReady, targetThreshold, clipPool.length]);

  const handleCardClick = (clickedItemIdx: number) => {
    if (clickedItemIdx === centerIndex) {
      // Center stage clicked: launch full cinema video player!
      onOpenVideo(clipPool[centerIndex], clips);
      return;
    }
    // Rotate clicked screen into center stage
    setCenterIndex(clickedItemIdx);
  };

  if (clipPool.length === 0) return null;

  const readyCount = readySlots.size;
  const rawPct = (readyCount / targetThreshold) * 100;
  const progressPercent = Math.min(100, Math.max(10, Math.round(rawPct)));

  const { isPortraitMode, tiersAllowed } = layout;

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

      {/* DYNAMIC 3D AUDITORIUM STAGE */}
      <div
        className={`w-full h-full flex items-center justify-center transition-opacity duration-700 ${
          isPlaybackReady ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          perspective: isPortraitMode ? '1100px' : '1400px',
          transformStyle: 'preserve-3d',
          borderRadius: 0,
          outline: 'none',
          border: 'none',
        }}
      >
        {isPortraitMode ? (
          /* ================================================================= */
          /* PORTRAIT SCREENS: FLOOR-TO-CEILING VERTICAL 3D CINEMA TOWER       */
          /* ================================================================= */
          Array.from({ length: tiersAllowed * 2 + 1 }).map((_, i) => {
            const offset = i - tiersAllowed; // -2 (Top Peek), -1 (Ceiling), 0 (Center), 1 (Floor), 2 (Bottom Peek)
            const itemIdx = (centerIndex + offset + clipPool.length * 10) % clipPool.length;
            const item = clipPool[itemIdx];

            const isCenter = offset === 0;
            const isWall = Math.abs(offset) === 1; // Ceiling or Floor

            const { W_main, H_main, W1, H1, E1_y, W2, H2, E2_y } = layout as any;

            let cardW = W_main;
            let cardH = H_main;
            let transformStyle = '';
            let opacity = 1;
            let zIndex = 10;
            let shadowClass = '';

            if (isCenter) {
              // CENTER HERO SCREEN: 100% visible, plays 30% to 70%
              cardW = W_main;
              cardH = H_main;
              transformStyle = 'translateY(0px) rotateX(0deg) translateZ(60px) scale(1)';
              zIndex = 40;
              opacity = 1;
              shadowClass =
                'shadow-[0_12px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(56,189,248,0.25)]';
            } else if (isWall) {
              // CEILING (-1) OR FLOOR (+1): Exactly 30% exposed, plays 40% to 60%
              cardW = W1;
              cardH = H1;
              const dir = offset > 0 ? 1 : -1;
              const posY = dir * (E1_y - H1 / 2);
              const rotX = dir * 36; // -36deg for ceiling (backward), +36deg for floor (forward)
              transformStyle = `translateY(${posY}px) rotateX(${rotX}deg) translateZ(-40px) scale(1)`;
              zIndex = 30;
              opacity = 0.88;
              shadowClass = 'shadow-[0_8px_30px_rgba(0,0,0,0.85)] hover:brightness-110';
            } else if (Math.abs(offset) >= 2) {
              // TOP (-2) OR BOTTOM (+2) PEEKS: Exactly 10% exposed, static thumbnail
              cardW = W2;
              cardH = H2;
              const dir = offset > 0 ? 1 : -1;
              const posY = dir * (E2_y - H2 / 2);
              const rotX = dir * 50;
              transformStyle = `translateY(${posY}px) rotateX(${rotX}deg) translateZ(-110px) scale(1)`;
              zIndex = 20;
              opacity = 0.55;
              shadowClass = 'shadow-[0_6px_25px_rgba(0,0,0,0.8)] hover:brightness-125';
            }

            return (
              <CinemaScreenCard
                key={`portrait-${item.id || item.url || item.name}-${itemIdx}`}
                item={item}
                slotIdx={offset}
                isCenter={isCenter}
                isWall={isWall}
                isPlaybackReady={isPlaybackReady}
                onReady={handleVideoReady}
                onClick={() => handleCardClick(itemIdx)}
                transformStyle={transformStyle}
                width={cardW}
                height={cardH}
                opacity={opacity}
                zIndex={zIndex}
                shadowClass={shadowClass}
                registerVideoRef={registerVideoRef}
              />
            );
          })
        ) : (
          /* ================================================================= */
          /* LANDSCAPE SCREENS: 25% LARGER HORIZONTAL 3D CINEMA AUDITORIUM    */
          /* ================================================================= */
          Array.from({ length: tiersAllowed * 2 + 1 }).map((_, i) => {
            const offset = i - tiersAllowed; // -2, -1, 0, 1, 2
            const itemIdx = (centerIndex + offset + clipPool.length * 10) % clipPool.length;
            const item = clipPool[itemIdx];

            const isCenter = offset === 0;
            const isWall = Math.abs(offset) === 1;

            const { W_main, H_main, W1, E1, W2, E2, W3, E3, W4, E4 } = layout as any;

            let cardW = W_main;
            let cardH = H_main;
            let transformStyle = '';
            let opacity = 1;
            let zIndex = 10;
            let shadowClass = '';

            if (isCenter) {
              // HERO CENTER STAGE: 25% larger, 100% visible, plays 30% to 70%
              cardW = W_main;
              cardH = H_main;
              transformStyle = 'translateX(0px) rotateY(0deg) translateZ(80px) scale(1)';
              zIndex = 40;
              opacity = 1;
              shadowClass =
                'shadow-[0_16px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(56,189,248,0.25)]';
            } else if (isWall) {
              // TIER 1 WALLS: 25% larger, Exactly 30% exposed, plays 40% to 60%
              cardW = W1;
              cardH = W1 * (9 / 16);
              const dir = offset > 0 ? 1 : -1;
              const posX = dir * (E1 - W1 / 2);
              const rotY = dir * -36;
              transformStyle = `translateX(${posX}px) rotateY(${rotY}deg) translateZ(-40px) scale(1)`;
              zIndex = 30;
              opacity = 0.88;
              shadowClass = 'shadow-[0_10px_40px_rgba(0,0,0,0.85)] hover:brightness-110';
            } else if (Math.abs(offset) === 2) {
              // TIER 2 WINGS: 25% larger, Exactly 10% exposed, static thumbnail
              cardW = W2;
              cardH = W2 * (9 / 16);
              const dir = offset > 0 ? 1 : -1;
              const posX = dir * (E2 - W2 / 2);
              const rotY = dir * -52;
              transformStyle = `translateX(${posX}px) rotateY(${rotY}deg) translateZ(-110px) scale(1)`;
              zIndex = 20;
              opacity = 0.65;
              shadowClass = 'shadow-[0_8px_30px_rgba(0,0,0,0.85)] hover:brightness-125';
            } else if (Math.abs(offset) === 3) {
              // TIER 3 HORIZON: 25% larger, Exactly 5% exposed, static thumbnail
              cardW = W3;
              cardH = W3 * (9 / 16);
              const dir = offset > 0 ? 1 : -1;
              const posX = dir * (E3 - W3 / 2);
              const rotY = dir * -65;
              transformStyle = `translateX(${posX}px) rotateY(${rotY}deg) translateZ(-180px) scale(1)`;
              zIndex = 10;
              opacity = 0.45;
              shadowClass = 'shadow-[0_6px_25px_rgba(0,0,0,0.8)] hover:brightness-125';
            } else if (Math.abs(offset) >= 4) {
              // TIER 4 ULTRA-WIDE: 25% larger, Exactly 5% exposed, static thumbnail
              cardW = W4;
              cardH = W4 * (9 / 16);
              const dir = offset > 0 ? 1 : -1;
              const posX = dir * (E4 - W4 / 2);
              const rotY = dir * -75;
              transformStyle = `translateX(${posX}px) rotateY(${rotY}deg) translateZ(-250px) scale(1)`;
              zIndex = 5;
              opacity = 0.3;
              shadowClass = 'shadow-[0_6px_20px_rgba(0,0,0,0.75)] hover:brightness-125';
            }

            return (
              <CinemaScreenCard
                key={`landscape-${item.id || item.url || item.name}-${itemIdx}`}
                item={item}
                slotIdx={offset}
                isCenter={isCenter}
                isWall={isWall}
                isPlaybackReady={isPlaybackReady}
                onReady={handleVideoReady}
                onClick={() => handleCardClick(itemIdx)}
                transformStyle={transformStyle}
                width={cardW}
                height={cardH}
                opacity={opacity}
                zIndex={zIndex}
                shadowClass={shadowClass}
                registerVideoRef={registerVideoRef}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export default VideoClipsCinemaTheater;
