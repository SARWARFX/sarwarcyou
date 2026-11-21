import React, { useState, useEffect } from 'react';
import type { StageMediaItem } from '../../types';
import { LivingMediaCard } from './LivingMediaCard';
import { resolveStaticVideoThumbnail } from '../../utils/thumbnailResolver';
import { getMediaUrl } from '../../utils/imageUrlResolver';
import { isPhotoExtension } from '../../utils/mediaTypeDetector';

export interface BufferedMediaGridProps {
  itemsList: StageMediaItem[];
  aspectRatio: '3/4' | '9/16' | '16/9';
  pageKey: string;
  onOpenItem: (item: StageMediaItem, playlist: StageMediaItem[], idx: number) => void;
  hapticMedium: () => void;
  trackActivityEvent: (type: number) => void;
}

/**
 * High-Tech Bufferless Subfolder Page Media Grid:
 * - Displays the standard 'INITIALIZING ARCHIVE' text-as-slider loader for all page switches.
 * - Actively preloads all thumbnail images into the browser cache before revealing the grid.
 * - Text color fills smoothly 0% -> 100% left-to-right as thumbnails genuinely load.
 * - Once 100% loaded, content reveals immediately bufferless with zero blank cards.
 */
export const BufferedMediaGrid: React.FC<BufferedMediaGridProps> = ({
  itemsList,
  aspectRatio,
  pageKey,
  onOpenItem,
  hapticMedium,
  trackActivityEvent,
}) => {
  const [isReady, setIsReady] = useState(false);
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    if (!itemsList || itemsList.length === 0) {
      setIsReady(true);
      return;
    }

    setIsReady(false);
    setDisplayProgress(0);

    // Preload all visible thumbnails on the page (up to 30 items)
    const targets = itemsList.slice(0, Math.min(30, itemsList.length));
    const total = targets.length;
    let loadedCount = 0;
    let isCancelled = false;

    const checkComplete = () => {
      loadedCount++;
      const pct = Math.min(95, Math.round((loadedCount / total) * 100));
      setDisplayProgress(pct);

      if (loadedCount >= total) {
        setDisplayProgress(100);
        setTimeout(() => {
          if (!isCancelled) {
            setIsReady(true);
          }
        }, 320);
      }
    };

    targets.forEach((item) => {
      const isPhoto =
        item.type === 'image' || isPhotoExtension(item.path || item.url || item.name || '');
      const src =
        (item as any).thumbnail ||
        (!isPhoto ? resolveStaticVideoThumbnail(item) : '') ||
        item.poster ||
        getMediaUrl(item.url || item.path || '');

      if (!src) {
        checkComplete();
        return;
      }

      let done = false;
      const onImageLoaded = () => {
        if (done) return;
        done = true;
        checkComplete();
      };

      const img = new Image();
      img.onload = onImageLoaded;
      img.onerror = onImageLoaded;
      img.src = src;

      if (img.complete && img.naturalWidth > 0) {
        onImageLoaded();
      }
    });

    // Safety timeout: never leave visitor frozen if a third-party CDN or network throttles
    const safetyTimer = setTimeout(() => {
      if (!isCancelled && loadedCount < total) {
        setDisplayProgress(100);
        setTimeout(() => {
          if (!isCancelled) setIsReady(true);
        }, 250);
      }
    }, 3200);

    return () => {
      isCancelled = true;
      clearTimeout(safetyTimer);
    };
  }, [pageKey, itemsList]);

  if (!isReady) {
    return (
      <div className="w-full flex-1 flex items-center justify-center py-28 select-none">
        <div
          className="relative inline-block font-bold uppercase select-none text-base sm:text-lg md:text-xl tracking-[0.22em] whitespace-nowrap"
          style={{ fontFamily: "'Science Gothic', sans-serif" }}
        >
          {/* Base Layer: Initial two-color dimmed state */}
          <div className="opacity-25 transition-opacity duration-300">
            <span className="text-white">INITIALIZING </span>
            <span className="text-[#38bdf8]">ARCHIVE</span>
          </div>

          {/* Active Progress Layer: Fills in glowing vibrant colors from left to the very right edge */}
          <div
            className="absolute inset-y-0 left-0 overflow-hidden transition-[width] duration-300 ease-out"
            style={{
              width: `${displayProgress}%`,
              borderRight: displayProgress < 100 ? '2px solid #38bdf8' : 'none',
              boxShadow: displayProgress < 100 ? '2px 0 10px rgba(56,189,248,0.85)' : 'none',
            }}
          >
            <div className="whitespace-nowrap">
              <span className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]">INITIALIZING </span>
              <span className="text-[#38bdf8] drop-shadow-[0_0_12px_#38bdf8]">ARCHIVE</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 pb-6"
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
    >
      {itemsList.map((item: StageMediaItem, idx: number) => (
        <LivingMediaCard
          key={`${item.id || item.url || item.name}-${idx}`}
          item={item}
          aspectRatio={aspectRatio}
          delayIdx={idx}
          onClick={() => {
            hapticMedium();
            trackActivityEvent(1);
            onOpenItem(item, itemsList, idx);
          }}
        />
      ))}
    </div>
  );
};

export default BufferedMediaGrid;
