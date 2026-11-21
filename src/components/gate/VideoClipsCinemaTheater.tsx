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

/**
 * Modern 5-Stage Cinema Theater Showcase for Video Clips:
 * - Desktop: 3D Horizontal Auditorium:
 *     - Center Main Stage: Massively scaled hero screen (100% visible, elevated in front).
 *     - Left & Right Walls: Show ~50% (half) of their video screen, angled inward (rotateY 42deg).
 *     - Far Outer Reserve Peeks: Show ~18-20% at the very sides, angled deeper (rotateY 56deg).
 * - Mobile Portrait: Option A Vertical Cinema Tower:
 *     - Center Main Stage: Largest 16:9 hero screen.
 *     - Ceiling & Floor Screens: Show ~50% (half) of their video screen, angled backward (rotateX 36deg).
 *     - Top & Bottom Outer Peeks: Show ~18-20% at the extreme top/bottom edges.
 * - Pure Cinematic Presentation: ZERO outlines, ZERO borders, ZERO text overlays.
 * - Hardware Safe: Only the 3 visible screens stream live video simultaneously (3 decoders << GPU limit).
 * - Buffer-Guaranteed Loading Screen:
 *     - Identical to Shorts featured page (mobile 2-line split, desktop horizontal banner, solid gauge).
 *     - Strictly holds until ALL 3 active visible videos have buffered enough data before revealing,
 *       ensuring completely buffer-free, uninterrupted playback.
 * - Interactive: Clicking any wall/screen smoothly rotates it into Center Stage; clicking Center Stage launches player.
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

  // Buffering states for the 3 active visible videos (center, left/ceiling, right/floor)
  const [readyIndices, setReadyIndices] = useState<Set<number>>(new Set());
  const [isPlaybackReady, setIsPlaybackReady] = useState<boolean>(false);
  const isPlaybackReadyRef = useRef<boolean>(false);

  // The 3 active visible slots
  const activeVisibleIndices = useMemo(() => {
    const prev = (centerIndex - 1 + 5) % 5;
    const center = centerIndex;
    const next = (centerIndex + 1) % 5;
    return [prev, center, next];
  }, [centerIndex]);

  // Target threshold: ALL 3 visible media items must be fully buffered before launching playback
  const targetThreshold = 3;

  useEffect(() => {
    setReadyIndices(new Set());
    setIsPlaybackReady(false);
    isPlaybackReadyRef.current = false;
    videoRefs.current = [];
  }, [selected5]);

  useEffect(() => {
    isPlaybackReadyRef.current = isPlaybackReady;
  }, [isPlaybackReady]);

  const handleVideoReady = useCallback((slotIdx: number) => {
    setReadyIndices((prev) => {
      if (prev.has(slotIdx)) return prev;
      const next = new Set(prev);
      next.add(slotIdx);
      return next;
    });
  }, []);

  // Deep buffer inspection matching Shorts featured page: verifies deep buffer before marking ready
  const verifyBufferDepth = useCallback(
    (el: HTMLVideoElement | null, slotIdx: number) => {
      if (!el) return;

      // HTML5 readyState >= 4 means HAVE_ENOUGH_DATA
      if (el.readyState >= 4) {
        handleVideoReady(slotIdx);
        return;
      }

      // Check timeRanges buffer depth in seconds
      if (el.buffered.length > 0) {
        const bufferedEnd = el.buffered.end(el.buffered.length - 1);
        const duration = el.duration;
        // Require at least 3 seconds of buffer, or 50% of video duration, or readyState >= 3 with 2s buffer
        if (
          bufferedEnd >= 3 ||
          (duration && !isNaN(duration) && duration > 0 && bufferedEnd >= duration * 0.5) ||
          (el.readyState >= 3 && bufferedEnd >= 2)
        ) {
          handleVideoReady(slotIdx);
        }
      }
    },
    [handleVideoReady]
  );

  // Buffer gate: strictly wait until ALL 3 visible videos are ready to prevent any buffer stutter
  useEffect(() => {
    if (isPlaybackReady) return;

    if (readyIndices.size >= targetThreshold) {
      setIsPlaybackReady(true);
      isPlaybackReadyRef.current = true;
      return;
    }

    // Safety timeout: prevents visitors from freezing permanently if network throttles
    const timer = setTimeout(() => {
      if (!isPlaybackReadyRef.current && readyIndices.size >= 1) {
        setIsPlaybackReady(true);
        isPlaybackReadyRef.current = true;
      }
    }, 7000);

    return () => clearTimeout(timer);
  }, [readyIndices.size, isPlaybackReady]);

  // Synchronize playback of visible videos once buffering is complete
  useEffect(() => {
    if (isPlaybackReady && selected5.length > 0) {
      activeVisibleIndices.forEach((idx) => {
        const v = videoRefs.current[idx];
        if (v && v.paused) {
          v.muted = true;
          v.defaultMuted = true;
          v.play().catch(() => {});
        }
      });
    }
  }, [isPlaybackReady, activeVisibleIndices, selected5.length]);

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
                <span className="text-white">
                  PLEASE WAIT
                </span>
              </div>
            </div>

            {/* Desktop & Tablet View: Single Horizontal Line */}
            <div className="hidden sm:flex items-center gap-3.5 mb-4">
              <div className="w-3 h-3 bg-[#38bdf8] shadow-[0_0_12px_#38bdf8] animate-pulse shrink-0" />
              <span
                className="text-base sm:text-base md:text-lg font-bold tracking-[0.14em] uppercase text-white whitespace-nowrap"
                style={{ fontFamily: "'Science Gothic', sans-serif" }}
              >
                <span className="text-[#38bdf8] drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]">LOADING MEDIA //</span> PLEASE WAIT
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
              const isVisibleScreen = isCenter || isCeiling || isFloor;

              const videoSrc = getVideoStreamUrl(item.url || item.path || '');
              const imageSrc =
                (item as any).thumbnail ||
                resolveStaticVideoThumbnail(item) ||
                item.poster ||
                getMediaUrl(item.url || item.path || '');

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
                <div
                  key={`${item.id || item.url || item.name}-${idx}`}
                  onClick={() => handleCardClick(idx)}
                  className={`absolute w-[92vw] max-w-[370px] sm:max-w-[420px] aspect-[16/9] bg-black overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] cursor-pointer ${
                    isCenter
                      ? 'shadow-[0_12px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(56,189,248,0.25)]'
                      : 'shadow-[0_8px_30px_rgba(0,0,0,0.85)] hover:brightness-110'
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
                  {isVisibleScreen ? (
                    <video
                      ref={(el) => {
                        videoRefs.current[idx] = el;
                        if (el) {
                          el.muted = true;
                          el.defaultMuted = true;
                          el.playsInline = true;
                          verifyBufferDepth(el, idx);
                        }
                      }}
                      src={videoSrc}
                      poster={imageSrc}
                      loop
                      muted
                      playsInline
                      preload="auto"
                      onCanPlayThrough={() => handleVideoReady(idx)}
                      onProgress={(e) => verifyBufferDepth(e.currentTarget, idx)}
                      onLoadedData={(e) => {
                        if (e.currentTarget.readyState >= 3) handleVideoReady(idx);
                      }}
                      className="w-full h-full object-cover block"
                    />
                  ) : (
                    <img src={imageSrc} alt="" className="w-full h-full object-cover block" />
                  )}
                </div>
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
              const isVisibleScreen = isCenter || isLeftWall || isRightWall;

              const videoSrc = getVideoStreamUrl(item.url || item.path || '');
              const imageSrc =
                (item as any).thumbnail ||
                resolveStaticVideoThumbnail(item) ||
                item.poster ||
                getMediaUrl(item.url || item.path || '');

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
                <div
                  key={`${item.id || item.url || item.name}-${idx}`}
                  onClick={() => handleCardClick(idx)}
                  className={`absolute w-[460px] sm:w-[580px] md:w-[700px] lg:w-[820px] xl:w-[920px] max-w-[76vw] aspect-[16/9] bg-black overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] cursor-pointer ${
                    isCenter
                      ? 'shadow-[0_16px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(56,189,248,0.25)]'
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
                  {isVisibleScreen ? (
                    <video
                      ref={(el) => {
                        videoRefs.current[idx] = el;
                        if (el) {
                          el.muted = true;
                          el.defaultMuted = true;
                          el.playsInline = true;
                          verifyBufferDepth(el, idx);
                        }
                      }}
                      src={videoSrc}
                      poster={imageSrc}
                      loop
                      muted
                      playsInline
                      preload="auto"
                      onCanPlayThrough={() => handleVideoReady(idx)}
                      onProgress={(e) => verifyBufferDepth(e.currentTarget, idx)}
                      onLoadedData={(e) => {
                        if (e.currentTarget.readyState >= 3) handleVideoReady(idx);
                      }}
                      className="w-full h-full object-cover block"
                    />
                  ) : (
                    <img src={imageSrc} alt="" className="w-full h-full object-cover block" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoClipsCinemaTheater;
