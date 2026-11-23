import React, { useMemo, useState, useEffect } from 'react';
import type { StageMediaItem } from '../../types';
import { getMediaUrl, getVideoStreamUrl } from '../../utils/imageUrlResolver';
import { resolveStaticVideoThumbnail } from '../../utils/thumbnailResolver';
import { isVideoExtension } from '../../utils/mediaTypeDetector';
import { InitializingArchiveLoader } from './InitializingArchiveLoader';
import { TacticalTelemetryGraph } from '../navigation/TacticalTelemetryGraph';
import { DiurnalPhase24hSummary } from '../telemetry/DiurnalPhase24hSummary';
import { getCachedMediaRecords } from '../../utils/cachedMediaManager';

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
 * - Rules: Picks up to 10 media cards from cached media.
 * - Maximum 6 shorts (always playing, satisfying GPU hardware decoder limit) + remaining slots filled with cached images (photos).
 * - Excludes landscape videos as cards are portrait (9:16).
 * - Wide Screen: Continuous sliding strip of 100% text-free cached media cards.
 * - Portrait Screen: Dual graphs (7-Day at top + 24-Hour at bottom) with the text-free sliding strip in middle.
 * - Tapping any media card opens the enlarged Cached Media window.
 * - Zero rounded corners, zero outlines, zero card text.
 */
