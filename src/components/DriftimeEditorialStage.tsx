/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Play, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { getDirectImageUrl, getUnsplashFallback, ensureHttps } from '../utils/imageUrlResolver';
import type { AlbumData, StageMediaItem } from '../types';

export type DriftimeVariant =
  | 'filmstrip'
  | 'staggered'
  | 'diptych'
  | 'cinematic'
  | 'shorts'
  | 'coming-soon';

interface DriftimeEditorialStageProps {
  album: AlbumData;
  isActive: boolean;
  onSelectItem: (item: StageMediaItem) => void;
  onActiveIndexChange?: (index: number) => void;
  variant?: DriftimeVariant;
  isVisible?: boolean;
  isLoading?: boolean;
}

export const DriftimeEditorialStage: React.FC<DriftimeEditorialStageProps> = ({
  album,
  isActive,
  onSelectItem,
  onActiveIndexChange,
  variant = 'filmstrip',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoveredCardIdx, setHoveredCardIdx] = useState<number | null>(null);

  const isComingSoon =
    album.itemCount === 0 || album.layoutType.startsWith('coming-soon');

  // Prepare display items: ensure at least 8-12 items for continuous flow
  const items = useMemo(() => {
    if (isComingSoon) return [];
    const raw = album.items || [];
    if (raw.length === 0) return [];
    if (raw.length >= 10) return raw;
    // Repeat items to fill editorial stream
    const duplicated: StageMediaItem[] = [];
    let i = 0;
    while (duplicated.length < 12) {
      const base = raw[i % raw.length];
      duplicated.push({
        ...base,
        id: `${base.id}-stream-${duplicated.length}`,
      });
      i++;
    }
    return duplicated;
  }, [album.items, isComingSoon]);

  // Scrubbing & Physics state
  const scrollOffsetRef = useRef(0);
  const velocityRef = useRef(0);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, scrollX: 0, time: 0 });
  const hasDraggedRef = useRef(false);
  const isHoveredRef = useRef(false);
  const lastInteractionTimeRef = useRef(Date.now());



  // Maximum scroll constraint computed dynamically
  const maxScrollRef = useRef(0);

  const updateMaxScroll = useCallback(() => {
    if (!containerRef.current || !trackRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const trackWidth = trackRef.current.scrollWidth;
    maxScrollRef.current = Math.max(0, trackWidth - containerWidth + 120);
  }, []);

  useEffect(() => {
    updateMaxScroll();
    window.addEventListener('resize', updateMaxScroll);

    let observer: ResizeObserver | null = null;
    if (trackRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        updateMaxScroll();
      });
      observer.observe(trackRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateMaxScroll);
      observer?.disconnect();
    };
  }, [items, updateMaxScroll]);

  // ================= 60/120 FPS PHYSICS & MOMENTUM LOOP =================
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 16.67, 2.5);
      lastTime = now;

      if (!isDraggingRef.current) {
        // 1. Momentum glide damping
        if (Math.abs(velocityRef.current) > 0.1) {
          scrollOffsetRef.current += velocityRef.current * dt;
          velocityRef.current *= Math.pow(0.92, dt);
        } else {
          velocityRef.current = 0;
        }

        // 2. Elastic edge bounds
        const maxScroll = maxScrollRef.current;
        if (scrollOffsetRef.current < 0) {
          scrollOffsetRef.current += (0 - scrollOffsetRef.current) * 0.12 * dt;
          velocityRef.current *= 0.5;
        } else if (scrollOffsetRef.current > maxScroll && maxScroll > 0) {
          scrollOffsetRef.current += (maxScroll - scrollOffsetRef.current) * 0.12 * dt;
          velocityRef.current *= 0.5;
        }
      }

      // Apply transform directly to track DOM element for zero React lag
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${-scrollOffsetRef.current}px, 0, 0)`;
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // ================= 5-SECOND IDLE AUTO-DRIFT =================
  useEffect(() => {
    if (isComingSoon || !isActive) return;

    const timer = setInterval(() => {
      const now = Date.now();
      // If user hasn't interacted in the last 4.5 seconds and is not hovering
      if (!isHoveredRef.current && !isDraggingRef.current && now - lastInteractionTimeRef.current >= 4500) {
        const step = window.innerWidth < 768 ? 280 : 420;
        const maxScroll = maxScrollRef.current;

        // Smooth drift from right to left
        let nextTarget = scrollOffsetRef.current + step;
        if (nextTarget > maxScroll) {
          nextTarget = 0; // Seamless loop back to origin
        }

        // Spring ease to nextTarget
        const start = scrollOffsetRef.current;
        const distance = nextTarget - start;
        const startTime = performance.now();
        const duration = 1200;

        const animateDrift = (t: number) => {
          if (isDraggingRef.current || isHoveredRef.current) return;
          const elapsed = t - startTime;
          const progress = Math.min(elapsed / duration, 1);
          // Cubic ease-out
          const ease = 1 - Math.pow(1 - progress, 3);
          scrollOffsetRef.current = start + distance * ease;

          if (progress < 1) {
            requestAnimationFrame(animateDrift);
          }
        };

        requestAnimationFrame(animateDrift);
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [isComingSoon, isActive]);

  // ================= POINTER DRAG & SWIPE HANDLERS =================
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    velocityRef.current = 0;
    lastInteractionTimeRef.current = Date.now();

    dragStartRef.current = {
      x: e.clientX,
      scrollX: scrollOffsetRef.current,
      time: performance.now(),
    };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;

    const dx = e.clientX - dragStartRef.current.x;
    if (Math.abs(dx) > 6) {
      hasDraggedRef.current = true;
    }

    const now = performance.now();
    const dt = Math.max(now - dragStartRef.current.time, 10);
    const instantVelocity = -dx / (dt * 0.12);

    scrollOffsetRef.current = dragStartRef.current.scrollX - dx;
    velocityRef.current = instantVelocity * 0.7;
    lastInteractionTimeRef.current = Date.now();
  }, []);

  const handlePointerUp = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      lastInteractionTimeRef.current = Date.now();
    }
  }, []);

  // Trackpad / Horizontal Wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // If horizontal or trackpad delta is present
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) > 4) {
      scrollOffsetRef.current += delta * 0.75;
      velocityRef.current = delta * 0.2;
      lastInteractionTimeRef.current = Date.now();
      updateMaxScroll();
    }
  }, [updateMaxScroll]);

  // Arrow button step
  const handleStep = useCallback((direction: 'left' | 'right') => {
    const step = window.innerWidth < 768 ? 320 : 500;
    const target = direction === 'right'
      ? Math.min(scrollOffsetRef.current + step, maxScrollRef.current)
      : Math.max(scrollOffsetRef.current - step, 0);

    const start = scrollOffsetRef.current;
    const distance = target - start;
    const startTime = performance.now();
    const duration = 650;

    const animStep = (t: number) => {
      const elapsed = t - startTime;
      const p = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      scrollOffsetRef.current = start + distance * ease;

      if (p < 1) {
        requestAnimationFrame(animStep);
      }
    };

    requestAnimationFrame(animStep);
    lastInteractionTimeRef.current = Date.now();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        handleStep('right');
      } else if (e.key === 'ArrowLeft') {
        handleStep('left');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isActive, handleStep]);

  // ================= COMING SOON MONOLITH =================
  if (isComingSoon) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-black select-none p-6">
        <div className="absolute inset-0 pointer-events-none opacity-[0.025] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.9)_100%)]" />

        {/* Minimalist Editorial Monolith Card */}
        <div className="relative z-10 w-full max-w-lg aspect-[4/5] sm:aspect-[16/10] rounded-2xl bg-[#09090b] border border-white/[0.07] shadow-2xl flex flex-col items-center justify-center p-8 overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-transparent pointer-events-none" />
          <div className="w-12 h-12 rounded-full border border-white/[0.08] flex items-center justify-center mb-6 bg-white/[0.02]">
            <Sparkles className="w-5 h-5 text-zinc-600 animate-pulse" />
          </div>
          <div className="w-8 h-[1px] bg-white/10 mb-4" />
          <span className="font-mono text-[10px] tracking-[0.3em] text-zinc-700 uppercase text-center">
            Future Vault / Unreleased
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      onMouseEnter={() => {
        isHoveredRef.current = true;
      }}
      onMouseLeave={() => {
        isHoveredRef.current = false;
      }}
      style={{ touchAction: 'none' }}
      className="relative w-full h-full overflow-hidden select-none cursor-grab active:cursor-grabbing bg-black z-0 flex flex-col justify-end pb-8 sm:pb-12 md:pb-16"
    >
      {/* 1. Subtle hairline architectural dot grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.035] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:32px_32px]" />

      {/* 2. Soft atmospheric vignette */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.85)_100%)] z-10" />

      {/* ================= REFINED ALBUM HEADLINE ================= */}
      <div className="absolute top-16 sm:top-20 md:top-24 left-5 sm:left-10 md:left-16 z-10 pointer-events-none select-none max-w-[85vw]">
        <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black font-space tracking-tight text-zinc-100 uppercase leading-none truncate">
          {album.name}{' '}
          <span className="text-zinc-600 text-xl sm:text-3xl md:text-4xl font-mono align-baseline">
            ({isComingSoon ? 0 : album.items.length})
          </span>
        </h1>
      </div>

      {/* 3. The Continuous Driftime Editorial Horizontal Track */}
      <div
        ref={trackRef}
        className="flex items-center gap-4 sm:gap-6 px-8 sm:px-16 md:px-24 will-change-transform z-20"
      >
        {items.length === 0 ? (
          /* Non-blocking skeleton pulse placeholders while catalog resolves */
          Array.from({ length: 6 }).map((_, idx) => {
            const staggeredOffset =
              variant === 'staggered'
                ? idx % 2 === 0
                  ? 'translate-y-[-16px] sm:translate-y-[-24px]'
                  : 'translate-y-[16px] sm:translate-y-[24px]'
                : '';

            const diptychMargin =
              variant === 'diptych'
                ? idx % 2 === 0
                  ? 'mr-1 sm:mr-2.5'
                  : 'mr-5 sm:mr-8'
                : '';

            let heightClass = 'h-[36vh] sm:h-[42vh] md:h-[46vh] aspect-[3/4]';
            if (variant === 'cinematic') {
              heightClass = 'h-[34vh] sm:h-[38vh] md:h-[42vh] aspect-[16/9]';
            } else if (variant === 'shorts') {
              heightClass = 'h-[38vh] sm:h-[46vh] md:h-[50vh] aspect-[9/16]';
            }

            return (
              <div
                key={`skeleton-card-${idx}`}
                className={`relative flex-shrink-0 rounded-xl sm:rounded-2xl overflow-hidden bg-[#09090b] border border-white/[0.04] shadow-xl select-none ${heightClass} ${staggeredOffset} ${diptychMargin} animate-pulse`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.015] to-transparent animate-shimmer" />
              </div>
            );
          })
        ) : (
          items.map((item, idx) => {
            const directUrl = getDirectImageUrl(item, idx);
            const fallbackUrl = getUnsplashFallback(idx);
            const isCardHovered = hoveredCardIdx === idx;

            // Alternating vertical rhythm for staggered variant
            const staggeredOffset =
              variant === 'staggered'
                ? idx % 2 === 0
                  ? 'translate-y-[-16px] sm:translate-y-[-24px]'
                  : 'translate-y-[16px] sm:translate-y-[24px]'
                : '';

            // Architectural diptych pairing: tight hairline gap within a pair, wider gap between pairs
            const diptychMargin =
              variant === 'diptych'
                ? idx % 2 === 0
                  ? 'mr-1 sm:mr-2.5'
                  : 'mr-5 sm:mr-8'
                : '';

            // Height bounds fitting dynamically beneath the massive headline
            let heightClass = 'h-[36vh] sm:h-[42vh] md:h-[46vh]';
            if (variant === 'cinematic') {
              heightClass = 'h-[34vh] sm:h-[38vh] md:h-[42vh]';
            } else if (variant === 'shorts') {
              heightClass = 'h-[38vh] sm:h-[46vh] md:h-[50vh]';
            }

            return (
              <div
                key={item.id || `driftime-card-${idx}`}
                onMouseEnter={() => setHoveredCardIdx(idx)}
                onMouseLeave={() => setHoveredCardIdx(null)}
                onClick={() => {
                  if (!hasDraggedRef.current) {
                    onActiveIndexChange?.(idx);
                    onSelectItem(item);
                  }
                }}
                role="article"
                aria-label={item.title ? `${item.title} — ${album.name}` : `${album.name} media item`}
                className={`relative flex-shrink-0 cursor-pointer group rounded-xl sm:rounded-2xl overflow-hidden bg-[#0c0e12] border border-white/[0.07] shadow-2xl hover:shadow-[0_24px_60px_rgba(0,0,0,0.95)] hover:border-white/20 transition-all duration-300 ease-out hover:scale-[1.018] hover:-translate-y-1 select-none animate-fade-in ${heightClass} ${staggeredOffset} ${diptychMargin}`}
              >
              {/* Media Card Presentation: Native Video for clips or Image for photos */}
              {item.type === 'video' && item.url.includes('huggingface.co') ? (
                <video
                  src={encodeURI(ensureHttps(item.url))}
                  preload="metadata"
                  muted
                  playsInline
                  autoPlay={isCardHovered}
                  loop
                  aria-label={item.title ? `${item.title} — Video Stream` : 'Cinematic Video Stream'}
                  onLoadedMetadata={updateMaxScroll}
                  className="h-full w-auto max-w-[85vw] object-contain block group-hover:scale-104 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] select-none pointer-events-none"
                />
              ) : (
                <img
                  src={directUrl}
                  alt={item.title ? `${item.title} — ${album.name}` : `Editorial Photography — ${album.name}`}
                  loading="lazy"
                  draggable={false}
                  onLoad={updateMaxScroll}
                  onError={(e) => {
                    e.currentTarget.src = fallbackUrl;
                  }}
                  className="h-full w-auto max-w-[85vw] object-contain block group-hover:scale-104 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] select-none pointer-events-none"
                />
              )}

              {/* Legacy iframe fallback for non-direct video items */}
              {item.type === 'video' && !item.url.includes('huggingface.co') && isCardHovered && (
                <iframe
                  src={`${ensureHttps(item.url)}?autoplay=1&mute=1`}
                  className="absolute inset-0 w-full h-full border-0 pointer-events-none z-10 scale-105"
                  allow="autoplay; encrypted-media"
                  title="Silent Looping Video Preview"
                />
              )}

              {/* Specular gloss highlight on hover */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] to-white/[0.18] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Video Play Glyph indicator for cinematic/video formats */}
              {(variant === 'cinematic' || variant === 'shorts' || item.type === 'video') && !isCardHovered && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/25 backdrop-blur-[1px]">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                </div>
              )}

              {/* Razor-thin border sheen on hover */}
              <div className="pointer-events-none absolute inset-0 rounded-xl sm:rounded-2xl border border-transparent group-hover:border-white/15 transition-colors duration-300" />
            </div>
          );
        }))}
      </div>

      {/* 4. Minimalist Navigation Chevrons */}
      <div className="absolute bottom-5 right-5 sm:bottom-6 sm:right-6 z-30 flex items-center gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); handleStep('left'); }}
          className="p-2 sm:p-2.5 rounded-xl bg-black/60 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-100 border border-white/[0.07] hover:border-white/15 backdrop-blur-xl transition-all duration-200 cursor-pointer"
          title="Previous"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleStep('right'); }}
          className="p-2 sm:p-2.5 rounded-xl bg-black/60 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-100 border border-white/[0.07] hover:border-white/15 backdrop-blur-xl transition-all duration-200 cursor-pointer"
          title="Next"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
