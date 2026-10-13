import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useMediaData } from './useMediaData';
import { extractTwelveAlbums } from './utils/albumExtractor';
import { AlbumStage } from './components/AlbumStage';
import { TopNavbar } from './components/TopNavbar';
import { AlbumProgressDots } from './components/AlbumProgressDots';
import { YouTubeTheaterModal } from './components/YouTubeTheaterModal';
import { ShortsFeedModal } from './components/ShortsFeedModal';
import { FALLBACK_HF_CATALOG } from './data/fallbackData';
import type { StageMediaItem } from './types';

function App() {
  const { data, isLoading, isError } = useMediaData();

  // 12 Distinct Curated Albums (Powered by Hugging Face CDN)
  const albums = useMemo(() => {
    return extractTwelveAlbums(data || FALLBACK_HF_CATALOG);
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
    const currentAlbum = albums[activeAlbumIndex];
    if (currentAlbum) {
      document.title = `${currentAlbum.name} (${currentAlbum.itemCount}) — Sarwar C You`;
      const slug = currentAlbum.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (window.location.hash !== `#${slug}`) {
        window.history.replaceState(null, '', `#${slug}`);
      }
    }
  }, [activeAlbumIndex, albums]);

  // Deep-linking hash support on mount (e.g., #shorts, #works)
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '').toLowerCase();
    if (hash && albums.length > 0) {
      const foundIdx = albums.findIndex(
        (a) => a.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === hash
      );
      if (foundIdx >= 0 && foundIdx !== activeAlbumIndexRef.current) {
        setActiveAlbumIndex(foundIdx);
      }
    }
  }, [albums]);

  const isTransitioningRef = useRef(false);
  const wheelDeltaAccumulatorRef = useRef(0);
  const lastWheelTimeRef = useRef(0);

  // YouTube-Style Media Theater Modal State
  const [theaterState, setTheaterState] = useState<{
    isOpen: boolean;
    album: typeof albums[0] | null;
    initialIndex: number;
  }>({
    isOpen: false,
    album: null,
    initialIndex: 0,
  });

  // Dedicated 9:16 Vertical Shorts Reel Modal State
  const [shortsState, setShortsState] = useState<{
    isOpen: boolean;
    shorts: StageMediaItem[];
    initialIndex: number;
  }>({
    isOpen: false,
    shorts: [],
    initialIndex: 0,
  });

  // Handle clicking any media item in the 3D / Driftime scene
  const handleSelectItem = useCallback((item: StageMediaItem, albumIdx: number) => {
    const curAlbum = albums[albumIdx];
    const itemIdx = curAlbum ? curAlbum.items.findIndex((s) => s.id === item.id) : 0;
    const isShorts =
      curAlbum?.name.toLowerCase().includes('short') ||
      curAlbum?.name.toLowerCase().includes('reel') ||
      curAlbum?.layoutType === 'vertical-waterfall';

    if (isShorts && curAlbum) {
      setShortsState({
        isOpen: true,
        shorts: curAlbum.items,
        initialIndex: Math.max(0, itemIdx),
      });
    } else {
      setTheaterState({
        isOpen: true,
        album: curAlbum || null,
        initialIndex: Math.max(0, itemIdx),
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

  const isModalOpen = theaterState.isOpen || shortsState.isOpen;

  // Mouse wheel dampening & smooth elevator gliding
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (isModalOpen) return;

      // Allow horizontal scrubbing inside albums
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
  }, [isModalOpen, handleNextAlbum, handlePrevAlbum]);

  // Mobile Touch Swipe with Dampening
  useEffect(() => {
    let touchStartY = 0;
    let touchStartX = 0;

    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (isModalOpen) return;
      if (isTransitioningRef.current) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-disable-page-swipe="true"]')) return;

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
  }, [isModalOpen, handleNextAlbum, handlePrevAlbum]);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isModalOpen) return;
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
  }, [isModalOpen, handleNextAlbum, handlePrevAlbum, handleBackToTop, scrollToAlbum, albums.length]);

  // Network Error Screen
  if (!data && isError) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0c] flex items-center justify-center text-white p-6 font-mono">
        <div className="max-w-md p-8 rounded-2xl bg-[#10121a] border border-white/10 text-center space-y-4">
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
        className="absolute inset-0 w-full will-change-transform"
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
                  isLoading={isLoading}
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

      {/* ================= TOP NAVBAR & HAMBURGER DRAWER ================= */}
      <TopNavbar
        albums={albums}
        activeAlbumIndex={activeAlbumIndex}
        onSelectAlbum={scrollToAlbum}
      />

      {/* ================= AUTO-HIDING RIGHT-SIDE NAVIGATION DOCK ================= */}
      <AlbumProgressDots
        albums={albums}
        activeAlbumIndex={activeAlbumIndex}
        onSelectAlbum={scrollToAlbum}
        isLightMode={isLightMode}
      />

      {/* ================= YOUTUBE-STYLE MEDIA THEATER ================= */}
      <YouTubeTheaterModal
        isOpen={theaterState.isOpen}
        onClose={() => setTheaterState((prev) => ({ ...prev, isOpen: false }))}
        album={theaterState.album}
        initialIndex={theaterState.initialIndex}
        onNextAlbum={handleNextAlbum}
        onPrevAlbum={handlePrevAlbum}
      />

      {/* ================= 9:16 VERTICAL SHORTS REELS MODAL ================= */}
      <ShortsFeedModal
        isOpen={shortsState.isOpen}
        onClose={() => setShortsState((prev) => ({ ...prev, isOpen: false }))}
        shorts={shortsState.shorts}
        initialIndex={shortsState.initialIndex}
      />
    </main>
  );
}

export default App;
