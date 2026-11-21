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
 * - Desktop: 3D Horizontal Auditorium (Peek Left -> Left Wall -> Center Stage -> Right Wall -> Peek Right)
 * - Mobile: Option A Vertical Cinema Tower (Peek Top -> Ceiling Screen -> Center Stage -> Floor Screen -> Peek Bottom)
 * - Hardware Safe: Only the 3 active visible screens play live video simultaneously (3 video decoders << GPU limit).
 * - Clicking any wall/screen smoothly rotates it into the Center Stage.
 * - Clicking Center Stage launches the cinema video player.
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

  // Center index in selected5 (starts at 2 so 0=peek-left, 1=left-wall, 2=center, 3=right-wall, 4=peek-right)
  const [centerIndex, setCenterIndex] = useState<number>(2);

  // Buffering states for the 3 active visible videos (center, left/ceiling, right/floor)
  const [readyIndices, setReadyIndices] = useState<Set<number>>(new Set());
  const [isPlaybackReady, setIsPlaybackReady] = useState<boolean>(false);
  const isPlaybackReadyRef = useRef<boolean>(false);

  // The 3 active visible slots
  const activeVisibleIndices = useMemo(() => {
    const leftOrTop = (centerIndex - 1 + 5) % 5;
    const center = centerIndex;
    const rightOrBottom = (centerIndex + 1) % 5;
    return [leftOrTop, center, rightOrBottom];
  }, [centerIndex]);

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

  const verifyBufferDepth = useCallback(
    (el: HTMLVideoElement | null, slotIdx: number) => {
      if (!el) return;
      if (el.readyState >= 3) {
        handleVideoReady(slotIdx);
        return;
      }
      if (el.buffered.length > 0) {
        const bufferedEnd = el.buffered.end(el.buffered.length - 1);
        if (bufferedEnd >= 1.5) {
          handleVideoReady(slotIdx);
        }
      }
    },
    [handleVideoReady]
  );

  // Safety buffer gate timeout
  useEffect(() => {
    if (isPlaybackReady) return;

    if (readyIndices.size >= 2) {
      setIsPlaybackReady(true);
      isPlaybackReadyRef.current = true;
      return;
    }

    const timer = setTimeout(() => {
      if (!isPlaybackReadyRef.current) {
        setIsPlaybackReady(true);
        isPlaybackReadyRef.current = true;
      }
    }, 2800);

    return () => clearTimeout(timer);
  }, [readyIndices.size, isPlaybackReady]);

  // Synchronize playback of visible videos once ready
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
  const progressPercent = Math.min(100, Math.max(20, Math.round((readyCount / 3) * 100)));

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden select-none min-h-[360px] sm:min-h-[460px] md:min-h-[540px]"
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
    >
      {/* High-Tech Cyber Loading Card */}
      {!isPlaybackReady && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-transparent pointer-events-none select-none px-4">
          <div className="flex flex-col items-center justify-between w-full max-w-[295px] min-h-[290px] p-8 sm:w-auto sm:min-w-[500px] sm:max-w-[620px] sm:min-h-0 sm:px-14 sm:py-6 md:px-16 md:py-7 bg-[#07090e]/95 border border-[#38bdf8]/45 shadow-[0_0_45px_rgba(0,0,0,0.9),0_0_25px_rgba(56,189,248,0.22)] backdrop-blur-md">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-3 h-3 bg-[#38bdf8] shadow-[0_0_12px_#38bdf8] animate-pulse shrink-0" />
              <span
                className="text-base sm:text-lg font-bold tracking-[0.14em] uppercase text-white whitespace-nowrap"
                style={{ fontFamily: "'Science Gothic', sans-serif" }}
              >
                <span className="text-[#38bdf8] drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]">LOADING CINEMA THEATER //</span> PLEASE WAIT
              </span>
            </div>
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
      >
        {isPortrait ? (
          /* ================================================================= */
          /* MOBILE PORTRAIT: OPTION A VERTICAL CINEMA TOWER (Ceiling -> Center -> Floor) */
          /* ================================================================= */
          <div
            className="w-full max-w-[380px] h-[520px] sm:h-[600px] flex items-center justify-center relative"
            style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}
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
                // Top Peek
                transformStyle = 'translateY(-135%) rotateX(-45deg) scale(0.75) translateZ(-120px)';
                opacity = 0.25;
                zIndex = 5;
              } else if (isCeiling) {
                // Ceiling Wall
                transformStyle = 'translateY(-68%) rotateX(-32deg) translateZ(-30px) scale(0.92)';
                opacity = 0.88;
                zIndex = 15;
              } else if (isCenter) {
                // Center Main Screen
                transformStyle = 'translateY(0%) rotateX(0deg) translateZ(40px) scale(1.05)';
                opacity = 1;
                zIndex = 30;
              } else if (isFloor) {
                // Floor Wall
                transformStyle = 'translateY(68%) rotateX(32deg) translateZ(-30px) scale(0.92)';
                opacity = 0.88;
                zIndex = 15;
              } else if (offset === 2) {
                // Bottom Peek
                transformStyle = 'translateY(135%) rotateX(45deg) scale(0.75) translateZ(-120px)';
                opacity = 0.25;
                zIndex = 5;
              }

              return (
                <div
                  key={`${item.id || item.url || item.name}-${idx}`}
                  onClick={() => handleCardClick(idx)}
                  className={`absolute w-[285px] sm:w-[320px] aspect-[16/9] bg-black overflow-hidden shadow-2xl transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
                    isCenter
                      ? 'border-2 border-cyan-400 shadow-[0_0_40px_rgba(56,189,248,0.35)] cursor-pointer'
                      : isVisibleScreen
                      ? 'border border-cyan-500/40 cursor-pointer hover:border-cyan-400'
                      : 'border border-white/10 pointer-events-none'
                  }`}
                  style={{
                    transform: transformStyle,
                    opacity,
                    zIndex,
                    borderRadius: 0,
                    outline: 'none',
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

                  {/* Tactical Screen Label */}
                  <div className="absolute top-1.5 left-2 px-1.5 py-0.5 bg-black/80 border border-cyan-500/40 text-[9px] font-mono-tech text-cyan-400 tracking-wider">
                    {isCenter ? '★ MAIN CINEMA' : isCeiling ? '▲ CEILING SCREEN' : isFloor ? '▼ FLOOR SCREEN' : 'RESERVE'}
                  </div>

                  {isCenter && (
                    <div className="absolute bottom-1.5 inset-x-2 flex items-center justify-between text-[10px] font-mono-tech text-white bg-black/70 px-2 py-0.5 border-t border-cyan-400/40">
                      <span className="truncate pr-2">{item.name || 'Cinema Master'}</span>
                      <span className="text-cyan-400 font-bold shrink-0">CLICK TO PLAY</span>
                    </div>
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
            className="w-full max-w-6xl h-[380px] sm:h-[460px] md:h-[500px] flex items-center justify-center relative px-4"
            style={{ perspective: '1200px', transformStyle: 'preserve-3d' }}
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
                // Peek Left
                transformStyle = 'translateX(-138%) rotateY(52deg) scale(0.72) translateZ(-160px)';
                opacity = 0.3;
                zIndex = 5;
              } else if (isLeftWall) {
                // Left Wall
                transformStyle = 'translateX(-58%) rotateY(38deg) translateZ(-40px) scale(0.92)';
                opacity = 0.9;
                zIndex = 15;
              } else if (isCenter) {
                // Center Stage
                transformStyle = 'translateX(0%) rotateY(0deg) translateZ(50px) scale(1.08)';
                opacity = 1;
                zIndex = 30;
              } else if (isRightWall) {
                // Right Wall
                transformStyle = 'translateX(58%) rotateY(-38deg) translateZ(-40px) scale(0.92)';
                opacity = 0.9;
                zIndex = 15;
              } else if (offset === 2) {
                // Peek Right
                transformStyle = 'translateX(138%) rotateY(-52deg) scale(0.72) translateZ(-160px)';
                opacity = 0.3;
                zIndex = 5;
              }

              return (
                <div
                  key={`${item.id || item.url || item.name}-${idx}`}
                  onClick={() => handleCardClick(idx)}
                  className={`absolute w-[300px] sm:w-[420px] md:w-[480px] aspect-[16/9] bg-black overflow-hidden shadow-2xl transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
                    isCenter
                      ? 'border-2 border-cyan-400 shadow-[0_0_50px_rgba(56,189,248,0.35),0_0_90px_rgba(0,0,0,0.9)] cursor-pointer'
                      : isVisibleScreen
                      ? 'border border-cyan-500/40 cursor-pointer hover:border-cyan-400 hover:scale-[0.95]'
                      : 'border border-white/10 pointer-events-none'
                  }`}
                  style={{
                    transform: transformStyle,
                    opacity,
                    zIndex,
                    borderRadius: 0,
                    outline: 'none',
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

                  {/* Tactical Screen Label */}
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/80 border border-cyan-500/40 text-[10px] font-mono-tech text-cyan-400 tracking-wider">
                    {isCenter ? '★ MAIN STAGE CINEMA' : isLeftWall ? '◀ LEFT WALL' : isRightWall ? 'RIGHT WALL ▶' : 'RESERVE'}
                  </div>

                  {isCenter && (
                    <div className="absolute bottom-2 inset-x-2 flex items-center justify-between text-xs font-mono-tech text-white bg-black/75 px-3 py-1 border-t border-cyan-400/40 backdrop-blur-md">
                      <span className="truncate pr-3">{item.name || '1080p Master'}</span>
                      <span className="text-cyan-400 font-bold shrink-0">CLICK TO LAUNCH CINEMA</span>
                    </div>
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
