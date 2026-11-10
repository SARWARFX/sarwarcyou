import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Share2,
  Heart,
  MessageCircle,
  Play,
  Pause,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Check,
  Music2,
} from 'lucide-react';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { useBackButton } from '../utils/backButtonManager';
import { hapticLight, hapticMedium } from '../utils/hapticsManager';
import { copyToClipboard } from '../utils/urlRouter';

export interface CelebrityReelItem {
  id: string;
  actressId: string;
  actressSlug: string;
  actressName: string;
  region: string;
  country: string;
  industry: string;
  title: string;
  sound: string;
  videoUrl: string;
  thumbnail: string;
  duration: string;
  views: string;
  likes: string;
  comments: string;
  shares: string;
  verified: boolean;
  aspect: string;
  publishedAt: string;
  timestamp: number;
  channel: string;
  tags?: string[];
}

export interface CelebrityReelPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  reels: CelebrityReelItem[];
  initialIndex: number;
  onIndexChange?: (newIndex: number) => void;
}

export const CelebrityReelPlayerModal: React.FC<CelebrityReelPlayerModalProps> = ({
  isOpen,
  onClose,
  reels,
  initialIndex = 0,
  onIndexChange,
}) => {
  useLockBodyScroll(isOpen);

  const [activeIndex, setActiveIndex] = useState(initialIndex || 0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [likeCountOverrides, setLikeCountOverrides] = useState<Record<string, number>>({});
  const [copiedLink, setCopiedLink] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showCenterIcon, setShowCenterIcon] = useState<'play' | 'pause' | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const touchStartYRef = useRef(0);
  const touchEndYRef = useRef(0);
  const wheelLockRef = useRef(false);
  const centerIconTimerRef = useRef<number | null>(null);

  // Sync initialIndex when modal opens
  useEffect(() => {
    if (isOpen) {
      const idx = Math.max(0, Math.min(initialIndex, reels.length - 1));
      setActiveIndex(idx);
      setIsPlaying(true);
      setTimeout(() => {
        scrollToIndex(idx, 'auto');
      }, 50);
    }
  }, [isOpen, initialIndex, reels.length]);

  // Back button handling
  useBackButton(
    useCallback(() => {
      onClose();
      return true;
    }, [onClose]),
    isOpen
  );

  // Programmatic scroll to index
  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth') => {
      const el = containerRef.current;
      if (!el) return;
      const targetY = index * el.clientHeight;
      el.scrollTo({ top: targetY, behavior });
    },
    []
  );

  // Switch to next or previous reel
  const goToNext = useCallback(() => {
    if (activeIndex < reels.length - 1) {
      hapticLight();
      const nextIdx = activeIndex + 1;
      setActiveIndex(nextIdx);
      onIndexChange?.(nextIdx);
      scrollToIndex(nextIdx);
    }
  }, [activeIndex, reels.length, onIndexChange, scrollToIndex]);

  const goToPrev = useCallback(() => {
    if (activeIndex > 0) {
      hapticLight();
      const prevIdx = activeIndex - 1;
      setActiveIndex(prevIdx);
      onIndexChange?.(prevIdx);
      scrollToIndex(prevIdx);
    }
  }, [activeIndex, onIndexChange, scrollToIndex]);

  // Handle intersection/scroll snapping detection
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const itemHeight = el.clientHeight;
    if (itemHeight <= 0) return;
    const newIdx = Math.round(el.scrollTop / itemHeight);
    if (newIdx !== activeIndex && newIdx >= 0 && newIdx < reels.length) {
      setActiveIndex(newIdx);
      onIndexChange?.(newIdx);
      hapticLight();
    }
  }, [activeIndex, reels.length, onIndexChange]);

  // Play/pause management on active index change
  useEffect(() => {
    if (!isOpen) return;

    videoRefs.current.forEach((video, idx) => {
      if (!video) return;
      if (idx === activeIndex) {
        video.muted = isMuted;
        video.currentTime = 0;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => setIsPlaying(true))
            .catch(() => {
              // Autoplay with audio was blocked; fallback to muted
              video.muted = true;
              setIsMuted(true);
              video.play().then(() => setIsPlaying(true)).catch(() => {});
            });
        }
      } else {
        video.pause();
      }
    });

    // Update URL query param to reflect current reel (?id=reels&v=<id>)
    const currentReel = reels[activeIndex];
    if (currentReel && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('id', 'reels');
      url.searchParams.set('v', currentReel.id);
      window.history.replaceState({}, '', url.toString());
    }
  }, [activeIndex, isOpen, isMuted, reels]);

  // Video progress updater
  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const vid = e.currentTarget;
    if (vid.duration) {
      setProgress((vid.currentTime / vid.duration) * 100);
    }
  }, []);

  // Center toggle icon trigger
  const triggerCenterIcon = (type: 'play' | 'pause') => {
    setShowCenterIcon(type);
    if (centerIconTimerRef.current) clearTimeout(centerIconTimerRef.current);
    centerIconTimerRef.current = window.setTimeout(() => {
      setShowCenterIcon(null);
    }, 600);
  };

  // Toggle Play / Pause
  const togglePlayPause = useCallback(() => {
    const activeVideo = videoRefs.current[activeIndex];
    if (!activeVideo) return;

    if (activeVideo.paused) {
      activeVideo.play().then(() => {
        setIsPlaying(true);
        triggerCenterIcon('play');
        hapticLight();
      }).catch(() => {});
    } else {
      activeVideo.pause();
      setIsPlaying(false);
      triggerCenterIcon('pause');
      hapticLight();
    }
  }, [activeIndex]);

  // Toggle Mute / Unmute
  const toggleMute = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    hapticMedium();
    setIsMuted((prev) => {
      const next = !prev;
      const activeVideo = videoRefs.current[activeIndex];
      if (activeVideo) activeVideo.muted = next;
      return next;
    });
  }, [activeIndex]);

  // Like Toggle
  const toggleLike = useCallback((reelId: string, baseLikesStr: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    hapticLight();
    setLikedMap((prev) => {
      const isLiked = !!prev[reelId];
      const nextLiked = !isLiked;

      // Parse base likes
      let numeric = 10000;
      if (baseLikesStr.endsWith('M')) numeric = parseFloat(baseLikesStr) * 1000000;
      else if (baseLikesStr.endsWith('K')) numeric = parseFloat(baseLikesStr) * 1000;
      else numeric = parseInt(baseLikesStr, 10) || 1000;

      const currentCount = likeCountOverrides[reelId] !== undefined ? likeCountOverrides[reelId] : numeric;
      setLikeCountOverrides((cPrev) => ({
        ...cPrev,
        [reelId]: nextLiked ? currentCount + 1 : Math.max(0, currentCount - 1),
      }));

      return { ...prev, [reelId]: nextLiked };
    });
  }, [likeCountOverrides]);

  // Share Reel Deep Link
  const handleShare = useCallback((reel: CelebrityReelItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    hapticMedium();
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('id', 'reels');
    url.searchParams.set('v', reel.id);

    copyToClipboard(url.toString());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'm') {
        e.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, goToNext, goToPrev, togglePlayPause, toggleMute]);

  // Desktop Mouse Wheel navigation with threshold lock
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (wheelLockRef.current) return;
    if (Math.abs(e.deltaY) > 35) {
      wheelLockRef.current = true;
      if (e.deltaY > 0) goToNext();
      else goToPrev();
      setTimeout(() => {
        wheelLockRef.current = false;
      }, 400);
    }
  }, [goToNext, goToPrev]);

  // Touch Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    const deltaY = touchStartYRef.current - touchEndYRef.current;
    if (Math.abs(deltaY) > 55) {
      if (deltaY > 0) goToNext();
      else goToPrev();
    }
  };

  if (!isOpen || !reels || reels.length === 0) return null;

  const currentReel = reels[activeIndex] || reels[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-2xl flex items-center justify-center select-none overflow-hidden"
    >
      {/* Background ambient lighting based on theme */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_center,_#ccff00_0%,_transparent_65%)]" />

      {/* Main Reel Viewport Container (9:16 aspect ratio box) */}
      <div
        className="relative w-full h-full max-w-[480px] sm:h-[92vh] sm:rounded-3xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.95)] border border-white/10 flex flex-col bg-[#050505]"
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* ========================================================================= */}
        {/* TOP FLOATING HUD                                                         */}
        {/* ========================================================================= */}
        <div className="absolute top-0 inset-x-0 z-30 p-4 sm:p-5 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">
          {/* Actress / Channel Pill */}
          <div className="flex items-center gap-2.5 pointer-events-auto">
            <div className="w-8 h-8 rounded-full ring-2 ring-[#ccff00] overflow-hidden bg-neutral-900 shrink-0">
              <img
                src={currentReel.thumbnail}
                alt={currentReel.actressName}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-['Space_Grotesk'] font-bold text-xs sm:text-sm text-white drop-shadow">
                  {currentReel.actressName}
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#ccff00] fill-[#ccff00]/20" />
              </div>
              <span className="text-[10px] font-mono text-neutral-400 tracking-wider uppercase">
                {currentReel.region} • {currentReel.industry}
              </span>
            </div>
          </div>

          {/* Top Right Controls: Counter, Mute, Close */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <span className="px-2 py-0.5 rounded-full bg-black/60 border border-white/15 text-[11px] font-mono text-neutral-300">
              {activeIndex + 1}/{reels.length}
            </span>

            <button
              type="button"
              onClick={toggleMute}
              className="p-2 rounded-full bg-black/60 border border-white/15 text-white hover:text-[#ccff00] hover:border-[#ccff00]/50 transition-all cursor-pointer backdrop-blur-md"
              title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-neutral-300" /> : <Volume2 className="w-4 h-4 text-[#ccff00]" />}
            </button>

            <button
              type="button"
              onClick={() => {
                hapticMedium();
                onClose();
              }}
              className="p-2 rounded-full bg-black/60 border border-white/15 text-white hover:bg-white/20 transition-all cursor-pointer backdrop-blur-md"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VERTICAL SCROLL SNAP FEED                                                */}
        {/* ========================================================================= */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="relative flex-1 w-full h-full overflow-y-scroll snap-y snap-mandatory space-scrollbar"
          style={{ scrollSnapType: 'y mandatory', scrollBehavior: 'smooth' }}
        >
          {reels.map((reel, idx) => {
            const isCurrent = idx === activeIndex;
            const isLiked = !!likedMap[reel.id];
            const likeDisplay = likeCountOverrides[reel.id] !== undefined
              ? (likeCountOverrides[reel.id] >= 1000000 ? `${(likeCountOverrides[reel.id] / 1000000).toFixed(1)}M` : `${Math.round(likeCountOverrides[reel.id] / 1000)}K`)
              : reel.likes;

            return (
              <div
                key={reel.id}
                className="relative w-full h-full snap-start snap-always shrink-0 flex items-center justify-center bg-black overflow-hidden"
                style={{ height: '100%' }}
                onClick={togglePlayPause}
              >
                {/* 9:16 Video Stage */}
                <video
                  ref={(el) => {
                    videoRefs.current[idx] = el;
                  }}
                  src={reel.videoUrl}
                  poster={reel.thumbnail}
                  loop
                  playsInline
                  muted={isMuted}
                  preload={Math.abs(idx - activeIndex) <= 1 ? 'auto' : 'none'}
                  onTimeUpdate={isCurrent ? handleTimeUpdate : undefined}
                  className="w-full h-full object-cover cursor-pointer"
                />

                {/* Subtle Obsidian Dark Gradient Overlay for Readability */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/85 pointer-events-none" />

                {/* Center Play/Pause Kinetic Feedback Icon */}
                {isCurrent && (showCenterIcon || !isPlaying) && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <div className="w-16 h-16 rounded-full bg-black/70 backdrop-blur-md border border-[#ccff00]/60 flex items-center justify-center text-[#ccff00] transition-transform shadow-lg">
                      {(!isPlaying || showCenterIcon === 'pause') ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                    </div>
                  </div>
                )}

                {/* ========================================================================= */}
                {/* RIGHT FLOATING ACTION BAR                                                 */}
                {/* ========================================================================= */}
                <div
                  className="absolute right-3 bottom-24 z-20 flex flex-col items-center gap-4 text-white"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Up Arrow Desktop helper */}
                  <button
                    type="button"
                    onClick={goToPrev}
                    disabled={activeIndex === 0}
                    className="hidden sm:flex p-2 rounded-full bg-black/60 border border-white/10 hover:border-[#ccff00] text-neutral-300 hover:text-[#ccff00] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer backdrop-blur-md"
                    title="Previous (↑)"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>

                  {/* Like Button */}
                  <button
                    type="button"
                    onClick={(e) => toggleLike(reel.id, reel.likes, e)}
                    className="flex flex-col items-center gap-1 group cursor-pointer"
                  >
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${
                        isLiked
                          ? 'bg-rose-600/90 text-white scale-110 shadow-[0_0_15px_rgba(225,29,72,0.6)]'
                          : 'bg-black/60 border border-white/15 text-white group-hover:scale-105'
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                    </div>
                    <span className="text-[11px] font-mono font-bold text-neutral-200">
                      {likeDisplay}
                    </span>
                  </button>

                  {/* Comments Count */}
                  <div className="flex flex-col items-center gap-1 cursor-default">
                    <div className="w-11 h-11 rounded-full bg-black/60 border border-white/15 flex items-center justify-center text-white backdrop-blur-md">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-mono font-bold text-neutral-200">
                      {reel.comments}
                    </span>
                  </div>

                  {/* Share Button */}
                  <button
                    type="button"
                    onClick={(e) => handleShare(reel, e)}
                    className="flex flex-col items-center gap-1 group cursor-pointer"
                    title="Copy Share Link"
                  >
                    <div className="w-11 h-11 rounded-full bg-black/60 border border-white/15 flex items-center justify-center text-white backdrop-blur-md group-hover:border-[#ccff00] group-hover:text-[#ccff00] group-hover:scale-105 transition-all">
                      {copiedLink ? <Check className="w-5 h-5 text-[#ccff00]" /> : <Share2 className="w-5 h-5" />}
                    </div>
                    <span className="text-[11px] font-mono font-bold text-neutral-200">
                      {copiedLink ? 'Copied!' : reel.shares}
                    </span>
                  </button>

                  {/* Down Arrow Desktop helper */}
                  <button
                    type="button"
                    onClick={goToNext}
                    disabled={activeIndex === reels.length - 1}
                    className="hidden sm:flex p-2 rounded-full bg-black/60 border border-white/10 hover:border-[#ccff00] text-neutral-300 hover:text-[#ccff00] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer backdrop-blur-md"
                    title="Next (↓)"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* ========================================================================= */}
                {/* BOTTOM METADATA & SOUND BANNER                                            */}
                {/* ========================================================================= */}
                <div
                  className="absolute bottom-4 inset-x-4 z-20 flex flex-col gap-2 pointer-events-none pr-16"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#ccff00]/20 border border-[#ccff00]/40 text-[#ccff00] text-[10px] font-mono font-bold uppercase tracking-wider">
                      {reel.views} VIEWS
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white/10 border border-white/15 text-neutral-300 text-[10px] font-mono uppercase tracking-wider">
                      9:16 UHD
                    </span>
                  </div>

                  <h2 className="font-['Space_Grotesk'] font-bold text-sm sm:text-base text-white leading-snug drop-shadow-md line-clamp-2">
                    {reel.title}
                  </h2>

                  {/* Soundwave Track Marquee */}
                  <div className="flex items-center gap-2 text-xs text-neutral-300 font-mono overflow-hidden">
                    <div className="flex items-center gap-0.5 shrink-0">
                      <span className="w-0.5 h-3 bg-[#ccff00] rounded animate-pulse" />
                      <span className="w-0.5 h-4 bg-[#ccff00] rounded animate-pulse delay-75" />
                      <span className="w-0.5 h-2 bg-[#ccff00] rounded animate-pulse delay-150" />
                    </div>
                    <Music2 className="w-3.5 h-3.5 text-[#ccff00] shrink-0" />
                    <span className="truncate text-[11px] text-neutral-300">
                      {reel.sound}
                    </span>
                  </div>
                </div>

                {/* Bottom Scrubbing Progress Bar */}
                {isCurrent && (
                  <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20 z-30">
                    <div
                      className="h-full bg-[#ccff00] transition-all duration-150"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