export const HomepageCachedFeatured: React.FC<HomepageCachedFeaturedProps> = ({
  allItems,
  onOpenPhoto,
  onOpenShort,
  onOpenVideo: _onOpenVideo,
  isPortrait,
  portraitSelectedDay,
  setPortraitSelectedDay,
  randomSeed,
}) => {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isPlaybackReady, setIsPlaybackReady] = useState(false);
  const [cacheUpdateTrigger, setCacheUpdateTrigger] = useState(0);

  // Listen to cached-media-updated custom events
  useEffect(() => {
    const handleUpdate = () => {
      setCacheUpdateTrigger((prev) => prev + 1);
    };
    window.addEventListener('cached-media-updated', handleUpdate);
    return () => window.removeEventListener('cached-media-updated', handleUpdate);
  }, []);

  // Pick maximum 6 shorts and fill up to 10 total cards with cached photos
  const selectedBatch = useMemo(() => {
    const records = getCachedMediaRecords();
    const shortsPool: StageMediaItem[] = [];
    const photosPool: StageMediaItem[] = [];

    const categorizeItem = (item: StageMediaItem) => {
      const isShort =
        item.mediaType === 'short' ||
        (item.path || item.url || '').toLowerCase().includes('/shorts/');
      const isVid =
        !isShort &&
        (item.type === 'video' ||
          item.mediaType === 'clip' ||
          isVideoExtension(item.path || item.url || item.name || ''));

      // Skip landscape video clips from homepage showcase (portrait cards only)
      if (isShort) {
        shortsPool.push(item);
      } else if (!isVid) {
        photosPool.push(item);
      }
    };

    records.forEach((r) => {
      if (r && r.item) categorizeItem(r.item);
    });

    // Fallback seed from catalog pool if visitor is brand new and has no cached media yet
    if (shortsPool.length === 0 && photosPool.length === 0 && allItems && allItems.length > 0) {
      allItems.forEach((item) => categorizeItem(item));
    }

    // Rule: Pick maximum 6 shorts
    const maxShorts = 6;
    const pickedShorts = shortsPool.slice(0, maxShorts);

    // Remaining slots up to 10 total cards filled with images
    const slotsForPhotos = Math.max(0, 10 - pickedShorts.length);
    const pickedPhotos = photosPool.slice(0, slotsForPhotos);

    const combined = [...pickedShorts, ...pickedPhotos];

    // Shuffle slightly with randomSeed if provided
    if (randomSeed !== undefined && combined.length > 0) {
      const shuffled = [...combined];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled.slice(0, 10);
    }

    return combined.slice(0, 10);
  }, [allItems, cacheUpdateTrigger, randomSeed]);

  // Duplicate for seamless infinite sliding loop
  const displayList = useMemo(() => {
    if (selectedBatch.length === 0) return [];
    let list = [...selectedBatch];
    while (list.length < 20) {
      list = [...list, ...selectedBatch];
    }
    return [...list, ...list];
  }, [selectedBatch]);

  // Fast preloading so cards are bufferless
  useEffect(() => {
    if (selectedBatch.length === 0) {
      setIsPlaybackReady(true);
      return;
    }

    setIsPlaybackReady(false);
    setDisplayProgress(0);

    const total = selectedBatch.length;
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
        }, 150);
      }
    };

    selectedBatch.forEach((item) => {
      const isShort =
        item.mediaType === 'short' ||
        (item.path || item.url || '').toLowerCase().includes('/shorts/');

      if (isShort) {
        // Video poster/thumbnail check
        const poster =
          item.thumbnail ||
          resolveStaticVideoThumbnail(item) ||
          item.poster ||
          getMediaUrl(item.url || item.path || '');
        if (!poster) {
          checkComplete();
          return;
        }
        const img = new Image();
        img.onload = checkComplete;
        img.onerror = checkComplete;
        img.src = poster;
      } else {
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
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [selectedBatch]);

  const handleCardClick = (item: StageMediaItem) => {
    const isShort =
      item.mediaType === 'short' ||
      (item.path || item.url || '').toLowerCase().includes('/shorts/');

    if (isShort) {
      const shortsInBatch = selectedBatch.filter(
        (m) =>
          m.mediaType === 'short' ||
          (m.path || m.url || '').toLowerCase().includes('/shorts/')
      );
      const idx = shortsInBatch.findIndex(
        (m) =>
          (m.id && item.id && m.id === item.id) ||
          (m.url && item.url && m.url === item.url) ||
          (m.path && item.path && m.path === item.path)
      );
      onOpenShort(item, shortsInBatch, idx >= 0 ? idx : 0, 'Cached');
    } else {
      const photosInBatch = selectedBatch.filter(
        (m) =>
          !(
            m.mediaType === 'short' ||
            (m.path || m.url || '').toLowerCase().includes('/shorts/')
          )
      );
      const idx = photosInBatch.findIndex(
        (m) =>
          (m.id && item.id && m.id === item.id) ||
          (m.url && item.url && m.url === item.url) ||
          (m.path && item.path && m.path === item.path)
      );
      onOpenPhoto(item, photosInBatch, idx >= 0 ? idx : 0);
    }
  };

  // Helper to render media card content (Playing short video or photo image)
  const renderCardContent = (item: StageMediaItem, idx: number) => {
    const isShort =
      item.mediaType === 'short' ||
      (item.path || item.url || '').toLowerCase().includes('/shorts/');

    if (isShort) {
      const videoSrc = getVideoStreamUrl(item.url || item.path || '');
      const posterSrc =
        item.thumbnail ||
        resolveStaticVideoThumbnail(item) ||
        item.poster ||
        getMediaUrl(item.url || item.path || '');

      return (
        <video
          ref={(el) => {
            if (el && el.paused) {
              el.muted = true;
              el.defaultMuted = true;
              el.play().catch(() => {});
            }
          }}
          src={videoSrc}
          poster={posterSrc}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover block filter saturate-[0.98] contrast-[1.03]"
          style={{ borderRadius: 0, outline: 'none', border: 'none' }}
        />
      );
    }

    const imageSrc =
      item.thumbnail ||
      item.poster ||
      getMediaUrl(item.url || item.path || '');

    return (
      <img
        src={imageSrc}
        alt=""
        loading={idx < 6 ? 'eager' : 'lazy'}
        className="w-full h-full object-cover block filter saturate-[0.98] contrast-[1.03]"
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      />
    );
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

        {/* Middle: Text-Free Sliding Showcase (Max 10 Cards, Always Playing Shorts) */}
        {displayList.length === 0 ? (
          <div
            className="w-full flex-1 flex items-center justify-center text-center text-[#64748b] text-xs font-mono tracking-widest uppercase select-none"
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
              {displayList.map((item, idx) => (
                <div
                  key={`${item.id || item.url || item.name}-${idx}`}
                  onClick={() => handleCardClick(item)}
                  className="w-[130px] sm:w-[155px] h-[210px] sm:h-[250px] aspect-[9/16] bg-[#080b12] flex-shrink-0 cursor-pointer overflow-hidden transition-transform duration-300 hover:scale-[1.04] relative select-none"
                  style={{
                    borderRadius: 0,
                    outline: 'none',
                    border: 'none',
                  }}
                >
                  {renderCardContent(item, idx)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom: 24-Hour Diurnal Breakdown Graph */}
        <div className="w-full flex justify-center shrink-0 pt-1 pb-1">
          <DiurnalPhase24hSummary dayIndex={portraitSelectedDay} />
        </div>

        <style>{`
          @keyframes photosSlowSlide {
            0% {
              transform: translate3d(0, 0, 0);
            }
            100% {
              transform: translate3d(-50%, 0, 0);
            }
          }
          .animate-photos-slow-slide {
            animation: photosSlowSlide 90s linear infinite;
            will-change: transform;
            transform: translate3d(0, 0, 0);
            backface-visibility: hidden;
          }
        `}</style>
      </div>
    );
  }

  // -------------------------------------------------------------
  // WIDE SCREEN VIEW: Uniform Full-Width Sliding Strip (Max 10 Cards)
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
          className="w-full h-full flex items-center justify-center text-center text-[#64748b] text-xs font-mono tracking-widest uppercase select-none"
        >
          // NO MEDIA CACHED
        </div>
      ) : (
        /* Infinite Horizontal Sliding Strip of Text-Free Cached Media (Max 10 Unique Cards) */
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
          {displayList.map((item, idx) => (
            <div
              key={`${item.id || item.url || item.name}-${idx}`}
              onClick={() => handleCardClick(item)}
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
              {renderCardContent(item, idx)}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes photosSlowSlide {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }
        .animate-photos-slow-slide {
          animation: photosSlowSlide 90s linear infinite;
          will-change: transform;
          transform: translate3d(0, 0, 0);
          backface-visibility: hidden;
        }
      `}</style>
    </div>
  );
};
