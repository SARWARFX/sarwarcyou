/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

import { MediaCard } from './MediaCard';
import type { AlbumData, StageMediaItem } from '../types';

export type DriftimeVariant =
  | 'filmstrip'
  | 'staggered'
  | 'diptych'
  | 'cinematic'
  | 'shorts';

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
  isLoading = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoveredCardIdx, setHoveredCardIdx] = useState<number | null>(null);
  const hoveredCardIdxRef = useRef<number | null>(null);
  hoveredCardIdxRef.current = hoveredCardIdx;

  // Strictly map over the actual album items without artificial duplication or dummy placeholders
  const items = useMemo(() => {
    return album.items || [];
  }, [album.items]);

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
    // Only allow scrolling when track exceeds container width
    maxScrollRef.current = trackWidth > containerWidth ? trackWidth - containerWidth + 60 : 0;
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

          // 2. Continuous auto-slide (Right to Left):
          // Only auto-slide when there are multiple items that overflow the viewport
          const isWheelActive = Date.now() - lastWheelTimeRef.current < 800;
          const isCardHovered = hoveredCardIdxRef.current !== null;

          if (
            !isWheelActive &&
            !isCardHovered &&
            isActive &&
            items.length > 1 &&
            maxScrollRef.current > 10
          ) {
            scrollOffsetRef.current += AUTO_SLIDE_SPEED * secondsElapsed;
          }
        }

        // 3. Elastic edge bounds and seamless loop
        const maxScroll = maxScrollRef.current;
        if (maxScroll <= 10) {
          // If items fit on screen (e.g. single item in H2027), lock left-aligned
          scrollOffsetRef.current = 0;
        } else {
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
  }, [isActive, items.length]);

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
          // pointer capture unsupported or already captured
        }
      }
    }

    // Only allow dragging if there's scrollable content
    if (maxScrollRef.current > 10) {
      scrollOffsetRef.current = dragStartRef.current.scrollX - dx;
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (isPointerCapturedRef.current && e.currentTarget.releasePointerCapture) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      isPointerCapturedRef.current = false;
    }

    if (maxScrollRef.current > 10) {
      const elapsed = (performance.now() - dragStartRef.current.time) / 1000;
      const dx = e.clientX - dragStartRef.current.x;
      if (elapsed > 0 && elapsed < 0.35 && Math.abs(dx) > 15) {
        velocityRef.current = (-dx / elapsed) * 0.016;
      }
    }
  }, []);

  // Horizontal wheel scroll
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Only handle horizontal wheel gestures or Shift+wheel
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
      e.stopPropagation();
      lastWheelTimeRef.current = Date.now();
      const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      if (maxScrollRef.current > 10) {
        scrollOffsetRef.current += delta;
        velocityRef.current = delta * 0.2;
      }
    }
  }, []);

  // Keyboard left/right scrub
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        if (maxScrollRef.current > 10) {
          scrollOffsetRef.current += 180;
          lastWheelTimeRef.current = Date.now();
        }
      } else if (e.key === 'ArrowLeft') {
        if (maxScrollRef.current > 10) {
          scrollOffsetRef.current -= 180;
          lastWheelTimeRef.current = Date.now();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isActive]);

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
            ({album.items.length})
          </span>
        </h1>
      </div>

      {/* 3. The Continuous Driftime Editorial Horizontal Track */}
      <div
        ref={trackRef}
        className="flex items-center gap-4 sm:gap-6 px-8 sm:px-16 md:px-24 will-change-transform z-20"
      >
        {isLoading && items.length === 0 ? (
          /* Non-blocking skeleton pulse placeholders strictly while catalog resolves */
          Array.from({ length: 4 }).map((_, idx) => {
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
