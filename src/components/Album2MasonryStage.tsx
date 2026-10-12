/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getDirectImageUrl, getUnsplashFallback } from '../utils/imageUrlResolver';
import type { AlbumData, StageMediaItem } from '../types';

interface Album2MasonryStageProps {
  album: AlbumData;
  isActive: boolean;
  onSelectItem: (item: StageMediaItem) => void;
  onActiveIndexChange?: (index: number) => void;
}

interface MosaicCellProps {
  item: StageMediaItem;
  incomingItem: StageMediaItem | null;
  slotIndex: number;
  className?: string;
  onSelect: (item: StageMediaItem) => void;
}

const MosaicCell: React.FC<MosaicCellProps> = ({
  item,
  incomingItem,
  slotIndex,
  className = '',
  onSelect,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isIncomingLoaded, setIsIncomingLoaded] = useState(false);

  const currentUrl = useMemo(() => {
    return getDirectImageUrl(item, slotIndex);
  }, [item, slotIndex]);

  const currentFallback = useMemo(() => {
    return getUnsplashFallback(slotIndex);
  }, [slotIndex]);

  const incomingUrl = useMemo(() => {
    if (!incomingItem) return null;
    return getDirectImageUrl(incomingItem, slotIndex + 17);
  }, [incomingItem, slotIndex]);

  const incomingFallback = useMemo(() => {
    if (!incomingItem) return null;
    return getUnsplashFallback(slotIndex + 17);
  }, [incomingItem, slotIndex]);

  useEffect(() => {
    if (incomingItem) {
      setIsIncomingLoaded(false);
    }
  }, [incomingItem]);

  return (
    <div
      onClick={() => onSelect(incomingItem && isIncomingLoaded ? incomingItem : item)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        transform: isHovered
          ? 'scale3d(1.028, 1.028, 1.028) translateY(-3px)'
          : 'scale3d(1, 1, 1) translateY(0px)',
        zIndex: isHovered ? 30 : 1,
      }}
      className={`relative w-full h-full overflow-hidden rounded-xl sm:rounded-2xl cursor-pointer group bg-[#11141c] border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.6)] hover:shadow-[0_24px_60px_rgba(0,0,0,0.95)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] select-none will-change-transform ${className}`}
    >
      {/* 1. Base Active Image Layer (Always visible underneath so NEVER exposing empty void) */}
      <img
        src={currentUrl}
        alt={item.title || 'Editorial Print'}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.src = currentFallback;
        }}
        className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-108 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
      />

      {/* 2. Seamless Incoming Image Layer (Morph/Cross-Slide on Swap) */}
      {incomingItem && (
        <img
          src={incomingUrl || currentFallback}
          alt={incomingItem.title || 'Incoming Editorial Print'}
          loading="lazy"
          onLoad={() => setIsIncomingLoaded(true)}
          onError={(e) => {
            if (incomingFallback) e.currentTarget.src = incomingFallback;
            setIsIncomingLoaded(true);
          }}
          style={{
            opacity: isIncomingLoaded ? 1 : 0,
            transform: isIncomingLoaded
              ? 'translate3d(0, 0, 0) scale(1)'
              : 'translate3d(0, 16px, 0) scale(1.06)',
            transition:
              'opacity 0.75s cubic-bezier(0.16, 1, 0.3, 1), transform 0.75s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-108 will-change-transform"
        />
      )}

      {/* 3. Subtle Glossy Specular Sheen Reflection on Hover */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] to-white/[0.16] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* 4. Fine Museum Inner Rim Highlight */}
      <div className="pointer-events-none absolute inset-0 rounded-xl sm:rounded-2xl border border-white/10 group-hover:border-[#00D2FF]/40 transition-colors duration-300" />
    </div>
  );
};

