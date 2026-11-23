import React, { useMemo, useState, useEffect } from 'react';
import type { StageMediaItem } from '../../types';
import { getMediaUrl } from '../../utils/imageUrlResolver';
import { InitializingArchiveLoader } from './InitializingArchiveLoader';
import { TacticalTelemetryGraph } from '../navigation/TacticalTelemetryGraph';
import { DiurnalPhase24hSummary } from '../telemetry/DiurnalPhase24hSummary';
import { getFeaturedCachedPool } from '../../utils/cachedMediaManager';
import { CachedMediaVaultModal } from './CachedMediaVaultModal';

export interface HomepageCachedFeaturedProps {
  allItems: StageMediaItem[];
  onOpenPhoto: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenShort: (item: StageMediaItem, shorts: StageMediaItem[], index: number, folderName?: string) => void;
  onOpenVideo: (item: StageMediaItem, playlist: StageMediaItem[]) => void;
  isPortrait: boolean;
  portraitSelectedDay: number;
  setPortraitSelectedDay: (dayIdx: number) => void;
  randomSeed?: number;
}

/**
 * Uniform Homepage Featured Page:
 * - Wide Screen: Continuous sliding strip of 100% text-free cached media cards.
 * - Portrait Screen: Dual graphs (7-Day at top + 24-Hour at bottom) with the text-free sliding strip in middle.
 * - Tapping any media card opens the sleek, minimal dynamic Cached Media window.
 * - Zero rounded corners, zero outlines, zero card text.
 */
