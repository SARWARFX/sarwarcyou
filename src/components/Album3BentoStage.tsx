/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getDirectImageUrl } from '../utils/imageUrlResolver';
import type { AlbumData, StageMediaItem } from '../types';

interface Album3BentoStageProps {
  album: AlbumData;
  isActive: boolean;
  onSelectItem: (item: StageMediaItem) => void;
  onActiveIndexChange?: (index: number) => void;
  isVisible?: boolean;
}

interface BentoCellProps {
  item: StageMediaItem;
  slotIndex: number;
  className?: string;
  onSelect: (item: StageMediaItem) => void;
  hasDragged: () => boolean;
}

const BentoCell: React.FC<BentoCellProps> = ({
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
      className={`relative w-full h-full overflow-hidden rounded-xl sm:rounded-2xl cursor-pointer group bg-[#0a0d14] border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.6)] hover:shadow-[0_24px_60px_rgba(0,0,0,0.95),0_0_20px_rgba(0,210,255,0.25)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] select-none will-change-transform ${className}`}
    >
      {/* 1. Pure Photography Layer (No text or badge overlays) */}
      <img
        src={currentUrl}
        alt={item.title || 'Dropbox Bento Photo'}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
        className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-108 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
      />

      {/* 2. Diagonal Specular Gloss Sheen on Hover */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] to-white/[0.18] opacity-0 group-hover:opacity-100 transition-opacity duration-400" />

      {/* 3. Razor-Thin Museum Border Highlight with Electric Cyan Sheen */}
      <div className="pointer-events-none absolute inset-0 rounded-xl sm:rounded-2xl border border-white/10 group-hover:border-[#00D2FF]/60 transition-colors duration-400" />
    </div>
  );
};