export const Album2MasonryStage: React.FC<Album2MasonryStageProps> = ({
  album,
  isActive,
  onSelectItem,
}) => {
  const items = useMemo(() => album.items || [], [album.items]);
  const totalItems = items.length;

  // Track responsive screen size
  const [screenTier, setScreenTier] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  useEffect(() => {
    const checkTier = () => {
      const w = window.innerWidth;
      if (w >= 1200) setScreenTier('desktop');
      else if (w >= 768) setScreenTier('tablet');
      else setScreenTier('mobile');
    };
    checkTier();
    window.addEventListener('resize', checkTier);
    return () => window.removeEventListener('resize', checkTier);
  }, []);

  const slotCount = screenTier === 'desktop' ? 10 : screenTier === 'tablet' ? 8 : 4;

  // Active items currently filling each slot
  const [activeItems, setActiveItems] = useState<StageMediaItem[]>(() => {
    return Array.from({ length: 10 }, (_, i) => items[i % Math.max(1, totalItems)] || items[0]);
  });

  // Incoming items currently in transition per slot
  const [incomingItems, setIncomingItems] = useState<{ [slot: number]: StageMediaItem | null }>({});

  const nextQueueIdxRef = useRef<number>(10 % Math.max(1, totalItems));
  const batchCycleRef = useRef<number>(0);

  // Re-sync items if album changes
  useEffect(() => {
    if (totalItems > 0) {
      setActiveItems(Array.from({ length: 10 }, (_, i) => items[i % totalItems]));
      nextQueueIdxRef.current = 10 % totalItems;
      setIncomingItems({});
    }
  }, [totalItems]);

  // LIVING DYNAMIC BATCHED SWAP & SHUFFLE:
  // Every 5.2s, transition 3 to 4 photos with seamless cross-morph
  useEffect(() => {
    if (!isActive || totalItems <= slotCount) return;

    const interval = setInterval(() => {
      // Rotate between 3 alternating batches of 3-4 slots
      const batches =
        screenTier === 'desktop'
          ? [
              [0, 2, 5, 8],
              [1, 3, 6, 9],
              [4, 7, 1, 5],
            ]
          : screenTier === 'tablet'
          ? [
              [0, 2, 5],
              [1, 4, 7],
              [3, 6, 0],
            ]
          : [
              [0, 2],
              [1, 3],
            ];

      const currentBatch = batches[batchCycleRef.current % batches.length];
      batchCycleRef.current++;

      currentBatch.forEach((slot, idx) => {
        const stagger = idx * 110;

        setTimeout(() => {
          const nextItem = items[nextQueueIdxRef.current];
          nextQueueIdxRef.current = (nextQueueIdxRef.current + 1) % totalItems;

          // Stage 1: Mount incoming item over the active item (cross-morph begins)
          setIncomingItems((prev) => ({ ...prev, [slot]: nextItem }));

          // Stage 2: Settle incoming item as current after 750ms
          setTimeout(() => {
            setActiveItems((prev) => {
              const updated = [...prev];
              updated[slot] = nextItem;
              return updated;
            });
            setIncomingItems((prev) => ({ ...prev, [slot]: null }));
          }, 780);
        }, stagger);
      });
    }, 5200);

    return () => clearInterval(interval);
  }, [isActive, totalItems, slotCount, screenTier]);

  return (
    <div className="absolute inset-0 w-screen h-screen overflow-hidden p-2 sm:p-2.5 md:p-3 bg-[#07090e] select-none box-border z-0">
      {/* ================= DESKTOP 10-SLOT FULL-BLEED MOSAIC (100vw x 100vh) ================= */}
      {screenTier === 'desktop' && (
        <div className="w-full h-full grid grid-cols-5 grid-rows-3 gap-2 sm:gap-2.5 md:gap-3">
          {/* Row 1 & 2: Slot 0 (Tall Portrait, col 1, rows 1-2) */}
          <MosaicCell
            item={activeItems[0] || items[0]}
            incomingItem={incomingItems[0] || null}
            slotIndex={0}
            className="col-span-1 row-span-2"
            onSelect={onSelectItem}
          />

          {/* Row 1: Slot 1 (Wide Landscape, cols 2-3, row 1) */}
          <MosaicCell
            item={activeItems[1] || items[1]}
            incomingItem={incomingItems[1] || null}
            slotIndex={1}
            className="col-span-2 row-span-1"
            onSelect={onSelectItem}
          />

          {/* Row 1: Slot 2 (Square, col 4, row 1) */}
          <MosaicCell
            item={activeItems[2] || items[2]}
            incomingItem={incomingItems[2] || null}
            slotIndex={2}
            className="col-span-1 row-span-1"
            onSelect={onSelectItem}
          />

          {/* Row 1 & 2: Slot 3 (Tall Portrait, col 5, rows 1-2) */}
          <MosaicCell
            item={activeItems[3] || items[3]}
            incomingItem={incomingItems[3] || null}
            slotIndex={3}
            className="col-span-1 row-span-2"
            onSelect={onSelectItem}
          />

          {/* Row 2: Slot 4 (Square, col 2, row 2) */}
          <MosaicCell
            item={activeItems[4] || items[4]}
            incomingItem={incomingItems[4] || null}
            slotIndex={4}
            className="col-span-1 row-span-1"
            onSelect={onSelectItem}
          />

          {/* Row 2 & 3: Slot 5 (Tall Portrait, col 3, rows 2-3) */}
          <MosaicCell
            item={activeItems[5] || items[5]}
            incomingItem={incomingItems[5] || null}
            slotIndex={5}
            className="col-span-1 row-span-2"
            onSelect={onSelectItem}
          />

          {/* Row 2: Slot 6 (Square, col 4, row 2) */}
          <MosaicCell
            item={activeItems[6] || items[6]}
            incomingItem={incomingItems[6] || null}
            slotIndex={6}
            className="col-span-1 row-span-1"
            onSelect={onSelectItem}
          />

          {/* Row 3: Slot 7 (Square, col 1, row 3) */}
          <MosaicCell
            item={activeItems[7] || items[7]}
            incomingItem={incomingItems[7] || null}
            slotIndex={7}
            className="col-span-1 row-span-1"
            onSelect={onSelectItem}
          />

          {/* Row 3: Slot 8 (Square, col 2, row 3) */}
          <MosaicCell
            item={activeItems[8] || items[8]}
            incomingItem={incomingItems[8] || null}
            slotIndex={8}
            className="col-span-1 row-span-1"
            onSelect={onSelectItem}
          />

          {/* Row 3: Slot 9 (Wide Landscape, cols 4-5, row 3) */}
          <MosaicCell
            item={activeItems[9] || items[9]}
            incomingItem={incomingItems[9] || null}
            slotIndex={9}
            className="col-span-2 row-span-1"
            onSelect={onSelectItem}
          />
        </div>
      )}

      {/* ================= TABLET 8-SLOT FULL-BLEED MOSAIC (4 Cols x 3 Rows) ================= */}
      {screenTier === 'tablet' && (
        <div className="w-full h-full grid grid-cols-4 grid-rows-3 gap-2 sm:gap-2.5">
          <MosaicCell
            item={activeItems[0] || items[0]}
            incomingItem={incomingItems[0] || null}
            slotIndex={0}
            className="col-span-1 row-span-2"
            onSelect={onSelectItem}
          />
          <MosaicCell
            item={activeItems[1] || items[1]}
            incomingItem={incomingItems[1] || null}
            slotIndex={1}
            className="col-span-2 row-span-1"
            onSelect={onSelectItem}
          />
          <MosaicCell
            item={activeItems[2] || items[2]}
            incomingItem={incomingItems[2] || null}
            slotIndex={2}
            className="col-span-1 row-span-1"
            onSelect={onSelectItem}
          />
          <MosaicCell
            item={activeItems[3] || items[3]}
            incomingItem={incomingItems[3] || null}
            slotIndex={3}
            className="col-span-1 row-span-1"
            onSelect={onSelectItem}
          />
          <MosaicCell
            item={activeItems[4] || items[4]}
            incomingItem={incomingItems[4] || null}
            slotIndex={4}
            className="col-span-1 row-span-2"
            onSelect={onSelectItem}
          />
          <MosaicCell
            item={activeItems[5] || items[5]}
            incomingItem={incomingItems[5] || null}
            slotIndex={5}
            className="col-span-1 row-span-1"
            onSelect={onSelectItem}
          />
          <MosaicCell
            item={activeItems[6] || items[6]}
            incomingItem={incomingItems[6] || null}
            slotIndex={6}
            className="col-span-2 row-span-1"
            onSelect={onSelectItem}
          />
          <MosaicCell
            item={activeItems[7] || items[7]}
            incomingItem={incomingItems[7] || null}
            slotIndex={7}
            className="col-span-1 row-span-1"
            onSelect={onSelectItem}
          />
        </div>
      )}

      {/* ================= MOBILE 4-SLOT FULL-BLEED MOSAIC (2 Cols x 3 Rows) ================= */}
      {screenTier === 'mobile' && (
        <div className="w-full h-full grid grid-cols-2 grid-rows-3 gap-2">
          <MosaicCell
            item={activeItems[0] || items[0]}
            incomingItem={incomingItems[0] || null}
            slotIndex={0}
            className="col-span-1 row-span-2"
            onSelect={onSelectItem}
          />
          <MosaicCell
            item={activeItems[1] || items[1]}
            incomingItem={incomingItems[1] || null}
            slotIndex={1}
            className="col-span-1 row-span-1"
            onSelect={onSelectItem}
          />
          <MosaicCell
            item={activeItems[2] || items[2]}
            incomingItem={incomingItems[2] || null}
            slotIndex={2}
            className="col-span-1 row-span-1"
            onSelect={onSelectItem}
          />
          <MosaicCell
            item={activeItems[3] || items[3]}
            incomingItem={incomingItems[3] || null}
            slotIndex={3}
            className="col-span-2 row-span-1"
            onSelect={onSelectItem}
          />
        </div>
      )}
    </div>
  );
};