export const HomepageCachedFeatured: React.FC<HomepageCachedFeaturedProps> = ({
  allItems,
  onOpenPhoto,
  onOpenShort,
  onOpenVideo,
  isPortrait,
  portraitSelectedDay,
  setPortraitSelectedDay,
  randomSeed,
}) => {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isPlaybackReady, setIsPlaybackReady] = useState(false);
  const [cachedItems, setCachedItems] = useState<StageMediaItem[]>([]);
  const [isVaultOpen, setIsVaultOpen] = useState(false);

  // Load cached media or seed items
  useEffect(() => {
    const pool = getFeaturedCachedPool(allItems);
    setCachedItems(pool);

    const handleUpdate = () => {
      setCachedItems(getFeaturedCachedPool(allItems));
    };
    window.addEventListener('cached-media-updated', handleUpdate);
    return () => window.removeEventListener('cached-media-updated', handleUpdate);
  }, [allItems]);

  // Pick up to 20 cached items and shuffle
  const selectedBatch = useMemo(() => {
    if (!cachedItems || cachedItems.length === 0) return [];
    const pool = [...cachedItems];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 20);
  }, [cachedItems, randomSeed]);

  // Duplicate for seamless infinite sliding loop
  const displayList = useMemo(() => {
    if (selectedBatch.length === 0) return [];
    return [...selectedBatch, ...selectedBatch];
  }, [selectedBatch]);

  // Preload initial batch for bufferless reveal
  useEffect(() => {
    if (selectedBatch.length === 0) {
      setIsPlaybackReady(true);
      return;
    }

    setIsPlaybackReady(false);
    setDisplayProgress(0);

    const initialBatch = selectedBatch.slice(0, Math.min(8, selectedBatch.length));
    const total = initialBatch.length;
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
            setIsPlaybackReady(true);
          }
        }, 300);
      }
    };

    initialBatch.forEach((item) => {
      const src =
        item.thumbnail ||
        item.poster ||
        getMediaUrl(item.url || item.path || '');
      if (!src) {
        checkComplete();
        return;
      }
      const img = new Image();
      img.onload = checkComplete;
      img.onerror = checkComplete;
      img.src = src;
    });

    return () => {
      isCancelled = true;
    };
  }, [selectedBatch]);

  const handleCardClick = () => {
    setIsVaultOpen(true);
  };

  // -------------------------------------------------------------
  // PORTRAIT SCREEN VIEW: Dual Graphs + Middle Text-Free Slider
  // -------------------------------------------------------------
  if (isPortrait) {
    return (
      <div
        className="w-full h-full flex flex-col justify-between items-center overflow-hidden py-1 gap-2"
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      >
        {/* Top: 7-Day Usage Telemetry Graph */}
        <div className="w-full flex justify-center shrink-0 pt-1 pb-1">
          <TacticalTelemetryGraph
            size="large"
            selectedDayIndex={portraitSelectedDay}
            onSelectDay={(dayIdx) => setPortraitSelectedDay(dayIdx)}
          />
        </div>

        {/* Middle: Text-Free Sliding Showcase */}
        {displayList.length === 0 ? (
          <div
            onClick={handleCardClick}
            className="w-full flex-1 flex items-center justify-center text-center cursor-pointer text-[#64748b] text-xs font-mono tracking-widest uppercase select-none"
          >
            // NO MEDIA CACHED
          </div>
        ) : (
          <div className="w-full flex-1 flex items-center justify-start overflow-hidden min-h-[220px] relative select-none">
            {!isPlaybackReady && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-transparent pointer-events-none select-none px-4">
                <InitializingArchiveLoader progress={displayProgress} scheme="blue" />
              </div>
            )}

            <div
              className={`flex gap-3 sm:gap-4 w-max transition-opacity duration-700 ${
                isPlaybackReady
                  ? 'opacity-100 animate-photos-slow-slide hover:[animation-play-state:paused]'
                  : 'opacity-0 pointer-events-none'
              }`}
              style={{
                borderRadius: 0,
                outline: 'none',
                border: 'none',
                willChange: 'transform',
                transform: 'translate3d(0, 0, 0)',
              }}
            >
              {displayList.map((item, idx) => {
                const imageSrc =
                  item.thumbnail ||
                  item.poster ||
                  getMediaUrl(item.url || item.path || '');

                return (
                  <div
                    key={`${item.id || item.url || item.name}-${idx}`}
                    onClick={handleCardClick}
                    className="w-[130px] sm:w-[155px] h-[210px] sm:h-[250px] aspect-[9/16] bg-[#080b12] flex-shrink-0 cursor-pointer overflow-hidden transition-transform duration-300 hover:scale-[1.04] relative select-none"
                    style={{
                      borderRadius: 0,
                      outline: 'none',
                      border: 'none',
                    }}
                  >
                    <img
                      src={imageSrc}
                      alt=""
                      loading={idx < 6 ? 'eager' : 'lazy'}
                      className="w-full h-full object-cover block filter saturate-[0.98] contrast-[1.03]"
                      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom: 24-Hour Diurnal Breakdown Graph */}
        <div className="w-full flex justify-center shrink-0 pt-1 pb-1">
          <DiurnalPhase24hSummary dayIndex={portraitSelectedDay} />
        </div>

        {/* Sleek Dynamic Modal Window */}
        <CachedMediaVaultModal
          isOpen={isVaultOpen}
          onClose={() => setIsVaultOpen(false)}
          onOpenPhoto={onOpenPhoto}
          onOpenShort={onOpenShort}
          onOpenVideo={onOpenVideo}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // WIDE SCREEN VIEW: Uniform Full-Width Sliding Strip of Text-Free Cards
  // -------------------------------------------------------------
  return (
    <div
      className="w-full h-full flex items-center justify-start overflow-hidden relative select-none pl-6 sm:pl-10"
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
    >
      {/* High-Tech Loader */}
      {!isPlaybackReady && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-transparent pointer-events-none select-none px-4">
          <InitializingArchiveLoader progress={displayProgress} scheme="blue" />
        </div>
      )}

      {displayList.length === 0 ? (
        <div
          onClick={handleCardClick}
          className="w-full h-full flex items-center justify-center text-center cursor-pointer text-[#64748b] text-xs font-mono tracking-widest uppercase select-none"
        >
          // NO MEDIA CACHED
        </div>
      ) : (
        /* Infinite Horizontal Sliding Strip of Text-Free Cached Media */
        <div
          className={`flex gap-4 sm:gap-6 w-max transition-opacity duration-700 ${
            isPlaybackReady
              ? 'opacity-100 animate-photos-slow-slide hover:[animation-play-state:paused]'
              : 'opacity-0 pointer-events-none'
          }`}
          style={{
            borderRadius: 0,
            outline: 'none',
            border: 'none',
            willChange: 'transform',
            transform: 'translate3d(0, 0, 0)',
          }}
        >
          {displayList.map((item, idx) => {
            const imageSrc =
              item.thumbnail ||
              item.poster ||
              getMediaUrl(item.url || item.path || '');

            return (
              <div
                key={`${item.id || item.url || item.name}-${idx}`}
                onClick={handleCardClick}
                className="w-[155px] sm:w-[200px] md:w-[260px] h-[275px] sm:h-[356px] md:h-[462px] aspect-[9/16] bg-[#080b12] flex-shrink-0 cursor-pointer overflow-hidden transition-transform duration-300 hover:scale-[1.04] hover:z-20 relative select-none"
                style={{
                  borderRadius: 0,
                  outline: 'none',
                  border: 'none',
                  willChange: 'transform',
                  transform: 'translateZ(0)',
                  backfaceVisibility: 'hidden',
                }}
              >
                <img
                  src={imageSrc}
                  alt=""
                  loading={idx < 8 ? 'eager' : 'lazy'}
                  className="w-full h-full object-cover block filter saturate-[0.98] contrast-[1.03]"
                  style={{
                    borderRadius: 0,
                    outline: 'none',
                    border: 'none',
                    transform: 'translateZ(0)',
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Sleek Dynamic Modal Window */}
      <CachedMediaVaultModal
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
        onOpenPhoto={onOpenPhoto}
        onOpenShort={onOpenShort}
        onOpenVideo={onOpenVideo}
      />
    </div>
  );
};
