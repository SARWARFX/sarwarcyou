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
  X,
  AlertTriangle,
} from 'lucide-react';
import type { StageMediaItem } from '../types';
import { downloadBrandedVideo } from '../utils/downloadMedia';
import { getCachedVideoPoster, prewarmVideoStream } from '../utils/videoPosterGenerator';
import { isVideoExtension } from '../utils/mediaTypeDetector';
import { getCachedThumbnailSync } from '../utils/clientVideoThumbnails';
import { getMediaUrl, getVideoStreamUrl, getDirectHfVideoUrl } from '../utils/imageUrlResolver';
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

export const ShortsFeedModal: React.FC<ShortsFeedModalProps> = (props) => {
  if (!props.isOpen) return null;

  // At the very beginning of ShortsFeedModal: check empty state
  if (!props.shorts || props.shorts.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 text-cyan-400">
        <Loader2 className="w-8 h-8 animate-spin mr-3 text-cyan-400" />
        Loading shorts...
      </div>
    );
  }

  return <ShortsFeedModalContent {...props} />;
};

const ShortsFeedModalContent: React.FC<ShortsFeedModalProps> = ({
  isOpen,
  onClose,
  shorts,
  initialIndex,
  onIndexChange,
}) => {
  const safeInitialIndex = Math.max(0, Math.min(initialIndex || 0, Math.max(0, (shorts?.length || 1) - 1)));
  const [activeIndex, setActiveIndex] = useState(safeInitialIndex);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [centerPulse, setCenterPulse] = useState<'play' | 'pause' | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [readyVideos, setReadyVideos] = useState<Record<number, boolean>>({});
  const [landscapeVideos, setLandscapeVideos] = useState<Record<number, boolean>>({});
  const [videoSourceOverrides, setVideoSourceOverrides] = useState<Record<number, string>>({});
  const [videoErrors, setVideoErrors] = useState<Record<number, boolean>>({});

  const markVideoReady = useCallback((index: number) => {
    setReadyVideos((prev) => (prev[index] ? prev : { ...prev, [index]: true }));
  }, []);

  const updateVideoOrientation = useCallback((index: number, width: number, height: number) => {
    if (width > 0 && height > 0) {
      const isWide = width > height;
      setLandscapeVideos((prev) => (prev[index] === isWide ? prev : { ...prev, [index]: isWide }));
    }
  }, []);

  // Mobile Immersive Mode: Controls auto-hide during playback and reveal on user access
  const [showControls, setShowControls] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const activeVideoRef = useRef<HTMLVideoElement>(null);
  const pulseTimerRef = useRef<number | null>(null);
  const controlsTimerRef = useRef<number | null>(null);
  const fallbackAttemptedRef = useRef<Record<string, boolean>>({});

  // Synchronous refs to prevent stale closure reads in event listeners
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

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
    setActiveIndex(safeInitialIndex);
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(0);
    setReadyVideos((prev) => (Object.keys(prev).length ? {} : prev));
    setVideoSourceOverrides((prev) => (Object.keys(prev).length ? {} : prev));
    setVideoErrors((prev) => (Object.keys(prev).length ? {} : prev));
    fallbackAttemptedRef.current = {};
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
    if (isOpen && containerRef.current && shorts && shorts.length > 0) {
      const targetIdx = Math.max(0, Math.min(initialIndex || 0, shorts.length - 1));
      const target = slideRefs.current[targetIdx];
      if (target) {
        requestAnimationFrame(() => {
          target.scrollIntoView({ behavior: 'auto', block: 'start' });
        });
      } else if (containerRef.current) {
        containerRef.current.scrollTop = targetIdx * containerRef.current.clientHeight;
      }
    }
  }, [isOpen, initialIndex, shorts]);

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
          v.src = '';
          v.removeAttribute('src');
          v.load();
        } catch {
          // ignore
        }
      }
    });
    setReadyVideos((prev) => (Object.keys(prev).length ? {} : prev));
    setVideoSourceOverrides((prev) => (Object.keys(prev).length ? {} : prev));
    setVideoErrors((prev) => (Object.keys(prev).length ? {} : prev));
    fallbackAttemptedRef.current = {};
    if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
    if (pulseTimerRef.current) window.clearTimeout(pulseTimerRef.current);

    // Clean up dynamically injected preload links from document head
    try {
      const preloadLink = document.getElementById('preload-next-short-video');
      if (preloadLink && preloadLink.parentNode) {
        preloadLink.parentNode.removeChild(preloadLink);
      }
    } catch {
      // ignore
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

  // =========================================================================
  // NATIVE CSS SCROLL SNAP INTERSECTION OBSERVER:
  // Detects active reel transitions cleanly without intercepting raw wheel/touch inputs.
  // =========================================================================
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const indexAttr = entry.target.getAttribute('data-reel-index');
            if (indexAttr !== null) {
              const targetIdx = parseInt(indexAttr, 10);
              if (!isNaN(targetIdx) && targetIdx !== activeIndexRef.current) {
                activeIndexRef.current = targetIdx;

                // Synchronously silence & pause all non-target videos immediately
                videoRefs.current.forEach((v, i) => {
                  if (v && i !== targetIdx) {
                    v.pause();
                    v.muted = true;
                  }
                });

                const targetVideo = videoRefs.current[targetIdx];
                if (targetVideo) {
                  activeVideoRef.current = targetVideo;
                  targetVideo.muted = isMutedRef.current;
                  const playPromise = targetVideo.play();
                  if (playPromise !== undefined) {
                    playPromise
                      .then(() => setIsPlaying(true))
                      .catch(() => {
                        if (!isMutedRef.current) {
                          targetVideo.muted = true;
                          isMutedRef.current = true;
                          setIsMuted(true);
                        }
                      });
                  }
                  setCurrentTime(targetVideo.currentTime);
                  setDuration(
                    targetVideo.duration && isFinite(targetVideo.duration) ? targetVideo.duration : 0
                  );
                } else {
                  setCurrentTime(0);
                  setDuration(0);
                }

                setActiveIndex(targetIdx);
                setIsPlaying(true);
                resetControlsTimer();

                // Prewarm next reel stream
                if (shorts && shorts[targetIdx + 1]?.url) {
                  prewarmVideoStream(shorts[targetIdx + 1].url);
                }
              }
            }
          }
        });
      },
      {
        root: containerRef.current,
        threshold: 0.6,
      }
    );

    slideRefs.current.forEach((slide) => {
      if (slide) observer.observe(slide);
    });

    return () => {
      observer.disconnect();
    };
  }, [isOpen, shorts?.length, resetControlsTimer]);

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

          // Guard: if video already has error, do NOT attempt to play
          if (video.error || videoErrors[idx]) {
            return;
          }

          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => setIsPlaying(true))
              .catch((err) => {
                console.warn("Autoplay blocked, falling back to muted:", err);
                if (!isMutedRef.current) {
                  video.muted = true;
                  isMutedRef.current = true;
                  setIsMuted(true);
                }
              });
          }
        }
      }
    });
  }, [activeIndex, isOpen, isMuted, videoErrors]);

  // Smart Adjacent Pre-Fetching: while active video i is playing, silently pre-fetch i + 1
  useEffect(() => {
    if (!isOpen || !shorts || activeIndex >= shorts.length - 1) return;
    const nextItem = shorts[activeIndex + 1];
    if (!nextItem) return;

    const nextUrl = getMediaUrl(nextItem.url || nextItem.path || nextItem.id);
    if (!nextUrl) return;

    // 1. Silent pre-fetch link in document head
    const linkId = 'preload-next-short-video';
    let link = document.getElementById(linkId) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = linkId;
      link.rel = 'prefetch';
      link.as = 'video';
      document.head.appendChild(link);
    }
    link.href = nextUrl;

    // 2. Offscreen video buffer element with preload="auto" to pre-buffer frame 0
    const hiddenCacheVideo = document.createElement('video');
    hiddenCacheVideo.muted = true;
    hiddenCacheVideo.playsInline = true;
    hiddenCacheVideo.preload = 'auto';
    hiddenCacheVideo.src = nextUrl;
    hiddenCacheVideo.load();

    return () => {
      try {
        hiddenCacheVideo.src = '';
        hiddenCacheVideo.load();
      } catch {
        // ignore
      }
    };
  }, [isOpen, activeIndex, shorts]);

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
    if (shorts && activeIndex < shorts.length - 1) {
      const nextIdx = activeIndex + 1;
      videoRefs.current.forEach((v, i) => {
        if (v && i !== nextIdx) {
          v.pause();
          v.muted = true;
        }
      });
      const nextEl = slideRefs.current[nextIdx];
      if (nextEl) {
        nextEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [activeIndex, shorts?.length]);

  const handleScrollPrev = useCallback(() => {
    if (activeIndex > 0) {
      const prevIdx = activeIndex - 1;
      videoRefs.current.forEach((v, i) => {
        if (v && i !== prevIdx) {
          v.pause();
          v.muted = true;
        }
      });
      const prevEl = slideRefs.current[prevIdx];
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
    async (item?: StageMediaItem | Partial<StageMediaItem> | null) => {
      if (!item) return;
      resetControlsTimer();
      const shareUrl = createShareableMediaUrl(item as StageMediaItem, 'shorts');
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
    async (item?: StageMediaItem | Partial<StageMediaItem> | null) => {
      if (!item || isDownloading) return;
      resetControlsTimer();
      setIsDownloading(true);
      setDownloadSuccess(false);
      try {
        const dlUrl = getMediaUrl(item.url || item.path || item.id || '');
        await downloadBrandedVideo(dlUrl, item.title || item.name || item.id || 'short', 'short');
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

  if (!isOpen) return null;

  if (!shorts || shorts.length === 0 || !shorts[activeIndex]) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 text-cyan-400">
        <Loader2 className="w-8 h-8 animate-spin mr-3 text-cyan-400" />
        Loading shorts...
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shorts Player"
      className="fixed inset-0 z-50 w-[100vw] h-[100dvh] text-white select-none overflow-hidden flex justify-center items-center"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        zIndex: 50,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'rgba(3, 5, 10, 0.55)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
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
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full pointer-events-auto shadow-lg"
          style={{
            background: 'rgba(8, 11, 20, 0.65)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
          }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff] animate-pulse" />
          <span className="text-xs font-bold font-sans uppercase tracking-wider text-white">Shorts</span>
          <span className="text-[10px] font-mono text-zinc-300">
            {activeIndex + 1}/{shorts.length}
          </span>
        </div>

        {/* Right: Floating Minimal Glass Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/[0.06] hover:bg-[#00f0ff]/10 backdrop-blur-md border border-white/[0.12] hover:border-[#00f0ff] text-white/90 hover:text-[#00f0ff] hover:shadow-[0_0_16px_rgba(0,240,255,0.5)] flex items-center justify-center pointer-events-auto transition-all duration-300 cursor-pointer active:scale-95"
          title="Close (Esc)"
          aria-label="Close"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      {/* 2. Full-Screen Vertical Swipe Feed (Native CSS Scroll Snapping) */}
      <div
        ref={containerRef}
        className="h-screen w-full overflow-y-auto snap-y snap-mandatory scroll-smooth overscroll-y-contain no-scrollbar"
        style={{
          scrollSnapType: 'y mandatory',
          overscrollBehaviorY: 'contain',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {shorts.map((rawItem, idx) => {
          if (!rawItem) return null;
          const item = rawItem;
          const isSnapped = idx === activeIndex;
          const isAdjacent = Math.abs(idx - activeIndex) <= 1;
          const primaryStreamUrl = getVideoStreamUrl(item);
          const directHfUrl = getDirectHfVideoUrl(item);
          const streamUrl = videoSourceOverrides[idx] || primaryStreamUrl || directHfUrl;
          const rawPoster = (
            item.thumbnails?.[0] ||
            (item.url ? getCachedThumbnailSync(item.url) : '') ||
            (item.url ? getCachedVideoPoster(item.url) : '') ||
            item.thumbnail ||
            item.poster ||
            item.posterUrl ||
            ''
          );
          const shortPoster = rawPoster && !isVideoExtension(rawPoster) ? getMediaUrl(rawPoster) : '';
          const displayTitle = sanitizeMediaTitle(item.title || item.name || 'Short', item.category || 'Short');
          const albumName = item.category || item.parentAlbum || 'Shorts';
          const fileName = (item.name || item.path?.split('/').pop() || '').trim();
          const videoEl = videoRefs.current[idx];
          const isLandscapeVideo = Boolean(
            landscapeVideos[idx] ||
            (videoEl && videoEl.videoWidth > 0 && videoEl.videoHeight > 0 && videoEl.videoWidth > videoEl.videoHeight)
          );

          return (
            <div
              key={item.id || idx}
              ref={(el) => {
                slideRefs.current[idx] = el;
              }}
              data-reel-index={idx}
              className="h-screen w-full shrink-0 snap-start snap-always relative flex items-center justify-center overflow-hidden p-0 m-0 border-0 md:px-6 lg:px-8"
              style={{
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
                willChange: isAdjacent ? 'transform' : 'auto',
              }}
            >
              <div
                className="relative flex items-center justify-center md:gap-8 w-[100vw] md:w-auto h-[100dvh] max-h-[100dvh] md:max-h-[96vh] md:max-w-[1400px] p-0 m-0 border-0 rounded-none my-auto"
                style={{
                  willChange: isAdjacent ? 'transform' : 'auto',
                }}
              >
                {/* ================= 1. DESKTOP LEFT COLUMN (Outside Clip): Album, Title & Details ================= */}
                <div className="hidden md:flex flex-col justify-end w-56 lg:w-72 xl:w-80 pb-6 z-20 pointer-events-auto flex-shrink-0 gap-3">
                  <div
                    className="p-4 sm:p-5 rounded-2xl flex flex-col gap-2.5 shadow-xl"
                    style={{
                      background: 'rgba(8, 11, 20, 0.55)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    {/* Album Name Badge */}
                    <div className="flex items-center gap-1.5 text-xs font-mono text-[#00f0ff]">
                      <Folder className="w-3.5 h-3.5 text-[#00f0ff] flex-shrink-0" />
                      <span
                        className="font-semibold uppercase tracking-wider truncate"
                        style={{ textShadow: '0 1px 4px #000, 0 0 8px #000' }}
                      >
                        {albumName}
                      </span>
                    </div>

                    {/* Clean Video Title */}
                    <h2
                      className="text-base sm:text-lg lg:text-xl font-bold text-white tracking-tight leading-snug select-text"
                      style={{ textShadow: '0 1px 4px #000, 0 0 8px #000' }}
                    >
                      {displayTitle}
                    </h2>

                    {/* Exact File Name */}
                    {fileName && fileName.toLowerCase() !== displayTitle.toLowerCase() && (
                      <span
                        className="text-xs font-mono text-zinc-300 truncate block select-text"
                        style={{ textShadow: '0 1px 4px #000, 0 0 8px #000' }}
                      >
                        {fileName}
                      </span>
                    )}

                    {/* Reel Index counter & Commit Date */}
                    <div
                      className="flex items-center gap-2 pt-2 border-t border-white/[0.08] text-xs font-mono text-zinc-300"
                      style={{ textShadow: '0 1px 4px #000, 0 0 8px #000' }}
                    >
                      <span className="text-[#00f0ff] font-bold">Reel {idx + 1} of {shorts.length}</span>
                      {item.date && typeof item.date === 'number' && item.date > 0 && !isNaN(new Date(item.date).getTime()) && (
                        <>
                          <span className="text-zinc-600">•</span>
                          <span>{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* ================= 2. VIDEO STAGE (Full Screen on Mobile, Aspect 9:16 on Desktop) ================= */}
                <div className="relative flex flex-col items-center flex-shrink-0 w-[100vw] h-[100dvh] max-h-[100dvh] md:w-auto md:h-auto p-0 m-0 border-0 rounded-none">
                  <div
                    className={`relative w-[100vw] h-[100dvh] max-h-[100dvh] md:w-auto ${
                      isLandscapeVideo
                        ? 'md:aspect-[16/9] md:max-w-[85vw] md:h-[80vh] md:max-h-[820px]'
                        : 'md:aspect-[9/16] md:h-[86vh] md:max-h-[840px]'
                    } rounded-none md:rounded-3xl overflow-hidden flex items-center justify-center shadow-none md:shadow-[0_20px_60px_rgba(0,0,0,0.95)] border-0 md:border md:border-white/10 group cursor-pointer p-0 m-0 ${
                      isLandscapeVideo ? 'bg-transparent md:bg-black/25' : 'bg-black'
                    }`}
                    style={{
                      background: isLandscapeVideo ? 'rgba(3, 6, 14, 0.35)' : undefined,
                      willChange: isAdjacent ? 'transform' : 'auto',
                    }}
                    onClick={isSnapped ? handleVideoClick : undefined}
                  >
                    {/* Visual Poster / Backing Image (Completely unmounted once video is ready) */}
                    {shortPoster && !readyVideos[idx] && (
                      <img
                        src={shortPoster}
                        alt={displayTitle}
                        loading={isAdjacent ? 'eager' : 'lazy'}
                        decoding="async"
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          if (img.naturalWidth && img.naturalHeight) {
                            updateVideoOrientation(idx, img.naturalWidth, img.naturalHeight);
                          }
                        }}
                        className="absolute inset-0 w-full h-full select-none pointer-events-none z-0"
                        style={{
                          width: '100%',
                          height: '100%',
                          maxHeight: '100dvh',
                          objectFit: isLandscapeVideo ? 'contain' : 'cover',
                        }}
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
                        poster={!readyVideos[idx] ? shortPoster || undefined : undefined}
                        autoPlay={isSnapped}
                        preload={isSnapped ? 'auto' : (idx === activeIndex + 1 ? 'auto' : 'metadata')}
                        playsInline
                        {...({ 'webkit-playsinline': 'true' } as any)}
                        loop
                        muted={!isSnapped ? true : isMuted}
                        crossOrigin="anonymous"
                        onCanPlay={(e) => {
                          markVideoReady(idx);
                          const v = e.currentTarget;
                          if (v.videoWidth && v.videoHeight) {
                            updateVideoOrientation(idx, v.videoWidth, v.videoHeight);
                          }
                          if (idx === activeIndex) {
                            if (v.paused) {
                              v.muted = isMuted;
                              const playPromise = v.play();
                              if (playPromise !== undefined) {
                                playPromise
                                  .then(() => setIsPlaying(true))
                                  .catch((err) => {
                                    console.warn("Autoplay blocked, falling back to muted:", err);
                                    if (!isMutedRef.current) {
                                      v.muted = true;
                                      isMutedRef.current = true;
                                      setIsMuted(true);
                                    }
                                  });
                              }
                            }
                          }
                        }}
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
                          markVideoReady(idx);
                          const v = e.currentTarget;
                          if (v.videoWidth && v.videoHeight) {
                            updateVideoOrientation(idx, v.videoWidth, v.videoHeight);
                          }
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
                          const v = e.currentTarget;
                          if (v.videoWidth && v.videoHeight) {
                            updateVideoOrientation(idx, v.videoWidth, v.videoHeight);
                          }
                          if (idx === activeIndex) {
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
                        onError={(e) => {
                          const v = e.currentTarget;
                          // Distinguish between actual network/codec failure and initial buffering
                          if (!v.error) {
                            return;
                          }

                          const itemKey = item.id || item.url || String(idx);

                          // If primary stream failed, attempt direct Hugging Face raw resolve endpoint fallback ONCE
                          if (!fallbackAttemptedRef.current[itemKey]) {
                            fallbackAttemptedRef.current[itemKey] = true;
                            if (directHfUrl && streamUrl !== directHfUrl) {
                              console.warn(`[ShortsPlayer] Stream failed on ${streamUrl}, falling back to direct HF CDN: ${directHfUrl}`);
                              setVideoSourceOverrides((prev) => (prev[idx] === directHfUrl ? prev : { ...prev, [idx]: directHfUrl }));
                              v.src = directHfUrl;
                              v.load();
                              return;
                            }
                          }

                          // Both primary and CDN fallback failed (or no fallback available). Do NOT call setState in a loop.
                          fallbackAttemptedRef.current[itemKey] = true;
                          console.warn('Both primary and CDN fallback failed for:', itemKey, v.error.message);
                          setVideoErrors((prev) => (prev[idx] ? prev : { ...prev, [idx]: true }));
                        }}
                        className="relative z-10 w-full h-full select-none cursor-pointer"
                        style={{
                          width: '100%',
                          height: '100%',
                          maxHeight: '100dvh',
                          objectFit: isLandscapeVideo ? 'contain' : 'cover',
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-zinc-900 to-black flex items-center justify-center z-10 pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                          <Play className="w-5 h-5 text-white/50 fill-current ml-0.5" />
                        </div>
                      </div>
                    )}

                    {/* Active Playback Error Overlay (Only shown if video.error is active after attempted load and no fallback succeeds) */}
                    {videoErrors[idx] && (
                      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center bg-black/85 backdrop-blur-md">
                        <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mb-3 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                          <AlertTriangle className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-white mb-1">Playback Error</h3>
                        <p className="text-xs text-zinc-300 font-mono mb-4 max-w-xs">
                          Unable to stream video. The media file or network may be temporarily unavailable.
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const itemKey = item.id || item.url || String(idx);
                            fallbackAttemptedRef.current[itemKey] = false;
                            setVideoErrors((prev) => {
                              if (!prev[idx]) return prev;
                              const next = { ...prev };
                              delete next[idx];
                              return next;
                            });
                            const v = videoRefs.current[idx];
                            if (v) {
                              v.src = directHfUrl || primaryStreamUrl;
                              v.load();
                            }
                          }}
                          className="py-1.5 px-4 rounded-xl bg-white/10 hover:bg-[#00f0ff]/20 border border-white/20 hover:border-[#00f0ff] text-white text-xs font-mono font-semibold transition-all cursor-pointer active:scale-95"
                        >
                          Retry Video
                        </button>
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
                      className={`md:hidden absolute right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(6rem,calc(env(safe-area-inset-bottom)+5rem))] z-30 flex flex-col items-center gap-3.5 transition-all duration-300 pointer-events-auto ${
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
                        <div className="w-11 h-11 rounded-full bg-white/[0.06] hover:bg-[#00f0ff]/10 backdrop-blur-md border border-white/[0.12] hover:border-[#00f0ff] flex items-center justify-center text-white hover:text-[#00f0ff] hover:shadow-[0_0_16px_rgba(0,240,255,0.45)] shadow-xl transition-all">
                          {isMuted ? (
                            <VolumeX className="w-5 h-5 text-zinc-400" />
                          ) : (
                            <Volume2 className="w-5 h-5 text-[#00f0ff]" />
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
                          className={`w-11 h-11 rounded-full backdrop-blur-md border flex items-center justify-center shadow-xl transition-all ${
                            copiedLink
                              ? 'bg-[#00f0ff]/20 border-[#00f0ff] text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.5)]'
                              : 'bg-white/[0.06] hover:bg-[#00f0ff]/10 border-white/[0.12] hover:border-[#00f0ff] text-white hover:text-[#00f0ff] hover:shadow-[0_0_16px_rgba(0,240,255,0.45)]'
                          }`}
                        >
                          {copiedLink ? (
                            <Check className="w-5 h-5 text-[#00f0ff]" />
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
                          className={`w-11 h-11 rounded-full backdrop-blur-md border flex items-center justify-center shadow-xl transition-all ${
                            downloadSuccess
                              ? 'bg-[#00f0ff]/20 border-[#00f0ff] text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.5)]'
                              : 'bg-white/[0.06] hover:bg-[#00f0ff]/10 border-white/[0.12] hover:border-[#00f0ff] text-white hover:text-[#00f0ff] hover:shadow-[0_0_16px_rgba(0,240,255,0.45)]'
                          }`}
                        >
                          {downloadSuccess ? (
                            <Check className="w-5 h-5 text-[#00f0ff]" />
                          ) : isDownloading ? (
                            <Loader2 className="w-5 h-5 text-[#00f0ff] animate-spin" />
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
                      className={`md:hidden absolute inset-x-0 bottom-0 z-20 flex flex-col justify-end pt-14 pb-[max(1rem,env(safe-area-inset-bottom))] px-[max(1rem,env(safe-area-inset-left))] bg-gradient-to-t from-black/70 via-black/20 to-transparent transition-all duration-300 pointer-events-auto ${
                        showControls || !isPlaying
                          ? 'opacity-100 translate-y-0'
                          : 'opacity-0 translate-y-3 pointer-events-none'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-col gap-1 max-w-[calc(100%-4rem)] select-text">
                        {/* Album Badge */}
                        <div
                          className="flex items-center gap-1.5 text-xs font-mono text-[#00f0ff]"
                          style={{ textShadow: '0 1px 4px #000, 0 0 8px #000' }}
                        >
                          <Folder className="w-3.5 h-3.5 text-[#00f0ff] flex-shrink-0" />
                          <span className="font-semibold uppercase tracking-wider truncate">{albumName}</span>
                          <span className="text-zinc-400">•</span>
                          <span className="text-zinc-300 font-mono">Reel {idx + 1}/{shorts.length}</span>
                        </div>

                        {/* Title */}
                        <h2
                          className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug line-clamp-2"
                          style={{ textShadow: '0 1px 4px #000, 0 0 8px #000' }}
                        >
                          {displayTitle}
                        </h2>

                        {/* File Name */}
                        {fileName && fileName.toLowerCase() !== displayTitle.toLowerCase() && (
                          <span
                            className="text-[11px] font-mono text-zinc-300 truncate block"
                            style={{ textShadow: '0 1px 4px #000, 0 0 8px #000' }}
                          >
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
                            className="h-full bg-[#00f0ff]"
                            style={{
                              width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                              filter: 'drop-shadow(0 0 6px rgba(0, 240, 255, 0.6))',
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
                        className="h-full bg-[#00f0ff]"
                        style={{
                          width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                          filter: 'drop-shadow(0 0 6px rgba(0, 240, 255, 0.6))',
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
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/[0.06] hover:bg-[#00f0ff]/10 backdrop-blur-md border border-white/[0.12] hover:border-[#00f0ff] flex items-center justify-center text-white hover:text-[#00f0ff] hover:shadow-[0_0_16px_rgba(0,240,255,0.45)] shadow-xl transition-all">
                      {isMuted ? (
                        <VolumeX className="w-5 h-5 text-zinc-400" />
                      ) : (
                        <Volume2 className="w-5 h-5 text-[#00f0ff]" />
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
                      className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full backdrop-blur-md border flex items-center justify-center shadow-xl transition-all ${
                        copiedLink
                          ? 'bg-[#00f0ff]/20 border-[#00f0ff] text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.5)]'
                          : 'bg-white/[0.06] hover:bg-[#00f0ff]/10 border-white/[0.12] hover:border-[#00f0ff] text-white hover:text-[#00f0ff] hover:shadow-[0_0_16px_rgba(0,240,255,0.45)]'
                      }`}
                    >
                      {copiedLink ? (
                        <Check className="w-5 h-5 text-[#00f0ff]" />
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
                      className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full backdrop-blur-md border flex items-center justify-center shadow-xl transition-all ${
                        downloadSuccess
                          ? 'bg-[#00f0ff]/20 border-[#00f0ff] text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.5)]'
                          : 'bg-white/[0.06] hover:bg-[#00f0ff]/10 border-white/[0.12] hover:border-[#00f0ff] text-white hover:text-[#00f0ff] hover:shadow-[0_0_16px_rgba(0,240,255,0.45)]'
                      }`}
                    >
                      {downloadSuccess ? (
                        <Check className="w-5 h-5 text-[#00f0ff]" />
                      ) : isDownloading ? (
                        <Loader2 className="w-5 h-5 text-[#00f0ff] animate-spin" />
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
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/[0.06] hover:bg-[#00f0ff]/10 border border-white/[0.12] hover:border-[#00f0ff] flex items-center justify-center text-white/80 hover:text-[#00f0ff] hover:shadow-[0_0_12px_rgba(0,240,255,0.4)] transition-all disabled:opacity-20 disabled:pointer-events-none active:scale-90 cursor-pointer"
                      title="Previous Reel (Up Arrow)"
                      aria-label="Previous Reel"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={handleScrollNext}
                      disabled={!shorts || activeIndex === shorts.length - 1}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/[0.06] hover:bg-[#00f0ff]/10 border border-white/[0.12] hover:border-[#00f0ff] flex items-center justify-center text-white/80 hover:text-[#00f0ff] hover:shadow-[0_0_12px_rgba(0,240,255,0.4)] transition-all disabled:opacity-20 disabled:pointer-events-none active:scale-90 cursor-pointer"
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
