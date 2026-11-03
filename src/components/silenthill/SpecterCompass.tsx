import React, { useState, useRef, useEffect, useCallback } from 'react';

export type CardinalDirection = 'north' | 'south' | 'west' | 'east';

interface SpecterCompassProps {
  onSelectSection: (direction: CardinalDirection) => void;
  isNavDisabled?: boolean;
}

export const SpecterCompass: React.FC<SpecterCompassProps> = ({
  onSelectSection,
  isNavDisabled = false,
}) => {
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [activeTarget, setActiveTarget] = useState<CardinalDirection | null>(null);

  const dragStartRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  const currentOffsetRef = useRef({ x: 0, y: 0 });

  // Determine active cardinal target based on current drag direction
  const computeTarget = (dx: number, dy: number): CardinalDirection | null => {
    const dist = Math.hypot(dx, dy);
    if (dist < 20) return null;

    if (Math.abs(dy) > Math.abs(dx)) {
      return dy < 0 ? 'north' : 'south';
    } else {
      return dx < 0 ? 'west' : 'east';
    }
  };

  // Pointer Event Handlers for Dragging the Specter
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isNavDisabled || e.button !== 0) return;
    e.preventDefault();

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // fallback
    }

    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: performance.now(),
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const rawDx = e.clientX - dragStartRef.current.x;
    const rawDy = e.clientY - dragStartRef.current.y;

    // Elastic damping (max drag radius ~130px)
    const dist = Math.hypot(rawDx, rawDy);
    const maxRadius = 140;
    const dampedDist = Math.min(dist, maxRadius * Math.tanh(dist / maxRadius));
    const angle = Math.atan2(rawDy, rawDx);

    const nextX = Math.cos(angle) * dampedDist;
    const nextY = Math.sin(angle) * dampedDist;

    currentOffsetRef.current = { x: nextX, y: nextY };
    setDragOffset({ x: nextX, y: nextY });

    const target = computeTarget(nextX, nextY);
    setActiveTarget(target);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // fallback
    }

    const { x, y } = currentOffsetRef.current;
    const dist = Math.hypot(x, y);
    const dt = performance.now() - dragStartRef.current.time;
    const velocity = dt > 0 ? dist / dt : 0;

    // Threshold check: dragged > 70px or flicked quickly (> 0.45 px/ms with > 28px travel)
    const isCommitted = dist >= 70 || (velocity > 0.45 && dist > 28);

    if (isCommitted && activeTarget) {
      onSelectSection(activeTarget);
    }

    // Snap back to center
    setDragOffset({ x: 0, y: 0 });
    currentOffsetRef.current = { x: 0, y: 0 };
    setActiveTarget(null);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // fallback
    }
    setDragOffset({ x: 0, y: 0 });
    currentOffsetRef.current = { x: 0, y: 0 };
    setActiveTarget(null);
  };

  // Keyboard navigation fallback (Arrow keys)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isNavDisabled) return;
      const targetTag = (document.activeElement?.tagName || '').toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea') return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onSelectSection('north');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onSelectSection('south');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onSelectSection('west');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onSelectSection('east');
      }
    },
    [isNavDisabled, onSelectSection]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Dynamic visual styling for cardinal markers
  const getCardinalStyle = (dir: CardinalDirection) => {
    const isTarget = activeTarget === dir;
    const hasActiveTarget = activeTarget !== null;

    if (isTarget) {
      return {
        color: '#e69a47', // Rusted amber lantern luminescence
        textShadow: '0 0 20px rgba(230, 154, 71, 0.85), 0 0 40px rgba(212, 120, 36, 0.45), 0 2px 4px #000',
        transform: 'scale(1.08)',
        opacity: 1,
      };
    }

    if (hasActiveTarget) {
      return {
        color: '#707782',
        opacity: 0.22,
        transform: 'scale(0.96)',
      };
    }

    return {
      color: '#c2c8d2',
      opacity: 0.75,
      textShadow: '0 2px 8px rgba(0,0,0,0.9)',
      transform: 'scale(1)',
    };
  };

  return (
    <div
      className="relative w-full h-[100dvh] flex items-center justify-center select-none overflow-hidden touch-none"
      style={{ fontFamily: '"Times New Roman", Times, Georgia, serif' }}
    >
      {/* ------------------------------------------------------------- */}
      {/* 4 Cardinal Anchors */}
      {/* ------------------------------------------------------------- */}

      {/* NORTH: REALTube */}
      <button
        type="button"
        onClick={() => onSelectSection('north')}
        style={getCardinalStyle('north')}
        className="absolute top-10 sm:top-14 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center cursor-pointer transition-all duration-300 group tracking-[0.25em] text-xs sm:text-sm uppercase font-bold"
      >
        <span className="text-[10px] tracking-[0.4em] text-neutral-500 group-hover:text-amber-400/80 transition-colors mb-1">
          ▲ NORTH
        </span>
        <span className="drop-shadow-lg">REALTube</span>
        <div className="w-12 h-[1px] bg-neutral-700 mt-1.5 group-hover:w-20 group-hover:bg-amber-600 transition-all duration-500" />
      </button>

      {/* SOUTH: Short Clips */}
      <button
        type="button"
        onClick={() => onSelectSection('south')}
        style={getCardinalStyle('south')}
        className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center cursor-pointer transition-all duration-300 group tracking-[0.25em] text-xs sm:text-sm uppercase font-bold"
      >
        <div className="w-12 h-[1px] bg-neutral-700 mb-1.5 group-hover:w-20 group-hover:bg-amber-600 transition-all duration-500" />
        <span className="drop-shadow-lg">Short Clips</span>
        <span className="text-[10px] tracking-[0.4em] text-neutral-500 group-hover:text-amber-400/80 transition-colors mt-1">
          ▼ SOUTH
        </span>
      </button>

      {/* WEST: Video Clips */}
      <button
        type="button"
        onClick={() => onSelectSection('west')}
        style={getCardinalStyle('west')}
        className="absolute left-6 sm:left-14 top-1/2 -translate-y-1/2 z-20 flex flex-col items-start cursor-pointer transition-all duration-300 group tracking-[0.25em] text-xs sm:text-sm uppercase font-bold text-left"
      >
        <span className="text-[10px] tracking-[0.4em] text-neutral-500 group-hover:text-amber-400/80 transition-colors mb-1">
          ◀ WEST
        </span>
        <span className="drop-shadow-lg">Video Clips</span>
        <div className="w-12 h-[1px] bg-neutral-700 mt-1.5 group-hover:w-20 group-hover:bg-amber-600 transition-all duration-500" />
      </button>

      {/* EAST: Photography */}
      <button
        type="button"
        onClick={() => onSelectSection('east')}
        style={getCardinalStyle('east')}
        className="absolute right-6 sm:right-14 top-1/2 -translate-y-1/2 z-20 flex flex-col items-end cursor-pointer transition-all duration-300 group tracking-[0.25em] text-xs sm:text-sm uppercase font-bold text-right"
      >
        <span className="text-[10px] tracking-[0.4em] text-neutral-500 group-hover:text-amber-400/80 transition-colors mb-1">
          EAST ▶
        </span>
        <span className="drop-shadow-lg">Photography</span>
        <div className="w-12 h-[1px] bg-neutral-700 mt-1.5 group-hover:w-20 group-hover:bg-amber-600 transition-all duration-500" />
      </button>

      {/* ------------------------------------------------------------- */}
      {/* Central Draggable Apparition / Fog Specter */}
      {/* ------------------------------------------------------------- */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        style={{
          transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`,
          transition: isDragging ? 'none' : 'transform 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
        className={`relative z-30 cursor-grab active:cursor-grabbing p-8 select-none flex flex-col items-center justify-center will-change-transform ${
          isDragging ? 'scale-105' : 'hover:scale-102'
        }`}
      >
        {/* Shadowy silhouette apparition with soft blurred tendrils */}
        <div className="relative w-40 h-48 sm:w-48 sm:h-56 flex items-center justify-center pointer-events-none">
          {/* Outer Pulsing Eerie Fog Aura */}
          <div
            className={`absolute inset-0 rounded-full bg-gradient-to-b from-neutral-800/30 via-neutral-900/50 to-black/80 blur-2xl transition-opacity duration-300 ${
              isDragging ? 'opacity-90 scale-110' : 'opacity-60 animate-pulse'
            }`}
          />

          {/* Ghostly Specter SVG Silhouette with tendrils */}
          <svg
            viewBox="0 0 200 240"
            className="w-full h-full filter drop-shadow-[0_10px_25px_rgba(0,0,0,0.95)]"
          >
            <defs>
              <radialGradient id="specterGlow" cx="50%" cy="40%" r="50%">
                <stop offset="0%" stopColor="#1e2229" stopOpacity="0.95" />
                <stop offset="55%" stopColor="#0f1115" stopOpacity="0.85" />
                <stop offset="85%" stopColor="#08090b" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0" />
              </radialGradient>

              <filter id="mistBlur" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Drifting Mist Tendrils at Base */}
            <path
              d="M 40,190 C 20,220 50,235 70,215 C 90,240 120,230 140,218 C 160,235 185,215 170,185 C 150,140 160,110 140,80 C 130,50 120,35 100,35 C 80,35 70,50 60,80 C 40,110 50,140 30,185 Z"
              fill="url(#specterGlow)"
              filter="url(#mistBlur)"
            />

            {/* Ghostly Inner Apparition Core */}
            <path
              d="M 65,85 C 65,55 80,45 100,45 C 120,45 135,55 135,85 C 135,115 145,150 130,195 C 115,185 105,190 100,185 C 95,190 85,185 70,195 C 55,150 65,115 65,85 Z"
              fill="#060709"
              opacity="0.88"
            />

            {/* Faint Amber Embers (Eyes/Lantern reflection in the mist) */}
            <circle
              cx="91"
              cy="78"
              r="2.2"
              fill="#d48c38"
              className={isDragging ? 'opacity-100' : 'opacity-70 animate-pulse'}
              style={{ filter: 'drop-shadow(0 0 4px #e69a47)' }}
            />
            <circle
              cx="109"
              cy="78"
              r="2.2"
              fill="#d48c38"
              className={isDragging ? 'opacity-100' : 'opacity-70 animate-pulse'}
              style={{ filter: 'drop-shadow(0 0 4px #e69a47)' }}
            />
          </svg>
        </div>

        {/* Dynamic Drag Directional Guide Indicator */}
        <div className="mt-3 text-center pointer-events-none">
          <span
            className={`text-[11px] tracking-[0.3em] uppercase transition-all duration-300 font-serif ${
              activeTarget
                ? 'text-amber-400 font-bold drop-shadow-[0_0_8px_rgba(212,140,56,0.8)]'
                : 'text-neutral-500'
            }`}
          >
            {activeTarget ? `RELEASE TO ENTER ${activeTarget.toUpperCase()}` : 'DRAG TO NAVIGATE'}
          </span>
        </div>
      </div>

      {/* Atmospheric bottom subtitle hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center pointer-events-none z-10">
        <p className="text-[11px] tracking-[0.2em] text-neutral-500/80 font-serif italic">
          Drag the apparition or press arrow keys to breach the fog
        </p>
      </div>
    </div>
  );
};
