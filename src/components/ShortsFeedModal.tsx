import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Volume2, VolumeX, AlertTriangle, Loader2, Play, Pause, Heart, FastForward, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import type { StageMediaItem } from '../types';
import { getVideoStreamUrl, getDirectHfVideoUrl, getMediaUrl } from '../utils/imageUrlResolver';
import { getThumbnailUrl } from '../utils/thumbnailResolver';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

import { useBackButton } from '../utils/backButtonManager';
import { hapticLight, hapticMedium } from '../utils/hapticsManager';
import { getMediaShortId, updateBrowserUrl } from '../utils/urlRouter';

export interface ShortsFeedModalProps {
  isOpen: boolean; onClose: () => void; shorts: StageMediaItem[]; initialIndex: number; onIndexChange?: (newIndex: number) => void;
}

// Living Constellation Configuration & Dynamic Position Generator for Recommended Shorts
const CONSTELLATION_LABELS = ['DISCOVER', 'SUGGESTED', 'RECOMMENDED', 'FOR YOU', 'TRENDING', 'HOT PICKS', 'RANDOM', 'FEATURED'];

interface ConstellationCard {
  item: StageMediaItem;
  originalIndex: number;
  slot: number;
  style: React.CSSProperties;
  delay: string;
  label: string;
  visibilityClass: string;
}

interface WingAnchor {
  topPercent: number;
  depthVw: number;
  depthPx: number;
  visibilityClass: string;
}

// 10 Staggered Anchors per Wing: natural multi-column layout filling available peripheral space
const WING_ANCHORS: WingAnchor[] = [
  // Column 1: Outer edge (5 cards distributed top to bottom)
  { topPercent: 7,  depthVw: 1.8, depthPx: 20, visibilityClass: 'hidden lg:flex' },
  { topPercent: 27, depthVw: 3.2, depthPx: 34, visibilityClass: 'hidden lg:flex' },
  { topPercent: 48, depthVw: 1.8, depthPx: 22, visibilityClass: 'hidden lg:flex' },
  { topPercent: 69, depthVw: 3.4, depthPx: 36, visibilityClass: 'hidden lg:flex' },
  { topPercent: 88, depthVw: 1.8, depthPx: 22, visibilityClass: 'hidden lg:flex' },

  // Column 2: Mid-wing (3 cards staggered in-between outer heights)
  { topPercent: 17, depthVw: 8.5, depthPx: 115, visibilityClass: 'hidden xl:flex' },
  { topPercent: 39, depthVw: 9.8, depthPx: 135, visibilityClass: 'hidden xl:flex' },
  { topPercent: 61, depthVw: 8.8, depthPx: 120, visibilityClass: 'hidden xl:flex' },

  // Column 3: Inner wing (2 cards closer to the center player)
  { topPercent: 29, depthVw: 15.5, depthPx: 210, visibilityClass: 'hidden 2xl:flex' },
  { topPercent: 73, depthVw: 15.0, depthPx: 205, visibilityClass: 'hidden 2xl:flex' },
];

