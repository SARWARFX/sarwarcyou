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
  displayIndex: number;
  isSwapping: boolean;
  onSelect: (item: StageMediaItem) => void;
}

const MasonryCard: React.FC<MasonryCardProps> = ({
  item,
  displayIndex,
  isSwapping,
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

  // Key on MasonryCard naturally re-mounts and resets load state on swap

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: x * 8, y: -y * 8, isHovered: true });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0, isHovered: false });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => onSelect(item)}
      style={{
        transform: isSwapping
          ? 'perspective(1000px) scale3d(0.94, 0.94, 0.94) translateY(-12px)'
          : tilt.isHovered
          ? `perspective(1000px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg) scale3d(1.025, 1.025, 1.025) translateY(-6px)`
          : 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1) translateY(0px)',
        opacity: isSwapping ? 0 : 1,
        transition: isSwapping
          ? 'opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1), transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)'
          : tilt.isHovered
          ? 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, opacity 0.65s ease'
          : 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.5s ease, opacity 0.65s ease',
        animation: `galleryFloat 7.5s ease-in-out infinite`,
        animationDelay: `${(displayIndex * 0.45) % 4.5}s`,
      }}
      className="group relative w-full cursor-pointer rounded-2xl bg-white p-3 sm:p-4 border border-black/[0.06] shadow-[0_22px_45px_-10px_rgba(0,0,0,0.12),0_10px_22px_-5px_rgba(0,0,0,0.06)] hover:shadow-[0_35px_70px_-15px_rgba(0,0,0,0.20),0_15px_30px_-5px_rgba(0,0,0,0.08)] select-none will-change-transform"
    >
      {/* Physical Museum Mount Bevel & Fine Outer Trim */}
      <div className="relative w-full overflow-hidden rounded-xl bg-[#F0F2F5] transition-transform duration-300">
        {/* Dynamic Aspect Ratio Container */}
        <div
          style={{
            aspectRatio: aspectRatio ? `${aspectRatio}` : '4 / 5',
          }}
          className="relative w-full flex items-center justify-center transition-[aspect-ratio] duration-300"
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
            className={`w-full h-full object-contain rounded-lg transition-opacity duration-500 ${
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

export const Album2MasonryStage: React.FC<Album2MasonryStageProps> = ({
  album,
  isActive,
  onSelectItem,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);

  const items = useMemo(() => album.items || [], [album.items]);
  const totalItems = items.length;

  // Dense visible slot count (up to 12 slots)
  const slotCount = useMemo(() => {
    return Math.max(1, Math.min(12, totalItems));
  }, [totalItems]);

  // Map each visible slot to an item index in album.items
  const [slotIndices, setSlotIndices] = useState<number[]>(() => {
    return Array.from({ length: Math.min(12, Math.max(1, totalItems)) }, (_, i) => i % (totalItems || 1));
  });

  // Track which slots are currently in fade-out / swapping state
  const [swappingSlots, setSwappingSlots] = useState<{ [slotIndex: number]: boolean }>({});
  const nextItemQueueIdxRef = useRef<number>(slotCount % Math.max(1, totalItems));

  // Reset slots when album items change
  useEffect(() => {
    setSlotIndices(Array.from({ length: slotCount }, (_, i) => i % Math.max(1, totalItems)));
    nextItemQueueIdxRef.current = slotCount % Math.max(1, totalItems);
    setSwappingSlots({});
  }, [slotCount, totalItems]);

  // Organic, staggered card swapping every ~5.5 seconds
  useEffect(() => {
    if (!isActive || totalItems <= slotCount) return;

    const interval = setInterval(() => {
      // Pick 1 or 2 random slots to swap
      const availableSlots = Array.from({ length: slotCount }, (_, i) => i).filter(
        (s) => !swappingSlots[s]
      );
      if (availableSlots.length === 0) return;

      const randomSlot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
      const nextItemIdx = nextItemQueueIdxRef.current;
      nextItemQueueIdxRef.current = (nextItemQueueIdxRef.current + 1) % totalItems;

      // Phase 1: Fade and float out
      setSwappingSlots((prev) => ({ ...prev, [randomSlot]: true }));

      // Phase 2: Swap content after 650ms and fade smoothly back in
      setTimeout(() => {
        setSlotIndices((prev) => {
          const updated = [...prev];
          updated[randomSlot] = nextItemIdx;
          return updated;
        });

        setTimeout(() => {
          setSwappingSlots((prev) => ({ ...prev, [randomSlot]: false }));
        }, 80);
      }, 650);
    }, 5500);

    return () => clearInterval(interval);
  }, [isActive, totalItems, slotCount, swappingSlots]);

  // Distribute slot indices into 3 wide columns (desktop) and 2 columns (mobile)
  const columns3 = useMemo(() => {
    const cols: number[][] = [[], [], []];
    slotIndices.forEach((_, slotIdx) => {
      cols[slotIdx % 3].push(slotIdx);
    });
    return cols;
  }, [slotIndices]);

  const columns2 = useMemo(() => {
    const cols: number[][] = [[], []];
    slotIndices.forEach((_, slotIdx) => {
      cols[slotIdx % 2].push(slotIdx);
    });
    return cols;
  }, [slotIndices]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollY(e.currentTarget.scrollTop);
  };

  useEffect(() => {
    if (!isActive && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [isActive]);

  return (
    <div className="absolute inset-0 w-full h-full bg-[#F7F8FA] overflow-hidden select-none z-0">
      <style>{`
        @keyframes galleryFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-4.5px);
          }
        }
      `}</style>

      {/* Background Studio Light Wash */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white via-[#F7F8FA] to-[#EEF0F4] opacity-90" />
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[400px] bg-gradient-to-b from-[#00D2FF]/[0.04] to-transparent blur-3xl" />

      {/* Scrollable Editorial Wall Container (Zero on-screen clutter or text headers) */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="relative w-full h-full overflow-y-auto overflow-x-hidden no-scrollbar px-5 sm:px-10 md:px-14 lg:px-20 pt-16 pb-24 overscroll-contain"
      >
        <div className="max-w-[1680px] mx-auto">
          {/* Desktop 3 Columns Layout with Subtle Parallax */}
          <div className="hidden lg:grid grid-cols-3 gap-7 xl:gap-8 items-start">
            {columns3.map((slotList, colIdx) => {
              const parallaxOffset = colIdx === 1 ? scrollY * -0.03 : scrollY * 0.02;

              return (
                <div
                  key={`col-3-${colIdx}`}
                  style={{ transform: `translateY(${parallaxOffset}px)` }}
                  className="flex flex-col gap-7 xl:gap-8 transition-transform duration-75 will-change-transform"
                >
                  {slotList.map((slotIdx) => {
                    const itemIdx = slotIndices[slotIdx];
                    const item = items[itemIdx] || items[0];
                    if (!item) return null;

                    return (
                      <MasonryCard
                        key={`slot-${slotIdx}-${item.id}`}
                        item={item}
                        displayIndex={itemIdx}
                        isSwapping={Boolean(swappingSlots[slotIdx])}
                        onSelect={onSelectItem}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Tablet / Mobile 2 Columns Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-6 sm:gap-7 items-start">
            {columns2.map((slotList, colIdx) => {
              const parallaxOffset = colIdx === 1 ? scrollY * -0.02 : 0;

              return (
                <div
                  key={`col-2-${colIdx}`}
                  style={{ transform: `translateY(${parallaxOffset}px)` }}
                  className="flex flex-col gap-6 sm:gap-7 transition-transform duration-75"
                >
                  {slotList.map((slotIdx) => {
                    const itemIdx = slotIndices[slotIdx];
                    const item = items[itemIdx] || items[0];
                    if (!item) return null;

                    return (
                      <MasonryCard
                        key={`slot-m-${slotIdx}-${item.id}`}
                        item={item}
                        displayIndex={itemIdx}
                        isSwapping={Boolean(swappingSlots[slotIdx])}
                        onSelect={onSelectItem}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
