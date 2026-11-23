import React, { useMemo, useState, useEffect } from 'react';
import type { StageMediaItem } from '../../types';
import { getMediaUrl } from '../../utils/imageUrlResolver';
import { isVideoExtension } from '../../utils/mediaTypeDetector';
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
 * - Wide Screen: Uniform continuous sliding strip showcasing cached media (Photos, Shorts, Videos).
 * - Portrait Screen: Dual graphs (7-Day at top + 24-Hour at bottom) with the featured cached strip in middle.
 * - Tapping any cached media item opens the Full Page 3-Category Vault with Clear Cache controls.
 * - 0px border radius, cyber neon tags, zero outlines.
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

  // Tapping ANY cached media item opens the 3-category full cached vault page!
  const handleItemClick = () => {
    setIsVaultOpen(true);
  };

  // -------------------------------------------------------------
  // PORTRAIT SCREEN VIEW: Dual Graphs + Middle Cached Slider
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

        {/* Middle: Featured Cached Media Sliding Showcase */}
        {displayList.length === 0 ? (
          <div className="w-full flex-1 flex flex-col items-center justify-center text-center p-4 border border-white/10 bg-[#05070d]">
            <span className="font-mono text-xs font-bold text-white uppercase tracking-wider mb-1">
              // BROWSER CACHE IS EMPTY
            </span>
            <p className="font-mono text-[10px] text-neutral-400 max-w-xs mb-3">
              Browse any section to automatically cache media locally.
            </p>
            <button
              onClick={() => setIsVaultOpen(true)}
              className="px-3 py-1 bg-cyan-950/60 border border-cyan-400/40 text-cyan-300 font-mono text-[10px] font-bold uppercase tracking-wider"
            >
              VIEW CACHED VAULT (0)
            </button>
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

                const isShort = item.mediaType === 'short' || (item.path || item.url || '').toLowerCase().includes('/shorts/');
                const isVid = !isShort && (item.type === 'video' || item.mediaType === 'clip' || isVideoExtension(item.path || item.url || item.name || ''));
                const typeLabel = isShort ? 'SHORT' : isVid ? 'VIDEO' : 'PHOTO';

                return (
                  <div
                    key={`${item.id || item.url || item.name}-${idx}`}
                    onClick={handleItemClick}
                    title="Tap to open full cached media vault"
                    className="w-[130px] sm:w-[155px] h-[210px] sm:h-[250px] aspect-[9/16] bg-[#080b12] border border-white/10 flex-shrink-0 cursor-pointer overflow-hidden transition-transform duration-300 hover:scale-[1.04] relative select-none group"
                    style={{ borderRadius: 0, outline: 'none' }}
                  >
                    <img
                      src={imageSrc}
                      alt={item.name || ''}
                      loading={idx < 6 ? 'eager' : 'lazy'}
                      className="w-full h-full object-cover block filter saturate-[0.98] contrast-[1.03]"
                      style={{ borderRadius: 0 }}
                    />

                    {/* Neon Status Badges */}
                    <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none">
                      <span className="px-1.5 py-0.5 bg-black/85 border border-emerald-500 text-emerald-400 font-mono text-[8px] font-bold">
                        ● OFFLINE
                      </span>
                      <span className="px-1.5 py-0.5 bg-cyan-950/90 border border-cyan-400/40 text-cyan-300 font-mono text-[8px] font-bold">
                        {typeLabel}
                      </span>
                    </div>

                    {/* Bottom title gradient */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-2">
                      <span className="font-mono text-[9.5px] text-white font-bold truncate block">
                        {item.title || item.name || 'Cached Asset'}
                      </span>
                    </div>
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

        {/* 3-Category Full Page Cached Media Vault Modal */}
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
  // WIDE SCREEN VIEW: Uniform Full-Width Sliding Strip of Cached Media
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
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 border border-white/5 bg-[#060910]">
          <span className="w-9 h-9 bg-cyan-950 border border-cyan-500/40 text-cyan-400 flex items-center justify-center font-mono text-sm mb-3">
            0
          </span>
          <h3 className="font-mono text-sm font-bold text-white uppercase tracking-widest mb-1">
            // BROWSER STORAGE IS EMPTY (0 BYTES STORED)
          </h3>
          <p className="font-mono text-xs text-neutral-400 max-w-md mb-4">
            The browser currently holds zero cached data. Browse any section (Photographs, Shorts, or Video Clips) and open items to cache them for offline access.
          </p>
          <button
            onClick={() => setIsVaultOpen(true)}
            className="px-4 py-2 bg-cyan-950/80 border border-cyan-400/60 hover:bg-cyan-900 text-cyan-300 font-mono text-xs font-bold uppercase tracking-wider transition-all"
          >
            OPEN CACHED VAULT &bull; CLEAR CACHE CONTROLS
          </button>
        </div>
      ) : (
        /* Infinite Horizontal Sliding Strip of Cached Media */
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

            const isShort = item.mediaType === 'short' || (item.path || item.url || '').toLowerCase().includes('/shorts/');
            const isVid = !isShort && (item.type === 'video' || item.mediaType === 'clip' || isVideoExtension(item.path || item.url || item.name || ''));
            const typeLabel = isShort ? 'SHORT' : isVid ? 'VIDEO' : 'PHOTO';

            return (
              <div
                key={`${item.id || item.url || item.name}-${idx}`}
                onClick={handleItemClick}
                title="Click to open full cached media vault"
                className="w-[155px] sm:w-[200px] md:w-[260px] h-[275px] sm:h-[356px] md:h-[462px] aspect-[9/16] bg-[#080b12] border border-white/10 flex-shrink-0 cursor-pointer overflow-hidden transition-transform duration-300 hover:scale-[1.04] hover:border-cyan-400 relative select-none group"
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
                  alt={item.name || ''}
                  loading={idx < 8 ? 'eager' : 'lazy'}
                  className="w-full h-full object-cover block filter saturate-[0.98] contrast-[1.03]"
                  style={{
                    borderRadius: 0,
                    outline: 'none',
                    border: 'none',
                    transform: 'translateZ(0)',
                  }}
                />

                {/* Neon Top Badges */}
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                  <span className="px-2 py-0.5 bg-black/85 border border-emerald-500 text-emerald-400 font-mono text-[9.5px] font-bold tracking-wider">
                    ● OFFLINE
                  </span>
                  <span className="px-2 py-0.5 bg-cyan-950/90 border border-cyan-400/50 text-cyan-300 font-mono text-[9.5px] font-bold">
                    {typeLabel}
                  </span>
                </div>

                {/* Bottom Card Telemetry */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent p-3 sm:p-4 flex flex-col justify-end">
                  <span className="font-mono text-xs sm:text-sm text-white font-bold truncate">
                    {item.title || item.name || 'Cached Asset'}
                  </span>
                  <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-neutral-400 mt-1">
                    <span className="text-emerald-400">TAP TO VIEW VAULT</span>
                    <span className="text-cyan-300 font-bold">&rarr;</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3-Category Full Page Cached Media Vault Modal */}
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
