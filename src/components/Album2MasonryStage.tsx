/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getDirectImageUrl, getUnsplashFallback } from '../utils/imageUrlResolver';
import type { AlbumData, StageMediaItem } from '../types';

interface Album2MasonryStageProps {
  album: AlbumData;
  isActive: boolean;
  onSelectItem: (item: StageMediaItem) => void;
  onActiveIndexChange?: (index: number) => void;
  isVisible?: boolean;
}

interface MosaicCellProps {
  item: StageMediaItem;
  slotIndex: number;
  className?: string;
  onSelect: (item: StageMediaItem) => void;
  hasDragged: () => boolean;
}

const MosaicCell: React.FC<MosaicCellProps> = ({
  item,
  slotIndex,
  className = '',
  onSelect,
  hasDragged,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const currentUrl = useMemo(() => {
    return getDirectImageUrl(item, slotIndex);
  }, [item, slotIndex]);

  const currentFallback = useMemo(() => {
    return getUnsplashFallback(slotIndex);
  }, [slotIndex]);

  return (
    <div
      onClick={() => {
        if (!hasDragged()) {
          onSelect(item);
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        transform: isHovered
          ? 'scale3d(1.025, 1.025, 1.025) translateY(-3px)'
          : 'scale3d(1, 1, 1) translateY(0px)',
        zIndex: isHovered ? 30 : 1,
      }}
      className={`relative w-full h-full overflow-hidden rounded-xl sm:rounded-2xl cursor-pointer group bg-[#0e111a] border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.6)] hover:shadow-[0_24px_60px_rgba(0,0,0,0.95)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] select-none will-change-transform ${className}`}
    >
      {/* Base Active Image Layer */}
      <img
        src={currentUrl}
        alt={item.title || 'Editorial Print'}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.src = currentFallback;
        }}
        className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-108 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
      />

      {/* Subtle Glossy Specular Sheen Reflection on Hover */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] to-white/[0.16] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Fine Museum Inner Rim Highlight */}
      <div className="pointer-events-none absolute inset-0 rounded-xl sm:rounded-2xl border border-white/10 group-hover:border-[#00D2FF]/40 transition-colors duration-300" />
    </div>
  );
};

