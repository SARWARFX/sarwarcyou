/* oxlint-disable react/set-state-in-effect */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getDirectImageUrl, getUnsplashFallback } from '../utils/imageUrlResolver';
import type { AlbumData, StageMediaItem } from '../types';

interface Album2MasonryStageProps {
  album: AlbumData;
  isActive: boolean;
  onSelectItem: (item: StageMediaItem) => void;
  onActiveIndexChange?: (index: number) => void;
}

interface MasonryCardProps {
  item: StageMediaItem;
  slotIndex: number;
  displayIndex: number;
  motionPhase: 'idle' | 'sliding-out' | 'pre-slide-in';
  slideVector: { x: number; y: number; rotate: number };
  onSelect: (item: StageMediaItem) => void;
}

const MasonryCard: React.FC<MasonryCardProps> = ({
  item,
  slotIndex,
  displayIndex,
  motionPhase,
  slideVector,
  onSelect,
}) => {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, isHovered: false });

  const directUrl = useMemo(() => {
    return getDirectImageUrl(item, displayIndex);
  }, [item, displayIndex]);

  const fallbackUrl = useMemo(() => {
    return getUnsplashFallback(displayIndex);
  }, [displayIndex]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: x * 7, y: -y * 7, isHovered: true });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0, isHovered: false });
  };

  // Compute transform & opacity according to sliding shuffle phase and mouse tilt
  let transformStyle = 'translate3d(0, 0, 0) scale3d(1, 1, 1) rotate(0deg)';
  let opacityStyle = 1;
  let transitionStyle =
    'transform 0.75s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.75s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease';

  if (motionPhase === 'sliding-out') {
    transformStyle = `translate3d(${slideVector.x}px, ${slideVector.y}px, 0) scale3d(0.91, 0.91, 0.91) rotate(${slideVector.rotate}deg)`;
    opacityStyle = 0;
    transitionStyle =
      'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.55s cubic-bezier(0.4, 0, 0.2, 1)';
  } else if (motionPhase === 'pre-slide-in') {
    transformStyle = `translate3d(${-slideVector.x * 0.75}px, ${-slideVector.y * 0.75}px, 0) scale3d(0.93, 0.93, 0.93) rotate(${-slideVector.rotate * 0.5}deg)`;
    opacityStyle = 0;
    transitionStyle = 'none';
  } else if (tilt.isHovered) {
    transformStyle = `perspective(1000px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg) scale3d(1.03, 1.03, 1.03) translateY(-4px)`;
    transitionStyle = 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease';
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => onSelect(item)}
      style={{
        transform: transformStyle,
        opacity: opacityStyle,
        transition: transitionStyle,
        animation: `singleViewportFloat 8s ease-in-out infinite`,
        animationDelay: `${(slotIndex * 0.6) % 4}s`,
      }}
      className="group relative cursor-pointer rounded-2xl bg-white p-2.5 sm:p-3 border border-black/[0.06] shadow-[0_16px_36px_-8px_rgba(0,0,0,0.12),0_6px_16px_-4px_rgba(0,0,0,0.06)] hover:shadow-[0_28px_55px_-12px_rgba(0,0,0,0.20),0_12px_24px_-4px_rgba(0,0,0,0.08)] select-none will-change-transform flex items-center justify-center max-h-[38vh] sm:max-h-[40vh] max-w-full"
    >
      {/* Physical Museum Mount Bevel & Fine Outer Trim */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-xl bg-[#F0F2F5] transition-transform duration-300">
        {/* Aspect Ratio Container (Clamped to 34vh so it NEVER exceeds single screen viewport) */}
        <div
          style={{
            aspectRatio: aspectRatio ? `${aspectRatio}` : '4 / 3',
            maxHeight: 'calc((100vh - 190px) / 2)',
          }}
          className="relative w-auto h-auto max-h-[32vh] sm:max-h-[34vh] max-w-full flex items-center justify-center transition-[aspect-ratio] duration-300"
        >
          {/* Skeleton Pulse before load */}
          {!isLoaded && (
            <div className="absolute inset-0 bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 animate-pulse rounded-xl" />
          )}

          <img
            src={hasError ? fallbackUrl : directUrl}
            alt={item.title || `Gallery Print #${displayIndex + 1}`}
            loading="lazy"
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                const ratio = img.naturalWidth / img.naturalHeight;
                setAspectRatio(ratio);
              }
              setIsLoaded(true);
            }}
            onError={() => {
              if (!hasError) {
                setHasError(true);
              }
            }}
            className={`max-h-[32vh] sm:max-h-[34vh] max-w-full w-auto h-auto object-contain rounded-lg transition-opacity duration-500 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Subtle glossy photo print sheen reflection */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.06] to-white/[0.18] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

// Characteristic slide vectors for kinetic position shuffle
const SLIDE_VECTORS = [
  { x: -85, y: -35, rotate: -3.5 }, // Slot 0: Top-left
  { x: 0, y: -80, rotate: 2.0 },    // Slot 1: Top-center
  { x: 85, y: -35, rotate: 3.5 },    // Slot 2: Top-right
  { x: -85, y: 35, rotate: -2.5 },   // Slot 3: Bottom-left
  { x: 0, y: 80, rotate: -2.0 },     // Slot 4: Bottom-center
  { x: 85, y: 35, rotate: 2.5 },     // Slot 5: Bottom-right
];

export const Album2MasonryStage: React.FC<Album2MasonryStageProps> = ({
  album,
  isActive,
  onSelectItem,
}) => {
  const items = useMemo(() => album.items || [], [album.items]);
  const totalItems = items.length;

  // Single-screen visible slot count: 6 slots on desktop, 4 on mobile
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const slotCount = isDesktop ? 6 : 4;

  // Track the active item index per visible slot
  const [slotIndices, setSlotIndices] = useState<number[]>(() => {
    return Array.from({ length: 6 }, (_, i) => i % (totalItems || 1));
  });

  // Track motion phase for each slot ('idle' | 'sliding-out' | 'pre-slide-in')
  const [motionPhases, setMotionPhases] = useState<{
    [slot: number]: 'idle' | 'sliding-out' | 'pre-slide-in';
  }>({
    0: 'idle',
    1: 'idle',
    2: 'idle',
    3: 'idle',
    4: 'idle',
    5: 'idle',
  });

  const nextItemQueueIdxRef = useRef<number>(6 % Math.max(1, totalItems));
  const activeBatchRef = useRef<number>(0);

  // Initialize/reset slots when album items change
  useEffect(() => {
    setSlotIndices(Array.from({ length: 6 }, (_, i) => i % Math.max(1, totalItems)));
    nextItemQueueIdxRef.current = 6 % Math.max(1, totalItems);
    activeBatchRef.current = 0;
    setMotionPhases({
      0: 'idle',
      1: 'idle',
      2: 'idle',
      3: 'idle',
      4: 'idle',
      5: 'idle',
    });
  }, [totalItems]);

  // RAPID BATCHED PHOTO SWAPPING & SHUFFLE CHOREOGRAPHY:
  // Alternating batches transition every 2.65s so each photo stays on screen for exactly ~5.3s max!
  useEffect(() => {
    if (!isActive || totalItems <= slotCount) return;

    const interval = setInterval(() => {
      // Define 2 alternating batches (3 cards each on desktop, 2 on mobile)
      const batchSlots =
        activeBatchRef.current === 0
          ? isDesktop
            ? [0, 2, 4]
            : [0, 3]
          : isDesktop
          ? [1, 3, 5]
          : [1, 2];

      activeBatchRef.current = activeBatchRef.current === 0 ? 1 : 0;

      // Staggered slide-out for each card in the batch
      batchSlots.forEach((slot, idx) => {
        const staggerDelay = idx * 80;

        setTimeout(() => {
          // Phase 1: Slide Out & rotate
          setMotionPhases((prev) => ({ ...prev, [slot]: 'sliding-out' }));

          // Phase 2: Content Swap & Pre-slide-in offset
          setTimeout(() => {
            const nextItemIdx = nextItemQueueIdxRef.current;
            nextItemQueueIdxRef.current = (nextItemQueueIdxRef.current + 1) % totalItems;

            setSlotIndices((prev) => {
              const updated = [...prev];
              updated[slot] = nextItemIdx;
              return updated;
            });

            setMotionPhases((prev) => ({ ...prev, [slot]: 'pre-slide-in' }));

            // Phase 3: Slide gracefully into home position
            setTimeout(() => {
              setMotionPhases((prev) => ({ ...prev, [slot]: 'idle' }));
            }, 60);
          }, 550);
        }, staggerDelay);
      });
    }, 2650);

    return () => clearInterval(interval);
  }, [isActive, totalItems, slotCount, isDesktop]);

  return (
    <div className="absolute inset-0 w-full h-full bg-[#F7F8FA] overflow-hidden select-none z-0">
      <style>{`
        @keyframes singleViewportFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-3.5px);
          }
        }
      `}</style>

      {/* Background Studio Light Wash */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white via-[#F7F8FA] to-[#EEF0F4] opacity-90" />
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[380px] bg-gradient-to-b from-[#00D2FF]/[0.04] to-transparent blur-3xl" />

      {/* Strict 100vh Single-Screen Viewport Container (Zero internal scrolling) */}
      <div className="relative w-full h-full flex flex-col justify-center items-center px-4 sm:px-8 md:px-12 py-16 sm:py-20 box-border overflow-hidden">
        {/* Desktop 6-Card Single-Screen Dynamic Matrix (3 Columns x 2 Rows) */}
        {isDesktop && (
          <div className="w-full max-w-7xl h-full grid grid-cols-3 grid-rows-2 gap-4 sm:gap-6 lg:gap-8 items-center justify-center">
            {[0, 1, 2, 3, 4, 5].map((slot) => {
              const itemIdx = slotIndices[slot];
              const item = items[itemIdx] || items[0];
              if (!item) return null;

              return (
                <div key={`desktop-cell-${slot}`} className="w-full h-full flex items-center justify-center overflow-hidden">
                  <MasonryCard
                    item={item}
                    slotIndex={slot}
                    displayIndex={itemIdx}
                    motionPhase={motionPhases[slot] || 'idle'}
                    slideVector={SLIDE_VECTORS[slot]}
                    onSelect={onSelectItem}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Mobile / Tablet 4-Card Single-Screen Matrix (2 Columns x 2 Rows) */}
        {!isDesktop && (
          <div className="w-full max-w-2xl h-full grid grid-cols-2 grid-rows-2 gap-3 sm:gap-4 items-center justify-center">
            {[0, 1, 2, 3].map((slot) => {
              const itemIdx = slotIndices[slot];
              const item = items[itemIdx] || items[0];
              if (!item) return null;

              return (
                <div key={`mobile-cell-${slot}`} className="w-full h-full flex items-center justify-center overflow-hidden">
                  <MasonryCard
                    item={item}
                    slotIndex={slot}
                    displayIndex={itemIdx}
                    motionPhase={motionPhases[slot] || 'idle'}
                    slideVector={SLIDE_VECTORS[slot]}
                    onSelect={onSelectItem}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
