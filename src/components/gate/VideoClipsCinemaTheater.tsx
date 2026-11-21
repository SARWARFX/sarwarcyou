import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import type { StageMediaItem } from '../../types';
import { getVideoStreamUrl, getMediaUrl } from '../../utils/imageUrlResolver';
import { resolveStaticVideoThumbnail } from '../../utils/thumbnailResolver';
import { InitializingArchiveLoader } from './InitializingArchiveLoader';

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
  enableVideo: boolean;
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
 * - All Four Surrounding Cards (Tier 1 & Tier 2): Play from 40% to 60% of duration in a continuous loop.
 * - If browsing via mobile data, video playback is suppressed to save visitor data (shows static thumbnail).
 * - Thin 2px bottom cyan progress line on all active video screens.
 * - Pure Cinema: ZERO borders, ZERO outlines, ZERO text labels.
 */
const CinemaScreenCard: React.FC<CinemaScreenCardProps> = ({
  item,
  slotIdx,
  isCenter,
  enableVideo,
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

  const isVideoScreen = enableVideo;
  const videoSrc = isVideoScreen ? getVideoStreamUrl(item.url || item.path || '') : null;
  const imageSrc =
    (item as any).thumbnail ||
    resolveStaticVideoThumbnail(item) ||
    item.poster ||
    getMediaUrl(item.url || item.path || '');

  // Deep buffer verification for all 5 active video screens
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
          onLoad={() => onReady(slotIdx)}
          onError={() => onReady(slotIdx)}
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
 * Detects if the visitor is browsing via cellular / mobile data or has Save-Data enabled.
 * If true, cinema theater screens only display static thumbnails to conserve visitor mobile data.
 */
function checkIsMobileData(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn =
    (navigator as any).connection ||
    (navigator as any).mozConnection ||
    (navigator as any).webkitConnection;

  if (conn) {
    if (conn.type === 'cellular') return true;
    if (conn.saveData === true) return true;
    if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') return true;
  }

  if (typeof window !== 'undefined' && window.matchMedia) {
    try {
      if (window.matchMedia('(prefers-reduced-data: reduce)').matches) {
        return true;
      }
    } catch {}
  }

  return false;
}

/**
 * Modern Cinema Theater:
 * - Wide Screen: Horizontal 3D Theater (Center in middle, neighbors flanking Left & Right).
 * - Portrait Screen: Vertical 3D Theater (Exact same theater, flipped vertically: Center in middle, neighbors flanking Top & Bottom).
 * - Mobile Data Conservation: If on cellular data or data saver, screens show high-res thumbnails instead of streaming video.
 * - Sizing:
 *     - Horizontal (Laptop/Desktop): 25% larger cards (up to 720px / 54vw).
 *     - Vertical (Portrait Mobile/Tablet): Width scaled up to 92vw (max 480px), stacked vertically.
 * - Exposure Geometry:
 *     - Main Center Screen: 100% visible, elevated in front (Z = +80px).
 *     - All 4 Surrounding Cards (Tier 1 & Tier 2): Exactly 50% exposed of their screen size.
 * - Video Playback Rules:
 *     - Main center screen: Plays 30% to 70% in a continuous loop.
 *     - All other 4 screens: Play 40% to 60% in a continuous loop.
 *     - All 5 media cards play simultaneously in synchrony (or show thumbnails on mobile data).
 * - Buffer Gate: Waits for all 5 screens to buffer before revealing for stutter-free playback.
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

  // Mobile data detector: if true, all 5 cinema screens display static thumbnails to save mobile data
  const [isMobileData, setIsMobileData] = useState<boolean>(() => checkIsMobileData());

  useEffect(() => {
    const handleConnChange = () => {
      setIsMobileData(checkIsMobileData());
    };

    window.addEventListener('online', handleConnChange);
    window.addEventListener('offline', handleConnChange);

    const conn =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    if (conn && conn.addEventListener) {
      conn.addEventListener('change', handleConnChange);
    }

    return () => {
      window.removeEventListener('online', handleConnChange);
      window.removeEventListener('offline', handleConnChange);
      if (conn && conn.removeEventListener) {
        conn.removeEventListener('change', handleConnChange);
      }
    };
  }, []);

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

  // Buffering states for active video screens
  const [readySlots, setReadySlots] = useState<Set<number>>(new Set());
  const [isPlaybackReady, setIsPlaybackReady] = useState<boolean>(false);
  const isPlaybackReadyRef = useRef<boolean>(false);
  const [displayProgress, setDisplayProgress] = useState<number>(10);

  // Target threshold: ALL 5 media cards play simultaneously (Center + 4 surrounding screens)
  const targetThreshold = 5;

  useEffect(() => {
    setReadySlots(new Set());
    setIsPlaybackReady(false);
    isPlaybackReadyRef.current = false;
    setDisplayProgress(10);
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

  // Mobile data thumbnail readiness: pre-buffers the 5 thumbnails so buffer gate completes quickly
  useEffect(() => {
    if (!isMobileData || clipPool.length === 0) return;

    const visibleOffsets = [0, -1, 1, -2, 2];
    visibleOffsets.forEach((slotOffset) => {
      const itemIdx = (centerIndex + slotOffset + clipPool.length * 100) % clipPool.length;
      const item = clipPool[itemIdx];
      if (!item) return;

      const src =
        (item as any).thumbnail ||
        resolveStaticVideoThumbnail(item) ||
        item.poster ||
        getMediaUrl(item.url || item.path || '');

      if (!src) {
        handleVideoReady(slotOffset);
        return;
      }

      const img = new Image();
      if (img.complete && img.naturalWidth > 0) {
        handleVideoReady(slotOffset);
      } else {
        img.onload = () => handleVideoReady(slotOffset);
        img.onerror = () => handleVideoReady(slotOffset);
        img.src = src;
      }
    });
  }, [isMobileData, centerIndex, clipPool, handleVideoReady]);

  // Compute Clean 5-Card Cinema Theater: EXACTLY 5 CARDS FOR ANY SCREEN
  // Center Hero (100% visible) + All Other 4 Cards (50% exposed each)
  const layout = useMemo(() => {
    const W_box = dimensions.width;
    const H_box = dimensions.height;

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

    if (isVertical) {
      /* PORTRAIT SCREEN: EXACTLY 5 CARDS VERTICAL 3D AUDITORIUM */
      const W_main = Math.min(
        520,
        Math.max(260, Math.min(W_box * 0.90, (H_box * 0.36) * (16 / 9)))
      );
      const H_main = W_main * (9 / 16);

      // Tier 1 card (adjacent Top & Bottom): 88% scale, EXACTLY 50% exposed along vertical Y-axis
      const H1 = H_main * 0.88;
      const W1 = W_main * 0.88;
      const E1 = H_main / 2 + 0.50 * H1;

      // Tier 2 card (outer Top & Bottom wings): 76% scale, EXACTLY 50% exposed along vertical Y-axis
      const H2 = H_main * 0.76;
      const W2 = W_main * 0.76;
      const E2 = E1 + 0.50 * H2;

      const tiers: TierConfig[] = [
        {
          k: 1,
          cardW: W1,
          cardH: H1,
          centerPos: E1 - H1 / 2,
          rotDeg: 28,
          zPos: -40,
          opacity: 0.92,
          zIndex: 40,
          shadowClass: 'shadow-[0_10px_40px_rgba(0,0,0,0.85)] hover:brightness-110',
          exposurePct: 0.50,
        },
        {
          k: 2,
          cardW: W2,
          cardH: H2,
          centerPos: E2 - H2 / 2,
          rotDeg: 44,
          zPos: -100,
          opacity: 0.82,
          zIndex: 30,
          shadowClass: 'shadow-[0_8px_30px_rgba(0,0,0,0.85)] hover:brightness-125',
          exposurePct: 0.50,
        },
      ];

      return { isVertical: true, W_main, H_main, tiers };
    } else {
      /* WIDE SCREEN: EXACTLY 5 CARDS HORIZONTAL 3D AUDITORIUM */
      const W_main = Math.min(
        560,
        Math.max(280, Math.min(W_box * 0.36, H_box * 0.54 * (16 / 9)))
      );
      const H_main = W_main * (9 / 16);

      // Tier 1 card (adjacent Left & Right): 88% scale, EXACTLY 50% exposed along horizontal X-axis
      const W1 = W_main * 0.88;
      const H1 = W1 * (9 / 16);
      const E1 = W_main / 2 + 0.50 * W1;

      // Tier 2 card (outer Left & Right wings): 76% scale, EXACTLY 50% exposed along horizontal X-axis
      const W2 = W_main * 0.76;
      const H2 = W2 * (9 / 16);
      const E2 = E1 + 0.50 * W2;

      const tiers: TierConfig[] = [
        {
          k: 1,
          cardW: W1,
          cardH: H1,
          centerPos: E1 - W1 / 2,
          rotDeg: 30,
          zPos: -40,
          opacity: 0.92,
          zIndex: 40,
          shadowClass: 'shadow-[0_10px_40px_rgba(0,0,0,0.85)] hover:brightness-110',
          exposurePct: 0.50,
        },
        {
          k: 2,
          cardW: W2,
          cardH: H2,
          centerPos: E2 - W2 / 2,
          rotDeg: 46,
          zPos: -100,
          opacity: 0.82,
          zIndex: 30,
          shadowClass: 'shadow-[0_8px_30px_rgba(0,0,0,0.85)] hover:brightness-125',
          exposurePct: 0.50,
        },
      ];

      return { isVertical: false, W_main, H_main, tiers };
    }
  }, [dimensions, isVertical]);

  // Buffer gate: wait until center + 2 adjacent cards are ready, then slide to 100% before revealing
  useEffect(() => {
    if (isPlaybackReady) return;

    const count = readySlots.size;
    if (count >= targetThreshold) {
      // Buffer complete: slide all the way to 100% (the very right of the text!)
      setDisplayProgress(100);
      const timer = setTimeout(() => {
        setIsPlaybackReady(true);
        isPlaybackReadyRef.current = true;
      }, 350);
      return () => clearTimeout(timer);
    } else {
      const pct = Math.max(12, Math.min(88, Math.round((count / targetThreshold) * 85)));
      setDisplayProgress(pct);
    }

    // Safety timeout: prevents visitors from freezing permanently if network throttles
    const timer = setTimeout(() => {
      if (!isPlaybackReadyRef.current) {
        setDisplayProgress(100);
        setTimeout(() => {
          setIsPlaybackReady(true);
          isPlaybackReadyRef.current = true;
        }, 320);
      }
    }, 6500);

    return () => clearTimeout(timer);
  }, [readySlots, isPlaybackReady, targetThreshold]);

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

  const { W_main, H_main, tiers } = layout;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden select-none min-h-[360px] sm:min-h-[460px] md:min-h-[540px]"
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
    >
      {/* High-Tech Cybernetic Text-as-Slider Loading (Tab Switch: Blue Scheme) */}
      {!isPlaybackReady && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-transparent pointer-events-none select-none px-4">
          <InitializingArchiveLoader progress={displayProgress} scheme="blue" />
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
              enableVideo={!isMobileData}
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
                enableVideo={!isMobileData}
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