export const Album3BentoStage: React.FC<Album3BentoStageProps> = ({
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
      if (w >= 1024) setScreenTier('desktop');
      else if (w >= 768) setScreenTier('tablet');
      else setScreenTier('mobile');
    };
    checkTier();
    window.addEventListener('resize', checkTier);
    return () => window.removeEventListener('resize', checkTier);
  }, []);

  const slotCount = screenTier === 'desktop' ? 6 : 4;
  const totalPanels = Math.max(1, Math.ceil(totalItems / slotCount));

  // Current visual panel index (0 to totalPanels - 1)
  const [currentPanel, setCurrentPanel] = useState(0);
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isHoveredOverStage, setIsHoveredOverStage] = useState(false);

  const dragStartXRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const isPointerDownRef = useRef(false);
  const hasDraggedRef = useRef(false);
  const wheelCooldownRef = useRef(false);
  const autoSlideTimerRef = useRef<number | null>(null);

  // Transition to specific panel
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

  const nextPanel = useCallback(() => {
    goToPanel(currentPanel + 1);
  }, [currentPanel, goToPanel]);

  const prevPanel = useCallback(() => {
    goToPanel(currentPanel - 1);
  }, [currentPanel, goToPanel]);

  // 5-SECOND AUTO-SLIDE & CONTINUOUS STREAM
  // Slides right to left every 5s unless hovered or actively dragging/scrubbing
  useEffect(() => {
    if (!isActive || totalPanels <= 1) return;

    if (autoSlideTimerRef.current) {
      window.clearInterval(autoSlideTimerRef.current);
      autoSlideTimerRef.current = null;
    }

    if (!isDragging) {
      autoSlideTimerRef.current = window.setInterval(() => {
        nextPanel();
      }, 5000);
    }

    return () => {
      if (autoSlideTimerRef.current) {
        window.clearInterval(autoSlideTimerRef.current);
        autoSlideTimerRef.current = null;
      }
    };
  }, [isActive, totalPanels, isHoveredOverStage, isDragging, nextPanel]);

  // Keyboard navigation: ArrowLeft and ArrowRight
  useEffect(() => {
    if (!isActive) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextPanel();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevPanel();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isActive, nextPanel, prevPanel]);

  // Trackpad / Horizontal Wheel Fast Scrubbing
  useEffect(() => {
    if (!isActive) return;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 22) {
        e.preventDefault();
        if (wheelCooldownRef.current) return;
        wheelCooldownRef.current = true;
        if (e.deltaX > 0) {
          nextPanel();
        } else {
          prevPanel();
        }
        setTimeout(() => {
          wheelCooldownRef.current = false;
        }, 360);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [isActive, nextPanel, prevPanel]);

  // Pointer drag & touch swipe with momentum
  const handlePointerDown = (e: React.PointerEvent) => {
    isPointerDownRef.current = true;
    dragStartXRef.current = e.clientX;
    lastXRef.current = e.clientX;
    lastTimeRef.current = performance.now();
    velocityRef.current = 0;
    hasDraggedRef.current = false;
    setIsDragging(true);
    setDragDeltaX(0);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDownRef.current) return;
    const now = performance.now();
    const dt = Math.max(1, now - lastTimeRef.current);
    const dx = e.clientX - lastXRef.current;

    velocityRef.current = dx / dt;
    lastXRef.current = e.clientX;
    lastTimeRef.current = now;

    const totalDelta = e.clientX - dragStartXRef.current;
    if (Math.abs(totalDelta) > 8) {
      hasDraggedRef.current = true;
    }
    setDragDeltaX(totalDelta);
  };

  const handlePointerUp = () => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    setIsDragging(false);

    const delta = dragDeltaX;
    const velocity = velocityRef.current;
    const threshold = Math.min(90, window.innerWidth * 0.12);

    // Natural momentum check: advance on distance or quick flick velocity
    if (delta < -threshold || velocity < -0.45) {
      nextPanel();
    } else if (delta > threshold || velocity > 0.45) {
      prevPanel();
    } else {
      setDragDeltaX(0);
    }
  };

  const checkHasDragged = useCallback(() => hasDraggedRef.current, []);

  // Helper to slice photos for any panel index
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
      onMouseEnter={() => setIsHoveredOverStage(true)}
      onMouseLeave={() => setIsHoveredOverStage(false)}
      style={{ touchAction: 'none' }}
      className="absolute inset-0 w-screen h-screen overflow-hidden bg-[#0a0a0c] select-none z-0 cursor-grab active:cursor-grabbing"
    >
      {/* ================= UNIVERSAL HORIZONTAL SLIDER TRACK ================= */}
      <div
        className="flex w-full h-full will-change-transform"
        style={{
          transform: `translate3d(calc(-${currentPanel * 100}% + ${dragDeltaX}px), 0, 0)`,
          transition: isDragging
            ? 'none'
            : 'transform 850ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {Array.from({ length: totalPanels }).map((_, pIdx) => {
          const panelItems = getPanelItems(pIdx);
          const startIdx = pIdx * slotCount;
          // Alternate geometric rhythm across batches (inspired by brand.dropbox.com)
          const layoutVariant = pIdx % 3;

          return (
            <div
              key={pIdx}
              className="w-screen h-screen flex-shrink-0 p-3 sm:p-4 md:p-5 lg:p-6 pb-16 sm:pb-20 box-border flex items-center justify-center"
            >
              {/* ================= DESKTOP 6-ITEM ASYMMETRIC BENTO GRID ================= */}
              {screenTier === 'desktop' && (
                <div className="w-full h-full max-h-[92vh] grid grid-cols-4 grid-rows-3 gap-3 sm:gap-3.5 md:gap-4">
                  {layoutVariant === 0 && (
                    <>
                      {/* Variant A: Hero Rectangle Left, Tall Right */}
                      <BentoCell
                        item={panelItems[0] || items[0]}
                        slotIndex={startIdx + 0}
                        className="col-span-2 row-span-2"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[1] || items[1]}
                        slotIndex={startIdx + 1}
                        className="col-span-1 row-span-2"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[2] || items[2]}
                        slotIndex={startIdx + 2}
                        className="col-span-1 row-span-1"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[3] || items[3]}
                        slotIndex={startIdx + 3}
                        className="col-span-1 row-span-1"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[4] || items[4]}
                        slotIndex={startIdx + 4}
                        className="col-span-2 row-span-1"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[5] || items[5]}
                        slotIndex={startIdx + 5}
                        className="col-span-2 row-span-1"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                    </>
                  )}

                  {layoutVariant === 1 && (
                    <>
                      {/* Variant B: Tall Left, Hero Rectangle Right */}
                      <BentoCell
                        item={panelItems[0] || items[0]}
                        slotIndex={startIdx + 0}
                        className="col-span-1 row-span-2"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[1] || items[1]}
                        slotIndex={startIdx + 1}
                        className="col-span-1 row-span-1"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[2] || items[2]}
                        slotIndex={startIdx + 2}
                        className="col-span-1 row-span-1"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[3] || items[3]}
                        slotIndex={startIdx + 3}
                        className="col-span-2 row-span-2"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[4] || items[4]}
                        slotIndex={startIdx + 4}
                        className="col-span-2 row-span-1"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[5] || items[5]}
                        slotIndex={startIdx + 5}
                        className="col-span-2 row-span-1"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                    </>
                  )}

                  {layoutVariant === 2 && (
                    <>
                      {/* Variant C: Top Banners, Split Center Hero */}
                      <BentoCell
                        item={panelItems[0] || items[0]}
                        slotIndex={startIdx + 0}
                        className="col-span-2 row-span-1"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[1] || items[1]}
                        slotIndex={startIdx + 1}
                        className="col-span-2 row-span-1"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[2] || items[2]}
                        slotIndex={startIdx + 2}
                        className="col-span-2 row-span-2"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[3] || items[3]}
                        slotIndex={startIdx + 3}
                        className="col-span-1 row-span-2"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[4] || items[4]}
                        slotIndex={startIdx + 4}
                        className="col-span-1 row-span-1"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[5] || items[5]}
                        slotIndex={startIdx + 5}
                        className="col-span-1 row-span-1"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                    </>
                  )}
                </div>
              )}

              {/* ================= TABLET 4-ITEM ASYMMETRIC BENTO GRID ================= */}
              {screenTier === 'tablet' && (
                <div className="w-full h-full max-h-[92vh] grid grid-cols-3 grid-rows-3 gap-3 sm:gap-3.5">
                  {layoutVariant % 2 === 0 ? (
                    <>
                      <BentoCell
                        item={panelItems[0] || items[0]}
                        slotIndex={startIdx + 0}
                        className="col-span-2 row-span-2"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[1] || items[1]}
                        slotIndex={startIdx + 1}
                        className="col-span-1 row-span-2"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[2] || items[2]}
                        slotIndex={startIdx + 2}
                        className="col-span-1 row-span-1"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[3] || items[3]}
                        slotIndex={startIdx + 3}
                        className="col-span-2 row-span-1"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                    </>
                  ) : (
                    <>
                      <BentoCell
                        item={panelItems[0] || items[0]}
                        slotIndex={startIdx + 0}
                        className="col-span-1 row-span-2"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[1] || items[1]}
                        slotIndex={startIdx + 1}
                        className="col-span-2 row-span-2"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[2] || items[2]}
                        slotIndex={startIdx + 2}
                        className="col-span-2 row-span-1"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[3] || items[3]}
                        slotIndex={startIdx + 3}
                        className="col-span-1 row-span-1"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                    </>
                  )}
                </div>
              )}

              {/* ================= MOBILE 4-ITEM ASYMMETRIC BENTO GRID ================= */}
              {screenTier === 'mobile' && (
                <div className="w-full h-full max-h-[90vh] grid grid-cols-2 grid-rows-3 gap-2.5 sm:gap-3">
                  {layoutVariant % 2 === 0 ? (
                    <>
                      <BentoCell
                        item={panelItems[0] || items[0]}
                        slotIndex={startIdx + 0}
                        className="col-span-2 row-span-1"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[1] || items[1]}
                        slotIndex={startIdx + 1}
                        className="col-span-1 row-span-2"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[2] || items[2]}
                        slotIndex={startIdx + 2}
                        className="col-span-1 row-span-1"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[3] || items[3]}
                        slotIndex={startIdx + 3}
                        className="col-span-1 row-span-1"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                    </>
                  ) : (
                    <>
                      <BentoCell
                        item={panelItems[0] || items[0]}
                        slotIndex={startIdx + 0}
                        className="col-span-1 row-span-2"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[1] || items[1]}
                        slotIndex={startIdx + 1}
                        className="col-span-1 row-span-1"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[2] || items[2]}
                        slotIndex={startIdx + 2}
                        className="col-span-1 row-span-1"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                      <BentoCell
                        item={panelItems[3] || items[3]}
                        slotIndex={startIdx + 3}
                        className="col-span-2 row-span-1"
                        onSelect={onSelectItem}
                        hasDragged={checkHasDragged}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ================= ULTRA-MINIMAL FAST SCRUBBER HUD ================= */}
      {totalPanels > 1 && (
        <aside
          aria-label="Album 3 Bento Navigation"
          className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-3.5 py-2 rounded-full border border-white/10 bg-black/65 backdrop-blur-xl text-white select-none pointer-events-auto shadow-[0_8px_30px_rgba(0,0,0,0.8)]"
        >
          {/* Previous Chevron Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              prevPanel();
            }}
            className="p-1 text-white/50 hover:text-[#00D2FF] hover:scale-110 active:scale-95 transition-all cursor-pointer"
            aria-label="Previous bento batch"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Panel Dots / Progress Indicators */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: Math.min(8, totalPanels) }).map((_, idx) => {
              const activeDot = currentPanel % Math.min(8, totalPanels);
              return (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPanel(idx);
                  }}
                  aria-label={`Go to bento batch ${idx + 1}`}
                  className={`transition-all duration-300 rounded-full cursor-pointer ${
                    idx === activeDot
                      ? 'w-6 h-1.5 bg-[#00D2FF] shadow-[0_0_8px_#00D2FF]'
                      : 'w-1.5 h-1.5 bg-white/25 hover:bg-white/60'
                  }`}
                />
              );
            })}
          </div>

          {/* Text Badge with subtle 5s auto-slide live pulse */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isHoveredOverStage
                  ? 'bg-amber-400 shadow-[0_0_6px_#f59e0b]'
                  : 'bg-[#00D2FF] animate-pulse shadow-[0_0_6px_#00D2FF]'
              }`}
              title={isHoveredOverStage ? 'Auto-slide paused (Hovered)' : 'Auto-sliding every 5s'}
            />
            <span className="text-[10px] font-mono tracking-widest text-white/70 uppercase">
              {currentPanel + 1} / {totalPanels}{' '}
              <span className="hidden sm:inline text-white/35 font-light">
                ({totalItems} PHOTOS)
              </span>
            </span>
          </div>

          {/* Next Chevron Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              nextPanel();
            }}
            className="p-1 text-white/50 hover:text-[#00D2FF] hover:scale-110 active:scale-95 transition-all cursor-pointer"
            aria-label="Next bento batch"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </aside>
      )}
    </div>
  );
};
