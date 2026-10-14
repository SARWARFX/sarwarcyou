/* oxlint-disable react-hooks/exhaustive-deps, react/preserve-manual-memoization */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ArrowUp } from 'lucide-react';
import { useMediaData } from './useMediaData';
import { extractTwelveAlbums } from './utils/albumExtractor';
import { AlbumStage } from './components/AlbumStage';
import { TopNavbar } from './components/TopNavbar';
import { AlbumProgressDots } from './components/AlbumProgressDots';
import { SplashPreloader } from './components/SplashPreloader';
import { MobileGalleryFeed } from './components/MobileGalleryFeed';
import { YouTubeTheaterModal } from './components/YouTubeTheaterModal';
import { ShortsFeedModal } from './components/ShortsFeedModal';
import { FALLBACK_HF_CATALOG } from './data/fallbackData';
import {
  parseUrlState,
  findMatchingAlbum,
  findMatchingMediaItem,
  syncUrlState,
  getStoredLastActiveAlbum,
  anchorToAlbumSection,
} from './utils/urlRouter';
import { useRecentHistory } from './hooks/useRecentHistory';
import { useDynamicFavicon } from './hooks/useDynamicFavicon';
import type { StageMediaItem } from './types';

function App() {
  useDynamicFavicon('#22d3ee');
  const { data, isLoading, isError } = useMediaData();
  const { recentItems, addToHistory, clearHistory } = useRecentHistory();

  // Curated Albums (Powered by Hugging Face CDN) - Strictly filtered to exclude phantom/empty albums
  const albums = useMemo(() => {
    const rawAlbums = extractTwelveAlbums(data || FALLBACK_HF_CATALOG);
    // Strip any phantom, empty, or unpopulated albums
    const activeAlbums = rawAlbums.filter(
      (album) => Array.isArray(album.items) && album.items.length > 0
    );
    return activeAlbums.map((album, idx) => ({ ...album, index: idx }));
  }, [data]);

  // First 6 video items in the feed for thumbnail preloading
  const initialVideoUrls = useMemo(() => {
    const urls: string[] = [];
    for (const album of albums) {
      for (const item of album.items) {
        if (item.type === 'video' && item.url) {
          urls.push(item.url);
          if (urls.length >= 6) break;
        }
      }
      if (urls.length >= 6) break;
    }
    return urls;
  }, [albums]);

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
    document.title = 'Sarwar C You';
  }, [activeAlbumIndex]);

  const hasRestoredAlbumRef = useRef(false);
  const hasRestoredMediaRef = useRef(false);

  // Deep-linking restoration on initial mount / data ready
  useEffect(() => {
    if (albums.length === 0) return;

    const { albumQuery, mediaQuery } = parseUrlState();

    // 1. Restore Album (from URL param or sessionStorage)
    if (!hasRestoredAlbumRef.current) {
      const storedAlbum = !albumQuery ? getStoredLastActiveAlbum() : null;
      const targetQuery = albumQuery || storedAlbum;

      if (targetQuery) {
        const match = findMatchingAlbum(albums, targetQuery);
        if (match && match.index !== activeAlbumIndexRef.current) {
          setActiveAlbumIndex(match.index);
          anchorToAlbumSection(match.index);
        }
      }
      hasRestoredAlbumRef.current = true;
    }

    // 2. Restore Media Item (launch modal if requested via ?media=...)
    if (mediaQuery && !hasRestoredMediaRef.current) {
      const curAlbum = albums[activeAlbumIndexRef.current];
      if (curAlbum && curAlbum.items.length > 0) {
        const mediaMatch = findMatchingMediaItem(curAlbum.items, mediaQuery);
        if (mediaMatch) {
          const isShorts =
            curAlbum.name.toLowerCase().includes('short') ||
            curAlbum.name.toLowerCase().includes('reel') ||
            curAlbum.layoutType === 'vertical-waterfall';

          if (isShorts) {
            setShortsState({
              isOpen: true,
              shorts: curAlbum.items,
              initialIndex: mediaMatch.index,
            });
            addToHistory(mediaMatch.item);
          } else {
            setTheaterState({
              isOpen: true,
              album: curAlbum,
              initialIndex: mediaMatch.index,
              posterUrl: undefined,
            });
            addToHistory(mediaMatch.item);
          }
          hasRestoredMediaRef.current = true;
        } else if (!isLoading && !!data) {
          hasRestoredMediaRef.current = true;
        }
      }
    }
  }, [albums, isLoading, data, addToHistory]);

  // Browser navigation: Back / Forward popstate synchronization
  useEffect(() => {
    const handlePopState = () => {
      const { albumQuery, mediaQuery } = parseUrlState();
      if (albums.length === 0) return;

      const albumMatch = albumQuery ? findMatchingAlbum(albums, albumQuery) : null;
      const targetIdx = albumMatch ? albumMatch.index : 0;

      if (targetIdx !== activeAlbumIndexRef.current) {
        setActiveAlbumIndex(targetIdx);
      }
      anchorToAlbumSection(targetIdx);

      const targetAlbum = albums[targetIdx];
      if (mediaQuery && targetAlbum && targetAlbum.items.length > 0) {
        const mediaMatch = findMatchingMediaItem(targetAlbum.items, mediaQuery);
        if (mediaMatch) {
          const isShorts =
            targetAlbum.name.toLowerCase().includes('short') ||
            targetAlbum.name.toLowerCase().includes('reel') ||
            targetAlbum.layoutType === 'vertical-waterfall';
          if (isShorts) {
            setShortsState({
              isOpen: true,
              shorts: targetAlbum.items,
              initialIndex: mediaMatch.index,
            });
            addToHistory(mediaMatch.item);
            setTheaterState((prev) => ({ ...prev, isOpen: false }));
          } else {
            setTheaterState({
              isOpen: true,
              album: targetAlbum,
              initialIndex: mediaMatch.index,
              posterUrl: undefined,
            });
            addToHistory(mediaMatch.item);
            setShortsState((prev) => ({ ...prev, isOpen: false }));
          }
          return;
        }
      }

      // No media in route -> close modals cleanly
      setTheaterState((prev) => ({ ...prev, isOpen: false }));
      setShortsState((prev) => ({ ...prev, isOpen: false }));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [albums]);

  const isTransitioningRef = useRef(false);
  const wheelDeltaAccumulatorRef = useRef(0);
  const lastWheelTimeRef = useRef(0);

  // YouTube-Style Media Theater Modal State
  const [theaterState, setTheaterState] = useState<{
    isOpen: boolean;
    album: typeof albums[0] | null;
    initialIndex: number;
    posterUrl?: string;
  }>({
    isOpen: false,
    album: null,
    initialIndex: 0,
    posterUrl: undefined,
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

  // Handle clicking any media item across Driftime scenes or Dynamic Carousels
  const handleSelectItem = useCallback((item: StageMediaItem, albumIdx: number, posterUrl?: string) => {
    // Record to recently opened history
    addToHistory(item);

    const curAlbum = albums[albumIdx];
    const isItemShorts = Boolean(
      item.category?.toLowerCase().includes('short') ||
      item.category?.toLowerCase().includes('reel') ||
      item.url?.toLowerCase().includes('/shorts/') ||
      item.id?.toLowerCase().includes('shorts/')
    );
    const isAlbumShorts = Boolean(
      curAlbum?.name.toLowerCase().includes('short') ||
      curAlbum?.name.toLowerCase().includes('reel') ||
      curAlbum?.layoutType === 'vertical-waterfall'
    );

    if (isItemShorts || isAlbumShorts) {
      const shortsAlbum = albums.find((a) => a.id === 'album-shorts');
      const shortsList = isAlbumShorts && curAlbum ? curAlbum.items : (shortsAlbum?.items || [item]);
      const itemIdx = shortsList.findIndex((s) => s.id === item.id || s.url === item.url);

      setShortsState({
        isOpen: true,
        shorts: shortsList,
        initialIndex: Math.max(0, itemIdx),
      });
    } else {
      const targetAlbum =
        curAlbum && curAlbum.items.some((it) => it.id === item.id)
          ? curAlbum
          : albums.find((a) => a.items.some((it) => it.id === item.id)) || curAlbum || {
              id: 'album-view',
              index: 0,
              name: item.category || 'Gallery',
              type: item.type,
              itemCount: 1,
              items: [item],
              layoutType: 'ribbon-slider' as const,
            };

      const itemIdx = targetAlbum ? targetAlbum.items.findIndex((s) => s.id === item.id) : 0;

      setTheaterState({
        isOpen: true,
        album: targetAlbum || null,
        initialIndex: Math.max(0, itemIdx),
        posterUrl,
      });
    }

    if (curAlbum) {
      syncUrlState({ album: curAlbum, mediaItem: item, replace: false });
    }
  }, [albums, addToHistory]);

  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const [mobileScrolled, setMobileScrolled] = useState(false);

  const handleMobileScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setMobileScrolled(e.currentTarget.scrollTop > 250);
  }, []);

  // Luxury Elevator Smooth Navigation
  const scrollToAlbum = useCallback((targetIndex: number) => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      const el = document.getElementById(`mobile-album-${targetIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setActiveAlbumIndex(targetIndex);
      return;
    }

    const clamped = Math.max(0, Math.min(albums.length - 1, targetIndex));
    if (clamped === activeAlbumIndexRef.current && !isTransitioningRef.current) return;
    if (isTransitioningRef.current) return;

    isTransitioningRef.current = true;
    setIsTransitioning(true);
    setPrevAlbumIndex(activeAlbumIndexRef.current);
    setActiveAlbumIndex(clamped);

    const curAlbum = albums[clamped];
    if (curAlbum) {
      syncUrlState({ album: curAlbum, mediaItem: null, replace: true });
    }

    // Luxury elevator duration: 950ms + 150ms inertia cooldown
    setTimeout(() => {
      setIsTransitioning(false);
      setPrevAlbumIndex(clamped);
      anchorToAlbumSection(clamped);
      setTimeout(() => {
        isTransitioningRef.current = false;
        wheelDeltaAccumulatorRef.current = 0;
      }, 150);
    }, 950);
  }, [albums]);

  const handlePrevAlbum = useCallback(() => {
    scrollToAlbum(activeAlbumIndexRef.current - 1);
  }, [scrollToAlbum]);

  const handleNextAlbum = useCallback(() => {
    scrollToAlbum(activeAlbumIndexRef.current + 1);
  }, [scrollToAlbum]);

  const handleBackToTop = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768 && mobileScrollRef.current) {
      mobileScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    scrollToAlbum(0);
  }, [scrollToAlbum]);

  const handleResetHome = useCallback(() => {
    setTheaterState((prev) => ({ ...prev, isOpen: false }));
    setShortsState((prev) => ({ ...prev, isOpen: false }));
    if (typeof window !== 'undefined' && window.innerWidth < 768 && mobileScrollRef.current) {
      mobileScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    scrollToAlbum(0);
    syncUrlState({ album: null, mediaItem: null, replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [scrollToAlbum]);

  const handleCloseTheater = useCallback(() => {
    setTheaterState((prev) => ({ ...prev, isOpen: false }));
    const curAlbum = albums[activeAlbumIndexRef.current];
    syncUrlState({ album: curAlbum, mediaItem: null, replace: true });
    anchorToAlbumSection(activeAlbumIndexRef.current);
  }, [albums]);

  const handleCloseShorts = useCallback(() => {
    setShortsState((prev) => ({ ...prev, isOpen: false }));
    const curAlbum = albums[activeAlbumIndexRef.current];
    syncUrlState({ album: curAlbum, mediaItem: null, replace: true });
    anchorToAlbumSection(activeAlbumIndexRef.current);
  }, [albums]);

  const handleTheaterIndexChange = useCallback((newIdx: number) => {
    if (theaterState.album && theaterState.album.items[newIdx]) {
      const item = theaterState.album.items[newIdx];
      addToHistory(item);
      syncUrlState({ album: theaterState.album, mediaItem: item, replace: true });
    }
  }, [theaterState.album, addToHistory]);

  const handleShortsIndexChange = useCallback((newIdx: number) => {
    const curAlbum = albums[activeAlbumIndexRef.current];
    if (shortsState.shorts[newIdx]) {
      const item = shortsState.shorts[newIdx];
      addToHistory(item);
      if (curAlbum) {
        syncUrlState({ album: curAlbum, mediaItem: item, replace: true });
      }
    }
  }, [albums, shortsState.shorts, addToHistory]);

  const handleSwitchAlbum = useCallback((targetAlbum: (typeof albums)[0], itemIdx = 0) => {
    setTheaterState({
      isOpen: true,
      album: targetAlbum,
      initialIndex: itemIdx,
      posterUrl: undefined,
    });
    setActiveAlbumIndex(targetAlbum.index);
    const item = targetAlbum.items[itemIdx];
    syncUrlState({ album: targetAlbum, mediaItem: item, replace: false });
    anchorToAlbumSection(targetAlbum.index);
  }, []);

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
      if (window.innerWidth < 768) return;
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (window.innerWidth < 768) return;
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
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white p-6 font-mono">
        <div className="max-w-md p-8 rounded-2xl bg-zinc-950 text-center space-y-4">
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
      {/* ================= RESILIENT OLED SPLASH PRELOADER ================= */}
      <SplashPreloader
        isReady={!isLoading && !!data}
        initialVideoUrls={initialVideoUrls}
      />

      {/* ================= MOBILE HIGH-DENSITY NATIVE SCROLL GALLERY (md:hidden) ================= */}
      <MobileGalleryFeed
        albums={albums}
        onSelectItem={handleSelectItem}
        recentItems={recentItems}
        onClearHistory={clearHistory}
        scrollRef={mobileScrollRef}
        onScroll={handleMobileScroll}
      />

      {/* ================= DESKTOP VERTICAL LUXURY ELEVATOR CONTAINER (hidden md:block) ================= */}
      <div
        className="hidden md:block absolute inset-0 w-full will-change-transform"
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
              {/* Perfectly Centered Editorial Stage */}
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
                  onSelectItem={(item, posterUrl) => handleSelectItem(item, idx, posterUrl)}
                  recentItems={recentItems}
                  onClearHistory={clearHistory}
                />
              )}
            </section>
          );
        })}
      </div>

      {/* ================= CLEAN OLED TOP NAVBAR ================= */}
      <TopNavbar
        albums={albums}
        activeAlbumIndex={activeAlbumIndex}
        onSelectAlbum={scrollToAlbum}
        onResetHome={handleResetHome}
        onSelectItem={handleSelectItem}
      />

      {/* ================= RIGHT-SIDE NAVIGATION DOCK ================= */}
      {!isModalOpen && (
        <AlbumProgressDots
          albums={albums}
          activeAlbumIndex={activeAlbumIndex}
          onSelectAlbum={scrollToAlbum}
          isLightMode={isLightMode}
        />
      )}

      {/* ================= FLOATING "BACK TO TOP" PILL ================= */}
      {(activeAlbumIndex > 0 || mobileScrolled) && (
        <button
          onClick={handleBackToTop}
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-30 flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/80 hover:bg-zinc-900 backdrop-blur-xl text-zinc-300 hover:text-white shadow-2xl transition-all duration-300 ease-out cursor-pointer group"
          title="Back to Top"
          aria-label="Back to Top"
        >
          <ArrowUp className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-widest hidden sm:inline">
            Top
          </span>
        </button>
      )}

      {/* ================= YOUTUBE-STYLE MEDIA THEATER ================= */}
      <YouTubeTheaterModal
        isOpen={theaterState.isOpen}
        onClose={handleCloseTheater}
        album={theaterState.album}
        allAlbums={albums}
        initialIndex={theaterState.initialIndex}
        posterUrl={theaterState.posterUrl}
        onSwitchAlbum={handleSwitchAlbum}
        onNextAlbum={handleNextAlbum}
        onPrevAlbum={handlePrevAlbum}
        onIndexChange={handleTheaterIndexChange}
      />

      {/* ================= 9:16 VERTICAL SHORTS REELS MODAL ================= */}
      <ShortsFeedModal
        isOpen={shortsState.isOpen}
        onClose={handleCloseShorts}
        shorts={shortsState.shorts}
        initialIndex={shortsState.initialIndex}
        onIndexChange={handleShortsIndexChange}
      />
    </main>
  );
}

export default App;
