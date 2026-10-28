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
      aria-label="Shorts Player"
      className="fixed inset-0 z-[9999] w-full h-[100dvh] bg-black text-white select-none overflow-hidden touch-none"
    >
      {/* 1. Header Bar: Close button & Quick Status */}
      <div className="fixed top-0 inset-x-0 z-[160] flex items-center justify-between p-3 sm:p-5 pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none">
        {/* Left: Shorts Brand Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/15 pointer-events-auto shadow-lg">
          <div className="w-2.5 h-2.5 rounded-full bg-[#00E5FF] animate-pulse" />
          <span className="text-xs font-bold font-sans uppercase tracking-wider text-white">Shorts</span>
          <span className="text-[10px] font-mono text-zinc-400">
            {activeIndex + 1}/{shorts.length}
          </span>
        </div>

        {/* Right: Close button */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={handleClose}
            className="p-2.5 sm:p-3 rounded-full bg-black/75 hover:bg-black/95 text-white/90 hover:text-white border border-white/20 hover:border-white/40 shadow-2xl backdrop-blur-2xl transition-all cursor-pointer hover:scale-105 active:scale-95"
            title="Close Shorts (Esc)"
            aria-label="Close Shorts"
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
              className="w-full h-[100dvh] max-h-[100dvh] flex items-center justify-center relative snap-start snap-always overflow-hidden bg-black flex-shrink-0 px-2 sm:px-4 md:px-6 lg:px-8"
            >
              <div className="relative flex items-center justify-center gap-3 sm:gap-5 md:gap-8 max-h-[96vh] w-full max-w-[1400px] my-auto">
                {/* ================= 1. LEFT COLUMN (Outside Clip): Album Name, File Name & Details ================= */}
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

                {/* ================= 2. CENTER: Clean, 100% Unobstructed Video Clip ================= */}
                <div className="relative flex flex-col items-center flex-shrink-0">
                  <div
                    className="relative aspect-[9/16] h-[74vh] sm:h-[84vh] md:h-[86vh] max-h-[840px] w-auto rounded-2xl sm:rounded-3xl overflow-hidden bg-black flex items-center justify-center shadow-[0_20px_60px_rgba(0,0,0,0.95)] border border-white/10 group cursor-pointer"
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
                      <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-zinc-900 to-black flex items-center justify-center z-10 pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                          <Play className="w-5 h-5 text-white/50 fill-current ml-0.5" />
                        </div>
                      </div>
                    )}

                    {/* Single-tap Play/Pause Center Pulse Icon (only appears for 500ms on tap) */}
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
                  </div>

                  {/* Scrubber Progress Line OUTSIDE and directly underneath the clip */}
                  {isSnapped && (
                    <div
                      className="w-full h-1 bg-white/15 rounded-full overflow-hidden cursor-pointer mt-2"
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

                  {/* Mobile Title & Album Bar OUTSIDE the clip (rendered below the clip on screens < md) */}
                  <div className="md:hidden flex flex-col items-center text-center mt-2 max-w-[calc(100vw-90px)] px-2 z-20">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#00E5FF] truncate">
                      <Folder className="w-3 h-3 text-[#00E5FF] flex-shrink-0" />
                      <span className="uppercase">{albumName}</span>
                      <span className="text-zinc-500">•</span>
                      <span className="text-zinc-400">Reel {idx + 1}/{shorts.length}</span>
                    </div>
                    <h2 className="text-xs sm:text-sm font-bold text-white tracking-wide truncate max-w-full mt-0.5">
                      {displayTitle}
                    </h2>
                    {fileName && fileName.toLowerCase() !== displayTitle.toLowerCase() && (
                      <span className="text-[10px] font-mono text-zinc-400 truncate max-w-full">
                        {fileName}
                      </span>
                    )}
                  </div>
                </div>

                {/* ================= 3. RIGHT COLUMN (Outside Clip): Floating Action Controls ================= */}
                <aside
                  className="flex flex-col items-center justify-end pb-6 sm:pb-8 gap-3 sm:gap-4 z-30 pointer-events-auto flex-shrink-0"
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
