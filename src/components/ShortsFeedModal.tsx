import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AlertTriangle, Loader2, Heart, FastForward } from 'lucide-react';
import type { StageMediaItem } from '../types';
import { getVideoStreamUrl, getDirectHfVideoUrl, getMediaUrl } from '../utils/imageUrlResolver';
import { getThumbnailUrl } from '../utils/thumbnailResolver';
import { addCachedMediaItem } from '../utils/cachedMediaManager';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

import { useBackButton } from '../utils/backButtonManager';
import { hapticLight, hapticMedium } from '../utils/hapticsManager';
import { getMediaShortId, updateBrowserUrl } from '../utils/urlRouter';
import { HeaderBrandLogo } from './updater/HeaderBrandLogo';
import {
  LaserCloseIcon,
  LaserPrevIcon,
  LaserNextIcon,
  LaserVolumeIcon,
  LaserPlayIcon,
  LaserPauseIcon,
} from './brand/LaserIcons';
import { getGlobalAudioMuted } from '../utils/audioMuteManager';
import { acquirePlayerWakeLock, releasePlayerWakeLock } from '../utils/keepAwakeManager';
import {
  subscribeBatteryState,
  subscribeUrgentPlayback,
  requestUrgentPlayback,
  resetUrgentPlayback,
} from '../utils/batteryManager';
import type { BatteryState } from '../utils/batteryManager';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

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
  initialIndex = 0,
  onIndexChange,
}) => {
  useLockBodyScroll(isOpen);
  const [activeIndex, setActiveIndex] = useState(initialIndex || 0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState(() => getGlobalAudioMuted());
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [failedPermanently, setFailedPermanently] = useState<Record<number, boolean>>({});
  const [landscapeMap, setLandscapeMap] = useState<Record<number, boolean>>({});
  const [aspectRatioMap, setAspectRatioMap] = useState<Record<number, number>>({});

  const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | null>(null);

  // Enhanced Shorts Experience States
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [is2XSpeed, setIs2XSpeed] = useState(false);
  const [likeHeart, setLikeHeart] = useState<{ id: number } | null>(null);

  // Hardware Battery Safety Brake (< 5% on battery)
  const [batteryState, setBatteryState] = useState<BatteryState>({
    isSupported: false,
    level: 100,
    charging: true,
  });
  const [isUrgentPlaybackOverride, setIsUrgentPlaybackOverride] = useState(false);

  useEffect(() => {
    const unsubState = subscribeBatteryState((state) => {
      setBatteryState(state);
      if (state.isSupported && !state.charging && state.level < 5 && !isUrgentPlaybackOverride) {
        videoRefs.current.forEach((v) => {
          if (v && !v.paused) {
            v.pause();
          }
        });
        setIsPlaying(false);
      }
    });

    const unsubUrgent = subscribeUrgentPlayback((granted) => {
      if (granted) {
        setIsUrgentPlaybackOverride(true);
      }
    });

    return () => {
      unsubState();
      unsubUrgent();
    };
  }, [isUrgentPlaybackOverride]);

  // When modal closes or short item changes, reset emergency override
  useEffect(() => {
    setIsUrgentPlaybackOverride(false);
    resetUrgentPlayback();
  }, [isOpen, activeIndex]);

  // Instantly cache opened short across any network (Wi-Fi or cellular)
  useEffect(() => {
    if (isOpen && shorts && shorts[activeIndex]) {
      addCachedMediaItem(shorts[activeIndex]);
    }
  }, [isOpen, activeIndex, shorts]);

  const isBatteryBrakeActive =
    batteryState.isSupported && !batteryState.charging && batteryState.level < 5 && !isUrgentPlaybackOverride;

  const handleUrgentPlay = useCallback(() => {
    setIsUrgentPlaybackOverride(true);
    requestUrgentPlayback();
    const v = videoRefs.current[activeIndex];
    if (v) {
      v.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [activeIndex]);

  // Seamless Zero-Gap Stream items list of other shorts (infinite loop at 260s Ultra Calm speed)
  const streamItems = useMemo(() => {
    if (!shorts || shorts.length === 0) return [];
    let list = shorts.map((item, idx) => ({ item, originalIndex: idx }));
    while (list.length < 30) {
      list = [...list, ...shorts.map((item, idx) => ({ item, originalIndex: idx }))];
    }
    return [...list, ...list];
  }, [shorts]);

  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const failedItemsRef = useRef(new Set<string>());
  const hasInitialScrolledRef = useRef(false);
  const backdropClickStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointerStartXRef = useRef<number>(0);
  const pointerStartYRef = useRef<number>(0);

  // Desktop vs Mobile layout detection and Screen Orientation detection
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [isScreenLandscape, setIsScreenLandscape] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false
  );
  const [isPhonePortrait, setIsPhonePortrait] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 && window.innerHeight >= window.innerWidth : false
  );
  const isWideScreen = isDesktop || isScreenLandscape;
  const isTrayVisible = isDesktop ? true : !isPlaying;

  useEffect(() => {
    const checkOrientation = () => {
      setIsDesktop(window.innerWidth >= 1024);
      setIsScreenLandscape(window.innerWidth > window.innerHeight);
      setIsPhonePortrait(window.innerWidth < 640 && window.innerHeight >= window.innerWidth);
    };
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Immediate pre-detection of video aspect ratio & orientation from thumbnails
  useEffect(() => {
    if (!shorts || shorts.length === 0) return;
    [activeIndex - 1, activeIndex, activeIndex + 1].forEach((idx) => {
      if (idx < 0 || idx >= shorts.length) return;
      const item = shorts[idx];
      if (!item || landscapeMap[idx] !== undefined) return;
      const thumbUrl = getThumbnailUrl(item) || (item.thumbnail ? getMediaUrl(item.thumbnail) : '');
      if (thumbUrl) {
        const img = new Image();
        img.src = thumbUrl;
        img.onload = () => {
          if (img.naturalWidth && img.naturalHeight) {
            const ratio = img.naturalWidth / img.naturalHeight;
            const isWide = ratio > 1.15;
            setLandscapeMap((prev) => (prev[idx] === undefined ? { ...prev, [idx]: isWide } : prev));
            setAspectRatioMap((prev) => (prev[idx] === undefined ? { ...prev, [idx]: ratio } : prev));
          }
        };
      }
    });
  }, [activeIndex, shorts, landscapeMap]);

  // Gesture & Tap Engine Refs
  const isScrubbingRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null);
  const isHold2XRef = useRef(false);
  const didHold2XRef = useRef(false);
  const isDraggingRef = useRef(false);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);
  const lastTapTimeRef = useRef(0);
  const tapTimeoutRef = useRef<number | null>(null);
  const pointerStartTimeRef = useRef<number>(0);
  const isPointerMovedRef = useRef<boolean>(false);
  const lastTapProcessedRef = useRef<number>(0);

  // Web Escape and History Back navigation handler
  useBackButton(
    useCallback(() => {
      onClose();
      return true;
    }, [onClose]),
    isOpen
  );

  // Unified short navigation handler for cards, keys, and gestures
  const goToShortIndex = useCallback((targetIdx: number, dir: 'next' | 'prev') => {
    if (targetIdx < 0 || targetIdx >= shorts.length) return;
    hapticLight();
    setSlideDirection(dir);
    setActiveIndex(targetIdx);
    setIsPlaying(true);
    const targetVideo = videoRefs.current[targetIdx];
    setCurrentTime(targetVideo?.currentTime || 0);
    setDuration(targetVideo && targetVideo.duration && !isNaN(targetVideo.duration) && targetVideo.duration > 0 ? targetVideo.duration : 0);
    onIndexChange?.(targetIdx);
    if (shorts[targetIdx]) {
      updateBrowserUrl('/shorts/' + getMediaShortId(shorts[targetIdx]), true);
    }
    if (!isDesktop && containerRef.current) {
      slideRefs.current[targetIdx]?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'start' });
    }
  }, [shorts, isDesktop, onIndexChange]);

  const handleMouseMove = useCallback(() => {
    // no-op desktop handler
  }, []);

  // Screen tap handler: toggles play/pause with tactile haptics
  const handleScreenTap = useCallback((idx: number) => {
    if (isBatteryBrakeActive) {
      return;
    }
    const v = videoRefs.current[idx] || videoRefs.current[activeIndex];
    if (!v) return;

    if (idx !== activeIndex) {
      setActiveIndex(idx);
    }

    if (v.paused) {
      v.play().catch(() => {
        v.muted = true;
        v.play().catch(() => {});
      });
      setIsPlaying(true);
      hapticLight();
    } else {
      v.pause();
      setIsPlaying(false);
      hapticLight();
    }
  }, [activeIndex, isBatteryBrakeActive]);

  // Video Pointer Engine: Hold-to-2x Speed, Swipe Navigation & Instant Tap Detection
  const handleVideoPointerDown = useCallback((e: React.PointerEvent, idx: number) => {
    pointerStartXRef.current = e.clientX;
    pointerStartYRef.current = e.clientY;
    pointerStartTimeRef.current = Date.now();
    isPointerMovedRef.current = false;
    didHold2XRef.current = false;
    isDraggingRef.current = false;

    // Hold-to-2x speed gesture trigger (> 320ms stationary hold)
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = window.setTimeout(() => {
      if (isPointerMovedRef.current) return;
      const v = videoRefs.current[idx] || videoRefs.current[activeIndex];
      if (v && !v.paused) {
        isHold2XRef.current = true;
        didHold2XRef.current = true;
        setIs2XSpeed(true);
        v.playbackRate = 2.0;
        hapticMedium();
      }
    }, 320);
  }, [activeIndex]);

  const handleVideoPointerMove = useCallback((e: React.PointerEvent) => {
    const dx = Math.abs(e.clientX - pointerStartXRef.current);
    const dy = Math.abs(e.clientY - pointerStartYRef.current);
    if (dx > 10 || dy > 10) {
      isPointerMovedRef.current = true;
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    }
    if (dx > 25 || dy > 25) {
      isDraggingRef.current = true;
    }
  }, []);

  const handleVideoPointerUp = useCallback((e: React.PointerEvent, idx: number) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    // If hold-2x was engaged, restore normal speed
    if (isHold2XRef.current) {
      isHold2XRef.current = false;
      setIs2XSpeed(false);
      const v = videoRefs.current[activeIndex];
      if (v) {
        v.playbackRate = 1.0;
        hapticLight();
      }
      return;
    }

    if (didHold2XRef.current) {
      didHold2XRef.current = false;
      return;
    }

    const dx = e.clientX - pointerStartXRef.current;
    const dy = e.clientY - pointerStartYRef.current;
    const dist = Math.hypot(dx, dy);
    const elapsed = Date.now() - pointerStartTimeRef.current;

    // Swipe or drag detection: mark as dragged so native click does NOT pause or trigger the tray
    if (dist > 15 || isDraggingRef.current || isPointerMovedRef.current) {
      isDraggingRef.current = true;
      lastTapProcessedRef.current = Date.now();
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }

      // Horizontal drag on desktop / touch: navigate next or prev
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0 && activeIndex < shorts.length - 1) {
          goToShortIndex(activeIndex + 1, 'next');
        } else if (dx > 0 && activeIndex > 0) {
          goToShortIndex(activeIndex - 1, 'prev');
        }
      }

      setTimeout(() => {
        isDraggingRef.current = false;
        isPointerMovedRef.current = false;
      }, 400);
      return;
    }

    // Direct Tap Detection on PointerUp (handles mobile touch, Chrome DevTools emulation, and mouse)
    if (dist <= 15 && elapsed < 350) {
      lastTapProcessedRef.current = Date.now();
      const now = Date.now();

      // Double-tap detection (< 280ms)
      if (now - lastTapTimeRef.current < 280) {
        if (tapTimeoutRef.current) {
          clearTimeout(tapTimeoutRef.current);
          tapTimeoutRef.current = null;
        }
        lastTapTimeRef.current = 0;
        setLikeHeart({ id: Date.now() });
        setTimeout(() => setLikeHeart(null), 850);
        return;
      }
      lastTapTimeRef.current = now;

      // Single-tap -> trigger play/pause after debounce
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = window.setTimeout(() => {
        handleScreenTap(idx);
        tapTimeoutRef.current = null;
      }, 200);
    }
  }, [activeIndex, goToShortIndex, handleScreenTap, shorts.length]);

  const handleVideoPointerCancel = useCallback((idx: number) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isHold2XRef.current) {
      isHold2XRef.current = false;
      setIs2XSpeed(false);
      const v = videoRefs.current[idx] || videoRefs.current[activeIndex];
      if (v) v.playbackRate = 1.0;
    }
  }, [activeIndex]);

  // Unified card click handler (Fallback / Keyboard / Mouse)
  const handleCardClick = useCallback((e: React.MouseEvent, idx: number) => {
    e.stopPropagation();

    // If scrolling, dragging, or pointerUp recently handled a gesture, ignore click
    if (
      isDraggingRef.current ||
      isPointerMovedRef.current ||
      isScrollingRef.current ||
      Date.now() - lastTapProcessedRef.current < 450
    ) {
      return;
    }

    const now = Date.now();
    // Double-tap detection (< 280ms)
    if (now - lastTapTimeRef.current < 280) {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      lastTapTimeRef.current = 0;
      setLikeHeart({ id: Date.now() });
      setTimeout(() => setLikeHeart(null), 850);
      return;
    }
    lastTapTimeRef.current = now;

    // Single-tap -> trigger play/pause after debounce
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = window.setTimeout(() => {
      handleScreenTap(idx);
      tapTimeoutRef.current = null;
    }, 200);
  }, [handleScreenTap]);

  const togglePlay = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isBatteryBrakeActive) {
      return;
    }
    hapticLight();
    const v = videoRefs.current[activeIndex];
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  }, [activeIndex, isBatteryBrakeActive]);

  // Vertical timeline scrub handling for outside portrait short on widescreen
  const handleVerticalScrubSeek = useCallback((clientY: number, target: HTMLElement, idx: number) => {
    const video = videoRefs.current[idx];
    if (!video || !duration) return;
    const rect = target.getBoundingClientRect();
    if (rect.height <= 0) return;
    // Top-to-bottom timeline: top = 0:00 (start), bottom = duration (end)
    const pct = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    const seekTime = pct * duration;
    video.currentTime = seekTime;
    setCurrentTime(seekTime);
  }, [duration]);

  const handleVerticalScrubPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, idx: number) => {
    e.stopPropagation();
    isScrubbingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    handleVerticalScrubSeek(e.clientY, e.currentTarget, idx);
  }, [handleVerticalScrubSeek]);

  const handleVerticalScrubPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>, idx: number) => {
    if (!isScrubbingRef.current) return;
    e.stopPropagation();
    handleVerticalScrubSeek(e.clientY, e.currentTarget, idx);
  }, [handleVerticalScrubSeek]);

  const handleVerticalScrubPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current) return;
    e.stopPropagation();
    isScrubbingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    hapticLight();
  }, []);

  const renderVerticalScrubberBar = useCallback((idx: number) => {
    const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className="group/vseek relative h-full flex flex-col items-center justify-between cursor-pointer select-none py-2"
        title="Seek playback (Drag to scrub)"
      >
        {/* Top Bound Time Label */}
        <span
          className="text-[10px] font-mono text-white/50 tracking-wider font-bold select-none shrink-0"
          style={{ textShadow: '0 1px 4px #000' }}
        >
          0:00
        </span>

        {/* Vertical Track Hitbox */}
        <div
          onPointerDown={(e) => handleVerticalScrubPointerDown(e, idx)}
          onPointerMove={(e) => handleVerticalScrubPointerMove(e, idx)}
          onPointerUp={handleVerticalScrubPointerUp}
          onPointerCancel={handleVerticalScrubPointerUp}
          className="relative w-8 flex-1 flex items-center justify-center cursor-pointer my-2 overflow-visible"
        >
          {/* Visual Track Rail: Slim 3px expanding to 5px on hover */}
          <div className="relative w-[3px] group-hover/vseek:w-[5px] h-full bg-white/20 transition-all duration-150 flex flex-col justify-start overflow-visible">
            {/* Active Progress Fill: Pure Stark White Style with Cyber Glow */}
            <div
              className="absolute top-0 left-0 right-0 transition-all"
              style={{
                height: `${progressPct}%`,
                background: '#ffffff',
                boxShadow: '0 0 10px rgba(255, 255, 255, 0.85)',
              }}
            />

            {/* Scrubber Handle & Live Timestamp Badge */}
            <div
              className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center pointer-events-none transition-transform duration-75 group-hover/vseek:scale-110 z-20"
              style={{
                top: `${progressPct}%`,
              }}
            >
              {/* Distinct Square Reticle Scrubber Dot */}
              <div
                className="w-3.5 h-3.5 bg-white border border-black/40 shrink-0"
                style={{
                  boxShadow: '0 0 10px rgba(255, 255, 255, 0.9)',
                  borderRadius: 0,
                  outline: 'none',
                }}
              />

              {/* Live Current Time Badge beside the Scrubber Dot */}
              <span
                className="ml-2.5 px-1.5 py-0.5 bg-[#05070c]/95 border border-white/30 text-[10px] font-mono font-bold text-white shadow-[0_0_10px_rgba(0,0,0,0.9)] whitespace-nowrap"
                style={{ borderRadius: 0, outline: 'none' }}
              >
                {formatTime(currentTime)}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Bound Duration Label */}
        <span
          className="text-[10px] font-mono text-white/50 tracking-wider font-bold select-none shrink-0"
          style={{ textShadow: '0 1px 4px #000' }}
        >
          {formatTime(duration)}
        </span>
      </div>
    );
  }, [duration, currentTime, handleVerticalScrubPointerDown, handleVerticalScrubPointerMove, handleVerticalScrubPointerUp]);

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
      // On desktop, only ArrowRight navigates next; ArrowDown/PageDown are ignored
      // Next short: ArrowRight, ArrowDown, or PageDown
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
        if (e.cancelable) e.preventDefault();
        if (activeIndex < shorts.length - 1) {
          goToShortIndex(activeIndex + 1, 'next');
        }
      }
      // Prev short: ArrowLeft, ArrowUp, or PageUp
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        if (e.cancelable) e.preventDefault();
        if (activeIndex > 0) {
          goToShortIndex(activeIndex - 1, 'prev');
        }
      }
      if (e.key === 'm' || e.key === 'M') setIsMuted((prev) => !prev);
      if (e.key === 'w' || e.key === 'W' || e.key === 'f' || e.key === 'F') {
        const currentLandscape = !!landscapeMap[activeIndex];
        const nextState = !currentLandscape;
        setLandscapeMap((prev) => ({ ...prev, [activeIndex]: nextState }));
        setAspectRatioMap((prev) => ({ ...prev, [activeIndex]: nextState ? 16 / 9 : 9 / 16 }));
      }
      if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
        if (e.cancelable) e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, activeIndex, onClose, isWideScreen, isDesktop, goToShortIndex, shorts.length]);

  // Initial index accurate scrolling and playback on mount
  useEffect(() => {
    if (!isOpen || shorts.length === 0) return;
    hasInitialScrolledRef.current = false;
    const targetIdx = Math.max(0, Math.min(initialIndex || 0, shorts.length - 1));
    setActiveIndex(targetIdx);
    if (shorts[targetIdx]) {
      updateBrowserUrl('/shorts/' + getMediaShortId(shorts[targetIdx]), true);
    }

    if (!isDesktop && containerRef.current) {
      const targetElement =
        containerRef.current.querySelector<HTMLElement>(`[data-index="${targetIdx}"]`) ||
        slideRefs.current[targetIdx];
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
      }
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
  }, [isOpen, initialIndex, shorts.length, isDesktop]);

  // Clean Native CSS Scroll-Snap Observer for Mobile (threshold: 0.6)
  useEffect(() => {
    if (!isOpen || isDesktop || !containerRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (!hasInitialScrolledRef.current) return;
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const idxAttr = entry.target.getAttribute('data-reel-index');
          if (idxAttr !== null) {
            const idx = parseInt(idxAttr, 10);
            if (!isNaN(idx)) {
              setActiveIndex(idx);
              setIsPlaying(true);
              onIndexChange?.(idx);
              if (shorts[idx]) {
                updateBrowserUrl('/shorts/' + getMediaShortId(shorts[idx]), true);
              }
              videoRefs.current.forEach((v, i) => {
                if (!v) return;
                if (i !== idx) {
                  v.pause();
                  v.currentTime = 0;
                } else {
                  v.muted = isMuted;
                  v.play().then(() => {
                    setIsPlaying(true);
                  }).catch(() => {
                    v.muted = true;
                    v.play().then(() => {
                      setIsPlaying(true);
                    }).catch(() => {});
                  });
                }
              });
            }
          }
        }
      });
    }, { root: containerRef.current, threshold: 0.6 });
    slideRefs.current.forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [isOpen, isDesktop, shorts.length, onIndexChange, isMuted]);


  // Effect to ensure active video audio mute state and duration synchronization
  useEffect(() => {
    const currentVideo = videoRefs.current[activeIndex];
    if (currentVideo) {
      currentVideo.muted = isMuted;
      if (currentVideo.duration && !isNaN(currentVideo.duration) && currentVideo.duration > 0) {
        setDuration(currentVideo.duration);
      }
      if (currentVideo.currentTime && !isScrubbingRef.current) {
        setCurrentTime(currentVideo.currentTime);
      }
    }
  }, [activeIndex, isMuted]);

  // Device Screen Lock Rule: Screen stays unlocked ONLY when short is actively playing
  useEffect(() => {
    if (isOpen && isPlaying) {
      acquirePlayerWakeLock().catch(() => {});
    } else {
      releasePlayerWakeLock().catch(() => {});
    }
    return () => {
      releasePlayerWakeLock().catch(() => {});
    };
  }, [isOpen, isPlaying]);

  // Teardown all video decoders on unmount
  useEffect(() => {
    return () => {
      videoRefs.current.forEach((v) => {
        if (v) {
          try {
            v.pause();
            v.currentTime = 0;
            v.src = '';
            v.removeAttribute('src');
            v.load();
          } catch {}
        }
      });
      releasePlayerWakeLock().catch(() => {});
    };
  }, []);

  // Render single video card (used for desktop center stage & mobile scroll container)
  const renderVideoCard = (item: StageMediaItem, idx: number, isActive: boolean) => {
    if (!item) return null;
    const streamUrl = overrides[idx] || getVideoStreamUrl(item) || getDirectHfVideoUrl(item);
    const posterUrl = getThumbnailUrl(item) || (item.thumbnail ? getMediaUrl(item.thumbnail) : '');
    const isLandscape = landscapeMap[idx];
    const currentRatio = aspectRatioMap[idx] || (isLandscape ? 16 / 9 : 9 / 16);

    return (
      <div
        key={`video-card-${idx}-${slideDirection || 'init'}`}
        onClick={(e) => handleCardClick(e, idx)}
        onPointerDown={(e) => handleVideoPointerDown(e, idx)}
        onPointerMove={handleVideoPointerMove}
        onPointerUp={(e) => handleVideoPointerUp(e, idx)}
        onPointerCancel={() => handleVideoPointerCancel(idx)}
        style={{
          touchAction: 'pan-y',
          ...(isDesktop
            ? isLandscape
              ? {
                  width: '100%',
                  height: '100%',
                  aspectRatio: `${currentRatio}`,
                }
              : {
                  width: 'calc(100vh * (9 / 16))',
                  maxWidth: 'calc(100vh * (9 / 16))',
                  height: '100vh',
                }
            : isLandscape
              ? {
                  width: '100%',
                  maxWidth: 'min(100vw, calc(82vh * 1.777))',
                  aspectRatio: `${currentRatio}`,
                  maxHeight: '82vh',
                }
              : {
                  height: '100%',
                  maxHeight: '100vh',
                  aspectRatio: '9 / 16',
                  maxWidth: 'calc(100vh * (9 / 16))',
                }),
        }}
        className={`relative z-20 flex items-center justify-center transition-all duration-300 cursor-pointer select-none overflow-hidden ${
          isLandscape
            ? 'rounded-none border-0 shadow-[0_0_50px_rgba(0,0,0,0.85)] bg-black'
            : 'h-full max-h-screen rounded-none border-0 shadow-[-20px_0_35px_rgba(0,0,0,0.7),20px_0_35px_rgba(0,0,0,0.7)] bg-black'
        } ${
          isActive
            ? slideDirection === 'next'
              ? 'animate-short-slide-next'
              : slideDirection === 'prev'
              ? 'animate-short-slide-prev'
              : 'animate-media-open'
            : 'opacity-40 scale-[0.95]'
        }`}
      >
        {!failedPermanently[idx] ? (
          <>
            <video
              ref={(el) => {
                videoRefs.current[idx] = el;
                if (el && idx === activeIndex && isActive && !el.paused) {
                  el.muted = isMuted;
                }
              }}
              src={streamUrl}
              poster={posterUrl || undefined}
              playsInline
              loop
              muted={isMuted}
              preload={Math.abs(idx - activeIndex) <= 1 ? 'auto' : 'none'}
              className="w-full h-full pointer-events-none object-contain rounded-none bg-black"
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                if (v.videoWidth && v.videoHeight) {
                  const ratio = v.videoWidth / v.videoHeight;
                  const isWide = ratio > 1.15;
                  setLandscapeMap((prev) => (prev[idx] === isWide ? prev : { ...prev, [idx]: isWide }));
                  setAspectRatioMap((prev) => (prev[idx] === ratio ? prev : { ...prev, [idx]: ratio }));
                }
                if (idx === activeIndex) {
                  if (v.duration && !isNaN(v.duration) && v.duration > 0) {
                    setDuration(v.duration);
                  }
                  v.muted = isMuted;
                  v.play().catch(() => {
                    v.muted = true;
                    v.play().catch(() => {});
                  });
                }
              }}
              onCanPlay={(e) => {
                const v = e.currentTarget;
                if (idx === activeIndex && v.duration && !isNaN(v.duration) && v.duration > 0) {
                  setDuration(v.duration);
                }
              }}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (idx === activeIndex) {
                  if (!isScrubbingRef.current) {
                    setCurrentTime(v.currentTime);
                  }
                  if ((!duration || isNaN(duration) || duration === 0) && v.duration && !isNaN(v.duration) && v.duration > 0) {
                    setDuration(v.duration);
                  }
                }
              }}
              onPause={(e) => {
                if (
                  idx === activeIndex &&
                  videoRefs.current[activeIndex] === e.currentTarget &&
                  !isDraggingRef.current &&
                  !isScrollingRef.current
                ) {
                  setIsPlaying(false);
                }
              }}
              onPlay={(e) => {
                if (idx === activeIndex && videoRefs.current[activeIndex] === e.currentTarget) {
                  setIsPlaying(true);
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

            {/* In-Stage Safety Brake Modal Banner for < 5% Battery on Battery Power */}
            {isBatteryBrakeActive && idx === activeIndex && (
              <div
                className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[10px] pointer-events-auto select-none animate-fade-in"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="relative w-full max-w-md p-6 sm:p-7 shadow-[0_30px_80px_rgba(0,0,0,0.75)] text-white flex flex-col gap-4 animate-scale-in text-left"
                  style={{
                    borderRadius: 0,
                    outline: 'none',
                    border: 'none',
                    background: 'rgba(10, 14, 23, 0.58)',
                    backdropFilter: 'blur(32px) saturate(190%)',
                    WebkitBackdropFilter: 'blur(32px) saturate(190%)',
                    boxShadow: '0 30px 80px rgba(0, 0, 0, 0.75), 0 0 1px rgba(255, 255, 255, 0.2) inset',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs sm:text-sm font-bold font-mono tracking-tight uppercase flex items-center gap-2 text-[#ff0022]">
                      <span className="w-2.5 h-2.5 bg-[#ff0022] animate-ping inline-block shrink-0 shadow-[0_0_8px_#ff0022]" />
                      // CRITICAL BATTERY // &lt; 5%
                    </h3>
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-7 h-7 flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-base font-mono p-0"
                      style={{ borderRadius: 0, outline: 'none', border: 'none', background: 'transparent' }}
                      title="Close Shorts"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm text-neutral-300 font-sans leading-relaxed">
                    Device is running on very low power emergency state (&lt; 5%). Shorts playback is locked to prevent sudden system crash. You may choose 'Play as Urgent' for a single emergency play.
                  </p>

                  <div className="bg-[#030508]/45 p-2.5 text-[11px] font-mono text-neutral-400 flex items-center justify-between">
                    <span className="text-[#ff0022] font-bold">CRITICAL // {batteryState.level}%</span>
                    <span className="text-neutral-500">PLAYBACK LOCKED</span>
                  </div>

                  <div className="flex items-center justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleUrgentPlay}
                      className="py-2 px-4 font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 hover:bg-white hover:text-black"
                      style={{
                        borderRadius: 0,
                        outline: 'none',
                        border: 'none',
                        backgroundColor: '#ff0022',
                        color: '#ffffff',
                        boxShadow: '0 0 16px rgba(255, 0, 34, 0.45)',
                      }}
                    >
                      <span>⚡</span>
                      <span>Play as Urgent</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

          </>
        ) : (
          <div className="w-full h-full aspect-[9/16] max-h-[85vh] flex flex-col items-center justify-center bg-neutral-950/95 rounded-none p-6 text-center border border-neutral-800">
            <div className="w-12 h-12 rounded-none bg-neutral-900 border border-neutral-700 flex items-center justify-center text-neutral-300 mb-3 shadow">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-normal text-neutral-200 mb-1 font-serif">Video Unavailable</h3>
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;
  if (!shorts || shorts.length === 0) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md text-white p-6 select-none font-serif">
        <Loader2 className="w-10 h-10 animate-spin text-neutral-400 mb-4" />
        <p className="text-sm text-neutral-400 mb-6">No shorts available in this archive.</p>
        <button type="button" onClick={onClose} className="px-5 py-2 rounded-none bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-serif transition-all cursor-pointer active:scale-95">
          Return to Explorer
        </button>
      </div>
    );
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[9999] bg-black md:bg-neutral-950/70 md:backdrop-blur-md flex flex-col items-center select-none overflow-hidden font-serif animate-backdrop-fade cursor-pointer"
    >
      {/* ===== MOBILE PORTRAIT VERTICAL CYBER CONTROL RACK (OPTION A: RIGHT-SIDE THUMB RACK) ===== */}
      {isPhonePortrait ? (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          style={{
            transform: `translateX(${isTrayVisible ? '0px' : '20px'})`,
            borderRadius: 0,
            outline: 'none',
          }}
          className={`fixed right-3 bottom-20 z-50 flex flex-col items-center gap-2 p-1.5 bg-[rgba(5,7,12,0.92)] backdrop-blur-xl border border-white/[0.1] shadow-[0_12px_45px_rgba(0,0,0,0.85)] pointer-events-auto transition-all duration-300 select-none overflow-hidden ${
            isTrayVisible ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-5 pointer-events-none'
          }`}
        >
          {/* Close Button at Top */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="reticle-btn reticle-btn-close w-8 h-8 flex items-center justify-center shrink-0 cursor-pointer text-slate-300 hover:text-white border-0"
            title="Close (Esc)"
            aria-label="Close shorts player"
          >
            <LaserCloseIcon size={20} />
          </button>

          {/* Divider line */}
          <div className="w-5 h-[1px] bg-white/10 shrink-0" />

          {/* Play / Pause Toggle Button */}
          <button
            type="button"
            onClick={togglePlay}
            className="reticle-btn w-8 h-8 flex items-center justify-center shrink-0 cursor-pointer border-0"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <LaserPauseIcon size={20} /> : <LaserPlayIcon size={20} />}
          </button>

          {/* Time Counter (Stacked cleanly in 2 rows) */}
          {duration > 0 && (
            <div
              className="flex flex-col items-center text-[9px] font-mono font-medium text-white/90 leading-tight select-none py-0.5 shrink-0"
              style={{ textShadow: '0 1px 4px #000, 0 0 8px #000' }}
            >
              <span>{formatTime(currentTime)}</span>
              <span className="text-white/30 text-[8px] leading-none my-0.5">—</span>
              <span className="text-white/60">{formatTime(duration)}</span>
            </div>
          )}

          {/* Previous Short Button (Upward Chevron for vertical scroll) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (activeIndex > 0) goToShortIndex(activeIndex - 1, 'prev');
            }}
            disabled={activeIndex <= 0}
            className="reticle-btn w-8 h-8 flex items-center justify-center shrink-0 cursor-pointer border-0 disabled:opacity-25 disabled:pointer-events-none"
            title="Previous Short (↑)"
            aria-label="Previous short"
          >
            <LaserPrevIcon size={20} className="rotate-90" />
          </button>

          {/* Short Index Counter (Stacked) */}
          <div
            className="flex flex-col items-center text-[10px] font-mono font-medium text-white/90 leading-tight select-none py-0.5 shrink-0"
            style={{ textShadow: '0 1px 4px #000, 0 0 8px #000' }}
          >
            <span className="font-bold">{activeIndex + 1}</span>
            <span className="text-white/30 text-[8px] leading-none my-0.5">—</span>
            <span className="text-white/60">{shorts.length}</span>
          </div>

          {/* Next Short Button (Downward Chevron for vertical scroll) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (activeIndex < shorts.length - 1) goToShortIndex(activeIndex + 1, 'next');
            }}
            disabled={activeIndex >= shorts.length - 1}
            className="reticle-btn w-8 h-8 flex items-center justify-center shrink-0 cursor-pointer border-0 disabled:opacity-25 disabled:pointer-events-none"
            title="Next Short (↓)"
            aria-label="Next short"
          >
            <LaserNextIcon size={20} className="rotate-90" />
          </button>

          {/* Aspect Ratio Indicator Badge */}
          <div
            className={`w-8 h-6 flex items-center justify-center font-mono text-[9px] font-bold tracking-tight select-none pointer-events-none shrink-0 border ${
              landscapeMap[activeIndex]
                ? 'text-[#38bdf8] border-[#38bdf8]/40 bg-[#38bdf8]/10 shadow-[0_0_8px_rgba(56,189,248,0.3)]'
                : 'text-white/80 border-white/20 bg-white/[0.04]'
            }`}
            style={{ borderRadius: 0, outline: 'none' }}
            title={landscapeMap[activeIndex] ? '16:9 Horizontal Short' : '9:16 Vertical Short'}
          >
            {landscapeMap[activeIndex] ? '16:9' : '9:16'}
          </div>

          {/* Volume / Mute Toggle Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted((prev) => !prev);
              hapticLight();
            }}
            className="reticle-btn w-8 h-8 flex items-center justify-center shrink-0 cursor-pointer text-slate-300 hover:text-white border-0"
            title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            <LaserVolumeIcon size={20} isMuted={isMuted} />
          </button>
        </div>
      ) : (
        /* ===== DESKTOP / TABLET HORIZONTAL CONTROL TRAY (BOTTOM-LEFT) ===== */
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          style={{
            transform: `translateY(${isTrayVisible ? '0px' : '16px'})`,
            borderRadius: 0,
            outline: 'none',
          }}
          className={`fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-50 flex items-center gap-2 sm:gap-2.5 p-1.5 sm:p-2 bg-[rgba(5,7,12,0.92)] backdrop-blur-xl border border-white/[0.1] shadow-[0_12px_45px_rgba(0,0,0,0.85)] pointer-events-auto transition-all duration-300 max-w-[calc(100vw-2rem)] overflow-hidden select-none ${
            isTrayVisible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          {/* Play / Pause Toggle Button */}
          <button
            type="button"
            onClick={togglePlay}
            className="reticle-btn w-9 h-9 flex items-center justify-center shrink-0 cursor-pointer border-0"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <LaserPauseIcon size={24} /> : <LaserPlayIcon size={24} />}
          </button>

          {/* Current Time / Duration Counter */}
          {duration > 0 && (
            <span
              className="px-2 text-xs font-mono font-medium text-white/90 tracking-wider whitespace-nowrap shrink-0 select-none"
              style={{ textShadow: '0 1px 4px #000, 0 0 8px #000' }}
            >
              {formatTime(currentTime)} <span className="text-white/40">/</span> {formatTime(duration)}
            </span>
          )}

          {/* Previous Short Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (activeIndex > 0) goToShortIndex(activeIndex - 1, 'prev');
            }}
            disabled={activeIndex <= 0}
            className="reticle-btn w-9 h-9 flex items-center justify-center shrink-0 cursor-pointer border-0 disabled:opacity-25 disabled:pointer-events-none"
            title="Previous Short (↑ or Left Arrow)"
            aria-label="Previous short"
          >
            <LaserPrevIcon size={22} />
          </button>

          {/* Short Index Counter */}
          <span
            className="px-2 text-xs font-mono font-medium text-white/90 tracking-wider whitespace-nowrap shrink-0 select-none"
            style={{ textShadow: '0 1px 4px #000, 0 0 8px #000' }}
          >
            {activeIndex + 1} <span className="text-white/40">/</span> {shorts.length}
          </span>

          {/* Next Short Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (activeIndex < shorts.length - 1) goToShortIndex(activeIndex + 1, 'next');
            }}
            disabled={activeIndex >= shorts.length - 1}
            className="reticle-btn w-9 h-9 flex items-center justify-center shrink-0 cursor-pointer border-0 disabled:opacity-25 disabled:pointer-events-none"
            title="Next Short (↓ or Right Arrow)"
            aria-label="Next short"
          >
            <LaserNextIcon size={22} />
          </button>

          {/* Aspect Ratio Indicator Badge */}
          <div
            className={`px-2 h-8 flex items-center justify-center font-mono text-xs font-bold tracking-wider shrink-0 select-none pointer-events-none border ${
              landscapeMap[activeIndex]
                ? 'text-[#38bdf8] border-[#38bdf8]/40 bg-[#38bdf8]/10 shadow-[0_0_8px_rgba(56,189,248,0.3)]'
                : 'text-white/80 border-white/20 bg-white/[0.04]'
            }`}
            style={{ borderRadius: 0, outline: 'none' }}
            title={landscapeMap[activeIndex] ? '16:9 Horizontal Short' : '9:16 Vertical Short'}
          >
            {landscapeMap[activeIndex] ? '16:9' : '9:16'}
          </div>

          {/* Volume / Mute Toggle Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted((prev) => !prev);
              hapticLight();
            }}
            className="reticle-btn w-9 h-9 flex items-center justify-center shrink-0 cursor-pointer text-slate-300 hover:text-white border-0"
            title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            <LaserVolumeIcon size={24} isMuted={isMuted} />
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="reticle-btn reticle-btn-close w-9 h-9 flex items-center justify-center shrink-0 cursor-pointer text-slate-300 hover:text-white border-0"
            title="Close (Esc)"
            aria-label="Close shorts player"
          >
            <LaserCloseIcon size={22} />
          </button>
        </div>
      )}

      {/* 1. Ambient CSS Glow (Zero extra video decoders) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,240,255,0.06)_0%,_transparent_70%)]" />

      {/* 2. Seamless Zero-Gap Stream of Other Shorts (All Viewports: Desktop, Tablet, Mobile) */}
      {streamItems.length > 0 && (
        <div
          className={`fixed inset-0 overflow-hidden select-none bg-black flex items-stretch ${
            isDesktop ? 'z-10 pointer-events-auto' : 'z-0 pointer-events-none'
          }`}
          onClick={(e) => {
            if (isDesktop && e.target === e.currentTarget) onClose();
          }}
          aria-hidden={!isDesktop}
        >
          <div className="shorts-stream-track">
            {streamItems.map(({ item, originalIndex }, idx) => {
              if (!item) return null;
              const thumbUrl = getThumbnailUrl(item) || (item.thumbnail ? getMediaUrl(item.thumbnail) : '');

              return (
                <div
                  key={`stream-card-${originalIndex}-${idx}`}
                  onClick={(e) => {
                    if (!isDesktop) return;
                    e.stopPropagation();
                    goToShortIndex(originalIndex, originalIndex > activeIndex ? 'next' : 'prev');
                  }}
                  className="shorts-stream-card"
                  title={isDesktop ? item.title || 'Play Short' : undefined}
                >
                  <img
                    src={thumbUrl}
                    alt={item.title || 'Short'}
                    className="w-full h-full object-cover pointer-events-none select-none"
                    loading="lazy"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Desktop Stage (Adaptive Landscape vs 100vh Portrait Centerpiece) vs Mobile Scroll-Snap Reels */}
      {isDesktop ? (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center p-4 sm:p-6 bg-transparent pointer-events-none select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {landscapeMap[activeIndex] ? (
            /* 16:9 Video Player Mode: outside top time slider goes up directly above the 16:9 video frame */
            <div
              className="pointer-events-auto relative w-full max-w-[min(88vw,calc(82vh*(16/9)))] flex flex-col items-center justify-center cursor-default select-none shrink-0 z-20 transition-all duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 16:9 Video Box */}
              <div className="relative w-full max-h-[82vh] aspect-[16/9] rounded-none border-0 shadow-[0_0_50px_rgba(0,0,0,0.85)] bg-black overflow-hidden flex items-center justify-center">
                {renderVideoCard(shorts[activeIndex], activeIndex, true)}
              </div>
            </div>
          ) : (
            /* 9:16 Portrait Shorts Mode (Centered Vertical Reel with Outside Right Time Slider on Widescreen) */
            <div className="pointer-events-auto relative h-screen max-h-screen aspect-[9/16] flex items-center justify-center transition-all duration-300">
              {renderVideoCard(shorts[activeIndex], activeIndex, true)}

              {/* Outside Vertical Time Slider (Positioned Outside on the Right Side of the Portrait Short on Wide Screen) */}
              {duration > 0 && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute left-[calc(100%+14px)] sm:left-[calc(100%+20px)] top-1/2 -translate-y-1/2 h-[68vh] max-h-[640px] z-30 flex items-center select-none transition-all duration-300 ${
                    isTrayVisible ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-3 pointer-events-none'
                  }`}
                >
                  {renderVerticalScrubberBar(activeIndex)}
                </div>
              )}
            </div>
          )}
          {/* Preload adjacent videos for zero-latency instant transitions */}
          {activeIndex + 1 < shorts.length && (
            <video
              key={`preload-next-${activeIndex + 1}`}
              src={overrides[activeIndex + 1] || getVideoStreamUrl(shorts[activeIndex + 1]) || getDirectHfVideoUrl(shorts[activeIndex + 1])}
              preload="auto"
              muted
              playsInline
              className="hidden"
            />
          )}
          {activeIndex - 1 >= 0 && (
            <video
              key={`preload-prev-${activeIndex - 1}`}
              src={overrides[activeIndex - 1] || getVideoStreamUrl(shorts[activeIndex - 1]) || getDirectHfVideoUrl(shorts[activeIndex - 1])}
              preload="auto"
              muted
              playsInline
              className="hidden"
            />
          )}
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={() => {
            isScrollingRef.current = true;
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
            scrollTimeoutRef.current = window.setTimeout(() => {
              isScrollingRef.current = false;
            }, 300);
          }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              backdropClickStartRef.current = { x: e.clientX, y: e.clientY };
            }
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              const dist = Math.hypot(
                e.clientX - backdropClickStartRef.current.x,
                e.clientY - backdropClickStartRef.current.y
              );
              if (dist < 10) {
                onClose();
              }
            }
          }}
          className="relative z-20 w-full h-full overflow-y-scroll overflow-x-hidden snap-y snap-mandatory scroll-smooth overscroll-y-contain flex flex-col items-center no-scrollbar"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {shorts.map((item, idx) => {
            if (!item) return null;
            return (
              <div
                key={item.id || idx}
                ref={(el) => { slideRefs.current[idx] = el; }}
                data-index={idx}
                data-reel-index={idx}
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    onClose();
                  }
                }}
                className="w-full h-screen shrink-0 snap-start snap-always relative flex items-center justify-center p-0 md:p-4 bg-transparent cursor-pointer"
              >
                {renderVideoCard(item, idx, idx === activeIndex)}
              </div>
            );
          })}
        </div>
      )}

      {/* Brand Watermark Logo on Bottom-Right: click opens navigation dock on any screen */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          hapticLight();
          window.dispatchEvent(new CustomEvent('streamvault_open_dock'));
        }}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center select-none cursor-pointer transition-all duration-300 ease-out opacity-80 hover:opacity-100 hover:scale-105 pointer-events-auto"
        title="Open Navigation Dock"
      >
        <div className="flex items-center">
          <HeaderBrandLogo trackingClass="tracking-[0.2em]" />
        </div>
      </div>
    </div>
  );
};

export default ShortsFeedModal;
