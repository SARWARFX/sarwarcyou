import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useMediaData } from './useMediaData';
import { extractTwelveAlbums } from './utils/albumExtractor';
import { AlbumStage } from './components/AlbumStage';
import { BrandLogo } from './components/BrandLogo';
import { AlbumNavigationControls } from './components/AlbumNavigationControls';
import { VerticalFolderMenu } from './components/VerticalFolderMenu';
import { MediaModal } from './components/MediaModal';
import { FALLBACK_MEDIA_DATA } from './data/fallbackData';
import type { StageMediaItem } from './types';
import { Play, Maximize2, Loader2 } from 'lucide-react';

function App() {
  const { data, isLoading, isError } = useMediaData();

  // Extract exactly 12 Albums corresponding to the 12 Google Drive folders
  const albums = useMemo(() => {
    return extractTwelveAlbums(data || FALLBACK_MEDIA_DATA);
  }, [data]);

  // Current active snapped album index (0 to 11)
  const [activeAlbumIndex, setActiveAlbumIndex] = useState<number>(0);
  // Track active media card index per album (default 0)
  const [activeMediaIndices, setActiveMediaIndices] = useState<{ [albumIdx: number]: number }>({});

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  // Fullscreen Modal State
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

  const handleOpenModal = useCallback((item: StageMediaItem) => {
    if (!item || !item.url) return;
    setModalState({
      isOpen: true,
      url: item.url,
      type: item.type,
      title: item.title,
    });
  }, []);

  // Programmatic scroll strictly to exact fullpage album
  const scrollToAlbum = useCallback((targetIndex: number) => {
    if (!scrollContainerRef.current) return;
    const clamped = Math.max(0, Math.min(albums.length - 1, targetIndex));
    const targetEl = document.getElementById(`album-section-${clamped}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth' });
    } else {
      scrollContainerRef.current.scrollTo({
        top: clamped * window.innerHeight,
        behavior: 'smooth',
      });
    }
    setActiveAlbumIndex(clamped);
  }, [albums.length]);

  const handlePrevAlbum = useCallback(() => {
    scrollToAlbum(activeAlbumIndex - 1);
  }, [activeAlbumIndex, scrollToAlbum]);

  const handleNextAlbum = useCallback(() => {
    scrollToAlbum(activeAlbumIndex + 1);
  }, [activeAlbumIndex, scrollToAlbum]);

  const handleBackToTop = useCallback(() => {
    scrollToAlbum(0);
  }, [scrollToAlbum]);

  // Handle scroll events to synchronize active album index
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const scrollY = scrollContainerRef.current.scrollTop;
    const height = window.innerHeight;
    const snapped = Math.round(scrollY / height);
    if (snapped !== activeAlbumIndex && snapped >= 0 && snapped < albums.length) {
      setActiveAlbumIndex(snapped);
    }
  }, [activeAlbumIndex, albums.length]);

  // Vertical snap observer on mouse wheel (strictly snaps to next/prev album)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      if (modalState.isOpen) return;
      // Only capture vertical scroll intent
      if (Math.abs(e.deltaY) > 28) {
        e.preventDefault();
        if (isScrollingRef.current) return;
        isScrollingRef.current = true;
        if (e.deltaY > 0) {
          handleNextAlbum();
        } else {
          handlePrevAlbum();
        }
        setTimeout(() => {
          isScrollingRef.current = false;
        }, 700);
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [modalState.isOpen, handleNextAlbum, handlePrevAlbum]);

  // Touch swipe support for mobile snap
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (modalState.isOpen) return;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaY = touchStartY - touchEndY;
      if (Math.abs(deltaY) > 50) {
        if (deltaY > 0) {
          handleNextAlbum();
        } else {
          handlePrevAlbum();
        }
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [modalState.isOpen, handleNextAlbum, handlePrevAlbum]);

  // Full keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (modalState.isOpen) return;
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
  }, [modalState.isOpen, handleNextAlbum, handlePrevAlbum, handleBackToTop, scrollToAlbum, albums.length]);

  // Loading Screen (only if no fallback data is present)
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

  const currentAlbum = albums[activeAlbumIndex] || albums[0];

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* ================= VERTICAL FULLPAGE SNAP CONTAINER ================= */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="h-screen w-screen overflow-y-scroll overflow-x-hidden snap-y snap-mandatory scroll-smooth no-scrollbar select-none bg-black"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {albums.map((album, idx) => {
          const isActive = idx === activeAlbumIndex;
          const isNear = Math.abs(idx - activeAlbumIndex) <= 1;
          const currentMediaIdx = activeMediaIndices[idx] || 0;
          const activeMediaItem = album.items[currentMediaIdx] || album.items[0];
          const isComingSoon = album.itemCount === 0 || album.layoutType.startsWith('coming-soon');

          return (
            <section
              id={`album-section-${idx}`}
              key={album.id}
              className="relative w-screen h-screen snap-start snap-always overflow-hidden flex-shrink-0"
              style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
            >
              {/* 3D Stage for this Album (Only rendered when active or adjacent) */}
              {isNear && (
                <AlbumStage
                  album={album}
                  isActive={isActive}
                  activeIndex={currentMediaIdx}
                  onActiveIndexChange={(newIdx) => {
                    setActiveMediaIndices((prev) => ({ ...prev, [idx]: newIdx }));
                  }}
                  onSelectItem={handleOpenModal}
                />
              )}

              {/* Minimalist Top Album Tag */}
              <header className="absolute top-6 left-6 sm:top-8 sm:left-8 z-30 pointer-events-auto flex items-center gap-3">
                <div className="px-3.5 py-1.5 rounded-full bg-black/65 border border-white/10 backdrop-blur-xl flex items-center gap-2 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00D2FF] shadow-[0_0_8px_#00D2FF]" />
                  <span className="text-[11px] font-mono font-bold tracking-widest text-[#00D2FF] uppercase">
                    {(idx + 1).toString().padStart(2, '0')} // {album.name}
                  </span>
                  <span className="text-white/30">•</span>
                  <span className="text-[10px] font-mono text-white/50 tracking-wider">
                    {isComingSoon ? 'COMING SOON' : `${album.itemCount} ITEMS`}
                  </span>
                </div>
              </header>

              {/* Top-Right Expand Button for Active Media */}
              {!isComingSoon && activeMediaItem && (
                <div className="absolute top-6 right-6 sm:top-8 sm:right-8 z-30 pointer-events-auto">
                  <button
                    onClick={() => handleOpenModal(activeMediaItem)}
                    className="flex items-center gap-2 px-5 py-2 rounded-full bg-white text-black font-space font-bold uppercase text-xs tracking-wider hover:bg-neutral-200 transition-all shadow-[0_0_25px_rgba(255,255,255,0.35)] hover:shadow-[0_0_35px_rgba(0,210,255,0.6)] hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    {album.type === 'video' ? (
                      <Play className="w-3.5 h-3.5 fill-black" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                    )}
                    <span>{album.type === 'video' ? 'PLAY' : 'EXPAND'}</span>
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* ================= FIXED LUXURY OVERLAYS ================= */}

      {/* 1. Bottom-Left Modern Electric-Blue Play Logo & Branding */}
      <BrandLogo />

      {/* 2. Bottom-Right Navigation Controls (Up/Down Arrows & Back to Top) */}
      <AlbumNavigationControls
        currentAlbumIndex={activeAlbumIndex}
        totalAlbums={albums.length}
        currentAlbumName={currentAlbum.name}
        onPrevAlbum={handlePrevAlbum}
        onNextAlbum={handleNextAlbum}
        onBackToTop={handleBackToTop}
      />

      {/* 3. Right-Side Floating 12-Album Navigation Dock */}
      <VerticalFolderMenu
        albums={albums}
        activeAlbumIndex={activeAlbumIndex}
        onSelectAlbum={scrollToAlbum}
      />

      {/* 4. Fullscreen Lightbox & 16:9 Video Player */}
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
