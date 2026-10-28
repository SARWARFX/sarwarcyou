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
  X,
  Sparkles,
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

  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const activeVideoRef = useRef<HTMLVideoElement>(null);
  const pulseTimerRef = useRef<number | null>(null);

  // Strict background scroll-lock
  useLockBodyScroll(isOpen);

  // Sync initialIndex changes from parent / deep-link
  const [prevProps, setPrevProps] = useState({ initialIndex, isOpen });
  if (prevProps.initialIndex !== initialIndex || prevProps.isOpen !== isOpen) {
    setPrevProps({ initialIndex, isOpen });
    setActiveIndex(initialIndex);
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(0);
  }

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
    if (activeVideoRef.current) {
      try {
        activeVideoRef.current.pause();
        activeVideoRef.current.removeAttribute('src');
        activeVideoRef.current.load();
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
      if (pulseTimerRef.current) window.clearTimeout(pulseTimerRef.current);
    };
  }, [releaseVideoResources]);

  // IntersectionObserver for DOM virtualization: only currently snapped reel plays
  useEffect(() => {
    if (!isOpen || !containerRef.current || !shorts.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idx = Number(entry.target.getAttribute('data-reel-index'));
            if (!isNaN(idx) && idx !== activeIndex) {
              setActiveIndex(idx);
              setIsPlaying(true);
              setCurrentTime(0);
              setDuration(0);

              // Pre-warm next reel stream
              if (shorts[idx + 1]?.url) {
                prewarmVideoStream(shorts[idx + 1].url);
              }
            }
          }
        });
      },
      {
        root: containerRef.current,
        threshold: [0.6],
      }
    );

    slideRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [isOpen, shorts, activeIndex]);

  // Autoplay currently snapped reel and handle mobile autoplay policy
  useEffect(() => {
    if (!isOpen) return;

    const video = activeVideoRef.current;
    if (video) {
      video.muted = isMuted;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => {
            // Autoplay with audio was blocked; mute and retry
            if (!video.muted) {
              video.muted = true;
              setIsMuted(true);
              video.play().then(() => setIsPlaying(true)).catch(() => {});
            }
          });
      }
    }
  }, [activeIndex, isOpen, isMuted]);

  // Single-tap play/pause toggle with center pulse icon
  const togglePlay = useCallback(() => {
    const video = activeVideoRef.current;
    if (!video) return;

    if (pulseTimerRef.current) window.clearTimeout(pulseTimerRef.current);

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
      setCenterPulse('play');
    } else {
      video.pause();
      setIsPlaying(false);
      setCenterPulse('pause');
    }

    pulseTimerRef.current = window.setTimeout(() => {
      setCenterPulse(null);
    }, 550);
  }, []);

  // Sound / Mute Toggle
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (activeVideoRef.current) {
        activeVideoRef.current.muted = next;
      }
      return next;
    });
  }, []);

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
  const handleShare = useCallback(async (item: StageMediaItem) => {
    if (!item) return;
    const shareUrl = createShareableMediaUrl(item, 'shorts');
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }, []);

  // Branded Video Download
  const handleDownload = useCallback(async (item: StageMediaItem) => {
    if (!item || isDownloading) return;
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
  }, [isDownloading]);

  // Seek bar tap handler
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = activeVideoRef.current;
    if (!video || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = pct * duration;
    video.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  if (!isOpen || !shorts.length) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Facebook Reels Experience"
      className="fixed inset-0 z-[9999] w-full h-[100dvh] bg-black text-white select-none overflow-hidden touch-none"
    >
      {/* 1. Header Bar: Close button & Sequential Up/Down arrows */}
      <div className="fixed top-0 inset-x-0 z-[160] flex items-center justify-between p-3 sm:p-5 pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none">
        {/* Left: Facebook Reels Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/15 pointer-events-auto shadow-lg">
          <div className="w-2.5 h-2.5 rounded-full bg-[#00E5FF] animate-pulse" />
          <span className="text-xs font-bold font-sans uppercase tracking-wider text-white">Reels</span>
          <span className="text-[10px] font-mono text-zinc-400">
            {activeIndex + 1}/{shorts.length}
          </span>
        </div>

        {/* Right: Sequential arrow buttons & Close button */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Previous Reel Arrow */}
          <button
            type="button"
            onClick={handleScrollPrev}
            disabled={activeIndex === 0}
            className="hidden sm:flex p-2.5 rounded-full bg-black/65 hover:bg-black/90 text-white/90 hover:text-white border border-white/15 hover:border-white/30 backdrop-blur-xl transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none active:scale-95"
            title="Previous Reel (Up Arrow)"
            aria-label="Previous Reel"
          >
            <ChevronUp className="w-4 h-4" />
          </button>

          {/* Next Reel Arrow */}
          <button
            type="button"
            onClick={handleScrollNext}
            disabled={activeIndex === shorts.length - 1}
            className="hidden sm:flex p-2.5 rounded-full bg-black/65 hover:bg-black/90 text-white/90 hover:text-white border border-white/15 hover:border-white/30 backdrop-blur-xl transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none active:scale-95"
            title="Next Reel (Down Arrow)"
            aria-label="Next Reel"
          >
            <ChevronDown className="w-4 h-4" />
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={handleClose}
            className="p-2.5 sm:p-3 rounded-full bg-black/75 hover:bg-black/95 text-white/90 hover:text-white border border-white/20 hover:border-white/40 shadow-2xl backdrop-blur-2xl transition-all cursor-pointer hover:scale-105 active:scale-95"
            title="Close Reels (Esc)"
            aria-label="Close Reels"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
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
          const displayTitle = sanitizeMediaTitle(item.title, item.category || 'Reel');

          return (
            <div
              key={item.id || idx}
              ref={(el) => {
                slideRefs.current[idx] = el;
              }}
              data-reel-index={idx}
              className="w-full h-[100dvh] max-h-[100dvh] flex items-center justify-center relative snap-start snap-always overflow-hidden bg-black flex-shrink-0"
            >
              {/* Main Reel Viewport Frame (Centered 9:16 portrait on desktop, full-screen on mobile) */}
              <div
                className="relative w-full h-full sm:h-[94vh] sm:max-h-[880px] sm:aspect-[9/16] sm:max-w-[460px] sm:rounded-3xl overflow-hidden bg-black flex items-center justify-center shadow-[0_25px_60px_rgba(0,0,0,0.95)]"
                onClick={isSnapped ? togglePlay : undefined}
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

                {/* DOM Virtualization: Only render <video> for active snapped reel and immediate next preloader */}
                {isAdjacent ? (
                  <video
                    ref={isSnapped ? activeVideoRef : undefined}
                    src={streamUrl}
                    poster={shortPoster || undefined}
                    autoPlay={isSnapped}
                    preload={isSnapped ? 'auto' : 'metadata'}
                    playsInline
                    loop
                    muted={isMuted}
                    crossOrigin="anonymous"
                    onPlay={() => {
                      if (isSnapped) setIsPlaying(true);
                    }}
                    onPause={() => {
                      if (isSnapped) setIsPlaying(false);
                    }}
                    onTimeUpdate={() => {
                      if (isSnapped && activeVideoRef.current) {
                        setCurrentTime(activeVideoRef.current.currentTime);
                      }
                    }}
                    onLoadedMetadata={(e) => {
                      if (isSnapped) {
                        setDuration(e.currentTarget.duration || 0);
                      }
                    }}
                    className="w-full h-full object-cover relative z-10 select-none cursor-pointer"
                  />
                ) : (
                  // Offscreen reel placeholder (zero video decoder footprint, zero bandwidth lag)
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-zinc-900 to-black flex items-center justify-center z-10 pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                      <Play className="w-5 h-5 text-white/50 fill-current ml-0.5" />
                    </div>
                  </div>
                )}

                {/* Single-tap Play/Pause Center Pulse Icon */}
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

                {/* Paused Static Overlay Indicator */}
                {isSnapped && !isPlaying && !centerPulse && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl">
                      <Play className="w-7 h-7 fill-current ml-1" />
                    </div>
                  </div>
                )}

                {/* 3. Floating Right-Hand Action Column */}
                {isSnapped && (
                  <aside
                    className="absolute right-3 sm:right-4 bottom-20 sm:bottom-24 flex flex-col items-center gap-3.5 sm:gap-4 z-30 pointer-events-auto"
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
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-xl border border-white/20 hover:border-white/40 flex items-center justify-center text-white shadow-xl transition-all">
                        {isMuted ? (
                          <VolumeX className="w-5 h-5 text-zinc-300" />
                        ) : (
                          <Volume2 className="w-5 h-5 text-[#00E5FF]" />
                        )}
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-semibold text-white/90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
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
                            : 'bg-black/60 hover:bg-black/85 border-white/20 hover:border-white/40 text-white'
                        }`}
                      >
                        {copiedLink ? (
                          <Check className="w-5 h-5 text-white" />
                        ) : (
                          <Share2 className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-semibold text-white/90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                        {copiedLink ? 'Copied!' : 'Share'}
                      </span>
                    </button>

                    {/* Direct Branded Download Button */}
                    <button
                      type="button"
                      onClick={() => handleDownload(item)}
                      disabled={isDownloading}
                      className="group/action flex flex-col items-center gap-1 cursor-pointer active:scale-90 transition-transform disabled:opacity-50"
                      title="Download Reel"
                      aria-label="Download Reel"
                    >
                      <div
                        className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full backdrop-blur-xl border flex items-center justify-center shadow-xl transition-all ${
                          downloadSuccess
                            ? 'bg-emerald-600/90 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                            : 'bg-black/60 hover:bg-black/85 border-white/20 hover:border-white/40 text-white'
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
                      <span className="text-[10px] sm:text-[11px] font-semibold text-white/90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                        {downloadSuccess ? 'Saved!' : isDownloading ? 'Saving...' : 'Save'}
                      </span>
                    </button>
                  </aside>
                )}

                {/* 4. Bottom Translucent Gradient Title/Metadata Overlay */}
                <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/95 via-black/55 to-transparent z-20 pointer-events-none flex flex-col gap-2">
                  {/* Category / Album Pill Badge */}
                  {item.category && (
                    <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-[#00E5FF] bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-[#00E5FF]/30 w-fit pointer-events-auto">
                      <Sparkles className="w-3 h-3 text-[#00E5FF]" />
                      <span>{item.category}</span>
                    </div>
                  )}

                  {/* Sanitized Reel Title */}
                  <h2 className="text-sm sm:text-base font-bold text-white tracking-wide line-clamp-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] pr-16 select-text pointer-events-auto">
                    {displayTitle}
                  </h2>

                  {/* Bottom Video Progress Scrub Line */}
                  {isSnapped && (
                    <div
                      className="w-full h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer pointer-events-auto mt-1"
                      onClick={handleSeek}
                      title="Seek Reel Time"
                    >
                      <div
                        className="h-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF] transition-all duration-100"
                        style={{
                          width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ShortsFeedModal;
