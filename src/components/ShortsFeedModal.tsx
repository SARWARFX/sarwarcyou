import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AlertTriangle, Loader2, Play, Pause, Heart, FastForward } from 'lucide-react';
import type { StageMediaItem } from '../types';
import { getVideoStreamUrl, getDirectHfVideoUrl, getMediaUrl } from '../utils/imageUrlResolver';
import { getThumbnailUrl } from '../utils/thumbnailResolver';
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
} from './brand/LaserIcons';
import { getGlobalAudioMuted } from '../utils/audioMuteManager';

export interface ShortsFeedModalProps {
  isOpen: boolean; onClose: () => void; shorts: StageMediaItem[]; initialIndex: number; onIndexChange?: (newIndex: number) => void;
}

export const ShortsFeedModal: React.FC<ShortsFeedModalProps> = ({
  isOpen, onClose, shorts, initialIndex = 0, onIndexChange,
}) => {
  useLockBodyScroll(isOpen);
  const [activeIndex, setActiveIndex] = useState(initialIndex || 0);
  const [isMuted, setIsMuted] = useState(() => getGlobalAudioMuted());
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [failedPermanently, setFailedPermanently] = useState<Record<number, boolean>>({});
  const [landscapeMap, setLandscapeMap] = useState<Record<number, boolean>>({});
  const [aspectRatioMap, setAspectRatioMap] = useState<Record<number, number>>({});

  const [centerIcon, setCenterIcon] = useState<{ idx: number; type: 'play' | 'pause'; id: number } | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | null>(null);

  // Enhanced Shorts Experience States
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [is2XSpeed, setIs2XSpeed] = useState(false);
  const [likeHeart, setLikeHeart] = useState<{ id: number } | null>(null);

  // Seamless Zero-Gap Stream items list (infinite loop at 85s Ultra Calm speed)
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
  const iconTimerRef = useRef<number | null>(null);
  const hideControlsTimerRef = useRef<number | null>(null);
  const lastTouchTimeRef = useRef<number>(0);
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const isSwipingRef = useRef<boolean>(false);
  const backdropClickStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointerStartXRef = useRef<number>(0);
  const pointerStartYRef = useRef<number>(0);

  // Desktop vs Mobile layout detection and Screen Orientation detection
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [isScreenLandscape, setIsScreenLandscape] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false
  );
  const isWideScreen = isDesktop || isScreenLandscape;
  const isTrayVisible = isWideScreen || showControls;

  useEffect(() => {
    const checkOrientation = () => {
      setIsDesktop(window.innerWidth >= 1024);
      setIsScreenLandscape(window.innerWidth > window.innerHeight);
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

  // Initial controls state: wide screen stays appeared; portrait opens clean with tray hidden
  useEffect(() => {
    if (isOpen) {
      if (!isWideScreen) {
        setShowControls(false); // Portrait opens full screen with zero distraction (no tray)
      } else {
        setShowControls(true); // Wide screen tray stays appeared
      }
    }
  }, [isOpen, isWideScreen]);

  // When swiping to a new short on portrait, keep controls hidden while playing
  useEffect(() => {
    if (hasInitialScrolledRef.current && !isWideScreen) {
      setShowControls(false);
    }
  }, [activeIndex, isWideScreen]);

  // Unified short navigation handler for cards, keys, and gestures
  const goToShortIndex = useCallback((targetIdx: number, dir: 'next' | 'prev') => {
    if (targetIdx < 0 || targetIdx >= shorts.length) return;
    hapticLight();
    setSlideDirection(dir);
    setActiveIndex(targetIdx);
    setCurrentTime(0);
    setDuration(0);
    onIndexChange?.(targetIdx);
    if (!isWideScreen) {
      setShowControls(false);
    }
    if (shorts[targetIdx]) {
      updateBrowserUrl('/shorts/' + getMediaShortId(shorts[targetIdx]), true);
    }
    if (!isDesktop && containerRef.current) {
      slideRefs.current[targetIdx]?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'start' });
    }
  }, [shorts, isDesktop, isWideScreen, onIndexChange]);

  // Desktop mouse movement reveals HUD on wide screens
  const handleMouseMove = useCallback(() => {
    if (Date.now() - lastTouchTimeRef.current < 800) return;
    if (isWideScreen) {
      setShowControls(true);
    }
  }, [isWideScreen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isSwipingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    const dx = Math.abs(e.touches[0].clientX - touchStartXRef.current);
    const dy = Math.abs(e.touches[0].clientY - touchStartYRef.current);
    if (dx > 10 || dy > 10) {
      isSwipingRef.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartXRef.current;
    const dy = e.changedTouches[0].clientY - touchStartYRef.current;
    // Horizontal swipe gesture detection for shorts
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0 && activeIndex < shorts.length - 1) {
        goToShortIndex(activeIndex + 1, 'next');
      } else if (dx > 0 && activeIndex > 0) {
        goToShortIndex(activeIndex - 1, 'prev');
      }
    }
  };

  // Screen tap handler:
  // - Wide screen devices: Tray stays appeared at bottom-left all the time; tap toggles play/pause
  // - Portrait devices: Immersive view with synchronized play/pause & tray toggle:
  //     * If playing: pauses video and shows the tray
  //     * If paused: starts playing and hides the tray
  const handleScreenTap = useCallback((idx: number) => {
    if (isSwipingRef.current) {
      isSwipingRef.current = false;
      return;
    }
    const v = videoRefs.current[idx];
    if (!v) return;

    if (!isWideScreen) {
      // Portrait device behavior:
      if (v.paused) {
        v.play().catch(() => {});
        setShowControls(false);
        setCenterIcon({ idx, type: 'play', id: Date.now() });
        hapticLight();
      } else {
        v.pause();
        setShowControls(true);
        setCenterIcon({ idx, type: 'pause', id: Date.now() });
        hapticLight();
      }
    } else {
      // Wide screen behavior (tray stays appeared at bottom-left):
      if (v.paused) {
        v.play().catch(() => {});
        setCenterIcon({ idx, type: 'play', id: Date.now() });
        hapticLight();
      } else {
        v.pause();
        setCenterIcon({ idx, type: 'pause', id: Date.now() });
        hapticLight();
      }
    }

    if (iconTimerRef.current) clearTimeout(iconTimerRef.current);
    iconTimerRef.current = window.setTimeout(() => setCenterIcon(null), 700);
  }, [isWideScreen]);

  // Video Pointer Engine: Double-tap to Like, Hold-to-2x Speed, Desktop Drag
  const handleVideoPointerDown = useCallback((_e: React.PointerEvent, idx: number) => {
    if (idx !== activeIndex) return;
    pointerStartXRef.current = _e.clientX;
    pointerStartYRef.current = _e.clientY;
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

  const handleVideoPointerMove = useCallback((_e: React.PointerEvent) => {
    const dx = Math.abs(_e.clientX - pointerStartXRef.current);
    const dy = Math.abs(_e.clientY - pointerStartYRef.current);
    if (dx > 12 || dy > 12) {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    }
  }, []);

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

    const dx = _e.clientX - pointerStartXRef.current;
    const dy = _e.clientY - pointerStartYRef.current;

    // Horizontal drag on desktop / touch: navigate next or prev
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      lastTapTimeRef.current = 0;
      if (dx < 0 && activeIndex < shorts.length - 1) {
        goToShortIndex(activeIndex + 1, 'next');
      } else if (dx > 0 && activeIndex > 0) {
        goToShortIndex(activeIndex - 1, 'prev');
      }
      return;
    }

    // Vertical drag on desktop is strictly ignored without triggering taps
    if (isDesktop && Math.abs(dy) > 30 && Math.abs(dy) > Math.abs(dx)) {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
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
  }, [activeIndex, handleScreenTap, isDesktop, goToShortIndex, shorts.length]);

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
      // On desktop, only ArrowRight navigates next; ArrowDown/PageDown are ignored
      if (e.key === 'ArrowRight' || (!isDesktop && (e.key === 'ArrowDown' || e.key === 'PageDown'))) {
        if (e.cancelable) e.preventDefault();
        if (activeIndex < shorts.length - 1) {
          goToShortIndex(activeIndex + 1, 'next');
        }
      }
      // On desktop, only ArrowLeft navigates prev; ArrowUp/PageUp are ignored
      if (e.key === 'ArrowLeft' || (!isDesktop && (e.key === 'ArrowUp' || e.key === 'PageUp'))) {
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
        const v = videoRefs.current[activeIndex];
        if (!v) return;
        if (v.paused) {
          v.play().catch(() => {});
          setCenterIcon({ idx: activeIndex, type: 'play', id: Date.now() });
          if (!isWideScreen) setShowControls(false);
        } else {
          v.pause();
          setCenterIcon({ idx: activeIndex, type: 'pause', id: Date.now() });
          if (!isWideScreen) setShowControls(true);
        }
        if (iconTimerRef.current) clearTimeout(iconTimerRef.current);
        iconTimerRef.current = window.setTimeout(() => setCenterIcon(null), 700);
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
              onIndexChange?.(idx);
              if (shorts[idx]) {
                updateBrowserUrl('/shorts/' + getMediaShortId(shorts[idx]), true);
              }
              // Swiping up/down to next short on mobile: strictly keep controls hidden
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
  }, [isOpen, isDesktop, shorts.length, onIndexChange, isMuted]);


  // Effect to ensure active video audio mute state synchronization
  useEffect(() => {
    const currentVideo = videoRefs.current[activeIndex];
    if (currentVideo) {
      currentVideo.muted = isMuted;
    }
  }, [activeIndex, isMuted]);

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
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => handleVideoPointerDown(e, idx)}
        onPointerMove={handleVideoPointerMove}
        onPointerUp={(e) => handleVideoPointerUp(e, idx)}
        onPointerCancel={() => handleVideoPointerCancel(idx)}
        style={
          isDesktop
            ? isLandscape
              ? {
                  width: `min(88vw, calc(82vh * ${currentRatio}))`,
                  maxWidth: '88vw',
                  height: `min(82vh, calc(88vw / ${currentRatio}))`,
                  maxHeight: '82vh',
                  aspectRatio: `${currentRatio}`,
                }
              : {
                  width: 'calc(100vh * (9 / 16))',
                  maxWidth: 'calc(100vh * (9 / 16))',
                  height: '100vh',
                }
            : {
                width: '100%',
                height: '100%',
              }
        }
        className={`relative z-20 w-full h-full flex items-center justify-center transition-all duration-300 cursor-pointer select-none overflow-hidden ${
          isDesktop
            ? isLandscape
              ? 'rounded-none border-0 shadow-[0_0_50px_rgba(0,0,0,0.85)] bg-black'
              : 'h-screen rounded-none border-0 shadow-[-20px_0_35px_rgba(0,0,0,0.7),20px_0_35px_rgba(0,0,0,0.7)] bg-black'
            : 'w-full h-full bg-black'
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
              className={`w-full h-full ${
                isDesktop
                  ? isLandscape
                    ? 'object-cover rounded-none'
                    : 'object-cover'
                  : isLandscape
                  ? isScreenLandscape
                    ? 'object-cover'
                    : 'object-contain'
                  : 'object-cover'
              } rounded-none bg-black`}
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                if (v.videoWidth && v.videoHeight) {
                  const ratio = v.videoWidth / v.videoHeight;
                  const isWide = ratio > 1.15;
                  setLandscapeMap((prev) => (prev[idx] === isWide ? prev : { ...prev, [idx]: isWide }));
                  setAspectRatioMap((prev) => (prev[idx] === ratio ? prev : { ...prev, [idx]: ratio }));
                }
                if (idx === activeIndex) {
                  setDuration(v.duration || 0);
                  v.muted = isMuted;
                  v.play().catch(() => {
                    v.muted = true;
                    v.play().catch(() => {});
                  });
                }
              }}
              onTimeUpdate={(e) => {
                if (idx === activeIndex && !isScrubbingRef.current) {
                  setCurrentTime(e.currentTarget.currentTime);
                }
              }}
              onPause={() => {
                if (idx === activeIndex && !isWideScreen) {
                  setShowControls(true);
                }
              }}
              onPlay={() => {
                if (idx === activeIndex && !isWideScreen) {
                  setShowControls(false);
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
                    className="h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] rounded-full transition-[width] duration-75"
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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[9999] bg-black md:bg-neutral-950/70 md:backdrop-blur-md flex flex-col items-center select-none overflow-hidden font-serif animate-backdrop-fade cursor-pointer"
    >
      {/* Universal Bottom-Left Shorts Player Control Tray (Globally for Any Screen) */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        className={`fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-50 flex items-center gap-2 p-2 rounded-none bg-[rgba(5,7,12,0.92)] backdrop-blur-xl border-0 shadow-[0_12px_45px_rgba(0,0,0,0.85)] pointer-events-auto transition-all duration-300 max-w-[calc(100vw-2rem)] overflow-x-auto space-scrollbar ${
          isTrayVisible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {/* Previous Short Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (activeIndex > 0) goToShortIndex(activeIndex - 1, 'prev');
          }}
          disabled={activeIndex <= 0}
          className="reticle-btn w-9 h-9 cursor-pointer border-0 disabled:opacity-25 disabled:pointer-events-none"
          title="Previous Short (↑ or Left Arrow)"
          aria-label="Previous short"
        >
          <LaserPrevIcon size={22} />
        </button>

        {/* Short Index Counter */}
        <span
          className="px-2 text-xs font-mono font-medium text-white/90 tracking-wider whitespace-nowrap select-none"
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
          className="reticle-btn w-9 h-9 cursor-pointer border-0 disabled:opacity-25 disabled:pointer-events-none"
          title="Next Short (↓ or Right Arrow)"
          aria-label="Next short"
        >
          <LaserNextIcon size={22} />
        </button>

        {/* Aspect Ratio / Cinema Mode Toggle Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            hapticLight();
            const currentLandscape = !!landscapeMap[activeIndex];
            const nextState = !currentLandscape;
            setLandscapeMap((prev) => ({ ...prev, [activeIndex]: nextState }));
            setAspectRatioMap((prev) => ({ ...prev, [activeIndex]: nextState ? 16 / 9 : 9 / 16 }));
          }}
          className={`reticle-btn px-2 h-9 rounded-none font-mono text-xs font-bold tracking-wider cursor-pointer border-0 ${
            landscapeMap[activeIndex] ? 'text-white drop-shadow-[0_0_8px_#ffffff]' : 'text-slate-400 hover:text-white'
          }`}
          title={
            landscapeMap[activeIndex]
              ? 'Cinema 16:9 Mode Active (Click for 9:16 Portrait)'
              : 'Portrait 9:16 Mode (Click for 16:9 Cinema)'
          }
          aria-label="Toggle aspect ratio"
        >
          {landscapeMap[activeIndex] ? '16:9' : '9:16'}
        </button>

        {/* Volume / Mute Toggle Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsMuted((prev) => !prev);
            hapticLight();
          }}
          className="reticle-btn w-9 h-9 cursor-pointer text-slate-300 hover:text-white border-0"
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
          className="reticle-btn reticle-btn-close w-9 h-9 cursor-pointer text-slate-300 hover:text-white border-0"
          title="Close (Esc)"
          aria-label="Close shorts player"
        >
          <LaserCloseIcon size={22} />
        </button>
      </div>

      {/* ===== SEAMLESS ZERO-GAP STREAM (100VH FULL HEIGHT, 0PX GAP, 85S ULTRA CALM) ===== */}
      {isDesktop && streamItems.length > 0 && (
        <div
          className="fixed inset-0 z-10 overflow-hidden pointer-events-auto flex items-stretch bg-black select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="shorts-stream-track">
            {streamItems.map(({ item, originalIndex }, idx) => {
              if (!item) return null;
              const thumbUrl = getThumbnailUrl(item) || (item.thumbnail ? getMediaUrl(item.thumbnail) : '');

              return (
                <div
                  key={`stream-card-${originalIndex}-${idx}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToShortIndex(originalIndex, originalIndex > activeIndex ? 'next' : 'prev');
                  }}
                  className="shorts-stream-card"
                  title={item.title || 'Play Short'}
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
          <div
            className={`pointer-events-auto flex items-center justify-center transition-all duration-300 ${
              landscapeMap[activeIndex]
                ? 'w-full max-w-[min(88vw,calc(82vh*(16/9)))] max-h-[82vh] aspect-[16/9]'
                : 'h-screen aspect-[9/16]'
            }`}
          >
            {renderVideoCard(shorts[activeIndex], activeIndex, true)}
          </div>
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
          className="w-full h-full overflow-y-scroll overflow-x-hidden snap-y snap-mandatory scroll-smooth overscroll-y-contain flex flex-col items-center no-scrollbar"
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
