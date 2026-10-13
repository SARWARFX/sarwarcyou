/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Check,
  Download,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  Repeat,
  PictureInPicture2,
  Gauge,
} from 'lucide-react';
import { getDirectImageUrl, ensureHttps } from '../utils/imageUrlResolver';
import { downloadMedia } from '../utils/downloadMedia';
import {
  getCachedVideoPoster,
  prewarmVideoStream,
  formatVideoPosterUrl,
} from '../utils/videoPosterGenerator';
import type { AlbumData, StageMediaItem } from '../types';

interface YouTubeTheaterModalProps {
  isOpen: boolean;
  onClose: () => void;
  album: AlbumData | null;
  initialIndex: number;
  posterUrl?: string;
  onNextAlbum?: () => void;
  onPrevAlbum?: () => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const PLAYBACK_RATES = [0.5, 1, 1.25, 1.5, 2];

export const YouTubeTheaterModal: React.FC<YouTubeTheaterModalProps> = ({
  isOpen,
  onClose,
  album,
  initialIndex,
  posterUrl,
  onNextAlbum: _onNextAlbum,
  onPrevAlbum: _onPrevAlbum,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isCrossfading, setIsCrossfading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Floating HUD Visibility state (Auto-fade after 2.5s)
  const [isHudVisible, setIsHudVisible] = useState(true);
  const hudTimeoutRef = useRef<number | null>(null);

  // A-B Looper State
  const [isAbLoopActive, setIsAbLoopActive] = useState(false);
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);

  // Ripple feedback states
  const [centerRipple, setCenterRipple] = useState<'play' | 'pause' | null>(null);
  const [seekRipple, setSeekRipple] = useState<{ side: 'left' | 'right'; text: string } | null>(null);

  // Velocity Swipe-to-Dismiss State
  const [dismissOffsetY, setDismissOffsetY] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const playlistContainerRef = useRef<HTMLDivElement>(null);

  // Sync index when initialIndex changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
    setIsZoomed(false);
    setHasStarted(false);
    setIsPlaying(false);
    setIsBuffering(true);
    setCurrentTime(0);
    setDismissOffsetY(0);
    setIsAbLoopActive(false);
    setLoopStart(null);
    setLoopEnd(null);
  }, [initialIndex, isOpen]);

  const items = useMemo(() => album?.items || [], [album]);
  const currentItem: StageMediaItem | undefined = items[currentIndex] || items[0];

  // Auto-hide HUD after 2.5s of inactivity
  const resetHudTimer = useCallback(() => {
    setIsHudVisible(true);
    if (hudTimeoutRef.current) {
      window.clearTimeout(hudTimeoutRef.current);
    }
    hudTimeoutRef.current = window.setTimeout(() => {
      // Don't auto-hide if paused or if user is tweaking loop or speed menu
      if (videoRef.current && !videoRef.current.paused && !showSpeedMenu) {
        setIsHudVisible(false);
      }
    }, 2500);
  }, [showSpeedMenu]);

  useEffect(() => {
    resetHudTimer();
    return () => {
      if (hudTimeoutRef.current) window.clearTimeout(hudTimeoutRef.current);
    };
  }, [resetHudTimer, isPlaying]);

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      resetHudTimer();
      if (e.key === 'Escape') {
        if (isFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowRight') {
        goToIndex(currentIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        goToIndex(currentIndex - 1);
      } else if (e.key === ' ' && currentItem?.type === 'video') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'm' || e.key === 'M') {
        handleMuteToggle();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'j' || e.key === 'J') {
        seekRelative(-10);
      } else if (e.key === 'l' || e.key === 'L') {
        seekRelative(10);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, currentIndex, items.length, onClose, isFullscreen, currentItem?.type, resetHudTimer]);

  const goToIndex = useCallback(
    (idx: number) => {
      if (items.length === 0) return;
      const next = (idx + items.length) % items.length;
      setIsCrossfading(true);
      setIsZoomed(false);
      setHasStarted(false);
      setIsPlaying(false);
      setIsBuffering(true);
      setCurrentIndex(next);
      setDismissOffsetY(0);
      setIsAbLoopActive(false);
      setLoopStart(null);
      setLoopEnd(null);
      window.setTimeout(() => {
        setIsCrossfading(false);
      }, 200);
    },
    [items.length]
  );

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    resetHudTimer();
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      setCenterRipple('play');
      setTimeout(() => setCenterRipple(null), 550);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      setCenterRipple('pause');
      setTimeout(() => setCenterRipple(null), 550);
    }
  }, [resetHudTimer]);

  const seekRelative = useCallback((delta: number) => {
    if (!videoRef.current) return;
    resetHudTimer();
    const newTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + delta));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);

    setSeekRipple({
      side: delta > 0 ? 'right' : 'left',
      text: delta > 0 ? '+10s' : '-10s',
    });
    setTimeout(() => setSeekRipple(null), 650);
  }, [resetHudTimer]);

  // A-B Looping Check on time update
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    setCurrentTime(cur);

    if (isAbLoopActive && loopStart !== null && loopEnd !== null && loopEnd > loopStart) {
      if (cur >= loopEnd || cur < loopStart) {
        videoRef.current.currentTime = loopStart;
        setCurrentTime(loopStart);
      }
    }
  }, [isAbLoopActive, loopStart, loopEnd]);

  // Double-tap and touch gesture handling on video viewport
  const handleStageTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: performance.now(),
    };
  }, []);

  const handleStageTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    // Allow dragging downwards to dismiss
    if (dy > 0) {
      setDismissOffsetY(dy);
    }
  }, []);

  const handleStageTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = performance.now() - touchStartRef.current.time;

    // Velocity swipe down to dismiss
    if ((dy > 110 && dt < 400) || dy > 180) {
      onClose();
      return;
    }
    setDismissOffsetY(0);

    // Double-tap detection
    const now = performance.now();
    const tapX = touch.clientX;
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = tapX - rect.left;
    const isRightHalf = relativeX > rect.width / 2;

    if (lastTapRef.current && now - lastTapRef.current.time < 300 && Math.abs(tapX - lastTapRef.current.x) < 50) {
      // Double tap!
      if (isRightHalf) {
        seekRelative(10);
      } else {
        seekRelative(-10);
      }
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { time: now, x: tapX };
      resetHudTimer();
    }
    touchStartRef.current = null;
  }, [onClose, seekRelative, resetHudTimer]);

  const handleDownload = useCallback(async () => {
    if (!currentItem || isDownloading) return;
    setIsDownloading(true);
    setDownloadSuccess(false);
    try {
      await downloadMedia(currentItem.url, currentItem.title || currentItem.id);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2200);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  }, [currentItem, isDownloading]);

  const handleMuteToggle = useCallback(() => {
    resetHudTimer();
    setIsMuted((prev) => {
      const next = !prev;
      if (videoRef.current) videoRef.current.muted = next;
      return next;
    });
  }, [resetHudTimer]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    resetHudTimer();
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  }, [resetHudTimer]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    resetHudTimer();
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
  }, [resetHudTimer]);

  const handleSpeedSelect = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSpeedMenu(false);
    resetHudTimer();
  }, [resetHudTimer]);

  const togglePiP = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP not supported or disallowed:', err);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = videoContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  const rawUrl = currentItem ? ensureHttps(currentItem.url) : '';
  let streamUrl = rawUrl;
  if (streamUrl.includes('drive.google.com') && !streamUrl.includes('/preview')) {
    streamUrl = streamUrl.replace(/\/view(\?.*)?$/, '/preview');
    if (!streamUrl.includes('/preview')) {
      streamUrl = streamUrl.replace(/\?usp=.*$/, '') + '/preview';
    }
  }

  const activePoster = useMemo(() => {
    if (!currentItem) return '';
    if (currentIndex === initialIndex && posterUrl) return posterUrl;
    return (
      getCachedVideoPoster(currentItem.url) ||
      currentItem.posterUrl ||
      currentItem.thumbnail ||
      getDirectImageUrl(currentItem, currentIndex)
    );
  }, [currentItem, currentIndex, initialIndex, posterUrl]);

  // Aggressive Playback Initialization: immediately invoke .play().catch(...)
  useEffect(() => {
    if (!isOpen || currentItem?.type !== 'video' || !videoRef.current) return;
    videoRef.current.currentTime = 0;
    const playPromise = videoRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          // Handled via user tap if blocked by browser policy
        });
    }
  }, [currentIndex, isOpen, streamUrl, currentItem?.type]);

  if (!isOpen || !currentItem) return null;

  const directImgUrl = getDirectImageUrl(currentItem, currentIndex);
  const rawTitle = currentItem.title || '';
  const cleanTitle =
    rawTitle.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim() ||
    (currentItem.type === 'video' ? 'Cinema Stream' : 'Photograph');
  const isDirectVideo =
    streamUrl.toLowerCase().match(/\.(mp4|webm|mov|mkv)/) !== null ||
    streamUrl.includes('huggingface.co');

  // Compute A-B loop percentage offsets for timeline
  const loopStartPct = duration > 0 && loopStart !== null ? Math.max(0, Math.min(100, (loopStart / duration) * 100)) : 0;
  const loopEndPct = duration > 0 && loopEnd !== null ? Math.max(0, Math.min(100, (loopEnd / duration) * 100)) : 100;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={cleanTitle}
      onMouseMove={resetHudTimer}
      style={{
        transform: dismissOffsetY > 0 ? `translate3d(0, ${dismissOffsetY}px, 0) scale(${Math.max(0.85, 1 - dismissOffsetY / 1200)})` : 'none',
        transition: dismissOffsetY === 0 ? 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
      }}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-2xl animate-fade-in select-none overflow-hidden"
    >
      {/* ===== TOP STATUS / ACTION BAR ===== */}
      <div className="w-full px-4 sm:px-6 py-3 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl flex items-center justify-between text-xs font-mono z-30 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="px-2.5 py-0.5 rounded-full bg-zinc-800/80 border border-white/10 text-zinc-300 font-semibold tracking-widest text-[9px] uppercase flex-shrink-0">
            {album?.name || 'ALBUM'}
          </span>
          <span className="text-zinc-600 hidden sm:inline">•</span>
          <span className="text-zinc-400 font-medium tracking-wider hidden sm:inline text-[10px]">
            {String(currentIndex + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
          </span>
          <span className="text-zinc-200 font-medium truncate max-w-[180px] sm:max-w-xs md:max-w-md hidden md:inline text-[11px]">
            {cleanTitle}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {currentItem.type === 'image' && (
            <button
              onClick={() => setIsZoomed(!isZoomed)}
              className="p-2 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors duration-200 cursor-pointer border border-white/[0.06]"
              title={isZoomed ? 'Zoom out (100%)' : 'Zoom in (160%)'}
            >
              {isZoomed ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Direct 1-Click Download Button */}
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all duration-200 cursor-pointer border ${
              downloadSuccess
                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border-white/[0.08]'
            } disabled:opacity-40`}
            title="Direct Media Download"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] hidden sm:inline">SAVED</span>
              </>
            ) : (
              <>
                <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} />
                <span className="text-[10px] hidden sm:inline">
                  {isDownloading ? 'DOWNLOADING...' : 'DOWNLOAD'}
                </span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors duration-200 cursor-pointer border border-white/[0.06]"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ===== MAIN CINEMA STAGE & QUEUE ===== */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2.5 sm:p-4 lg:p-5 gap-3.5">
        {/* ===== LEFT MAIN VIEWPORT (~72% DESKTOP) ===== */}
        <div className="w-full lg:w-[72%] flex flex-col bg-[#09090b] rounded-2xl border border-white/[0.06] overflow-hidden flex-shrink-0 h-[48vh] sm:h-[58vh] lg:h-full shadow-2xl relative group/stage">
          {/* Cinema Stage Container with Ambilight */}
          <div
            ref={videoContainerRef}
            onTouchStart={handleStageTouchStart}
            onTouchMove={handleStageTouchMove}
            onTouchEnd={handleStageTouchEnd}
            onClick={resetHudTimer}
            className={`relative flex-1 w-full bg-black flex items-center justify-center overflow-hidden transition-opacity duration-200 ${
              isCrossfading ? 'opacity-30' : 'opacity-100'
            }`}
          >
            {/* Dynamic Ambient Luminance Aura (Ambilight Effect) */}
            {currentItem.type === 'video' && isDirectVideo && (
              <video
                src={streamUrl}
                aria-hidden="true"
                muted
                loop
                playsInline
                autoPlay
                className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-40 scale-105 pointer-events-none z-0"
              />
            )}

            {/* Video Player */}
            {currentItem.type === 'video' ? (
              isDirectVideo ? (
                <div className="relative w-full h-full flex flex-col items-center justify-center z-10">
                  <video
                    ref={videoRef}
                    key={streamUrl}
                    src={streamUrl}
                    poster={activePoster}
                    autoPlay
                    playsInline
                    preload="auto"
                    controls={false}
                    muted={isMuted}
                    onClick={togglePlay}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={() => {
                      if (videoRef.current) setDuration(videoRef.current.duration);
                    }}
                    onPlaying={() => {
                      setHasStarted(true);
                      setIsPlaying(true);
                      setIsBuffering(false);
                    }}
                    onWaiting={() => {
                      setIsBuffering(true);
                    }}
                    onCanPlay={() => {
                      setIsBuffering(false);
                    }}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    className="w-full h-full object-contain cursor-pointer relative z-10"
                  />

                  {/* YouTube-Style Zero-Black-Screen Poster Hand-off */}
                  {activePoster && (
                    <div
                      className={`absolute inset-0 z-20 flex items-center justify-center bg-black transition-opacity duration-300 ease-out pointer-events-none ${
                        hasStarted ? 'opacity-0' : 'opacity-100'
                      }`}
                    >
                      <img
                        src={activePoster}
                        alt={cleanTitle}
                        className="w-full h-full object-contain pointer-events-none select-none"
                      />

                      {/* Sleek Minimal Glowing Buffering Indicator over Poster */}
                      {!hasStarted && isBuffering && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 backdrop-blur-[2px]">
                          <div className="relative w-12 h-12 flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full border-2 border-white/10 border-t-white animate-spin" />
                            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                              <Play className="w-3.5 h-3.5 text-zinc-300 fill-current ml-0.5" />
                            </div>
                          </div>
                          <span className="mt-3 font-mono text-[9px] uppercase tracking-[0.25em] text-zinc-300">
                            BUFFERING STREAM...
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* In-stream buffering spinner if video stalls during playback */}
                  {hasStarted && isBuffering && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-25 bg-black/20">
                      <div className="w-10 h-10 rounded-full border-2 border-white/15 border-t-white animate-spin" />
                    </div>
                  )}

                  {/* Center Play/Pause Animated Ripple */}
                  {centerRipple && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                      <div className="w-16 h-16 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white animate-ripple shadow-2xl">
                        {centerRipple === 'play' ? (
                          <Play className="w-7 h-7 fill-current ml-1" />
                        ) : (
                          <Pause className="w-7 h-7" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Double-tap Seek Indicator (Left / Right) */}
                  {seekRipple && (
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 z-30 pointer-events-none animate-double-tap ${
                        seekRipple.side === 'right' ? 'right-12 sm:right-20' : 'left-12 sm:left-20'
                      }`}
                    >
                      <div className="px-4 py-2.5 rounded-full bg-black/75 border border-white/20 text-zinc-100 text-xs font-mono font-bold tracking-wider flex items-center gap-1.5 shadow-2xl backdrop-blur-xl">
                        {seekRipple.side === 'right' ? (
                          <>
                            <span>{seekRipple.text}</span>
                            <RotateCw className="w-4 h-4 text-emerald-400" />
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-4 h-4 text-emerald-400" />
                            <span>{seekRipple.text}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ================= DETACHED FLOATING GLASS HUD DOCK ================= */}
                  <div
                    onMouseEnter={() => {
                      if (hudTimeoutRef.current) window.clearTimeout(hudTimeoutRef.current);
                      setIsHudVisible(true);
                    }}
                    onMouseLeave={resetHudTimer}
                    className={`absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 w-[94%] sm:w-[88%] max-w-3xl backdrop-blur-2xl bg-black/80 border border-white/10 rounded-2xl px-3.5 sm:px-5 py-2.5 sm:py-3 shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col gap-2 transition-all duration-300 ${
                      isHudVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
                    }`}
                  >
                    {/* Magnetic Scrubber Bar + A-B Loop Visualizer */}
                    <div className="relative w-full group/scrub py-1">
                      {/* Base Track */}
                      <div className="relative w-full h-1 group-hover/scrub:h-2 bg-white/20 rounded-full overflow-hidden transition-all duration-200">
                        {/* Buffered / Played Track */}
                        <div
                          className="h-full bg-zinc-200 transition-all duration-75"
                          style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                        />

                        {/* A-B Active Loop Highlight Band */}
                        {isAbLoopActive && loopStart !== null && (
                          <div
                            className="absolute top-0 bottom-0 bg-emerald-500/50 border-x border-emerald-400 pointer-events-none"
                            style={{
                              left: `${loopStartPct}%`,
                              width: `${Math.max(2, loopEndPct - loopStartPct)}%`,
                            }}
                          />
                        )}
                      </div>

                      {/* Interactive Input Range Overlay */}
                      <input
                        type="range"
                        min="0"
                        max={duration || 100}
                        step="0.1"
                        value={currentTime}
                        onChange={handleSeek}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />

                      {/* Point A Marker Pin */}
                      {isAbLoopActive && loopStart !== null && (
                        <div
                          className="absolute -top-1.5 -translate-x-1/2 w-2 h-4 bg-amber-400 rounded-sm shadow-md pointer-events-none z-10"
                          style={{ left: `${loopStartPct}%` }}
                          title={`Point A: ${formatTime(loopStart)}`}
                        />
                      )}

                      {/* Point B Marker Pin */}
                      {isAbLoopActive && loopEnd !== null && (
                        <div
                          className="absolute -top-1.5 -translate-x-1/2 w-2 h-4 bg-emerald-400 rounded-sm shadow-md pointer-events-none z-10"
                          style={{ left: `${loopEndPct}%` }}
                          title={`Point B: ${formatTime(loopEnd)}`}
                        />
                      )}
                    </div>

                    {/* HUD Controls Row */}
                    <div className="flex items-center justify-between text-xs font-mono text-zinc-300 gap-2">
                      {/* Left: Playback, Quick Seek, Time */}
                      <div className="flex items-center gap-2 sm:gap-3">
                        <button
                          onClick={togglePlay}
                          className="p-1 hover:text-white transition-colors cursor-pointer"
                          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                        >
                          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                        </button>

                        {/* ±10s Quick Skip Buttons */}
                        <button
                          onClick={() => seekRelative(-10)}
                          className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center gap-0.5"
                          title="Rewind 10s (J)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span className="text-[9px] hidden sm:inline">-10s</span>
                        </button>

                        <button
                          onClick={() => seekRelative(10)}
                          className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center gap-0.5"
                          title="Skip 10s (L)"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span className="text-[9px] hidden sm:inline">+10s</span>
                        </button>

                        {/* Mute & Volume */}
                        <div className="flex items-center gap-1.5 group/vol">
                          <button
                            onClick={handleMuteToggle}
                            className="p-1 hover:text-white transition-colors cursor-pointer"
                            title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                          >
                            {isMuted || volume === 0 ? (
                              <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            className="w-12 sm:w-16 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-zinc-200 hidden sm:inline"
                          />
                        </div>

                        {/* Time Counter */}
                        <span className="text-[10px] text-zinc-400 tracking-wider hidden sm:inline">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                      </div>

                      {/* Right: A-B Loop, Speed, PiP, Fullscreen */}
                      <div className="flex items-center gap-2 sm:gap-3">
                        {/* A-B Section Repeat Mode Toggle */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setIsAbLoopActive(!isAbLoopActive);
                              if (!isAbLoopActive) {
                                // Default Point A to current, Point B to current + 5s
                                setLoopStart(currentTime);
                                setLoopEnd(Math.min(duration, currentTime + 5));
                              }
                            }}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono transition-all cursor-pointer border ${
                              isAbLoopActive
                                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                : 'bg-zinc-900/80 border-white/[0.08] text-zinc-400 hover:text-white'
                            }`}
                            title="Toggle A-B Section Repeat Mode"
                          >
                            <Repeat className="w-3 h-3" />
                            <span>A-B</span>
                          </button>

                          {/* Quick A-B set buttons when active */}
                          {isAbLoopActive && (
                            <div className="hidden sm:flex items-center gap-1 text-[9px]">
                              <button
                                onClick={() => setLoopStart(currentTime)}
                                className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 cursor-pointer"
                                title="Set current time as Point A"
                              >
                                Set A
                              </button>
                              <button
                                onClick={() => setLoopEnd(currentTime)}
                                className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
                                title="Set current time as Point B"
                              >
                                Set B
                              </button>
                              <button
                                onClick={() => {
                                  setLoopStart(0);
                                  setLoopEnd(duration);
                                }}
                                className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                                title="Reset A-B boundaries"
                              >
                                Clear
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Playback Speed Menu */}
                        <div className="relative">
                          <button
                            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-900/80 border border-white/[0.08] text-[10px] font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer"
                            title="Playback Speed"
                          >
                            <Gauge className="w-3 h-3 text-zinc-400" />
                            <span>{playbackRate}x</span>
                          </button>

                          {showSpeedMenu && (
                            <div className="absolute bottom-9 right-0 bg-black/95 border border-white/15 rounded-xl p-1 shadow-2xl flex flex-col gap-0.5 z-40">
                              {PLAYBACK_RATES.map((rate) => (
                                <button
                                  key={rate}
                                  onClick={() => handleSpeedSelect(rate)}
                                  className={`px-3 py-1 rounded-lg text-[10px] font-mono text-left transition-colors cursor-pointer ${
                                    playbackRate === rate
                                      ? 'bg-zinc-800 text-white font-bold'
                                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                                  }`}
                                >
                                  {rate}x
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Picture-in-Picture */}
                        <button
                          onClick={togglePiP}
                          className="p-1 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer hidden sm:inline"
                          title="Picture in Picture"
                        >
                          <PictureInPicture2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Fullscreen */}
                        <button
                          onClick={toggleFullscreen}
                          className="p-1 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
                        >
                          {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <iframe
                  src={`${streamUrl}?autoplay=1`}
                  className="w-full h-full border-0 relative z-10"
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                  title={cleanTitle}
                />
              )
            ) : (
              /* Image Lightbox View */
              <div
                onClick={() => setIsZoomed(!isZoomed)}
                className="w-full h-full flex items-center justify-center p-3 cursor-pointer overflow-hidden z-10"
              >
                <img
                  src={directImgUrl}
                  alt={cleanTitle}
                  loading="lazy"
                  className={`max-w-full max-h-full object-contain rounded-xl shadow-2xl transition-transform duration-300 ease-out ${
                    isZoomed ? 'scale-[1.65] cursor-zoom-out' : 'scale-100 cursor-zoom-in'
                  }`}
                />
              </div>
            )}
          </div>

          {/* Under-player Editorial Status Bar */}
          <div className="px-4 py-2.5 border-t border-white/[0.06] bg-[#09090b] flex items-center justify-between text-xs font-mono">
            <div className="truncate max-w-[70%]">
              <span className="font-medium text-zinc-100 text-[11px] tracking-wide block truncate">
                {cleanTitle}
              </span>
              <span className="text-zinc-500 text-[9px] tracking-wider uppercase block mt-0.5">
                {currentItem.type === 'video'
                  ? 'SPATIAL HUD • 1080P CINEMATIC STREAM'
                  : isZoomed
                  ? 'ZOOMED 165% • LOSSLESS PHOTOGRAPHY'
                  : 'HIGH DEFINITION PHOTOGRAPHY'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => goToIndex(currentIndex - 1)}
                className="p-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer border border-white/[0.05]"
                title="Previous (←)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => goToIndex(currentIndex + 1)}
                className="p-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer border border-white/[0.05]"
                title="Next (→)"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ===== RIGHT PLAYLIST QUEUE (~28% DESKTOP) ===== */}
        <div
          ref={playlistContainerRef}
          className="w-full lg:w-[28%] flex-1 lg:h-full flex flex-col bg-[#09090b] rounded-2xl border border-white/[0.06] overflow-hidden shadow-xl"
        >
          {/* Queue Header */}
          <div className="px-4 py-3 border-b border-white/[0.06] bg-[#09090b] flex items-center justify-between text-[10px] font-mono flex-shrink-0">
            <span className="font-semibold text-zinc-300 tracking-wider uppercase">
              QUEUE ({items.length})
            </span>
            <span className="text-zinc-500 flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-400" /> READY
            </span>
          </div>

          {/* Scrollable Playlist Cards */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 no-scrollbar">
            {items.map((item, idx) => {
              const isActive = idx === currentIndex;
              const thumbUrl = getDirectImageUrl(item, idx);
              const itemTitle = (item.title || `Media ${idx + 1}`)
                .replace(/\.[^/.]+$/, '')
                .replace(/[-_]+/g, ' ')
                .trim();

              return (
                <div
                  key={item.id || `queue-${idx}`}
                  onClick={() => goToIndex(idx)}
                  onMouseEnter={() => {
                    if (item.type === 'video') prewarmVideoStream(item.url);
                  }}
                  onTouchStart={() => {
                    if (item.type === 'video') prewarmVideoStream(item.url);
                  }}
                  className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-all duration-200 group ${
                    isActive
                      ? 'bg-zinc-800/80 border border-white/[0.12] shadow-md'
                      : 'hover:bg-zinc-900/80 border border-transparent'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative w-20 sm:w-24 aspect-video rounded-lg overflow-hidden bg-black flex-shrink-0">
                    {item.type === 'video' && item.url.includes('huggingface.co') ? (
                      <video
                        src={formatVideoPosterUrl(encodeURI(ensureHttps(item.url)), 0.5)}
                        preload="metadata"
                        muted
                        playsInline
                        className="w-full h-full object-cover pointer-events-none"
                      />
                    ) : (
                      <img
                        src={thumbUrl}
                        alt={itemTitle}
                        loading="lazy"
                        className="w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                    {isActive ? (
                      <div className="absolute inset-0 bg-white/10 flex items-center justify-center">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-black font-mono font-bold text-[8px] tracking-widest uppercase">
                          PLAYING
                        </span>
                      </div>
                    ) : item.type === 'video' ? (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-3 h-3 text-white fill-current" />
                      </div>
                    ) : null}
                  </div>

                  {/* Meta */}
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-[11px] font-medium truncate block leading-tight ${
                        isActive ? 'text-zinc-100' : 'text-zinc-400 group-hover:text-zinc-200'
                      } transition-colors duration-200`}
                    >
                      {itemTitle}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500 tracking-wider uppercase block mt-0.5">
                      {String(idx + 1).padStart(2, '0')} • {item.type === 'video' ? 'VIDEO' : 'PHOTO'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 py-2 border-t border-white/[0.04] bg-black text-center text-[9px] font-mono tracking-widest text-zinc-600 uppercase flex-shrink-0">
            SWIPE DOWN OR SCROLL TO DISMISS
          </div>
        </div>
      </div>
    </div>
  );
};
