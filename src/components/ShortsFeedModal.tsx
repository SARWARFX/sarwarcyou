/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  VolumeX,
  Volume2,
  Share2,
  Check,
  Play,
  Pause,
  Loader2,
  X,
} from 'lucide-react';
import type { StageMediaItem } from '../types';
import { downloadBrandedVideo } from '../utils/downloadMedia';
import {
  formatVideoPosterUrl,
  prewarmVideoStream,
  getCachedVideoPoster,
} from '../utils/videoPosterGenerator';
import {
  resolveMultiFrameThumbnails,
  resolveMultiFrameThumbnailsExt,
} from '../utils/thumbnailResolver';
import { getCachedThumbnailSync } from '../utils/clientVideoThumbnails';
import { getMediaUrl } from '../utils/imageUrlResolver';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';
import { createShareableMediaUrl, copyToClipboard } from '../utils/urlRouter';

interface ShortsFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  shorts: StageMediaItem[];
  initialIndex: number;
  onIndexChange?: (newIndex: number) => void;
}

export const ShortsFeedModal: React.FC<ShortsFeedModalProps> = ({
  isOpen,
  onClose,
  shorts,
  initialIndex,
  onIndexChange,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [playRipple, setPlayRipple] = useState<'play' | 'pause' | null>(null);

  // Auto-hiding progress bar visibility state (hover on desktop, 2.5s auto-hide timer on tap)
  const [showProgress, setShowProgress] = useState(false);
  const progressTimerRef = useRef<number | null>(null);

  const triggerProgressVisible = useCallback(() => {
    setShowProgress(true);
    if (progressTimerRef.current) {
      window.clearTimeout(progressTimerRef.current);
    }
    progressTimerRef.current = window.setTimeout(() => {
      setShowProgress(false);
    }, 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        window.clearTimeout(progressTimerRef.current);
      }
    };
  }, []);

  // Dynamic aspect ratio for landscape clips
  const [isLandscape, setIsLandscape] = useState(false);

  // Clickable & draggable progress bar state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const isDraggingProgressRef = useRef(false);

  // Velocity Swipe-to-Dismiss State
  const [dismissOffsetY, setDismissOffsetY] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = useRef<{ time: number } | null>(null);

  const isNavigatingRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const previousIndexRef = useRef(currentIndex);

  const [prevProps, setPrevProps] = useState({ initialIndex, isOpen });
  if (prevProps.initialIndex !== initialIndex || prevProps.isOpen !== isOpen) {
    setPrevProps({ initialIndex, isOpen });
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setCurrentIndex(initialIndex);
    setDismissOffsetY(0);
    setIsPlaying(true);
    setIsLandscape(false);
    setCurrentTime(0);
    setDuration(0);
  }

  // Synchronize active media index with parent / URL router
  useEffect(() => {
    if (isOpen) {
      onIndexChange?.(currentIndex);
    }
  }, [currentIndex, isOpen, onIndexChange]);

  const handleNext = useCallback(() => {
    if (currentIndex < shorts.length - 1) {
      // Pause current video immediately so it stops decoding frames in the background
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setCurrentIndex((prev) => prev + 1);
      setIsPlaying(true);
      setDismissOffsetY(0);
      setIsLandscape(false);
      setCurrentTime(0);
    }
  }, [currentIndex, shorts.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      // Pause current video immediately so it stops decoding frames in the background
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setCurrentIndex((prev) => prev - 1);
      setIsPlaying(true);
      setDismissOffsetY(0);
      setIsLandscape(false);
      setCurrentTime(0);
    }
  }, [currentIndex]);

  // Aggressive instant playback trigger and one-ahead pre-warming
  useEffect(() => {
    if (!isOpen) {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      return;
    }

    // When active short changes, pause previous playback if still running
    if (previousIndexRef.current !== currentIndex) {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
      previousIndexRef.current = currentIndex;
    }

    const video = videoRef.current;
    if (video) {
      // Call activeVideoRef.current.play().catch(...) immediately
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // If browser autoplay policy blocks unmuted audio on mobile, mute and retry immediately
          if (!video.muted) {
            video.muted = true;
            setIsMuted(true);
            video.play().catch(() => {});
          }
        });
      }
    }

    // Pre-warm next reel ONLY for instant swipe (previous reel is NOT pre-warmed to conserve mobile RAM)
    if (shorts[currentIndex + 1]?.url) {
      prewarmVideoStream(shorts[currentIndex + 1].url);
    }
  }, [currentIndex, isOpen, shorts]);

  // Strict background scroll-lock
  useLockBodyScroll(isOpen);

  // Instantly release mobile GPU RAM and video decoders
  const releaseVideoResources = useCallback(() => {
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.src = '';
        videoRef.current.load();
      } catch {
        // ignore
      }
    }
  }, []);

  const handleClose = useCallback(() => {
    releaseVideoResources();
    onClose();
  }, [onClose, releaseVideoResources]);

  useEffect(() => {
    if (!isOpen) {
      releaseVideoResources();
    }
  }, [isOpen, releaseVideoResources]);

  useEffect(() => {
    return () => {
      releaseVideoResources();
    };
  }, [releaseVideoResources]);

  // Keyboard navigation & Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'm' || e.key === 'M') {
        setIsMuted((m) => {
          if (videoRef.current) videoRef.current.muted = !m;
          return !m;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, handleNext, handlePrev]);

  // Touch Swipe & Gesture Engine
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = {
      x: t.clientX,
      y: t.clientY,
      time: performance.now(),
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    // If pulling down when near start, track dismiss offset
    if (dy > 0 && Math.abs(e.touches[0].clientX - touchStartRef.current.x) < 50) {
      setDismissOffsetY(dy * 0.7);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const dy = touchStartRef.current.y - t.clientY;
    const pullDown = t.clientY - touchStartRef.current.y;
    const dt = performance.now() - touchStartRef.current.time;

    // Swipe down to dismiss
    if ((pullDown > 110 && dt < 400) || pullDown > 180) {
      handleClose();
      return;
    }
    setDismissOffsetY(0);

    // Vertical swipe between reels (Swipe Up = Next, Swipe Down = Prev)
    if (Math.abs(dy) > 45) {
      if (dy > 0) {
        handleNext();
      } else {
        handlePrev();
      }
      touchStartRef.current = null;
      return;
    }

    // Double tap to pause/play
    const now = performance.now();
    if (lastTapRef.current && now - lastTapRef.current.time < 300) {
      togglePlay();
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { time: now };
    }
    touchStartRef.current = null;
    triggerProgressVisible();
  };

  const handleWheel = (e: React.WheelEvent) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) > 25) {
      if (isNavigatingRef.current) return;
      isNavigatingRef.current = true;
      if (delta > 0) {
        handleNext();
      } else {
        handlePrev();
      }
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 550);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      setPlayRipple('play');
      setTimeout(() => setPlayRipple(null), 500);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      setPlayRipple('pause');
      setTimeout(() => setPlayRipple(null), 500);
    }
  };

  const handleDownload = useCallback(async () => {
    const item = shorts[currentIndex];
    if (!item || isDownloading) return;
    setIsDownloading(true);
    setDownloadSuccess(false);
    try {
      const dlUrl = getMediaUrl(item.url);
      await downloadBrandedVideo(dlUrl, item.title || item.id, 'short');
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setIsDownloading(false);
    }
  }, [currentIndex, shorts, isDownloading]);

  const handleShare = useCallback(async () => {
    const item = shorts[currentIndex];
    if (!item) return;
    const shareUrl = createShareableMediaUrl(item, 'shorts');
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }, [currentIndex, shorts]);

  // Click & Drag-seeking on progress bar
  const seekToPosition = useCallback((clientX: number) => {
    if (!progressBarRef.current || !videoRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = pos * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  const handleProgressPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    triggerProgressVisible();
    isDraggingProgressRef.current = true;
    if (e.currentTarget.setPointerCapture) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    seekToPosition(e.clientX);
  }, [seekToPosition, triggerProgressVisible]);

  const handleProgressPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingProgressRef.current) return;
    e.stopPropagation();
    triggerProgressVisible();
    seekToPosition(e.clientX);
  }, [seekToPosition, triggerProgressVisible]);

  const handleProgressPointerUp = useCallback((e: React.PointerEvent) => {
    if (isDraggingProgressRef.current) {
      e.stopPropagation();
      triggerProgressVisible();
      if (e.currentTarget.releasePointerCapture) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
      isDraggingProgressRef.current = false;
    }
  }, [triggerProgressVisible]);

  const currentShort = shorts[currentIndex] || shorts[0];
  const rawUrl = (currentShort?.url || '').replace(/^http:\/\//i, 'https://');
  let streamUrl = rawUrl;
  if (streamUrl.includes('drive.google.com') && !streamUrl.includes('/preview')) {
    streamUrl = streamUrl.replace(/\/view(\?.*)?$/, '/preview');
  } else if (!streamUrl.includes('drive.google.com')) {
    streamUrl = getMediaUrl(streamUrl);
  }

  const shortPoster = useMemo(() => {
    if (!currentShort) return '';
    const multiThumbs = resolveMultiFrameThumbnails(currentShort);
    const multiThumbsExt = resolveMultiFrameThumbnailsExt(currentShort);
    const raw = (
      currentShort.thumbnails?.[0] ||
      multiThumbs[0] ||
      multiThumbsExt[0] ||
      getCachedThumbnailSync(currentShort.url) ||
      getCachedVideoPoster(currentShort.url) ||
      currentShort.thumbnail ||
      formatVideoPosterUrl(streamUrl, 0.5) ||
      ''
    );
    return raw ? getMediaUrl(raw) : '';
  }, [currentShort, streamUrl]);

  const prevShort = currentIndex > 0 ? shorts[currentIndex - 1] : null;
  const nextShort = currentIndex < shorts.length - 1 ? shorts[currentIndex + 1] : null;



  const prevPoster = useMemo(() => {
    if (!prevShort) return '';
    const multiThumbs = resolveMultiFrameThumbnails(prevShort);
    const multiThumbsExt = resolveMultiFrameThumbnailsExt(prevShort);
    const raw = (
      prevShort.thumbnails?.[0] ||
      multiThumbs[0] ||
      multiThumbsExt[0] ||
      getCachedThumbnailSync(prevShort.url) ||
      getCachedVideoPoster(prevShort.url) ||
      prevShort.thumbnail ||
      ''
    );
    return raw ? getMediaUrl(raw) : '';
  }, [prevShort]);

  const nextPoster = useMemo(() => {
    if (!nextShort) return '';
    const multiThumbs = resolveMultiFrameThumbnails(nextShort);
    const multiThumbsExt = resolveMultiFrameThumbnailsExt(nextShort);
    const raw = (
      nextShort.thumbnails?.[0] ||
      multiThumbs[0] ||
      multiThumbsExt[0] ||
      getCachedThumbnailSync(nextShort.url) ||
      getCachedVideoPoster(nextShort.url) ||
      nextShort.thumbnail ||
      ''
    );
    return raw ? getMediaUrl(raw) : '';
  }, [nextShort]);

  if (!isOpen || !shorts.length) return null;

  const displayTitle = sanitizeMediaTitle(
    currentShort?.title,
    currentShort?.category || 'Vertical Short Reel'
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shorts and Reels Player"
      className="fixed inset-0 w-full max-w-full h-[100dvh] overflow-hidden z-[9999] flex items-center justify-center bg-black/97 backdrop-blur-2xl select-none touch-none touch-action-none overscroll-contain"
      onClick={handleClose}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: dismissOffsetY > 0 ? `translate3d(0, ${dismissOffsetY}px, 0) scale(${Math.max(0.85, 1 - dismissOffsetY / 1000)})` : 'none',
        transition: dismissOffsetY === 0 ? 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
      }}
    >
      {/* Prominent High-Contrast Close Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (videoRef.current) {
            videoRef.current.pause();
          }
          setIsPlaying(false);
          handleClose();
        }}
        aria-label="Close shorts reel (Esc)"
        title="Close (Esc)"
        className="fixed top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-[160] p-2.5 sm:p-3 rounded-full bg-black/75 hover:bg-black/95 text-white/90 hover:text-white border border-white/20 hover:border-white/40 shadow-[0_4px_24px_rgba(0,0,0,0.85)] backdrop-blur-2xl transition-all duration-200 cursor-pointer hover:scale-110 active:scale-95"
      >
        <X className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      {/* Main Reel Player Container (Adapts to 9:16 portrait or 16:9 landscape) */}
      <div className="relative flex items-center justify-center max-h-[92vh] max-w-[98vw] px-2 sm:px-4 md:px-6 gap-3 sm:gap-4 md:gap-6 overflow-hidden">
        {/* Previous Short (Desktop Flank) */}
        {!isLandscape && prevShort && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="hidden md:flex flex-col items-center justify-center aspect-[9/16] h-[78vh] max-h-[720px] max-w-[400px] rounded-3xl overflow-hidden bg-zinc-950 border border-white/10 shadow-2xl transition-all duration-300 select-none opacity-35 hover:opacity-60 cursor-pointer scale-95 hover:scale-100 flex-shrink-0"
            title="Previous Short (Left)"
          >
            <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
              {prevPoster ? (
                <img
                  src={prevPoster}
                  alt={prevShort.title || 'Previous Short'}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover pointer-events-none"
                />
              ) : (
                <div className="text-zinc-600 text-xs font-mono uppercase tracking-wider">Previous</div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="p-3 rounded-full bg-black/60 border border-white/10 text-white/80">
                  <ChevronLeft className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Center: Active Reel Container + Aside Actions */}
        <div className="relative flex items-center justify-center flex-shrink-0">
          <div
            className={`group/reel relative rounded-3xl overflow-hidden bg-black shadow-[0_25px_60px_rgba(0,0,0,0.95)] flex flex-col justify-between transition-all duration-300 ${
              isLandscape
                ? 'aspect-video w-[90vw] max-w-[854px] h-auto max-h-[75vh]'
                : 'aspect-[9/16] h-[88vh] max-h-[820px] max-w-[460px]'
            }`}
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
            triggerProgressVisible();
          }}
          onMouseMove={triggerProgressVisible}
        >
          {/* Native Video Element */}
          <div className="absolute inset-0 w-full h-full bg-black z-0">
            {/* Obsidian Typography Surface Backing behind video */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black select-none pointer-events-none z-0">
              {shortPoster ? (
                <img
                  src={shortPoster}
                  alt={displayTitle}
                  loading="lazy"
                  decoding="async"
                  className={`w-full h-full ${isLandscape ? 'object-contain' : 'object-cover'}`}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                    <Play className="w-5 h-5 text-zinc-300 fill-current ml-0.5" />
                  </div>
                  <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wide truncate max-w-xs">
                    {displayTitle}
                  </h3>
                  <span className="text-[10px] font-mono uppercase tracking-widest mt-1 brand-gradient-text">
                    SARWARCYOU REELS
                  </span>
                </div>
              )}
            </div>

            {/* Ambient CSS backdrop for landscape clips */}
            {isLandscape && (
              <div
                aria-hidden="true"
                className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_rgba(232,121,249,0.15)_0%,_rgba(0,0,0,0.95)_75%)] pointer-events-none z-0"
              />
            )}

            {streamUrl.includes('media.sarwar.cyou') || streamUrl.includes('huggingface.co') || streamUrl.endsWith('.mp4') || streamUrl.includes('.mp4?') ? (
              <video
                ref={videoRef}
                key="shorts-active-video"
                src={streamUrl}
                poster={shortPoster || undefined}
                autoPlay
                preload="auto"
                playsInline
                {...{ 'webkit-playsinline': 'true' }}
                disablePictureInPicture
                crossOrigin="anonymous"
                loop
                muted={isMuted}
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  if (v.videoWidth && v.videoHeight) {
                    setIsLandscape(v.videoWidth > v.videoHeight);
                  }
                  if (v.duration) {
                    setDuration(v.duration);
                  }
                }}
                onCanPlay={(e) => {
                  if (isPlaying) {
                    e.currentTarget.play().catch(() => {});
                  }
                }}
                onTimeUpdate={() => {
                  if (videoRef.current && !isDraggingProgressRef.current) {
                    setCurrentTime(videoRef.current.currentTime);
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className={`w-full h-full relative z-10 transition-all duration-300 ${
                  isLandscape ? 'object-contain' : 'object-cover'
                }`}
              />
            ) : (
              <iframe
                key={currentShort.id}
                src={streamUrl}
                className="w-full h-full border-0 relative z-10"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                title={displayTitle}
              />
            )}


          </div>

          {/* Paused overlay indicator */}
          {!isPlaying && !playRipple && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <div className="w-14 h-14 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white shadow-2xl backdrop-blur-sm">
                <Play className="w-6 h-6 fill-current ml-0.5" />
              </div>
            </div>
          )}

          {/* Center Play/Pause Ripple Indicator */}
          {playRipple && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
              <div className="w-16 h-16 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white animate-ripple shadow-2xl">
                {playRipple === 'play' ? (
                  <Play className="w-7 h-7 fill-current ml-1" />
                ) : (
                  <Pause className="w-7 h-7" />
                )}
              </div>
            </div>
          )}

          {/* Sleek Auto-Hiding Progress / Scrubber Bar (Hover on Desktop, 2.5s Auto-Hide on Tap) */}
          <div
            ref={progressBarRef}
            onPointerDown={handleProgressPointerDown}
            onPointerMove={handleProgressPointerMove}
            onPointerUp={handleProgressPointerUp}
            onPointerCancel={handleProgressPointerUp}
            onClick={(e) => {
              e.stopPropagation();
              triggerProgressVisible();
            }}
            className={`absolute bottom-0 left-0 right-0 z-30 w-full pb-0 pt-3 px-0 cursor-pointer select-none transition-opacity duration-300 ease-out ${
              showProgress
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none group-hover/reel:opacity-100 group-hover/reel:pointer-events-auto'
            }`}
            title="Seek Reel Position"
            role="slider"
            aria-label="Reel Progress"
            aria-valuemin={0}
            aria-valuemax={duration || 100}
            aria-valuenow={currentTime}
          >
            <div className="relative w-full h-[3.5px] bg-white/20 overflow-hidden">
              <div
                className="h-full bg-[#38bdf8] shadow-[0_0_8px_#38bdf8] transition-all duration-75 relative"
                style={{
                  width: `${duration > 0 ? (currentTime / duration) * 100 : ((currentIndex + 1) / shorts.length) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* ================= FLOATING GLASS ACTION COLUMN ================= */}
        <aside
          className="absolute right-3 bottom-10 sm:static sm:right-auto sm:bottom-auto flex flex-col gap-2.5 sm:gap-3 ml-0 sm:ml-4 md:ml-5 z-[130]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sound Toggle Button */}
          <button
            onClick={() => {
              setIsMuted((m) => {
                const next = !m;
                if (videoRef.current) videoRef.current.muted = next;
                return next;
              });
            }}
            className={`p-2.5 sm:p-3 rounded-2xl backdrop-blur-xl transition-all cursor-pointer shadow-xl ${
              isMuted
                ? 'bg-black/50 text-zinc-400 hover:text-white border border-white/10'
                : 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/30'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>

          {/* Direct Download Button */}
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={`p-2.5 sm:p-3 rounded-2xl backdrop-blur-xl transition-all cursor-pointer shadow-xl disabled:opacity-40 ${
              downloadSuccess
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                : 'bg-black/50 text-zinc-400 hover:text-white border border-white/10'
            }`}
            title={isDownloading ? 'Downloading Reel (Branded)...' : 'Download Reel'}
          >
            {downloadSuccess ? (
              <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            ) : isDownloading ? (
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-cyan-400" />
            ) : (
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>

          {/* Share Link Button */}
          <button
            onClick={handleShare}
            className={`p-2.5 sm:p-3 rounded-2xl backdrop-blur-xl transition-all cursor-pointer shadow-xl ${
              copiedLink
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                : 'bg-black/50 text-zinc-400 hover:text-white border border-white/10'
            }`}
            title="Share Reel Link"
          >
            {copiedLink ? <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" /> : <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </aside>
      </div>

      {/* Next Short (Desktop Flank) */}
      {!isLandscape && nextShort && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          className="hidden md:flex flex-col items-center justify-center aspect-[9/16] h-[78vh] max-h-[720px] max-w-[400px] rounded-3xl overflow-hidden bg-zinc-950 border border-white/10 shadow-2xl transition-all duration-300 select-none opacity-35 hover:opacity-60 cursor-pointer scale-95 hover:scale-100 flex-shrink-0"
          title="Next Short (Right)"
        >
          <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
            {nextPoster ? (
              <img
                src={nextPoster}
                alt={nextShort.title || 'Next Short'}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover pointer-events-none"
              />
            ) : (
              <div className="text-zinc-600 text-xs font-mono uppercase tracking-wider">Next</div>
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="p-3 rounded-full bg-black/60 border border-white/10 text-white/80">
                <ChevronRight className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};
