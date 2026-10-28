/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  VolumeX,
  Volume2,
  Share2,
  Check,
  Download,
  Loader2,
  Play,
  Pause,
  Folder,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { StageMediaItem } from '../types';
import { downloadBrandedVideo } from '../utils/downloadMedia';
import { getCachedVideoPoster, prewarmVideoStream } from '../utils/videoPosterGenerator';
import { isVideoExtension } from '../utils/mediaTypeDetector';
import { getCachedThumbnailSync } from '../utils/clientVideoThumbnails';
import { getMediaUrl } from '../utils/imageUrlResolver';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';
import { createShareableMediaUrl, copyToClipboard } from '../utils/urlRouter';

export interface ShortsFeedModalProps {
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
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [centerPulse, setCenterPulse] = useState<'play' | 'pause' | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Mobile Immersive Mode: Controls auto-hide during playback and reveal on user access
  const [showControls, setShowControls] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const activeVideoRef = useRef<HTMLVideoElement>(null);
  const pulseTimerRef = useRef<number | null>(null);
  const controlsTimerRef = useRef<number | null>(null);

  // Strict background scroll-lock
  useLockBodyScroll(isOpen);

  // Auto-hide controls timer manager for mobile immersive viewing
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
    controlsTimerRef.current = window.setTimeout(() => {
      setShowControls(false);
    }, 3200);
  }, []);

  // Sync initialIndex changes from parent / deep-link
  const [prevProps, setPrevProps] = useState({ initialIndex, isOpen });
  if (prevProps.initialIndex !== initialIndex || prevProps.isOpen !== isOpen) {
    setPrevProps({ initialIndex, isOpen });
    setActiveIndex(initialIndex);
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(0);
    resetControlsTimer();
  }

  // Auto-hide controls when playing, keep visible when paused
  useEffect(() => {
    if (!isPlaying) {
      if (controlsTimerRef.current) {
        window.clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = null;
      }
      setShowControls(true);
    } else {
      resetControlsTimer();
    }
  }, [isPlaying, resetControlsTimer]);

  // Scroll to active index on open or initialIndex change
  useEffect(() => {
    if (isOpen && containerRef.current && initialIndex >= 0) {
      const target = slideRefs.current[initialIndex];
      if (target) {
        requestAnimationFrame(() => {
          target.scrollIntoView({ behavior: 'instant', block: 'start' });
        });
      }
    }
  }, [isOpen, initialIndex]);

  // Synchronize active media index with parent / URL router
  useEffect(() => {
    if (isOpen) {
      onIndexChange?.(activeIndex);
    }
  }, [activeIndex, isOpen, onIndexChange]);

  // Clean release of video resources
  const releaseVideoResources = useCallback(() => {
    videoRefs.current.forEach((v) => {
      if (v) {
        try {
          v.pause();
          v.muted = true;
          v.removeAttribute('src');
          v.load();
        } catch {
          // ignore
        }
      }
    });
    if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
    if (pulseTimerRef.current) window.clearTimeout(pulseTimerRef.current);
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

  // =========================================================================
  // ZERO AUDIO OVERLAP ENGINE:
  // Instantaneous scroll listener that silences & pauses the previous short
  // the exact instant user swipes past the 50% midpoint.
  // =========================================================================
  useEffect(() => {
    if (!isOpen) return;
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const h = container.clientHeight;
      if (h <= 0) return;
      const scrollTop = container.scrollTop;
      const targetIndex = Math.round(scrollTop / h);

      if (targetIndex !== activeIndex && targetIndex >= 0 && targetIndex < shorts.length) {
        // Synchronously silence & pause all non-target videos immediately
        videoRefs.current.forEach((v, i) => {
          if (v && i !== targetIndex) {
            v.pause();
            v.muted = true;
          }
        });

        const targetVideo = videoRefs.current[targetIndex];
        if (targetVideo) {
          activeVideoRef.current = targetVideo;
          setCurrentTime(targetVideo.currentTime);
          setDuration(
            targetVideo.duration && isFinite(targetVideo.duration) ? targetVideo.duration : 0
          );
        } else {
          setCurrentTime(0);
          setDuration(0);
        }

        setActiveIndex(targetIndex);
        setIsPlaying(true);
        resetControlsTimer();

        // Prewarm next reel stream
        if (shorts[targetIndex + 1]?.url) {
          prewarmVideoStream(shorts[targetIndex + 1].url);
        }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isOpen, activeIndex, shorts, resetControlsTimer]);

  // Autoplay currently snapped reel and guarantee all other videos are muted & paused
  useEffect(() => {
    if (!isOpen) return;

    videoRefs.current.forEach((video, idx) => {
      if (video) {
        if (idx !== activeIndex) {
          video.pause();
          video.muted = true;
        } else {
          activeVideoRef.current = video;
          video.muted = isMuted;
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => setIsPlaying(true))
              .catch(() => {
                // Fallback to muted playback if blocked by browser policy
                video.muted = true;
                setIsMuted(true);
                video.play().then(() => setIsPlaying(true)).catch(console.error);
              });
          }
        }
      }
    });
  }, [activeIndex, isOpen, isMuted]);

  // Single-tap play/pause toggle with center pulse icon
  const togglePlay = useCallback(() => {
    const video = videoRefs.current[activeIndex] || activeVideoRef.current;
    if (!video) return;

    if (pulseTimerRef.current) window.clearTimeout(pulseTimerRef.current);

    if (video.paused) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => {
            // Fallback to muted playback if blocked by browser policy
            video.muted = true;
            setIsMuted(true);
            video.play().then(() => setIsPlaying(true)).catch(console.error);
          });
      }
      setCenterPulse('play');
    } else {
      video.pause();
      setIsPlaying(false);
      setCenterPulse('pause');
    }

    pulseTimerRef.current = window.setTimeout(() => {
      setCenterPulse(null);
    }, 550);
  }, [activeIndex]);

  // Screen click/tap handler:
  // On mobile (< 768px): if controls are hidden, first tap reveals controls for access without pausing!
  // If controls are already visible or on desktop, tap toggles play/pause.
  const handleVideoClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('[role="button"]') || target.closest('aside')) {
        resetControlsTimer();
        return;
      }

      if (typeof window !== 'undefined' && window.innerWidth < 768 && !showControls) {
        resetControlsTimer();
        return;
      }

      togglePlay();
      resetControlsTimer();
    },
    [showControls, togglePlay, resetControlsTimer]
  );

  // Sound / Mute Toggle
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      const video = videoRefs.current[activeIndex] || activeVideoRef.current;
      if (video) {
        video.muted = next;
      }
      return next;
    });
    resetControlsTimer();
  }, [activeIndex, resetControlsTimer]);

  // Sequential Navigation: Scroll Up / Down
  const handleScrollNext = useCallback(() => {
    if (activeIndex < shorts.length - 1) {
      const nextEl = slideRefs.current[activeIndex + 1];
      if (nextEl) {
        nextEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [activeIndex, shorts.length]);

  const handleScrollPrev = useCallback(() => {
    if (activeIndex > 0) {
      const prevEl = slideRefs.current[activeIndex - 1];
      if (prevEl) {
        prevEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [activeIndex]);

  // Keyboard Navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        handleScrollNext();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        handleScrollPrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose, handleScrollNext, handleScrollPrev, togglePlay, toggleMute]);

  // Share Deep Link (Copies URL)
  const handleShare = useCallback(
    async (item: StageMediaItem) => {
      if (!item) return;
      resetControlsTimer();
      const shareUrl = createShareableMediaUrl(item, 'shorts');
      const success = await copyToClipboard(shareUrl);
      if (success) {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    },
    [resetControlsTimer]
  );

  // Branded Video Download
  const handleDownload = useCallback(
    async (item: StageMediaItem) => {
      if (!item || isDownloading) return;
      resetControlsTimer();
      setIsDownloading(true);
      setDownloadSuccess(false);
      try {
        const dlUrl = getMediaUrl(item.url);
        await downloadBrandedVideo(dlUrl, item.title || item.id, 'short');
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 2200);
      } catch (err) {
        console.error('Download error:', err);
      } finally {
        setIsDownloading(false);
      }
    },
    [isDownloading, resetControlsTimer]
  );

  // Seek bar tap handler
  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      resetControlsTimer();
      const video = videoRefs.current[activeIndex] || activeVideoRef.current;
      if (!video || !duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const newTime = pct * duration;
      video.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [activeIndex, duration, resetControlsTimer]
  );

  if (!isOpen || !shorts.length) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shorts Player"
      className="fixed inset-0 z-[9999] w-full h-[100dvh] bg-black text-white select-none overflow-hidden touch-none"
    >
      {/* 1. Header Bar: Close button & Quick Status (Auto-hides on mobile during viewing) */}
      <div
        className={`fixed top-0 inset-x-0 z-[160] flex items-center justify-between p-3 sm:p-5 pt-[max(0.75rem,env(safe-area-inset-top))] transition-all duration-300 pointer-events-none ${
          showControls || !isPlaying
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2 md:opacity-100 md:translate-y-0'
        }`}
      >
        {/* Left: Shorts Brand Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/15 pointer-events-auto shadow-lg">
          <div className="w-2.5 h-2.5 rounded-full bg-[#00E5FF] animate-pulse" />
          <span className="text-xs font-bold font-sans uppercase tracking-wider text-white">Shorts</span>
          <span className="text-[10px] font-mono text-zinc-400">
            {activeIndex + 1}/{shorts.length}
          </span>
        </div>
      </div>

      {/* 2. Full-Screen Vertical Swipe Feed (100dvh with Native CSS Scroll Snapping) */}
      <div
        ref={containerRef}
        className="w-full h-[100dvh] overflow-y-scroll overflow-x-hidden snap-y snap-mandatory scroll-smooth no-scrollbar"
        style={{
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {shorts.map((item, idx) => {
          const isSnapped = idx === activeIndex;
          const isAdjacent = Math.abs(idx - activeIndex) <= 1;
          const streamUrl = getMediaUrl(item.url || item.path || item.id);
          const rawPoster = (
            item.thumbnails?.[0] ||
            getCachedThumbnailSync(item.url) ||
            getCachedVideoPoster(item.url) ||
            item.thumbnail ||
            ''
          );
          const shortPoster = rawPoster && !isVideoExtension(rawPoster) ? getMediaUrl(rawPoster) : '';
          const displayTitle = sanitizeMediaTitle(item.title, item.category || 'Short');
          const albumName = item.category || item.parentAlbum || 'Shorts';
          const fileName = (item.name || item.path?.split('/').pop() || '').trim();

          return (
            <div
              key={item.id || idx}
              ref={(el) => {
                slideRefs.current[idx] = el;
              }}
              data-reel-index={idx}
              className="w-full h-[100dvh] max-h-[100dvh] flex items-center justify-center relative snap-start snap-always overflow-hidden bg-black flex-shrink-0 p-0 md:px-6 lg:px-8"
            >
              <div className="relative flex items-center justify-center md:gap-8 w-full h-full md:max-h-[96vh] md:w-auto md:max-w-[1400px] my-auto">
                {/* ================= 1. DESKTOP LEFT COLUMN (Outside Clip): Album, Title & Details ================= */}
                <div className="hidden md:flex flex-col justify-end w-56 lg:w-72 xl:w-80 pb-6 z-20 pointer-events-auto flex-shrink-0">
                  <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col gap-2.5">
                    {/* Album Name Badge */}
                    <div className="flex items-center gap-1.5 text-xs font-mono text-[#00E5FF]">
                      <Folder className="w-3.5 h-3.5 text-[#00E5FF] flex-shrink-0" />
                      <span className="font-semibold uppercase tracking-wider truncate">{albumName}</span>
                    </div>

                    {/* Clean Video Title */}
                    <h2 className="text-base sm:text-lg lg:text-xl font-bold text-white tracking-tight leading-snug select-text">
                      {displayTitle}
                    </h2>

                    {/* Exact File Name */}
                    {fileName && fileName.toLowerCase() !== displayTitle.toLowerCase() && (
                      <span className="text-xs font-mono text-zinc-400 truncate block select-text">
                        {fileName}
                      </span>
                    )}

                    {/* Reel Index counter & Commit Date */}
                    <div className="flex items-center gap-2 pt-2 border-t border-white/[0.08] text-xs font-mono text-zinc-400">
                      <span className="text-[#00E5FF] font-bold">Reel {idx + 1} of {shorts.length}</span>
                      {item.date && (
                        <>
                          <span className="text-zinc-600">•</span>
                          <span>{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* ================= 2. VIDEO STAGE (Full Screen on Mobile, Aspect 9:16 on Desktop) ================= */}
                <div className="relative flex flex-col items-center flex-shrink-0 w-full h-full md:w-auto md:h-auto">
                  <div
                    className="relative w-full h-full md:aspect-[9/16] md:h-[86vh] md:max-h-[840px] md:w-auto md:rounded-3xl overflow-hidden bg-black flex items-center justify-center md:shadow-[0_20px_60px_rgba(0,0,0,0.95)] md:border md:border-white/10 group cursor-pointer"
                    onClick={isSnapped ? handleVideoClick : undefined}
                  >
                    {/* Visual Poster / Backing Image */}
                    {shortPoster && (
                      <img
                        src={shortPoster}
                        alt={displayTitle}
                        loading={isAdjacent ? 'eager' : 'lazy'}
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none z-0"
                      />
                    )}

                    {/* Strict Virtualized Video: NEVER allow unmuted audio if !isSnapped */}
                    {isAdjacent ? (
                      <video
                        ref={(el) => {
                          videoRefs.current[idx] = el;
                          if (idx === activeIndex) {
                            activeVideoRef.current = el;
                          }
                        }}
                        src={streamUrl}
                        poster={shortPoster || undefined}
                        autoPlay={isSnapped}
                        preload={isSnapped ? 'auto' : 'metadata'}
                        playsInline
                        {...({ 'webkit-playsinline': 'true' } as any)}
                        loop
                        muted={!isSnapped ? true : isMuted}
                        crossOrigin="anonymous"
                        onPlay={() => {
                          if (idx !== activeIndex) {
                            if (videoRefs.current[idx]) {
                              videoRefs.current[idx]!.pause();
                              videoRefs.current[idx]!.muted = true;
                            }
                          } else {
                            setIsPlaying(true);
                          }
                        }}
                        onPlaying={(e) => {
                          if (idx === activeIndex) {
                            setIsPlaying(true);
                            const v = e.currentTarget;
                            setCurrentTime(v.currentTime);
                            if (v.duration && !isNaN(v.duration) && isFinite(v.duration) && v.duration > 0) {
                              setDuration(v.duration);
                            }
                          }
                        }}
                        onPause={() => {
                          if (idx === activeIndex) {
                            setIsPlaying(false);
                          }
                        }}
                        onWaiting={() => {
                          // Buffer state: video waits for packets, slider naturally freezes as timeupdate stops firing
                        }}
                        onTimeUpdate={(e) => {
                          if (idx === activeIndex) {
                            const v = e.currentTarget;
                            setCurrentTime(v.currentTime);
                            if (v.duration && !isNaN(v.duration) && isFinite(v.duration) && v.duration > 0) {
                              setDuration(v.duration);
                            }
                          }
                        }}
                        onLoadedMetadata={(e) => {
                          if (idx === activeIndex) {
                            const v = e.currentTarget;
                            if (v.duration && !isNaN(v.duration) && isFinite(v.duration) && v.duration > 0) {
                              setDuration(v.duration);
                            }
                            setCurrentTime(v.currentTime);
                          }
                        }}
                        onDurationChange={(e) => {
                          if (idx === activeIndex) {
                            const v = e.currentTarget;
                            if (v.duration && !isNaN(v.duration) && isFinite(v.duration) && v.duration > 0) {
                              setDuration(v.duration);
                            }
                          }
                        }}
                        className="w-full h-full object-cover select-none cursor-pointer"
                      />
                    ) : (
                      <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-zinc-900 to-black flex items-center justify-center z-10 pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                          <Play className="w-5 h-5 text-white/50 fill-current ml-0.5" />
                        </div>
                      </div>
                    )}

                    {/* Single-tap Play/Pause Center Pulse Icon (animated 550ms on tap) */}
                    {isSnapped && centerPulse && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/65 backdrop-blur-md border border-white/25 flex items-center justify-center text-white shadow-2xl animate-ping duration-300">
                          {centerPulse === 'play' ? (
                            <Play className="w-8 h-8 sm:w-9 sm:h-9 fill-current ml-1 text-white" />
                          ) : (
                            <Pause className="w-8 h-8 sm:w-9 sm:h-9 fill-current text-white" />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Paused Static Center Overlay */}
                    {isSnapped && !isPlaying && !centerPulse && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                        <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl">
                          <Play className="w-7 h-7 fill-current ml-1" />
                        </div>
                      </div>
                    )}

                    {/* ================= MOBILE FLOATING BUTTONS OVERLAY (Directly ON Video) ================= */}
                    <div
                      className={`md:hidden absolute right-3 bottom-24 z-30 flex flex-col items-center gap-3.5 transition-all duration-300 pointer-events-auto ${
                        showControls || !isPlaying
                          ? 'opacity-100 translate-x-0'
                          : 'opacity-0 translate-x-3 pointer-events-none'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Sound / Mute Toggle Button */}
                      <button
                        type="button"
                        onClick={toggleMute}
                        className="flex flex-col items-center gap-1 cursor-pointer active:scale-90 transition-transform"
                        title={isMuted ? 'Unmute Reel (M)' : 'Mute Reel (M)'}
                        aria-label={isMuted ? 'Unmute Reel' : 'Mute Reel'}
                      >
                        <div className="w-11 h-11 rounded-full bg-black/65 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white shadow-xl">
                          {isMuted ? (
                            <VolumeX className="w-5 h-5 text-zinc-400" />
                          ) : (
                            <Volume2 className="w-5 h-5 text-[#00E5FF]" />
                          )}
                        </div>
                        <span className="text-[10px] font-medium text-white drop-shadow">
                          {isMuted ? 'Muted' : 'Sound'}
                        </span>
                      </button>

                      {/* Share Direct Deep-Link Button */}
                      <button
                        type="button"
                        onClick={() => handleShare(item)}
                        className="flex flex-col items-center gap-1 cursor-pointer active:scale-90 transition-transform"
                        title="Share Reel Link"
                        aria-label="Share Reel Link"
                      >
                        <div
                          className={`w-11 h-11 rounded-full backdrop-blur-xl border flex items-center justify-center shadow-xl transition-all ${
                            copiedLink
                              ? 'bg-emerald-600/90 border-emerald-400 text-white'
                              : 'bg-black/65 border-white/20 text-white'
                          }`}
                        >
                          {copiedLink ? (
                            <Check className="w-5 h-5 text-white" />
                          ) : (
                            <Share2 className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <span className="text-[10px] font-medium text-white drop-shadow">
                          {copiedLink ? 'Copied!' : 'Share'}
                        </span>
                      </button>

                      {/* Direct Branded Save / Download Button */}
                      <button
                        type="button"
                        onClick={() => handleDownload(item)}
                        disabled={isDownloading}
                        className="flex flex-col items-center gap-1 cursor-pointer active:scale-90 transition-transform disabled:opacity-50"
                        title="Save Reel to Device"
                        aria-label="Save Reel"
                      >
                        <div
                          className={`w-11 h-11 rounded-full backdrop-blur-xl border flex items-center justify-center shadow-xl transition-all ${
                            downloadSuccess
                              ? 'bg-emerald-600/90 border-emerald-400 text-white'
                              : 'bg-black/65 border-white/20 text-white'
                          }`}
                        >
                          {downloadSuccess ? (
                            <Check className="w-5 h-5 text-white" />
                          ) : isDownloading ? (
                            <Loader2 className="w-5 h-5 text-[#00E5FF] animate-spin" />
                          ) : (
                            <Download className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <span className="text-[10px] font-medium text-white drop-shadow">
                          {downloadSuccess ? 'Saved!' : isDownloading ? 'Saving...' : 'Save'}
                        </span>
                      </button>
                    </div>

                    {/* ================= MOBILE BOTTOM METADATA OVERLAY (Directly ON Video) ================= */}
                    <div
                      className={`md:hidden absolute inset-x-0 bottom-0 z-20 flex flex-col justify-end pt-14 pb-[max(1rem,env(safe-area-inset-bottom))] px-4 bg-gradient-to-t from-black/95 via-black/50 to-transparent transition-all duration-300 pointer-events-auto ${
                        showControls || !isPlaying
                          ? 'opacity-100 translate-y-0'
                          : 'opacity-0 translate-y-3 pointer-events-none'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-col gap-1 max-w-[calc(100%-4rem)] select-text">
                        {/* Album Badge */}
                        <div className="flex items-center gap-1.5 text-xs font-mono text-[#00E5FF]">
                          <Folder className="w-3.5 h-3.5 text-[#00E5FF] flex-shrink-0" />
                          <span className="font-semibold uppercase tracking-wider truncate drop-shadow">{albumName}</span>
                          <span className="text-zinc-400">•</span>
                          <span className="text-zinc-300 font-mono drop-shadow">Reel {idx + 1}/{shorts.length}</span>
                        </div>

                        {/* Title */}
                        <h2 className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] line-clamp-2">
                          {displayTitle}
                        </h2>

                        {/* File Name */}
                        {fileName && fileName.toLowerCase() !== displayTitle.toLowerCase() && (
                          <span className="text-[11px] font-mono text-zinc-300 drop-shadow truncate block">
                            {fileName}
                          </span>
                        )}
                      </div>

                      {/* Scrubber Progress Line on Mobile */}
                      {isSnapped && (
                        <div
                          className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer mt-3"
                          onClick={handleSeek}
                          title="Seek Reel Time"
                        >
                          <div
                            className="h-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]"
                            style={{
                              width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Desktop Scrubber Progress Line OUTSIDE clip */}
                  {isSnapped && (
                    <div
                      className="hidden md:block w-full h-1 bg-white/15 rounded-full overflow-hidden cursor-pointer mt-2"
                      onClick={handleSeek}
                      title="Seek Reel Time"
                    >
                      <div
                        className="h-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]"
                        style={{
                          width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* ================= 3. DESKTOP RIGHT COLUMN (Outside Clip): Floating Action Controls ================= */}
                <aside
                  className="hidden md:flex flex-col items-center justify-end pb-6 sm:pb-8 gap-3 sm:gap-4 z-30 pointer-events-auto flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Sound / Mute Toggle Button */}
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="group/action flex flex-col items-center gap-1 cursor-pointer active:scale-90 transition-transform"
                    title={isMuted ? 'Unmute Reel (M)' : 'Mute Reel (M)'}
                    aria-label={isMuted ? 'Unmute Reel' : 'Mute Reel'}
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/[0.08] hover:bg-white/[0.15] backdrop-blur-xl border border-white/20 hover:border-white/40 flex items-center justify-center text-white shadow-xl transition-all">
                      {isMuted ? (
                        <VolumeX className="w-5 h-5 text-zinc-400" />
                      ) : (
                        <Volume2 className="w-5 h-5 text-[#00E5FF]" />
                      )}
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-medium text-white/90">
                      {isMuted ? 'Muted' : 'Sound'}
                    </span>
                  </button>

                  {/* Share Direct Deep-Link Button */}
                  <button
                    type="button"
                    onClick={() => handleShare(item)}
                    className="group/action flex flex-col items-center gap-1 cursor-pointer active:scale-90 transition-transform"
                    title="Share Reel Link"
                    aria-label="Share Reel Link"
                  >
                    <div
                      className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full backdrop-blur-xl border flex items-center justify-center shadow-xl transition-all ${
                        copiedLink
                          ? 'bg-emerald-600/90 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                          : 'bg-white/[0.08] hover:bg-white/[0.15] border-white/20 hover:border-white/40 text-white'
                      }`}
                    >
                      {copiedLink ? (
                        <Check className="w-5 h-5 text-white" />
                      ) : (
                        <Share2 className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-medium text-white/90">
                      {copiedLink ? 'Copied!' : 'Share'}
                    </span>
                  </button>

                  {/* Direct Branded Save / Download Button */}
                  <button
                    type="button"
                    onClick={() => handleDownload(item)}
                    disabled={isDownloading}
                    className="group/action flex flex-col items-center gap-1 cursor-pointer active:scale-90 transition-transform disabled:opacity-50"
                    title="Save Reel to Device"
                    aria-label="Save Reel"
                  >
                    <div
                      className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full backdrop-blur-xl border flex items-center justify-center shadow-xl transition-all ${
                        downloadSuccess
                          ? 'bg-emerald-600/90 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                          : 'bg-white/[0.08] hover:bg-white/[0.15] border-white/20 hover:border-white/40 text-white'
                      }`}
                    >
                      {downloadSuccess ? (
                        <Check className="w-5 h-5 text-white" />
                      ) : isDownloading ? (
                        <Loader2 className="w-5 h-5 text-[#00E5FF] animate-spin" />
                      ) : (
                        <Download className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-medium text-white/90">
                      {downloadSuccess ? 'Saved!' : isDownloading ? 'Saving...' : 'Save'}
                    </span>
                  </button>

                  {/* Up / Down Navigation Controls */}
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={handleScrollPrev}
                      disabled={activeIndex === 0}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all disabled:opacity-20 disabled:pointer-events-none active:scale-90 cursor-pointer"
                      title="Previous Reel (Up Arrow)"
                      aria-label="Previous Reel"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={handleScrollNext}
                      disabled={activeIndex === shorts.length - 1}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all disabled:opacity-20 disabled:pointer-events-none active:scale-90 cursor-pointer"
                      title="Next Reel (Down Arrow)"
                      aria-label="Next Reel"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </aside>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ShortsFeedModal;
