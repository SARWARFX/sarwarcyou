import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useMediaData } from './useMediaData';
import { extractTwelveAlbums } from './utils/albumExtractor';
import { AlbumStage } from './components/AlbumStage';
import { BrandLogo } from './components/BrandLogo';
import { AlbumProgressDots } from './components/AlbumProgressDots';
import { MediaModal } from './components/MediaModal';
import { ShortsFeedModal } from './components/ShortsFeedModal';
import { FALLBACK_MEDIA_DATA } from './data/fallbackData';
import type { StageMediaItem } from './types';
import { Loader2 } from 'lucide-react';

function App() {
  const { data, isLoading, isError } = useMediaData();

  // 12 Distinct Google Drive Albums
  const albums = useMemo(() => {
    return extractTwelveAlbums(data || FALLBACK_MEDIA_DATA);
  }, [data]);

  // Active snapped album index (0 to 11)
  const [activeAlbumIndex, setActiveAlbumIndex] = useState<number>(0);
  const [prevAlbumIndex, setPrevAlbumIndex] = useState<number>(0);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

  // Track active media item index per album
  const [activeMediaIndices, setActiveMediaIndices] = useState<{ [albumIdx: number]: number }>({});
  // Track active batch per album
  const [albumBatches, setAlbumBatches] = useState<{ [albumIdx: number]: number }>({});

  const activeAlbumIndexRef = useRef(activeAlbumIndex);
  useEffect(() => {
    activeAlbumIndexRef.current = activeAlbumIndex;
  }, [activeAlbumIndex]);

  const isTransitioningRef = useRef(false);
  const wheelDeltaAccumulatorRef = useRef(0);
  const lastWheelTimeRef = useRef(0);

  // Standard Photo & Widescreen Video Lightbox State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    url: string | null;
    type: 'video' | 'image';
    title?: string;
  }>({
    isOpen: false,
    url: null,
    type: 'image',
    title: '',
  });

  // Dedicated TikTok / Reels-style Vertical Shorts Modal State
  const [shortsFeedState, setShortsFeedState] = useState<{
    isOpen: boolean;
    shorts: StageMediaItem[];
    initialIndex: number;
  }>({
    isOpen: false,
    shorts: [],
    initialIndex: 0,
  });

  // Handle clicking any media item in the 3D scene
  const handleSelectItem = useCallback((item: StageMediaItem, albumIdx: number) => {
    const curAlbum = albums[albumIdx];
    // If it's the dedicated Shorts & Reels album (or vertical waterfall layout):
    if (curAlbum && (curAlbum.layoutType === 'vertical-waterfall' || curAlbum.name.toLowerCase().includes('short'))) {
      const itemIdx = curAlbum.items.findIndex((s) => s.id === item.id);
      setShortsFeedState({
        isOpen: true,
        shorts: curAlbum.items,
        initialIndex: Math.max(0, itemIdx),
      });
    } else {
      // Standard Photo Lightbox or Widescreen Video Player
      setModalState({
        isOpen: true,
        url: item.url,
        type: item.type,
        title: item.title,
      });
    }
  }, [albums]);

  // Luxury Elevator Smooth Navigation
  const scrollToAlbum = useCallback((targetIndex: number) => {
    const clamped = Math.max(0, Math.min(albums.length - 1, targetIndex));
    if (clamped === activeAlbumIndexRef.current && !isTransitioningRef.current) return;
    if (isTransitioningRef.current) return;

    isTransitioningRef.current = true;
    setIsTransitioning(true);
    setPrevAlbumIndex(activeAlbumIndexRef.current);
    setActiveAlbumIndex(clamped);

    // Luxury elevator duration: 950ms + 150ms inertia cooldown
    setTimeout(() => {
      setIsTransitioning(false);
      setPrevAlbumIndex(clamped);
      setTimeout(() => {
        isTransitioningRef.current = false;
        wheelDeltaAccumulatorRef.current = 0;
      }, 150);
    }, 950);
  }, [albums.length]);

  const handlePrevAlbum = useCallback(() => {
    scrollToAlbum(activeAlbumIndexRef.current - 1);
  }, [scrollToAlbum]);

  const handleNextAlbum = useCallback(() => {
    scrollToAlbum(activeAlbumIndexRef.current + 1);
  }, [scrollToAlbum]);

  const handleBackToTop = useCallback(() => {
    scrollToAlbum(0);
  }, [scrollToAlbum]);

  // Mouse wheel dampening & smooth elevator gliding
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (modalState.isOpen || shortsFeedState.isOpen) return;

      // Allow horizontal scrubbing inside Albums 1 & 2
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      e.preventDefault();

      const now = Date.now();

      // Dampen rapid inputs: if currently in elevator motion or cooldown, swallow and update timestamp
      if (isTransitioningRef.current) {
        lastWheelTimeRef.current = now;
        wheelDeltaAccumulatorRef.current = 0;
        return;
      }

      // Reset accumulator if previous burst was > 280ms ago
      if (now - lastWheelTimeRef.current > 280) {
        wheelDeltaAccumulatorRef.current = 0;
      }
      lastWheelTimeRef.current = now;

      wheelDeltaAccumulatorRef.current += e.deltaY;

      // Threshold ensures deliberate elevator floor command without jitter
      const THRESHOLD = 35;
      if (Math.abs(wheelDeltaAccumulatorRef.current) >= THRESHOLD) {
        const direction = wheelDeltaAccumulatorRef.current > 0 ? 1 : -1;
        wheelDeltaAccumulatorRef.current = 0;
        if (direction > 0) {
          handleNextAlbum();
        } else {
          handlePrevAlbum();
        }
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [modalState.isOpen, shortsFeedState.isOpen, handleNextAlbum, handlePrevAlbum]);

  // Mobile Touch Swipe with Dampening
  useEffect(() => {
    let touchStartY = 0;
    let touchStartX = 0;

    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (modalState.isOpen || shortsFeedState.isOpen) return;
      if (isTransitioningRef.current) return;

      const touchEndY = e.changedTouches[0].clientY;
      const touchEndX = e.changedTouches[0].clientX;
      const deltaY = touchStartY - touchEndY;
      const deltaX = touchStartX - touchEndX;

      // Only trigger if vertical swipe is dominant
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 45) {
        if (deltaY > 0) {
          handleNextAlbum();
        } else {
          handlePrevAlbum();
        }
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [modalState.isOpen, shortsFeedState.isOpen, handleNextAlbum, handlePrevAlbum]);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (modalState.isOpen || shortsFeedState.isOpen) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        handleNextAlbum();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevAlbum();
      } else if (e.key === 'Home') {
        e.preventDefault();
        handleBackToTop();
      } else if (e.key === 'End') {
        e.preventDefault();
        scrollToAlbum(albums.length - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalState.isOpen, shortsFeedState.isOpen, handleNextAlbum, handlePrevAlbum, handleBackToTop, scrollToAlbum, albums.length]);

  // Loading Screen
  if (!data && isLoading) {
    return (
      <div className="fixed inset-0 bg-[#000000] flex flex-col items-center justify-center text-white z-50">
        <div className="relative flex flex-col items-center gap-6">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-2 border-[#00D2FF]/20 border-t-[#00D2FF] animate-spin" />
            <Loader2 className="absolute w-5 h-5 text-white animate-pulse" />
          </div>
          <div className="text-xs font-mono tracking-[0.3em] text-white/50 uppercase">
            INITIALIZING 12 3D ALBUMS...
          </div>
        </div>
      </div>
    );
  }

  // Error Screen
  if (!data && isError) {
    return (
      <div className="fixed inset-0 bg-[#000000] flex items-center justify-center text-white p-6 font-mono">
        <div className="max-w-md p-8 rounded-2xl bg-neutral-900 border border-white/10 text-center space-y-4">
          <div className="text-red-400 text-2xl font-bold">[ NETWORK ERROR ]</div>
          <p className="text-xs text-white/60">
            Unable to stream cloud media. Please check your internet connection.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 rounded-full bg-white text-black font-bold text-xs uppercase hover:bg-neutral-200 transition-colors"
          >
            RETRY
          </button>
        </div>
      </div>
    );
  }

  const isLightMode = false;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* ================= VERTICAL LUXURY ELEVATOR CONTAINER ================= */}
      <div
        className="w-full h-full will-change-transform"
        style={{
          transform: `translate3d(0, -${activeAlbumIndex * 100}vh, 0)`,
          transition: isTransitioning
            ? 'transform 950ms cubic-bezier(0.16, 1, 0.3, 1)'
            : 'none',
        }}
      >
        {albums.map((album, idx) => {
          const isActive = idx === activeAlbumIndex;
          const isNear =
            Math.abs(idx - activeAlbumIndex) <= 1 ||
            Math.abs(idx - prevAlbumIndex) <= 1;
          const currentMediaIdx = activeMediaIndices[idx] || 0;
          const currentBatch = albumBatches[idx] || 0;

          return (
            <section
              id={`album-section-${idx}`}
              key={album.id}
              className="relative w-screen h-screen overflow-hidden flex-shrink-0 bg-black"
            >
              {/* Perfectly Centered 3D / Masonry Stage */}
              {isNear && (
                <AlbumStage
                  album={album}
                  isActive={isActive && !isTransitioning}
                  isVisible={isNear}
                  activeIndex={currentMediaIdx}
                  onActiveIndexChange={(newIdx) => {
                    setActiveMediaIndices((prev) => ({ ...prev, [idx]: newIdx }));
                    if (idx === 0) {
                      const computedBatch = Math.floor(newIdx / 6);
                      setAlbumBatches((prev) => {
                        if (prev[0] !== computedBatch) {
                          return { ...prev, [0]: computedBatch };
                        }
                        return prev;
                      });
                    }
                  }}
                  batchIndex={currentBatch}
                  onSelectItem={(item) => handleSelectItem(item, idx)}
                />
              )}
            </section>
          );
        })}
      </div>

      {/* ================= ULTRA-MINIMAL HUD ================= */}

      {/* 1. DYNAMIC BRAND LOGO (Corner Cycling + Living Chromatic Sync + Synced Favicon) */}
      <BrandLogo activeAlbumIndex={activeAlbumIndex} isLightMode={isLightMode} />

      {/* 2. AUTO-HIDING RIGHT-SIDE NAVIGATION DOCK */}
      <AlbumProgressDots
        albums={albums}
        activeAlbumIndex={activeAlbumIndex}
        onSelectAlbum={scrollToAlbum}
        isLightMode={isLightMode}
      />

      {/* ================= MODALS (USER-TRIGGERED ONLY) ================= */}

      {/* DEDICATED TIKTOK/REELS-STYLE VERTICAL SHORTS PLAYER */}
      <ShortsFeedModal
        isOpen={shortsFeedState.isOpen}
        onClose={() => setShortsFeedState((prev) => ({ ...prev, isOpen: false }))}
        shorts={shortsFeedState.shorts}
        initialIndex={shortsFeedState.initialIndex}
      />

      {/* STANDARD PHOTOS LIGHTBOX & 16:9 VIDEO PLAYER WITH ZOOM */}
      <MediaModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        url={modalState.url}
        type={modalState.type}
        title={modalState.title}
      />
    </main>
  );
}

export default App;