function generateDynamicConstellation(
  shorts: StageMediaItem[],
  activeIndex: number
): ConstellationCard[] {
  const excluded = new Set([activeIndex, activeIndex - 1, activeIndex + 1]);
  const pool = shorts
    .map((item, idx) => ({ item, originalIndex: idx }))
    .filter(({ originalIndex }) => !excluded.has(originalIndex));

  if (pool.length === 0) return [];

  // Pick up to 20 random items (10 for left wing, 10 for right wing)
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  const selected: { item: StageMediaItem; originalIndex: number }[] = [];
  for (let i = 0; i < 20; i++) {
    selected.push(shuffled[i % shuffled.length]);
  }

  // Shuffle anchor assignments for both left and right wings so positions change dynamically each cycle
  const leftAnchorIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => 0.5 - Math.random());
  const rightAnchorIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => 0.5 - Math.random());

  return selected.map((entry, index) => {
    const isLeft = index < 10;
    const wingIndex = isLeft ? index : index - 10;
    const anchorIndex = isLeft ? leftAnchorIndices[wingIndex] : rightAnchorIndices[wingIndex];
    const anchor = WING_ANCHORS[anchorIndex];

    // Organic randomized jitter to keep coordinates living and non-rigid
    const jitterTop = (Math.random() * 5 - 2.5);
    const topPercent = Math.max(5, Math.min(91, anchor.topPercent + jitterTop)).toFixed(1);

    const jitterPx = Math.round(Math.random() * 20 - 10);
    const px = Math.max(12, anchor.depthPx + jitterPx);

    const jitterVw = (Math.random() * 1.4 - 0.7);
    const vw = Math.max(1.0, anchor.depthVw + jitterVw).toFixed(1);

    const cardWidthMin = 90 + Math.round(Math.random() * 16);
    const cardWidthVw = (6.0 + Math.random() * 1.4).toFixed(1);
    const cardWidthMax = 125 + Math.round(Math.random() * 20);

    const rotation = (Math.random() * 6 - 3).toFixed(1);
    const delay = `${Math.round(Math.random() * 450)}ms`;
    const label = CONSTELLATION_LABELS[Math.floor(Math.random() * CONSTELLATION_LABELS.length)];

    const style: React.CSSProperties = {
      top: `${topPercent}%`,
      width: `clamp(${cardWidthMin}px, ${cardWidthVw}vw, ${cardWidthMax}px)`,
      transform: `rotate(${rotation}deg)`,
      ...(isLeft
        ? { left: `clamp(${px}px, ${vw}vw, calc(50vw - 230px))` }
        : { right: `clamp(${px}px, ${vw}vw, calc(50vw - 230px))` }),
    };

    return {
      ...entry,
      slot: index,
      style,
      delay,
      label,
      visibilityClass: anchor.visibilityClass,
    };
  });
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

  const [centerIcon, setCenterIcon] = useState<{ idx: number; type: 'play' | 'pause'; id: number } | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | null>(null);

  // Enhanced Shorts Experience States
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [is2XSpeed, setIs2XSpeed] = useState(false);
  const [likeHeart, setLikeHeart] = useState<{ id: number } | null>(null);

  // Living Constellation: Recommended Shorts in Outer Flanks
  const [recommendedDeck, setRecommendedDeck] = useState<ConstellationCard[]>([]);
  const [isHoveredRecommendation, setIsHoveredRecommendation] = useState(false);
  const [deckCycleKey, setDeckCycleKey] = useState(0);

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

  // Desktop vs Mobile layout detection (lg: = 1024px)
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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

  // Living Constellation: Recommended Shorts Dynamic Positioning & Periodic Sampler (10s cycle)
  useEffect(() => {
    if (!isOpen || !isDesktop || shorts.length <= 2) return;

    const sampleRecommendations = () => {
      if (isHoveredRecommendation) return; // Freeze rotation while user is hovering to view/click
      const cards = generateDynamicConstellation(shorts, activeIndex);
      if (cards.length === 0) return;
      setRecommendedDeck(cards);
      setDeckCycleKey((k) => k + 1);
    };

    sampleRecommendations();
    const timer = setInterval(sampleRecommendations, 10000);
    return () => clearInterval(timer);
  }, [isOpen, isDesktop, activeIndex, shorts, isHoveredRecommendation]);

  // Unified short navigation handler for cards, keys, and gestures
  const goToShortIndex = useCallback((targetIdx: number, dir: 'next' | 'prev') => {
    if (targetIdx < 0 || targetIdx >= shorts.length) return;
    hapticLight();
    setSlideDirection(dir);
    setActiveIndex(targetIdx);
    setCurrentTime(0);
    setDuration(0);
    onIndexChange?.(targetIdx);
    setShowControls(false);
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    if (shorts[targetIdx]) {
      updateBrowserUrl('/shorts/' + getMediaShortId(shorts[targetIdx]), true);
    }
    if (!isDesktop && containerRef.current) {
      slideRefs.current[targetIdx]?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'start' });
    }
  }, [shorts, isDesktop, onIndexChange]);

  // Desktop mouse movement reveals HUD and resets 2.5s idle timer (suppressed on touch gestures)
  const handleMouseMove = useCallback(() => {
    if (Date.now() - lastTouchTimeRef.current < 800) return;
    setShowControls(true);
    scheduleAutoHide();
  }, [scheduleAutoHide]);

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
  }, [isOpen, activeIndex, onClose, scheduleAutoHide, isDesktop, goToShortIndex, shorts.length]);

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

    return (
      <div
        key={`video-card-${idx}-${slideDirection || 'init'}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => handleVideoPointerDown(e, idx)}
        onPointerMove={handleVideoPointerMove}
        onPointerUp={(e) => handleVideoPointerUp(e, idx)}
        onPointerCancel={() => handleVideoPointerCancel(idx)}
        style={{
          maxWidth: isDesktop ? (isLandscape ? 'calc(100vw - 560px)' : '420px') : '100%',
          maxHeight: isDesktop ? '85vh' : '100%',
        }}
        className={`relative z-20 w-full h-full flex items-center justify-center transition-all duration-300 cursor-pointer select-none overflow-hidden ${
          isLandscape
            ? 'w-full md:aspect-[16/9] md:bg-neutral-950/80 md:backdrop-blur-xl md:border md:border-neutral-800 md:shadow-2xl md:rounded-lg'
            : 'w-full md:bg-neutral-950/80 md:backdrop-blur-xl md:border md:border-neutral-800 md:shadow-2xl md:rounded-lg'
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
              className="w-full h-full object-contain rounded-none md:rounded-lg shadow-2xl bg-black md:bg-transparent"
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                if (v.videoWidth && v.videoHeight) {
                  const isWide = v.videoWidth > v.videoHeight;
                  setLandscapeMap((prev) => (prev[idx] === isWide ? prev : { ...prev, [idx]: isWide }));
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
    );
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
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[9999] bg-black md:bg-neutral-950/70 md:backdrop-blur-md flex flex-col items-center select-none overflow-hidden font-serif animate-backdrop-fade cursor-pointer"
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

      {/* ===== LIVING CONSTELLATION: AMBIENT RECOMMENDED SHORTS (LEFT & RIGHT WINGS) ===== */}
      {isDesktop && recommendedDeck.map(({ item, originalIndex, slot, style, delay, label, visibilityClass }) => {
        if (!item) return null;
        const thumbUrl = getThumbnailUrl(item) || (item.thumbnail ? getMediaUrl(item.thumbnail) : '');

        return (
          <div
            key={`constellation-${deckCycleKey}-${item.id || originalIndex}-${slot}`}
            onClick={(e) => {
              e.stopPropagation();
              goToShortIndex(originalIndex, originalIndex > activeIndex ? 'next' : 'prev');
            }}
            onMouseEnter={() => setIsHoveredRecommendation(true)}
            onMouseLeave={() => setIsHoveredRecommendation(false)}
            style={{
              ...style,
              animationDelay: delay,
            }}
            className={`fixed z-10 items-center justify-center group cursor-pointer pointer-events-auto transition-all duration-700 opacity-40 hover:opacity-100 hover:scale-105 hover:z-30 animate-constellation-in ${visibilityClass}`}
            title={item.title || 'Recommended Short'}
          >
            <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-neutral-950/80 border border-white/10 group-hover:border-[#ccff00]/70 group-hover:shadow-[0_0_20px_rgba(204,255,0,0.3)] transition-all duration-300 backdrop-blur-sm">
              <img
                src={thumbUrl}
                alt={item.title || 'Recommended short'}
                className="w-full h-full object-cover brightness-[0.5] group-hover:brightness-[0.9] transition-all duration-300"
                loading="lazy"
              />

              {/* Ambient discovery badge */}
              <div className="absolute top-2 left-2 z-20 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/75 border border-[#ccff00]/30 backdrop-blur-md">
                <Sparkles className="w-2.5 h-2.5 text-[#ccff00]" />
                <span className="text-[8px] font-mono font-bold tracking-wider text-[#ccff00] uppercase">
                  {label}
                </span>
              </div>

              {/* Hover play prompt */}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                <div className="w-9 h-9 rounded-full bg-[#ccff00] text-black flex items-center justify-center shadow-[0_0_15px_rgba(204,255,0,0.5)]">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
              </div>

              {/* Title snippet */}
              <div className="absolute bottom-2 inset-x-0 px-2 text-center pointer-events-none">
                <p className="text-[10px] text-neutral-300 group-hover:text-white line-clamp-1 font-sans drop-shadow-md">
                  {item.title || 'Short'}
                </p>
              </div>
            </div>
          </div>
        );
      })}

      {/* ===== DESKTOP FLOATING EDGE NAVIGATION ARROWS (OUTLINE-FREE CANVAS) ===== */}
      {isDesktop && activeIndex > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goToShortIndex(activeIndex - 1, 'prev');
          }}
          className={`fixed left-3.5 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-black/75 hover:bg-[#ccff00] hover:text-black text-white/80 border border-white/20 flex items-center justify-center transition-all duration-300 shadow-2xl backdrop-blur-md cursor-pointer active:scale-95 ${
            showControls ? 'opacity-90 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          title="Previous Short (Left Arrow)"
        >
          <ChevronLeft className="w-6 h-6 -ml-0.5" />
        </button>
      )}

      {isDesktop && activeIndex < shorts.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goToShortIndex(activeIndex + 1, 'next');
          }}
          className={`fixed right-3.5 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-black/75 hover:bg-[#ccff00] hover:text-black text-white/80 border border-white/20 flex items-center justify-center transition-all duration-300 shadow-2xl backdrop-blur-md cursor-pointer active:scale-95 ${
            showControls ? 'opacity-90 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          title="Next Short (Right Arrow)"
        >
          <ChevronRight className="w-6 h-6 -mr-0.5" />
        </button>
      )}
      {/* Desktop Stage (In-Place 5-Card Deck Centerpiece) vs Mobile Scroll-Snap Reels */}
      {isDesktop ? (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-transparent pointer-events-none select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="pointer-events-auto flex items-center justify-center">
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
    </div>
  );
};

export default ShortsFeedModal;