export const Album2MasonryStage: React.FC<Album2MasonryStageProps> = ({
  album,
  isActive,
  onSelectItem,
  onActiveIndexChange,
}) => {
  const items = useMemo(() => album.items || [], [album.items]);
  const totalItems = items.length;

  // Responsive screen tier
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
  const totalPanels = Math.max(1, Math.ceil(totalItems / slotCount));

  const [currentPanel, setCurrentPanel] = useState(0);
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dragStartXRef = useRef(0);
  const isPointerDownRef = useRef(false);
  const hasDraggedRef = useRef(false);
  const wheelCooldownRef = useRef(false);

  // Safely clamp or loop to target panel
  const goToPanel = useCallback(
    (target: number) => {
      const clamped = (target + totalPanels) % totalPanels;
      setCurrentPanel(clamped);
      setDragDeltaX(0);
      if (onActiveIndexChange) {
        onActiveIndexChange(clamped * slotCount);
      }
    },
    [totalPanels, slotCount, onActiveIndexChange]
  );

  // Keyboard navigation: ArrowLeft and ArrowRight
  useEffect(() => {
    if (!isActive) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToPanel(currentPanel + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPanel(currentPanel - 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isActive, currentPanel, goToPanel]);

  // Trackpad / Mouse horizontal wheel browsing
  useEffect(() => {
    if (!isActive) return;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 25) {
        e.preventDefault();
        if (wheelCooldownRef.current) return;
        wheelCooldownRef.current = true;
        if (e.deltaX > 0) {
          goToPanel(currentPanel + 1);
        } else {
          goToPanel(currentPanel - 1);
        }
        setTimeout(() => {
          wheelCooldownRef.current = false;
        }, 380);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [isActive, currentPanel, goToPanel]);

  // Pointer drag & touch swipe handling
  const handlePointerDown = (e: React.PointerEvent) => {
    isPointerDownRef.current = true;
    dragStartXRef.current = e.clientX;
    hasDraggedRef.current = false;
    setIsDragging(true);
    setDragDeltaX(0);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDownRef.current) return;
    const delta = e.clientX - dragStartXRef.current;
    if (Math.abs(delta) > 8) {
      hasDraggedRef.current = true;
    }
    setDragDeltaX(delta);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    setIsDragging(false);

    const delta = e.clientX - dragStartXRef.current;
    const threshold = Math.min(100, window.innerWidth * 0.12);

    if (delta < -threshold) {
      goToPanel(currentPanel + 1);
    } else if (delta > threshold) {
      goToPanel(currentPanel - 1);
    } else {
      setDragDeltaX(0);
    }
  };

  const checkHasDragged = useCallback(() => hasDraggedRef.current, []);

  // Get items for a given panel index
  const getPanelItems = (pIdx: number): StageMediaItem[] => {
    if (totalItems === 0) return [];
    const start = pIdx * slotCount;
    const result: StageMediaItem[] = [];
    for (let i = 0; i < slotCount; i++) {
      const itemIdx = (start + i) % totalItems;
      result.push(items[itemIdx]);
    }
    return result;
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ touchAction: 'none' }}
      className="absolute inset-0 w-screen h-screen overflow-hidden bg-black select-none z-0 cursor-grab active:cursor-grabbing"
    >
      {/* ================= UNIVERSAL HORIZONTAL SLIDER TRACK ================= */}
      <div
        className="flex w-full h-full will-change-transform"
        style={{
          transform: `translate3d(calc(-${currentPanel * 100}% + ${dragDeltaX}px), 0, 0)`,
          transition: isDragging
            ? 'none'
            : 'transform 750ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {Array.from({ length: totalPanels }).map((_, pIdx) => {
          const panelItems = getPanelItems(pIdx);
          const startIdx = pIdx * slotCount;

          return (
            <div
              key={pIdx}
              className="w-screen h-screen flex-shrink-0 p-2 sm:p-2.5 md:p-3 pb-16 sm:pb-18 box-border"
            >
              {/* DESKTOP 10-SLOT FULL-BLEED MOSAIC */}
              {screenTier === 'desktop' && (
                <div className="w-full h-full grid grid-cols-5 grid-rows-3 gap-2 sm:gap-2.5 md:gap-3">
                  <MosaicCell
                    item={panelItems[0] || items[0]}
                    slotIndex={startIdx + 0}
                    className="col-span-1 row-span-2"
                    onSelect={onSelectItem}
                    hasDragged={checkHasDragged}
                  />
                  <MosaicCell
                    item={panelItems[1] || items[1]}
                    slotIndex={startIdx + 1}
                    className="col-span-2 row-span-1"
                    onSelect={onSelectItem}
                    hasDragged={checkHasDragged}
                  />
                  <MosaicCell
                    item={panelItems[2] || items[2]}
                    slotIndex={startIdx + 2}
                    className="col-span-1 row-span-1"
                    onSelect={onSelectItem}
                    hasDragged={checkHasDragged}
                  />
                  <MosaicCell
                    item={panelItems[3] || items[3]}
                    slotIndex={startIdx + 3}
                    className="col-span-1 row-span-2"
                    onSelect={onSelectItem}
                    hasDragged={checkHasDragged}
                  />
                  <MosaicCell
                    item={panelItems[4] || items[4]}
                    slotIndex={startIdx + 4}
                    className="col-span-1 row-span-1"
                    onSelect={onSelectItem}
                    hasDragged={checkHasDragged}
                  />
                  <MosaicCell
                    item={panelItems[5] || items[5]}
                    slotIndex={startIdx + 5}
                    className="col-span-1 row-span-2"
                    onSelect={onSelectItem}
                    hasDragged={checkHasDragged}
                  />
                  <MosaicCell
                    item={panelItems[6] || items[6]}
                    slotIndex={startIdx + 6}
                    className="col-span-1 row-span-1"
                    onSelect={onSelectItem}
                    hasDragged={checkHasDragged}
                  />
                  <MosaicCell
                    item={panelItems[7] || items[7]}
                    slotIndex={startIdx + 7}
                    className="col-span-1 row-span-1"
                    onSelect={onSelectItem}
                    hasDragged={checkHasDragged}
                  />
                  <MosaicCell
                    item={panelItems[8] || items[8]}
                    slotIndex={startIdx + 8}
                    className="col-span-1 row-span-1"
                    onSelect={onSelectItem}
                    hasDragged={checkHasDragged}
                  />
                  <MosaicCell
                    item={panelItems[9] || items[9]}
                    slotIndex={startIdx + 9}
                    className="col-span-2 row-span-1"
                    onSelect={onSelectItem}
                    hasDragged={checkHasDragged}
                  />
                </div>
              )}

              {/* TABLET 8-SLOT FULL-BLEED MOSAIC */}
              {screenTier === 'tablet' && (
                <div className="w-full h-full grid grid-cols-4 grid-rows-3 gap-2 sm:gap-2.5">
                  <MosaicCell
                    item={panelItems[0] || items[0]}
                    slotIndex={startIdx + 0}
                    className="col-span-1 row-span-2"
                    onSelect={onSelectItem}
                    hasDragged={checkHasDragged}
                  />
                  <MosaicCell
                    item={panelItems[1] || items[1]}
                    slotIndex={startIdx + 1}
                    className="col-span-2 row-span-1"
                    onSelect={onSelectItem}
                    hasDragged={checkHasDragged}
                  />
                  <MosaicCell
                    item={panelItems[2] || items[2]}
                    slotIndex={startIdx + 2}
                    className="col-span-1 row-span-1"
                    onSelect={onSelectItem}
                    hasDragged={checkHasDragged}
                  />
                  <MosaicCell
                    item={panelItems[3] || items[3]}
                    slotIndex={startIdx + 3}
                    className="col-span-1 row-span-1"
                    onSelect={onSelectItem}
                    hasDragged={checkHasDragged}
                  />
                  <MosaicCell
                    item={panelItems[4] || items[4]}
                    slotIndex={startIdx + 4}
                    className="col-span-1 row-span-2"
                    onSelect={onSelectItem}
                    hasDragged={checkHasDragged}
                  />
                  <MosaicCell
                    item={panelItems[5] || items[5]}
                    slotIndex={startIdx + 5}
                    className="col-span-1 row-span-1"
                    onSelect={onSelectItem}
                    hasDragged={checkHasDragged}
                  />
                  <MosaicCell
                    item={panelItems[6] || items[6]}
                    slotIndex={startIdx + 6}
                    className="col-span-2 row-span-1"
                    onSelect={onSelectItem}
                    hasDragged={checkHasDragged}
                  />
                  <MosaicCell
                    item={panelItems[7] || items[7]}
                    slotIndex={startIdx + 7}
                    className="col-span-1 row-span-1"
                    onSelect={onSelectItem}
                    hasDragged={checkHasDragged}
                  />
                </div>
              )}

              {/* MOBILE 4-SLOT FULL-BLEED MOSAIC */}
              {screenTier === 'mobile' && (
                <div className="w-full h-full grid grid-cols-2 grid-rows-3 gap-2">
                  <MosaicCell
                    item={panelItems[0] || items[0]}
                    slotIndex={startIdx + 0}
                    className="col-span-1 row-span-2"
                    onSelect={onSelectItem}
                    hasDragged={checkHasDragged}
                  />
                  <MosaicCell
                    item={panelItems[1] || items[1]}
                    slotIndex={startIdx + 1}
                    className="col-span-1 row-span-1"
                    onSelect={onSelectItem}
                    hasDragged={checkHasDragged}
                  />
                  <MosaicCell
                    item={panelItems[2] || items[2]}
                    slotIndex={startIdx + 2}
                    className="col-span-1 row-span-1"
                    onSelect={onSelectItem}
                    hasDragged={checkHasDragged}
                  />
                  <MosaicCell
                    item={panelItems[3] || items[3]}
                    slotIndex={startIdx + 3}
                    className="col-span-2 row-span-1"
                    onSelect={onSelectItem}
                    hasDragged={checkHasDragged}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ================= ULTRA-MINIMAL HORIZONTAL SCRUBBER HUD ================= */}
      {totalPanels > 1 && (
        <aside
          aria-label="Horizontal album gallery navigation"
          className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-3.5 py-2 rounded-full border border-white/10 bg-black/65 backdrop-blur-xl text-white select-none pointer-events-auto shadow-[0_8px_30px_rgba(0,0,0,0.8)]"
        >
          {/* Previous Chevron Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToPanel(currentPanel - 1);
            }}
            className="p-1 text-white/50 hover:text-[#00D2FF] hover:scale-110 active:scale-95 transition-all cursor-pointer"
            aria-label="Previous photo batch"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Panel Dots / Progress Indicators */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPanels }).map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  goToPanel(idx);
                }}
                aria-label={`Go to photo batch ${idx + 1}`}
                className={`transition-all duration-300 rounded-full cursor-pointer ${
                  idx === currentPanel
                    ? 'w-6 h-1.5 bg-[#00D2FF] shadow-[0_0_8px_#00D2FF]'
                    : 'w-1.5 h-1.5 bg-white/25 hover:bg-white/60'
                }`}
              />
            ))}
          </div>

          {/* Text Badge */}
          <span className="text-[10px] font-mono tracking-widest text-white/70 uppercase">
            {currentPanel + 1} / {totalPanels}{' '}
            <span className="hidden sm:inline text-white/35 font-light">
              ({totalItems} PHOTOS)
            </span>
          </span>

          {/* Next Chevron Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToPanel(currentPanel + 1);
            }}
            className="p-1 text-white/50 hover:text-[#00D2FF] hover:scale-110 active:scale-95 transition-all cursor-pointer"
            aria-label="Next photo batch"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </aside>
      )}
    </div>
  );
};
