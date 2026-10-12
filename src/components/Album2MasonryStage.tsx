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
  index: number;
  onSelect: (item: StageMediaItem) => void;
}

const MasonryCard: React.FC<MasonryCardProps> = ({ item, index, onSelect }) => {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, isHovered: false });

  const directUrl = useMemo(() => {
    return getDirectImageUrl(item, index);
  }, [item, index]);

  const fallbackUrl = useMemo(() => {
    return getUnsplashFallback(index);
  }, [index]);

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
        transform: tilt.isHovered
          ? `perspective(1000px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg) scale3d(1.025, 1.025, 1.025) translateY(-6px)`
          : 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1) translateY(0px)',
        transition: tilt.isHovered
          ? 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease'
          : 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.5s ease',
        animation: `galleryFloat 7s ease-in-out infinite`,
        animationDelay: `${(index * 0.45) % 4.5}s`,
      }}
      className={`group relative w-full cursor-pointer rounded-2xl bg-white p-3 sm:p-4 border border-black/[0.06] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.12),0_10px_25px_-5px_rgba(0,0,0,0.06)] hover:shadow-[0_35px_70px_-15px_rgba(0,0,0,0.20),0_15px_30px_-5px_rgba(0,0,0,0.08)] select-none will-change-transform`}
    >
      {/* Physical Museum Mount Bevel & Fine Outer Trim */}
      <div className="relative w-full overflow-hidden rounded-xl bg-[#F0F2F5] transition-transform duration-300">
        {/* Aspect Ratio Container */}
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
            alt={item.title || `Gallery Print #${index + 1}`}
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

      {/* Museum Exhibition Tag / Clean Caption */}
      <div className="mt-3.5 px-1 flex items-baseline justify-between text-black/80 font-mono text-[11px] tracking-wider select-none">
        <span className="font-semibold truncate max-w-[75%] uppercase tracking-widest text-neutral-900">
          {item.title.replace(/\.[^/.]+$/, '')}
        </span>
        <span className="text-[#0090C8] font-bold text-[10px]">
          #{(index + 1).toString().padStart(2, '0')}
        </span>
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

  // Distribute items into 3 wide columns (desktop) and 2 columns (tablet/mobile)
  const columns3 = useMemo(() => {
    const cols: StageMediaItem[][] = [[], [], []];
    items.forEach((item, idx) => {
      cols[idx % 3].push(item);
    });
    return cols;
  }, [items]);

  const columns2 = useMemo(() => {
    const cols: StageMediaItem[][] = [[], []];
    items.forEach((item, idx) => {
      cols[idx % 2].push(item);
    });
    return cols;
  }, [items]);

  // Track scroll position for subtle column parallax
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

      {/* Scrollable Editorial Wall Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="relative w-full h-full overflow-y-auto overflow-x-hidden no-scrollbar px-5 sm:px-10 md:px-14 lg:px-20 pt-28 pb-32 overscroll-contain"
      >
        <div className="max-w-[1680px] mx-auto">
          {/* Header Tag for Works / Exhibition */}
          <div className="mb-10 text-center sm:text-left select-none">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 border border-black/10 text-[10px] font-mono tracking-[0.25em] text-neutral-800 uppercase font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0090C8] animate-ping" />
              CURATED EDITORIAL ARCHIVE • {items.length} WORKS
            </div>
            <h1 className="mt-3 text-3xl sm:text-5xl font-black font-space tracking-tight text-neutral-900 uppercase">
              {album.name}
            </h1>
            <p className="mt-1 text-xs sm:text-sm font-mono tracking-widest text-neutral-500 uppercase">
              Large Heroic Prints • Adaptive Landscape & Portrait Geometry
            </p>
          </div>

          {/* Desktop 3 Columns Layout with Subtle Parallax */}
          <div className="hidden lg:grid grid-cols-3 gap-7 xl:gap-8 items-start">
            {columns3.map((colItems, colIdx) => {
              // Subtle column parallax factor
              const parallaxOffset = colIdx === 1 ? scrollY * -0.03 : scrollY * 0.02;

              return (
                <div
                  key={`col-3-${colIdx}`}
                  style={{ transform: `translateY(${parallaxOffset}px)` }}
                  className="flex flex-col gap-7 xl:gap-8 transition-transform duration-75 will-change-transform"
                >
                  {colItems.map((item, itemIdx) => {
                    const originalIndex = items.findIndex((i) => i.id === item.id);
                    return (
                      <MasonryCard
                        key={item.id}
                        item={item}
                        index={originalIndex >= 0 ? originalIndex : itemIdx}
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
            {columns2.map((colItems, colIdx) => {
              const parallaxOffset = colIdx === 1 ? scrollY * -0.02 : 0;

              return (
                <div
                  key={`col-2-${colIdx}`}
                  style={{ transform: `translateY(${parallaxOffset}px)` }}
                  className="flex flex-col gap-6 sm:gap-7 transition-transform duration-75"
                >
                  {colItems.map((item, itemIdx) => {
                    const originalIndex = items.findIndex((i) => i.id === item.id);
                    return (
                      <MasonryCard
                        key={item.id}
                        item={item}
                        index={originalIndex >= 0 ? originalIndex : itemIdx}
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
