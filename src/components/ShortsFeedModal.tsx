import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Volume2, VolumeX, Share2, Check, AlertTriangle, Loader2, Play, Pause, Heart, FastForward } from 'lucide-react';
import type { StageMediaItem } from '../types';
import { getVideoStreamUrl, getDirectHfVideoUrl, getMediaUrl } from '../utils/imageUrlResolver';
import { getThumbnailUrl } from '../utils/thumbnailResolver';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { createShareableMediaUrl, copyToClipboard } from '../utils/urlRouter';
import { useBackButton } from '../utils/backButtonManager';
import { hapticLight, hapticMedium } from '../utils/hapticsManager';

export interface ShortsFeedModalProps {
  isOpen: boolean; onClose: () => void; shorts: StageMediaItem[]; initialIndex: number; onIndexChange?: (newIndex: number) => void;
}

export const ShortsFeedModal: React.FC<ShortsFeedModalProps> = ({
  isOpen, onClose, shorts, initialIndex = 0, onIndexChange,
}) => {
  useLockBodyScroll(isOpen);
  const [activeIndex, setActiveIndex] = useState(initialIndex || 0);
  const [isMuted, setIsMuted] = useState(false);
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [failedPermanently, setFailedPermanently] = useState<Record<number, boolean>>({});
  const [landscapeMap, setLandscapeMap] = useState<Record<number, boolean>>({});
  const [copiedLink, setCopiedLink] = useState(false);
  const [centerIcon, setCenterIcon] = useState<{ idx: number; type: 'play' | 'pause'; id: number } | null>(null);
  const [showControls, setShowControls] = useState(true);

  // Enhanced Shorts Experience States
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [is2XSpeed, setIs2XSpeed] = useState(false);
  const [likeHeart, setLikeHeart] = useState<{ id: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const failedItemsRef = useRef(new Set<string>());
  const hasInitialScrolledRef = useRef(false);
  const iconTimerRef = useRef<number | null>(null);
  const hideControlsTimerRef = useRef<number | null>(null);
  const lastTouchTimeRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const isSwipingRef = useRef<boolean>(false);

  // Gesture Engine Refs
  const isScrubbingRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null);
  const isHold2XRef = useRef(false);
  const lastTapTimeRef = useRef(0);
  const tapTimeoutRef = useRef<number | null>(null);

  // Web Escape and History Back navigation handler
  useBackButton(
    useCallback(() => {
      onClose();
      return true;
    }, [onClose]),
    isOpen
  );

  // Auto-hide HUD controls after 2.5s of inactivity while playing
  const scheduleAutoHide = useCallback(() => {
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    hideControlsTimerRef.current = window.setTimeout(() => {
      const currentVideo = videoRefs.current[activeIndex];
      if (currentVideo && !currentVideo.paused) {
        setShowControls(false);
      }
    }, 2500);
  }, [activeIndex]);

  // Initial cold mount controls display & auto-hide
  useEffect(() => {
    if (!hasInitialScrolledRef.current) {
      setShowControls(true);
      scheduleAutoHide();
    }
  }, [scheduleAutoHide]);

  // When swiping to a new short, strictly keep controls hidden while playing
  useEffect(() => {
    if (hasInitialScrolledRef.current) {
      setShowControls(false);
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    }
  }, [activeIndex]);

  // Desktop mouse movement reveals HUD and resets 2.5s idle timer (suppressed on touch gestures)
  const handleMouseMove = useCallback(() => {
    if (Date.now() - lastTouchTimeRef.current < 800) return;
    setShowControls(true);
    scheduleAutoHide();
  }, [scheduleAutoHide]);

  const handleTouchStart = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    touchStartYRef.current = e.touches[0].clientY;
    isSwipingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    if (Math.abs(e.touches[0].clientY - touchStartYRef.current) > 10) {
      isSwipingRef.current = true;
    }
  };

  // Screen tap handler:
  // - If swiping: ignore tap
  // - If controls are hidden: reveals controls on ongoing short and starts auto-hide timer
  // - If controls are visible: pauses (stops) video and keeps controls visible
  const handleScreenTap = useCallback((idx: number) => {
    if (isSwipingRef.current) {
      isSwipingRef.current = false;
      return;
    }
    const v = videoRefs.current[idx];
    if (!v) return;

    if (!showControls) {
      setShowControls(true);
      scheduleAutoHide();
      return;
    }

    if (v.paused) {
      v.play().catch(() => {});
      setCenterIcon({ idx, type: 'play', id: Date.now() });
      hapticLight();
      scheduleAutoHide();
    } else {
      v.pause();
      setCenterIcon({ idx, type: 'pause', id: Date.now() });
      hapticLight();
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
      setShowControls(true);
    }

    if (iconTimerRef.current) clearTimeout(iconTimerRef.current);
    iconTimerRef.current = window.setTimeout(() => setCenterIcon(null), 700);
  }, [showControls, scheduleAutoHide]);

  // Video Pointer Engine: Double-tap to Like, Hold-to-2x Speed
  const handleVideoPointerDown = useCallback((_e: React.PointerEvent, idx: number) => {
    if (idx !== activeIndex) return;
    const now = Date.now();

    // Double-tap detection (< 280ms)
    if (now - lastTapTimeRef.current < 280) {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      lastTapTimeRef.current = 0;

      const item = shorts[activeIndex];
      if (item) {
        setLikeHeart({ id: Date.now() });
        setTimeout(() => setLikeHeart(null), 850);
      }
      return;
    }
    lastTapTimeRef.current = now;

    // Hold-to-2x speed gesture trigger (> 280ms)
    holdTimerRef.current = window.setTimeout(() => {
      const v = videoRefs.current[activeIndex];
      if (v && !v.paused) {
        isHold2XRef.current = true;
        setIs2XSpeed(true);
        v.playbackRate = 2.0;
        hapticMedium();
      }
    }, 280);
  }, [activeIndex, shorts]);

  const handleVideoPointerUp = useCallback((_e: React.PointerEvent, idx: number) => {
    if (idx !== activeIndex) return;

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    // If hold-2x was engaged, restore normal speed and bypass single tap
    if (isHold2XRef.current) {
      isHold2XRef.current = false;
      setIs2XSpeed(false);
      const v = videoRefs.current[activeIndex];
      if (v) {
        v.playbackRate = 1.0;
        hapticLight();
      }
      lastTapTimeRef.current = 0;
      return;
    }

    // Schedule single tap with short delay to allow double-tap detection
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = window.setTimeout(() => {
      handleScreenTap(idx);
      tapTimeoutRef.current = null;
    }, 250);
  }, [activeIndex, handleScreenTap]);

  const handleVideoPointerCancel = useCallback((idx: number) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isHold2XRef.current) {
      isHold2XRef.current = false;
      setIs2XSpeed(false);
      const v = videoRefs.current[idx];
      if (v) v.playbackRate = 1.0;
    }
  }, []);

  // Timeline scrub handling
  const handleScrubSeek = useCallback((clientX: number, target: HTMLElement, idx: number) => {
    const rect = target.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const v = videoRefs.current[idx];
    if (v && v.duration) {
      const targetTime = ratio * v.duration;
      v.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  }, []);

  const handleScrubPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, idx: number) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    isScrubbingRef.current = true;
    hapticLight();
    handleScrubSeek(e.clientX, e.currentTarget, idx);
  }, [handleScrubSeek]);

  const handleScrubPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>, idx: number) => {
    if (!isScrubbingRef.current) return;
    e.stopPropagation();
    handleScrubSeek(e.clientX, e.currentTarget, idx);
  }, [handleScrubSeek]);

  const handleScrubPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current) return;
    e.stopPropagation();
    isScrubbingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
    hapticLight();
  }, []);

  // Break the infinite fallback loop (Single-shot fallback per itemKey)
  const handleVideoError = useCallback((idx: number, item: StageMediaItem, currentSrc: string) => {
    const itemKey = item.id || item.url || item.name || String(idx);
    const directHfUrl = getDirectHfVideoUrl(item);
    if (!failedItemsRef.current.has(itemKey)) {
      failedItemsRef.current.add(itemKey);
      if (directHfUrl && currentSrc !== directHfUrl) {
        setOverrides((prev) => ({ ...prev, [idx]: directHfUrl }));
        const v = videoRefs.current[idx];
        if (v) { v.src = directHfUrl; v.load(); }
        return;
      }
    }
    setFailedPermanently((prev) => (prev[idx] ? prev : { ...prev, [idx]: true }));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        if (e.cancelable) e.preventDefault();
        slideRefs.current[activeIndex + 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        if (e.cancelable) e.preventDefault();
        slideRefs.current[activeIndex - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (e.key === 'm' || e.key === 'M') setIsMuted((prev) => !prev);
      if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
        if (e.cancelable) e.preventDefault();
        const v = videoRefs.current[activeIndex];
        if (!v) return;
        if (v.paused) {
          v.play().catch(() => {});
          setCenterIcon({ idx: activeIndex, type: 'play', id: Date.now() });
          scheduleAutoHide();
        } else {
          v.pause();
          setCenterIcon({ idx: activeIndex, type: 'pause', id: Date.now() });
          if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
          setShowControls(true);
        }
        if (iconTimerRef.current) clearTimeout(iconTimerRef.current);
        iconTimerRef.current = window.setTimeout(() => setCenterIcon(null), 700);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, activeIndex, onClose, scheduleAutoHide]);

  // Initial index accurate scrolling and playback on mount
  useEffect(() => {
    if (!isOpen || !containerRef.current || shorts.length === 0) return;
    hasInitialScrolledRef.current = false;
    const targetIdx = Math.max(0, Math.min(initialIndex || 0, shorts.length - 1));
    setActiveIndex(targetIdx);

    const targetElement =
      containerRef.current.querySelector<HTMLElement>(`[data-index="${targetIdx}"]`) ||
      slideRefs.current[targetIdx];
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'instant', block: 'center' });
    }

    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i !== targetIdx) {
        v.pause();
        v.currentTime = 0;
      } else {
        v.muted = isMuted;
        v.play().catch(() => {
          v.muted = true;
          v.play().catch(() => {});
        });
      }
    });

    const timer = setTimeout(() => {
      hasInitialScrolledRef.current = true;
    }, 150);
    return () => clearTimeout(timer);
  }, [isOpen, initialIndex, shorts.length]);

  // Clean Native CSS Scroll-Snap Observer (threshold: 0.6)
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (!hasInitialScrolledRef.current) return;
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const idxAttr = entry.target.getAttribute('data-reel-index');
          if (idxAttr !== null) {
            const idx = parseInt(idxAttr, 10);
            if (!isNaN(idx)) {
              setActiveIndex(idx);
              onIndexChange?.(idx);
              // Swiping up/down to next short: strictly keep controls hidden
              setShowControls(false);
              if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
              videoRefs.current.forEach((v, i) => {
                if (!v) return;
                if (i !== idx) { v.pause(); v.currentTime = 0; }
                else { v.muted = isMuted; v.play().catch(() => { v.muted = true; v.play().catch(() => {}); }); }
              });
            }
          }
        }
      });
    }, { root: containerRef.current, threshold: 0.6 });
    slideRefs.current.forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [isOpen, shorts.length, onIndexChange, isMuted]);

  const handleShare = async () => {
    const currentItem = shorts[activeIndex];
    if (!currentItem) return;
    const shareUrl = createShareableMediaUrl(currentItem, currentItem.category || 'shorts');
    if (await copyToClipboard(shareUrl)) { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }
  };

  if (!isOpen) return null;
  if (!shorts || shorts.length === 0) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md text-white p-6 select-none font-serif">
        <Loader2 className="w-10 h-10 animate-spin text-neutral-400 mb-4" />
        <p className="text-sm text-neutral-400 mb-6">No shorts available in this archive.</p>
        <button type="button" onClick={onClose} className="px-5 py-2 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-serif transition-all cursor-pointer active:scale-95">
          Return to Explorer
        </button>
      </div>
    );
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      className="fixed inset-0 z-[9999] bg-black md:bg-neutral-950/70 md:backdrop-blur-md flex flex-col items-center select-none overflow-hidden font-serif"
    >
      {/* Top HUD Controls - Auto-hides on mobile during playback */}
      <header
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className={`absolute top-0 inset-x-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <span
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="text-xs font-mono font-bold tracking-wider px-3 py-1 rounded-full bg-black/80 text-[#ccff00] border border-[#ccff00]/30 backdrop-blur-md shadow-[0_0_10px_rgba(204,255,0,0.15)]"
        >
          {activeIndex + 1} / {shorts.length}
        </span>
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted((prev) => !prev);
              hapticLight();
            }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            className="w-9 h-9 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/80 flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleShare();
            }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            className="w-9 h-9 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/80 flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="Share Short"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            className="w-9 h-9 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/80 flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Pure Native CSS Scroll-Snap Feed Container */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth overscroll-y-contain flex flex-col items-center no-scrollbar"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {shorts.map((item, idx) => {
          if (!item) return null;
          const streamUrl = overrides[idx] || getVideoStreamUrl(item) || getDirectHfVideoUrl(item);
          const posterUrl = getThumbnailUrl(item) || (item.thumbnail ? getMediaUrl(item.thumbnail) : '');
          const isLandscape = landscapeMap[idx];

          return (
            <div
              key={item.id || idx}
              ref={(el) => { slideRefs.current[idx] = el; }}
              data-index={idx}
              data-reel-index={idx}
              className="w-full h-screen shrink-0 snap-start snap-always relative flex items-center justify-center p-0 md:p-4 bg-transparent"
            >
              <div
                onPointerDown={(e) => handleVideoPointerDown(e, idx)}
                onPointerUp={(e) => handleVideoPointerUp(e, idx)}
                onPointerCancel={() => handleVideoPointerCancel(idx)}
                className={`relative w-full h-full flex items-center justify-center transition-all duration-300 cursor-pointer select-none overflow-hidden ${
                  isLandscape
                    ? 'w-full md:aspect-[16/9] md:max-w-[85vw] md:h-[80vh] md:max-h-[85vh] md:bg-neutral-950/80 md:backdrop-blur-xl md:border md:border-neutral-800 md:shadow-2xl md:rounded-lg'
                    : 'w-full md:max-w-[480px] h-full md:max-h-[92vh] md:bg-neutral-950/80 md:backdrop-blur-xl md:border md:border-neutral-800 md:shadow-2xl md:rounded-lg'
                }`}
              >
                {!failedPermanently[idx] ? (
                  <>
                    <video
                      ref={(el) => { videoRefs.current[idx] = el; }}
                      src={streamUrl}
                      poster={posterUrl || undefined}
                      playsInline
                      loop
                      muted={isMuted}
                      preload={Math.abs(idx - activeIndex) <= 1 ? 'auto' : 'none'}
                      className="w-full h-full object-contain rounded-none md:rounded-lg shadow-2xl bg-black md:bg-transparent"
                      onLoadedMetadata={(e) => {
                        const v = e.currentTarget;
                        if (v.videoWidth && v.videoHeight) {
                          const isWide = v.videoWidth > v.videoHeight;
                          setLandscapeMap((prev) => (prev[idx] === isWide ? prev : { ...prev, [idx]: isWide }));
                        }
                        if (idx === activeIndex) {
                          setDuration(v.duration || 0);
                        }
                      }}
                      onTimeUpdate={(e) => {
                        if (idx === activeIndex && !isScrubbingRef.current) {
                          setCurrentTime(e.currentTarget.currentTime);
                        }
                      }}
                      onPause={() => {
                        if (idx === activeIndex) {
                          if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
                          setShowControls(true);
                        }
                      }}
                      onPlay={() => {
                        if (idx === activeIndex) {
                          scheduleAutoHide();
                        }
                      }}
                      onError={() => handleVideoError(idx, item, streamUrl)}
                    />

                    {/* 2X Speed HUD Pill */}
                    {is2XSpeed && idx === activeIndex && (
                      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-full bg-black/85 border border-amber-400/60 text-amber-300 font-mono text-xs font-bold tracking-widest flex items-center gap-1.5 shadow-[0_0_20px_rgba(245,158,11,0.5)] animate-pulse pointer-events-none">
                        <span>2X SPEED</span>
                        <FastForward className="w-3.5 h-3.5 fill-current" />
                      </div>
                    )}

                    {/* Double-tap Like Heart Burst */}
                    {likeHeart && idx === activeIndex && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40 animate-out fade-out zoom-out duration-700">
                        <div className="w-24 h-24 rounded-full bg-red-500/20 backdrop-blur-md flex items-center justify-center border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.6)]">
                          <Heart className="w-14 h-14 text-red-500 fill-red-500" />
                        </div>
                      </div>
                    )}

                    {/* Interactive glowing scrub timeline */}
                    {idx === activeIndex && duration > 0 && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => handleScrubPointerDown(e, idx)}
                        onPointerMove={(e) => handleScrubPointerMove(e, idx)}
                        onPointerUp={handleScrubPointerUp}
                        onPointerCancel={handleScrubPointerUp}
                        className="absolute bottom-0 inset-x-0 h-6 flex items-end pb-1.5 px-3 z-30 cursor-pointer group"
                      >
                        <div className="w-full h-1 group-hover:h-2 bg-white/20 rounded-full overflow-hidden transition-all duration-150 relative">
                          <div
                            className="h-full bg-[#ccff00] shadow-[0_0_8px_rgba(204,255,0,0.6)] rounded-full transition-[width] duration-75"
                            style={{ width: `${Math.min(100, Math.max(0, (currentTime / (duration || 1)) * 100))}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {centerIcon && centerIcon.idx === idx && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-out fade-out zoom-out duration-700">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/70 backdrop-blur-md flex items-center justify-center text-white border border-neutral-700 shadow-2xl">
                          {centerIcon.type === 'play' ? (
                            <Play className="w-8 h-8 sm:w-10 sm:h-10 text-white fill-current ml-1" />
                          ) : (
                            <Pause className="w-8 h-8 sm:w-10 sm:h-10 text-white fill-current" />
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full aspect-[9/16] max-h-[85vh] flex flex-col items-center justify-center bg-neutral-950/95 rounded-lg p-6 text-center border border-neutral-800">
                    <div className="w-12 h-12 rounded-full bg-neutral-900 border border-neutral-700 flex items-center justify-center text-neutral-300 mb-3 shadow">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-normal text-neutral-200 mb-1 font-serif">Video Unavailable</h3>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ShortsFeedModal;
