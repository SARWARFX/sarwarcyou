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
 * - The Two Cards Beside It (isWall): Plays from 40% to 60% of duration in a continuous loop.
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
        // Main stage: start at 30%; Adjacent cards: start at 40%
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

  // Adjust playback slice when transitioning between Center (30%-70%) and Adjacent (40%-60%)
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

      // Main stage: 30% to 70% | Adjacent Cards: 40% to 60%
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
 * Modern Cinema Theater:
 * - Wide Screen: Horizontal 3D Theater (Center in middle, neighbors flanking Left & Right).
 * - Portrait Screen: Vertical 3D Theater (Exact same theater, flipped vertically: Center in middle, neighbors flanking Top & Bottom).
 * - Sizing:
 *     - Horizontal (Laptop/Desktop): 25% larger cards (up to 720px / 54vw).
 *     - Vertical (Portrait Mobile/Tablet): Width scaled up to 92vw (max 480px), stacked vertically.
 * - Exposure Geometry:
 *     - Main Center Screen: 100% visible, elevated in front (Z = +80px).
 *     - The 2 Cards Beside It: Exactly 30% exposed, angled 36°.
 *     - The 2 Cards Beside Them: Exactly 10% exposed, angled 52°.
 *     - Outer Horizon Cards: Exactly 5% exposed, angled 65°.
 * - Video Playback Rules:
 *     - Main screen: Plays 30% to 70% in a continuous loop.
 *     - The two beside it: Plays 40% to 60% in a continuous loop.
 *     - All other cards: Static high-res thumbnails (0% background video decoders).
 * - Buffer Gate: Waits for the 3 active video screens to buffer before revealing for stutter-free playback.
 * - Interactive: Clicking any card smoothly rotates it to Center Stage.
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

  // Determine vertical mode (portrait screen: when height > width or prop isPortrait)
  const isVertical = isPortrait || dimensions.height > dimensions.width * 1.05;

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

  // Buffering states for the 3 active video screens (center, and the 2 adjacent cards)
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

  // Compute screen-decided dynamic tiers: ZERO predefined card count!
  // Slices dynamically until the container boundaries (availableHalf) are completely filled.
  const layout = useMemo(() => {
    const W_box = dimensions.width;
    const H_box = dimensions.height;

    // 1. Calculate Main Center Screen (Scaled 25% larger on wide landscape, generously fitted on portrait)
    let W_main: number;
    let H_main: number;

    if (isVertical) {
      W_main = Math.min(
        680,
        Math.max(260, Math.min(W_box * 0.94, H_box * 0.48 * (16 / 9)))
      );
      H_main = W_main * (9 / 16);
    } else {
      W_main = Math.min(
        760,
        Math.max(300, Math.min(W_box * 0.56, H_box * 0.68 * (16 / 9)))
      );
      H_main = W_main * (9 / 16);
    }

    const availableHalf = isVertical ? H_box / 2 : W_box / 2;
    const primaryMain = isVertical ? H_main : W_main;

    // 2. Dynamically add tiers until screen edges are completely reached (ZERO predefined cap!)
    interface TierConfig {
      k: number;
      cardW: number;
      cardH: number;
      centerPos: number;
      rotDeg: number;
      zPos: number;
      opacity: number;
      zIndex: number;
      shadowClass: string;
      exposurePct: number;
    }

    const tiers: TierConfig[] = [];
    let currentEdge = primaryMain / 2;
    let k = 1;

    // Continue adding tiers until currentEdge reaches or exceeds availableHalf
    while (currentEdge < availableHalf && k <= 30) {
      const scale = Math.max(0.60, 1 - k * 0.04);
      const cardPrimary = primaryMain * scale;
      const cardSecondary = isVertical ? cardPrimary * (16 / 9) : cardPrimary * (9 / 16);

      // Strict user specifications:
      // - The other two beside main screen: exactly 30%
      // - The other two beside them: exactly 10%
      // - Outer wings / horizon screens: 10% tapering to 5%
      let exposurePct = 0.10;
      if (k === 1) exposurePct = 0.30;
      else if (k === 2) exposurePct = 0.10;
      else if (k >= 6) exposurePct = 0.08;

      const exposure = cardPrimary * exposurePct;
      currentEdge += exposure;

      const centerPos = currentEdge - cardPrimary / 2;

      // Smooth mathematical 3D perspective mapping
      let rotDeg: number;
      let zPos: number;
      let opacity: number;
      let zIdx: number;

      if (k === 1) {
        rotDeg = 36;
        zPos = -40;
        opacity = 0.90;
        zIdx = 45;
      } else if (k === 2) {
        rotDeg = 52;
        zPos = -100;
        opacity = 0.75;
        zIdx = 40;
      } else if (k === 3) {
        rotDeg = 64;
        zPos = -160;
        opacity = 0.62;
        zIdx = 35;
      } else if (k === 4) {
        rotDeg = 72;
        zPos = -220;
        opacity = 0.50;
        zIdx = 30;
      } else {
        rotDeg = Math.min(84, 72 + (k - 4) * 2.5);
        zPos = -220 - (k - 4) * 45;
        opacity = Math.max(0.18, 0.50 - (k - 4) * 0.045);
        zIdx = Math.max(2, 30 - k);
      }

      tiers.push({
        k,
        cardW: isVertical ? cardSecondary : cardPrimary,
        cardH: isVertical ? cardPrimary : cardSecondary,
        centerPos,
        rotDeg,
        zPos,
        opacity,
        zIndex: zIdx,
        shadowClass:
          k === 1
            ? 'shadow-[0_10px_40px_rgba(0,0,0,0.85)] hover:brightness-110'
            : 'shadow-[0_8px_30px_rgba(0,0,0,0.85)] hover:brightness-125',
        exposurePct,
      });

      k++;
    }

    return {
      isVertical,
      W_main,
      H_main,
      tiers,
    };
  }, [dimensions, isVertical]);

  // Buffer gate: wait until center + 2 adjacent cards are ready before revealing
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

  const { W_main, H_main, tiers } = layout;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden select-none min-h-[360px] sm:min-h-[460px] md:min-h-[540px]"
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
    >
      {/* High-Tech Cybernetic Text-as-Slider Loading: Color fills left-to-right as progress */}
      {!isPlaybackReady && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-transparent pointer-events-none select-none px-4">
          <div
            className="relative inline-block font-bold uppercase select-none text-base sm:text-lg md:text-xl tracking-[0.22em] whitespace-nowrap"
            style={{ fontFamily: "'Science Gothic', sans-serif" }}
          >
            {/* Base Layer: Initial two-color dimmed state */}
            <div className="opacity-25 transition-opacity duration-300">
              <span className="text-white">INITIALIZING </span>
              <span className="text-[#38bdf8]">ARCHIVE</span>
            </div>

            {/* Active Progress Layer: Fills in glowing vibrant colors from left to right as the slider */}
            <div
              className="absolute inset-0 overflow-hidden transition-[width] duration-300 ease-out"
              style={{
                width: `${progressPercent}%`,
                borderRight: progressPercent < 100 ? '2px solid #38bdf8' : 'none',
                boxShadow: progressPercent < 100 ? '2px 0 10px rgba(56,189,248,0.85)' : 'none',
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

      {/* DYNAMIC 3D AUDITORIUM STAGE (Horizontal on wide, Vertical on portrait) */}
      <div
        className={`w-full h-full flex items-center justify-center transition-opacity duration-700 ${
          isPlaybackReady ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          perspective: isVertical ? '1100px' : '1400px',
          transformStyle: 'preserve-3d',
          borderRadius: 0,
          outline: 'none',
          border: 'none',
        }}
      >
        {/* HERO CENTER STAGE: 100% visible, plays 30% to 70% */}
        {(() => {
          const item = clipPool[centerIndex % clipPool.length];
          if (!item) return null;
          const centerTransform = isVertical
            ? 'translateY(0px) rotateX(0deg) translateZ(80px) scale(1)'
            : 'translateX(0px) rotateY(0deg) translateZ(80px) scale(1)';

          return (
            <CinemaScreenCard
              key={`${isVertical ? 'v' : 'h'}-center-${item.id || item.url || item.name}-${centerIndex}`}
              item={item}
              slotIdx={0}
              isCenter={true}
              isWall={false}
              isPlaybackReady={isPlaybackReady}
              onReady={handleVideoReady}
              onClick={() => handleCardClick(centerIndex)}
              transformStyle={centerTransform}
              width={W_main}
              height={H_main}
              opacity={1}
              zIndex={50}
              shadowClass="shadow-[0_16px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(56,189,248,0.25)]"
              registerVideoRef={registerVideoRef}
            />
          );
        })()}

        {/* SCREEN-DECIDED DYNAMIC TIERS (Symmetrical Pairs - ZERO predefined card count!) */}
        {tiers.map((tier) => {
          return [-1, 1].map((dir) => {
            const slotOffset = dir * tier.k;
            const itemIdx = (centerIndex + slotOffset + clipPool.length * 100) % clipPool.length;
            const item = clipPool[itemIdx];
            if (!item) return null;

            const isWall = tier.k === 1;

            let transformStyle = '';
            if (isVertical) {
              const posY = dir * tier.centerPos;
              const rotX = dir * tier.rotDeg;
              transformStyle = `translateY(${posY}px) rotateX(${rotX}deg) translateZ(${tier.zPos}px) scale(1)`;
            } else {
              const posX = dir * tier.centerPos;
              const rotY = dir * -tier.rotDeg;
              transformStyle = `translateX(${posX}px) rotateY(${rotY}deg) translateZ(${tier.zPos}px) scale(1)`;
            }

            return (
              <CinemaScreenCard
                key={`${isVertical ? 'v' : 'h'}-${slotOffset}-${item.id || item.url || item.name}-${itemIdx}`}
                item={item}
                slotIdx={slotOffset}
                isCenter={false}
                isWall={isWall}
                isPlaybackReady={isPlaybackReady}
                onReady={handleVideoReady}
                onClick={() => handleCardClick(itemIdx)}
                transformStyle={transformStyle}
                width={tier.cardW}
                height={tier.cardH}
                opacity={tier.opacity}
                zIndex={tier.zIndex}
                shadowClass={tier.shadowClass}
                registerVideoRef={registerVideoRef}
              />
            );
          });
        })}
      </div>
    </div>
  );
};

export default VideoClipsCinemaTheater;
