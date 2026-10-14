/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  ChevronUp,
  ChevronDown,
  Download,
  VolumeX,
  Volume2,
  Repeat,
  Share2,
  Check,
  Play,
  Pause,
} from 'lucide-react';
import type { StageMediaItem } from '../types';
import { downloadMedia } from '../utils/downloadMedia';
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
import { safeEncodeUrl } from '../utils/mediaTypeDetector';

interface ShortsFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  shorts: StageMediaItem[];
  initialIndex: number;
}

export const ShortsFeedModal: React.FC<ShortsFeedModalProps> = ({
  isOpen,
  onClose,
  shorts,
  initialIndex,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [playRipple, setPlayRipple] = useState<'play' | 'pause' | null>(null);

  // Velocity Swipe-to-Dismiss State
  const [dismissOffsetY, setDismissOffsetY] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = useRef<{ time: number } | null>(null);

  const isNavigatingRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [prevProps, setPrevProps] = useState({ initialIndex, isOpen });
  if (prevProps.initialIndex !== initialIndex || prevProps.isOpen !== isOpen) {
    setPrevProps({ initialIndex, isOpen });
    setCurrentIndex(initialIndex);
    setDismissOffsetY(0);
    setIsPlaying(true);
  }

  const handleNext = useCallback(() => {
    if (currentIndex < shorts.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsPlaying(true);
      setDismissOffsetY(0);
    }
  }, [currentIndex, shorts.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsPlaying(true);
      setDismissOffsetY(0);
    }
  }, [currentIndex]);

  // Aggressive playback trigger and adjacent reel pre-warming
  useEffect(() => {
    if (!isOpen) return;
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
    // Pre-warm next and previous reels for instant swipe
    if (shorts[currentIndex + 1]?.url) prewarmVideoStream(shorts[currentIndex + 1].url);
    if (shorts[currentIndex - 1]?.url) prewarmVideoStream(shorts[currentIndex - 1].url);
  }, [currentIndex, isOpen, shorts]);

  // Keyboard navigation & Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
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
    return () => window.removeEventListener('keydown', handleKeyDown);
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
      onClose();
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
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) > 30) {
      if (isNavigatingRef.current) return;
      isNavigatingRef.current = true;
      if (e.deltaY > 0) {
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
      await downloadMedia(item.url, item.title || item.id);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setIsDownloading(false);
    }
  }, [currentIndex, shorts, isDownloading]);

  const handleShare = useCallback(() => {
    const item = shorts[currentIndex];
    if (!item) return;
    const shareUrl = window.location.origin + window.location.pathname + '#shorts';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }).catch(() => {});
    }
  }, [currentIndex, shorts]);

  const currentShort = shorts[currentIndex] || shorts[0];
  const secureUrl = safeEncodeUrl((currentShort?.url || '').replace(/^http:\/\//i, 'https://'));
  let streamUrl = secureUrl;
  if (streamUrl.includes('drive.google.com') && !streamUrl.includes('/preview')) {
    streamUrl = streamUrl.replace(/\/view(\?.*)?$/, '/preview');
  }

  const shortPoster = useMemo(() => {
    if (!currentShort) return '';
    const multiThumbs = resolveMultiFrameThumbnails(currentShort);
    const multiThumbsExt = resolveMultiFrameThumbnailsExt(currentShort);
    return (
      currentShort.thumbnails?.[0] ||
      multiThumbs[0] ||
      multiThumbsExt[0] ||
      getCachedThumbnailSync(currentShort.url) ||
      getCachedVideoPoster(currentShort.url) ||
      currentShort.thumbnail ||
      formatVideoPosterUrl(streamUrl, 0.5) ||
      ''
    );
  }, [currentShort, streamUrl]);

  if (!isOpen || !shorts.length) return null;

  const cleanTitle = currentShort?.title
    ? currentShort.title.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim()
    : 'Short Reel';
  const displayTitle = /^smartselect|videocapture|screenshot|photo\s+[a-z0-9]/i.test(cleanTitle)
    ? 'Vertical Short Reel'
    : cleanTitle;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shorts and Reels Player"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/97 backdrop-blur-2xl select-none"
      onClick={onClose}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: dismissOffsetY > 0 ? `translate3d(0, ${dismissOffsetY}px, 0) scale(${Math.max(0.85, 1 - dismissOffsetY / 1000)})` : 'none',
        transition: dismissOffsetY === 0 ? 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
      }}
    >
      {/* Top Floating Close Button */}
      <div
        className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 z-[130]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="p-2.5 rounded-full bg-black/70 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/10 transition-colors cursor-pointer shadow-xl backdrop-blur-md"
          title="Close Feed (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main 9:16 Vertical Reel Player Container */}
      <div className="relative flex items-center justify-center max-h-[92vh]">
        <div
          className="relative aspect-[9/16] h-[88vh] max-h-[820px] max-w-[460px] rounded-3xl overflow-hidden bg-black border border-white/[0.08] shadow-[0_25px_60px_rgba(0,0,0,0.95)] flex flex-col justify-between"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
        >
          {/* Native Video Element */}
          <div className="absolute inset-0 w-full h-full bg-black z-0">
            {/* Obsidian Typography Surface Backing behind video */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black select-none pointer-events-none z-0">
              {shortPoster ? (
                <img
                  src={shortPoster}
                  alt={displayTitle}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                    <Play className="w-5 h-5 text-zinc-300 fill-current ml-0.5" />
                  </div>
                  <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wide truncate max-w-xs">
                    {displayTitle}
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-1">
                    SARWARCYOU REELS
                  </span>
                </div>
              )}
            </div>

            {streamUrl.includes('huggingface.co') || streamUrl.endsWith('.mp4') ? (
              <video
                ref={videoRef}
                key={currentShort.id}
                src={streamUrl}
                poster={shortPoster || undefined}
                autoPlay
                preload="metadata"
                loop={isLooping}
                muted={isMuted}
                playsInline
                className="w-full h-full object-cover relative z-10"
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

          {/* Top Gradient Overlay & Indicator */}
          <div className="relative z-10 p-4 sm:p-5 bg-gradient-to-b from-black/80 via-black/30 to-transparent flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-300 uppercase">
                REELS STREAM
              </span>
            </div>
            <span className="text-[10px] font-mono font-semibold text-zinc-400">
              {(currentIndex + 1).toString().padStart(2, '0')} / {shorts.length.toString().padStart(2, '0')}
            </span>
          </div>

          {/* Bottom Gradient Overlay & Title */}
          <div className="relative z-10 px-4 sm:px-5 pb-5 pt-16 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none">
            <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wide truncate drop-shadow-md">
              {displayTitle}
            </h2>
            <div className="text-[9px] font-mono text-zinc-400 tracking-widest uppercase flex items-center gap-1.5 mt-1">
              <span>SWIPE UP/DOWN TO CYCLE • DOUBLE-TAP TO PAUSE</span>
            </div>

            {/* Micro Progress Bar */}
            <div className="w-full h-[2px] rounded-full bg-white/20 overflow-hidden mt-3">
              <div
                className="h-full bg-emerald-400 transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / shorts.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* ================= FLOATING GLASS ACTION COLUMN ================= */}
        <aside
          className="flex flex-col gap-3 ml-3 sm:ml-5 z-[130]"
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
            className={`p-3 rounded-2xl backdrop-blur-xl border transition-all cursor-pointer shadow-xl ${
              isMuted
                ? 'bg-black/60 border-white/10 text-zinc-400 hover:text-white'
                : 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          {/* Loop Toggle Button */}
          <button
            onClick={() => {
              setIsLooping((l) => !l);
            }}
            className={`p-3 rounded-2xl backdrop-blur-xl border transition-all cursor-pointer shadow-xl ${
              isLooping
                ? 'bg-zinc-800/80 border-white/20 text-white'
                : 'bg-black/60 border-white/10 text-zinc-500 hover:text-white'
            }`}
            title={isLooping ? 'Looping Active' : 'Looping Off'}
          >
            <Repeat className="w-5 h-5" />
          </button>

          {/* Direct Download Button */}
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={`p-3 rounded-2xl backdrop-blur-xl border transition-all cursor-pointer shadow-xl disabled:opacity-40 ${
              downloadSuccess
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                : 'bg-black/60 border-white/10 text-zinc-400 hover:text-white'
            }`}
            title="Download Reel"
          >
            {downloadSuccess ? (
              <Check className="w-5 h-5 text-emerald-400" />
            ) : (
              <Download className={`w-5 h-5 ${isDownloading ? 'animate-bounce' : ''}`} />
            )}
          </button>

          {/* Share Link Button */}
          <button
            onClick={handleShare}
            className={`p-3 rounded-2xl backdrop-blur-xl border transition-all cursor-pointer shadow-xl ${
              copiedLink
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                : 'bg-black/60 border-white/10 text-zinc-400 hover:text-white'
            }`}
            title="Share Reel Link"
          >
            {copiedLink ? <Check className="w-5 h-5 text-emerald-400" /> : <Share2 className="w-5 h-5" />}
          </button>

          <div className="w-full h-[1px] bg-white/10 my-1" />

          {/* Up & Down Step Chevrons */}
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="p-3 rounded-2xl bg-black/60 border border-white/10 text-zinc-400 hover:text-white disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer shadow-xl backdrop-blur-xl"
            title="Previous Reel (Up)"
          >
            <ChevronUp className="w-5 h-5" />
          </button>

          <button
            onClick={handleNext}
            disabled={currentIndex >= shorts.length - 1}
            className="p-3 rounded-2xl bg-black/60 border border-white/10 text-zinc-400 hover:text-white disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer shadow-xl backdrop-blur-xl"
            title="Next Reel (Down)"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </aside>
      </div>
    </div>
  );
};
