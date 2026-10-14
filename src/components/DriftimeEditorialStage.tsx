/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { MediaCard } from './MediaCard';
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
  onSelectItem: (item: StageMediaItem, posterUrl?: string) => void;
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
  const hoveredCardIdxRef = useRef<number | null>(null);
  hoveredCardIdxRef.current = hoveredCardIdx;

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
  const lastWheelTimeRef = useRef(0);

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

  // ================= 60/120 FPS CONTINUOUS AUTO-SLIDE & MOMENTUM LOOP =================
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    const AUTO_SLIDE_SPEED = 30; // 30px per second: gentle, continuous right-to-left glide

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 16.67, 2.5);
      const secondsElapsed = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (!isDraggingRef.current) {
        // 1. Momentum glide damping when user just released a drag or wheel flick
        if (Math.abs(velocityRef.current) > 0.1) {
          scrollOffsetRef.current += velocityRef.current * dt;
          velocityRef.current *= Math.pow(0.92, dt);
        } else {
          velocityRef.current = 0;

          // 2. Smart continuous auto-slide (Right to Left):
          // Pauses strictly when mouse enters an individual card (hoveredCardIdx !== null).
          // Resumes immediately when cursor leaves the card.
          // Moving cursor over canvas, headers, section spacing, or between cards keeps sliding smoothly.
          // Pauses briefly on horizontal wheel/trackpad scroll, automatically resuming 800ms after scrolling stops.
          const isWheelActive = Date.now() - lastWheelTimeRef.current < 800;
          const isCardHovered = hoveredCardIdxRef.current !== null;

          if (!isWheelActive && !isCardHovered && !isComingSoon && isActive && items.length > 0) {
            scrollOffsetRef.current += AUTO_SLIDE_SPEED * secondsElapsed;
          }
        }

        // 3. Elastic edge bounds and seamless loop
        const maxScroll = maxScrollRef.current;
        if (maxScroll > 10) {
          if (scrollOffsetRef.current >= maxScroll + 30) {
            // Smoothly wrap around to beginning of reel
            scrollOffsetRef.current = 0;
          } else if (scrollOffsetRef.current < -60) {
            scrollOffsetRef.current += (0 - scrollOffsetRef.current) * 0.12 * dt;
            velocityRef.current *= 0.5;
          }
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
  }, [isActive, isComingSoon, items.length]);

  // ================= POINTER DRAG & SWIPE HANDLERS =================
  const isPointerCapturedRef = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    isPointerCapturedRef.current = false;
    velocityRef.current = 0;

    dragStartRef.current = {
      x: e.clientX,
      scrollX: scrollOffsetRef.current,
      time: performance.now(),
    };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;

    const dx = e.clientX - dragStartRef.current.x;
    if (Math.abs(dx) > 12) {
      hasDraggedRef.current = true;
      if (!isPointerCapturedRef.current && e.currentTarget.setPointerCapture) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
          isPointerCapturedRef.current = true;
        } catch {
          // ignore capture errors
        }
      }
    }

    if (hasDraggedRef.current) {
      const now = performance.now();
      const dt = Math.max(now - dragStartRef.current.time, 10);
      const instantVelocity = -dx / (dt * 0.12);

      scrollOffsetRef.current = dragStartRef.current.scrollX - dx;
      velocityRef.current = instantVelocity * 0.7;
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      if (isPointerCapturedRef.current && e.currentTarget.releasePointerCapture) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
      isDraggingRef.current = false;
      isPointerCapturedRef.current = false;
      setTimeout(() => {
        hasDraggedRef.current = false;
      }, 50);
    }
  }, []);

  // Trackpad / Horizontal Wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) > 4) {
      scrollOffsetRef.current += delta * 0.75;
      velocityRef.current = delta * 0.2;
      lastWheelTimeRef.current = Date.now();
      updateMaxScroll();
    }
  }, [updateMaxScroll]);

  // Keyboard navigation for left/right scrubbing
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      const step = window.innerWidth < 768 ? 320 : 500;
      if (e.key === 'ArrowRight') {
        const target = Math.min(scrollOffsetRef.current + step, maxScrollRef.current);
        scrollOffsetRef.current = target;
        lastWheelTimeRef.current = Date.now();
      } else if (e.key === 'ArrowLeft') {
        const target = Math.max(scrollOffsetRef.current - step, 0);
        scrollOffsetRef.current = target;
        lastWheelTimeRef.current = Date.now();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isActive]);

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
      style={{ touchAction: 'none' }}
      className="relative w-full h-full overflow-hidden select-none cursor-grab active:cursor-grabbing bg-black z-0 flex flex-col justify-end pb-8 sm:pb-12 md:pb-16 scrollbar-none [&::-webkit-scrollbar]:hidden"
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
                className={`relative flex-shrink-0 rounded-xl sm:rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900 to-black border border-white/[0.04] shadow-xl select-none ${heightClass} ${staggeredOffset} ${diptychMargin} animate-pulse`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.015] to-transparent animate-shimmer" />
              </div>
            );
          })
        ) : (
          items.map((item, idx) => {
            // Alternating vertical rhythm for staggered variant
            const staggeredOffset =
              variant === 'staggered'
                ? idx % 2 === 0
                  ? 'translate-y-[-16px] sm:translate-y-[-24px]'
                  : 'translate-y-[16px] sm:translate-y-[24px]'
                : '';

            // Architectural diptych pairing
            const diptychMargin =
              variant === 'diptych'
                ? idx % 2 === 0
                  ? 'mr-1 sm:mr-2.5'
                  : 'mr-5 sm:mr-8'
                : '';

            // Height bounds fitting dynamically beneath headline
            let heightClass = 'h-[36vh] sm:h-[42vh] md:h-[46vh]';
            if (variant === 'cinematic') {
              heightClass = 'h-[34vh] sm:h-[38vh] md:h-[42vh]';
            } else if (variant === 'shorts') {
              heightClass = 'h-[38vh] sm:h-[46vh] md:h-[50vh]';
            }

            return (
              <MediaCard
                key={item.id || `driftime-card-${idx}`}
                item={item}
                idx={idx}
                album={album}
                variant={variant}
                heightClass={heightClass}
                staggeredOffset={staggeredOffset}
                diptychMargin={diptychMargin}
                isHovered={hoveredCardIdx === idx}
                onHover={setHoveredCardIdx}
                onSelectItem={onSelectItem}
                onActiveIndexChange={onActiveIndexChange}
                updateMaxScroll={updateMaxScroll}
                hasDragged={() => hasDraggedRef.current}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
