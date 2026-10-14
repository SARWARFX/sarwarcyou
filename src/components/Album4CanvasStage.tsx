/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { RotateCcw, Compass } from 'lucide-react';
import { getDirectImageUrl } from '../utils/imageUrlResolver';
import type { AlbumData, StageMediaItem } from '../types';

interface Album4CanvasStageProps {
  album: AlbumData;
  isActive: boolean;
  onSelectItem: (item: StageMediaItem) => void;
  onActiveIndexChange?: (index: number) => void;
  isVisible?: boolean;
}

interface InternalCard {
  id: string;
  item: StageMediaItem;
  // World space coordinates relative to canvas center (0, 0)
  x: number;
  y: number;
  // Momentum velocity
  vx: number;
  vy: number;
  // Natural resting tilt and current tilt
  targetRot: number;
  rot: number;
  // Visual dimensions
  width: number;
  height: number;
  // Dynamic layering
  zIndex: number;
  // Organic ambient drift parameters
  driftPhaseX: number;
  driftPhaseY: number;
  driftSpeed: number;
  driftRadius: number;
}

export const Album4CanvasStage: React.FC<Album4CanvasStageProps> = ({
  album,
  isActive,
  onSelectItem,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasLayerRef = useRef<HTMLDivElement>(null);
  const cardElementsRef = useRef<(HTMLDivElement | null)[]>([]);

  // Strictly map over the actual album items without artificial duplication
  const items = useMemo(() => {
    return album.items || [];
  }, [album.items]);

  // Physics state stored in refs for 60/120 FPS performance without React re-renders
  const panRef = useRef({ x: 0, y: 0 });
  const panVelocityRef = useRef({ x: 0, y: 0 });
  const isDraggingCanvasRef = useRef(false);
  const canvasDragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0, time: 0 });

  const activeCardIndexRef = useRef<number | null>(null);
  const cardDragStartRef = useRef({ x: 0, y: 0, cardX: 0, cardY: 0, time: 0 });
  const hasMovedRef = useRef(false);
  const highestZIndexRef = useRef(100);

  const [hoveredCardIdx, setHoveredCardIdx] = useState<number | null>(null);
  const [isCentered, setIsCentered] = useState(true);

  // Initialize scattered card layout
  const cardsRef = useRef<InternalCard[]>([]);

  // Build organic scattered distribution around origin (0, 0)
  useEffect(() => {
    const count = items.length;
    if (count === 0) return;

    const isMobile = window.innerWidth < 768;
    const cardBaseWidth = isMobile ? 210 : 300;

    // Golden-ratio inspired organic dispersion grid
    const cols = isMobile ? 3 : 5;
    const colSpacing = isMobile ? 260 : 380;
    const rowSpacing = isMobile ? 320 : 420;

    const newCards: InternalCard[] = items.map((item, idx) => {
      // Deterministic pseudo-random seed per index
      const seed1 = Math.sin(idx * 79.19) * 10000;
      const seed2 = Math.cos(idx * 43.17) * 10000;
      const seed3 = Math.sin(idx * 97.43) * 10000;

      const frac1 = seed1 - Math.floor(seed1);
      const frac2 = seed2 - Math.floor(seed2);
      const frac3 = seed3 - Math.floor(seed3);

      const col = (idx % cols) - Math.floor(cols / 2);
      const row = Math.floor(idx / cols) - Math.floor(count / cols / 2);

      // Subtle organic scatter jitter
      const jitterX = (frac1 - 0.5) * (colSpacing * 0.45);
      const jitterY = (frac2 - 0.5) * (rowSpacing * 0.45);

      const x = col * colSpacing + jitterX;
      const y = row * rowSpacing + jitterY;

      // Organic tilt between -3.5deg and +3.5deg
      const targetRot = (frac3 - 0.5) * 7;

      // Natural aspect ratios: mix of portraits (3:4, 4:5) and landscapes (4:3)
      const aspectVariants = [1.35, 1.25, 0.82, 1.4, 0.9, 1.15];
      const ratio = aspectVariants[idx % aspectVariants.length];
      const width = cardBaseWidth;
      const height = Math.round(width * ratio);

      return {
        id: item.id || `card-${idx}`,
        item,
        x,
        y,
        vx: 0,
        vy: 0,
        targetRot,
        rot: targetRot,
        width,
        height,
        zIndex: 10 + (idx % 25),
        driftPhaseX: frac1 * Math.PI * 2,
        driftPhaseY: frac2 * Math.PI * 2,
        driftSpeed: 0.6 + frac3 * 0.8,
        driftRadius: 10 + frac1 * 14,
      };
    });

    cardsRef.current = newCards;
    highestZIndexRef.current = 10 + newCards.length;
  }, [items]);

  // ================= MAIN 60/120 FPS PHYSICS ANIMATION LOOP =================
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const updatePhysics = (now: number) => {
      if (!isActive) {
        animId = requestAnimationFrame(updatePhysics);
        return;
      }

      const dt = Math.min((now - lastTime) / 16.67, 2.5); // normalized frame delta
      lastTime = now;

      // 1. Canvas Momentum & Pan Damping
      if (!isDraggingCanvasRef.current) {
        const panV = panVelocityRef.current;
        if (Math.abs(panV.x) > 0.05 || Math.abs(panV.y) > 0.05) {
          panRef.current.x += panV.x * dt;
          panRef.current.y += panV.y * dt;
          panV.x *= Math.pow(0.92, dt);
          panV.y *= Math.pow(0.92, dt);
        } else {
          panV.x = 0;
          panV.y = 0;
        }

        // Soft elastic containment (soft limits prevent losing the canvas)
        const isMobile = window.innerWidth < 768;
        const maxPanX = isMobile ? 1200 : 2200;
        const maxPanY = isMobile ? 1400 : 2000;

        if (Math.abs(panRef.current.x) > maxPanX) {
          const excess = panRef.current.x - Math.sign(panRef.current.x) * maxPanX;
          panRef.current.x -= excess * 0.08 * dt;
          panV.x *= 0.5;
        }
        if (Math.abs(panRef.current.y) > maxPanY) {
          const excess = panRef.current.y - Math.sign(panRef.current.y) * maxPanY;
          panRef.current.y -= excess * 0.08 * dt;
          panV.y *= 0.5;
        }
      }

      // Apply transform directly to canvas DOM element
      if (canvasLayerRef.current) {
        canvasLayerRef.current.style.transform = `translate3d(${panRef.current.x}px, ${panRef.current.y}px, 0)`;
      }

      // Track whether canvas is roughly centered
      const distFromCenter = Math.hypot(panRef.current.x, panRef.current.y);
      setIsCentered(distFromCenter < 120);

      // 2. Individual Cards Physics (Toss Momentum, Fluid Ambient Drift)
      const activeIdx = activeCardIndexRef.current;
      const cards = cardsRef.current;

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const el = cardElementsRef.current[i];
        if (!el) continue;

        let ambientX = 0;
        let ambientY = 0;

        if (i !== activeIdx) {
          // If in free-flight toss motion:
          if (Math.abs(card.vx) > 0.1 || Math.abs(card.vy) > 0.1) {
            card.x += card.vx * dt;
            card.y += card.vy * dt;
            // Dynamic rotation tilt proportional to horizontal velocity
            card.rot += card.vx * 0.08 * dt;
            // Gently pull tilt back toward resting targetRot
            card.rot += (card.targetRot - card.rot) * 0.04 * dt;

            // Natural air resistance / desk friction damping
            card.vx *= Math.pow(0.92, dt);
            card.vy *= Math.pow(0.92, dt);
          } else {
            card.vx = 0;
            card.vy = 0;
            // Smoothly ease tilt back to baseline
            card.rot += (card.targetRot - card.rot) * 0.08 * dt;

            // Idle Ambient Drift (organic fluid currents when undisturbed)
            ambientX = Math.sin(now * 0.0006 * card.driftSpeed + card.driftPhaseX) * card.driftRadius;
            ambientY = Math.cos(now * 0.00045 * card.driftSpeed + card.driftPhaseY) * card.driftRadius;
          }
        }

        // Apply high-performance direct transform
        const isHovered = hoveredCardIdx === i;
        const scale = isHovered ? 1.05 : 1;
        const finalX = card.x + ambientX;
        const finalY = card.y + ambientY;

        el.style.transform = `translate3d(${finalX}px, ${finalY}px, 0) rotate(${card.rot}deg) scale(${scale})`;
        el.style.zIndex = `${card.zIndex}`;
      }

      animId = requestAnimationFrame(updatePhysics);
    };

    animId = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animId);
  }, [hoveredCardIdx, isActive]);

  // ================= POINTER DRAG & PAN PHYSICS =================
  const handlePointerDownCard = useCallback((e: React.PointerEvent, cardIdx: number) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    activeCardIndexRef.current = cardIdx;
    hasMovedRef.current = false;

    const card = cardsRef.current[cardIdx];
    if (card) {
      // Bring card to highest z-index
      highestZIndexRef.current += 1;
      card.zIndex = highestZIndexRef.current;
      card.vx = 0;
      card.vy = 0;

      cardDragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        cardX: card.x,
        cardY: card.y,
        time: performance.now(),
      };
    }
  }, []);

  const handlePointerDownCanvas = useCallback((e: React.PointerEvent) => {
    // Only drag on primary pointer (left button or single touch)
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    isDraggingCanvasRef.current = true;
    hasMovedRef.current = false;
    panVelocityRef.current = { x: 0, y: 0 };

    canvasDragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
      time: performance.now(),
    };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const activeIdx = activeCardIndexRef.current;

    // 1. Dragging an individual card
    if (activeIdx !== null) {
      const start = cardDragStartRef.current;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;

      if (Math.hypot(dx, dy) > 5) {
        hasMovedRef.current = true;
      }

      const card = cardsRef.current[activeIdx];
      if (card) {
        const now = performance.now();
        const dt = Math.max(now - start.time, 10);

        // Instantaneous throw velocity
        const vx = (dx - (card.x - start.cardX)) / (dt * 0.12);
        const vy = (dy - (card.y - start.cardY)) / (dt * 0.12);

        card.x = start.cardX + dx;
        card.y = start.cardY + dy;
        card.vx = vx * 0.65;
        card.vy = vy * 0.65;
        card.rot = card.targetRot + card.vx * 0.45; // Dynamic tilt while dragging
      }
      return;
    }

    // 2. Panning the overall canvas
    if (isDraggingCanvasRef.current) {
      const start = canvasDragStartRef.current;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;

      if (Math.hypot(dx, dy) > 5) {
        hasMovedRef.current = true;
      }

      const now = performance.now();
      const dt = Math.max(now - start.time, 10);

      const vx = (dx - (panRef.current.x - start.panX)) / (dt * 0.15);
      const vy = (dy - (panRef.current.y - start.panY)) / (dt * 0.15);

      panRef.current.x = start.panX + dx;
      panRef.current.y = start.panY + dy;
      panVelocityRef.current.x = vx * 0.7;
      panVelocityRef.current.y = vy * 0.7;
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    const activeIdx = activeCardIndexRef.current;

    // Card released
    if (activeIdx !== null) {
      const card = cardsRef.current[activeIdx];
      if (card) {
        // If it was a clean click without significant drag: Open lightbox!
        if (!hasMovedRef.current) {
          onSelectItem(card.item);
        }
      }
      activeCardIndexRef.current = null;
    }

    // Canvas panning released
    if (isDraggingCanvasRef.current) {
      isDraggingCanvasRef.current = false;
    }
  }, [onSelectItem]);

  // Trackpad / Mouse Wheel diagonal panning
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // If the movement is mostly diagonal or horizontal, smoothly pan the canvas
    if (Math.abs(e.deltaX) > 10 || Math.abs(e.deltaY) > 10) {
      panRef.current.x -= e.deltaX * 0.75;
      panRef.current.y -= e.deltaY * 0.75;
      panVelocityRef.current.x = -e.deltaX * 0.15;
      panVelocityRef.current.y = -e.deltaY * 0.15;
    }
  }, []);

  // Smooth Re-Center Spring Action
  const handleRecenter = useCallback(() => {
    const startX = panRef.current.x;
    const startY = panRef.current.y;
    const startTime = performance.now();
    const duration = 750;

    const animateReturn = (time: number) => {
      const elapsed = time - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - t, 3);

      panRef.current.x = startX * (1 - ease);
      panRef.current.y = startY * (1 - ease);
      panVelocityRef.current = { x: 0, y: 0 };

      if (t < 1) {
        requestAnimationFrame(animateReturn);
      }
    };

    requestAnimationFrame(animateReturn);
  }, []);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDownCanvas}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      style={{ touchAction: 'none' }}
      data-disable-page-swipe="true"
      className="relative w-full h-full overflow-hidden select-none cursor-grab active:cursor-grabbing bg-[#0a0a0c] z-0"
    >
      {/* 1. Subtle tactile architectural drafting grid watermark */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.035] bg-[radial-gradient(#ffffff_1.2px,transparent_1.2px)] [background-size:36px_36px]" />

      {/* 2. Soft atmospheric vignette to focus the director's table */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.85)_100%)] z-10" />

      {/* 3. The Infinite Floating Spatial Canvas */}
      <div
        ref={canvasLayerRef}
        className="absolute top-1/2 left-1/2 w-0 h-0 will-change-transform"
      >
        {items.map((item, idx) => {
          const directUrl = getDirectImageUrl(item, idx);
          const isHovered = hoveredCardIdx === idx;

          return (
            <div
              key={item.id || `scatter-card-${idx}`}
              ref={(el) => {
                cardElementsRef.current[idx] = el;
              }}
              onPointerDown={(e) => handlePointerDownCard(e, idx)}
              onMouseEnter={() => setHoveredCardIdx(idx)}
              onMouseLeave={() => {
                if (hoveredCardIdx === idx) setHoveredCardIdx(null);
              }}
              style={{
                width: cardsRef.current[idx]?.width || 280,
                height: cardsRef.current[idx]?.height || 360,
                marginLeft: -(cardsRef.current[idx]?.width || 280) / 2,
                marginTop: -(cardsRef.current[idx]?.height || 360) / 2,
                touchAction: 'none',
              }}
              className={`absolute top-0 left-0 cursor-pointer group rounded-2xl overflow-hidden p-2 bg-[#0c0e14] border transition-all duration-300 will-change-transform ${
                isHovered
                  ? 'border-[#00D2FF]/80 shadow-[0_30px_70px_rgba(0,0,0,0.95),0_0_35px_rgba(0,210,255,0.35)] ring-1 ring-[#00D2FF]/40'
                  : 'border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.75)]'
              }`}
            >
              {/* Pure Photography Card Inner (ZERO text, labels, or badges) */}
              <div className="relative w-full h-full overflow-hidden rounded-xl bg-black">
                <img
                  src={directUrl}
                  alt="Photography Artboard"
                  loading="lazy"
                  draggable={false}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                  className="w-full h-full object-cover object-center pointer-events-none group-hover:scale-105 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] select-none"
                />

                {/* Tactile glossy specular light reflection on hover */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] to-white/[0.22] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Razor-thin photo border sheen */}
                <div className="pointer-events-none absolute inset-0 rounded-xl border border-white/10 group-hover:border-[#00D2FF]/40 transition-colors duration-300" />
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Minimal Floating Artboard HUD Pill (Center/Reset Canvas Control) */}
      <div className="absolute bottom-6 right-6 sm:bottom-8 sm:right-8 z-30 flex items-center gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRecenter();
          }}
          disabled={isCentered}
          title="Re-center Artboard"
          className={`flex items-center gap-2 px-3.5 py-2 rounded-full border backdrop-blur-xl transition-all duration-500 font-mono text-[11px] tracking-widest uppercase cursor-pointer ${
            isCentered
              ? 'opacity-40 border-white/5 bg-black/30 text-white/40 pointer-events-none'
              : 'opacity-90 hover:opacity-100 border-[#00D2FF]/40 bg-black/60 hover:bg-[#00D2FF]/10 text-[#00D2FF] shadow-[0_0_20px_rgba(0,210,255,0.2)]'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5 animate-spin-once" />
          <span className="hidden sm:inline">Center Canvas</span>
        </button>

        {/* Ambient Spatial Indicator */}
        <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 bg-black/40 backdrop-blur-xl text-white/50 font-mono text-[11px] tracking-wider">
          <Compass className="w-3.5 h-3.5 text-[#00D2FF]" />
          <span>DRAG TO PAN • TOSS CARDS</span>
        </div>
      </div>
    </div>
  );
};
